import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  AlarmClock,
  Ban,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileAudio,
  FileUp,
  FileText,
  GraduationCap,
  Eye,
  Link2,
  Loader2,
  LockKeyhole,
  MonitorUp,
  Paperclip,
  Pencil,
  Plus,
  Radio,
  Save,
  School,
  Trash2,
  User,
  UserCheck,
  Users,
  Video,
  X,
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { fileToFirestoreDataUrl, imageToFirestoreDataUrl, validateFile } from "@/lib/fileValidation";
import { MATERIAS_DISPONIVEIS, MATERIAS_SEM_PROFESSOR } from "@shared/schema";
import { auditEadAction, eadNow, setEadRecord, useEadCollection } from "./store";
import type {
  EadClassSchedule,
  EadClassScheduleContent,
  EadRole,
  EadScheduleAttendance,
  EadScheduleAttendanceMode,
  EadScheduleAudienceType,
  EadScheduleProvider,
  EadScheduledResource,
  EadScheduledResourceAccessMode,
  EadScheduledResourceType,
  EadTeacherPresence,
} from "./types";
import { EmptyState, Field, SectionHeader, StatCard, formatDate } from "./ui";

type TurmaRecord = {
  id: string;
  nome: string;
  ano?: string;
  ativa?: boolean;
};

type StudentRecord = {
  id: string;
  uid?: string;
  nome: string;
  matricula?: string;
  turma?: string;
  tipo?: string;
  ativo?: boolean | string;
};

type MateriaCustomizadaRecord = {
  id: string;
  nome: string;
  requerProfessor?: boolean;
  ativo?: boolean;
};

type ScheduleForm = {
  title: string;
  discipline: string;
  description: string;
  startAt: string;
  releaseAt: string;
  durationMinutes: number;
  audienceType: EadScheduleAudienceType;
  classIds: string[];
  studentId: string;
  provider: EadScheduleProvider;
  roomUrl: string;
  teacherPresence: EadTeacherPresence;
  attendanceMode: EadScheduleAttendanceMode;
};

type ResourceTypeOption = { value: EadScheduledResourceType; label: string };
type ResourceTypeGroup = { label: string; items: ResourceTypeOption[] };

const RESOURCE_TYPE_GROUPS: ResourceTypeGroup[] = [
  {
    label: "Vídeos e transmissões",
    items: [
      { value: "videoaula", label: "Videoaula" },
      { value: "video-gravado", label: "Vídeo gravado" },
      { value: "video-curto", label: "Vídeo curto" },
      { value: "documentario", label: "Documentário" },
      { value: "animacao", label: "Animação" },
      { value: "screencast", label: "Gravação de tela (screencast)" },
      { value: "demonstracao", label: "Demonstração prática" },
      { value: "entrevista-video", label: "Entrevista em vídeo" },
      { value: "webinar-gravado", label: "Webinar gravado" },
      { value: "transmissao-ao-vivo", label: "Transmissão ao vivo" },
      { value: "replay", label: "Reprise ou gravação da aula" },
    ],
  },
  {
    label: "Áudios",
    items: [
      { value: "audioaula", label: "Audioaula" },
      { value: "podcast", label: "Podcast" },
      { value: "audiolivro", label: "Audiolivro" },
      { value: "musica", label: "Música" },
      { value: "entrevista-audio", label: "Entrevista em áudio" },
      { value: "gravacao-audio", label: "Gravação de áudio" },
    ],
  },
  {
    label: "Documentos, leituras e arquivos",
    items: [
      { value: "pdf", label: "Documento PDF" },
      { value: "apostila", label: "Apostila" },
      { value: "livro", label: "Livro" },
      { value: "ebook", label: "Livro digital (e-book)" },
      { value: "capitulo-livro", label: "Capítulo de livro" },
      { value: "artigo", label: "Artigo" },
      { value: "artigo-cientifico", label: "Artigo científico" },
      { value: "resumo", label: "Resumo" },
      { value: "ficha-estudo", label: "Ficha de estudo" },
      { value: "roteiro-estudo", label: "Roteiro de estudo" },
      { value: "guia", label: "Guia" },
      { value: "manual", label: "Manual" },
      { value: "texto", label: "Texto ou leitura" },
      { value: "documento-word", label: "Documento do Word ou similar" },
      { value: "planilha", label: "Planilha" },
      { value: "csv", label: "Tabela em CSV" },
      { value: "formulario-arquivo", label: "Formulário em arquivo" },
      { value: "modelo-arquivo", label: "Modelo para preenchimento" },
      { value: "infografico", label: "Infográfico" },
      { value: "arquivo-compactado", label: "Pacote compactado ZIP" },
    ],
  },
  {
    label: "Apresentações",
    items: [
      { value: "slides", label: "Apresentação de slides" },
      { value: "powerpoint", label: "Apresentação do PowerPoint" },
      { value: "apresentacao-google", label: "Apresentação Google" },
      { value: "prezi", label: "Apresentação Prezi" },
    ],
  },
  {
    label: "Conteúdos digitais e interativos",
    items: [
      { value: "link", label: "Link externo" },
      { value: "site", label: "Site ou página da internet" },
      { value: "plataforma", label: "Plataforma educacional" },
      { value: "simulador", label: "Simulador" },
      { value: "laboratorio-virtual", label: "Laboratório virtual" },
      { value: "jogo-educativo", label: "Jogo educativo" },
      { value: "quiz", label: "Quiz" },
      { value: "questionario", label: "Questionário" },
      { value: "formulario-online", label: "Formulário on-line" },
      { value: "flashcards", label: "Cartões de memorização (flashcards)" },
      { value: "mapa-mental", label: "Mapa mental" },
      { value: "linha-do-tempo", label: "Linha do tempo" },
      { value: "mural", label: "Mural colaborativo" },
      { value: "lousa-digital", label: "Lousa digital" },
      { value: "objeto-3d", label: "Objeto ou modelo 3D" },
      { value: "realidade-aumentada", label: "Realidade aumentada" },
      { value: "realidade-virtual", label: "Realidade virtual" },
    ],
  },
  {
    label: "Aulas, reuniões e comunicação",
    items: [
      { value: "teams", label: "Microsoft Teams" },
      { value: "google-meet", label: "Google Meet" },
      { value: "zoom", label: "Zoom" },
      { value: "webex", label: "Cisco Webex" },
      { value: "chamada", label: "Chamada de voz ou vídeo" },
      { value: "videoconferencia", label: "Videoconferência" },
      { value: "sala-interna", label: "Sala interna do Vestibulando" },
      { value: "transmissao", label: "Outra transmissão" },
      { value: "live-youtube", label: "Transmissão pelo YouTube" },
      { value: "webinar", label: "Webinar ao vivo" },
      { value: "seminario", label: "Seminário" },
      { value: "palestra", label: "Palestra" },
      { value: "oficina", label: "Oficina" },
      { value: "treinamento", label: "Treinamento" },
      { value: "plantao", label: "Plantão de dúvidas" },
      { value: "forum", label: "Fórum" },
      { value: "chat", label: "Chat" },
    ],
  },
  {
    label: "Atividades e avaliações",
    items: [
      { value: "lista-exercicios", label: "Lista de exercícios" },
      { value: "atividade", label: "Atividade" },
      { value: "tarefa", label: "Tarefa" },
      { value: "prova", label: "Prova" },
      { value: "simulado", label: "Simulado" },
      { value: "banco-questoes", label: "Banco de questões" },
      { value: "caderno-erros", label: "Caderno de erros" },
      { value: "rubrica", label: "Rubrica de avaliação" },
      { value: "gabarito", label: "Gabarito" },
      { value: "estudo-caso", label: "Estudo de caso" },
      { value: "projeto", label: "Projeto" },
      { value: "pesquisa", label: "Pesquisa" },
    ],
  },
  {
    label: "Recursos visuais, técnicos e físicos",
    items: [
      { value: "imagem", label: "Imagem" },
      { value: "galeria", label: "Galeria de imagens" },
      { value: "fotografia", label: "Fotografia" },
      { value: "mapa", label: "Mapa" },
      { value: "grafico", label: "Gráfico" },
      { value: "tabela", label: "Tabela" },
      { value: "codigo-fonte", label: "Código-fonte" },
      { value: "software", label: "Programa ou software" },
      { value: "aplicativo", label: "Aplicativo" },
      { value: "material-fisico", label: "Material físico" },
      { value: "biblioteca", label: "Acervo ou biblioteca" },
      { value: "referencia-bibliografica", label: "Referência bibliográfica" },
    ],
  },
  {
    label: "Outros",
    items: [{ value: "outro", label: "Outro tipo personalizado" }],
  },
];

