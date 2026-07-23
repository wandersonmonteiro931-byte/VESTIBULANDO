import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { where } from "firebase/firestore";
import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  Camera,
  CheckCircle2,
  Clock3,
  FileClock,
  FilePenLine,
  Flag,
  History,
  ImagePlus,
  ListChecks,
  Loader2,
  Medal,
  Play,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  SpellCheck2,
  Target,
  Timer,
  Trophy,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  DEFAULT_ESSAY_THEMES,
  DEFAULT_EXAMS,
  DEFAULT_QUESTIONS,
} from "./catalog";
import {
  createEadRecord,
  eadNow,
  imageFileToDataUrl,
  setEadRecord,
  useEadCollection,
} from "./store";
import type {
  EadEssay,
  EadEssayTheme,
  EadExam,
  EadExamAttempt,
  EadQuestion,
  EadStudyItem,
} from "./types";
import {
  EmptyState,
  Field,
  SectionHeader,
  StatCard,
  StatusBadge,
  formatDate,
} from "./ui";

function actorFromUser(userData: any) {
  return userData
    ? { uid: userData.uid, nome: userData.nome || "Usuário", tipo: userData.tipo || "aluno" }
    : null;
}

function mergeById<T extends { id: string }>(defaults: T[], remote: T[]) {
  const records = new Map<string, T>();
  defaults.forEach((item) => records.set(item.id, item));
  remote.forEach((item) => records.set(item.id, item));
  return Array.from(records.values());
}

