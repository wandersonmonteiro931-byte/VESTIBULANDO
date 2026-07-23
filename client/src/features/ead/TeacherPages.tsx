import { useMemo, useState } from "react";
import { where } from "firebase/firestore";
import {
  BarChart3,
  BookOpen,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FilePenLine,
  HelpCircle,
  Library,
  ListPlus,
  Loader2,
  MessageCircleQuestion,
  Plus,
  Radio,
  Save,
  Search,
  Send,
  Sparkles,
  Target,
  Users,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_QUESTIONS, EAD_DISCIPLINES } from "./catalog";
import {
  createEadRecord,
  eadNow,
  updateEadRecord,
  useEadCollection,
} from "./store";
import type {
  EadEssay,
  EadEssayTheme,
  EadExam,
  EadExamAttempt,
  EadLesson,
  EadLiveClass,
  EadQuestion,
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
    ? { uid: userData.uid, nome: userData.nome || "Usuário", tipo: userData.tipo || "professor" }
    : null;
}

const initialLesson = {
  title: "",
  discipline: "Matemática",
  subject: "",
  module: "",
  trail: "",
  level: "intermediario",
  type: "video",
  durationMinutes: 40,
  description: "",
  videoUrl: "",
  materialUrl: "",
  audioUrl: "",
  captionsUrl: "",
  editalReference: "",
};

const initialQuestion = {
  statement: "",
  discipline: "Matemática",
  subject: "",
  year: new Date().getFullYear(),
  board: "Modelo ENEM",
  difficulty: "media",
  alternatives: ["", "", "", "", ""],
  correctIndex: 0,
  explanation: "",
  explanationVideoUrl: "",
};

