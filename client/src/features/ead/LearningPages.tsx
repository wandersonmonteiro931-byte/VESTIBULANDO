import { useEffect, useMemo, useRef, useState } from "react";
import { where } from "firebase/firestore";
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  ExternalLink,
  FileAudio,
  FileText,
  Filter,
  FolderOpen,
  Gauge,
  Heart,
  History,
  Lightbulb,
  ListRestart,
  MessageSquareText,
  NotebookPen,
  Play,
  Search,
  Star,
  Timer,
  Trophy,
  Video,
  WifiOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DEFAULT_LESSONS, DEFAULT_QUESTIONS, EAD_DISCIPLINES } from "./catalog";
import {
  cacheLessonForOffline,
  createEadRecord,
  eadNow,
  setEadRecord,
  useEadCollection,
} from "./store";
import type {
  EadLesson,
  EadLessonProgress,
  EadQuestion,
  EadQuestionAttempt,
} from "./types";
import { EmptyState, Field, SectionHeader, StatCard } from "./ui";

function actorFromUser(userData: any) {
  return userData
    ? { uid: userData.uid, nome: userData.nome || "Usuário", tipo: userData.tipo || "aluno" }
    : null;
}

function mergeById<T extends { id: string }>(defaults: T[], remote: T[]) {
  const map = new Map<string, T>();
  defaults.forEach((item) => map.set(item.id, item));
  remote.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

const lessonIcon = (type: EadLesson["type"]) => {
  if (type === "video" || type === "ao-vivo") return Video;
  if (type === "audio") return FileAudio;
  return FileText;
};

const toYouTubeEmbed = (url?: string) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    if (parsed.hostname.includes("youtube.com") && parsed.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${parsed.searchParams.get("v")}`;
    }
    if (parsed.pathname.includes("/embed/")) return url;
  } catch {
    return null;
  }
  return null;
};

export function ContentLibraryPage() {
  const { userData } = useAuth() as any;
  const { toast } = useToast();
  const uid = userData?.uid || "";
  const actor = actorFromUser(userData);
  const [search, setSearch] = useState("");
  const [discipline, setDiscipline] = useState("todas");
  const [type, setType] = useState("todos");
  const [level, setLevel] = useState("todos");
  const [selected, setSelected] = useState<EadLesson | null>(null);
  const [progressValue, setProgressValue] = useState(0);
  const [savingOffline, setSavingOffline] = useState(false);
  const [commentText, setCommentText] = useState("");

  const lessonsQuery = useEadCollection<EadLesson>("eadLessons", {
    filter: (lesson) => lesson.published !== false,
  });
  const progressQuery = useEadCollection<EadLessonProgress>("eadLessonProgress", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
  });
  const commentsQuery = useEadCollection<any>("eadLessonComments", {
    constraints: selected ? [where("lessonId", "==", selected.id)] : [],
    enabled: !!selected,
    sort: (a, b) => String(a.createdAt).localeCompare(String(b.createdAt)),
  });
  const lessons = useMemo(
    () => mergeById(DEFAULT_LESSONS, lessonsQuery.data).filter((lesson) => lesson.published),
    [lessonsQuery.data],
  );
  const progressMap = useMemo(
    () => new Map(progressQuery.data.map((record) => [record.lessonId, record])),
    [progressQuery.data],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return lessons.filter((lesson) => {
      const matchesSearch =
        !term ||
        `${lesson.title} ${lesson.description} ${lesson.subject} ${lesson.module} ${lesson.trail}`
          .toLowerCase()
          .includes(term);
      return (
        matchesSearch &&
        (discipline === "todas" || lesson.discipline === discipline) &&
        (type === "todos" || lesson.type === type) &&
        (level === "todos" || lesson.level === level)
      );
    });
  }, [discipline, lessons, level, search, type]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, EadLesson[]>>((accumulator, lesson) => {
      const key = `${lesson.trail} · ${lesson.module}`;
      accumulator[key] = [...(accumulator[key] || []), lesson];
      return accumulator;
    }, {});
  }, [filtered]);

  useEffect(() => {
    const lessonId = new URLSearchParams(window.location.search).get("lesson");
    if (lessonId) {
      const lesson = lessons.find((item) => item.id === lessonId);
      if (lesson) openLesson(lesson);
    }
    // Open only when a direct lesson link is first resolved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons.length]);

  const openLesson = async (lesson: EadLesson) => {
    setSelected(lesson);
    const existing = progressMap.get(lesson.id);
    setProgressValue(existing?.progress || 0);
    if (!uid) return;
    try {
      await setEadRecord(
        "eadLessonProgress",
        `${uid}_${lesson.id}`,
        {
          ownerId: uid,
          lessonId: lesson.id,
          progress: existing?.progress || 0,
          watchedSeconds: existing?.watchedSeconds || 0,
          completed: existing?.completed || false,
          favorite: existing?.favorite || false,
          offline: existing?.offline || false,
          lastAccessedAt: eadNow(),
        },
        actor,
        lesson.title,
      );
    } catch {
      // The lesson remains available even when history cannot be written.
    }
  };

  const saveProgress = async (value = progressValue, close = false) => {
    if (!selected || !uid) return;
    const existing = progressMap.get(selected.id);
    try {
      await setEadRecord(
        "eadLessonProgress",
        `${uid}_${selected.id}`,
        {
          ownerId: uid,
          lessonId: selected.id,
          progress: value,
          watchedSeconds: Math.round((selected.durationMinutes * 60 * value) / 100),
          completed: value >= 100,
          favorite: existing?.favorite || false,
          offline: existing?.offline || false,
          lastAccessedAt: eadNow(),
        },
        actor,
        selected.title,
      );
      setProgressValue(value);
      toast({
        title: value >= 100 ? "Aula concluída" : "Progresso salvo",
        description: value >= 100 ? "Ela já conta no seu desempenho." : `Você parou em ${value}%.`,
      });
      if (close) setSelected(null);
    } catch (error: any) {
      toast({ title: "Erro ao salvar progresso", description: error.message, variant: "destructive" });
    }
  };

  const toggleFavorite = async (lesson: EadLesson) => {
    if (!uid) return;
    const existing = progressMap.get(lesson.id);
    try {
      await setEadRecord(
        "eadLessonProgress",
        `${uid}_${lesson.id}`,
        {
          ownerId: uid,
          lessonId: lesson.id,
          progress: existing?.progress || 0,
          watchedSeconds: existing?.watchedSeconds || 0,
          completed: existing?.completed || false,
          favorite: !existing?.favorite,
          offline: existing?.offline || false,
          lastAccessedAt: existing?.lastAccessedAt || eadNow(),
        },
        actor,
        lesson.title,
      );
    } catch (error: any) {
      toast({ title: "Erro ao atualizar favorito", description: error.message, variant: "destructive" });
    }
  };

  const saveOffline = async () => {
    if (!selected || !uid) return;
    setSavingOffline(true);
    const existing = progressMap.get(selected.id);
    try {
      const urls = [selected.materialUrl, selected.audioUrl].filter(Boolean) as string[];
      let cached = 0;
      try {
        cached = await cacheLessonForOffline(selected.id, urls);
      } catch {
        // Cross-origin material may reject caching; the lesson is still saved to the offline list.
      }
      await setEadRecord(
        "eadLessonProgress",
        `${uid}_${selected.id}`,
        {
          ownerId: uid,
          lessonId: selected.id,
          progress: existing?.progress || progressValue,
          watchedSeconds: existing?.watchedSeconds || 0,
          completed: existing?.completed || false,
          favorite: existing?.favorite || false,
          offline: true,
          lastAccessedAt: eadNow(),
        },
        actor,
        selected.title,
      );
      toast({
        title: cached ? "Material salvo no aparelho" : "Aula marcada para ver depois",
        description: cached
          ? `${cached} arquivo(s) estarão disponíveis quando a conexão cair.`
          : "O link externo não permitiu cache, mas a aula ficou na sua lista de uso posterior.",
      });
    } catch (error: any) {
      toast({ title: "Erro ao salvar aula", description: error.message, variant: "destructive" });
    } finally {
      setSavingOffline(false);
    }
  };

  const completed = progressQuery.data.filter((record) => record.completed).length;
  const favorites = progressQuery.data.filter((record) => record.favorite).length;
  const offline = progressQuery.data.filter((record) => record.offline).length;
  const embedUrl = toYouTubeEmbed(selected?.videoUrl);
  const directVideo = selected?.videoUrl && /\.(mp4|webm|ogg)(\?|$)/i.test(selected.videoUrl);

  const sendComment = async () => {
    if (!selected || !uid || !commentText.trim()) return;
    try {
      await createEadRecord(
        "eadLessonComments",
        {
          lessonId: selected.id,
          ownerId: uid,
          ownerName: userData?.nome || "Usuário",
          ownerRole: userData?.tipo || "aluno",
          text: commentText.trim(),
          createdAt: eadNow(),
        },
        actor,
        `Comentário: ${selected.title}`,
      );
      setCommentText("");
      toast({ title: "Comentário publicado" });
    } catch (error: any) {
      toast({ title: "Erro ao comentar", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Conteúdo didático"
        title="Trilhas, módulos e materiais"
        description="Videoaulas, aulas ao vivo, apostilas, resumos, mapas mentais, slides e áudios organizados conforme o edital."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Aulas disponíveis" value={lessons.length} helper="em todas as trilhas" icon={BookOpen} />
        <StatCard label="Concluídas" value={completed} helper="no seu histórico" icon={CheckCircle2} tone="success" />
        <StatCard label="Favoritos / depois" value={`${favorites}/${offline}`} helper="favoritos e uso posterior" icon={BookmarkCheck} tone="warning" />
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_200px_180px_160px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar aula, módulo, assunto ou edital..."
              className="pl-9"
              aria-label="Buscar conteúdo"
            />
          </div>
          <Select value={discipline} onValueChange={setDiscipline}>
            <SelectTrigger aria-label="Filtrar por disciplina"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as disciplinas</SelectItem>
              {EAD_DISCIPLINES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger aria-label="Filtrar por formato"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os formatos</SelectItem>
              <SelectItem value="video">Videoaula</SelectItem>
              <SelectItem value="ao-vivo">Ao vivo</SelectItem>
              <SelectItem value="pdf">Apostila PDF</SelectItem>
              <SelectItem value="resumo">Resumo</SelectItem>
              <SelectItem value="mapa-mental">Mapa mental</SelectItem>
              <SelectItem value="slides">Slides</SelectItem>
              <SelectItem value="audio">Áudio/podcast</SelectItem>
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger aria-label="Filtrar por nível"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os níveis</SelectItem>
              <SelectItem value="iniciante">Iniciante</SelectItem>
              <SelectItem value="intermediario">Intermediário</SelectItem>
              <SelectItem value="avancado">Avançado</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {Object.keys(grouped).length ? (
        <div className="space-y-8">
          {Object.entries(grouped).map(([group, groupLessons]) => (
            <section key={group} aria-labelledby={`group-${group.replace(/\W/g, "-")}`}>
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary"><FolderOpen className="h-4 w-4" /></div>
                <div>
                  <h2 id={`group-${group.replace(/\W/g, "-")}`} className="font-bold">{group}</h2>
                  <p className="text-xs text-muted-foreground">{groupLessons.length} conteúdo(s)</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {groupLessons.map((lesson) => {
                  const Icon = lessonIcon(lesson.type);
                  const progress = progressMap.get(lesson.id);
                  return (
                    <Card key={lesson.id} className="group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
                      <CardHeader className="pb-3">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleFavorite(lesson)}
                            aria-label={progress?.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                          >
                            <Heart className={cn("h-4 w-4", progress?.favorite && "fill-rose-500 text-rose-500")} />
                          </Button>
                        </div>
                        <CardTitle className="text-base leading-snug">{lesson.title}</CardTitle>
                        <CardDescription>{lesson.discipline} · {lesson.subject}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{lesson.description}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{lesson.type.replace("-", " ")}</Badge>
                          <Badge variant="outline">{lesson.level}</Badge>
                          <Badge variant="outline">{lesson.durationMinutes} min</Badge>
                        </div>
                        {progress && (
                          <div>
                            <Progress value={progress.progress} className="h-2" />
                            <p className="mt-1 text-xs text-muted-foreground">{progress.progress}% concluído</p>
                          </div>
                        )}
                        <Button className="w-full gap-2" onClick={() => openLesson(lesson)}>
                          <Play className="h-4 w-4" />
                          {progress?.progress ? "Continuar aula" : "Abrir aula"}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Filter}
          title="Nenhum conteúdo encontrado"
          description="Altere os filtros ou peça ao professor para publicar novos materiais."
        />
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto p-0">
          {selected && (
            <>
              <DialogHeader className="border-b p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{selected.discipline}</Badge>
                  <Badge variant="outline">{selected.type.replace("-", " ")}</Badge>
                  <Badge variant="outline">{selected.durationMinutes} min</Badge>
                </div>
                <DialogTitle className="pt-2 text-2xl">{selected.title}</DialogTitle>
                <DialogDescription>{selected.module} · {selected.trail}</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 p-6">
                {directVideo ? (
                  <div className="overflow-hidden rounded-xl border bg-black">
                    <video
                      src={selected.videoUrl}
                      controls
                      preload="metadata"
                      className="aspect-video w-full"
                      aria-label={selected.title}
                    >
                      {selected.captionsUrl && (
                        <track
                          kind="captions"
                          src={selected.captionsUrl}
                          srcLang="pt-BR"
                          label="Português"
                          default
                        />
                      )}
                      Seu navegador não suporta o reprodutor de vídeo.
                    </video>
                    <p className="bg-muted p-2 text-center text-xs text-muted-foreground">
                      Use o menu do reprodutor para alterar velocidade, legendas e tela cheia.
                    </p>
                  </div>
                ) : embedUrl ? (
                  <div className="aspect-video overflow-hidden rounded-xl border bg-black">
                    <iframe
                      src={embedUrl}
                      title={selected.title}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : selected.videoUrl ? (
                  <a
                    href={selected.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-44 items-center justify-center rounded-xl border bg-gradient-to-br from-primary/10 to-muted"
                  >
                    <div className="text-center">
                      <Play className="mx-auto mb-3 h-10 w-10 text-primary" />
                      <p className="font-semibold">Abrir videoaula</p>
                      <p className="mt-1 text-sm text-muted-foreground">O conteúdo será aberto em uma nova aba.</p>
                    </div>
                  </a>
                ) : (
                  <div className="rounded-xl border bg-muted/40 p-6">
                    <h3 className="font-semibold">Resumo da aula</h3>
                    <p className="mt-3 leading-relaxed text-muted-foreground">{selected.description}</p>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Materiais complementares</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selected.materialUrl && (
                        <a href={selected.materialUrl} target="_blank" rel="noreferrer">
                          <Button variant="outline" className="w-full justify-start gap-2">
                            <FileText className="h-4 w-4" />
                            Abrir apostila, resumo ou slides
                            <ExternalLink className="ml-auto h-3 w-3" />
                          </Button>
                        </a>
                      )}
                      {selected.audioUrl && (
                        <a href={selected.audioUrl} target="_blank" rel="noreferrer">
                          <Button variant="outline" className="w-full justify-start gap-2">
                            <FileAudio className="h-4 w-4" />
                            Ouvir áudio/podcast
                            <ExternalLink className="ml-auto h-3 w-3" />
                          </Button>
                        </a>
                      )}
                      {!selected.materialUrl && !selected.audioUrl && (
                        <p className="text-sm text-muted-foreground">O professor ainda não anexou arquivos.</p>
                      )}
                      <Button variant="outline" className="w-full justify-start gap-2" onClick={saveOffline} disabled={savingOffline}>
                        <WifiOff className="h-4 w-4" />
                        {savingOffline ? "Salvando..." : "Guardar para ver depois"}
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Relação com o edital</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {selected.editalReference || "Conteúdo associado à matriz de referência e aos objetivos da trilha."}
                      </p>
                      {selected.teacherName && (
                        <p className="mt-4 text-xs font-semibold">Professor/equipe: {selected.teacherName}</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Salvar seu progresso</CardTitle>
                    <CardDescription>Use o controle para continuar deste ponto na próxima visita.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Slider
                      value={[progressValue]}
                      onValueChange={([value]) => setProgressValue(value)}
                      max={100}
                      step={5}
                      aria-label="Percentual concluído da aula"
                    />
                    <div className="flex items-center justify-between text-sm">
                      <span>{progressValue}% concluído</span>
                      <Button variant="outline" size="sm" onClick={() => saveProgress(100)}>
                        <Check className="mr-2 h-4 w-4" />
                        Marcar como concluída
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Comentários da aula</CardTitle>
                    <CardDescription>Tire dúvidas sobre este conteúdo sem sair da página.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="max-h-64 space-y-3 overflow-y-auto">
                      {commentsQuery.data.map((comment: any) => (
                        <div key={comment.id} className="rounded-lg border p-3">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{comment.ownerName}</p>
                            <Badge variant="outline">{comment.ownerRole}</Badge>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{comment.text}</p>
                        </div>
                      ))}
                      {!commentsQuery.data.length && (
                        <p className="text-sm text-muted-foreground">Seja o primeiro a comentar esta aula.</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={commentText}
                        onChange={(event) => setCommentText(event.target.value)}
                        placeholder="Escreva uma dúvida ou comentário..."
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void sendComment();
                          }
                        }}
                      />
                      <Button onClick={sendComment} disabled={!commentText.trim()}>Publicar</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <DialogFooter className="border-t p-5">
                <Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>
                <Button onClick={() => saveProgress(progressValue, true)}>Salvar e sair</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function QuestionBankPage() {
  const { userData } = useAuth() as any;
  const { toast } = useToast();
  const uid = userData?.uid || "";
  const actor = actorFromUser(userData);
  const [search, setSearch] = useState("");
  const [discipline, setDiscipline] = useState("todas");
  const [subject, setSubject] = useState("todos");
  const [year, setYear] = useState("todos");
  const [board, setBoard] = useState("todas");
  const [difficulty, setDifficulty] = useState("todas");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [session, setSession] = useState<EadQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const timerRef = useRef<number | null>(null);

  const remoteQuestions = useEadCollection<EadQuestion>("eadQuestions", {
    filter: (question) => question.published !== false,
  });
  const attempts = useEadCollection<EadQuestionAttempt>("eadQuestionAttempts", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
  });
  const favorites = useEadCollection<any>("eadQuestionFavorites", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
  });
  const notes = useEadCollection<any>("eadQuestionNotes", {
    constraints: uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
  });
  const questions = useMemo(
    () => mergeById(DEFAULT_QUESTIONS, remoteQuestions.data).filter((question) => question.published),
    [remoteQuestions.data],
  );
  const favoriteIds = useMemo(
    () => new Set(favorites.data.filter((item) => item.active !== false).map((item) => item.questionId)),
    [favorites.data],
  );
  const errorIds = useMemo(
    () => new Set(attempts.data.filter((attempt) => !attempt.correct).map((attempt) => attempt.questionId)),
    [attempts.data],
  );
  const subjects = Array.from(new Set(questions.map((question) => question.subject))).sort();
  const years = Array.from(new Set(questions.map((question) => question.year))).sort((a, b) => b - a);
  const boards = Array.from(new Set(questions.map((question) => question.board))).sort();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return questions.filter((question) => {
      return (
        (!term || `${question.statement} ${question.subject}`.toLowerCase().includes(term)) &&
        (discipline === "todas" || question.discipline === discipline) &&
        (subject === "todos" || question.subject === subject) &&
        (year === "todos" || question.year === Number(year)) &&
        (board === "todas" || question.board === board) &&
        (difficulty === "todas" || question.difficulty === difficulty) &&
        (!onlyErrors || errorIds.has(question.id))
      );
    });
  }, [board, difficulty, discipline, errorIds, onlyErrors, questions, search, subject, year]);

  const current = session[currentIndex];
  const currentNote = current ? notes.data.find((item) => item.questionId === current.id)?.text || "" : "";

  useEffect(() => {
    if (!current || answered) return;
    timerRef.current = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [answered, current]);

  const startSession = (list = filtered) => {
    if (!list.length) {
      toast({ title: "Nenhuma questão disponível", description: "Altere os filtros para começar." });
      return;
    }
    setSession(list);
    setCurrentIndex(0);
    setSelectedIndex(null);
    setAnswered(false);
    setElapsed(0);
  };

  const answerQuestion = async () => {
    if (!current || selectedIndex === null || !uid) return;
    const correct = selectedIndex === current.correctIndex;
    setAnswered(true);
    if (timerRef.current) window.clearInterval(timerRef.current);
    try {
      await createEadRecord(
        "eadQuestionAttempts",
        {
          ownerId: uid,
          questionId: current.id,
          selectedIndex,
          correct,
          elapsedSeconds: elapsed,
          discipline: current.discipline,
          subject: current.subject,
          attemptedAt: eadNow(),
        },
        actor,
        current.subject,
      );
    } catch (error: any) {
      toast({ title: "Resposta exibida, mas o histórico não foi salvo", description: error.message, variant: "destructive" });
    }
  };

  const moveQuestion = (direction: number) => {
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= session.length) return;
    setCurrentIndex(nextIndex);
    setSelectedIndex(null);
    setAnswered(false);
    setElapsed(0);
  };

  const toggleFavorite = async (question: EadQuestion) => {
    if (!uid) return;
    const isFavorite = favoriteIds.has(question.id);
    try {
      await setEadRecord(
        "eadQuestionFavorites",
        `${uid}_${question.id}`,
        {
          ownerId: uid,
          questionId: question.id,
          active: !isFavorite,
          favoritedAt: eadNow(),
        },
        actor,
        question.subject,
      );
    } catch (error: any) {
      toast({ title: "Erro ao atualizar favorito", description: error.message, variant: "destructive" });
    }
  };

  const saveNote = async () => {
    if (!current || !uid) return;
    try {
      await setEadRecord(
        "eadQuestionNotes",
        `${uid}_${current.id}`,
        { ownerId: uid, questionId: current.id, text: noteText },
        actor,
        current.subject,
      );
      setNoteOpen(false);
      toast({ title: "Anotação salva" });
    } catch (error: any) {
      toast({ title: "Erro ao salvar anotação", description: error.message, variant: "destructive" });
    }
  };

  const correctAttempts = attempts.data.filter((attempt) => attempt.correct).length;
  const accuracy = attempts.data.length ? Math.round((correctAttempts / attempts.data.length) * 100) : 0;
  const averageTime = attempts.data.length
    ? Math.round(attempts.data.reduce((total, attempt) => total + attempt.elapsedSeconds, 0) / attempts.data.length)
    : 0;

  if (current) {
    const favoriteRecord = favorites.data.find((item) => item.questionId === current.id);
    const isFavorite = !!favoriteRecord?.active;
    return (
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Sessão de questões"
          title={`${currentIndex + 1} de ${session.length}`}
          description={`${current.discipline} · ${current.subject} · ${current.board} ${current.year}`}
          action={
            <Button variant="outline" onClick={() => setSession([])} className="gap-2">
              <X className="h-4 w-4" />
              Encerrar sessão
            </Button>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            <span className="font-mono font-semibold">{Math.floor(elapsed / 60).toString().padStart(2, "0")}:{(elapsed % 60).toString().padStart(2, "0")}</span>
          </div>
          <Progress value={((currentIndex + (answered ? 1 : 0)) / session.length) * 100} className="h-2 max-w-md flex-1" />
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => toggleFavorite(current)} aria-label="Favoritar questão">
              <Star className={cn("h-4 w-4", isFavorite && "fill-amber-400 text-amber-500")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setNoteText(currentNote);
                setNoteOpen(true);
              }}
              aria-label="Anotar questão"
            >
              <NotebookPen className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge>{current.discipline}</Badge>
              <Badge variant="outline">{current.difficulty}</Badge>
              <Badge variant="outline">{current.board} · {current.year}</Badge>
            </div>
            <CardTitle className="pt-4 text-lg leading-relaxed">{current.statement}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {current.alternatives.map((alternative, index) => {
              const chosen = selectedIndex === index;
              const correct = answered && index === current.correctIndex;
              const wrong = answered && chosen && index !== current.correctIndex;
              return (
                <button
                  key={alternative}
                  type="button"
                  disabled={answered}
                  onClick={() => setSelectedIndex(index)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition",
                    !answered && chosen && "border-primary bg-primary/5 ring-1 ring-primary",
                    !answered && !chosen && "hover:border-primary/50 hover:bg-muted/30",
                    correct && "border-emerald-500 bg-emerald-500/10",
                    wrong && "border-rose-500 bg-rose-500/10",
                  )}
                >
                  <span className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                    chosen && !answered && "border-primary bg-primary text-primary-foreground",
                    correct && "border-emerald-600 bg-emerald-600 text-white",
                    wrong && "border-rose-600 bg-rose-600 text-white",
                  )}>
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="pt-1 text-sm leading-relaxed">{alternative}</span>
                </button>
              );
            })}

            {!answered ? (
              <Button className="mt-5 w-full" disabled={selectedIndex === null} onClick={answerQuestion}>
                Confirmar resposta
              </Button>
            ) : (
              <div className="mt-5 space-y-4 rounded-xl border bg-muted/30 p-5">
                <div className="flex items-center gap-2">
                  {selectedIndex === current.correctIndex ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <p className="font-semibold text-emerald-700 dark:text-emerald-400">Resposta correta</p>
                    </>
                  ) : (
                    <>
                      <CircleHelp className="h-5 w-5 text-rose-600" />
                      <p className="font-semibold text-rose-700 dark:text-rose-400">Revise este assunto</p>
                    </>
                  )}
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    Resolução comentada
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{current.explanation}</p>
                </div>
                {current.explanationVideoUrl && (
                  <a href={current.explanationVideoUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Play className="h-4 w-4" />
                      Ver explicação em vídeo
                    </Button>
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => moveQuestion(-1)} disabled={currentIndex === 0} className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          {currentIndex < session.length - 1 ? (
            <Button onClick={() => moveQuestion(1)} disabled={!answered} className="gap-2">
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => setSession([])} disabled={!answered} className="gap-2">
              <Trophy className="h-4 w-4" />
              Finalizar lista
            </Button>
          )}
        </div>

        <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Anotação desta questão</DialogTitle>
              <DialogDescription>Registre o raciocínio, uma fórmula ou o motivo do erro.</DialogDescription>
            </DialogHeader>
            <Textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} rows={7} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancelar</Button>
              <Button onClick={saveNote}>Salvar anotação</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Banco de questões"
        title="Pratique com correção comentada"
        description="Filtre por disciplina, assunto, ano, banca e dificuldade. Seus erros, tempo, favoritos e anotações ficam registrados."
        action={<Button onClick={() => startSession()} className="gap-2"><Play className="h-4 w-4" />Começar lista ({filtered.length})</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Respondidas" value={attempts.data.length} helper="no histórico" icon={History} />
        <StatCard label="Aproveitamento" value={`${accuracy}%`} helper={`${correctAttempts} acertos`} icon={Gauge} tone="success" />
        <StatCard label="Lista de erros" value={errorIds.size} helper="questões para refazer" icon={ListRestart} tone={errorIds.size ? "warning" : "success"} />
        <StatCard label="Tempo médio" value={`${averageTime}s`} helper="por questão" icon={Clock3} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros de estudo</CardTitle>
          <CardDescription>Monte um caderno personalizado para a sua necessidade.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar enunciado ou assunto..." className="pl-9" />
          </div>
          <Select value={discipline} onValueChange={setDiscipline}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as disciplinas</SelectItem>
              {EAD_DISCIPLINES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os assuntos</SelectItem>
              {subjects.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os anos</SelectItem>
              {years.map((item) => <SelectItem key={item} value={String(item)}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={board} onValueChange={setBoard}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as bancas</SelectItem>
              {boards.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as dificuldades</SelectItem>
              <SelectItem value="facil">Fácil</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="dificil">Difícil</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={onlyErrors ? "default" : "outline"}
            onClick={() => setOnlyErrors((value) => !value)}
            className="gap-2"
          >
            <ListRestart className="h-4 w-4" />
            {onlyErrors ? "Exibindo erros" : "Refazer meus erros"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((question) => {
          const tried = attempts.data.filter((attempt) => attempt.questionId === question.id);
          const lastAttempt = tried.at(-1);
          const isFavorite = !!favorites.data.find((item) => item.questionId === question.id)?.active;
          return (
            <Card key={question.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge>{question.discipline}</Badge>
                    <Badge variant="outline">{question.difficulty}</Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => toggleFavorite(question)}>
                    <Star className={cn("h-4 w-4", isFavorite && "fill-amber-400 text-amber-500")} />
                  </Button>
                </div>
                <CardTitle className="line-clamp-4 pt-2 text-base leading-relaxed">{question.statement}</CardTitle>
                <CardDescription>{question.subject} · {question.board} {question.year}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {lastAttempt && (
                  <div className={cn(
                    "rounded-lg p-3 text-xs",
                    lastAttempt.correct
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "bg-rose-500/10 text-rose-700 dark:text-rose-400",
                  )}>
                    Última tentativa: {lastAttempt.correct ? "acertou" : "errou"} em {lastAttempt.elapsedSeconds}s
                  </div>
                )}
                <Button className="w-full" variant={lastAttempt?.correct ? "outline" : "default"} onClick={() => startSession([question])}>
                  {tried.length ? "Refazer questão" : "Responder questão"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!filtered.length && (
        <EmptyState
          icon={CircleHelp}
          title={onlyErrors ? "Sua lista de erros está vazia" : "Nenhuma questão encontrada"}
          description={onlyErrors ? "Continue praticando; as questões erradas aparecerão aqui automaticamente." : "Altere os filtros para ver outras questões."}
        />
      )}
    </div>
  );
}
