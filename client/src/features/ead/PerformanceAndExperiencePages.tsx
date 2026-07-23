import { useMemo, useState } from "react";
import { Link } from "wouter";
import { subDays } from "date-fns";
import { where } from "firebase/firestore";
import {
  Accessibility,
  AlertCircle,
  Award,
  BarChart3,
  BellRing,
  BookOpen,
  CheckCircle2,
  CircleGauge,
  Clock3,
  Contrast,
  Download,
  Eye,
  FileJson,
  FileText,
  Flame,
  Gauge,
  Headphones,
  HelpCircle,
  Keyboard,
  LifeBuoy,
  Loader2,
  Mail,
  MessageCircle,
  MonitorSmartphone,
  Moon,
  Printer,
  RefreshCcw,
  Save,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  TicketCheck,
  TrendingUp,
  Trophy,
  Type,
  WifiOff,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_FAQS, DEFAULT_QUESTIONS } from "./catalog";
import {
  createEadRecord,
  eadNow,
  useEadAccessibility,
  useEadCollection,
} from "./store";
import type {
  EadEssay,
  EadExamAttempt,
  EadLessonProgress,
  EadQuestionAttempt,
  EadStudyItem,
  EadSupportTicket,
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

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function PerformancePage() {
  const { userData } = useAuth() as any;
  const uid = userData?.uid || "";
  const lessonProgress = useEadCollection<EadLessonProgress>("eadLessonProgress", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
  });
  const questionAttempts = useEadCollection<EadQuestionAttempt>("eadQuestionAttempts", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
  });
  const examAttempts = useEadCollection<EadExamAttempt>("eadExamAttempts", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
    filter: (attempt) => attempt.status === "concluido",
  });
  const studyItems = useEadCollection<EadStudyItem>("eadStudyItems", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
  });
  const attendance = useEadCollection<any>("eadAttendance", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
  });
  const essays = useEadCollection<EadEssay>("eadEssays", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
  });

  const completedLessons = lessonProgress.data.filter((item) => item.completed);
  const completedTasks = studyItems.data.filter((item) => item.completed);
  const totalMinutes =
    lessonProgress.data.reduce((sum, item) => sum + Math.round((item.watchedSeconds || 0) / 60), 0) +
    completedTasks.reduce((sum, item) => sum + (item.durationMinutes || 0), 0);
  const correctQuestions = questionAttempts.data.filter((attempt) => attempt.correct).length;
  const accuracy = questionAttempts.data.length
    ? Math.round((correctQuestions / questionAttempts.data.length) * 100)
    : 0;
  const frequency = attendance.data.length
    ? Math.round((attendance.data.filter((item) => item.present).length / attendance.data.length) * 100)
    : 100;
  const taskCompletion = studyItems.data.length
    ? Math.round((completedTasks.length / studyItems.data.length) * 100)
    : 0;

  const disciplineStats = useMemo(() => {
    const stats = new Map<string, { discipline: string; correct: number; total: number; accuracy: number }>();
    questionAttempts.data.forEach((attempt) => {
      const current = stats.get(attempt.discipline) || {
        discipline: attempt.discipline,
        correct: 0,
        total: 0,
        accuracy: 0,
      };
      current.total += 1;
      if (attempt.correct) current.correct += 1;
      current.accuracy = Math.round((current.correct / current.total) * 100);
      stats.set(attempt.discipline, current);
    });
    return Array.from(stats.values()).sort((a, b) => b.accuracy - a.accuracy);
  }, [questionAttempts.data]);

  const subjectStats = useMemo(() => {
    const stats = new Map<string, { subject: string; discipline: string; correct: number; total: number; accuracy: number }>();
    questionAttempts.data.forEach((attempt) => {
      const key = `${attempt.discipline}:${attempt.subject}`;
      const current = stats.get(key) || {
        subject: attempt.subject,
        discipline: attempt.discipline,
        correct: 0,
        total: 0,
        accuracy: 0,
      };
      current.total += 1;
      if (attempt.correct) current.correct += 1;
      current.accuracy = Math.round((current.correct / current.total) * 100);
      stats.set(key, current);
    });
    return Array.from(stats.values()).sort((a, b) => a.accuracy - b.accuracy);
  }, [questionAttempts.data]);

  const weeklyEvolution = useMemo(() => {
    return Array.from({ length: 8 }, (_, index) => {
      const end = subDays(new Date(), (7 - index) * 7);
      const start = subDays(end, 6);
      const attempts = questionAttempts.data.filter((attempt) => {
        const date = new Date(attempt.attemptedAt);
        return date >= start && date <= end;
      });
      const tasks = completedTasks.filter((item) => {
        const date = new Date(item.completedAt || item.updatedAt);
        return date >= start && date <= end;
      });
      return {
        name: `S${index + 1}`,
        acertos: attempts.length
          ? Math.round((attempts.filter((item) => item.correct).length / attempts.length) * 100)
          : 0,
        estudo: Math.round(tasks.reduce((sum, item) => sum + item.durationMinutes, 0) / 60 * 10) / 10,
      };
    });
  }, [completedTasks, questionAttempts.data]);

  const examEvolution = [...examAttempts.data]
    .sort((a, b) => a.completedAt!.localeCompare(b.completedAt!))
    .map((attempt, index) => ({
      name: `Simulado ${index + 1}`,
      nota: attempt.score,
      tri: attempt.triEstimate,
    }));

  const activityDates = new Set<string>();
  lessonProgress.data.forEach((item) => activityDates.add(item.lastAccessedAt?.slice(0, 10)));
  questionAttempts.data.forEach((item) => activityDates.add(item.attemptedAt?.slice(0, 10)));
  completedTasks.forEach((item) => activityDates.add((item.completedAt || item.updatedAt)?.slice(0, 10)));
  let streak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const day = subDays(new Date(), offset).toISOString().slice(0, 10);
    if (activityDates.has(day)) streak += 1;
    else if (offset > 0) break;
  }

  const strongest = disciplineStats[0];
  const weakest = disciplineStats.at(-1);
  const report = {
    aluno: userData?.nome,
    geradoEm: eadNow(),
    percentualConcluido: taskCompletion,
    horasEstudadas: Math.round(totalMinutes / 6) / 10,
    frequencia: frequency,
    acertos: accuracy,
    sequenciaDias: streak,
    disciplinas: disciplineStats,
    assuntosPrioritarios: subjectStats.slice(0, 5),
    simulados: examAttempts.data,
    redacoes: essays.data.map((essay) => ({
      tema: essay.themeTitle,
      status: essay.status,
      nota: essay.totalScore,
    })),
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Desempenho"
        title="Sua evolução em detalhes"
        description="Acompanhe conclusão, horas, frequência, acertos, simulados, dificuldades, sequência e metas em um relatório único."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" />Imprimir</Button>
            <Button onClick={() => downloadJson("relatorio-desempenho.json", report)} className="gap-2"><Download className="h-4 w-4" />Baixar relatório</Button>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Concluído" value={`${taskCompletion}%`} icon={CheckCircle2} tone="success" />
        <StatCard label="Horas estudadas" value={(totalMinutes / 60).toFixed(1)} icon={Clock3} />
        <StatCard label="Acertos" value={`${accuracy}%`} icon={Target} />
        <StatCard label="Frequência" value={`${frequency}%`} icon={CircleGauge} tone="warning" />
        <StatCard label="Sequência" value={`${streak} dias`} icon={Flame} tone="danger" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Evolução semanal</CardTitle><CardDescription>Percentual de acertos e horas concluídas nas últimas oito semanas.</CardDescription></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyEvolution}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" domain={[0, 100]} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="acertos" name="Acertos (%)" stroke="hsl(var(--primary))" strokeWidth={3} />
                <Line yAxisId="right" type="monotone" dataKey="estudo" name="Horas" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Acertos por disciplina</CardTitle><CardDescription>Compare seu aproveitamento entre as áreas.</CardDescription></CardHeader>
          <CardContent className="h-80">
            {disciplineStats.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={disciplineStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis type="category" dataKey="discipline" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="accuracy" name="Acertos (%)" fill="hsl(var(--primary))" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title="Ainda não há questões respondidas" description="Pratique no banco de questões para formar este gráfico." icon={BarChart3} />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Comparação entre simulados</CardTitle><CardDescription>Nota objetiva e estimativa pedagógica semelhante à TRI.</CardDescription></CardHeader>
        <CardContent className="h-80">
          {examEvolution.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={examEvolution}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 1000]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="nota" stroke="#2563eb" strokeWidth={3} />
                <Line type="monotone" dataKey="tri" name="Estimativa TRI" stroke="#8b5cf6" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState title="Nenhum simulado concluído" description="Faça o diagnóstico inicial para receber seu primeiro relatório comparativo." icon={Trophy} action={<Link href="/ead/simulados"><Button>Fazer diagnóstico</Button></Link>} />}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader><CardTitle>Diagnóstico</CardTitle><CardDescription>Pontos fortes e foco recomendado.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Maior domínio</p>
              <p className="mt-1 text-lg font-bold">{strongest?.discipline || "Continue praticando"}</p>
              {strongest && <p className="text-sm text-muted-foreground">{strongest.accuracy}% de acertos</p>}
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Revisar primeiro</p>
              <p className="mt-1 text-lg font-bold">{weakest?.discipline || "Ainda sem diagnóstico"}</p>
              {weakest && <p className="text-sm text-muted-foreground">{weakest.accuracy}% de acertos</p>}
            </div>
            <Link href="/ead/plano"><Button className="w-full gap-2"><RefreshCcw className="h-4 w-4" />Replanejar revisão</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Assuntos com maior dificuldade</CardTitle><CardDescription>Prioridade calculada pelo percentual de acertos.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {subjectStats.slice(0, 6).map((subject) => (
              <div key={`${subject.discipline}-${subject.subject}`}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm"><span><strong>{subject.subject}</strong> <span className="text-muted-foreground">· {subject.discipline}</span></span><span>{subject.accuracy}%</span></div>
                <Progress value={subject.accuracy} />
              </div>
            ))}
            {!subjectStats.length && <EmptyState title="Sem dados por assunto" description="As recomendações aparecem conforme você resolve questões." icon={Sparkles} />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Relatório para responsável</CardTitle><CardDescription>Imprima ou baixe o resumo para compartilhar com o responsável cadastrado.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-semibold">{(userData as any)?.eadProfile?.responsavelNome || "Responsável ainda não informado"}</p><p className="text-sm text-muted-foreground">{(userData as any)?.eadProfile?.responsavelEmail || "Cadastre o e-mail em “Meu dia”."}</p></div>
          <div className="flex gap-2"><Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>{(userData as any)?.eadProfile?.responsavelEmail && <a href={`mailto:${encodeURIComponent((userData as any).eadProfile.responsavelEmail)}?subject=${encodeURIComponent("Relatório de desempenho — Vestibulando")}&body=${encodeURIComponent(`Olá! ${userData?.nome} concluiu ${taskCompletion}% do plano, estudou ${(totalMinutes / 60).toFixed(1)} horas e está com ${accuracy}% de acertos.`)}`}><Button><Mail className="mr-2 h-4 w-4" />Preparar e-mail</Button></a>}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AccessibilityPage() {
  const { preferences, setPreferences, resetPreferences } = useEadAccessibility();
  const { toast } = useToast();

  const save = () => {
    toast({
      title: "Preferências aplicadas",
      description: "As opções ficam salvas neste aparelho e já estão ativas no preparatório.",
    });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Experiência e acessibilidade"
        title="Ajuste a plataforma ao seu jeito"
        description="Use o preparatório no celular, tablet ou computador com fonte, contraste, movimento, legendas e consumo de dados configuráveis."
        action={<Button variant="outline" onClick={resetPreferences} className="gap-2"><RefreshCcw className="h-4 w-4" />Restaurar padrão</Button>}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><Type className="mb-2 h-6 w-6 text-primary" /><CardTitle>Tamanho do texto</CardTitle><CardDescription>Aumente ou reduza a escala de leitura do preparatório.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4"><span className="text-sm">A</span><Slider value={[preferences.fontScale]} min={0.9} max={1.35} step={0.05} onValueChange={([value]) => setPreferences({ fontScale: value })} aria-label="Escala da fonte" /><span className="text-xl">A</span></div>
            <p className="rounded-lg bg-muted p-3 text-center text-sm">Escala atual: {Math.round(preferences.fontScale * 100)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Contrast className="mb-2 h-6 w-6 text-primary" /><CardTitle>Visibilidade e movimento</CardTitle><CardDescription>Melhore contraste e reduza animações quando necessário.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4"><div><Label htmlFor="high-contrast">Alto contraste</Label><p className="text-xs text-muted-foreground">Reforça bordas, textos e foco.</p></div><Switch id="high-contrast" checked={preferences.highContrast} onCheckedChange={(checked) => setPreferences({ highContrast: checked })} /></div>
            <div className="flex items-center justify-between gap-4"><div><Label htmlFor="reduced-motion">Reduzir animações</Label><p className="text-xs text-muted-foreground">Evita transições e movimentos desnecessários.</p></div><Switch id="reduced-motion" checked={preferences.reducedMotion} onCheckedChange={(checked) => setPreferences({ reducedMotion: checked })} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><WifiOff className="mb-2 h-6 w-6 text-primary" /><CardTitle>Internet e uso posterior</CardTitle><CardDescription>Economize dados e guarde materiais compatíveis para estudar depois.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4"><div><Label htmlFor="low-data">Baixo consumo de internet</Label><p className="text-xs text-muted-foreground">Oculta imagens decorativas e evita pré-carregamentos.</p></div><Switch id="low-data" checked={preferences.lowData} onCheckedChange={(checked) => setPreferences({ lowData: checked })} /></div>
            <Link href="/ead/conteudos"><Button variant="outline" className="w-full"><Download className="mr-2 h-4 w-4" />Escolher aulas para ver depois</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Headphones className="mb-2 h-6 w-6 text-primary" /><CardTitle>Vídeo e áudio</CardTitle><CardDescription>Prefira conteúdos com legendas e ajuste a velocidade no próprio reprodutor.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4"><div><Label htmlFor="captions">Legendas por padrão</Label><p className="text-xs text-muted-foreground">Usa faixa de legenda quando o professor disponibilizar.</p></div><Switch id="captions" checked={preferences.captions} onCheckedChange={(checked) => setPreferences({ captions: checked })} /></div>
            <p className="rounded-lg border p-3 text-sm text-muted-foreground">A velocidade pode ser alterada em cada videoaula: 0,5×, 0,75×, 1×, 1,25×, 1,5× ou 2×.</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><Keyboard className="mb-2 h-6 w-6 text-primary" /><CardTitle>Navegação por teclado e leitor de tela</CardTitle><CardDescription>Todas as páginas possuem títulos, rótulos, foco visível e atalho para o conteúdo principal.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {[["Tab / Shift + Tab", "Avança ou retorna entre controles."], ["Enter / Espaço", "Ativa botões, links e seleções."], ["Ir para o conteúdo", "Aparece ao pressionar Tab no início da página."]].map(([key, description]) => <div key={key} className="rounded-xl border p-4"><kbd className="rounded bg-muted px-2 py-1 text-xs font-bold">{key}</kbd><p className="mt-3 text-sm text-muted-foreground">{description}</p></div>)}
        </CardContent>
      </Card>
      <div className="flex justify-end"><Button onClick={save} className="gap-2"><Save className="h-4 w-4" />Salvar preferências</Button></div>
    </div>
  );
}

export function SupportPage() {
  const { userData } = useAuth() as any;
  const { toast } = useToast();
  const uid = userData?.uid || "";
  const actor = actorFromUser(userData);
  const [form, setForm] = useState({
    category: "tecnico" as EadSupportTicket["category"],
    priority: "media" as EadSupportTicket["priority"],
    subject: "",
    message: "",
  });
  const [saving, setSaving] = useState(false);
  const tickets = useEadCollection<EadSupportTicket>("eadSupportTickets", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
    sort: (a, b) => b.createdAt.localeCompare(a.createdAt),
  });

  const submitTicket = async () => {
    if (!uid || !form.subject.trim() || !form.message.trim()) return;
    setSaving(true);
    try {
      await createEadRecord(
        "eadSupportTickets",
        {
          ownerId: uid,
          ownerName: userData?.nome || "Usuário",
          ownerEmail: userData?.email || "",
          category: form.category,
          subject: form.subject.trim(),
          message: form.message.trim(),
          priority: form.priority,
          status: "aberto",
          createdAt: eadNow(),
          updatedAt: eadNow(),
        },
        actor,
        form.subject,
      );
      setForm({ category: "tecnico", priority: "media", subject: "", message: "" });
      toast({ title: "Solicitação registrada", description: "Acompanhe a resposta na aba “Meus atendimentos”." });
    } catch (error: any) {
      toast({ title: "Erro ao abrir atendimento", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const exportMyData = () => {
    downloadJson("meus-dados-vestibulando.json", {
      exportadoEm: eadNow(),
      usuario: {
        uid: userData?.uid,
        nome: userData?.nome,
        email: userData?.email,
        tipo: userData?.tipo,
        perfilEad: (userData as any)?.eadProfile,
      },
      atendimentos: tickets.data,
      observacao: "Outros registros acadêmicos podem ser solicitados à direção pelo canal LGPD.",
    });
    toast({ title: "Arquivo preparado", description: "O download contém os dados disponíveis nesta sessão." });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Segurança e suporte"
        title="Central de ajuda"
        description="Encontre respostas, abra atendimento técnico, financeiro ou pedagógico e exerça seus direitos de privacidade."
        action={<Link href="/chat"><Button variant="outline" className="gap-2"><MessageCircle className="h-4 w-4" />Falar no chat</Button></Link>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Atendimentos abertos" value={tickets.data.filter((ticket) => ticket.status !== "resolvido").length} icon={LifeBuoy} />
        <StatCard label="Resolvidos" value={tickets.data.filter((ticket) => ticket.status === "resolvido").length} icon={TicketCheck} tone="success" />
        <StatCard label="Monitoramento" value="Ativo" helper="erros técnicos registrados" icon={CircleGauge} tone="warning" />
      </div>

      <Tabs defaultValue="ajuda">
        <TabsList>
          <TabsTrigger value="ajuda">Perguntas frequentes</TabsTrigger>
          <TabsTrigger value="novo">Novo atendimento</TabsTrigger>
          <TabsTrigger value="meus">Meus atendimentos</TabsTrigger>
          <TabsTrigger value="privacidade">Privacidade e LGPD</TabsTrigger>
        </TabsList>
        <TabsContent value="ajuda" className="mt-5">
          <Card>
            <CardHeader><CardTitle>Perguntas frequentes</CardTitle><CardDescription>Orientações rápidas sobre acesso, estudo, pagamentos e suporte.</CardDescription></CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                {DEFAULT_FAQS.map((faq, index) => (
                  <AccordionItem key={faq.question} value={`faq-${index}`}>
                    <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                    <AccordionContent className="leading-relaxed text-muted-foreground">{faq.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="novo" className="mt-5">
          <Card className="max-w-3xl">
            <CardHeader><CardTitle>Abrir solicitação</CardTitle><CardDescription>Descreva o problema com detalhes. Erros da aplicação também são monitorados automaticamente.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Canal" htmlFor="ticket-category"><Select value={form.category} onValueChange={(value: EadSupportTicket["category"]) => setForm((current) => ({ ...current, category: value }))}><SelectTrigger id="ticket-category"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tecnico">Atendimento técnico</SelectItem><SelectItem value="pedagogico">Atendimento pedagógico</SelectItem><SelectItem value="financeiro">Financeiro</SelectItem><SelectItem value="reclamacao">Reclamação</SelectItem><SelectItem value="lgpd">Privacidade / LGPD</SelectItem></SelectContent></Select></Field>
                <Field label="Prioridade" htmlFor="ticket-priority"><Select value={form.priority} onValueChange={(value: EadSupportTicket["priority"]) => setForm((current) => ({ ...current, priority: value }))}><SelectTrigger id="ticket-priority"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="alta">Alta</SelectItem></SelectContent></Select></Field>
              </div>
              <Field label="Assunto" htmlFor="ticket-subject" required><Input id="ticket-subject" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Resumo do pedido" /></Field>
              <Field label="Mensagem" htmlFor="ticket-message" required><Textarea id="ticket-message" value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} className="min-h-40" placeholder="O que aconteceu, em qual página e o que você tentou fazer?" /></Field>
              <Button onClick={submitTicket} disabled={saving || !form.subject.trim() || !form.message.trim()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LifeBuoy className="mr-2 h-4 w-4" />}Enviar solicitação</Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="meus" className="mt-5">
          {tickets.data.length ? (
            <div className="space-y-3">
              {tickets.data.map((ticket) => (
                <Card key={ticket.id}>
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <div className="rounded-xl bg-primary/10 p-3 text-primary"><LifeBuoy className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{ticket.subject}</p><Badge variant="outline">{ticket.category}</Badge></div><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{ticket.message}</p><p className="mt-2 text-xs text-muted-foreground">Aberto {formatDate(ticket.createdAt, true)}</p>{ticket.response && <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm"><strong>Resposta do atendimento:</strong><p className="mt-1 whitespace-pre-wrap">{ticket.response}</p></div>}</div>
                      <StatusBadge status={ticket.status} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : <EmptyState title="Nenhum atendimento aberto" description="Quando precisar de ajuda, registre uma solicitação na aba anterior." icon={LifeBuoy} />}
        </TabsContent>
        <TabsContent value="privacidade" className="mt-5 space-y-5">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              [ShieldCheck, "Proteção de dados", "Acesso por perfil, regras de banco de dados e histórico de alterações reduzem acessos indevidos."],
              [FileText, "Termos e privacidade", "Uso educacional, deveres dos usuários, retenção de registros e canais de contato são apresentados com clareza."],
              [Scale, "Seus direitos", "Solicite acesso, correção, portabilidade ou exclusão conforme as hipóteses previstas na LGPD."],
            ].map(([Icon, title, description]: any) => <Card key={title}><CardHeader><Icon className="h-6 w-6 text-primary" /><CardTitle className="text-lg">{title}</CardTitle><CardDescription className="leading-relaxed">{description}</CardDescription></CardHeader></Card>)}
          </div>
          <Card>
            <CardHeader><CardTitle>Controle dos seus dados</CardTitle><CardDescription>Baixe um resumo agora ou abra uma solicitação LGPD para análise completa da direção.</CardDescription></CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={exportMyData}><FileJson className="mr-2 h-4 w-4" />Baixar meus dados</Button>
              <Button onClick={() => setForm((current) => ({ ...current, category: "lgpd", subject: "Solicitação de direitos LGPD" }))}><ShieldCheck className="mr-2 h-4 w-4" />Preparar solicitação LGPD</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