function formatSeconds(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return hours
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function calculateTriLike(questions: EadQuestion[], answers: Record<string, number>) {
  const weights = { facil: 0.8, media: 1, dificil: 1.25 };
  let achieved = 0;
  let possible = 0;
  let easyCorrect = 0;
  let hardCorrect = 0;

  questions.forEach((question) => {
    const weight = weights[question.difficulty];
    possible += weight;
    if (answers[question.id] === question.correctIndex) {
      achieved += weight;
      if (question.difficulty === "facil") easyCorrect += 1;
      if (question.difficulty === "dificil") hardCorrect += 1;
    }
  });

  const base = possible ? achieved / possible : 0;
  const consistency = hardCorrect > easyCorrect && easyCorrect === 0 ? -25 : 0;
  return Math.max(200, Math.min(950, Math.round(200 + base * 750 + consistency)));
}

export function ExamSimulatorPage() {
  const { userData } = useAuth() as any;
  const { toast } = useToast();
  const uid = userData?.uid || "";
  const actor = actorFromUser(userData);
  const [selectedExam, setSelectedExam] = useState<EadExam | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<EadExamAttempt | null>(null);
  const startedAtRef = useRef<string>(eadNow());

  const remoteExams = useEadCollection<EadExam>("eadExams", {
    filter: (exam) => exam.published !== false,
  });
  const remoteQuestions = useEadCollection<EadQuestion>("eadQuestions", {
    filter: (question) => question.published !== false,
  });
  const ownAttempts = useEadCollection<EadExamAttempt>("eadExamAttempts", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
  });
  const allAttempts = useEadCollection<EadExamAttempt>("eadExamAttempts", {
    enabled: !!uid,
    filter: (attempt) => attempt.status === "concluido",
  });

  const exams = useMemo(
    () => mergeById(DEFAULT_EXAMS, remoteExams.data).filter((exam) => exam.published),
    [remoteExams.data],
  );
  const questionBank = useMemo(
    () => mergeById(DEFAULT_QUESTIONS, remoteQuestions.data).filter((question) => question.published),
    [remoteQuestions.data],
  );
  const examQuestions = useMemo(() => {
    if (!selectedExam) return [];
    const byId = new Map(questionBank.map((question) => [question.id, question]));
    const selected = selectedExam.questionIds
      .map((questionId) => byId.get(questionId))
      .filter(Boolean) as EadQuestion[];
    if (selected.length) return selected;
    return selectedExam.discipline
      ? questionBank.filter((question) => question.discipline === selectedExam.discipline)
      : questionBank.slice(0, selectedExam.questionCount);
  }, [questionBank, selectedExam]);

  const activeAttemptId = selectedExam ? `${uid}_${selectedExam.id}_active` : "";
  const currentQuestion = examQuestions[activeIndex];
  const completedAttempts = ownAttempts.data.filter((attempt) => attempt.status === "concluido");
  const averageScore = completedAttempts.length
    ? Math.round(
        completedAttempts.reduce((total, attempt) => total + attempt.score, 0) /
          completedAttempts.length,
      )
    : 0;
  const bestScore = completedAttempts.length
    ? Math.max(...completedAttempts.map((attempt) => attempt.score))
    : 0;

  useEffect(() => {
    if (!selectedExam || result) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [result, selectedExam]);

  useEffect(() => {
    if (!selectedExam || !uid || result || elapsedSeconds === 0 || elapsedSeconds % 15 !== 0) return;
    void setEadRecord(
      "eadExamAttempts",
      activeAttemptId,
      {
        ownerId: uid,
        ownerName: userData?.nome || "Aluno",
        examId: selectedExam.id,
        examTitle: selectedExam.title,
        answers,
        elapsedSeconds,
        correctCount: 0,
        totalQuestions: examQuestions.length,
        score: 0,
        triEstimate: 0,
        status: "em-andamento",
        strengths: [],
        weaknesses: [],
        startedAt: startedAtRef.current,
      },
      actor,
      `Salvamento automático: ${selectedExam.title}`,
    ).catch(() => undefined);
    // Save timer state at a controlled interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSeconds]);

  const openExam = (exam: EadExam) => {
    const unfinished = ownAttempts.data.find(
      (attempt) => attempt.examId === exam.id && attempt.status === "em-andamento",
    );
    setSelectedExam(exam);
    setAnswers(unfinished?.answers || {});
    setElapsedSeconds(unfinished?.elapsedSeconds || 0);
    setActiveIndex(0);
    setResult(null);
    startedAtRef.current = unfinished?.startedAt || eadNow();
  };

  const answerQuestion = async (questionId: string, selectedIndex: number) => {
    if (!selectedExam || !uid) return;
    const nextAnswers = { ...answers, [questionId]: selectedIndex };
    setAnswers(nextAnswers);
    try {
      await setEadRecord(
        "eadExamAttempts",
        activeAttemptId,
        {
          ownerId: uid,
          ownerName: userData?.nome || "Aluno",
          examId: selectedExam.id,
          examTitle: selectedExam.title,
          answers: nextAnswers,
          elapsedSeconds,
          correctCount: 0,
          totalQuestions: examQuestions.length,
          score: 0,
          triEstimate: 0,
          status: "em-andamento",
          strengths: [],
          weaknesses: [],
          startedAt: startedAtRef.current,
        },
        actor,
        `Resposta salva: ${selectedExam.title}`,
      );
    } catch {
      localStorage.setItem(`vestibulando-exam-${activeAttemptId}`, JSON.stringify(nextAnswers));
    }
  };

  const finishExam = async () => {
    if (!selectedExam || !uid || !examQuestions.length) return;
    const missing = examQuestions.length - Object.keys(answers).length;
    if (missing > 0 && !window.confirm(`Ainda há ${missing} questão(ões) sem resposta. Deseja finalizar mesmo assim?`)) {
      return;
    }
    setFinishing(true);
    try {
      const correct = examQuestions.filter(
        (question) => answers[question.id] === question.correctIndex,
      );
      const errors = examQuestions.filter(
        (question) => answers[question.id] !== question.correctIndex,
      );
      const byDiscipline = new Map<string, { correct: number; total: number }>();
      examQuestions.forEach((question) => {
        const stats = byDiscipline.get(question.discipline) || { correct: 0, total: 0 };
        stats.total += 1;
        if (answers[question.id] === question.correctIndex) stats.correct += 1;
        byDiscipline.set(question.discipline, stats);
      });
      const strengths = Array.from(byDiscipline.entries())
        .filter(([, stats]) => stats.correct / stats.total >= 0.7)
        .map(([discipline]) => discipline);
      const weaknesses = Array.from(byDiscipline.entries())
        .filter(([, stats]) => stats.correct / stats.total < 0.7)
        .map(([discipline]) => discipline);
      const score = Math.round((correct.length / examQuestions.length) * 1000);
      const payload: EadExamAttempt = {
        id: activeAttemptId,
        ownerId: uid,
        ownerName: userData?.nome || "Aluno",
        examId: selectedExam.id,
        examTitle: selectedExam.title,
        answers,
        elapsedSeconds,
        correctCount: correct.length,
        totalQuestions: examQuestions.length,
        score,
        triEstimate: calculateTriLike(examQuestions, answers),
        status: "concluido",
        strengths,
        weaknesses,
        startedAt: startedAtRef.current,
        completedAt: eadNow(),
        updatedAt: eadNow(),
      };
      await setEadRecord("eadExamAttempts", activeAttemptId, payload, actor, selectedExam.title);

      const reviewDate = format(addDays(new Date(), 1), "yyyy-MM-dd");
      for (const discipline of weaknesses) {
        const studyItem: Omit<EadStudyItem, "id"> = {
          ownerId: uid,
          title: `Revisar erros do simulado — ${discipline}`,
          discipline,
          kind: "revisao",
          scheduledDate: reviewDate,
          durationMinutes: 35,
          difficulty: "media",
          completed: false,
          autoReplanned: true,
          notes: `Gerado automaticamente a partir de ${selectedExam.title}.`,
          createdAt: eadNow(),
          updatedAt: eadNow(),
        };
        await createEadRecord("eadStudyItems", studyItem, actor, studyItem.title);
      }
      setResult(payload);
      toast({
        title: "Simulado corrigido",
        description: "Seu resultado e o plano de revisão já foram atualizados.",
      });
    } catch (error: any) {
      toast({ title: "Erro ao finalizar", description: error.message, variant: "destructive" });
    } finally {
      setFinishing(false);
    }
  };

  const ranking = useMemo(() => {
    if (!selectedExam?.rankingEnabled) return [];
    return allAttempts.data
      .filter((attempt) => attempt.examId === selectedExam.id)
      .sort((a, b) => b.score - a.score || a.elapsedSeconds - b.elapsedSeconds)
      .slice(0, 10);
  }, [allAttempts.data, selectedExam]);

  if (selectedExam) {
    const answeredCount = Object.keys(answers).length;
    const remainingSeconds = Math.max(0, selectedExam.durationMinutes * 60 - elapsedSeconds);
    return (
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Simulado em andamento"
          title={selectedExam.title}
          description={`${examQuestions.length} questões · salvamento automático · correção imediata ao finalizar`}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSelectedExam(null);
                setResult(null);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Sair e continuar depois
            </Button>
          }
        />

        {result ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Acertos" value={`${result.correctCount}/${result.totalQuestions}`} icon={CheckCircle2} tone="success" />
              <StatCard label="Nota objetiva" value={result.score} helper="escala de 0 a 1000" icon={Target} />
              <StatCard label="Estimativa TRI" value={result.triEstimate} helper="estimativa pedagógica, não oficial" icon={BrainCircuit} tone="warning" />
              <StatCard label="Tempo total" value={formatSeconds(result.elapsedSeconds)} icon={Clock3} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Diagnóstico e plano de revisão</CardTitle>
                <CardDescription>
                  Os assuntos com menor desempenho foram adicionados automaticamente ao seu plano.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div>
                  <p className="mb-3 text-sm font-semibold text-emerald-600">Pontos fortes</p>
                  <div className="flex flex-wrap gap-2">
                    {result.strengths.length
                      ? result.strengths.map((item) => <Badge key={item}>{item}</Badge>)
                      : <span className="text-sm text-muted-foreground">Conclua mais questões para consolidar um ponto forte.</span>}
                  </div>
                </div>
                <div>
                  <p className="mb-3 text-sm font-semibold text-amber-600">Revisar primeiro</p>
                  <div className="flex flex-wrap gap-2">
                    {result.weaknesses.length
                      ? result.weaknesses.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)
                      : <span className="text-sm text-muted-foreground">Nenhuma área crítica neste simulado.</span>}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gabarito comentado</CardTitle>
                <CardDescription>Revise cada alternativa e entenda a resolução.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {examQuestions.map((question, index) => {
                  const correct = answers[question.id] === question.correctIndex;
                  return (
                    <div key={question.id} className={cn("rounded-xl border p-4", correct ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5")}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold">Questão {index + 1}</p>
                        <Badge variant={correct ? "default" : "destructive"}>{correct ? "Acertou" : "Revisar"}</Badge>
                      </div>
                      <p className="mt-3 text-sm">{question.statement}</p>
                      <p className="mt-3 text-sm font-medium">
                        Resposta correta: {String.fromCharCode(65 + question.correctIndex)} — {question.alternatives[question.correctIndex]}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{question.explanation}</p>
                      {question.explanationVideoUrl && (
                        <a href={question.explanationVideoUrl} target="_blank" rel="noreferrer">
                          <Button variant="ghost" className="mt-2 px-0 text-primary hover:text-primary">Ver explicação em vídeo</Button>
                        </a>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {selectedExam.rankingEnabled && (
              <Card>
                <CardHeader>
                  <CardTitle>Ranking opcional</CardTitle>
                  <CardDescription>Comparação apenas entre participantes deste simulado.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {ranking.map((attempt, index) => (
                    <div key={attempt.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <span className="w-7 font-bold text-primary">{index + 1}º</span>
                      <span className="min-w-0 flex-1 truncate">{attempt.ownerName}</span>
                      <span className="font-semibold">{attempt.score} pts</span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">{formatSeconds(attempt.elapsedSeconds)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Button onClick={() => { setSelectedExam(null); setResult(null); }} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Voltar aos simulados
            </Button>
          </div>
        ) : (
          <>
            <Card>
              <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
                <div className="flex items-center gap-3">
                  <Timer className={cn("h-6 w-6", remainingSeconds < 300 ? "text-destructive" : "text-primary")} />
                  <div><p className="text-xs text-muted-foreground">Tempo restante</p><p className="font-mono text-xl font-bold">{formatSeconds(remainingSeconds)}</p></div>
                </div>
                <div><p className="text-xs text-muted-foreground">Respondidas</p><p className="text-xl font-bold">{answeredCount}/{examQuestions.length}</p></div>
                <div><p className="text-xs text-muted-foreground">Progresso</p><Progress value={(answeredCount / Math.max(1, examQuestions.length)) * 100} className="mt-2" /></div>
              </CardContent>
            </Card>

            {currentQuestion ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="secondary">Questão {activeIndex + 1} de {examQuestions.length}</Badge>
                    <span className="text-xs text-muted-foreground">{currentQuestion.discipline} · {currentQuestion.subject} · {currentQuestion.difficulty}</span>
                  </div>
                  <CardTitle className="pt-3 text-lg leading-relaxed">{currentQuestion.statement}</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={answers[currentQuestion.id] === undefined ? "" : String(answers[currentQuestion.id])}
                    onValueChange={(value) => answerQuestion(currentQuestion.id, Number(value))}
                    className="space-y-3"
                  >
                    {currentQuestion.alternatives.map((alternative, index) => (
                      <Label
                        key={alternative}
                        htmlFor={`${currentQuestion.id}-${index}`}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border p-4 font-normal transition-colors hover:bg-muted/50",
                          answers[currentQuestion.id] === index && "border-primary bg-primary/5",
                        )}
                      >
                        <RadioGroupItem id={`${currentQuestion.id}-${index}`} value={String(index)} className="mt-0.5" />
                        <span><strong>{String.fromCharCode(65 + index)}.</strong> {alternative}</span>
                      </Label>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
            ) : (
              <EmptyState title="Questões indisponíveis" description="Este simulado ainda não possui questões publicadas." />
            )}

            <div className="flex flex-col gap-4 rounded-xl border bg-background p-4">
              <div className="flex flex-wrap gap-2" aria-label="Navegação das questões">
                {examQuestions.map((question, index) => (
                  <Button
                    key={question.id}
                    size="icon"
                    variant={index === activeIndex ? "default" : answers[question.id] !== undefined ? "secondary" : "outline"}
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Ir para questão ${index + 1}`}
                  >
                    {index + 1}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap justify-between gap-3">
                <Button variant="outline" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => index - 1)}>Anterior</Button>
                <div className="flex gap-2">
                  {activeIndex < examQuestions.length - 1 ? (
                    <Button onClick={() => setActiveIndex((index) => index + 1)}>Próxima</Button>
                  ) : (
                    <Button onClick={finishExam} disabled={finishing} className="gap-2">
                      {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                      Finalizar e corrigir
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Simulados"
        title="Provas completas e diagnósticos"
        description="Pratique por disciplina ou no modelo ENEM, com cronômetro, salvamento automático, correção comentada, estimativa de nota e revisão dos erros."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Concluídos" value={completedAttempts.length} icon={BookOpenCheck} tone="success" />
        <StatCard label="Média" value={averageScore} helper="escala de 0 a 1000" icon={BarChart3} />
        <StatCard label="Melhor nota" value={bestScore} icon={Trophy} tone="warning" />
        <StatCard label="Disponíveis" value={exams.length} icon={ListChecks} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {exams.map((exam) => {
          const history = completedAttempts.filter((attempt) => attempt.examId === exam.id);
          const unfinished = ownAttempts.data.find((attempt) => attempt.examId === exam.id && attempt.status === "em-andamento");
          return (
            <Card key={exam.id} className="flex flex-col">
              <CardHeader className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl bg-primary/10 p-3 text-primary"><FileClock className="h-5 w-5" /></div>
                  <Badge variant="secondary">{exam.type.replaceAll("-", " ")}</Badge>
                </div>
                <CardTitle className="pt-3">{exam.title}</CardTitle>
                <CardDescription className="leading-relaxed">{exam.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-muted p-2"><strong className="block text-base">{exam.questionCount}</strong>questões</div>
                  <div className="rounded-lg bg-muted p-2"><strong className="block text-base">{exam.durationMinutes}</strong>minutos</div>
                  <div className="rounded-lg bg-muted p-2"><strong className="block text-base">{history.length}</strong>tentativas</div>
                </div>
                <Button className="w-full gap-2" onClick={() => openExam(exam)}>
                  <Play className="h-4 w-4" />
                  {unfinished ? "Continuar simulado" : "Fazer simulado"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function grammarSuggestions(text: string) {
  const suggestions: string[] = [];
  const normalized = text.trim();
  if (!normalized) return suggestions;
  if (normalized.length < 800) suggestions.push("O texto está curto; desenvolva argumentos e a proposta de intervenção.");
  if (normalized.length > 4200) suggestions.push("O texto está muito extenso; revise repetições e períodos longos.");
  if (!/[.!?]$/.test(normalized)) suggestions.push("Finalize o último período com pontuação.");
  if (/\b(mais melhor|menos pior)\b/i.test(normalized)) suggestions.push("Revise construções comparativas como “mais melhor” ou “menos pior”.");
  if (/(^|\.\s+)[a-zá-ú]/.test(normalized)) suggestions.push("Há frase iniciada com letra minúscula.");
  if ((normalized.match(/\bque\b/gi) || []).length > 18) suggestions.push("A palavra “que” aparece muitas vezes; considere variar a construção dos períodos.");
  const paragraphs = normalized.split(/\n\s*\n/).filter(Boolean);
  if (paragraphs.length < 4) suggestions.push("Organize o texto em ao menos quatro parágrafos: introdução, dois desenvolvimentos e conclusão.");
  if (!/\b(portanto|assim|desse modo|logo|dessa forma)\b/i.test(normalized)) {
    suggestions.push("Considere usar um conector conclusivo na proposta de intervenção.");
  }
  return suggestions;
}

export function EssayWorkspacePage() {
  const { userData } = useAuth() as any;
  const { toast } = useToast();
  const uid = userData?.uid || "";
  const actor = actorFromUser(userData);
  const [selectedTheme, setSelectedTheme] = useState<EadEssayTheme | null>(null);
  const [essayId, setEssayId] = useState("");
  const [text, setText] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const remoteThemes = useEadCollection<EadEssayTheme>("eadEssayThemes", {
    filter: (theme) => theme.published !== false,
  });
  const essays = useEadCollection<EadEssay>("eadEssays", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
  });
  const versions = useEadCollection<any>("eadEssayVersions", {
    constraints: essayId ? [where("essayId", "==", essayId)] : [],
    enabled: !!essayId,
    sort: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
  });
  const themes = useMemo(
    () => mergeById(DEFAULT_ESSAY_THEMES, remoteThemes.data).filter((theme) => theme.published),
    [remoteThemes.data],
  );
  const suggestions = useMemo(() => grammarSuggestions(text), [text]);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const corrected = essays.data.filter((essay) => essay.status === "corrigida");
  const average = corrected.length
    ? Math.round(corrected.reduce((sum, essay) => sum + (essay.totalScore || 0), 0) / corrected.length)
    : 0;

  useEffect(() => {
    if (!selectedTheme || !uid || !loadedRef.current) return;
    const timeout = window.setTimeout(() => {
      localStorage.setItem(
        `vestibulando-essay-${uid}-${selectedTheme.id}`,
        JSON.stringify({ text, imageDataUrl, savedAt: eadNow() }),
      );
      setLastSaved(eadNow());
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [imageDataUrl, selectedTheme, text, uid]);

  const openTheme = (theme: EadEssayTheme) => {
    const existing = [...essays.data]
      .filter((essay) => essay.themeId === theme.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const local = localStorage.getItem(`vestibulando-essay-${uid}-${theme.id}`);
    let localDraft: any = null;
    try { localDraft = local ? JSON.parse(local) : null; } catch { localDraft = null; }
    setSelectedTheme(theme);
    setEssayId(existing?.id || `${uid}_${theme.id}`);
    setText(existing?.text || localDraft?.text || "");
    setImageDataUrl(existing?.imageDataUrl || localDraft?.imageDataUrl || "");
    setLastSaved(existing?.updatedAt || localDraft?.savedAt || null);
    loadedRef.current = true;
  };

  const saveEssay = async (submit = false) => {
    if (!selectedTheme || !uid || (!text.trim() && !imageDataUrl)) {
      toast({ title: "Redação vazia", description: "Digite o texto ou envie uma foto antes de salvar.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const existing = essays.data.find((essay) => essay.id === essayId);
      const nextVersion = (existing?.version || 0) + 1;
      const status = submit ? "enviada" : existing?.status === "corrigida" ? "rascunho" : existing?.status || "rascunho";
      const payload: Omit<EadEssay, "id"> = {
        ownerId: uid,
        ownerName: userData?.nome || "Aluno",
        themeId: selectedTheme.id,
        themeTitle: selectedTheme.title,
        text,
        imageDataUrl: imageDataUrl || undefined,
        version: nextVersion,
        status,
        grammarNotes: suggestions,
        scores: submit && existing?.status === "corrigida" ? undefined : existing?.scores,
        totalScore: submit && existing?.status === "corrigida" ? undefined : existing?.totalScore,
        teacherComments: submit && existing?.status === "corrigida" ? undefined : existing?.teacherComments,
        correctedBy: submit && existing?.status === "corrigida" ? undefined : existing?.correctedBy,
        correctedAt: submit && existing?.status === "corrigida" ? undefined : existing?.correctedAt,
        createdAt: existing?.createdAt || eadNow(),
        updatedAt: eadNow(),
        submittedAt: submit ? eadNow() : existing?.submittedAt,
      };
      await setEadRecord("eadEssays", essayId, payload, actor, selectedTheme.title);
      await createEadRecord(
        "eadEssayVersions",
        {
          essayId,
          ownerId: uid,
          version: nextVersion,
          text,
          imageDataUrl: imageDataUrl || undefined,
          status,
          grammarNotes: suggestions,
          createdAt: eadNow(),
        },
        actor,
        `Versão ${nextVersion}: ${selectedTheme.title}`,
      );
      setLastSaved(eadNow());
      toast({
        title: submit ? "Redação enviada para correção" : "Rascunho salvo",
        description: submit
          ? "Você pode acompanhar o prazo e a correção nesta página."
          : `A versão ${nextVersion} foi guardada no histórico.`,
      });
      if (submit) setSelectedTheme(null);
    } catch (error: any) {
      toast({ title: "Erro ao salvar redação", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await imageFileToDataUrl(file);
      setImageDataUrl(compressed);
      toast({ title: "Foto preparada", description: "A imagem foi comprimida e será salva junto da redação, sem serviço de Storage." });
    } catch (error: any) {
      toast({ title: "Erro na foto", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (selectedTheme) {
    const existing = essays.data.find((essay) => essay.id === essayId);
    return (
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Editor de redação"
          title={selectedTheme.title}
          description="Escreva no editor ou envie uma foto. O rascunho local é salvo automaticamente enquanto você digita."
          action={<Button variant="outline" onClick={() => setSelectedTheme(null)}><X className="mr-2 h-4 w-4" />Voltar aos temas</Button>}
        />
        <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Proposta</CardTitle>
                <CardDescription>{selectedTheme.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedTheme.supportingTexts.map((supportingText, index) => (
                  <div key={supportingText} className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
                    <strong className="mb-1 block text-xs uppercase text-primary">Texto motivador {index + 1}</strong>
                    {supportingText}
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 pt-2">
                  {selectedTheme.tags.map((tag) => <Badge key={tag} variant="secondary">#{tag}</Badge>)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><SpellCheck2 className="h-5 w-5 text-primary" />Revisão assistida</CardTitle>
                <CardDescription>Alertas automáticos ajudam na revisão, mas não substituem o corretor.</CardDescription>
              </CardHeader>
              <CardContent>
                {suggestions.length ? (
                  <ul className="space-y-3">
                    {suggestions.map((suggestion) => (
                      <li key={suggestion} className="flex gap-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />{suggestion}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />Nenhum alerta básico encontrado.</p>
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Sua redação</CardTitle>
                  <CardDescription>{words} palavras · {text.length} caracteres {lastSaved ? `· salvo ${formatDate(lastSaved, true)}` : ""}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} className="gap-2">
                  <History className="h-4 w-4" />Histórico
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Digite sua redação aqui..."
                className="min-h-[480px] resize-y leading-7"
                aria-label="Texto da redação"
              />
              <div className="rounded-xl border border-dashed p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">Enviar redação manuscrita</p>
                    <p className="text-xs text-muted-foreground">JPG ou PNG de até 12 MB; a imagem é comprimida antes de salvar.</p>
                  </div>
                  <Label htmlFor="essay-image" className="inline-flex cursor-pointer items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                    Escolher foto
                  </Label>
                  <Input id="essay-image" type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => uploadImage(event.target.files?.[0])} />
                </div>
                {imageDataUrl && (
                  <div className="relative mt-4 overflow-hidden rounded-lg border">
                    <img src={imageDataUrl} alt="Foto da redação enviada" className="max-h-96 w-full object-contain" />
                    <Button size="icon" variant="destructive" className="absolute right-2 top-2" onClick={() => setImageDataUrl("")} aria-label="Remover foto"><X className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
              {existing?.status === "corrigida" && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold">Correção recebida</p>
                    <Badge>{existing.totalScore || 0} pontos</Badge>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{existing.teacherComments}</p>
                </div>
              )}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => saveEssay(false)} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" />Salvar nova versão
                </Button>
                <Button onClick={() => saveEssay(true)} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar para correção
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Histórico de versões</DialogTitle>
              <DialogDescription>Restaure o texto de qualquer versão salva.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {versions.data.length ? versions.data.map((version: any) => (
                <div key={version.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">Versão {version.version}</p>
                    <span className="text-xs text-muted-foreground">{formatDate(version.createdAt, true)}</span>
                  </div>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{version.text || "Versão enviada por foto"}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => { setText(version.text || ""); setImageDataUrl(version.imageDataUrl || ""); setHistoryOpen(false); }}>Restaurar no editor</Button>
                </div>
              )) : <EmptyState title="Nenhuma versão salva" description="Use “Salvar nova versão” para criar seu histórico." />}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Redação"
        title="Temas, produção e correção"
        description="Escreva ou fotografe sua redação, acompanhe versões, receba nota por competência e comentários do corretor."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Produções" value={essays.data.length} icon={FilePenLine} />
        <StatCard label="Em correção" value={essays.data.filter((essay) => essay.status === "enviada" || essay.status === "em-correcao").length} icon={Clock3} tone="warning" />
        <StatCard label="Corrigidas" value={corrected.length} icon={CheckCircle2} tone="success" />
        <StatCard label="Média" value={average || "—"} helper="escala ENEM" icon={Medal} />
      </div>
      <Tabs defaultValue="temas">
        <TabsList>
          <TabsTrigger value="temas">Temas atuais</TabsTrigger>
          <TabsTrigger value="historico">Minhas redações</TabsTrigger>
          <TabsTrigger value="exemplares">Repertório e exemplares</TabsTrigger>
        </TabsList>
        <TabsContent value="temas" className="mt-5">
          <div className="grid gap-5 lg:grid-cols-2">
            {themes.map((theme) => (
              <Card key={theme.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="rounded-xl bg-primary/10 p-3 text-primary"><Sparkles className="h-5 w-5" /></div>
                    {theme.deadline && <Badge variant="secondary">até {formatDate(theme.deadline)}</Badge>}
                  </div>
                  <CardTitle className="pt-2">{theme.title}</CardTitle>
                  <CardDescription className="leading-relaxed">{theme.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex flex-wrap gap-2">{theme.tags.map((tag) => <Badge key={tag} variant="outline">#{tag}</Badge>)}</div>
                  <Button onClick={() => openTheme(theme)} className="w-full gap-2"><FilePenLine className="h-4 w-4" />Abrir página de redação</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="historico" className="mt-5">
          {essays.data.length ? (
            <div className="space-y-3">
              {[...essays.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((essay) => (
                <Card key={essay.id}>
                  <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                    <div className="rounded-xl bg-muted p-3"><FilePenLine className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{essay.themeTitle}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Versão {essay.version} · atualizado {formatDate(essay.updatedAt, true)}</p>
                    </div>
                    <StatusBadge status={essay.status} />
                    {essay.totalScore !== undefined && <Badge variant="outline">{essay.totalScore} pts</Badge>}
                    <Button variant="outline" onClick={() => {
                      const theme = themes.find((item) => item.id === essay.themeId);
                      if (theme) openTheme(theme);
                    }}>Abrir</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : <EmptyState title="Você ainda não escreveu uma redação" description="Escolha um tema atual para abrir sua primeira página de produção." icon={FilePenLine} />}
        </TabsContent>
        <TabsContent value="exemplares" className="mt-5">
          <div className="grid gap-5 lg:grid-cols-3">
            {[
              ["Estrutura da nota 1000", "Aprenda a montar tese, projeto de texto, desenvolvimento e intervenção completa."],
              ["Repertório sociocultural", "Organize autores, fatos, obras e conceitos por eixo temático, sempre com uso produtivo."],
              ["Banco de redações exemplares", "Compare estratégias argumentativas e critérios das cinco competências do ENEM."],
            ].map(([title, description], index) => (
              <Card key={title}>
                <CardHeader><div className="mb-2 rounded-xl bg-primary/10 p-3 text-primary w-fit">{index === 0 ? <ListChecks className="h-5 w-5" /> : index === 1 ? <BrainCircuit className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}</div><CardTitle>{title}</CardTitle><CardDescription className="leading-relaxed">{description}</CardDescription></CardHeader>
                <CardContent><a href="https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/outros-documentos" target="_blank" rel="noreferrer"><Button variant="outline" className="w-full">Abrir material oficial</Button></a></CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
