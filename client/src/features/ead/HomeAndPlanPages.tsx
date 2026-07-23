import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { collection, doc, updateDoc, where, writeBatch } from "firebase/firestore";
import {
  AlertTriangle,
  BellRing,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Flame,
  GraduationCap,
  ListChecks,
  Plus,
  RefreshCcw,
  Settings2,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { BRAZILIAN_EXAMS, DEFAULT_LESSONS, EAD_DISCIPLINES } from "./catalog";
import { createEadRecord, eadNow, setEadRecord, useEadCollection } from "./store";
import type { EadExamAttempt, EadLessonProgress, EadProfile, EadStudyItem } from "./types";
import { EmptyState, Field, SectionHeader, StatCard, StatusBadge, formatDate } from "./ui";

const todayKey = () => format(new Date(), "yyyy-MM-dd");

function actorFromUser(userData: any) {
  return userData
    ? { uid: userData.uid, nome: userData.nome || "Aluno", tipo: userData.tipo || "aluno" }
    : null;
}

export function StudentHomePage() {
  const { userData, refreshUserData } = useAuth() as any;
  const { toast } = useToast();
  const uid = userData?.uid || "";
  const profile = ((userData as any)?.eadProfile || {}) as EadProfile;
  const [profileOpen, setProfileOpen] = useState(!profile.provaAlvo);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EadProfile>({
    curso: profile.curso || "Preparatório ENEM",
    provaAlvo: profile.provaAlvo || "ENEM",
    objetivo: profile.objetivo || "",
    serie: profile.serie || "",
    turno: profile.turno || "",
    nivel: profile.nivel || "iniciante",
    dataProva: profile.dataProva || "",
    horasSemanais: profile.horasSemanais || 10,
    metaAulas: profile.metaAulas || 5,
    metaQuestoes: profile.metaQuestoes || 70,
    responsavelNome: profile.responsavelNome || "",
    responsavelEmail: profile.responsavelEmail || "",
  });

  const studyItems = useEadCollection<EadStudyItem>("eadStudyItems", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
  });
  const progressRecords = useEadCollection<EadLessonProgress>("eadLessonProgress", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
  });
  const examAttempts = useEadCollection<EadExamAttempt>("eadExamAttempts", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
  });

  const todayItems = studyItems.data.filter((item) => item.scheduledDate === todayKey());
  const completedToday = todayItems.filter((item) => item.completed).length;
  const pending = studyItems.data.filter((item) => !item.completed).length;
  const overdue = studyItems.data.filter(
    (item) => !item.completed && isBefore(parseISO(item.scheduledDate), new Date(todayKey())),
  ).length;
  const completedLessons = progressRecords.data.filter((item) => item.completed).length;
  const lessonProgress =
    progressRecords.data.length > 0
      ? Math.round(
          progressRecords.data.reduce((total, record) => total + record.progress, 0) /
            progressRecords.data.length,
        )
      : 0;
  const recentLessons = [...progressRecords.data]
    .sort((a, b) => b.lastAccessedAt.localeCompare(a.lastAccessedAt))
    .slice(0, 3)
    .map((record) => ({
      record,
      lesson: DEFAULT_LESSONS.find((lesson) => lesson.id === record.lessonId),
    }))
    .filter((item) => item.lesson);
  const nextItems = studyItems.data
    .filter((item) => !item.completed && !isBefore(parseISO(item.scheduledDate), new Date(todayKey())))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    .slice(0, 5);

  const saveProfile = async () => {
    if (!uid) return;
    if (!form.provaAlvo || !form.objetivo || !form.serie || !form.turno || !form.dataProva) {
      toast({
        title: "Complete os campos obrigatórios",
        description: "Prova, objetivo, série, turno e data da prova são necessários para personalizar o plano.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "usuarios", uid), { eadProfile: form, eadProfileUpdatedAt: eadNow() });
      await refreshUserData();
      setProfileOpen(false);
      toast({ title: "Perfil de preparação salvo", description: "Seu plano agora pode usar essas informações." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar perfil", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Área do aluno"
        title={`Olá, ${userData?.nome?.split(" ")[0] || "estudante"}!`}
        description="Veja o que estudar hoje, acompanhe seu progresso e continue exatamente de onde parou."
        action={
          <Button variant="outline" onClick={() => setProfileOpen(true)} className="gap-2">
            <Settings2 className="h-4 w-4" />
            Meu objetivo
          </Button>
        }
      />

      {!profile.provaAlvo && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">Personalize sua preparação</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Informe a prova, a data e sua rotina para receber um plano adequado.
                </p>
              </div>
            </div>
            <Button onClick={() => setProfileOpen(true)}>Configurar agora</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Plano de hoje"
          value={`${completedToday}/${todayItems.length}`}
          helper="tarefas concluídas"
          icon={CalendarCheck}
          tone="primary"
        />
        <StatCard
          label="Progresso nas aulas"
          value={`${lessonProgress}%`}
          helper={`${completedLessons} aulas concluídas`}
          icon={BookOpen}
          tone="success"
        />
        <StatCard
          label="Pendências"
          value={pending}
          helper={overdue ? `${overdue} atrasadas` : "nenhuma atrasada"}
          icon={AlertTriangle}
          tone={overdue ? "danger" : "warning"}
        />
        <StatCard
          label="Simulados"
          value={examAttempts.data.filter((attempt) => attempt.status === "concluido").length}
          helper="resultados registrados"
          icon={Trophy}
          tone="primary"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Resumo do dia</CardTitle>
              <CardDescription>{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</CardDescription>
            </div>
            <Link href="/ead/plano">
              <Button variant="outline" size="sm">Abrir plano</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {todayItems.length ? (
              <div className="space-y-3">
                {todayItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        item.completed ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.completed ? <Check className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={item.completed ? "truncate font-medium line-through opacity-70" : "truncate font-medium"}>
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.discipline} · {item.durationMinutes} min · {item.kind}
                      </p>
                    </div>
                    <StatusBadge status={item.completed ? "concluído" : "pendente"} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ListChecks}
                title="Seu dia ainda está livre"
                description="Gere um plano personalizado ou adicione uma atividade para começar."
                action={
                  <Link href="/ead/plano">
                    <Button>Montar meu plano</Button>
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meta da semana</CardTitle>
            <CardDescription>{profile.horasSemanais || 10} horas planejadas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>Atividades concluídas</span>
                <span className="font-semibold">
                  {studyItems.data.filter((item) => item.completed).length}/{studyItems.data.length}
                </span>
              </div>
              <Progress
                value={
                  studyItems.data.length
                    ? (studyItems.data.filter((item) => item.completed).length / studyItems.data.length) * 100
                    : 0
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/60 p-3">
                <Target className="mb-2 h-4 w-4 text-primary" />
                <p className="text-xl font-bold">{profile.metaAulas || 5}</p>
                <p className="text-xs text-muted-foreground">aulas/semana</p>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <Flame className="mb-2 h-4 w-4 text-orange-500" />
                <p className="text-xl font-bold">{profile.metaQuestoes || 70}</p>
                <p className="text-xs text-muted-foreground">questões/semana</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Continuar estudando</CardTitle>
            <CardDescription>Suas últimas aulas acessadas</CardDescription>
          </CardHeader>
          <CardContent>
            {recentLessons.length ? (
              <div className="space-y-4">
                {recentLessons.map(({ record, lesson }) => (
                  <Link key={record.id} href={`/ead/conteudos?lesson=${lesson!.id}`}>
                    <button className="w-full rounded-lg border p-4 text-left transition hover:border-primary/50 hover:bg-muted/30">
                      <p className="font-semibold">{lesson!.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{lesson!.discipline} · {lesson!.module}</p>
                      <Progress value={record.progress} className="mt-3 h-2" />
                      <p className="mt-2 text-xs text-muted-foreground">{record.progress}% concluído</p>
                    </button>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={BookOpen}
                title="Nenhuma aula iniciada"
                description="Abra a biblioteca e escolha a primeira aula da sua trilha."
                action={
                  <Link href="/ead/conteudos">
                    <Button variant="outline">Explorar conteúdos</Button>
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos compromissos</CardTitle>
            <CardDescription>Provas, inscrições e atividades do seu calendário</CardDescription>
          </CardHeader>
          <CardContent>
            {nextItems.length ? (
              <div className="space-y-3">
                {nextItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <CalendarClock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.scheduledDate)} · {item.discipline}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CalendarClock}
                title="Nenhum compromisso futuro"
                description="Adicione provas, inscrições e atividades no plano de estudos."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Meu perfil de preparação</DialogTitle>
            <DialogDescription>
              Essas informações personalizam o plano, as metas e as recomendações.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-2 sm:grid-cols-2">
            <Field label="Curso" htmlFor="profile-course" required>
              <Input
                id="profile-course"
                value={form.curso || ""}
                onChange={(event) => setForm({ ...form, curso: event.target.value })}
              />
            </Field>
            <Field label="Prova principal" htmlFor="profile-exam" required>
              <Select value={form.provaAlvo} onValueChange={(value) => setForm({ ...form, provaAlvo: value })}>
                <SelectTrigger id="profile-exam"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {BRAZILIAN_EXAMS.map((exam) => <SelectItem key={exam} value={exam}>{exam}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Série/escolaridade" htmlFor="profile-grade" required>
              <Input
                id="profile-grade"
                placeholder="Ex.: 3º ano do Ensino Médio"
                value={form.serie || ""}
                onChange={(event) => setForm({ ...form, serie: event.target.value })}
              />
            </Field>
            <Field label="Turno preferencial" htmlFor="profile-shift" required>
              <Select value={form.turno} onValueChange={(value) => setForm({ ...form, turno: value })}>
                <SelectTrigger id="profile-shift"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manha">Manhã</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                  <SelectItem value="noite">Noite</SelectItem>
                  <SelectItem value="flexivel">Flexível</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nível atual" htmlFor="profile-level" required>
              <Select
                value={form.nivel}
                onValueChange={(value) => setForm({ ...form, nivel: value as EadProfile["nivel"] })}
              >
                <SelectTrigger id="profile-level"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="iniciante">Iniciante</SelectItem>
                  <SelectItem value="intermediario">Intermediário</SelectItem>
                  <SelectItem value="avancado">Avançado</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data da prova" htmlFor="profile-date" required>
              <Input
                id="profile-date"
                type="date"
                value={form.dataProva || ""}
                onChange={(event) => setForm({ ...form, dataProva: event.target.value })}
              />
            </Field>
            <Field label="Horas por semana" htmlFor="profile-hours">
              <Input
                id="profile-hours"
                type="number"
                min={1}
                max={60}
                value={form.horasSemanais || 10}
                onChange={(event) => setForm({ ...form, horasSemanais: Number(event.target.value) })}
              />
            </Field>
            <Field label="Meta de aulas por semana" htmlFor="profile-lessons">
              <Input
                id="profile-lessons"
                type="number"
                min={1}
                max={50}
                value={form.metaAulas || 5}
                onChange={(event) => setForm({ ...form, metaAulas: Number(event.target.value) })}
              />
            </Field>
            <Field label="Meta de questões por semana" htmlFor="profile-questions">
              <Input
                id="profile-questions"
                type="number"
                min={5}
                max={1000}
                value={form.metaQuestoes || 70}
                onChange={(event) => setForm({ ...form, metaQuestoes: Number(event.target.value) })}
              />
            </Field>
            <Field label="E-mail do responsável" htmlFor="profile-guardian-email" hint="Usado somente para compartilhar relatórios autorizados.">
              <Input
                id="profile-guardian-email"
                type="email"
                value={form.responsavelEmail || ""}
                onChange={(event) => setForm({ ...form, responsavelEmail: event.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Seu objetivo" htmlFor="profile-goal" required>
                <Textarea
                  id="profile-goal"
                  placeholder="Ex.: alcançar 720 pontos e conseguir uma vaga em Farmácia."
                  value={form.objetivo || ""}
                  onChange={(event) => setForm({ ...form, objetivo: event.target.value })}
                />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileOpen(false)}>Cancelar</Button>
            <Button onClick={saveProfile} disabled={saving}>
              {saving ? "Salvando..." : "Salvar perfil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function StudyPlanPage() {
  const { userData, refreshUserData } = useAuth() as any;
  const { toast } = useToast();
  const uid = userData?.uid || "";
  const actor = actorFromUser(userData);
  const profile = ((userData as any)?.eadProfile || {}) as EadProfile;
  const [createOpen, setCreateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [view, setView] = useState("dia");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [form, setForm] = useState({
    title: "",
    discipline: "Matemática",
    kind: "aula" as EadStudyItem["kind"],
    scheduledDate: todayKey(),
    durationMinutes: 45,
    difficulty: "media" as EadStudyItem["difficulty"],
    notes: "",
  });

  const enableReminders = async () => {
    if (!("Notification" in window)) {
      toast({ title: "Navegador sem notificações", description: "Seu cronograma continuará disponível nesta página." });
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      localStorage.setItem("vestibulando-ead-reminders", "enabled");
      toast({ title: "Lembretes ativados", description: "O preparatório avisará sobre atividades do dia neste aparelho." });
    } else {
      toast({ title: "Permissão não concedida", description: "Você pode ativá-la nas configurações do navegador.", variant: "destructive" });
    }
  };

  const { data: items, loading } = useEadCollection<EadStudyItem>("eadStudyItems", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
    sort: (a, b) => a.scheduledDate.localeCompare(b.scheduledDate),
  });

  const selected = parseISO(selectedDate);
  const visibleItems = useMemo(() => {
    if (view === "dia") return items.filter((item) => item.scheduledDate === selectedDate);
    if (view === "semana") {
      const start = startOfWeek(selected, { weekStartsOn: 1 });
      const end = endOfWeek(selected, { weekStartsOn: 1 });
      return items.filter((item) => {
        const date = parseISO(item.scheduledDate);
        return !isBefore(date, start) && !isAfter(date, end);
      });
    }
    const start = startOfMonth(selected);
    const end = endOfMonth(selected);
    return items.filter((item) => {
      const date = parseISO(item.scheduledDate);
      return !isBefore(date, start) && !isAfter(date, end);
    });
  }, [items, selectedDate, view]);

  const createItem = async () => {
    if (!uid || !form.title.trim()) return;
    try {
      await createEadRecord(
        "eadStudyItems",
        {
          ...form,
          ownerId: uid,
          completed: false,
          createdAt: eadNow(),
        },
        actor,
        form.title,
      );
      setCreateOpen(false);
      setForm({ ...form, title: "", notes: "" });
      toast({ title: "Atividade adicionada ao plano" });
    } catch (error: any) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    }
  };

  const toggleCompleted = async (item: EadStudyItem) => {
    try {
      await setEadRecord(
        "eadStudyItems",
        item.id,
        {
          completed: !item.completed,
          completedAt: !item.completed ? eadNow() : null,
        },
        actor,
        item.title,
      );
    } catch (error: any) {
      toast({ title: "Erro ao atualizar checklist", description: error.message, variant: "destructive" });
    }
  };

  const replanOverdue = async () => {
    const overdueItems = items.filter(
      (item) => !item.completed && isBefore(parseISO(item.scheduledDate), new Date(todayKey())),
    );
    if (!overdueItems.length) {
      toast({ title: "Seu plano está em dia", description: "Nenhuma atividade atrasada precisa ser replanejada." });
      return;
    }
    const batch = writeBatch(db);
    overdueItems.forEach((item, index) => {
      const newDate = format(addDays(new Date(), Math.floor(index / 2) + 1), "yyyy-MM-dd");
      batch.set(
        doc(db, "eadStudyItems", item.id),
        { scheduledDate: newDate, autoReplanned: true, updatedAt: eadNow() },
        { merge: true },
      );
    });
    try {
      await batch.commit();
      toast({
        title: "Plano reorganizado",
        description: `${overdueItems.length} atividade(s) foram distribuídas nos próximos dias.`,
      });
    } catch (error: any) {
      toast({ title: "Erro ao replanejar", description: error.message, variant: "destructive" });
    }
  };

  const generatePlan = async () => {
    if (!uid) return;
    if (!profile.dataProva) {
      toast({
        title: "Defina a data da prova",
        description: "Volte ao Meu dia e complete seu objetivo antes de gerar o plano.",
        variant: "destructive",
      });
      return;
    }
    setGenerating(true);
    try {
      const batch = writeBatch(db);
      const disciplines = [...EAD_DISCIPLINES];
      const today = new Date();
      const examDate = parseISO(profile.dataProva);
      const availableDays = Math.max(7, Math.min(28, Math.ceil((examDate.getTime() - today.getTime()) / 86_400_000)));
      const tasksPerWeek = Math.max(4, Math.min(14, profile.metaAulas || 5));
      const totalTasks = Math.max(8, Math.min(40, Math.ceil((availableDays / 7) * tasksPerWeek)));

      for (let index = 0; index < totalTasks; index += 1) {
        const discipline = disciplines[index % disciplines.length];
        const cycle = Math.floor(index / disciplines.length);
        const kind: EadStudyItem["kind"] =
          index % 7 === 5 ? "revisao" : index % 7 === 6 ? "simulado" : index % 3 === 2 ? "questoes" : "aula";
        const plannedDate = addDays(today, Math.min(availableDays - 1, index + Math.floor(index / 5)));
        const reference = doc(collection(db, "eadStudyItems"));
        batch.set(reference, {
          ownerId: uid,
          title:
            kind === "aula"
              ? `Aula da trilha — ${discipline}`
              : kind === "questoes"
                ? `Lista de questões — ${discipline}`
                : kind === "simulado"
                  ? "Simulado de acompanhamento"
                  : `Revisão espaçada — ${discipline}`,
          discipline,
          kind,
          scheduledDate: format(plannedDate, "yyyy-MM-dd"),
          durationMinutes: kind === "simulado" ? 90 : kind === "questoes" ? 35 : 50,
          difficulty: cycle > 2 ? "dificil" : cycle > 0 ? "media" : "facil",
          completed: false,
          autoReplanned: false,
          notes: `Gerado para ${profile.provaAlvo || "sua prova"} com base no nível ${profile.nivel || "informado"}.`,
          createdAt: eadNow(),
          updatedAt: eadNow(),
        });
      }
      await batch.commit();
      toast({
        title: "Plano personalizado criado",
        description: `${totalTasks} atividades foram distribuídas até a sua prova.`,
      });
    } catch (error: any) {
      toast({ title: "Erro ao gerar plano", description: error.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const completedCount = items.filter((item) => item.completed).length;
  const overdueCount = items.filter(
    (item) => !item.completed && isBefore(parseISO(item.scheduledDate), new Date(todayKey())),
  ).length;

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Plano de estudos"
        title="Sua preparação, organizada até a prova"
        description="Use as visões diária, semanal e mensal, acompanhe metas e reorganize automaticamente o que ficou atrasado."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={enableReminders} className="gap-2">
              <BellRing className="h-4 w-4" />
              Lembretes
            </Button>
            <Button variant="outline" onClick={replanOverdue} className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Replanejar atrasos
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova atividade
            </Button>
          </div>
        }
      />

      <Card className="border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardContent className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <p className="font-semibold">Planejamento inteligente</p>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {profile.dataProva
                ? `Prova-alvo: ${profile.provaAlvo || "não informada"} em ${formatDate(profile.dataProva)}. O gerador usa seu nível e suas metas semanais.`
                : "Complete seu perfil no Meu dia para gerar um cronograma ajustado à data da prova."}
            </p>
          </div>
          <Button onClick={generatePlan} disabled={generating} className="gap-2">
            <GraduationCap className="h-4 w-4" />
            {generating ? "Gerando..." : "Gerar plano personalizado"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Planejadas" value={items.length} helper="atividades no cronograma" icon={CalendarClock} />
        <StatCard label="Concluídas" value={completedCount} helper="checklist completo" icon={CheckCircle2} tone="success" />
        <StatCard label="Atrasadas" value={overdueCount} helper="podem ser replanejadas" icon={AlertTriangle} tone={overdueCount ? "danger" : "success"} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Cronograma</CardTitle>
              <CardDescription>Marque cada atividade assim que terminar.</CardDescription>
            </div>
            <Input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="w-full sm:w-44"
              aria-label="Data de referência do cronograma"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={view} onValueChange={setView}>
            <TabsList className="mb-5 grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="dia">Dia</TabsTrigger>
              <TabsTrigger value="semana">Semana</TabsTrigger>
              <TabsTrigger value="mes">Mês</TabsTrigger>
            </TabsList>
            {["dia", "semana", "mes"].map((tab) => (
              <TabsContent key={tab} value={tab}>
                {loading ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">Carregando cronograma...</div>
                ) : visibleItems.length ? (
                  <div className="space-y-3">
                    {visibleItems.map((item) => {
                      const itemDate = parseISO(item.scheduledDate);
                      const late = !item.completed && isBefore(itemDate, new Date(todayKey()));
                      return (
                        <div
                          key={item.id}
                          className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${
                            late ? "border-rose-300 bg-rose-50/50 dark:bg-rose-950/10" : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleCompleted(item)}
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition ${
                              item.completed
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-muted-foreground/30 hover:border-primary"
                            }`}
                            aria-label={item.completed ? `Reabrir ${item.title}` : `Concluir ${item.title}`}
                          >
                            {item.completed && <Check className="h-4 w-4" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className={item.completed ? "font-semibold line-through opacity-60" : "font-semibold"}>
                                {item.title}
                              </p>
                              {item.autoReplanned && <StatusBadge status="replanejada" />}
                              {late && <StatusBadge status="atrasada" />}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {format(itemDate, "EEE, dd/MM", { locale: ptBR })} · {item.discipline} · {item.durationMinutes} min · {item.difficulty}
                            </p>
                            {item.notes && <p className="mt-2 text-sm text-muted-foreground">{item.notes}</p>}
                          </div>
                          <StatusBadge status={item.kind} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={CalendarCheck}
                    title="Nenhuma atividade neste período"
                    description="Adicione uma atividade manualmente ou gere seu plano personalizado."
                    action={<Button onClick={() => setCreateOpen(true)}>Adicionar atividade</Button>}
                  />
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova atividade do plano</DialogTitle>
            <DialogDescription>Cadastre uma aula, revisão, lista, simulado, redação ou inscrição.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Título" htmlFor="study-title" required>
                <Input
                  id="study-title"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Ex.: Revisar funções do primeiro grau"
                />
              </Field>
            </div>
            <Field label="Disciplina" htmlFor="study-discipline">
              <Select value={form.discipline} onValueChange={(value) => setForm({ ...form, discipline: value })}>
                <SelectTrigger id="study-discipline"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EAD_DISCIPLINES.map((discipline) => <SelectItem key={discipline} value={discipline}>{discipline}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tipo" htmlFor="study-kind">
              <Select value={form.kind} onValueChange={(value: EadStudyItem["kind"]) => setForm({ ...form, kind: value })}>
                <SelectTrigger id="study-kind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aula">Aula</SelectItem>
                  <SelectItem value="questoes">Questões</SelectItem>
                  <SelectItem value="revisao">Revisão</SelectItem>
                  <SelectItem value="simulado">Simulado</SelectItem>
                  <SelectItem value="redacao">Redação</SelectItem>
                  <SelectItem value="inscricao">Prova/inscrição</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data" htmlFor="study-date">
              <Input id="study-date" type="date" value={form.scheduledDate} onChange={(event) => setForm({ ...form, scheduledDate: event.target.value })} />
            </Field>
            <Field label="Duração em minutos" htmlFor="study-duration">
              <Input id="study-duration" type="number" min={5} max={480} value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })} />
            </Field>
            <Field label="Dificuldade" htmlFor="study-difficulty">
              <Select value={form.difficulty} onValueChange={(value: EadStudyItem["difficulty"]) => setForm({ ...form, difficulty: value })}>
                <SelectTrigger id="study-difficulty"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="facil">Fácil</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="dificil">Difícil</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Observações" htmlFor="study-notes">
                <Textarea id="study-notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={createItem} disabled={!form.title.trim()}>Adicionar ao plano</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
