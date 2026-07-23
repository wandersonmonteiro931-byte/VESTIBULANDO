import { useMemo, useState } from "react";
import { Link } from "wouter";
import { where } from "firebase/firestore";
import {
  AlarmClock,
  Bell,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  HelpCircle,
  Loader2,
  Megaphone,
  MessageCircle,
  MessageSquarePlus,
  Mic,
  Paperclip,
  Pin,
  Radio,
  Search,
  Send,
  ShieldAlert,
  ThumbsUp,
  UserCheck,
  Users,
  Video,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { EAD_DISCIPLINES } from "./catalog";
import {
  createEadRecord,
  eadNow,
  setEadRecord,
  updateEadRecord,
  useEadCollection,
} from "./store";
import type {
  EadForumReply,
  EadForumTopic,
  EadLiveClass,
  EadRole,
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

function classTiming(liveClass: EadLiveClass) {
  const start = new Date(liveClass.scheduledAt).getTime();
  const end = start + liveClass.durationMinutes * 60_000;
  const now = Date.now();
  if (liveClass.status === "encerrada" || now > end) return "encerrada";
  if (liveClass.status === "ao-vivo" || (now >= start && now <= end)) return "ao-vivo";
  return "agendada";
}

export function LiveClassesPage() {
  const { userData } = useAuth() as any;
  const { toast } = useToast();
  const uid = userData?.uid || "";
  const role = (userData?.tipo || "aluno") as EadRole;
  const actor = actorFromUser(userData);
  const [selectedClass, setSelectedClass] = useState<EadLiveClass | null>(null);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);

  const liveClasses = useEadCollection<EadLiveClass>("eadLiveClasses", {
    filter: (item) => item.published !== false,
    sort: (a, b) => a.scheduledAt.localeCompare(b.scheduledAt),
  });
  const ownAttendance = useEadCollection<any>("eadAttendance", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
  });
  const questions = useEadCollection<any>("eadLiveQuestions", {
    constraints: selectedClass ? [where("liveClassId", "==", selectedClass.id)] : [],
    enabled: !!selectedClass,
    sort: (a, b) => String(a.createdAt).localeCompare(String(b.createdAt)),
  });
  const polls = useEadCollection<any>("eadPolls", {
    constraints: selectedClass ? [where("liveClassId", "==", selectedClass.id)] : [],
    enabled: !!selectedClass,
    filter: (poll) => poll.active !== false,
  });
  const votes = useEadCollection<any>("eadPollVotes", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
  });

  const upcoming = liveClasses.data.filter((item) => classTiming(item) === "agendada");
  const liveNow = liveClasses.data.filter((item) => classTiming(item) === "ao-vivo");
  const recordings = liveClasses.data.filter(
    (item) => classTiming(item) === "encerrada" && item.recordingUrl,
  );

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      toast({ title: "Navegador sem notificações", description: "Use o calendário da página para acompanhar as aulas." });
      return;
    }
    const permission = await Notification.requestPermission();
    toast({
      title: permission === "granted" ? "Lembretes ativados" : "Permissão não concedida",
      description: permission === "granted"
        ? "Este aparelho poderá avisar antes das transmissões."
        : "Você pode alterar a permissão nas configurações do navegador.",
      variant: permission === "denied" ? "destructive" : "default",
    });
  };

  const joinClass = async (liveClass: EadLiveClass) => {
    if (!uid) return;
    try {
      await setEadRecord(
        "eadAttendance",
        `${liveClass.id}_${uid}`,
        {
          liveClassId: liveClass.id,
          liveClassTitle: liveClass.title,
          ownerId: uid,
          ownerName: userData?.nome || "Aluno",
          joinedAt: eadNow(),
          present: true,
        },
        actor,
        `Presença: ${liveClass.title}`,
      );
    } catch {
      // Opening the room remains possible if attendance writing is temporarily unavailable.
    }
    setSelectedClass(liveClass);
    if (liveClass.roomUrl) window.open(liveClass.roomUrl, "_blank", "noopener,noreferrer");
  };

  const sendQuestion = async () => {
    if (!selectedClass || !uid || !question.trim()) return;
    setSending(true);
    try {
      await createEadRecord(
        "eadLiveQuestions",
        {
          liveClassId: selectedClass.id,
          ownerId: uid,
          ownerName: userData?.nome || "Aluno",
          text: question.trim(),
          answered: false,
          likes: 0,
          createdAt: eadNow(),
        },
        actor,
        `Pergunta em ${selectedClass.title}`,
      );
      setQuestion("");
    } catch (error: any) {
      toast({ title: "Erro ao enviar pergunta", description: error.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const vote = async (poll: any, optionIndex: number) => {
    if (!uid) return;
    try {
      await setEadRecord(
        "eadPollVotes",
        `${poll.id}_${uid}`,
        {
          pollId: poll.id,
          liveClassId: poll.liveClassId,
          ownerId: uid,
          optionIndex,
          createdAt: eadNow(),
        },
        actor,
        `Enquete: ${poll.question}`,
      );
      toast({ title: "Resposta registrada" });
    } catch (error: any) {
      toast({ title: "Erro ao votar", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Aulas ao vivo"
        title="Agenda e sala virtual"
        description="Acompanhe transmissões, confirme presença, envie perguntas, responda enquetes e acesse gravações e materiais."
        action={<Button variant="outline" onClick={enableNotifications} className="gap-2"><Bell className="h-4 w-4" />Ativar avisos</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ao vivo agora" value={liveNow.length} icon={Radio} tone={liveNow.length ? "danger" : "primary"} />
        <StatCard label="Próximas" value={upcoming.length} icon={CalendarDays} />
        <StatCard label="Presenças" value={ownAttendance.data.filter((item) => item.present).length} icon={UserCheck} tone="success" />
        <StatCard label="Gravações" value={recordings.length} icon={Video} />
      </div>

      {liveNow.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-rose-600"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />No ar agora</h2>
          {liveNow.map((liveClass) => (
            <Card key={liveClass.id} className="border-rose-500/30 bg-rose-500/5">
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
                <div className="rounded-xl bg-rose-500 p-3 text-white"><Radio className="h-6 w-6" /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{liveClass.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{liveClass.discipline} · Prof. {liveClass.teacherName}</p>
                </div>
                <Button onClick={() => joinClass(liveClass)} className="gap-2 bg-rose-600 hover:bg-rose-700"><Camera className="h-4 w-4" />Entrar na sala</Button>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <Tabs defaultValue="agenda">
        <TabsList>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="gravacoes">Gravações</TabsTrigger>
          <TabsTrigger value="orientacoes">Como participar</TabsTrigger>
        </TabsList>
        <TabsContent value="agenda" className="mt-5">
          {upcoming.length ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {upcoming.map((liveClass) => (
                <Card key={liveClass.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="rounded-xl bg-primary/10 p-3 text-primary"><CalendarDays className="h-5 w-5" /></div>
                      <StatusBadge status={classTiming(liveClass)} />
                    </div>
                    <CardTitle className="pt-2">{liveClass.title}</CardTitle>
                    <CardDescription>{liveClass.description || "Aula interativa com perguntas e material de apoio."}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-muted p-3"><Clock3 className="mb-1 h-4 w-4 text-primary" />{formatDate(liveClass.scheduledAt, true)}</div>
                      <div className="rounded-lg bg-muted p-3"><Users className="mb-1 h-4 w-4 text-primary" />Prof. {liveClass.teacherName}</div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => setSelectedClass(liveClass)}>Ver detalhes e materiais</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : <EmptyState title="Nenhuma aula agendada" description="As próximas transmissões aparecerão aqui assim que o professor publicar a agenda." icon={CalendarDays} />}
        </TabsContent>
        <TabsContent value="gravacoes" className="mt-5">
          {recordings.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {recordings.map((liveClass) => (
                <Card key={liveClass.id}>
                  <CardHeader><Video className="mb-2 h-6 w-6 text-primary" /><CardTitle>{liveClass.title}</CardTitle><CardDescription>{liveClass.discipline} · {formatDate(liveClass.scheduledAt)}</CardDescription></CardHeader>
                  <CardContent className="space-y-2">
                    <a href={liveClass.recordingUrl} target="_blank" rel="noreferrer"><Button className="w-full">Assistir gravação</Button></a>
                    {liveClass.materialUrl && <a href={liveClass.materialUrl} target="_blank" rel="noreferrer"><Button variant="outline" className="w-full"><Paperclip className="mr-2 h-4 w-4" />Material da aula</Button></a>}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : <EmptyState title="Ainda não há gravações" description="Após cada transmissão, o professor poderá disponibilizar a gravação nesta página." icon={Video} />}
        </TabsContent>
        <TabsContent value="orientacoes" className="mt-5">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              [Camera, "Câmera e microfone", "Ao entrar na sala, autorize os dispositivos apenas se desejar participar por voz ou vídeo."],
              [MessageCircle, "Perguntas e chat", "Use o painel da aula para perguntar ao professor. O chat protegido continua disponível no cabeçalho."],
              [UserCheck, "Presença automática", "Sua entrada registra presença; o professor acompanha a lista da turma em tempo real."],
            ].map(([Icon, title, description]: any) => (
              <Card key={title}><CardHeader><Icon className="h-6 w-6 text-primary" /><CardTitle className="text-lg">{title}</CardTitle><CardDescription className="leading-relaxed">{description}</CardDescription></CardHeader></Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedClass} onOpenChange={(open) => !open && setSelectedClass(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          {selectedClass && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedClass.title}</DialogTitle>
                <DialogDescription>{selectedClass.discipline} · {formatDate(selectedClass.scheduledAt, true)} · {selectedClass.durationMinutes} min</DialogDescription>
              </DialogHeader>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <p className="font-semibold">Sala virtual</p>
                    <p className="mt-1 text-sm text-muted-foreground">Câmera, microfone, presença e gravação são controlados na sala.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {classTiming(selectedClass) === "ao-vivo" && <Button onClick={() => joinClass(selectedClass)}><Radio className="mr-2 h-4 w-4" />Entrar agora</Button>}
                      {role === "aluno" && !selectedClass.roomUrl && (
                        <Link href="/aula"><Button variant="outline"><Video className="mr-2 h-4 w-4" />Abrir sala interna</Button></Link>
                      )}
                      {selectedClass.materialUrl && <a href={selectedClass.materialUrl} target="_blank" rel="noreferrer"><Button variant="outline"><Paperclip className="mr-2 h-4 w-4" />Material</Button></a>}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="live-question">Perguntar ao professor</Label>
                    <div className="mt-2 flex gap-2">
                      <Input id="live-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Digite sua pergunta..." />
                      <Button size="icon" onClick={sendQuestion} disabled={sending || !question.trim()} aria-label="Enviar pergunta">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
                    </div>
                    <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                      {questions.data.map((item: any) => (
                        <div key={item.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between gap-2"><strong>{item.ownerName}</strong>{item.answered && <Badge>Respondida</Badge>}</div>
                          <p className="mt-1">{item.text}</p>
                          {item.answer && <p className="mt-2 rounded bg-primary/5 p-2 text-muted-foreground"><strong>Professor:</strong> {item.answer}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <p className="mb-3 font-semibold">Enquetes e atividades</p>
                  {polls.data.length ? (
                    <div className="space-y-4">
                      {polls.data.map((poll: any) => {
                        const myVote = votes.data.find((vote: any) => vote.pollId === poll.id);
                        return (
                          <div key={poll.id} className="rounded-xl border p-4">
                            <p className="font-medium">{poll.question}</p>
                            <div className="mt-3 space-y-2">
                              {(poll.options || []).map((option: string, index: number) => (
                                <Button key={option} variant={myVote?.optionIndex === index ? "default" : "outline"} className="w-full justify-start" onClick={() => vote(poll, index)}>{option}</Button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <EmptyState title="Nenhuma enquete ativa" description="As atividades publicadas durante a aula aparecerão aqui." icon={HelpCircle} />}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CommunityPage() {
  const { userData } = useAuth() as any;
  const { toast } = useToast();
  const uid = userData?.uid || "";
  const role = (userData?.tipo || "aluno") as EadRole;
  const actor = actorFromUser(userData);
  const [search, setSearch] = useState("");
  const [discipline, setDiscipline] = useState("todas");
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<EadForumTopic | null>(null);
  const [topicForm, setTopicForm] = useState({ title: "", body: "", discipline: "Matemática" });
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);

  const topics = useEadCollection<EadForumTopic>("eadForumTopics", {
    sort: (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt),
  });
  const replies = useEadCollection<EadForumReply>("eadForumReplies", {
    constraints: selectedTopic ? [where("topicId", "==", selectedTopic.id)] : [],
    enabled: !!selectedTopic,
    sort: (a, b) => a.createdAt.localeCompare(b.createdAt),
  });
  const officeHours = useEadCollection<any>("eadOfficeHours", {
    filter: (item) => item.active !== false,
    sort: (a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)),
  });
  const announcements = useEadCollection<any>("announcements", {
    filter: (item) => item.ativo !== false && item.active !== false,
    sort: (a, b) => String(b.createdAt || b.dataCriacao || "").localeCompare(String(a.createdAt || a.dataCriacao || "")),
  });

  const filteredTopics = topics.data.filter((topic) => {
    const term = search.trim().toLowerCase();
    return (
      (discipline === "todas" || topic.discipline === discipline) &&
      (!term || `${topic.title} ${topic.body} ${topic.authorName}`.toLowerCase().includes(term))
    );
  });

  const createTopic = async () => {
    if (!uid || !topicForm.title.trim() || !topicForm.body.trim()) return;
    setSaving(true);
    try {
      await createEadRecord(
        "eadForumTopics",
        {
          authorId: uid,
          authorName: userData?.nome || "Usuário",
          authorRole: role,
          discipline: topicForm.discipline,
          title: topicForm.title.trim(),
          body: topicForm.body.trim(),
          status: "aberto",
          pinned: false,
          moderated: false,
          replyCount: 0,
          createdAt: eadNow(),
          updatedAt: eadNow(),
        },
        actor,
        topicForm.title,
      );
      setTopicForm({ title: "", body: "", discipline: "Matemática" });
      setNewTopicOpen(false);
      toast({ title: "Pergunta publicada", description: "Professor e colegas já podem responder." });
    } catch (error: any) {
      toast({ title: "Erro ao publicar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async () => {
    if (!selectedTopic || !uid || !reply.trim()) return;
    setSaving(true);
    try {
      await createEadRecord(
        "eadForumReplies",
        {
          topicId: selectedTopic.id,
          authorId: uid,
          authorName: userData?.nome || "Usuário",
          authorRole: role,
          body: reply.trim(),
          accepted: false,
          createdAt: eadNow(),
        },
        actor,
        `Resposta: ${selectedTopic.title}`,
      );
      await updateEadRecord(
        "eadForumTopics",
        selectedTopic.id,
        {
          replyCount: (selectedTopic.replyCount || 0) + 1,
          status: role === "professor" || role === "diretor" ? "respondido" : selectedTopic.status,
        },
        actor,
        selectedTopic.title,
      );
      setReply("");
    } catch (error: any) {
      toast({ title: "Erro ao responder", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const moderateTopic = async (changes: Partial<EadForumTopic>) => {
    if (!selectedTopic || role === "aluno") return;
    try {
      await updateEadRecord("eadForumTopics", selectedTopic.id, changes, actor, selectedTopic.title);
      setSelectedTopic({ ...selectedTopic, ...changes });
      toast({ title: "Moderação atualizada" });
    } catch (error: any) {
      toast({ title: "Erro na moderação", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Dúvidas e comunicação"
        title="Fórum, plantão e comunicados"
        description="Tire dúvidas por disciplina, acompanhe plantões e avisos e use o chat protegido para conversar diretamente."
        action={
          <div className="flex gap-2">
            <Link href="/chat"><Button variant="outline" className="gap-2"><MessageCircle className="h-4 w-4" />Abrir chat</Button></Link>
            <Button onClick={() => setNewTopicOpen(true)} className="gap-2"><MessageSquarePlus className="h-4 w-4" />Nova pergunta</Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Tópicos abertos" value={topics.data.filter((topic) => topic.status === "aberto").length} icon={HelpCircle} />
        <StatCard label="Respondidos" value={topics.data.filter((topic) => topic.status === "respondido").length} icon={CheckCircle2} tone="success" />
        <StatCard label="Próximos plantões" value={officeHours.data.length} icon={AlarmClock} tone="warning" />
      </div>

      <Tabs defaultValue="forum">
        <TabsList>
          <TabsTrigger value="forum">Fórum por disciplina</TabsTrigger>
          <TabsTrigger value="plantao">Plantão de dúvidas</TabsTrigger>
          <TabsTrigger value="comunicados">Comunicados</TabsTrigger>
          <TabsTrigger value="seguranca">Convivência segura</TabsTrigger>
        </TabsList>
        <TabsContent value="forum" className="mt-5 space-y-4">
          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_230px]">
              <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pergunta, assunto ou autor..." className="pl-9" /></div>
              <Select value={discipline} onValueChange={setDiscipline}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as disciplinas</SelectItem>{EAD_DISCIPLINES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
            </CardContent>
          </Card>
          {filteredTopics.length ? (
            <div className="space-y-3">
              {filteredTopics.map((topic) => (
                <button key={topic.id} type="button" onClick={() => setSelectedTopic(topic)} className="flex w-full flex-col gap-3 rounded-xl border bg-background p-5 text-left transition-colors hover:border-primary/40 hover:bg-muted/20 sm:flex-row sm:items-center">
                  <div className="rounded-xl bg-primary/10 p-3 text-primary">{topic.pinned ? <Pin className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{topic.title}</p>{topic.pinned && <Badge>Fixado</Badge>}</div>
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{topic.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{topic.discipline} · {topic.authorName} · {formatDate(topic.createdAt, true)}</p>
                  </div>
                  <div className="flex items-center gap-3"><Badge variant="secondary">{topic.replyCount || 0} respostas</Badge><StatusBadge status={topic.status} /></div>
                </button>
              ))}
            </div>
          ) : <EmptyState title="Nenhum tópico encontrado" description="Ajuste os filtros ou publique uma nova pergunta." icon={HelpCircle} />}
        </TabsContent>
        <TabsContent value="plantao" className="mt-5">
          {officeHours.data.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {officeHours.data.map((item: any) => (
                <Card key={item.id}><CardHeader><AlarmClock className="mb-2 h-6 w-6 text-primary" /><CardTitle>{item.title || `Plantão de ${item.discipline}`}</CardTitle><CardDescription>{item.teacherName} · {formatDate(item.scheduledAt, true)}</CardDescription></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">{item.description || "Atendimento para dúvidas da disciplina."}</p>{item.roomUrl ? <a href={item.roomUrl} target="_blank" rel="noreferrer"><Button className="w-full">Entrar no plantão</Button></a> : <Link href="/chat"><Button className="w-full">Falar pelo chat</Button></Link>}</CardContent></Card>
              ))}
            </div>
          ) : <EmptyState title="Nenhum plantão agendado" description="Enquanto isso, publique sua dúvida no fórum ou fale com o professor pelo chat." icon={AlarmClock} />}
        </TabsContent>
        <TabsContent value="comunicados" className="mt-5">
          {announcements.data.length ? (
            <div className="space-y-3">
              {announcements.data.slice(0, 20).map((announcement: any) => (
                <Card key={announcement.id}><CardContent className="flex gap-4 p-5"><div className="rounded-xl bg-amber-500/10 p-3 text-amber-600"><Megaphone className="h-5 w-5" /></div><div><p className="font-semibold">{announcement.titulo || announcement.title || "Comunicado"}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{announcement.conteudo || announcement.message || announcement.descricao}</p></div></CardContent></Card>
              ))}
            </div>
          ) : <EmptyState title="Nenhum comunicado recente" description="Avisos gerais da escola aparecerão nesta página." icon={Megaphone} />}
        </TabsContent>
        <TabsContent value="seguranca" className="mt-5">
          <Card>
            <CardHeader><ShieldAlert className="mb-2 h-7 w-7 text-primary" /><CardTitle>Comunicação protegida e moderada</CardTitle><CardDescription>O chat atual mantém indicadores online/digitando, não lidas, anexos, histórico, bloqueio e denúncia.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {[
                ["Bloquear", "Interrompa mensagens de um usuário pela opção da conversa."],
                ["Denunciar", "Envie a conversa para avaliação da direção sem apagar seu histórico."],
                ["Moderação", "A direção acompanha denúncias e pode fechar tópicos inadequados."],
              ].map(([title, description]) => <div key={title} className="rounded-xl border p-4"><p className="font-semibold">{title}</p><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={newTopicOpen} onOpenChange={setNewTopicOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova pergunta no fórum</DialogTitle><DialogDescription>Use um título objetivo e explique onde encontrou a dificuldade.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <Field label="Disciplina" htmlFor="topic-discipline" required><Select value={topicForm.discipline} onValueChange={(value) => setTopicForm((current) => ({ ...current, discipline: value }))}><SelectTrigger id="topic-discipline"><SelectValue /></SelectTrigger><SelectContent>{EAD_DISCIPLINES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Título" htmlFor="topic-title" required><Input id="topic-title" value={topicForm.title} onChange={(event) => setTopicForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Como identificar a função neste gráfico?" /></Field>
            <Field label="Detalhes" htmlFor="topic-body" required><Textarea id="topic-body" value={topicForm.body} onChange={(event) => setTopicForm((current) => ({ ...current, body: event.target.value }))} className="min-h-36" placeholder="Descreva sua tentativa e a parte que não entendeu..." /></Field>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setNewTopicOpen(false)}>Cancelar</Button><Button onClick={createTopic} disabled={saving || !topicForm.title.trim() || !topicForm.body.trim()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Publicar pergunta</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTopic} onOpenChange={(open) => !open && setSelectedTopic(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {selectedTopic && (
            <>
              <DialogHeader><div className="mb-2 flex flex-wrap gap-2"><Badge variant="secondary">{selectedTopic.discipline}</Badge><StatusBadge status={selectedTopic.status} /></div><DialogTitle>{selectedTopic.title}</DialogTitle><DialogDescription>{selectedTopic.authorName} · {formatDate(selectedTopic.createdAt, true)}</DialogDescription></DialogHeader>
              <div className="rounded-xl border bg-muted/20 p-4 text-sm leading-relaxed">{selectedTopic.body}</div>
              {(role === "professor" || role === "diretor") && (
                <div className="flex flex-wrap gap-2 rounded-lg border p-3">
                  <Button size="sm" variant="outline" onClick={() => moderateTopic({ pinned: !selectedTopic.pinned })}>{selectedTopic.pinned ? "Desafixar" : "Fixar tópico"}</Button>
                  <Button size="sm" variant="outline" onClick={() => moderateTopic({ status: selectedTopic.status === "fechado" ? "aberto" : "fechado", moderated: true })}>{selectedTopic.status === "fechado" ? "Reabrir" : "Fechar tópico"}</Button>
                </div>
              )}
              <div className="space-y-3">
                <p className="font-semibold">Respostas</p>
                {replies.data.map((item) => (
                  <div key={item.id} className="rounded-xl border p-4">
                    <div className="flex items-center gap-2"><strong className="text-sm">{item.authorName}</strong><Badge variant="outline">{item.authorRole}</Badge>{item.accepted && <Badge>Resposta aceita</Badge>}</div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{item.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{formatDate(item.createdAt, true)}</p>
                  </div>
                ))}
                {!replies.data.length && <p className="text-sm text-muted-foreground">Ainda não há respostas.</p>}
              </div>
              {selectedTopic.status !== "fechado" && (
                <div className="space-y-2">
                  <Label htmlFor="forum-reply">Sua resposta</Label>
                  <Textarea id="forum-reply" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Explique de forma clara e respeitosa..." />
                  <Button onClick={sendReply} disabled={saving || !reply.trim()} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Responder</Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
