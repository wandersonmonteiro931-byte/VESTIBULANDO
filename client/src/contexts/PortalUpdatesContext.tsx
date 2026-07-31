import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";

type PortalRole = "aluno" | "professor" | "diretor";
type PortalArea = "escolar" | "ead";

export interface PortalSectionUpdate {
  key: string;
  area: PortalArea;
  sectionId: string;
  label: string;
  href: string;
  count: number;
  lastUpdatedAt: number | null;
  signature: string;
  isNew: boolean;
}

interface PortalUpdatesContextValue {
  sections: PortalSectionUpdate[];
  newCount: number;
  loading: boolean;
  hasUpdate: (area: PortalArea, sectionId: string) => boolean;
  getSection: (area: PortalArea, sectionId: string) => PortalSectionUpdate | undefined;
  markSeen: (area: PortalArea, sectionId: string) => void;
  markAllSeen: () => void;
}

interface SourceConfig {
  id: string;
  collectionName: string;
  sectionKeys: string[];
  constraints?: QueryConstraint[];
  enabled?: boolean;
}

interface SourceState {
  signature: string;
  count: number;
  lastUpdatedAt: number | null;
}

interface SectionMeta {
  area: PortalArea;
  sectionId: string;
  label: string;
  roles: PortalRole[];
}

const SECTION_META: SectionMeta[] = [
  { area: "escolar", sectionId: "inicio", label: "Visão geral", roles: ["aluno", "professor", "diretor"] },
  { area: "escolar", sectionId: "aprovacoes", label: "Aprovações", roles: ["diretor"] },
  { area: "escolar", sectionId: "lista-espera", label: "Lista de espera", roles: ["diretor"] },
  { area: "escolar", sectionId: "usuarios", label: "Alunos", roles: ["diretor"] },
  { area: "escolar", sectionId: "professores", label: "Professores", roles: ["diretor"] },
  { area: "escolar", sectionId: "senhas-logins", label: "Senhas e logins", roles: ["diretor"] },
  { area: "escolar", sectionId: "turmas", label: "Turmas", roles: ["diretor"] },
  { area: "escolar", sectionId: "horarios", label: "Horários", roles: ["aluno", "professor", "diretor"] },
  { area: "escolar", sectionId: "calendario", label: "Calendário", roles: ["diretor"] },
  { area: "escolar", sectionId: "config-horarios", label: "Configuração de horários", roles: ["diretor"] },
  { area: "escolar", sectionId: "presencas", label: "Presenças", roles: ["aluno", "professor", "diretor"] },
  { area: "escolar", sectionId: "bimestres", label: "Bimestres e notas", roles: ["professor", "diretor"] },
  { area: "escolar", sectionId: "boletins", label: "Boletins", roles: ["professor", "diretor"] },
  { area: "escolar", sectionId: "boletim", label: "Meu boletim", roles: ["aluno"] },
  { area: "escolar", sectionId: "notas", label: "Minhas notas", roles: ["aluno"] },
  { area: "escolar", sectionId: "autorizacoes-notas", label: "Autorizações de notas", roles: ["diretor"] },
  { area: "escolar", sectionId: "monitoramento", label: "Monitoramento", roles: ["diretor"] },
  { area: "escolar", sectionId: "auditoria-chat", label: "Auditoria do chat", roles: ["diretor"] },
  { area: "escolar", sectionId: "disciplinares", label: "Advertências e suspensões", roles: ["diretor"] },
  { area: "escolar", sectionId: "pedidos-disciplinares", label: "Pedidos disciplinares", roles: ["diretor"] },
  { area: "escolar", sectionId: "disciplinar", label: "Ações disciplinares", roles: ["professor"] },
  { area: "escolar", sectionId: "advertencias", label: "Advertências", roles: ["aluno"] },
  { area: "escolar", sectionId: "denuncias", label: "Denúncias", roles: ["diretor"] },
  { area: "escolar", sectionId: "documentos-internos", label: "Documentos internos", roles: ["diretor"] },
  { area: "escolar", sectionId: "documentacao", label: "Documentação", roles: ["diretor"] },
  { area: "escolar", sectionId: "avisos", label: "Avisos", roles: ["diretor"] },
  { area: "escolar", sectionId: "manutencao", label: "Manutenção", roles: ["diretor"] },
  { area: "escolar", sectionId: "aulas", label: "Minhas aulas", roles: ["aluno"] },
  { area: "escolar", sectionId: "aulaAoVivo", label: "Gerenciar aula ao vivo", roles: ["professor"] },
  { area: "escolar", sectionId: "todas", label: "Tarefas escolares", roles: ["aluno"] },
  { area: "escolar", sectionId: "pendentes", label: "Tarefas pendentes", roles: ["aluno"] },
  { area: "escolar", sectionId: "entregues", label: "Tarefas entregues", roles: ["aluno"] },
  { area: "escolar", sectionId: "avaliacoes", label: "Atividades e avaliações", roles: ["aluno", "professor"] },
  { area: "escolar", sectionId: "correcoes", label: "Correções escolares", roles: ["professor"] },

  { area: "ead", sectionId: "plano", label: "Plano de estudos", roles: ["aluno"] },
  { area: "ead", sectionId: "programacao", label: "Programação de aulas", roles: ["aluno", "professor", "diretor"] },
  { area: "ead", sectionId: "conteudos", label: "Conteúdos e materiais", roles: ["aluno", "professor", "diretor"] },
  { area: "ead", sectionId: "questoes", label: "Banco de questões", roles: ["aluno"] },
  { area: "ead", sectionId: "simulados", label: "Simulados", roles: ["aluno"] },
  { area: "ead", sectionId: "redacao", label: "Redação", roles: ["aluno"] },
  { area: "ead", sectionId: "ao-vivo", label: "Transmissões e encontros", roles: ["aluno", "professor"] },
  { area: "ead", sectionId: "comunidade", label: "Dúvidas e fórum", roles: ["aluno", "professor", "diretor"] },
  { area: "ead", sectionId: "desempenho", label: "Desempenho e evolução", roles: ["aluno"] },
  { area: "ead", sectionId: "estudio", label: "Estúdio do professor", roles: ["professor"] },
  { area: "ead", sectionId: "correcoes", label: "Correções de redação", roles: ["professor"] },
  { area: "ead", sectionId: "turmas", label: "Turmas e relatórios", roles: ["professor"] },
  { area: "ead", sectionId: "gestao", label: "Gestão pedagógica", roles: ["diretor"] },
  { area: "ead", sectionId: "financeiro", label: "Financeiro", roles: ["aluno", "diretor"] },
  { area: "ead", sectionId: "seguranca", label: "Segurança e LGPD", roles: ["diretor"] },
  { area: "ead", sectionId: "acessibilidade", label: "Acessibilidade", roles: ["aluno", "professor", "diretor"] },
  { area: "ead", sectionId: "suporte", label: "Ajuda e suporte", roles: ["aluno", "professor", "diretor"] },
];

