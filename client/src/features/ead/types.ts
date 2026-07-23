export type EadRole = "aluno" | "professor" | "diretor";

export type EadDiscipline =
  | "Linguagens"
  | "Matemática"
  | "Ciências Humanas"
  | "Ciências da Natureza"
  | "Redação"
  | "Atualidades";

export interface EadProfile {
  curso?: string;
  provaAlvo?: string;
  objetivo?: string;
  serie?: string;
  turno?: string;
  nivel?: "iniciante" | "intermediario" | "avancado";
  dataProva?: string;
  horasSemanais?: number;
  metaAulas?: number;
  metaQuestoes?: number;
  responsavelNome?: string;
  responsavelEmail?: string;
}

export interface EadStudyItem {
  id: string;
  ownerId: string;
  title: string;
  discipline: string;
  kind: "aula" | "questoes" | "revisao" | "simulado" | "redacao" | "inscricao";
  scheduledDate: string;
  durationMinutes: number;
  difficulty: "facil" | "media" | "dificil";
  completed: boolean;
  completedAt?: string;
  autoReplanned?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EadLesson {
  id: string;
  title: string;
  discipline: EadDiscipline | string;
  subject: string;
  module: string;
  trail: string;
  level: "iniciante" | "intermediario" | "avancado";
  type: "video" | "ao-vivo" | "pdf" | "resumo" | "mapa-mental" | "slides" | "audio";
  durationMinutes: number;
  description: string;
  teacherName?: string;
  videoUrl?: string;
  materialUrl?: string;
  audioUrl?: string;
  thumbnailUrl?: string;
  editalReference?: string;
  captionsUrl?: string;
  published: boolean;
  builtIn?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EadLessonProgress {
  id: string;
  ownerId: string;
  lessonId: string;
  progress: number;
  watchedSeconds: number;
  completed: boolean;
  favorite: boolean;
  offline: boolean;
  lastAccessedAt: string;
  updatedAt: string;
}

export interface EadQuestion {
  id: string;
  statement: string;
  discipline: EadDiscipline | string;
  subject: string;
  year: number;
  board: string;
  difficulty: "facil" | "media" | "dificil";
  alternatives: string[];
  correctIndex: number;
  explanation: string;
  explanationVideoUrl?: string;
  source?: string;
  published: boolean;
  builtIn?: boolean;
  createdBy?: string;
  createdAt?: string;
}

export interface EadQuestionAttempt {
  id: string;
  ownerId: string;
  questionId: string;
  selectedIndex: number;
  correct: boolean;
  elapsedSeconds: number;
  discipline: string;
  subject: string;
  attemptedAt: string;
}

export interface EadExam {
  id: string;
  title: string;
  description: string;
  type: "completo" | "disciplina" | "enem-dia-1" | "enem-dia-2";
  discipline?: string;
  durationMinutes: number;
  questionIds: string[];
  questionCount: number;
  rankingEnabled: boolean;
  published: boolean;
  builtIn?: boolean;
  createdBy?: string;
  createdAt?: string;
}

export interface EadExamAttempt {
  id: string;
  ownerId: string;
  ownerName: string;
  examId: string;
  examTitle: string;
  answers: Record<string, number>;
  elapsedSeconds: number;
  correctCount: number;
  totalQuestions: number;
  score: number;
  triEstimate: number;
  status: "em-andamento" | "concluido";
  strengths: string[];
  weaknesses: string[];
  startedAt: string;
  completedAt?: string;
  updatedAt: string;
}

export interface EadEssayTheme {
  id: string;
  title: string;
  description: string;
  supportingTexts: string[];
  tags: string[];
  deadline?: string;
  exampleUrl?: string;
  published: boolean;
  builtIn?: boolean;
  createdBy?: string;
  createdAt?: string;
}

export interface EadEssay {
  id: string;
  ownerId: string;
  ownerName: string;
  themeId: string;
  themeTitle: string;
  text: string;
  imageDataUrl?: string;
  version: number;
  status: "rascunho" | "enviada" | "em-correcao" | "corrigida";
  grammarNotes: string[];
  scores?: {
    competencia1: number;
    competencia2: number;
    competencia3: number;
    competencia4: number;
    competencia5: number;
  };
  totalScore?: number;
  teacherComments?: string;
  correctedBy?: string;
  correctedAt?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
}

export interface EadLiveClass {
  id: string;
  title: string;
  discipline: string;
  teacherId: string;
  teacherName: string;
  scheduledAt: string;
  durationMinutes: number;
  status: "agendada" | "ao-vivo" | "encerrada";
  roomUrl?: string;
  recordingUrl?: string;
  materialUrl?: string;
  description?: string;
  reminderMinutes: number;
  published: boolean;
  createdAt?: string;
}

export interface EadForumTopic {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: EadRole;
  discipline: string;
  title: string;
  body: string;
  status: "aberto" | "respondido" | "fechado";
  pinned: boolean;
  moderated: boolean;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EadForumReply {
  id: string;
  topicId: string;
  authorId: string;
  authorName: string;
  authorRole: EadRole;
  body: string;
  accepted: boolean;
  createdAt: string;
}

export interface EadPlan {
  id: string;
  name: string;
  price: number;
  period: "mensal" | "trimestral" | "semestral" | "anual";
  description: string;
  features: string[];
  active: boolean;
}

export interface EadCharge {
  id: string;
  ownerId: string;
  ownerName: string;
  planId: string;
  planName: string;
  amount: number;
  dueDate: string;
  method: "pix" | "boleto" | "cartao";
  status: "pendente" | "pago" | "vencido" | "cancelado" | "reembolsado";
  paymentLink?: string;
  pixCode?: string;
  barcode?: string;
  receiptDataUrl?: string;
  couponCode?: string;
  discount: number;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EadSupportTicket {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerEmail?: string;
  category: "tecnico" | "financeiro" | "pedagogico" | "reclamacao" | "lgpd";
  subject: string;
  message: string;
  priority: "baixa" | "media" | "alta";
  status: "aberto" | "em-atendimento" | "resolvido";
  response?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EadAuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: EadRole;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  createdAt: string;
}

export interface EadAccessibilityPreferences {
  fontScale: number;
  highContrast: boolean;
  reducedMotion: boolean;
  lowData: boolean;
  captions: boolean;
}