const RESOURCE_TYPES = RESOURCE_TYPE_GROUPS.flatMap((group) => group.items);
const MAX_EMBEDDED_FILE_BYTES = 450 * 1024;
const MAX_EMBEDDED_CONTENT_CHARS = 700_000;

function actorFromUser(userData: any) {
  return userData
    ? { uid: userData.uid, nome: userData.nome || "Usuário", tipo: userData.tipo || "professor" }
    : null;
}

function toLocalDateTime(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function defaultScheduleForm(discipline = ""): ScheduleForm {
  const start = new Date(Date.now() + 60 * 60_000);
  start.setSeconds(0, 0);
  const local = toLocalDateTime(start);
  return {
    title: "",
    discipline,
    description: "",
    startAt: local,
    releaseAt: local,
    durationMinutes: 60,
    audienceType: "turmas",
    classIds: [],
    studentId: "",
    provider: "conteudo",
    roomUrl: "",
    teacherPresence: "obrigatoria",
    attendanceMode: "registrar-entrada",
  };
}

function emptyResource(): EadScheduledResource {
  return {
    id: crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    title: "",
    type: "videoaula",
    accessMode: "link",
    url: "",
    description: "",
    contentText: "",
  };
}

function normalizeTeacherClassIds(userData: any) {
  if (Array.isArray(userData?.turmas)) {
    return userData.turmas.map(String).filter(Boolean);
  }
  if (typeof userData?.turma === "string") {
    return userData.turma.split(",").map((item: string) => item.trim()).filter(Boolean);
  }
  return [] as string[];
}

function normalizeTeacherSubjects(userData: any) {
  if (Array.isArray(userData?.materias)) {
    return userData.materias.map(String).map((item: string) => item.trim()).filter(Boolean);
  }
  return [] as string[];
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isTeamsUrl(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "teams.microsoft.com" || host.endsWith(".teams.microsoft.com") || host === "teams.live.com" || host === "teams.cloud.microsoft";
  } catch {
    return false;
  }
}

function scheduleState(schedule: EadClassSchedule, now = Date.now()) {
  if (schedule.status === "cancelada") return "cancelada" as const;
  const release = new Date(schedule.releaseAt).getTime();
  const start = new Date(schedule.startAt).getTime();
  const end = new Date(schedule.endAt).getTime();
  if (now < release) return "bloqueada" as const;
  if (now >= start && now <= end) return "em-andamento" as const;
  if (now > end) return "concluida" as const;
  return "liberada" as const;
}

function statusLabel(status: ReturnType<typeof scheduleState>) {
  if (status === "bloqueada") return "Programada";
  if (status === "liberada") return "Conteúdo liberado";
  if (status === "em-andamento") return "No horário agora";
  if (status === "concluida") return "Disponível";
  return "Cancelada";
}

function providerLabel(provider: EadScheduleProvider) {
  if (provider === "teams") return "Microsoft Teams";
  if (provider === "interna") return "Sala interna";
  if (provider === "externa") return "Sala externa";
  return "Conteúdos e materiais";
}

function teacherPresenceLabel(value: EadTeacherPresence) {
  if (value === "obrigatoria") return "Professor presente";
  if (value === "opcional") return "Professor opcional";
  return "Atividade sem professor";
}

function resourceIcon(type: EadScheduledResourceType) {
  if (
    type.startsWith("video") ||
    type === "documentario" ||
    type === "animacao" ||
    type === "screencast" ||
    type === "demonstracao" ||
    type.includes("transmissao") ||
    type === "replay" ||
    type === "chamada" ||
    type === "videoconferencia" ||
    type === "teams" ||
    type === "google-meet" ||
    type === "zoom" ||
    type === "webex" ||
    type === "live-youtube" ||
    type === "webinar"
  ) return Video;
  if (type.includes("audio") || type === "podcast" || type === "audiolivro" || type === "musica") return FileAudio;
  if (type === "link" || type === "site" || type === "plataforma") return Link2;
  if (type.includes("livro") || type === "apostila" || type === "ebook" || type === "biblioteca") return BookOpen;
  return FileText;
}

function resourceTypeLabel(type: EadScheduledResourceType, customTypeLabel?: string) {
  if (type === "outro" && customTypeLabel?.trim()) return customTypeLabel.trim();
  return RESOURCE_TYPES.find((item) => item.value === type)?.label || "Material";
}

function resourceAccessMode(resource: EadScheduledResource): EadScheduledResourceAccessMode {
  if (resource.accessMode) return resource.accessMode;
  if (resource.fileDataUrl) return "arquivo";
  if (resource.url) return "link";
  return "sem-link";
}

function dataUrlToBlob(dataUrl: string) {
  const [header, encoded] = dataUrl.split(",", 2);
  if (!header || encoded === undefined) throw new Error("Arquivo incorporado inválido.");
  const mimeMatch = header.match(/^data:([^;,]+)?(;base64)?$/i);
  const mimeType = mimeMatch?.[1] || "application/octet-stream";
  const isBase64 = header.includes(";base64");
  const binary = isBase64 ? atob(encoded) : decodeURIComponent(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

function formatFileSize(bytes?: number) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function normalizeStoredResource(resource: EadScheduledResource | Record<string, any>): EadScheduledResource {
  const legacyTypeMap: Record<string, EadScheduledResourceType> = {
    video: "videoaula",
    audio: "audioaula",
    material: "texto",
  };
  const type = legacyTypeMap[String(resource.type)] || resource.type || "outro";
  return {
    id: resource.id || crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    title: String(resource.title || ""),
    type: type as EadScheduledResourceType,
    accessMode: resource.accessMode || (resource.fileDataUrl ? "arquivo" : resource.url ? "link" : "sem-link"),
    url: String(resource.url || ""),
    description: String(resource.description || ""),
    customTypeLabel: String(resource.customTypeLabel || ""),
    fileDataUrl: resource.fileDataUrl ? String(resource.fileDataUrl) : undefined,
    fileName: resource.fileName ? String(resource.fileName) : undefined,
    fileMimeType: resource.fileMimeType ? String(resource.fileMimeType) : undefined,
    fileSize: typeof resource.fileSize === "number" ? resource.fileSize : undefined,
    contentText: String(resource.contentText || ""),
  };
}

function humanCountdown(releaseAt: string, now: number) {
  const difference = Math.max(0, new Date(releaseAt).getTime() - now);
  const minutes = Math.ceil(difference / 60_000);
  if (minutes <= 1) return "menos de 1 minuto";
  if (minutes < 60) return `${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours < 24) return remaining ? `${hours}h ${remaining}min` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days} dia${days === 1 ? "" : "s"}`;
}

function ScheduleStatusBadge({ schedule, now }: { schedule: EadClassSchedule; now?: number }) {
  const state = scheduleState(schedule, now);
  const className = state === "em-andamento"
    ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
    : state === "cancelada"
      ? "border-muted bg-muted text-muted-foreground"
      : state === "bloqueada"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  return <Badge variant="outline" className={className}>{statusLabel(state)}</Badge>;
}

export function TeacherSchedulePage() {
  const { userData } = useAuth() as any;
  const { toast } = useToast();
  const uid = userData?.uid || "";
  const role = (userData?.tipo || "professor") as EadRole;
  const actor = actorFromUser(userData);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleForm>(() => defaultScheduleForm());
  const [resources, setResources] = useState<EadScheduledResource[]>([emptyResource()]);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [preparingResourceId, setPreparingResourceId] = useState<string | null>(null);
  const [attendanceSchedule, setAttendanceSchedule] = useState<EadClassSchedule | null>(null);

  const turmas = useEadCollection<TurmaRecord>("turmas", {
    filter: (item) => item.ativa !== false,
    sort: (a, b) => a.nome.localeCompare(b.nome),
  });
  const students = useEadCollection<StudentRecord>("usuarios", {
    filter: (item) => item.tipo === "aluno" && item.ativo !== false && item.ativo !== "false",
    sort: (a, b) => a.nome.localeCompare(b.nome),
  });
  const customSubjects = useEadCollection<MateriaCustomizadaRecord>("materiasCustomizadas", {
    filter: (item) => item.ativo !== false && !!item.nome?.trim(),
    sort: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
  });
  const schedules = useEadCollection<EadClassSchedule>("eadClassSchedules", {
    constraints: role === "diretor" ? [] : uid ? [where("teacherId", "==", uid)] : [],
    enabled: role === "diretor" || !!uid,
    sort: (a, b) => b.startAt.localeCompare(a.startAt),
  });
  const attendance = useEadCollection<EadScheduleAttendance>("eadScheduleAttendance", {
    constraints: attendanceSchedule
      ? role === "diretor"
        ? [where("scheduleId", "==", attendanceSchedule.id)]
        : uid
          ? [where("teacherId", "==", uid), where("scheduleId", "==", attendanceSchedule.id)]
          : []
      : [],
    enabled: !!attendanceSchedule && (role === "diretor" || !!uid),
    sort: (a, b) => b.joinedAt.localeCompare(a.joinedAt),
  });

  const assignedClassKeys = useMemo(
    () => role === "diretor"
      ? turmas.data.flatMap((item) => [item.id, item.nome])
      : normalizeTeacherClassIds(userData),
    [role, turmas.data, userData],
  );
  const availableClasses = useMemo(
    () => turmas.data.filter((item) => assignedClassKeys.includes(item.id) || assignedClassKeys.includes(item.nome)),
    [assignedClassKeys, turmas.data],
  );
  const availableClassKeys = useMemo(
    () => Array.from(new Set(availableClasses.flatMap((item) => [item.id, item.nome]))),
    [availableClasses],
  );
  const availableStudents = useMemo(
    () => students.data.filter((item) => !!item.turma && availableClassKeys.includes(item.turma)),
    [availableClassKeys, students.data],
  );
  const allSubjects = useMemo(
    () => Array.from(new Set([
      ...MATERIAS_DISPONIVEIS,
      ...MATERIAS_SEM_PROFESSOR,
      ...customSubjects.data.map((item) => item.nome.trim()),
    ])).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [customSubjects.data],
  );
  const assignedSubjects = useMemo(() => normalizeTeacherSubjects(userData), [userData]);
  const availableSubjects = useMemo(
    () => role === "diretor"
      ? allSubjects
      : allSubjects.filter((subject) => assignedSubjects.includes(subject)),
    [allSubjects, assignedSubjects, role],
  );

  useEffect(() => {
    if (!availableSubjects.length || editingId) return;
    setForm((current) => current.discipline && availableSubjects.includes(current.discipline)
      ? current
      : { ...current, discipline: availableSubjects[0] });
  }, [availableSubjects, editingId]);

  const counts = useMemo(() => {
    const now = Date.now();
    return schedules.data.reduce(
      (result, schedule) => {
        const state = scheduleState(schedule, now);
        if (state === "bloqueada") result.upcoming += 1;
        if (state === "em-andamento") result.live += 1;
        if (state === "liberada" || state === "concluida") result.available += 1;
        if (state === "cancelada") result.cancelled += 1;
        return result;
      },
      { upcoming: 0, live: 0, available: 0, cancelled: 0 },
    );
  }, [schedules.data]);

  const selectedAttendance = useMemo(
    () => attendanceSchedule
      ? attendance.data.filter((item) => item.scheduleId === attendanceSchedule.id)
      : [],
    [attendance.data, attendanceSchedule],
  );

  const resetForm = () => {
    const next = defaultScheduleForm(availableSubjects[0] || "");
    if (availableClasses.length) next.classIds = [availableClasses[0].id];
    setForm(next);
    setResources([emptyResource()]);
    setEditingId(null);
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = async (schedule: EadClassSchedule) => {
    setDialogOpen(true);
    setLoadingEdit(true);
    setEditingId(schedule.id);
    try {
      const contentSnapshot = await getDoc(doc(db, "eadClassScheduleContent", schedule.id));
      const content = contentSnapshot.exists()
        ? ({ id: contentSnapshot.id, ...contentSnapshot.data() } as EadClassScheduleContent)
        : null;
      setForm({
        title: schedule.title,
        discipline: schedule.discipline,
        description: schedule.description,
        startAt: toLocalDateTime(new Date(schedule.startAt)),
        releaseAt: toLocalDateTime(new Date(schedule.releaseAt)),
        durationMinutes: schedule.durationMinutes,
        audienceType: schedule.audienceType,
        classIds: schedule.classIds || [],
        studentId: schedule.studentId || "",
        provider: schedule.provider,
        roomUrl: content?.roomUrl || "",
        teacherPresence: schedule.teacherPresence,
        attendanceMode: schedule.attendanceMode,
      });
      setResources(content?.resources?.length ? content.resources.map(normalizeStoredResource) : [emptyResource()]);
    } catch (error: any) {
      toast({ title: "Não foi possível abrir a programação", description: error.message, variant: "destructive" });
      setDialogOpen(false);
    } finally {
      setLoadingEdit(false);
    }
  };

  const openTeacherRoom = async (schedule: EadClassSchedule) => {
    const opened = window.open("about:blank", "_blank");
    if (!opened) {
      toast({ title: "O navegador bloqueou a nova janela", description: "Permita pop-ups para abrir a sala.", variant: "destructive" });
      return;
    }
    opened.opener = null;
    try {
      const url = schedule.provider === "interna"
        ? "/aula"
        : (await getDoc(doc(db, "eadClassScheduleContent", schedule.id))).data()?.roomUrl;
      if (!url) {
        opened.close();
        toast({ title: "Esta programação não possui uma sala vinculada", variant: "destructive" });
        return;
      }
      opened.location.href = String(url);
    } catch (error: any) {
      opened.close();
      toast({ title: "Não foi possível abrir a sala", description: error.message, variant: "destructive" });
    }
  };

  const updateResource = (id: string, patch: Partial<EadScheduledResource>) => {
    setResources((current) => current.map((resource) => resource.id === id ? { ...resource, ...patch } : resource));
  };

  const changeResourceAccessMode = (id: string, accessMode: EadScheduledResourceAccessMode) => {
    updateResource(id, accessMode === "link"
      ? {
          accessMode,
          fileDataUrl: undefined,
          fileName: undefined,
          fileMimeType: undefined,
          fileSize: undefined,
          contentText: "",
        }
      : accessMode === "arquivo"
        ? { accessMode, url: "", contentText: "" }
        : {
            accessMode,
            url: "",
            fileDataUrl: undefined,
            fileName: undefined,
            fileMimeType: undefined,
            fileSize: undefined,
          });
  };

  const attachResourceFile = async (id: string, file?: File) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".svg")) {
      toast({ title: "Arquivo SVG não permitido", description: "Converta a imagem para PNG, JPG ou PDF antes de anexar.", variant: "destructive" });
      return;
    }
    const validation = validateFile(file, file.type.startsWith("image/") ? 8 * 1024 * 1024 : MAX_EMBEDDED_FILE_BYTES);
    if (!validation.isValid) {
      toast({ title: "Arquivo não aceito", description: validation.error, variant: "destructive" });
      return;
    }
    setPreparingResourceId(id);
    try {
      const dataUrl = file.type.startsWith("image/")
        ? await imageToFirestoreDataUrl(file, 900, 0.62)
        : await fileToFirestoreDataUrl(file, MAX_EMBEDDED_FILE_BYTES);
      if (dataUrl.length > MAX_EMBEDDED_FILE_BYTES * 1.45) {
        throw new Error("Mesmo após a compressão, o arquivo ficou grande demais para o Firestore. Use uma imagem menor ou um link externo.");
      }
      const currentEmbeddedSize = resources.reduce(
        (total, resource) => resource.id === id ? total : total + (resource.fileDataUrl?.length || 0),
        0,
      );
      if (dataUrl.length + currentEmbeddedSize > MAX_EMBEDDED_CONTENT_CHARS) {
        throw new Error("A soma dos arquivos desta programação ficou grande demais para o Firestore. Remova outro anexo ou use um link externo.");
      }
      updateResource(id, {
        accessMode: "arquivo",
        url: "",
        contentText: "",
        fileDataUrl: dataUrl,
        fileName: file.name,
        fileMimeType: file.type || "application/octet-stream",
        fileSize: file.size,
      });
      toast({ title: "Arquivo preparado", description: `${file.name} será salvo no Firestore junto da programação.` });
    } catch (error: any) {
      toast({ title: "Não foi possível preparar o arquivo", description: error.message, variant: "destructive" });
    } finally {
      setPreparingResourceId(null);
    }
  };

  const toggleClass = (classId: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      classIds: checked
        ? Array.from(new Set([...current.classIds, classId]))
        : current.classIds.filter((id) => id !== classId),
    }));
  };

  const buildAudience = () => {
    if (form.audienceType === "todos") {
      return { classIds: [] as string[], classNames: [] as string[], audienceKeys: [] as string[], studentId: "", studentName: "", audienceLabel: "Todos os alunos" };
    }
    if (form.audienceType === "aluno") {
      const student = availableStudents.find((item) => (item.uid || item.id) === form.studentId);
      const studentClass = student?.turma
        ? turmas.data.find((item) => item.id === student.turma || item.nome === student.turma)
        : undefined;
      const classIds = studentClass ? [studentClass.id] : student?.turma ? [student.turma] : [];
      const classNames = studentClass ? [studentClass.nome] : student?.turma ? [student.turma] : [];
      return {
        classIds,
        classNames,
        audienceKeys: Array.from(new Set([...classIds, ...classNames])),
        studentId: form.studentId,
        studentName: student?.nome || "Aluno selecionado",
        audienceLabel: student ? `${student.nome}${student.matricula ? ` · ${student.matricula}` : ""}` : "Aluno selecionado",
      };
    }
    const selectedClasses = availableClasses.filter((item) => form.classIds.includes(item.id));
    const classIds = selectedClasses.map((item) => item.id);
    const classNames = selectedClasses.map((item) => item.nome);
    return {
      classIds,
      classNames,
      audienceKeys: Array.from(new Set([...classIds, ...classNames])),
      studentId: "",
      studentName: "",
      audienceLabel: classNames.join(", ") || "Turmas selecionadas",
    };
  };

  const saveSchedule = async () => {
    if (!uid || !form.title.trim() || !form.description.trim() || !form.startAt || !form.releaseAt) {
      toast({ title: "Preencha título, descrição, data da aula e data de liberação", variant: "destructive" });
      return;
    }
    if (!form.discipline.trim()) {
      toast({ title: "Selecione uma matéria cadastrada pela diretoria", variant: "destructive" });
      return;
    }
    if (role === "professor" && !availableSubjects.includes(form.discipline)) {
      toast({ title: "Matéria não atribuída ao professor", description: "A direção precisa atribuir esta matéria ao seu cadastro antes da programação.", variant: "destructive" });
      return;
    }
    if (form.durationMinutes < 1 || form.durationMinutes > 720) {
      toast({ title: "A duração deve ficar entre 1 e 720 minutos", variant: "destructive" });
      return;
    }
    if (form.audienceType === "todos" && role !== "diretor") {
      toast({ title: "Somente a direção pode programar para toda a escola", variant: "destructive" });
      return;
    }
    if (form.audienceType === "turmas" && !form.classIds.length) {
      toast({ title: "Selecione pelo menos uma turma", variant: "destructive" });
      return;
    }
    if (form.audienceType === "aluno" && !form.studentId) {
      toast({ title: "Selecione o aluno", variant: "destructive" });
      return;
    }

    const startDate = new Date(form.startAt);
    const releaseDate = new Date(form.releaseAt);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(releaseDate.getTime())) {
      toast({ title: "Informe datas válidas", variant: "destructive" });
      return;
    }
    const endDate = new Date(startDate.getTime() + form.durationMinutes * 60_000);

    if ((form.provider === "teams" || form.provider === "externa") && !isHttpUrl(form.roomUrl.trim())) {
      toast({ title: "Informe um link válido para a sala", variant: "destructive" });
      return;
    }
    if (form.provider === "teams" && !isTeamsUrl(form.roomUrl.trim())) {
      toast({ title: "O link informado não é uma reunião válida do Microsoft Teams", variant: "destructive" });
      return;
    }

    const candidateResources = resources.filter((resource) =>
      resource.title.trim() ||
      String(resource.url || "").trim() ||
      !!resource.fileDataUrl ||
      !!resource.contentText?.trim() ||
      !!resource.description?.trim(),
    );
    const validResources: EadScheduledResource[] = [];
    let embeddedContentChars = 0;
    for (const resource of candidateResources) {
      const accessMode = resourceAccessMode(resource);
      const title = resource.title.trim();
      const description = resource.description?.trim() || "";
      const customTypeLabel = resource.customTypeLabel?.trim() || "";
      if (!title) {
        toast({ title: "Informe o nome de todos os materiais", variant: "destructive" });
        return;
      }
      if (resource.type === "outro" && !customTypeLabel) {
        toast({ title: `Informe o tipo personalizado do material “${title}”`, variant: "destructive" });
        return;
      }

      if (accessMode === "link") {
        const url = String(resource.url || "").trim();
        if (!isHttpUrl(url)) {
          toast({ title: `Informe um link válido para “${title}”`, variant: "destructive" });
          return;
        }
        validResources.push({
          id: resource.id,
          title,
          type: resource.type,
          accessMode,
          url,
          description,
          ...(customTypeLabel ? { customTypeLabel } : {}),
        });
        continue;
      }

      if (accessMode === "arquivo") {
        if (!resource.fileDataUrl || !resource.fileName) {
          toast({ title: `Selecione um arquivo para “${title}”`, variant: "destructive" });
          return;
        }
        embeddedContentChars += resource.fileDataUrl.length;
        validResources.push({
          id: resource.id,
          title,
          type: resource.type,
          accessMode,
          description,
          fileDataUrl: resource.fileDataUrl,
          fileName: resource.fileName,
          fileMimeType: resource.fileMimeType || "application/octet-stream",
          ...(typeof resource.fileSize === "number" ? { fileSize: resource.fileSize } : {}),
          ...(customTypeLabel ? { customTypeLabel } : {}),
        });
        continue;
      }

      const contentText = resource.contentText?.trim() || "";
      if (!contentText && !description) {
        toast({ title: `Escreva o conteúdo ou uma orientação para “${title}”`, variant: "destructive" });
        return;
      }
      validResources.push({
        id: resource.id,
        title,
        type: resource.type,
        accessMode,
        description,
        contentText,
        ...(customTypeLabel ? { customTypeLabel } : {}),
      });
    }
    if (embeddedContentChars > MAX_EMBEDDED_CONTENT_CHARS) {
      toast({ title: "Arquivos grandes demais para o Firestore", description: "Remova algum anexo pequeno ou utilize links externos para os arquivos maiores.", variant: "destructive" });
      return;
    }
    if (form.provider === "conteudo" && validResources.length === 0) {
      toast({ title: "Adicione pelo menos um material por link, arquivo pequeno ou conteúdo sem link", variant: "destructive" });
      return;
    }

    const audience = buildAudience();
    setSaving(true);
    try {
      const scheduleReference = editingId
        ? doc(db, "eadClassSchedules", editingId)
        : doc(collection(db, "eadClassSchedules"));
      const contentReference = doc(db, "eadClassScheduleContent", scheduleReference.id);
      const existingCreatedAt = editingId
        ? schedules.data.find((item) => item.id === editingId)?.createdAt || eadNow()
        : eadNow();
      const now = eadNow();
      const batch = writeBatch(db);

      const metadata = {
        title: form.title.trim(),
        discipline: form.discipline,
        description: form.description.trim(),
        teacherId: uid,
        teacherName: userData?.nome || (role === "diretor" ? "Direção" : "Professor"),
        audienceType: form.audienceType,
        classIds: audience.classIds,
        classNames: audience.classNames,
        audienceKeys: audience.audienceKeys,
        ...(audience.studentId ? { studentId: audience.studentId, studentName: audience.studentName } : {}),
        audienceLabel: audience.audienceLabel,
        startAt: startDate.toISOString(),
        releaseAt: releaseDate.toISOString(),
        endAt: endDate.toISOString(),
        startAtTimestamp: Timestamp.fromDate(startDate),
        releaseAtTimestamp: Timestamp.fromDate(releaseDate),
        endAtTimestamp: Timestamp.fromDate(endDate),
        durationMinutes: form.durationMinutes,
        provider: form.provider,
        teacherPresence: form.teacherPresence,
        attendanceMode: form.attendanceMode,
        resourceCount: validResources.length + (form.provider !== "conteudo" ? 1 : 0),
        status: "agendada",
        published: true,
        createdBy: uid,
        createdAt: existingCreatedAt,
        updatedAt: now,
      };
      const content = {
        scheduleId: scheduleReference.id,
        teacherId: uid,
        discipline: form.discipline,
        audienceType: form.audienceType,
        classIds: audience.classIds,
        classNames: audience.classNames,
        audienceKeys: audience.audienceKeys,
        ...(audience.studentId ? { studentId: audience.studentId } : {}),
        releaseAt: releaseDate.toISOString(),
        releaseAtTimestamp: Timestamp.fromDate(releaseDate),
        provider: form.provider,
        ...(form.roomUrl.trim() ? { roomUrl: form.roomUrl.trim() } : {}),
        resources: validResources,
        status: "agendada",
        createdAt: existingCreatedAt,
        updatedAt: now,
      };

      batch.set(scheduleReference, metadata);
      batch.set(contentReference, content);
      await batch.commit();
      await auditEadAction(
        actor,
        editingId ? "atualizar" : "criar",
        "eadClassSchedules",
        scheduleReference.id,
        form.title.trim(),
      );
      toast({
        title: editingId ? "Programação atualizada" : "Aula programada",
        description: `O conteúdo será liberado automaticamente em ${formatDate(releaseDate.toISOString(), true)}.`,
      });
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "Não foi possível salvar a programação", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const cancelSchedule = async (schedule: EadClassSchedule) => {
    const cancelled = schedule.status !== "cancelada";
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "eadClassSchedules", schedule.id), {
        status: cancelled ? "cancelada" : "agendada",
        updatedAt: eadNow(),
      });
      batch.update(doc(db, "eadClassScheduleContent", schedule.id), {
        status: cancelled ? "cancelada" : "agendada",
        updatedAt: eadNow(),
      });
      await batch.commit();
      await auditEadAction(actor, cancelled ? "cancelar" : "reativar", "eadClassSchedules", schedule.id, schedule.title);
      toast({ title: cancelled ? "Programação cancelada" : "Programação reativada" });
    } catch (error: any) {
      toast({ title: "Não foi possível alterar a programação", description: error.message, variant: "destructive" });
    }
  };

  const deleteSchedule = async (schedule: EadClassSchedule) => {
    if (!window.confirm(`Excluir definitivamente a programação “${schedule.title}”?`)) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "eadClassSchedules", schedule.id));
      batch.delete(doc(db, "eadClassScheduleContent", schedule.id));
      await batch.commit();
      await auditEadAction(actor, "excluir", "eadClassSchedules", schedule.id, schedule.title);
      toast({ title: "Programação excluída" });
    } catch (error: any) {
      toast({ title: "Não foi possível excluir", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Programação pedagógica"
        title="Aulas e conteúdos programados"
        description="Defina turma ou aluno, horário de liberação, presença do professor, sala do Microsoft Teams e todos os materiais envolvidos."
        action={<Button onClick={openNew} disabled={role === "professor" && (!availableClasses.length || !availableSubjects.length)}><CalendarClock className="mr-2 h-4 w-4" />Programar aula</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Programadas" value={counts.upcoming} icon={AlarmClock} />
        <StatCard label="No horário" value={counts.live} icon={Radio} tone={counts.live ? "danger" : "primary"} />
        <StatCard label="Liberadas" value={counts.available} icon={CheckCircle2} tone="success" />
        <StatCard label="Canceladas" value={counts.cancelled} icon={Ban} />
      </div>

      {role === "professor" && availableClasses.length === 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base">Nenhuma turma vinculada ao professor</CardTitle>
            <CardDescription>A direção precisa vincular pelo menos uma turma ao seu cadastro antes de permitir uma programação direcionada.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {role === "professor" && availableSubjects.length === 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base">Nenhuma matéria atribuída ao professor</CardTitle>
            <CardDescription>A direção precisa selecionar as matérias do professor. As matérias padrão e as personalizadas cadastradas pela diretoria passam a aparecer automaticamente após a atribuição.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Como funciona a liberação</CardTitle>
          <CardDescription>O aluno vê a programação antecipadamente, mas os links da sala, vídeos, PDFs, apostilas e demais materiais ficam protegidos no Firestore até o horário definido.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border p-4"><LockKeyhole className="mb-3 h-5 w-5 text-primary" /><p className="font-semibold">Antes do horário</p><p className="mt-1 text-sm text-muted-foreground">Aparecem apenas título, professor, turma, disciplina e data.</p></div>
          <div className="rounded-xl border p-4"><Clock3 className="mb-3 h-5 w-5 text-primary" /><p className="font-semibold">Na hora programada</p><p className="mt-1 text-sm text-muted-foreground">A sala e os materiais são liberados automaticamente aos envolvidos.</p></div>
          <div className="rounded-xl border p-4"><MonitorUp className="mb-3 h-5 w-5 text-primary" /><p className="font-semibold">Microsoft Teams</p><p className="mt-1 text-sm text-muted-foreground">O link da reunião abre o Teams para aula, treinamento, áudio, vídeo e compartilhamento de tela.</p></div>
        </CardContent>
      </Card>

      {schedules.loading ? (
        <div className="flex justify-center py-14"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : schedules.data.length ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {schedules.data.map((schedule) => (
            <Card key={schedule.id} className={schedule.status === "cancelada" ? "opacity-70" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl bg-primary/10 p-3 text-primary">
                    {schedule.provider === "teams" ? <MonitorUp className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}
                  </div>
                  <ScheduleStatusBadge schedule={schedule} />
                </div>
                <CardTitle className="pt-2">{schedule.title}</CardTitle>
                <CardDescription>{schedule.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div className="rounded-lg bg-muted p-3"><CalendarClock className="mb-1 h-4 w-4 text-primary" />Aula: {formatDate(schedule.startAt, true)}</div>
                  <div className="rounded-lg bg-muted p-3"><LockKeyhole className="mb-1 h-4 w-4 text-primary" />Liberação: {formatDate(schedule.releaseAt, true)}</div>
                  <div className="rounded-lg bg-muted p-3"><Users className="mb-1 h-4 w-4 text-primary" />{schedule.audienceLabel}</div>
                  <div className="rounded-lg bg-muted p-3"><Video className="mb-1 h-4 w-4 text-primary" />{providerLabel(schedule.provider)} · {schedule.resourceCount} acesso(s)</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{schedule.discipline}</Badge>
                  <Badge variant="outline">{teacherPresenceLabel(schedule.teacherPresence)}</Badge>
                  <Badge variant="outline">{schedule.durationMinutes} min</Badge>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {schedule.provider !== "conteudo" && <Button size="sm" onClick={() => void openTeacherRoom(schedule)}><ExternalLink className="mr-2 h-4 w-4" />Abrir sala</Button>}
                  <Button variant="outline" size="sm" onClick={() => setAttendanceSchedule(schedule)}><UserCheck className="mr-2 h-4 w-4" />Participações</Button>
                  <Button variant="outline" size="sm" onClick={() => void openEdit(schedule)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                  <Button variant="outline" size="sm" onClick={() => void cancelSchedule(schedule)}>{schedule.status === "cancelada" ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Ban className="mr-2 h-4 w-4" />}{schedule.status === "cancelada" ? "Reativar" : "Cancelar"}</Button>
                  <Button variant="destructive" size="sm" onClick={() => void deleteSchedule(schedule)}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhuma aula programada" description="Cadastre a primeira programação para liberar conteúdos automaticamente por turma ou aluno." icon={CalendarClock} action={<Button onClick={openNew} disabled={role === "professor" && (!availableClasses.length || !availableSubjects.length)}><Plus className="mr-2 h-4 w-4" />Criar programação</Button>} />
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar programação" : "Programar nova aula"}</DialogTitle>
            <DialogDescription>Os links e materiais somente serão entregues ao público selecionado quando chegar o horário de liberação.</DialogDescription>
          </DialogHeader>
          {loadingEdit ? (
            <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-7 py-2">
              <section className="space-y-4">
                <div><h3 className="font-bold">1. Identificação e horário</h3><p className="text-sm text-muted-foreground">Organize a aula conforme a programação pedagógica.</p></div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Título" htmlFor="schedule-title" required><Input id="schedule-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Funções do 1º grau" /></Field>
                  <Field label="Matéria cadastrada pela diretoria" htmlFor="schedule-discipline" required>
                    <Select value={form.discipline} onValueChange={(value) => setForm((current) => ({ ...current, discipline: value }))} disabled={!allSubjects.length}>
                      <SelectTrigger id="schedule-discipline"><SelectValue placeholder={availableSubjects.length ? "Selecione a matéria" : "Nenhuma matéria atribuída"} /></SelectTrigger>
                      <SelectContent>
                        {allSubjects.map((item) => {
                          const assigned = role === "diretor" || availableSubjects.includes(item);
                          return <SelectItem key={item} value={item} disabled={!assigned}>{item}{assigned ? "" : " — não atribuída ao professor"}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {role === "diretor"
                        ? `${allSubjects.length} matéria(s) ativa(s), incluindo as matérias personalizadas cadastradas pela diretoria.`
                        : `${availableSubjects.length} de ${allSubjects.length} matéria(s) ativa(s) foram atribuídas ao seu cadastro pela diretoria. As demais aparecem na lista como indisponíveis.`}
                    </p>
                  </Field>
                  <Field label="Data e hora da aula" htmlFor="schedule-start" required><Input id="schedule-start" type="datetime-local" value={form.startAt} onChange={(event) => setForm((current) => ({ ...current, startAt: event.target.value, releaseAt: current.releaseAt || event.target.value }))} /></Field>
                  <Field label="Liberar conteúdo em" htmlFor="schedule-release" required><Input id="schedule-release" type="datetime-local" value={form.releaseAt} onChange={(event) => setForm((current) => ({ ...current, releaseAt: event.target.value }))} /></Field>
                  <Field label="Duração prevista (minutos)" htmlFor="schedule-duration"><Input id="schedule-duration" type="number" min={1} max={720} value={form.durationMinutes} onChange={(event) => setForm((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} /></Field>
                  <Field label="Presença do professor" htmlFor="schedule-teacher-presence"><Select value={form.teacherPresence} onValueChange={(value: EadTeacherPresence) => setForm((current) => ({ ...current, teacherPresence: value }))}><SelectTrigger id="schedule-teacher-presence"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="obrigatoria">Professor obrigatório</SelectItem><SelectItem value="opcional">Professor opcional</SelectItem><SelectItem value="sem-professor">Sem professor — estudo autônomo</SelectItem></SelectContent></Select></Field>
                  <div className="md:col-span-2"><Field label="Descrição e orientações" htmlFor="schedule-description" required><Textarea id="schedule-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Objetivos, instruções e o que o aluno deverá fazer." /></Field></div>
                </div>
              </section>

              <section className="space-y-4 border-t pt-6">
                <div><h3 className="font-bold">2. Quem receberá</h3><p className="text-sm text-muted-foreground">Professores só podem selecionar as turmas vinculadas ao próprio cadastro.</p></div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Público" htmlFor="schedule-audience"><Select value={form.audienceType} onValueChange={(value: EadScheduleAudienceType) => setForm((current) => ({ ...current, audienceType: value }))}><SelectTrigger id="schedule-audience"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="turmas">Uma ou mais turmas</SelectItem><SelectItem value="aluno">Um aluno específico</SelectItem>{role === "diretor" && <SelectItem value="todos">Todos os alunos</SelectItem>}</SelectContent></Select></Field>
                  <Field label="Controle de participação" htmlFor="schedule-attendance"><Select value={form.attendanceMode} onValueChange={(value: EadScheduleAttendanceMode) => setForm((current) => ({ ...current, attendanceMode: value }))}><SelectTrigger id="schedule-attendance"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="registrar-entrada">Registrar entrada ao abrir</SelectItem><SelectItem value="nao-controlar">Não controlar presença</SelectItem></SelectContent></Select></Field>
                </div>
                {form.audienceType === "turmas" && (
                  <div className="grid gap-2 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3">
                    {availableClasses.map((turma) => (
                      <label key={turma.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-muted">
                        <Checkbox checked={form.classIds.includes(turma.id)} onCheckedChange={(checked) => toggleClass(turma.id, checked === true)} />
                        <span className="text-sm"><strong>{turma.nome}</strong>{turma.ano ? <span className="block text-xs text-muted-foreground">{turma.ano}</span> : null}</span>
                      </label>
                    ))}
                    {!availableClasses.length && <p className="text-sm text-muted-foreground">Nenhuma turma disponível.</p>}
                  </div>
                )}
                {form.audienceType === "aluno" && (
                  <Field label="Aluno" htmlFor="schedule-student"><Select value={form.studentId} onValueChange={(value) => setForm((current) => ({ ...current, studentId: value }))}><SelectTrigger id="schedule-student"><SelectValue placeholder="Selecione o aluno" /></SelectTrigger><SelectContent>{availableStudents.map((student) => <SelectItem key={student.uid || student.id} value={student.uid || student.id}>{student.nome}{student.matricula ? ` · ${student.matricula}` : ""}</SelectItem>)}</SelectContent></Select></Field>
                )}
              </section>

              <section className="space-y-4 border-t pt-6">
                <div><h3 className="font-bold">3. Sala de aula e Microsoft Teams</h3><p className="text-sm text-muted-foreground">Escolha onde a atividade acontecerá. O link fica oculto dos alunos antes da liberação.</p></div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Forma de acesso" htmlFor="schedule-provider"><Select value={form.provider} onValueChange={(value: EadScheduleProvider) => setForm((current) => ({ ...current, provider: value, roomUrl: value === "interna" || value === "conteudo" ? "" : current.roomUrl }))}><SelectTrigger id="schedule-provider"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="conteudo">Somente conteúdos e materiais</SelectItem><SelectItem value="teams">Microsoft Teams</SelectItem><SelectItem value="interna">Sala interna do Vestibulando</SelectItem><SelectItem value="externa">Outra sala/transmissão externa</SelectItem></SelectContent></Select></Field>
                  {(form.provider === "teams" || form.provider === "externa") && <Field label={form.provider === "teams" ? "Link da reunião do Teams" : "Link da sala/transmissão"} htmlFor="schedule-room" required><Input id="schedule-room" type="url" value={form.roomUrl} onChange={(event) => setForm((current) => ({ ...current, roomUrl: event.target.value }))} placeholder={form.provider === "teams" ? "https://teams.microsoft.com/l/meetup-join/..." : "https://..."} /></Field>}
                </div>
                {form.provider === "teams" && (
                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="rounded-xl bg-blue-600 p-3 text-white"><MonitorUp className="h-6 w-6" /></div>
                      <div className="flex-1"><p className="font-semibold">Integração com Microsoft Teams</p><p className="mt-1 text-sm text-muted-foreground">Crie a reunião no Teams, habilite as opções desejadas de apresentação e cole o link acima. No horário, o botão para entrar será liberado somente ao público selecionado.</p></div>
                      <Button asChild type="button" variant="outline"><a href="https://teams.microsoft.com/" target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Abrir Teams</a></Button>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-4 border-t pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold">4. Materiais e recursos educacionais</h3>
                    <p className="text-sm text-muted-foreground">Escolha entre dezenas de tipos em português do Brasil. O material pode usar link, arquivo pequeno no Firestore ou conteúdo sem link. Arquivos grandes continuam por link externo.</p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => setResources((current) => [...current, emptyResource()])}><Plus className="mr-2 h-4 w-4" />Adicionar material</Button>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                  <p className="font-semibold">Sem Firebase Storage</p>
                  <p className="mt-1 text-muted-foreground">PDF, slides, documentos, imagens e outros arquivos pequenos podem ser anexados diretamente, até 450 KB cada e dentro do limite total da programação. Para vídeo, áudio ou arquivo maior, informe um link externo.</p>
                </div>
                <div className="space-y-4">
                  {resources.map((resource, index) => {
                    const accessMode = resourceAccessMode(resource);
                    return (
                      <div key={resource.id} className="rounded-xl border p-4">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <p className="font-semibold">Material {index + 1}</p>
                            <p className="text-xs text-muted-foreground">{resourceTypeLabel(resource.type, resource.customTypeLabel)}</p>
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => setResources((current) => current.length === 1 ? [emptyResource()] : current.filter((item) => item.id !== resource.id))} aria-label="Remover material"><X className="h-4 w-4" /></Button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Tipo de material" htmlFor={`resource-type-${resource.id}`}>
                            <Select value={resource.type} onValueChange={(value: EadScheduledResourceType) => updateResource(resource.id, { type: value, customTypeLabel: value === "outro" ? resource.customTypeLabel : "" })}>
                              <SelectTrigger id={`resource-type-${resource.id}`}><SelectValue /></SelectTrigger>
                              <SelectContent className="max-h-[70vh]">
                                {RESOURCE_TYPE_GROUPS.map((group) => (
                                  <SelectGroup key={group.label}>
                                    <SelectLabel>{group.label}</SelectLabel>
                                    {group.items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                                    <SelectSeparator />
                                  </SelectGroup>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field label="Nome do material" htmlFor={`resource-title-${resource.id}`} required><Input id={`resource-title-${resource.id}`} value={resource.title} onChange={(event) => updateResource(resource.id, { title: event.target.value })} placeholder="Ex.: Slides — Introdução à genética" /></Field>

                          {resource.type === "outro" && (
                            <div className="md:col-span-2"><Field label="Nome do tipo personalizado" htmlFor={`resource-custom-type-${resource.id}`} required><Input id={`resource-custom-type-${resource.id}`} value={resource.customTypeLabel || ""} onChange={(event) => updateResource(resource.id, { customTypeLabel: event.target.value })} placeholder="Ex.: Kit de experimento doméstico" /></Field></div>
                          )}

                          <div className="md:col-span-2">
                            <Field label="Como disponibilizar" htmlFor={`resource-access-${resource.id}`}>
                              <Select value={accessMode} onValueChange={(value: EadScheduledResourceAccessMode) => changeResourceAccessMode(resource.id, value)}>
                                <SelectTrigger id={`resource-access-${resource.id}`}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="link">Link externo</SelectItem>
                                  <SelectItem value="arquivo">Anexar arquivo pequeno no Firestore</SelectItem>
                                  <SelectItem value="sem-link">Sem link — texto, orientação ou material físico</SelectItem>
                                </SelectContent>
                              </Select>
                            </Field>
                          </div>

                          {accessMode === "link" && (
                            <div className="md:col-span-2"><Field label="Link externo" htmlFor={`resource-url-${resource.id}`} required><Input id={`resource-url-${resource.id}`} type="url" value={resource.url || ""} onChange={(event) => updateResource(resource.id, { url: event.target.value })} placeholder="https://..." /></Field></div>
                          )}

                          {accessMode === "arquivo" && (
                            <div className="md:col-span-2 space-y-3">
                              <Field label="Arquivo pequeno" htmlFor={`resource-file-${resource.id}`} required>
                                <label htmlFor={`resource-file-${resource.id}`} className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-5 text-center transition hover:border-primary/50 hover:bg-primary/5">
                                  {preparingResourceId === resource.id ? <Loader2 className="mb-2 h-6 w-6 animate-spin text-primary" /> : <FileUp className="mb-2 h-6 w-6 text-primary" />}
                                  <span className="font-medium">{preparingResourceId === resource.id ? "Preparando arquivo..." : "Selecionar PDF, slides, documento, imagem ou outro arquivo"}</span>
                                  <span className="mt-1 text-xs text-muted-foreground">Máximo de 450 KB. Imagens são comprimidas automaticamente.</span>
                                </label>
                                <Input
                                  id={`resource-file-${resource.id}`}
                                  className="sr-only"
                                  type="file"
                                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.odt,.ods,.odp,.jpg,.jpeg,.png,.gif,.bmp,.webp,.mp3,.wav,.ogg,.m4a,.flac,.aac,.mp4,.avi,.mov,.wmv,.flv,.webm,.mkv,.zip"
                                  disabled={preparingResourceId === resource.id}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = "";
                                    void attachResourceFile(resource.id, file);
                                  }}
                                />
                              </Field>
                              {resource.fileDataUrl && resource.fileName && (
                                <div className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <span className="rounded-lg bg-primary/10 p-2 text-primary"><Paperclip className="h-4 w-4" /></span>
                                    <div className="min-w-0"><p className="truncate font-medium">{resource.fileName}</p><p className="text-xs text-muted-foreground">{formatFileSize(resource.fileSize)} · salvo no Firestore após confirmar</p></div>
                                  </div>
                                  <Button type="button" size="sm" variant="outline" onClick={() => updateResource(resource.id, { fileDataUrl: undefined, fileName: undefined, fileMimeType: undefined, fileSize: undefined })}><Trash2 className="mr-2 h-4 w-4" />Remover arquivo</Button>
                                </div>
                              )}
                            </div>
                          )}

                          {accessMode === "sem-link" && (
                            <div className="md:col-span-2"><Field label="Conteúdo ou instrução sem link" htmlFor={`resource-content-${resource.id}`} required><Textarea id={`resource-content-${resource.id}`} value={resource.contentText || ""} onChange={(event) => updateResource(resource.id, { contentText: event.target.value })} placeholder="Escreva o conteúdo, a orientação, a referência do livro físico, o local de retirada do material ou o que o aluno deverá fazer." className="min-h-28" /></Field></div>
                          )}

                          <div className="md:col-span-2"><Field label="Descrição complementar (opcional)" htmlFor={`resource-description-${resource.id}`}><Textarea id={`resource-description-${resource.id}`} value={resource.description || ""} onChange={(event) => updateResource(resource.id, { description: event.target.value })} placeholder="Explique como usar este material, páginas, capítulos, prazo ou observações." /></Field></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
          <DialogFooter className="mt-4 border-t pt-5">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void saveSchedule()} disabled={saving || loadingEdit || !!preparingResourceId}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{editingId ? "Salvar alterações" : "Programar aula"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!attendanceSchedule} onOpenChange={(open) => { if (!open) setAttendanceSchedule(null); }}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Participações na programação</DialogTitle>
            <DialogDescription>
              {attendanceSchedule ? `${attendanceSchedule.title} · ${attendanceSchedule.audienceLabel}` : "Aula programada"}
            </DialogDescription>
          </DialogHeader>
          {attendance.loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : selectedAttendance.length ? (
            <div className="space-y-3">
              {selectedAttendance.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{entry.ownerName}</p>
                    <p className="text-sm text-muted-foreground">Entrada em {formatDate(entry.joinedAt, true)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{entry.source === "teams" ? "Microsoft Teams" : entry.source === "interna" ? "Sala interna" : entry.source === "externa" ? "Sala externa" : "Material"}</Badge>
                    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Presença registrada</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhuma entrada registrada" description="As participações aparecem aqui quando os alunos abrem a sala ou um material, caso o controle de participação esteja ativado." icon={UserCheck} />
          )}
          {attendance.error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Não foi possível carregar as participações: {attendance.error}</p>}
          <DialogFooter><Button variant="outline" onClick={() => setAttendanceSchedule(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function useStudentSchedules(uid: string, classKey: string) {
  const everyone = useEadCollection<EadClassSchedule>("eadClassSchedules", {
    constraints: [where("audienceType", "==", "todos")],
    enabled: !!uid,
  });
  const classes = useEadCollection<EadClassSchedule>("eadClassSchedules", {
    constraints: classKey
      ? [where("audienceType", "==", "turmas"), where("audienceKeys", "array-contains", classKey)]
      : [],
    enabled: !!uid && !!classKey,
  });
  const individual = useEadCollection<EadClassSchedule>("eadClassSchedules", {
    constraints: uid
      ? [where("audienceType", "==", "aluno"), where("studentId", "==", uid)]
      : [],
    enabled: !!uid,
  });

  const data = useMemo(() => {
    const map = new Map<string, EadClassSchedule>();
    [...everyone.data, ...classes.data, ...individual.data].forEach((item) => map.set(item.id, item));
    return Array.from(map.values()).sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [classes.data, everyone.data, individual.data]);

  return {
    data,
    loading: everyone.loading || classes.loading || individual.loading,
    error: everyone.error || classes.error || individual.error,
  };
}

function useReleasedScheduleContent(scheduleIds: string[]) {
  const [contents, setContents] = useState<Record<string, EadClassScheduleContent>>({});
  const key = [...scheduleIds].sort().join("|");

  useEffect(() => {
    const allowed = new Set(scheduleIds);
    let active = true;
    const unsubscribes: Array<() => void> = [];
    const retryTimers: number[] = [];

    setContents((current) => Object.fromEntries(Object.entries(current).filter(([id]) => allowed.has(id))));

    const subscribe = (scheduleId: string) => {
      if (!active) return;
      const unsubscribe = onSnapshot(
        doc(db, "eadClassScheduleContent", scheduleId),
        (snapshot) => {
          if (!snapshot.exists()) return;
          setContents((current) => ({
            ...current,
            [scheduleId]: { id: snapshot.id, ...snapshot.data() } as EadClassScheduleContent,
          }));
        },
        (error) => {
          if (!active) return;
          if (error.code === "permission-denied") {
            retryTimers.push(window.setTimeout(() => subscribe(scheduleId), 5_000));
            return;
          }
          console.error("Erro ao carregar conteúdo programado:", error);
        },
      );
      unsubscribes.push(unsubscribe);
    };

    scheduleIds.forEach(subscribe);
    return () => {
      active = false;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
      retryTimers.forEach((timer) => window.clearTimeout(timer));
    };
    // IDs are represented by a stable sorted key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return contents;
}

export function StudentSchedulePage() {
  const { userData } = useAuth() as any;
  const { toast } = useToast();
  const uid = userData?.uid || "";
  const classKey = userData?.turma || "";
  const actor = actorFromUser(userData);
  const [now, setNow] = useState(Date.now());
  const schedules = useStudentSchedules(uid, classKey);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const visibleSchedules = schedules.data.filter((item) => item.published !== false);
  const releasedIds = visibleSchedules
    .filter((item) => item.status !== "cancelada" && now >= new Date(item.releaseAt).getTime())
    .map((item) => item.id);
  const contents = useReleasedScheduleContent(releasedIds);

  const current = visibleSchedules.filter((item) => scheduleState(item, now) === "em-andamento");
  const available = visibleSchedules.filter((item) => {
    const state = scheduleState(item, now);
    return state === "liberada" || state === "concluida";
  });
  const upcoming = visibleSchedules.filter((item) => scheduleState(item, now) === "bloqueada");

  const registerEntry = async (schedule: EadClassSchedule, source: EadScheduleProvider) => {
    if (schedule.attendanceMode !== "registrar-entrada" || !uid) return;
    try {
      await setEadRecord(
        "eadScheduleAttendance",
        `${schedule.id}_${uid}`,
        {
          scheduleId: schedule.id,
          scheduleTitle: schedule.title,
          ownerId: uid,
          ownerName: userData?.nome || "Aluno",
          teacherId: schedule.teacherId,
          joinedAt: eadNow(),
          status: "presente",
          source,
        },
        actor,
        `Entrada: ${schedule.title}`,
      );
    } catch (error) {
      console.warn("Não foi possível registrar a entrada:", error);
    }
  };

  const openAccess = async (schedule: EadClassSchedule, url: string, source: EadScheduleProvider) => {
    const opened = window.open(url, "_blank");
    if (!opened) {
      toast({ title: "O navegador bloqueou a nova janela", description: "Permita pop-ups para abrir a aula ou o material.", variant: "destructive" });
      return;
    }
    opened.opener = null;
    await registerEntry(schedule, source);
  };

  const openEmbeddedFile = async (schedule: EadClassSchedule, resource: EadScheduledResource) => {
    if (!resource.fileDataUrl) {
      toast({ title: "Arquivo indisponível", description: "O professor precisa anexar novamente este material.", variant: "destructive" });
      return;
    }
    try {
      const blob = dataUrlToBlob(resource.fileDataUrl);
      const objectUrl = URL.createObjectURL(blob);
      const mimeType = resource.fileMimeType || blob.type || "application/octet-stream";
      const previewable = mimeType === "application/pdf" || mimeType.startsWith("image/") || mimeType.startsWith("audio/") || mimeType.startsWith("video/") || mimeType.startsWith("text/");
      if (previewable) {
        const opened = window.open(objectUrl, "_blank");
        if (!opened) {
          URL.revokeObjectURL(objectUrl);
          toast({ title: "O navegador bloqueou a nova janela", description: "Permita pop-ups para visualizar o arquivo.", variant: "destructive" });
          return;
        }
        opened.opener = null;
      } else {
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = resource.fileName || resource.title || "material";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      await registerEntry(schedule, "conteudo");
    } catch (error: any) {
      toast({ title: "Não foi possível abrir o arquivo", description: error.message, variant: "destructive" });
    }
  };

  const renderReleasedCard = (schedule: EadClassSchedule, emphasis = false) => {
    const content = contents[schedule.id];
    const state = scheduleState(schedule, now);
    const canJoinRoom = schedule.status !== "cancelada" && now >= new Date(schedule.startAt).getTime();
    return (
      <Card key={schedule.id} className={emphasis ? "border-rose-500/40 bg-rose-500/5" : ""}>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className={`rounded-xl p-3 ${emphasis ? "bg-rose-600 text-white" : "bg-primary/10 text-primary"}`}>
              {schedule.provider === "teams" ? <MonitorUp className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}
            </div>
            <ScheduleStatusBadge schedule={schedule} now={now} />
          </div>
          <CardTitle className="pt-2">{schedule.title}</CardTitle>
          <CardDescription>{schedule.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-lg bg-muted p-3"><Clock3 className="mb-1 h-4 w-4 text-primary" />{formatDate(schedule.startAt, true)} · {schedule.durationMinutes} min</div>
            <div className="rounded-lg bg-muted p-3"><User className="mb-1 h-4 w-4 text-primary" />{teacherPresenceLabel(schedule.teacherPresence)}</div>
          </div>
          <div className="flex flex-wrap gap-2"><Badge variant="outline">{schedule.discipline}</Badge><Badge variant="outline">{providerLabel(schedule.provider)}</Badge><Badge variant="outline">{schedule.teacherName}</Badge></div>

          {!content ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Liberando sala e materiais com segurança...</div>
          ) : (
            <div className="space-y-3">
              {schedule.provider === "teams" && content.roomUrl && (
                <Button className="w-full bg-blue-600 hover:bg-blue-700" disabled={!canJoinRoom} onClick={() => void openAccess(schedule, content.roomUrl!, "teams")}><MonitorUp className="mr-2 h-4 w-4" />{canJoinRoom ? "Entrar pelo Microsoft Teams" : "Teams disponível no início da aula"}</Button>
              )}
              {schedule.provider === "externa" && content.roomUrl && (
                <Button className="w-full" disabled={!canJoinRoom} onClick={() => void openAccess(schedule, content.roomUrl!, "externa")}><Radio className="mr-2 h-4 w-4" />{canJoinRoom ? "Abrir transmissão/sala" : "Sala disponível no início da aula"}</Button>
              )}
              {schedule.provider === "interna" && (
                <Button className="w-full" disabled={!canJoinRoom} onClick={() => void openAccess(schedule, "/aula", "interna")}><Video className="mr-2 h-4 w-4" />{canJoinRoom ? "Abrir sala interna" : "Sala disponível no início da aula"}</Button>
              )}
              {(content.resources || []).map(normalizeStoredResource).map((resource) => {
                const Icon = resourceIcon(resource.type);
                const mode = resourceAccessMode(resource);
                const typeLabel = resourceTypeLabel(resource.type, resource.customTypeLabel);
                if (mode === "sem-link") {
                  return (
                    <details
                      key={resource.id}
                      className="group rounded-xl border p-4 open:border-primary/40 open:bg-primary/5"
                      onToggle={(event) => { if (event.currentTarget.open) void registerEntry(schedule, "conteudo"); }}
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-3">
                        <span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1"><strong className="block truncate">{resource.title}</strong><span className="mt-0.5 block text-xs text-muted-foreground">{resource.description || typeLabel} · sem link</span></span>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </summary>
                      <div className="mt-4 whitespace-pre-wrap rounded-lg bg-background p-4 text-sm leading-relaxed">{resource.contentText || resource.description || "Consulte as orientações do professor."}</div>
                    </details>
                  );
                }
                return (
                  <button
                    key={resource.id}
                    type="button"
                    onClick={() => mode === "arquivo"
                      ? void openEmbeddedFile(schedule, resource)
                      : void openAccess(schedule, String(resource.url || ""), "conteudo")}
                    className="flex w-full items-center gap-3 rounded-xl border p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate">{resource.title}</strong>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {resource.description || typeLabel}
                        {mode === "arquivo" && resource.fileName ? ` · ${resource.fileName} · ${formatFileSize(resource.fileSize)}` : ""}
                      </span>
                    </span>
                    {mode === "arquivo" ? <Download className="h-4 w-4 text-muted-foreground" /> : <ExternalLink className="h-4 w-4 text-muted-foreground" />}
                  </button>
                );
              })}
              {!content.roomUrl && !(content.resources || []).length && <p className="rounded-lg border p-4 text-sm text-muted-foreground">O professor ainda não adicionou acessos a esta programação.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Minha programação"
        title="Aulas e conteúdos liberados para você"
        description="Acompanhe a agenda da sua turma. Vídeos, PDFs, áudios, apostilas, links e salas do Microsoft Teams aparecem automaticamente no horário definido."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="No horário agora" value={current.length} icon={Radio} tone={current.length ? "danger" : "primary"} />
        <StatCard label="Conteúdos disponíveis" value={available.length} icon={CheckCircle2} tone="success" />
        <StatCard label="Próximas liberações" value={upcoming.length} icon={AlarmClock} />
      </div>

      {current.length > 0 && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-rose-600"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />Acontecendo agora</h2>
          <div className="grid gap-5 xl:grid-cols-2">{current.map((schedule) => renderReleasedCard(schedule, true))}</div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold">Próximas aulas e liberações</h2>
          <div className="grid gap-5 xl:grid-cols-2">
            {upcoming.map((schedule) => (
              <Card key={schedule.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3"><div className="rounded-xl bg-amber-500/10 p-3 text-amber-700"><LockKeyhole className="h-5 w-5" /></div><ScheduleStatusBadge schedule={schedule} now={now} /></div>
                  <CardTitle className="pt-2">{schedule.title}</CardTitle>
                  <CardDescription>{schedule.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 text-sm"><div className="rounded-lg bg-muted p-3"><CalendarClock className="mb-1 h-4 w-4 text-primary" />{formatDate(schedule.startAt, true)}</div><div className="rounded-lg bg-muted p-3"><AlarmClock className="mb-1 h-4 w-4 text-primary" />Libera em {humanCountdown(schedule.releaseAt, now)}</div></div>
                  <div className="flex flex-wrap gap-2"><Badge variant="outline">{schedule.discipline}</Badge><Badge variant="outline">{providerLabel(schedule.provider)}</Badge><Badge variant="outline">{teacherPresenceLabel(schedule.teacherPresence)}</Badge></div>
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"><LockKeyhole className="mr-2 inline h-4 w-4" />Os links e arquivos ficam protegidos até {formatDate(schedule.releaseAt, true)}.</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {available.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold">Conteúdos já liberados</h2>
          <div className="grid gap-5 xl:grid-cols-2">{available.map((schedule) => renderReleasedCard(schedule))}</div>
        </section>
      )}

      {schedules.loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : visibleSchedules.length === 0 ? (
        <EmptyState title="Nenhuma programação para você" description="Quando o professor ou a direção agendar uma aula para sua turma, ela aparecerá nesta página." icon={School} />
      ) : null}

      {schedules.error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Não foi possível carregar toda a programação: {schedules.error}</p>}
    </div>
  );
}

export function ScheduledLearningPage() {
  const { userData } = useAuth() as any;
  return userData?.tipo === "aluno" ? <StudentSchedulePage /> : <TeacherSchedulePage />;
}