export function TeacherStudioPage() {
  const { userData } = useAuth() as any;
  const { toast } = useToast();
  const uid = userData?.uid || "";
  const actor = actorFromUser(userData);
  const [saving, setSaving] = useState(false);
  const [lesson, setLesson] = useState(initialLesson);
  const [question, setQuestion] = useState(initialQuestion);
  const [exam, setExam] = useState({
    title: "",
    description: "",
    type: "completo",
    discipline: "",
    durationMinutes: 90,
    questionIds: [] as string[],
    rankingEnabled: false,
  });
  const [theme, setTheme] = useState({
    title: "",
    description: "",
    supportingTexts: ["", "", ""],
    tags: "",
    deadline: "",
    exampleUrl: "",
  });
  const [liveClass, setLiveClass] = useState({
    title: "",
    discipline: "Matemática",
    scheduledAt: "",
    durationMinutes: 60,
    roomUrl: "",
    recordingUrl: "",
    materialUrl: "",
    description: "",
    reminderMinutes: 15,
  });
  const [officeHour, setOfficeHour] = useState({
    title: "",
    discipline: "Matemática",
    scheduledAt: "",
    durationMinutes: 45,
    roomUrl: "",
    description: "",
  });

  const lessons = useEadCollection<EadLesson>("eadLessons", {
    constraints: uid ? [where("createdBy", "==", uid)] : [],
    enabled: !!uid,
  });
  const remoteQuestions = useEadCollection<EadQuestion>("eadQuestions", {});
  const exams = useEadCollection<EadExam>("eadExams", {
    constraints: uid ? [where("createdBy", "==", uid)] : [],
    enabled: !!uid,
  });
  const themes = useEadCollection<EadEssayTheme>("eadEssayThemes", {
    constraints: uid ? [where("createdBy", "==", uid)] : [],
    enabled: !!uid,
  });
  const liveClasses = useEadCollection<EadLiveClass>("eadLiveClasses", {
    constraints: uid ? [where("teacherId", "==", uid)] : [],
    enabled: !!uid,
  });
  const questionBank = useMemo(() => {
    const map = new Map(DEFAULT_QUESTIONS.map((item) => [item.id, item]));
    remoteQuestions.data.forEach((item) => map.set(item.id, item));
    return Array.from(map.values());
  }, [remoteQuestions.data]);

  const runSave = async (operation: () => Promise<unknown>, success: string) => {
    setSaving(true);
    try {
      await operation();
      toast({ title: success, description: "O conteúdo já está publicado para os alunos." });
    } catch (error: any) {
      toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveLesson = () => {
    if (!lesson.title.trim() || !lesson.subject.trim() || !lesson.description.trim()) {
      toast({ title: "Preencha título, assunto e descrição", variant: "destructive" });
      return;
    }
    return runSave(async () => {
      await createEadRecord(
        "eadLessons",
        {
          ...lesson,
          title: lesson.title.trim(),
          subject: lesson.subject.trim(),
          module: lesson.module.trim() || "Módulo geral",
          trail: lesson.trail.trim() || "Trilha principal",
          teacherName: userData?.nome || "Professor",
          published: true,
          createdBy: uid,
          createdAt: eadNow(),
        },
        actor,
        lesson.title,
      );
      setLesson(initialLesson);
    }, "Aula publicada");
  };

  const saveQuestion = () => {
    if (
      !question.statement.trim() ||
      !question.subject.trim() ||
      question.alternatives.some((alternative) => !alternative.trim()) ||
      !question.explanation.trim()
    ) {
      toast({ title: "Complete enunciado, assunto, alternativas e resolução", variant: "destructive" });
      return;
    }
    return runSave(async () => {
      await createEadRecord(
        "eadQuestions",
        {
          ...question,
          alternatives: question.alternatives.map((alternative) => alternative.trim()),
          statement: question.statement.trim(),
          explanation: question.explanation.trim(),
          published: true,
          createdBy: uid,
          createdAt: eadNow(),
        },
        actor,
        question.statement.slice(0, 80),
      );
      setQuestion(initialQuestion);
    }, "Questão adicionada ao banco");
  };

  const saveExam = () => {
    if (!exam.title.trim() || exam.questionIds.length === 0) {
      toast({ title: "Informe o título e selecione pelo menos uma questão", variant: "destructive" });
      return;
    }
    return runSave(async () => {
      await createEadRecord(
        "eadExams",
        {
          ...exam,
          title: exam.title.trim(),
          description: exam.description.trim(),
          discipline: exam.discipline || undefined,
          questionCount: exam.questionIds.length,
          published: true,
          createdBy: uid,
          createdAt: eadNow(),
        },
        actor,
        exam.title,
      );
      setExam({ title: "", description: "", type: "completo", discipline: "", durationMinutes: 90, questionIds: [], rankingEnabled: false });
    }, "Simulado publicado");
  };

  const saveTheme = () => {
    if (!theme.title.trim() || !theme.description.trim() || theme.supportingTexts.some((text) => !text.trim())) {
      toast({ title: "Complete a proposta e os três textos motivadores", variant: "destructive" });
      return;
    }
    return runSave(async () => {
      await createEadRecord(
        "eadEssayThemes",
        {
          ...theme,
          supportingTexts: theme.supportingTexts.map((text) => text.trim()),
          tags: theme.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          deadline: theme.deadline || undefined,
          exampleUrl: theme.exampleUrl || undefined,
          published: true,
          createdBy: uid,
          createdAt: eadNow(),
        },
        actor,
        theme.title,
      );
      setTheme({ title: "", description: "", supportingTexts: ["", "", ""], tags: "", deadline: "", exampleUrl: "" });
    }, "Tema de redação publicado");
  };

  const saveLiveClass = () => {
    if (!liveClass.title.trim() || !liveClass.scheduledAt) {
      toast({ title: "Informe o título e a data da transmissão", variant: "destructive" });
      return;
    }
    return runSave(async () => {
      await createEadRecord(
        "eadLiveClasses",
        {
          ...liveClass,
          teacherId: uid,
          teacherName: userData?.nome || "Professor",
          scheduledAt: new Date(liveClass.scheduledAt).toISOString(),
          status: "agendada",
          published: true,
          createdAt: eadNow(),
        },
        actor,
        liveClass.title,
      );
      setLiveClass({ title: "", discipline: "Matemática", scheduledAt: "", durationMinutes: 60, roomUrl: "", recordingUrl: "", materialUrl: "", description: "", reminderMinutes: 15 });
    }, "Aula ao vivo agendada");
  };

  const saveOfficeHour = () => {
    if (!officeHour.title.trim() || !officeHour.scheduledAt) {
      toast({ title: "Informe o título e a data do plantão", variant: "destructive" });
      return;
    }
    return runSave(async () => {
      await createEadRecord(
        "eadOfficeHours",
        {
          ...officeHour,
          teacherId: uid,
          teacherName: userData?.nome || "Professor",
          scheduledAt: new Date(officeHour.scheduledAt).toISOString(),
          active: true,
          createdAt: eadNow(),
        },
        actor,
        officeHour.title,
      );
      setOfficeHour({ title: "", discipline: "Matemática", scheduledAt: "", durationMinutes: 45, roomUrl: "", description: "" });
    }, "Plantão publicado");
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Professores"
        title="Estúdio de conteúdos e avaliações"
        description="Cadastre aulas, materiais, questões, simulados, temas de redação, transmissões e plantões em páginas organizadas."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Aulas" value={lessons.data.length} icon={BookOpen} />
        <StatCard label="Questões" value={remoteQuestions.data.filter((item) => item.createdBy === uid).length} icon={ClipboardCheck} />
        <StatCard label="Simulados" value={exams.data.length} icon={Target} />
        <StatCard label="Temas" value={themes.data.length} icon={FilePenLine} />
        <StatCard label="Ao vivo" value={liveClasses.data.length} icon={Radio} />
      </div>

      <Tabs defaultValue="aula">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="aula">Nova aula</TabsTrigger>
          <TabsTrigger value="questao">Nova questão</TabsTrigger>
          <TabsTrigger value="simulado">Novo simulado</TabsTrigger>
          <TabsTrigger value="redacao">Tema de redação</TabsTrigger>
          <TabsTrigger value="aovivo">Aula ao vivo</TabsTrigger>
          <TabsTrigger value="plantao">Plantão</TabsTrigger>
        </TabsList>

        <TabsContent value="aula" className="mt-5">
          <Card>
            <CardHeader><CardTitle>Cadastrar aula e materiais</CardTitle><CardDescription>Use links públicos para vídeo, PDF, slides e áudio. Nenhum Firebase Storage pago é necessário.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Título" htmlFor="lesson-title" required><Input id="lesson-title" value={lesson.title} onChange={(event) => setLesson((current) => ({ ...current, title: event.target.value }))} /></Field>
              <Field label="Disciplina" htmlFor="lesson-discipline"><Select value={lesson.discipline} onValueChange={(value) => setLesson((current) => ({ ...current, discipline: value }))}><SelectTrigger id="lesson-discipline"><SelectValue /></SelectTrigger><SelectContent>{EAD_DISCIPLINES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Assunto" htmlFor="lesson-subject" required><Input id="lesson-subject" value={lesson.subject} onChange={(event) => setLesson((current) => ({ ...current, subject: event.target.value }))} /></Field>
              <Field label="Módulo" htmlFor="lesson-module"><Input id="lesson-module" value={lesson.module} onChange={(event) => setLesson((current) => ({ ...current, module: event.target.value }))} /></Field>
              <Field label="Trilha" htmlFor="lesson-trail"><Input id="lesson-trail" value={lesson.trail} onChange={(event) => setLesson((current) => ({ ...current, trail: event.target.value }))} /></Field>
              <Field label="Formato" htmlFor="lesson-type"><Select value={lesson.type} onValueChange={(value) => setLesson((current) => ({ ...current, type: value }))}><SelectTrigger id="lesson-type"><SelectValue /></SelectTrigger><SelectContent>{["video", "ao-vivo", "pdf", "resumo", "mapa-mental", "slides", "audio"].map((item) => <SelectItem key={item} value={item}>{item.replace("-", " ")}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Nível" htmlFor="lesson-level"><Select value={lesson.level} onValueChange={(value) => setLesson((current) => ({ ...current, level: value }))}><SelectTrigger id="lesson-level"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="iniciante">Iniciante</SelectItem><SelectItem value="intermediario">Intermediário</SelectItem><SelectItem value="avancado">Avançado</SelectItem></SelectContent></Select></Field>
              <Field label="Duração (min)" htmlFor="lesson-duration"><Input id="lesson-duration" type="number" min={1} value={lesson.durationMinutes} onChange={(event) => setLesson((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} /></Field>
              <div className="md:col-span-2"><Field label="Descrição" htmlFor="lesson-description" required><Textarea id="lesson-description" value={lesson.description} onChange={(event) => setLesson((current) => ({ ...current, description: event.target.value }))} /></Field></div>
              <Field label="URL da videoaula" htmlFor="lesson-video"><Input id="lesson-video" type="url" value={lesson.videoUrl} onChange={(event) => setLesson((current) => ({ ...current, videoUrl: event.target.value }))} placeholder="https://..." /></Field>
              <Field label="URL do PDF/slides" htmlFor="lesson-material"><Input id="lesson-material" type="url" value={lesson.materialUrl} onChange={(event) => setLesson((current) => ({ ...current, materialUrl: event.target.value }))} placeholder="https://..." /></Field>
              <Field label="URL do áudio/podcast" htmlFor="lesson-audio"><Input id="lesson-audio" type="url" value={lesson.audioUrl} onChange={(event) => setLesson((current) => ({ ...current, audioUrl: event.target.value }))} /></Field>
              <Field label="URL da legenda" htmlFor="lesson-caption"><Input id="lesson-caption" type="url" value={lesson.captionsUrl} onChange={(event) => setLesson((current) => ({ ...current, captionsUrl: event.target.value }))} /></Field>
              <div className="md:col-span-2"><Field label="Referência do edital" htmlFor="lesson-edital"><Input id="lesson-edital" value={lesson.editalReference} onChange={(event) => setLesson((current) => ({ ...current, editalReference: event.target.value }))} /></Field></div>
              <div className="md:col-span-2 flex justify-end"><Button onClick={saveLesson} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Publicar aula</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questao" className="mt-5">
          <Card>
            <CardHeader><CardTitle>Criar questão comentada</CardTitle><CardDescription>Informe a resposta correta e uma resolução que será exibida após a tentativa.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <Field label="Enunciado" htmlFor="question-statement" required><Textarea id="question-statement" value={question.statement} onChange={(event) => setQuestion((current) => ({ ...current, statement: event.target.value }))} className="min-h-32" /></Field>
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="Disciplina" htmlFor="question-discipline"><Select value={question.discipline} onValueChange={(value) => setQuestion((current) => ({ ...current, discipline: value }))}><SelectTrigger id="question-discipline"><SelectValue /></SelectTrigger><SelectContent>{EAD_DISCIPLINES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Assunto" htmlFor="question-subject" required><Input id="question-subject" value={question.subject} onChange={(event) => setQuestion((current) => ({ ...current, subject: event.target.value }))} /></Field>
                <Field label="Ano / banca" htmlFor="question-year"><div className="flex gap-2"><Input id="question-year" type="number" value={question.year} onChange={(event) => setQuestion((current) => ({ ...current, year: Number(event.target.value) }))} /><Input aria-label="Banca" value={question.board} onChange={(event) => setQuestion((current) => ({ ...current, board: event.target.value }))} /></div></Field>
                <Field label="Dificuldade" htmlFor="question-difficulty"><Select value={question.difficulty} onValueChange={(value) => setQuestion((current) => ({ ...current, difficulty: value }))}><SelectTrigger id="question-difficulty"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="facil">Fácil</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="dificil">Difícil</SelectItem></SelectContent></Select></Field>
              </div>
              <div className="space-y-3">
                <Label>Alternativas (selecione a correta)</Label>
                {question.alternatives.map((alternative, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Checkbox checked={question.correctIndex === index} onCheckedChange={() => setQuestion((current) => ({ ...current, correctIndex: index }))} aria-label={`Marcar alternativa ${index + 1} como correta`} />
                    <Badge variant="outline">{String.fromCharCode(65 + index)}</Badge>
                    <Input value={alternative} onChange={(event) => setQuestion((current) => ({ ...current, alternatives: current.alternatives.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} />
                  </div>
                ))}
              </div>
              <Field label="Resolução comentada" htmlFor="question-explanation" required><Textarea id="question-explanation" value={question.explanation} onChange={(event) => setQuestion((current) => ({ ...current, explanation: event.target.value }))} /></Field>
              <Field label="Vídeo da resolução (opcional)" htmlFor="question-video"><Input id="question-video" type="url" value={question.explanationVideoUrl} onChange={(event) => setQuestion((current) => ({ ...current, explanationVideoUrl: event.target.value }))} placeholder="https://..." /></Field>
              <div className="flex justify-end"><Button onClick={saveQuestion} disabled={saving}><Plus className="mr-2 h-4 w-4" />Adicionar ao banco</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulado" className="mt-5">
          <Card>
            <CardHeader><CardTitle>Elaborar simulado</CardTitle><CardDescription>Selecione questões publicadas e defina tempo e formato da prova.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Título" htmlFor="exam-title" required><Input id="exam-title" value={exam.title} onChange={(event) => setExam((current) => ({ ...current, title: event.target.value }))} /></Field>
                <Field label="Formato" htmlFor="exam-type"><Select value={exam.type} onValueChange={(value) => setExam((current) => ({ ...current, type: value }))}><SelectTrigger id="exam-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="completo">Completo</SelectItem><SelectItem value="disciplina">Por disciplina</SelectItem><SelectItem value="enem-dia-1">ENEM — Dia 1</SelectItem><SelectItem value="enem-dia-2">ENEM — Dia 2</SelectItem></SelectContent></Select></Field>
                <Field label="Duração (min)" htmlFor="exam-duration"><Input id="exam-duration" type="number" min={1} value={exam.durationMinutes} onChange={(event) => setExam((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} /></Field>
                <div className="flex items-end pb-2"><Label className="flex items-center gap-3"><Checkbox checked={exam.rankingEnabled} onCheckedChange={(checked) => setExam((current) => ({ ...current, rankingEnabled: checked === true }))} />Permitir ranking opcional</Label></div>
              </div>
              <Field label="Descrição" htmlFor="exam-description"><Textarea id="exam-description" value={exam.description} onChange={(event) => setExam((current) => ({ ...current, description: event.target.value }))} /></Field>
              <div>
                <div className="mb-3 flex items-center justify-between"><Label>Questões selecionadas</Label><Badge>{exam.questionIds.length} escolhidas</Badge></div>
                <div className="max-h-96 space-y-2 overflow-y-auto rounded-xl border p-3">
                  {questionBank.map((item) => (
                    <Label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal hover:bg-muted/30">
                      <Checkbox checked={exam.questionIds.includes(item.id)} onCheckedChange={(checked) => setExam((current) => ({ ...current, questionIds: checked ? [...current.questionIds, item.id] : current.questionIds.filter((id) => id !== item.id) }))} />
                      <div><p className="line-clamp-2 text-sm font-medium">{item.statement}</p><p className="mt-1 text-xs text-muted-foreground">{item.discipline} · {item.subject} · {item.difficulty}</p></div>
                    </Label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end"><Button onClick={saveExam} disabled={saving}><Target className="mr-2 h-4 w-4" />Publicar simulado</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redacao" className="mt-5">
          <Card>
            <CardHeader><CardTitle>Publicar proposta de redação</CardTitle><CardDescription>Cadastre tema, comando, textos motivadores, prazo e material exemplar.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Tema" htmlFor="theme-title" required><Input id="theme-title" value={theme.title} onChange={(event) => setTheme((current) => ({ ...current, title: event.target.value }))} /></Field>
              <Field label="Comando da proposta" htmlFor="theme-description" required><Textarea id="theme-description" value={theme.description} onChange={(event) => setTheme((current) => ({ ...current, description: event.target.value }))} /></Field>
              {theme.supportingTexts.map((text, index) => <Field key={index} label={`Texto motivador ${index + 1}`} htmlFor={`theme-support-${index}`} required><Textarea id={`theme-support-${index}`} value={text} onChange={(event) => setTheme((current) => ({ ...current, supportingTexts: current.supportingTexts.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} /></Field>)}
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Tags (separadas por vírgula)" htmlFor="theme-tags"><Input id="theme-tags" value={theme.tags} onChange={(event) => setTheme((current) => ({ ...current, tags: event.target.value }))} /></Field>
                <Field label="Prazo" htmlFor="theme-deadline"><Input id="theme-deadline" type="date" value={theme.deadline} onChange={(event) => setTheme((current) => ({ ...current, deadline: event.target.value }))} /></Field>
                <Field label="Redação exemplar (URL)" htmlFor="theme-example"><Input id="theme-example" type="url" value={theme.exampleUrl} onChange={(event) => setTheme((current) => ({ ...current, exampleUrl: event.target.value }))} /></Field>
              </div>
              <div className="flex justify-end"><Button onClick={saveTheme} disabled={saving}><FilePenLine className="mr-2 h-4 w-4" />Publicar proposta</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aovivo" className="mt-5">
          <Card>
            <CardHeader><CardTitle>Agendar transmissão</CardTitle><CardDescription>Defina sala, material, lembrete e, depois da aula, adicione a gravação.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Título" htmlFor="live-title" required><Input id="live-title" value={liveClass.title} onChange={(event) => setLiveClass((current) => ({ ...current, title: event.target.value }))} /></Field>
              <Field label="Disciplina" htmlFor="live-discipline"><Select value={liveClass.discipline} onValueChange={(value) => setLiveClass((current) => ({ ...current, discipline: value }))}><SelectTrigger id="live-discipline"><SelectValue /></SelectTrigger><SelectContent>{EAD_DISCIPLINES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Data e hora" htmlFor="live-date" required><Input id="live-date" type="datetime-local" value={liveClass.scheduledAt} onChange={(event) => setLiveClass((current) => ({ ...current, scheduledAt: event.target.value }))} /></Field>
              <Field label="Duração (min)" htmlFor="live-duration"><Input id="live-duration" type="number" value={liveClass.durationMinutes} onChange={(event) => setLiveClass((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} /></Field>
              <Field label="URL da sala (opcional)" htmlFor="live-room"><Input id="live-room" type="url" value={liveClass.roomUrl} onChange={(event) => setLiveClass((current) => ({ ...current, roomUrl: event.target.value }))} /></Field>
              <Field label="URL do material" htmlFor="live-material"><Input id="live-material" type="url" value={liveClass.materialUrl} onChange={(event) => setLiveClass((current) => ({ ...current, materialUrl: event.target.value }))} /></Field>
              <Field label="Avisar antes (min)" htmlFor="live-reminder"><Input id="live-reminder" type="number" value={liveClass.reminderMinutes} onChange={(event) => setLiveClass((current) => ({ ...current, reminderMinutes: Number(event.target.value) }))} /></Field>
              <Field label="Gravação (pode preencher depois)" htmlFor="live-recording"><Input id="live-recording" type="url" value={liveClass.recordingUrl} onChange={(event) => setLiveClass((current) => ({ ...current, recordingUrl: event.target.value }))} /></Field>
              <div className="md:col-span-2"><Field label="Descrição" htmlFor="live-description"><Textarea id="live-description" value={liveClass.description} onChange={(event) => setLiveClass((current) => ({ ...current, description: event.target.value }))} /></Field></div>
              <div className="md:col-span-2 flex justify-end"><Button onClick={saveLiveClass} disabled={saving}><CalendarPlus className="mr-2 h-4 w-4" />Agendar aula</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plantao" className="mt-5">
          <Card>
            <CardHeader><CardTitle>Agendar plantão de dúvidas</CardTitle><CardDescription>O plantão aparecerá na comunidade e poderá usar sala externa ou o chat atual.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Título" htmlFor="office-title" required><Input id="office-title" value={officeHour.title} onChange={(event) => setOfficeHour((current) => ({ ...current, title: event.target.value }))} /></Field>
              <Field label="Disciplina" htmlFor="office-discipline"><Select value={officeHour.discipline} onValueChange={(value) => setOfficeHour((current) => ({ ...current, discipline: value }))}><SelectTrigger id="office-discipline"><SelectValue /></SelectTrigger><SelectContent>{EAD_DISCIPLINES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Data e hora" htmlFor="office-date" required><Input id="office-date" type="datetime-local" value={officeHour.scheduledAt} onChange={(event) => setOfficeHour((current) => ({ ...current, scheduledAt: event.target.value }))} /></Field>
              <Field label="Duração (min)" htmlFor="office-duration"><Input id="office-duration" type="number" value={officeHour.durationMinutes} onChange={(event) => setOfficeHour((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} /></Field>
              <Field label="URL da sala (opcional)" htmlFor="office-room"><Input id="office-room" type="url" value={officeHour.roomUrl} onChange={(event) => setOfficeHour((current) => ({ ...current, roomUrl: event.target.value }))} /></Field>
              <Field label="Descrição" htmlFor="office-description"><Input id="office-description" value={officeHour.description} onChange={(event) => setOfficeHour((current) => ({ ...current, description: event.target.value }))} /></Field>
              <div className="md:col-span-2 flex justify-end"><Button onClick={saveOfficeHour} disabled={saving}><HelpCircle className="mr-2 h-4 w-4" />Publicar plantão</Button></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function EssayCorrectionsPage() {
  const { userData } = useAuth() as any;
  const { toast } = useToast();
  const actor = actorFromUser(userData);
  const [selected, setSelected] = useState<EadEssay | null>(null);
  const [search, setSearch] = useState("");
  const [scores, setScores] = useState([0, 0, 0, 0, 0]);
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);

  const essays = useEadCollection<EadEssay>("eadEssays", {
    sort: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  });
  const filtered = essays.data.filter((essay) => {
    const term = search.trim().toLowerCase();
    return !term || `${essay.ownerName} ${essay.themeTitle} ${essay.status}`.toLowerCase().includes(term);
  });
  const pending = essays.data.filter((essay) => essay.status === "enviada" || essay.status === "em-correcao");

  const openEssay = async (essay: EadEssay) => {
    setSelected(essay);
    setScores([
      essay.scores?.competencia1 || 0,
      essay.scores?.competencia2 || 0,
      essay.scores?.competencia3 || 0,
      essay.scores?.competencia4 || 0,
      essay.scores?.competencia5 || 0,
    ]);
    setComments(essay.teacherComments || "");
    if (essay.status === "enviada") {
      try { await updateEadRecord("eadEssays", essay.id, { status: "em-correcao" }, actor, essay.themeTitle); } catch { /* The editor still opens. */ }
    }
  };

  const saveCorrection = async () => {
    if (!selected || scores.some((score) => score < 0 || score > 200) || !comments.trim()) {
      toast({ title: "Informe notas de 0 a 200 e um comentário", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await updateEadRecord(
        "eadEssays",
        selected.id,
        {
          scores: {
            competencia1: scores[0],
            competencia2: scores[1],
            competencia3: scores[2],
            competencia4: scores[3],
            competencia5: scores[4],
          },
          totalScore: scores.reduce((sum, score) => sum + score, 0),
          teacherComments: comments.trim(),
          correctedBy: userData?.uid,
          correctedAt: eadNow(),
          status: "corrigida",
        },
        actor,
        selected.themeTitle,
      );
      toast({ title: "Correção enviada ao aluno" });
      setSelected(null);
    } catch (error: any) {
      toast({ title: "Erro ao salvar correção", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Redação" title="Fila de correções" description="Avalie as cinco competências, registre comentários e devolva a correção ao aluno." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Aguardando" value={pending.length} icon={Clock3} tone="warning" />
        <StatCard label="Corrigidas" value={essays.data.filter((essay) => essay.status === "corrigida").length} icon={CheckCircle2} tone="success" />
        <StatCard label="Total recebido" value={essays.data.length} icon={FilePenLine} />
      </div>
      <div className="relative max-w-xl"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar aluno ou tema..." className="pl-9" /></div>
      {filtered.length ? (
        <div className="space-y-3">
          {filtered.map((essay) => (
            <Card key={essay.id}><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className="rounded-xl bg-primary/10 p-3 text-primary"><FilePenLine className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-semibold">{essay.themeTitle}</p><p className="mt-1 text-sm text-muted-foreground">{essay.ownerName} · enviada {formatDate(essay.submittedAt || essay.updatedAt, true)}</p></div><StatusBadge status={essay.status} />{essay.totalScore !== undefined && <Badge variant="outline">{essay.totalScore} pts</Badge>}<Button variant={essay.status === "corrigida" ? "outline" : "default"} onClick={() => openEssay(essay)}>{essay.status === "corrigida" ? "Revisar correção" : "Corrigir"}</Button></CardContent></Card>
          ))}
        </div>
      ) : <EmptyState title="Nenhuma redação encontrada" description="As produções enviadas pelos alunos aparecerão nesta fila." icon={FilePenLine} />}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[94vh] max-w-6xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader><DialogTitle>{selected.themeTitle}</DialogTitle><DialogDescription>{selected.ownerName} · versão {selected.version} · {formatDate(selected.submittedAt || selected.updatedAt, true)}</DialogDescription></DialogHeader>
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  {selected.imageDataUrl && <img src={selected.imageDataUrl} alt="Redação manuscrita do aluno" className="max-h-[600px] w-full rounded-xl border object-contain" />}
                  {selected.text && <div className="min-h-80 whitespace-pre-wrap rounded-xl border bg-muted/20 p-6 text-sm leading-7">{selected.text}</div>}
                  {selected.grammarNotes?.length > 0 && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><p className="font-semibold">Alertas automáticos para conferir</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{selected.grammarNotes.map((note) => <li key={note}>{note}</li>)}</ul></div>}
                </div>
                <div className="space-y-5">
                  <Card>
                    <CardHeader><CardTitle className="text-lg">Notas por competência</CardTitle><CardDescription>Cada competência vale de 0 a 200 pontos.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                      {[
                        "Domínio da norma-padrão",
                        "Compreensão da proposta",
                        "Argumentação e projeto de texto",
                        "Coesão e mecanismos linguísticos",
                        "Proposta de intervenção",
                      ].map((label, index) => (
                        <div key={label}>
                          <div className="mb-2 flex items-center justify-between gap-3"><Label htmlFor={`score-${index}`}>C{index + 1} · {label}</Label><Badge variant="outline">{scores[index]}</Badge></div>
                          <Input id={`score-${index}`} type="number" min={0} max={200} step={20} value={scores[index]} onChange={(event) => setScores((current) => current.map((score, scoreIndex) => scoreIndex === index ? Math.max(0, Math.min(200, Number(event.target.value))) : score))} />
                        </div>
                      ))}
                      <div className="rounded-lg bg-primary p-4 text-primary-foreground"><p className="text-xs uppercase">Nota total</p><p className="text-3xl font-bold">{scores.reduce((sum, score) => sum + score, 0)}</p></div>
                    </CardContent>
                  </Card>
                  <Field label="Comentários do corretor" htmlFor="correction-comments" required><Textarea id="correction-comments" value={comments} onChange={(event) => setComments(event.target.value)} className="min-h-44" placeholder="Explique os pontos positivos e o que precisa ser aprimorado..." /></Field>
                  <Button className="w-full" onClick={saveCorrection} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Enviar correção ao aluno</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function TeacherClassAnalyticsPage() {
  const attempts = useEadCollection<EadExamAttempt>("eadExamAttempts", {
    filter: (attempt) => attempt.status === "concluido",
  });
  const attendance = useEadCollection<any>("eadAttendance", {});
  const lessons = useEadCollection<any>("eadLessonProgress", {});
  const questions = useEadCollection<any>("eadQuestionAttempts", {});
  const users = useEadCollection<any>("usuarios", {
    filter: (user) => user.tipo === "aluno",
  });

  const rows = users.data.map((user) => {
    const userExams = attempts.data.filter((attempt) => attempt.ownerId === user.id || attempt.ownerId === user.uid);
    const userAttendance = attendance.data.filter((item) => item.ownerId === user.id || item.ownerId === user.uid);
    const userLessons = lessons.data.filter((item) => item.ownerId === user.id || item.ownerId === user.uid);
    const userQuestions = questions.data.filter((item) => item.ownerId === user.id || item.ownerId === user.uid);
    return {
      id: user.id,
      name: user.nome,
      turma: user.turma || "Sem turma",
      exams: userExams.length,
      score: userExams.length ? Math.round(userExams.reduce((sum, item) => sum + item.score, 0) / userExams.length) : 0,
      attendance: userAttendance.length ? Math.round(userAttendance.filter((item) => item.present).length / userAttendance.length * 100) : 100,
      lessons: userLessons.filter((item) => item.completed).length,
      accuracy: userQuestions.length ? Math.round(userQuestions.filter((item) => item.correct).length / userQuestions.length * 100) : 0,
    };
  });
  const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0;
  const averageAttendance = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.attendance, 0) / rows.length) : 0;

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Acompanhamento da turma" title="Presença e desempenho" description="Veja a evolução dos alunos em aulas, questões e simulados e identifique quem precisa de acompanhamento." action={<Button variant="outline" onClick={() => window.print()}><BarChart3 className="mr-2 h-4 w-4" />Imprimir relatório</Button>} />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Alunos" value={rows.length} icon={Users} />
        <StatCard label="Média nos simulados" value={average} icon={Target} />
        <StatCard label="Frequência média" value={`${averageAttendance}%`} icon={CheckCircle2} tone="success" />
        <StatCard label="Com alerta" value={rows.filter((row) => row.score < 500 || row.attendance < 75).length} icon={MessageCircleQuestion} tone="warning" />
      </div>
      <Card>
        <CardHeader><CardTitle>Relatório por aluno</CardTitle><CardDescription>Indicadores agregados para acompanhamento pedagógico.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="p-3">Aluno</th><th className="p-3">Turma</th><th className="p-3">Aulas concluídas</th><th className="p-3">Questões</th><th className="p-3">Simulados</th><th className="p-3">Frequência</th><th className="p-3">Situação</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id} className="border-b"><td className="p-3 font-medium">{row.name}</td><td className="p-3">{row.turma}</td><td className="p-3">{row.lessons}</td><td className="p-3">{row.accuracy}%</td><td className="p-3">{row.score || "—"}</td><td className="p-3">{row.attendance}%</td><td className="p-3"><Badge variant={row.score && row.score < 500 || row.attendance < 75 ? "destructive" : "secondary"}>{row.score && row.score < 500 || row.attendance < 75 ? "acompanhar" : "regular"}</Badge></td></tr>)}</tbody>
          </table>
          {!rows.length && <EmptyState title="Nenhum aluno encontrado" description="Os alunos aprovados no sistema escolar aparecerão neste relatório." icon={Users} />}
        </CardContent>
      </Card>
    </div>
  );
}