const sectionKey = (area: PortalArea, sectionId: string) => `${area}:${sectionId}`;

function dashboardPath(role: PortalRole) {
  return role === "diretor" ? "/diretor" : role === "professor" ? "/professor" : "/aluno";
}

function sectionHref(role: PortalRole, area: PortalArea, sectionId: string) {
  if (area === "ead") return `/ead/${sectionId}`;
  if (sectionId === "inicio") return dashboardPath(role);
  return `${dashboardPath(role)}?secao=${encodeURIComponent(sectionId)}`;
}

function normalizeValue(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === "object") {
    const timestampLike = value as { toMillis?: () => number; toDate?: () => Date };
    if (typeof timestampLike.toMillis === "function") return timestampLike.toMillis();
    if (typeof timestampLike.toDate === "function") return timestampLike.toDate().toISOString();
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeValue(item)]),
    );
  }
  return value;
}

function hashText(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function documentTimestamp(data: DocumentData): number | null {
  const candidates = [
    data.updatedAt,
    data.createdAt,
    data.dataAtualizacao,
    data.dataCriacao,
    data.dataEnvio,
    data.dataAplicacao,
    data.dataPublicacao,
    data.data,
    data.timestamp,
    data.startAt,
    data.releaseAt,
    data.prazo,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate instanceof Date) return candidate.getTime();
    if (typeof candidate?.toMillis === "function") return candidate.toMillis();
    if (typeof candidate?.toDate === "function") return candidate.toDate().getTime();
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === "string") {
      const parsed = Date.parse(candidate);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return null;
}

function sourceSignature(records: Array<{ id: string; data: DocumentData }>) {
  const volatileFields = new Set(["isOnline", "lastSeen", "lastActivity", "statusPresenca"]);
  const normalized = records
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((record) => [
      record.id,
      normalizeValue(Object.fromEntries(
        Object.entries(record.data).filter(([key]) => !volatileFields.has(key)),
      )),
    ]);
  return hashText(JSON.stringify(normalized));
}

function buildSources(role: PortalRole, userData: any): SourceConfig[] {
  const uid = userData?.uid || "";
  const turma = userData?.turma || "";
  const enabledUser = !!uid;
  const sources: SourceConfig[] = [
    {
      id: "announcements",
      collectionName: "announcements",
      sectionKeys: [sectionKey("escolar", "inicio"), sectionKey("escolar", "avisos")],
      enabled: enabledUser,
    },
  ];

  if (role === "aluno") {
    sources.push(
      {
        id: "student-tasks",
        collectionName: "tarefas",
        sectionKeys: [sectionKey("escolar", "inicio"), sectionKey("escolar", "todas"), sectionKey("escolar", "pendentes")],
        constraints: turma ? [where("turma", "==", turma)] : [],
        enabled: !!turma,
      },
      {
        id: "student-deliveries",
        collectionName: "entregas",
        sectionKeys: [sectionKey("escolar", "inicio"), sectionKey("escolar", "entregues")],
        constraints: uid ? [where("alunoId", "==", uid)] : [],
        enabled: enabledUser,
      },
      {
        id: "student-warnings",
        collectionName: "disciplinaryActions",
        sectionKeys: [sectionKey("escolar", "advertencias")],
        constraints: uid ? [where("alunoId", "==", uid)] : [],
        enabled: enabledUser,
      },
      {
        id: "student-schedule-grid",
        collectionName: "gradesHorarias",
        sectionKeys: [sectionKey("escolar", "horarios"), sectionKey("escolar", "aulas")],
        constraints: turma ? [where("turmaId", "==", turma)] : [],
        enabled: !!turma,
      },
      {
        id: "student-presence",
        collectionName: "registrosPresencaChamada",
        sectionKeys: [sectionKey("escolar", "presencas"), sectionKey("escolar", "boletim")],
        constraints: uid ? [where("alunoId", "==", uid)] : [],
        enabled: enabledUser,
      },
      {
        id: "student-evaluations-class",
        collectionName: "avaliacoes",
        sectionKeys: [sectionKey("escolar", "avaliacoes"), sectionKey("escolar", "notas")],
        constraints: turma ? [where("turmaId", "==", turma)] : [],
        enabled: !!turma,
      },
      {
        id: "student-evaluations-personal",
        collectionName: "avaliacoes",
        sectionKeys: [sectionKey("escolar", "avaliacoes"), sectionKey("escolar", "notas")],
        constraints: uid ? [where("alunosIds", "array-contains", uid)] : [],
        enabled: enabledUser,
      },
      {
        id: "student-report-cards",
        collectionName: "boletins",
        sectionKeys: [sectionKey("escolar", "boletim"), sectionKey("escolar", "notas")],
        constraints: uid ? [where("alunoId", "==", uid), where("liberado", "==", true)] : [],
        enabled: enabledUser,
      },
      {
        id: "student-study-plan",
        collectionName: "eadStudyItems",
        sectionKeys: [sectionKey("escolar", "inicio"), sectionKey("ead", "plano"), sectionKey("ead", "desempenho")],
        constraints: uid ? [where("ownerId", "==", uid)] : [],
        enabled: enabledUser,
      },
      {
        id: "student-schedules-everyone",
        collectionName: "eadClassSchedules",
        sectionKeys: [sectionKey("escolar", "inicio"), sectionKey("ead", "programacao")],
        constraints: [where("audienceType", "==", "todos")],
        enabled: enabledUser,
      },
      {
        id: "student-schedules-class",
        collectionName: "eadClassSchedules",
        sectionKeys: [sectionKey("escolar", "inicio"), sectionKey("ead", "programacao")],
        constraints: turma ? [where("audienceType", "==", "turmas"), where("audienceKeys", "array-contains", turma)] : [],
        enabled: !!turma,
      },
      {
        id: "student-schedules-individual",
        collectionName: "eadClassSchedules",
        sectionKeys: [sectionKey("escolar", "inicio"), sectionKey("ead", "programacao")],
        constraints: uid ? [where("audienceType", "==", "aluno"), where("studentId", "==", uid)] : [],
        enabled: enabledUser,
      },
      { id: "lessons", collectionName: "eadLessons", sectionKeys: [sectionKey("ead", "conteudos")], enabled: enabledUser },
      { id: "questions", collectionName: "eadQuestions", sectionKeys: [sectionKey("ead", "questoes")], enabled: enabledUser },
      { id: "exams", collectionName: "eadExams", sectionKeys: [sectionKey("ead", "simulados")], enabled: enabledUser },
      { id: "essay-themes", collectionName: "eadEssayThemes", sectionKeys: [sectionKey("ead", "redacao")], enabled: enabledUser },
      { id: "live-classes", collectionName: "eadLiveClasses", sectionKeys: [sectionKey("ead", "ao-vivo")], enabled: enabledUser },
      { id: "forum-topics", collectionName: "eadForumTopics", sectionKeys: [sectionKey("ead", "comunidade")], enabled: enabledUser },
      {
        id: "student-charges",
        collectionName: "eadCharges",
        sectionKeys: [sectionKey("ead", "financeiro")],
        constraints: uid ? [where("ownerId", "==", uid)] : [],
        enabled: enabledUser,
      },
      {
        id: "student-support",
        collectionName: "eadSupportTickets",
        sectionKeys: [sectionKey("ead", "suporte")],
        constraints: uid ? [where("ownerId", "==", uid)] : [],
        enabled: enabledUser,
      },
    );
  }

  if (role === "professor") {
    sources.push(
      {
        id: "teacher-tasks",
        collectionName: "tarefas",
        sectionKeys: [sectionKey("escolar", "inicio"), sectionKey("escolar", "avaliacoes")],
        constraints: uid ? [where("professorId", "==", uid)] : [],
        enabled: enabledUser,
      },
      {
        id: "teacher-deliveries",
        collectionName: "entregas",
        sectionKeys: [sectionKey("escolar", "inicio"), sectionKey("escolar", "correcoes")],
        constraints: uid ? [where("professorId", "==", uid)] : [],
        enabled: enabledUser,
      },
      {
        id: "teacher-evaluations",
        collectionName: "avaliacoes",
        sectionKeys: [sectionKey("escolar", "avaliacoes"), sectionKey("escolar", "correcoes")],
        constraints: uid ? [where("professorId", "==", uid)] : [],
        enabled: enabledUser,
      },
      {
        id: "teacher-evaluation-deliveries",
        collectionName: "avaliacaoEntregas",
        sectionKeys: [sectionKey("escolar", "correcoes")],
        constraints: uid ? [where("professorId", "==", uid)] : [],
        enabled: enabledUser,
      },
      {
        id: "teacher-grids",
        collectionName: "gradesHorarias",
        sectionKeys: [sectionKey("escolar", "horarios"), sectionKey("escolar", "presencas")],
        enabled: enabledUser,
      },
      {
        id: "teacher-live-school",
        collectionName: "sessoesAulaAoVivo",
        sectionKeys: [sectionKey("escolar", "aulaAoVivo")],
        constraints: uid ? [where("professorId", "==", uid)] : [],
        enabled: enabledUser,
      },
      {
        id: "teacher-disciplinary",
        collectionName: "disciplinaryRequests",
        sectionKeys: [sectionKey("escolar", "disciplinar")],
        constraints: uid ? [where("solicitadoPor", "==", uid)] : [],
        enabled: enabledUser,
      },
      {
        id: "teacher-schedules",
        collectionName: "eadClassSchedules",
        sectionKeys: [sectionKey("escolar", "inicio"), sectionKey("ead", "programacao")],
        constraints: uid ? [where("teacherId", "==", uid)] : [],
        enabled: enabledUser,
      },
      {
        id: "teacher-subjects",
        collectionName: "materiasCustomizadas",
        sectionKeys: [sectionKey("ead", "conteudos"), sectionKey("ead", "estudio")],
        enabled: enabledUser,
      },
      {
        id: "teacher-lessons",
        collectionName: "eadLessons",
        sectionKeys: [sectionKey("ead", "conteudos"), sectionKey("ead", "estudio")],
        enabled: enabledUser,
      },
      { id: "teacher-questions", collectionName: "eadQuestions", sectionKeys: [sectionKey("ead", "estudio")], enabled: enabledUser },
      { id: "teacher-exams", collectionName: "eadExams", sectionKeys: [sectionKey("ead", "estudio"), sectionKey("ead", "turmas")], enabled: enabledUser },
      { id: "teacher-essays", collectionName: "eadEssays", sectionKeys: [sectionKey("ead", "correcoes"), sectionKey("ead", "turmas")], enabled: enabledUser },
      { id: "teacher-live", collectionName: "eadLiveClasses", sectionKeys: [sectionKey("ead", "ao-vivo"), sectionKey("ead", "estudio")], enabled: enabledUser },
      { id: "teacher-forum", collectionName: "eadForumTopics", sectionKeys: [sectionKey("ead", "comunidade")], enabled: enabledUser },
      {
        id: "teacher-support",
        collectionName: "eadSupportTickets",
        sectionKeys: [sectionKey("ead", "suporte")],
        constraints: uid ? [where("ownerId", "==", uid)] : [],
        enabled: enabledUser,
      },
    );
  }

  if (role === "diretor") {
    sources.push(
      { id: "admin-requests", collectionName: "solicitacoes", sectionKeys: [sectionKey("escolar", "inicio"), sectionKey("escolar", "aprovacoes"), sectionKey("escolar", "lista-espera")], enabled: enabledUser },
      { id: "admin-users", collectionName: "usuarios", sectionKeys: [sectionKey("escolar", "inicio"), sectionKey("escolar", "usuarios"), sectionKey("escolar", "professores"), sectionKey("escolar", "senhas-logins"), sectionKey("escolar", "monitoramento")], enabled: enabledUser },
      { id: "admin-classes", collectionName: "turmas", sectionKeys: [sectionKey("escolar", "inicio"), sectionKey("escolar", "turmas")], enabled: enabledUser },
      { id: "admin-grids", collectionName: "gradesHorarias", sectionKeys: [sectionKey("escolar", "horarios"), sectionKey("escolar", "config-horarios")], enabled: enabledUser },
      { id: "admin-calendar", collectionName: "eventosCalendario", sectionKeys: [sectionKey("escolar", "calendario")], enabled: enabledUser },
      { id: "admin-presence", collectionName: "registroPresencas", sectionKeys: [sectionKey("escolar", "presencas"), sectionKey("escolar", "monitoramento")], enabled: enabledUser },
      { id: "admin-bimesters", collectionName: "bimestresConfig", sectionKeys: [sectionKey("escolar", "bimestres")], enabled: enabledUser },
      { id: "admin-report-cards", collectionName: "boletins", sectionKeys: [sectionKey("escolar", "boletins")], enabled: enabledUser },
      { id: "admin-grade-authorizations", collectionName: "solicitacoesEdicaoNota", sectionKeys: [sectionKey("escolar", "autorizacoes-notas")], enabled: enabledUser },
      { id: "admin-disciplinary", collectionName: "disciplinaryActions", sectionKeys: [sectionKey("escolar", "disciplinares")], enabled: enabledUser },
      { id: "admin-disciplinary-requests", collectionName: "disciplinaryRequests", sectionKeys: [sectionKey("escolar", "pedidos-disciplinares")], enabled: enabledUser },
      { id: "admin-documents", collectionName: "boletimDocumentos", sectionKeys: [sectionKey("escolar", "documentos-internos"), sectionKey("escolar", "documentacao")], enabled: enabledUser },
      { id: "admin-maintenance", collectionName: "systemMaintenance", sectionKeys: [sectionKey("escolar", "manutencao")], enabled: enabledUser },
      { id: "admin-schedules", collectionName: "eadClassSchedules", sectionKeys: [sectionKey("escolar", "inicio"), sectionKey("ead", "programacao"), sectionKey("ead", "gestao")], enabled: enabledUser },
      { id: "admin-subjects", collectionName: "materiasCustomizadas", sectionKeys: [sectionKey("escolar", "config-horarios"), sectionKey("ead", "conteudos"), sectionKey("ead", "gestao")], enabled: enabledUser },
      { id: "admin-lessons", collectionName: "eadLessons", sectionKeys: [sectionKey("ead", "conteudos"), sectionKey("ead", "gestao")], enabled: enabledUser },
      { id: "admin-questions", collectionName: "eadQuestions", sectionKeys: [sectionKey("ead", "gestao")], enabled: enabledUser },
      { id: "admin-exams", collectionName: "eadExams", sectionKeys: [sectionKey("ead", "gestao")], enabled: enabledUser },
      { id: "admin-essay-themes", collectionName: "eadEssayThemes", sectionKeys: [sectionKey("ead", "gestao")], enabled: enabledUser },
      { id: "admin-live", collectionName: "eadLiveClasses", sectionKeys: [sectionKey("ead", "gestao")], enabled: enabledUser },
      { id: "admin-forum", collectionName: "eadForumTopics", sectionKeys: [sectionKey("ead", "comunidade"), sectionKey("ead", "gestao")], enabled: enabledUser },
      { id: "admin-charges", collectionName: "eadCharges", sectionKeys: [sectionKey("ead", "financeiro"), sectionKey("ead", "gestao")], enabled: enabledUser },
      { id: "admin-support", collectionName: "eadSupportTickets", sectionKeys: [sectionKey("ead", "suporte"), sectionKey("ead", "gestao")], enabled: enabledUser },
      { id: "admin-audits", collectionName: "eadAuditLogs", sectionKeys: [sectionKey("ead", "seguranca")], enabled: enabledUser },
    );
  }

  return sources.filter((source) => source.enabled !== false && source.sectionKeys.length > 0);
}

const PortalUpdatesContext = createContext<PortalUpdatesContextValue | null>(null);

export function PortalUpdatesProvider({ children }: { children: ReactNode }) {
  const { userData } = useAuth() as any;
  const uid = userData?.uid || "";
  const role = (userData?.tipo || "aluno") as PortalRole;
  const turma = userData?.turma || "";
  const [sourceStates, setSourceStates] = useState<Record<string, SourceState>>({});
  const [seenSignatures, setSeenSignatures] = useState<Record<string, string>>({});
  const [pendingSources, setPendingSources] = useState(0);

  const sources = useMemo(
    () => (uid ? buildSources(role, userData) : []),
    [role, turma, uid, JSON.stringify(userData?.turmas || []), JSON.stringify(userData?.materias || [])],
  );
  const sourcesKey = useMemo(
    () => [
      role,
      uid,
      turma,
      JSON.stringify(userData?.turmas || []),
      JSON.stringify(userData?.materias || []),
      sources.map((source) => `${source.id}:${source.collectionName}`).join("|"),
    ].join("::"),
    [role, sources, turma, uid, userData?.materias, userData?.turmas],
  );

  useEffect(() => {
    setSourceStates({});
    setSeenSignatures({});
    if (!uid || !sources.length) {
      setPendingSources(0);
      return;
    }

    let active = true;
    setPendingSources(sources.length);
    const unsubscribes = sources.map((source) => {
      const reference = query(collection(db, source.collectionName), ...(source.constraints || []));
      return onSnapshot(
        reference,
        (snapshot) => {
          if (!active) return;
          const records = snapshot.docs.map((documentSnapshot) => ({
            id: documentSnapshot.id,
            data: documentSnapshot.data(),
          }));
          const timestamps = records
            .map((record) => documentTimestamp(record.data))
            .filter((value): value is number => typeof value === "number");
          setSourceStates((current) => ({
            ...current,
            [source.id]: {
              signature: sourceSignature(records),
              count: records.length,
              lastUpdatedAt: timestamps.length ? Math.max(...timestamps) : null,
            },
          }));
          setPendingSources((current) => Math.max(0, current - 1));
        },
        (error) => {
          if (!active) return;
          console.warn(`Destaques: não foi possível acompanhar ${source.collectionName}.`, error);
          setSourceStates((current) => ({
            ...current,
            [source.id]: { signature: "indisponivel", count: 0, lastUpdatedAt: null },
          }));
          setPendingSources((current) => Math.max(0, current - 1));
        },
      );
    });

    return () => {
      active = false;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
    // The descriptive source key changes whenever the active user's subscriptions change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, sourcesKey]);

  const sections = useMemo<PortalSectionUpdate[]>(() => {
    if (!uid) return [];
    const sourceMap = new Map<string, SourceConfig[]>();
    sources.forEach((source) => {
      source.sectionKeys.forEach((key) => {
        sourceMap.set(key, [...(sourceMap.get(key) || []), source]);
      });
    });

    return SECTION_META.filter((meta) => meta.roles.includes(role)).map((meta) => {
      const key = sectionKey(meta.area, meta.sectionId);
      const linkedSources = sourceMap.get(key) || [];
      const allSourcesResolved = linkedSources.length > 0 && linkedSources.every((source) => !!sourceStates[source.id]);
      const availableStates = linkedSources
        .map((source) => sourceStates[source.id])
        .filter((state): state is SourceState => !!state && state.signature !== "indisponivel");
      const signature = allSourcesResolved && availableStates.length
        ? hashText(availableStates.map((state) => state.signature).sort().join("|"))
        : "";
      const count = availableStates.reduce((total, state) => total + state.count, 0);
      const timestamps = availableStates
        .map((state) => state.lastUpdatedAt)
        .filter((value): value is number => typeof value === "number");
      const seen = seenSignatures[key];
      return {
        key,
        area: meta.area,
        sectionId: meta.sectionId,
        label: meta.label,
        href: sectionHref(role, meta.area, meta.sectionId),
        count,
        lastUpdatedAt: timestamps.length ? Math.max(...timestamps) : null,
        signature,
        isNew: !!signature && !!seen && signature !== seen,
      };
    });
  }, [role, seenSignatures, sourceStates, sources, uid]);

  useEffect(() => {
    if (!uid || !sections.length) return;
    setSeenSignatures((current) => {
      let changed = false;
      const next = { ...current };
      sections.forEach((section) => {
        if (!section.signature || next[section.key]) return;
        const storageKey = `vestibulando-section-seen:${uid}:${section.key}`;
        const saved = localStorage.getItem(storageKey);
        next[section.key] = saved || section.signature;
        if (!saved) localStorage.setItem(storageKey, section.signature);
        changed = true;
      });
      return changed ? next : current;
    });
  }, [sections, uid]);

  const markSeenByKey = useCallback((key: string) => {
    if (!uid) return;
    const currentSection = sections.find((section) => section.key === key);
    if (!currentSection?.signature) return;
    localStorage.setItem(`vestibulando-section-seen:${uid}:${key}`, currentSection.signature);
    setSeenSignatures((current) => current[key] === currentSection.signature
      ? current
      : { ...current, [key]: currentSection.signature });
  }, [sections, uid]);

  const markSeen = useCallback(
    (area: PortalArea, sectionId: string) => markSeenByKey(sectionKey(area, sectionId)),
    [markSeenByKey],
  );

  const markAllSeen = useCallback(() => {
    sections.forEach((section) => {
      if (!section.signature) return;
      localStorage.setItem(`vestibulando-section-seen:${uid}:${section.key}`, section.signature);
    });
    setSeenSignatures((current) => ({
      ...current,
      ...Object.fromEntries(
        sections.filter((section) => section.signature).map((section) => [section.key, section.signature]),
      ),
    }));
  }, [sections, uid]);

  const value = useMemo<PortalUpdatesContextValue>(() => ({
    sections,
    newCount: sections.filter((section) => section.isNew).length,
    loading: pendingSources > 0,
    hasUpdate: (area, sectionId) => sections.some(
      (section) => section.area === area && section.sectionId === sectionId && section.isNew,
    ),
    getSection: (area, sectionId) => sections.find(
      (section) => section.area === area && section.sectionId === sectionId,
    ),
    markSeen,
    markAllSeen,
  }), [markAllSeen, markSeen, pendingSources, sections]);

  return <PortalUpdatesContext.Provider value={value}>{children}</PortalUpdatesContext.Provider>;
}

export function usePortalUpdates() {
  const context = useContext(PortalUpdatesContext);
  if (!context) {
    throw new Error("usePortalUpdates deve ser usado dentro de PortalUpdatesProvider.");
  }
  return context;
}
