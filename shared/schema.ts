import { z } from "zod";

// Lista padronizada de horários disponíveis para estudos
export const HORARIOS_DISPONIVEIS = [
  "Manhã - Seg a Sex",
  "Manhã - Seg a Sáb",
  "Tarde - Seg a Sex",
  "Tarde - Seg a Sáb",
  "Noite - Seg a Sex",
  "Noite - Seg a Sáb",
  "Domingo",
  "Qualquer horário",
  "Horário especial",
] as const;

// User schema - tipos: aluno, professor, diretor
// status: pendente (aguardando aprovação), aprovado (pode logar), reprovado (não pode logar), devolvido (precisa fazer correções)
export const userSchema = z.object({
  uid: z.string(),
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  tipo: z.enum(["aluno", "professor", "diretor"]),
  turma: z.string().optional(),
  turmas: z.array(z.string()).optional(), // Array de turmas para professores
  materias: z.array(z.string()).optional(), // Array de matérias que o professor leciona (só professores podem alterar dados nas suas matérias)
  ativo: z.boolean().default(true),
  bloqueado: z.boolean().default(false),
  status: z.enum(["pendente", "aprovado", "reprovado", "devolvido"]).default("pendente"),
  matricula: z.string().optional(), // 4 dígitos - número da matrícula do aluno
  comentarioReprovacao: z.string().optional(),
  comentarioDevolucao: z.string().optional(),
  dataSolicitacao: z.string().optional(),
  // Campos de presença online/offline
  isOnline: z.boolean().optional().default(false),
  lastSeen: z.string().optional(), // timestamp do último acesso
  lastActivity: z.string().optional(), // timestamp da última atividade
  statusPresenca: z.enum(["online", "ausente", "offline", "em_reuniao", "ocupado"]).optional().default("offline"),
  mensagemStatus: z.string().optional(), // mensagem personalizada de status (ex: "Em reunião até 15h")
  // Campo para controlar primeiro acesso e troca de senha
  primeiroAcesso: z.boolean().optional().default(true), // true se ainda não alterou a senha inicial
  senhaAtual: z.string().optional(), // senha atual do usuário (armazenada para visualização do diretor)
  forcarTrocaSenha: z.boolean().optional().default(false), // true se diretor resetou senha e usuário deve alterar no próximo login
  // Campo para controlar aceite dos termos do chat
  chatTermsAccepted: z.boolean().optional().default(false), // true se aceitou os termos do chat
  chatTermsAcceptedDate: z.string().optional(), // data e hora da aceitação dos termos do chat
  // Campos de foto
  fotoUrl: z.string().optional(), // URL da foto no Firebase Storage
  fotoBase64: z.string().optional(), // Foto 3x4 em Base64 (deprecated - usar fotoUrl)
  fotoPublica: z.boolean().optional().default(false), // se true, foto visível para todos; se false, apenas para diretor
  // Campos obrigatórios para alunos
  dataNascimento: z.string().optional(),
  cpf: z.string().optional(),
  sexo: z.string().optional(), // masculino, feminino, nao-binario, prefiro-nao-informar
  escolaridade: z.string().optional(), // ensino fundamental, médio, superior
  telefone: z.string().optional(), // WhatsApp
  cep: z.string().optional(),
  rua: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  disponibilidade: z.array(z.string()).optional(), // horários disponíveis para estudo
  horarioEspecialObservacao: z.string().optional(), // observação obrigatória se "Horário especial (descrever)" estiver selecionado
});

// Schema para cadastro de aluno (todos os campos obrigatórios)
export const alunoRegistrationSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  dataNascimento: z.string().min(1, "Data de nascimento é obrigatória"),
  cpf: z.string().min(1, "CPF é obrigatório"),
  sexo: z.string().min(1, "Sexo é obrigatório"),
  escolaridade: z.string().min(1, "Escolaridade é obrigatória"),
  telefone: z.string().min(1, "Telefone é obrigatório"),
  turma: z.string().min(1, "Turma é obrigatória"),
  cep: z.string().min(1, "CEP é obrigatório"),
  rua: z.string().min(1, "Rua é obrigatória"),
  bairro: z.string().min(1, "Bairro é obrigatório"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  estado: z.string().min(1, "Estado é obrigatório"),
  disponibilidade: z.array(z.string()).min(1, "Selecione pelo menos uma disponibilidade"),
});

// Schema para cadastro rápido de aluno pelo diretor (todos os campos opcionais)
export const diretorQuickAddAlunoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  dataNascimento: z.string().optional(),
  cpf: z.string().optional(),
  sexo: z.string().optional(),
  escolaridade: z.string().optional(),
  telefone: z.string().optional(),
  turma: z.string().optional(),
  cep: z.string().optional(),
  rua: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  disponibilidade: z.array(z.string()).optional(),
  horarioEspecialObservacao: z.string().optional(),
  fotoUrl: z.string().optional(),
  fotoBase64: z.string().optional(),
  fotoPublica: z.boolean().optional(),
});

export const insertUserSchema = userSchema.omit({ uid: true });

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type AlunoRegistration = z.infer<typeof alunoRegistrationSchema>;
export type DiretorQuickAddAluno = z.infer<typeof diretorQuickAddAlunoSchema>;

// Tarefa (Assignment) schema
export const tarefaSchema = z.object({
  id: z.string(),
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  materia: z.string().min(1, "Matéria é obrigatória"), // Matéria da tarefa (professor só pode criar em suas matérias)
  professorId: z.string(),
  professorNome: z.string(),
  turma: z.string().min(1, "Turma é obrigatória"),
  prazo: z.string(),
  arquivoAnexo: z.string().optional(),
  arquivoNome: z.string().optional(),
  criadoEm: z.string(),
});

export const insertTarefaSchema = tarefaSchema.omit({ id: true, criadoEm: true });

export type Tarefa = z.infer<typeof tarefaSchema>;
export type InsertTarefa = z.infer<typeof insertTarefaSchema>;

// Entrega (Submission) schema
export const entregaSchema = z.object({
  id: z.string(),
  tarefaId: z.string(),
  tarefaTitulo: z.string(),
  alunoId: z.string(),
  alunoNome: z.string(),
  alunoEmail: z.string(),
  dataEnvio: z.string(),
  arquivo: z.string(),
  arquivoNome: z.string(),
  nota: z.number().min(0).max(10).optional(),
  feedback: z.string().optional(),
  status: z.enum(["pendente", "entregue", "avaliado", "atrasado"]),
});

export const insertEntregaSchema = entregaSchema.omit({ id: true, dataEnvio: true, status: true });

export type Entrega = z.infer<typeof entregaSchema>;
export type InsertEntrega = z.infer<typeof entregaSchema>;

// Turma (Class) schema
export const turmaSchema = z.object({
  id: z.string(),
  nome: z.string().min(1, "Nome da turma é obrigatório"),
  ano: z.string(),
  ativa: z.boolean().default(true),
  vagasTotais: z.number().optional(),
  vagasPreenchidas: z.number().optional(),
  periodoMatriculaInicio: z.string().optional(),
  periodoMatriculaFim: z.string().optional(),
  linkWhatsApp: z.string().optional(),
  vagasDisponiveis: z.number().optional(), // deprecated - usar vagasTotais - vagasPreenchidas
});

export const insertTurmaSchema = turmaSchema.omit({ id: true });

export type Turma = z.infer<typeof turmaSchema>;
export type InsertTurma = z.infer<typeof insertTurmaSchema>;

// LoginHistory schema - rastreia login/logout dos usuários
export const loginHistorySchema = z.object({
  id: z.string(),
  userId: z.string(),
  userNome: z.string(),
  userTipo: z.enum(["aluno", "professor", "diretor"]),
  action: z.enum(["login", "logout"]),
  timestamp: z.string(), // ISO datetime em horário de Brasília
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export const insertLoginHistorySchema = loginHistorySchema.omit({ id: true });

export type LoginHistory = z.infer<typeof loginHistorySchema>;
export type InsertLoginHistory = z.infer<typeof insertLoginHistorySchema>;

// Disciplinary Action schema - advertências e suspensões disciplinares
export const disciplinaryActionSchema = z.object({
  id: z.string(),
  alunoId: z.string(),
  alunoNome: z.string(),
  alunoMatricula: z.string(),
  alunoTurma: z.string(),
  tipo: z.enum(["advertencia", "suspensao"]),
  comentario: z.string().optional(), // Comentário do diretor sobre a ação disciplinar
  aplicadoPor: z.string(), // ID do diretor que aplicou
  aplicadoPorNome: z.string(), // Nome do diretor
  dataAplicacao: z.string(), // ISO datetime
  dataTerminoSuspensao: z.string().optional(), // Data de término da suspensão (calculado como dataAplicacao + 2 dias)
  ativo: z.boolean().default(true), // false se foi removido pelo diretor
  dataRemocao: z.string().optional(), // Data em que foi removida
  removidoPor: z.string().optional(), // ID do diretor que removeu
  removidoPorNome: z.string().optional(), // Nome do diretor que removeu
  visualizado: z.boolean().default(false), // se o aluno já visualizou a advertência
  dataVisualizacao: z.string().optional(), // Data em que o aluno visualizou
});

export const insertDisciplinaryActionSchema = disciplinaryActionSchema.omit({ id: true });

export type DisciplinaryAction = z.infer<typeof disciplinaryActionSchema>;
export type InsertDisciplinaryAction = z.infer<typeof insertDisciplinaryActionSchema>;

// Disciplinary Action Request schema - solicitações de advertências e suspensões por professores
export const disciplinaryRequestSchema = z.object({
  id: z.string(),
  alunoId: z.string(),
  alunoNome: z.string(),
  alunoMatricula: z.string(),
  alunoTurma: z.string(),
  alunoTurmaNome: z.string().optional(),
  tipo: z.enum(["advertencia", "suspensao"]),
  materia: z.string().optional(), // Matéria em que ocorreu a situação
  motivo: z.string(), // Motivo/justificativa do professor
  solicitadoPor: z.string(), // ID do professor que solicitou
  solicitadoPorNome: z.string(), // Nome do professor
  dataSolicitacao: z.string(), // ISO datetime
  status: z.enum(["pendente", "aprovado", "rejeitado", "removido"]).default("pendente"),
  analisadoPor: z.string().optional(), // ID do diretor que analisou
  analisadoPorNome: z.string().optional(), // Nome do diretor
  dataAnalise: z.string().optional(), // Data da análise
  comentarioDiretor: z.string().optional(), // Comentário do diretor (opcional)
  dataRemocao: z.string().optional(), // Data em que a ação foi removida
  motivoRemocao: z.string().optional(), // Motivo da remoção
});

export const insertDisciplinaryRequestSchema = disciplinaryRequestSchema.omit({ id: true });

export type DisciplinaryRequest = z.infer<typeof disciplinaryRequestSchema>;
export type InsertDisciplinaryRequest = z.infer<typeof insertDisciplinaryRequestSchema>;

// Maintenance schema - manutenção do sistema
export const maintenanceSchema = z.object({
  id: z.string(),
  numeroManutencao: z.string(), // Número sequencial de identificação (ex: "0001", "0002")
  ativa: z.boolean().default(false), // se true, sistema está em manutenção
  tipo: z.enum(["determinada", "indeterminada"]), // determinada = com data fim, indeterminada = sem data fim
  dataInicio: z.string(), // Data/hora programada de início da manutenção
  dataFim: z.string().optional(), // Data/hora programada de término (opcional se indeterminada)
  dataAtivacao: z.string(), // Data/hora em que foi ativada
  dataFinalizacao: z.string().optional(), // Data/hora em que foi finalizada
  duracaoSegundos: z.number().optional(), // Duração total da manutenção em segundos
  duracaoFormatada: z.string().optional(), // Duração formatada (HH:MM:SS)
  iniciadoPor: z.string(), // ID do diretor que iniciou
  iniciadoPorNome: z.string(), // Nome do diretor que iniciou
  finalizadoPor: z.string().optional(), // ID do diretor que finalizou
  finalizadoPorNome: z.string().optional(), // Nome do diretor que finalizou
  justificativa: z.string().optional(), // Justificativa das alterações realizadas (obrigatório após finalizar)
  justificadaPor: z.string().optional(), // ID do diretor que adicionou a justificativa
  justificadaPorNome: z.string().optional(), // Nome do diretor que adicionou a justificativa
  dataJustificativa: z.string().optional(), // Data/hora em que a justificativa foi adicionada
  arquivada: z.boolean().default(false), // se true, manutenção foi arquivada no histórico de auditoria
});

export const insertMaintenanceSchema = maintenanceSchema.omit({ id: true, numeroManutencao: true });

export type Maintenance = z.infer<typeof maintenanceSchema>;
export type InsertMaintenance = z.infer<typeof insertMaintenanceSchema>;

// Announcement Slide schema - cada slide de um aviso (texto ou imagem)
export const announcementSlideSchema = z.object({
  tipo: z.enum(["texto", "imagem"]), // tipo do slide: texto ou imagem
  conteudo: z.string(), // texto do slide ou URL da imagem em base64
});

export type AnnouncementSlide = z.infer<typeof announcementSlideSchema>;

// Announcement schema - avisos para alunos e professores
export const announcementSchema = z.object({
  id: z.string(),
  numeroAviso: z.string(), // Número sequencial de identificação (ex: "0001", "0002")
  titulo: z.string().min(1, "Título é obrigatório"), // Título do aviso (obrigatório)
  slides: z.array(announcementSlideSchema).min(1, "Pelo menos um slide é obrigatório"), // Array de slides (texto/imagem)
  publicoAlvo: z.enum(["todos", "alunos", "professores", "turmas"]), // para quem é o aviso
  turmasSelecionadas: z.array(z.string()).optional(), // IDs das turmas específicas (se publicoAlvo === "turmas")
  
  // Sistema de agendamento
  tipoAviso: z.enum(["instantaneo", "programado"]), // instantâneo = ativa imediatamente, programado = ativa na data/hora
  tipoDuracao: z.enum(["determinada", "indeterminada"]), // determinada = com data fim, indeterminada = sem data fim
  dataInicio: z.string(), // Data/hora programada de início
  dataFim: z.string().optional(), // Data/hora programada de término (opcional se indeterminada)
  dataAtivacao: z.string().optional(), // Data/hora em que foi ativado (para programados)
  dataDesativacao: z.string().optional(), // Data/hora em que foi desativado
  
  ativo: z.boolean().default(false), // se o aviso está ativo no momento
  criadoPor: z.string(), // ID do diretor que criou
  criadoPorNome: z.string(), // Nome do diretor
  dataCriacao: z.string(), // Data de criação
  dataAtualizacao: z.string().optional(), // Data da última atualização
  
  // Auditoria (similar ao sistema de manutenção)
  arquivado: z.boolean().default(false), // se true, aviso foi arquivado no histórico de auditoria
  justificativa: z.string().optional(), // Justificativa do aviso (obrigatório após arquivar)
  justificadoPor: z.string().optional(), // ID do diretor que adicionou a justificativa
  justificadoPorNome: z.string().optional(), // Nome do diretor que adicionou a justificativa
  dataJustificativa: z.string().optional(), // Data/hora em que a justificativa foi adicionada
});

export const insertAnnouncementSchema = announcementSchema.omit({ id: true, numeroAviso: true });

export type Announcement = z.infer<typeof announcementSchema>;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;

// Chat Message schema - mensagens individuais do chat
export const chatMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(), // ID da conversa (combinação dos IDs dos participantes)
  remetenteId: z.string(), // ID de quem enviou
  remetenteNome: z.string(), // Nome de quem enviou
  remetenteTipo: z.enum(["aluno", "professor", "diretor"]), // Tipo de quem enviou
  destinatarioId: z.string(), // ID de quem recebe
  destinatarioNome: z.string(), // Nome de quem recebe
  destinatarioTipo: z.enum(["aluno", "professor", "diretor"]), // Tipo de quem recebe
  tipo: z.enum(["texto", "audio", "imagem", "documento", "video"]).default("texto"), // Tipo de mensagem
  conteudo: z.string(), // Conteúdo da mensagem (texto ou legenda para arquivos)
  arquivoUrl: z.string().optional(), // URL do arquivo no Firebase Storage
  arquivoNome: z.string().optional(), // Nome original do arquivo
  arquivoTipo: z.string().optional(), // MIME type do arquivo
  arquivoTamanho: z.number().optional(), // Tamanho do arquivo em bytes
  timestamp: z.string(), // Data/hora de envio (ISO datetime)
  entregue: z.boolean().default(false), // Se a mensagem foi entregue ao destinatário
  dataEntrega: z.string().optional(), // Data/hora em que foi entregue
  lida: z.boolean().default(false), // Se a mensagem foi lida pelo destinatário
  dataLeitura: z.string().optional(), // Data/hora em que foi lida
  deletadaPorRemetente: z.boolean().default(false), // Se foi deletada pelo remetente (só some da visualização)
  deletadaPorDestinatario: z.boolean().default(false), // Se foi deletada pelo destinatário (só some da visualização)
  dataDeletadaPorRemetente: z.string().optional(), // Data/hora em que foi deletada pelo remetente
  dataDeletadaPorDestinatario: z.string().optional(), // Data/hora em que foi deletada pelo destinatário
  deletadaParaTodos: z.boolean().default(false), // Se foi deletada para todos (mostra "Mensagem apagada")
  dataDeletadaParaTodos: z.string().optional(), // Data/hora em que foi deletada para todos
  deletadaParaTodosPorId: z.string().optional(), // ID de quem deletou para todos
});

export const insertChatMessageSchema = chatMessageSchema.omit({ id: true });

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

// Chat Log schema - logs detalhados de todas as ações do chat
export const chatLogSchema = z.object({
  id: z.string(),
  tipo: z.enum([
    "mensagem_enviada",
    "mensagem_lida",
    "mensagem_deletada",
    "arquivo_enviado",
    "erro_envio",
    "erro_upload",
    "conexao_perdida",
    "conexao_restaurada",
    "violacao_detectada",
    "penalidade_aplicada"
  ]),
  usuarioId: z.string(),
  usuarioNome: z.string(),
  conversationId: z.string().optional(),
  messageId: z.string().optional(),
  detalhes: z.string(), // Detalhes da ação em formato JSON string
  timestamp: z.string(),
  nivelSeveridade: z.enum(["info", "warning", "error", "critical"]).default("info"),
});

export const insertChatLogSchema = chatLogSchema.omit({ id: true });

export type ChatLog = z.infer<typeof chatLogSchema>;
export type InsertChatLog = z.infer<typeof insertChatLogSchema>;

// Chat Conversation schema - conversas entre usuários
export const chatConversationSchema = z.object({
  id: z.string(), // ID único da conversa
  participante1Id: z.string(),
  participante1Nome: z.string(),
  participante1Tipo: z.enum(["aluno", "professor", "diretor"]),
  participante2Id: z.string(),
  participante2Nome: z.string(),
  participante2Tipo: z.enum(["aluno", "professor", "diretor"]),
  ultimaMensagem: z.string().optional(), // Conteúdo da última mensagem
  ultimaMensagemTimestamp: z.string().optional(), // Timestamp da última mensagem
  ultimaMensagemRemetenteId: z.string().optional(), // Quem enviou a última mensagem
  ultimaMensagemEntregue: z.boolean().default(false), // Se a última mensagem foi entregue
  ultimaMensagemLida: z.boolean().default(false), // Se a última mensagem foi lida
  mensagensNaoLidas1: z.number().default(0), // Mensagens não lidas pelo participante 1
  mensagensNaoLidas2: z.number().default(0), // Mensagens não lidas pelo participante 2
  participante1Digitando: z.boolean().default(false), // Se o participante 1 está digitando
  participante2Digitando: z.boolean().default(false), // Se o participante 2 está digitando
  participante1UltimaDigitacao: z.string().optional(), // Timestamp da última vez que o participante 1 digitou
  participante2UltimaDigitacao: z.string().optional(), // Timestamp da última vez que o participante 2 digitou
  deletadaPorParticipante1: z.boolean().default(false), // Se a conversa foi deletada pelo participante 1 (soft delete)
  deletadaPorParticipante2: z.boolean().default(false), // Se a conversa foi deletada pelo participante 2 (soft delete)
  dataDelecaoParticipante1: z.string().optional(), // Data/hora em que foi deletada pelo participante 1
  dataDelecaoParticipante2: z.string().optional(), // Data/hora em que foi deletada pelo participante 2
  dataCriacao: z.string(), // Data de criação da conversa
  dataUltimaAtualizacao: z.string(), // Data da última atualização
});

export const insertChatConversationSchema = chatConversationSchema.omit({ id: true });

export type ChatConversation = z.infer<typeof chatConversationSchema>;
export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;

// Chat Penalty schema - penalidades automáticas do chat
export const chatPenaltySchema = z.object({
  id: z.string(),
  usuarioId: z.string(),
  usuarioNome: z.string(),
  usuarioMatricula: z.string().optional(),
  usuarioTipo: z.enum(["aluno", "professor", "diretor"]),
  tipo: z.enum(["advertencia", "bloqueio_24h", "suspensao_conta"]),
  mensagemInfratora: z.string(), // Conteúdo da mensagem que violou as regras
  conversationId: z.string(), // ID da conversa onde ocorreu a infração
  destinatarioId: z.string(), // Com quem estava conversando
  destinatarioNome: z.string(),
  dataInfracao: z.string(), // Data/hora da infração
  numeroDaInfracao: z.number(), // 1, 2, ou 3
  ativa: z.boolean().default(true), // Se a penalidade está ativa
  dataExpiracao: z.string().optional(), // Data de expiração do bloqueio (para bloqueio_24h)
  revisadoPorDiretor: z.boolean().default(false), // Se foi revisado pela diretoria
  decisaoDiretor: z.enum(["mantida", "removida"]).optional(), // Decisão após revisão
  comentarioDiretor: z.string().optional(), // Comentário da diretoria
  diretorId: z.string().optional(), // ID do diretor que revisou
  diretorNome: z.string().optional(),
  dataRevisao: z.string().optional(),
});

export const insertChatPenaltySchema = chatPenaltySchema.omit({ id: true });

export type ChatPenalty = z.infer<typeof chatPenaltySchema>;
export type InsertChatPenalty = z.infer<typeof insertChatPenaltySchema>;

// User Block schema - bloqueios manuais entre usuários
export const userBlockSchema = z.object({
  id: z.string(),
  bloqueadorId: z.string(), // ID de quem bloqueou
  bloqueadorNome: z.string(), // Nome de quem bloqueou
  bloqueadoId: z.string(), // ID de quem foi bloqueado
  bloqueadoNome: z.string(), // Nome de quem foi bloqueado
  dataBloqueio: z.string(), // Data/hora do bloqueio
  ativo: z.boolean().default(true), // Se o bloqueio está ativo
});

export const insertUserBlockSchema = userBlockSchema.omit({ id: true });

export type UserBlock = z.infer<typeof userBlockSchema>;
export type InsertUserBlock = z.infer<typeof insertUserBlockSchema>;

// Chat Report schema - denúncias de conversas
export const chatReportSchema = z.object({
  id: z.string(),
  conversationId: z.string(), // ID da conversa denunciada
  denuncianteId: z.string(), // ID de quem denunciou
  denuncianteNome: z.string(), // Nome de quem denunciou
  denuncianteTipo: z.enum(["aluno", "professor", "diretor"]), // Tipo de quem denunciou
  denunciadoId: z.string(), // ID de quem foi denunciado
  denunciadoNome: z.string(), // Nome de quem foi denunciado
  denunciadoTipo: z.enum(["aluno", "professor", "diretor"]), // Tipo de quem foi denunciado
  motivo: z.string(), // Comentário/motivo da denúncia
  mensagensConversa: z.string().optional(), // JSON string com cópia de todas as mensagens da conversa
  dataDenuncia: z.string(), // Data/hora da denúncia
  status: z.enum(["pendente", "analisada", "arquivada"]).default("pendente"), // Status da denúncia
  analisadaPor: z.string().optional(), // ID do diretor que analisou
  analisadaPorNome: z.string().optional(), // Nome do diretor que analisou
  dataAnalise: z.string().optional(), // Data/hora da análise
  comentarioDiretor: z.string().optional(), // Comentário do diretor após análise
  acaoTomada: z.string().optional(), // Ação tomada pelo diretor
});

export const insertChatReportSchema = chatReportSchema.omit({ id: true });

export type ChatReport = z.infer<typeof chatReportSchema>;
export type InsertChatReport = z.infer<typeof insertChatReportSchema>;

// Call Signal schema - sinais de chamada de vídeo/áudio
export const callSignalSchema = z.object({
  id: z.string(),
  callId: z.string().optional(),
  type: z.enum(["offer", "answer", "ice-candidate", "end", "reject"]),
  callerId: z.string(),
  callerName: z.string(),
  receiverId: z.string(),
  receiverName: z.string().optional(),
  data: z.any().optional(), // SDP offer/answer ou ICE candidate
  timestamp: z.union([z.string(), z.number()]),
  read: z.boolean().default(false),
});

export const insertCallSignalSchema = callSignalSchema.omit({ id: true });

export type CallSignal = z.infer<typeof callSignalSchema>;
export type InsertCallSignal = z.infer<typeof insertCallSignalSchema>;

// Lista de matérias/disciplinas disponíveis
export const MATERIAS_DISPONIVEIS = [
  "Matemática",
  "Português",
  "Redação",
  "Literatura",
  "História",
  "Geografia",
  "Física",
  "Química",
  "Biologia",
  "Inglês",
  "Espanhol",
  "Filosofia",
  "Sociologia",
  "Artes",
  "Educação Física",
  "Atualidades",
  "Interdisciplinar",
] as const;

// Matérias especiais que não precisam de professor (atividades gerais)
export const MATERIAS_SEM_PROFESSOR = [
  "Revisão",
  "Corujão",
] as const;

// Schema para matérias customizadas (cadastradas pelo diretor)
export const materiaCustomizadaSchema = z.object({
  id: z.string(),
  nome: z.string().min(1, "Nome da matéria é obrigatório"),
  requerProfessor: z.boolean().default(true), // Se precisa ou não de professor
  cor: z.string().optional(), // Cor personalizada para exibição
  ativo: z.boolean().default(true),
  criadoPor: z.string().optional(),
  criadoEm: z.string().optional(),
});

export const insertMateriaCustomizadaSchema = materiaCustomizadaSchema.omit({ id: true });

export type MateriaCustomizada = z.infer<typeof materiaCustomizadaSchema>;
export type InsertMateriaCustomizada = z.infer<typeof insertMateriaCustomizadaSchema>;

// Tipos de questão disponíveis
export const TIPOS_QUESTAO = [
  { value: "multipla_escolha", label: "Múltipla Escolha (uma correta)" },
  { value: "verdadeiro_falso", label: "Verdadeiro ou Falso" },
  { value: "objetiva", label: "Objetiva (resposta curta)" },
  { value: "dissertativa", label: "Dissertativa" },
  { value: "redacao", label: "Redação" },
  { value: "outros", label: "Outros" },
] as const;

// Questão individual de uma avaliação
export const avaliacaoQuestaoSchema = z.object({
  id: z.string(),
  ordem: z.number(), // Ordem da questão na avaliação
  tipo: z.enum(["objetiva", "dissertativa", "multipla_escolha", "verdadeiro_falso", "redacao", "outros"]),
  enunciado: z.string(), // Texto da questão
  imagemUrl: z.string().optional(), // URL de imagem anexada à questão
  videoUrl: z.string().optional(), // URL de vídeo anexado à questão
  opcoes: z.array(z.object({
    letra: z.string(), // A, B, C, D, E
    texto: z.string(),
    correta: z.boolean().optional(), // Para questões objetivas/multipla escolha
  })).optional(),
  respostaCorreta: z.string().optional(), // Gabarito para questões objetivas
  valor: z.number().default(1), // Valor/pontuação da questão
  // Campos específicos para redação
  temaRedacao: z.string().optional(), // Tema específico para redação
  generoTextual: z.string().optional(), // Gênero textual esperado (dissertativo-argumentativo, carta, etc)
  minimoLinhas: z.number().optional(), // Mínimo de linhas
  maximoLinhas: z.number().optional(), // Máximo de linhas
  // Campo para tipo "outros"
  tipoCustomizado: z.string().optional(), // Descrição do tipo customizado
  instrucoesEspecificas: z.string().optional(), // Instruções específicas para a questão
});

export type AvaliacaoQuestao = z.infer<typeof avaliacaoQuestaoSchema>;

// Template/Modelo de prova pré-definido pelo diretor
export const avaliacaoTemplateSchema = z.object({
  id: z.string(),
  nome: z.string().min(1, "Nome do template é obrigatório"),
  descricao: z.string().optional(),
  tipo: z.enum(["cabecalho", "completo"]), // cabecalho = só header, completo = prova inteira
  conteudoHtml: z.string().optional(), // HTML do template para impressão
  arquivoUrl: z.string().optional(), // URL de arquivo Word/PDF modelo
  arquivoNome: z.string().optional(),
  criadoPor: z.string(), // ID do diretor
  criadoPorNome: z.string(),
  dataCriacao: z.string(),
  dataAtualizacao: z.string().optional(),
  ativo: z.boolean().default(true),
});

export const insertAvaliacaoTemplateSchema = avaliacaoTemplateSchema.omit({ id: true });

export type AvaliacaoTemplate = z.infer<typeof avaliacaoTemplateSchema>;
export type InsertAvaliacaoTemplate = z.infer<typeof insertAvaliacaoTemplateSchema>;

// Avaliação principal (prova, simulado, atividade)
export const avaliacaoSchema = z.object({
  id: z.string(),
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().optional(),
  tipo: z.enum(["prova", "simulado", "atividade", "trabalho"]),
  materia: z.string().min(1, "Matéria é obrigatória"),
  
  // Criador
  professorId: z.string(),
  professorNome: z.string(),
  
  // Destinatários
  destinatarioTipo: z.enum(["turma", "alunos_especificos"]),
  turmaId: z.string().optional(), // Se destinatarioTipo === "turma"
  turmaNome: z.string().optional(),
  alunosIds: z.array(z.string()).optional(), // Se destinatarioTipo === "alunos_especificos"
  alunosNomes: z.array(z.string()).optional(),
  
  // Datas e prazos
  dataInicio: z.string(), // Data/hora que fica disponível para os alunos
  dataFim: z.string(), // Data/hora limite para entrega
  duracaoMinutos: z.number().optional(), // Tempo máximo para realizar (opcional)
  
  // Pontuação
  valorTotal: z.number().default(10), // Valor total da avaliação
  pesoNota: z.number().optional(), // Peso na média (opcional)
  
  // Modelo da avaliação
  modeloTipo: z.enum(["questoes", "arquivo_anexo", "template"]),
  questoes: z.array(avaliacaoQuestaoSchema).optional(), // Se modeloTipo === "questoes"
  arquivoUrl: z.string().optional(), // Se modeloTipo === "arquivo_anexo" (arquivo criado externamente)
  arquivoNome: z.string().optional(),
  templateId: z.string().optional(), // Se modeloTipo === "template"
  instrucoes: z.string().optional(), // Instruções adicionais para os alunos
  
  // Status
  status: z.enum(["rascunho", "agendada", "em_andamento", "encerrada", "cancelada"]).default("rascunho"),
  
  // Configurações
  permitirAtraso: z.boolean().default(false), // Se permite entrega atrasada com autorização
  mostrarGabarito: z.boolean().default(false), // Se mostra gabarito após correção
  mostrarNota: z.boolean().default(true), // Se mostra nota para o aluno
  embaralharQuestoes: z.boolean().default(false), // Se embaralha ordem das questões
  embaralharOpcoes: z.boolean().default(false), // Se embaralha opções das questões objetivas
  
  // Data limite para correção (definida pelo diretor)
  dataLimiteCorrecao: z.string().optional(), // Prazo para o professor corrigir
  
  // Metadados
  dataCriacao: z.string(),
  dataAtualizacao: z.string().optional(),
  dataPublicacao: z.string().optional(), // Quando foi publicada
});

export const insertAvaliacaoSchema = avaliacaoSchema.omit({ id: true, dataCriacao: true, status: true });

export type Avaliacao = z.infer<typeof avaliacaoSchema>;
export type InsertAvaliacao = z.infer<typeof insertAvaliacaoSchema>;

// Resposta individual do aluno para cada questão
export const avaliacaoRespostaSchema = z.object({
  questaoId: z.string(),
  resposta: z.string(), // Texto da resposta ou letra da opção
  arquivoUrl: z.string().optional(), // Arquivo anexado à resposta (se permitido)
  arquivoNome: z.string().optional(),
  nota: z.number().optional(), // Nota atribuída pelo professor
  feedback: z.string().optional(), // Feedback do professor para esta questão
  marcacao: z.enum(["certo", "errado", "parcial"]).optional(), // Marcação do professor: certo (100%), errado (0%), parcial (50%)
  valorObtido: z.number().optional(), // Valor obtido na questão baseado na marcação
});

export type AvaliacaoResposta = z.infer<typeof avaliacaoRespostaSchema>;

// Entrega/Submissão do aluno
export const avaliacaoEntregaSchema = z.object({
  id: z.string(),
  avaliacaoId: z.string(),
  avaliacaoTitulo: z.string(),
  avaliacaoTipo: z.enum(["prova", "simulado", "atividade", "trabalho"]),
  
  // Aluno
  alunoId: z.string(),
  alunoNome: z.string(),
  alunoMatricula: z.string().optional(),
  turmaId: z.string().optional(),
  turmaNome: z.string().optional(),
  
  // Datas
  dataInicio: z.string().optional(), // Quando o aluno iniciou
  dataEnvio: z.string().optional(), // Quando o aluno enviou
  
  // Respostas
  respostas: z.array(avaliacaoRespostaSchema).optional(), // Para avaliações com questões
  arquivoUrl: z.string().optional(), // Arquivo enviado pelo aluno
  arquivoNome: z.string().optional(),
  
  // Status e notas
  status: z.enum(["nao_iniciada", "em_andamento", "enviada", "atrasada", "corrigida", "autorizada"]).default("nao_iniciada"),
  nota: z.number().optional(), // Nota final
  notaPercentual: z.number().optional(), // Nota em percentual (0-100)
  feedback: z.string().optional(), // Feedback geral do professor
  
  // Correção
  corrigidoPor: z.string().optional(), // ID do professor/diretor que corrigiu
  corrigidoPorNome: z.string().optional(),
  dataCorrecao: z.string().optional(),
  
  // Liberação para o aluno
  liberadoParaAluno: z.boolean().default(false), // Se a correção foi liberada para visualização do aluno
  dataLiberacao: z.string().optional(), // Data em que foi liberada
  
  // Autorização para atraso
  atrasadaAutorizada: z.boolean().default(false),
  autorizadoPor: z.string().optional(),
  autorizadoPorNome: z.string().optional(),
  dataAutorizacao: z.string().optional(),
  motivoAutorizacao: z.string().optional(),
});

export const insertAvaliacaoEntregaSchema = avaliacaoEntregaSchema.omit({ id: true });

export type AvaliacaoEntrega = z.infer<typeof avaliacaoEntregaSchema>;
export type InsertAvaliacaoEntrega = z.infer<typeof insertAvaliacaoEntregaSchema>;

// Autorização para entrega atrasada
export const autorizacaoAtrasoSchema = z.object({
  id: z.string(),
  avaliacaoId: z.string(),
  avaliacaoTitulo: z.string(),
  alunoId: z.string(),
  alunoNome: z.string(),
  alunoMatricula: z.string().optional(),
  
  // Solicitação
  motivoSolicitacao: z.string().optional(), // Motivo apresentado pelo aluno (se aplicável)
  dataSolicitacao: z.string().optional(),
  
  // Autorização
  autorizado: z.boolean().default(false),
  autorizadoPor: z.string().optional(),
  autorizadoPorNome: z.string().optional(),
  dataAutorizacao: z.string().optional(),
  novaDataLimite: z.string().optional(), // Nova data limite concedida
  observacao: z.string().optional(), // Observação do professor/diretor
  
  dataCriacao: z.string(),
});

export const insertAutorizacaoAtrasoSchema = autorizacaoAtrasoSchema.omit({ id: true });

export type AutorizacaoAtraso = z.infer<typeof autorizacaoAtrasoSchema>;
export type InsertAutorizacaoAtraso = z.infer<typeof insertAutorizacaoAtrasoSchema>;

// ==================== BOLETIM ESCOLAR ====================

// Lista de matérias padrão
export const MATERIAS_BOLETIM = [
  "Português",
  "Matemática",
  "História",
  "Geografia",
  "Ciências",
  "Inglês",
  "Educação Física",
  "Artes",
  "Redação",
  "Literatura",
  "Física",
  "Química",
  "Biologia",
  "Filosofia",
  "Sociologia",
] as const;

// Notas por período (bimestre ou trimestre)
export const boletimNotaSchema = z.object({
  materia: z.string(),
  notas: z.record(z.string(), z.number().nullable()), // { "1º Bimestre": 8.5, "2º Bimestre": null, ... }
  mediaFinal: z.number().nullable().optional(),
  mediaEsperada: z.number().optional().default(7),
});

export type BoletimNota = z.infer<typeof boletimNotaSchema>;

// Boletim Escolar completo (1 boletim por bimestre por aluno)
export const boletimSchema = z.object({
  id: z.string(),
  
  // Informações do aluno
  alunoId: z.string(),
  alunoNome: z.string(),
  alunoMatricula: z.string().optional(),
  
  // Informações da escola/turma
  escola: z.string().default("Preparatório Vestibulando"),
  turmaId: z.string().optional(),
  turmaNome: z.string(),
  anoLetivo: z.string(), // Ex: "2025"
  
  // Identificador do bimestre (1, 2, 3 ou 4) - cada aluno tem 1 boletim por bimestre
  bimestreNumero: z.number().min(1).max(4).default(1),
  
  // Configuração do período
  periodoTipo: z.enum(["bimestre", "trimestre"]).default("bimestre"),
  periodos: z.array(z.string()).optional(), // Ex: ["1º Bimestre", "2º Bimestre", ...]
  
  // Notas por matéria
  materias: z.array(boletimNotaSchema),
  
  // Médias gerais
  mediaGeral: z.number().nullable().optional(), // Média de todas as matérias
  mediaGeralEsperada: z.number().optional().default(7),
  
  // Situação
  situacao: z.enum(["cursando", "aprovado", "reprovado"]).default("cursando"),
  
  // Frequência
  presencas: z.number().default(0),
  faltas: z.number().default(0),
  percentualPresenca: z.number().nullable().optional(), // Calculado: (presencas / (presencas + faltas)) * 100
  
  // Observações
  observacoes: z.string().optional(),
  observacoesProfessor: z.string().optional(),
  
  // Controle de liberação (diretoria libera para alunos)
  liberado: z.boolean().default(false),
  liberadoEm: z.string().optional(),
  liberadoPor: z.string().optional(),
  liberadoPorNome: z.string().optional(),
  
  // Personalização
  logoUrl: z.string().optional(),
  
  // Metadados
  criadoPor: z.string(),
  criadoPorNome: z.string(),
  dataCriacao: z.string(),
  dataAtualizacao: z.string().optional(),
});

export const insertBoletimSchema = boletimSchema.omit({ id: true, dataCriacao: true });

export type Boletim = z.infer<typeof boletimSchema>;
export type InsertBoletim = z.infer<typeof insertBoletimSchema>;

// Configurações globais de liberação de boletins
export const boletimConfigSchema = z.object({
  id: z.string(),
  anoLetivo: z.string(),
  turmaId: z.string().optional(), // Se não especificado, aplica a todas as turmas
  turmaNome: z.string().optional(),
  
  // Controle de liberação global
  liberacaoGlobal: z.boolean().default(false), // Se true, todos os boletins desta turma/ano ficam visíveis
  liberadoEm: z.string().optional(),
  liberadoPor: z.string().optional(),
  liberadoPorNome: z.string().optional(),
  
  // Configurações de período
  periodoTipo: z.enum(["bimestre", "trimestre"]).default("bimestre"),
  periodosAtivos: z.array(z.string()).optional(), // Quais períodos estão liberados para visualização
  
  // Metadados
  dataCriacao: z.string(),
  dataAtualizacao: z.string().optional(),
});

export const insertBoletimConfigSchema = boletimConfigSchema.omit({ id: true, dataCriacao: true });

export type BoletimConfig = z.infer<typeof boletimConfigSchema>;
export type InsertBoletimConfig = z.infer<typeof insertBoletimConfigSchema>;

// Documento de Boletim PDF - armazenado na documentação do aluno
export const boletimDocumentoSchema = z.object({
  id: z.string(),
  
  // Referência ao boletim original
  boletimId: z.string(),
  
  // Informações do aluno
  alunoId: z.string(),
  alunoNome: z.string(),
  alunoMatricula: z.string().optional(),
  
  // Informações da turma/ano
  turmaId: z.string().optional(),
  turmaNome: z.string(),
  anoLetivo: z.string(),
  
  // PDF em base64
  pdfBase64: z.string(),
  
  // Metadados
  situacao: z.enum(["cursando", "aprovado", "reprovado"]),
  mediaGeral: z.number().nullable().optional(),
  
  // Controle de versão
  versao: z.number().default(1),
  
  // Quem criou/atualizou
  criadoPor: z.string(),
  criadoPorNome: z.string(),
  dataCriacao: z.string(),
  atualizadoPor: z.string().optional(),
  atualizadoPorNome: z.string().optional(),
  dataAtualizacao: z.string().optional(),
});

export const insertBoletimDocumentoSchema = boletimDocumentoSchema.omit({ id: true });

export type BoletimDocumento = z.infer<typeof boletimDocumentoSchema>;
export type InsertBoletimDocumento = z.infer<typeof insertBoletimDocumentoSchema>;

// Registro de frequência/presença
export const frequenciaSchema = z.object({
  id: z.string(),
  alunoId: z.string(),
  alunoNome: z.string(),
  turmaId: z.string().optional(),
  turmaNome: z.string().optional(),
  
  // Data e tipo
  data: z.string(), // Data da aula
  materia: z.string().optional(),
  tipo: z.enum(["presente", "ausente", "justificada"]).default("presente"),
  
  // Justificativa (se ausência justificada)
  justificativa: z.string().optional(),
  
  // Quem registrou
  registradoPor: z.string(),
  registradoPorNome: z.string(),
  dataCriacao: z.string(),
});

export const insertFrequenciaSchema = frequenciaSchema.omit({ id: true, dataCriacao: true });

export type Frequencia = z.infer<typeof frequenciaSchema>;
export type InsertFrequencia = z.infer<typeof insertFrequenciaSchema>;

// ==================== BIMESTRES E LANÇAMENTO DE NOTAS ====================

// Configuração de bimestre (definido pela diretoria)
export const bimestreConfigSchema = z.object({
  id: z.string(),
  ano: z.string(), // Ex: "2025"
  numero: z.number().min(1).max(4), // 1, 2, 3 ou 4
  nome: z.string(), // Ex: "1º Bimestre"
  dataInicio: z.string(), // Data de início do bimestre
  dataFim: z.string(), // Data de fim do bimestre
  prazoLancamentoNotas: z.string(), // Data limite para professores lançarem notas
  mediaEsperada: z.number().default(7), // Média esperada para aprovação
  ativo: z.boolean().default(true), // Se o bimestre está ativo
  
  // Metadados
  criadoPor: z.string(),
  criadoPorNome: z.string(),
  dataCriacao: z.string(),
  dataAtualizacao: z.string().optional(),
});

export const insertBimestreConfigSchema = bimestreConfigSchema.omit({ id: true, dataCriacao: true });

export type BimestreConfig = z.infer<typeof bimestreConfigSchema>;
export type InsertBimestreConfig = z.infer<typeof insertBimestreConfigSchema>;

// Lançamento de notas por bimestre (professor lança)
export const notaBimestreSchema = z.object({
  id: z.string(),
  
  // Referências
  bimestreConfigId: z.string(), // ID do bimestre config
  ano: z.string(), // Ano letivo
  bimestreNumero: z.number().min(1).max(4), // Número do bimestre
  
  // Turma e matéria
  turmaId: z.string(),
  turmaNome: z.string(),
  materia: z.string(), // Disciplina/matéria
  
  // Aluno
  alunoId: z.string(),
  alunoNome: z.string(),
  alunoMatricula: z.string().optional(),
  
  // Professor que lançou
  professorId: z.string(),
  professorNome: z.string(),
  
  // Nota
  nota: z.number().min(0).max(10).nullable(), // Nota de 0 a 10 (null se não lançada)
  mediaEsperada: z.number().default(7), // Média esperada
  observacao: z.string().optional(), // Observação do professor
  
  // Status e datas
  status: z.enum(["rascunho", "entregue"]).default("rascunho"), // rascunho = pode editar, entregue = fechado
  dataLancamento: z.string().optional(), // Data/hora do lançamento
  dataEntrega: z.string().optional(), // Data/hora em que foi marcado como entregue
  
  // Autorização para edição (após notas entregues)
  edicaoAutorizada: z.boolean().default(false), // Se diretor autorizou edição
  edicaoAutorizadaPor: z.string().optional(), // ID do diretor que autorizou
  edicaoAutorizadaPorNome: z.string().optional(), // Nome do diretor
  dataAutorizacaoEdicao: z.string().optional(), // Data/hora da autorização
  motivoSolicitacaoEdicao: z.string().optional(), // Motivo enviado pelo professor
  
  // Metadados
  dataCriacao: z.string(),
  dataAtualizacao: z.string().optional(),
});

export const insertNotaBimestreSchema = notaBimestreSchema.omit({ id: true, dataCriacao: true });

export type NotaBimestre = z.infer<typeof notaBimestreSchema>;
export type InsertNotaBimestre = z.infer<typeof insertNotaBimestreSchema>;

// ==================== SOLICITAÇÃO DE AUTORIZAÇÃO PARA EDIÇÃO DE NOTAS ====================

// Solicitação de autorização para editar nota já entregue
export const solicitacaoEdicaoNotaSchema = z.object({
  id: z.string(),
  
  // Referências da nota
  notaBimestreId: z.string(), // ID da nota que quer editar
  alunoId: z.string(),
  alunoNome: z.string(),
  alunoMatricula: z.string().optional(),
  turmaId: z.string(),
  turmaNome: z.string(),
  materia: z.string(),
  bimestreNumero: z.number().min(1).max(4),
  bimestreNome: z.string(),
  ano: z.string(),
  
  // Nota atual
  notaAtual: z.number().min(0).max(10).nullable(),
  
  // Solicitação
  professorId: z.string(), // Professor que solicitou
  professorNome: z.string(),
  motivo: z.string().min(1, "Motivo é obrigatório"), // Justificativa para alteração
  dataSolicitacao: z.string(),
  
  // Resposta do diretor
  status: z.enum(["pendente", "autorizado", "negado"]).default("pendente"),
  diretorId: z.string().optional(), // Diretor que respondeu
  diretorNome: z.string().optional(),
  dataResposta: z.string().optional(),
  comentarioDiretor: z.string().optional(), // Comentário do diretor na resposta
});

export const insertSolicitacaoEdicaoNotaSchema = solicitacaoEdicaoNotaSchema.omit({ id: true });

export type SolicitacaoEdicaoNota = z.infer<typeof solicitacaoEdicaoNotaSchema>;
export type InsertSolicitacaoEdicaoNota = z.infer<typeof insertSolicitacaoEdicaoNotaSchema>;

// ==================== SISTEMA DE HORÁRIOS E GRADE ====================

// Dias da semana para horários
export const DIAS_SEMANA = [
  "domingo",
  "segunda",
  "terca", 
  "quarta",
  "quinta",
  "sexta",
  "sabado",
] as const;

export type DiaSemana = typeof DIAS_SEMANA[number];

// Schema para um horário de aula individual (personalizável pelo diretor)
export const horarioAulaSchema = z.object({
  id: z.string(),
  nome: z.string(),
  inicio: z.string(),
  fim: z.string(),
  tipo: z.enum(["aula", "intervalo"]).default("aula"),
  ativo: z.boolean().default(true),
});

export type HorarioAula = z.infer<typeof horarioAulaSchema>;

// Horários padrão das aulas (legado - usar HORARIOS_AULAS_PADRAO quando possível)
export const HORARIOS_AULAS: HorarioAula[] = [
  { id: "1", inicio: "07:00", fim: "07:50", nome: "1ª Aula", tipo: "aula", ativo: true },
  { id: "2", inicio: "07:50", fim: "08:40", nome: "2ª Aula", tipo: "aula", ativo: true },
  { id: "3", inicio: "08:40", fim: "09:30", nome: "3ª Aula", tipo: "aula", ativo: true },
  { id: "4", inicio: "09:45", fim: "10:35", nome: "4ª Aula", tipo: "aula", ativo: true },
  { id: "5", inicio: "10:35", fim: "11:25", nome: "5ª Aula", tipo: "aula", ativo: true },
  { id: "6", inicio: "11:25", fim: "12:15", nome: "6ª Aula", tipo: "aula", ativo: true },
  { id: "7", inicio: "13:30", fim: "14:20", nome: "7ª Aula", tipo: "aula", ativo: true },
  { id: "8", inicio: "14:20", fim: "15:10", nome: "8ª Aula", tipo: "aula", ativo: true },
  { id: "9", inicio: "15:10", fim: "16:00", nome: "9ª Aula", tipo: "aula", ativo: true },
  { id: "10", inicio: "16:15", fim: "17:05", nome: "10ª Aula", tipo: "aula", ativo: true },
];

// Slot de aula na grade horária
export const slotAulaSchema = z.object({
  diaSemana: z.enum(DIAS_SEMANA),
  horarioId: z.string(), // ID do horário (1-10)
  materia: z.string(),
  professorId: z.string(),
  professorNome: z.string(),
});

export type SlotAula = z.infer<typeof slotAulaSchema>;

// Configuração de matéria na grade (quantas aulas por semana)
export const configuracaoMateriaSchema = z.object({
  materia: z.string(),
  professorId: z.string(),
  professorNome: z.string(),
  aulasPorSemana: z.number().min(1).max(10),
});

export type ConfiguracaoMateria = z.infer<typeof configuracaoMateriaSchema>;

// Grade Horária completa de uma turma
export const gradeHorariaSchema = z.object({
  id: z.string(),
  turmaId: z.string(),
  turmaNome: z.string(),
  anoLetivo: z.string(),
  
  // Configuração de matérias
  configMaterias: z.array(configuracaoMateriaSchema).default([]),
  
  // Grade de aulas por dia/horário
  slots: z.array(slotAulaSchema).default([]),
  
  // Status da grade
  status: z.enum(["rascunho", "publicado"]).default("rascunho"),
  
  // Metadados
  criadoPor: z.string(),
  criadoPorNome: z.string(),
  dataCriacao: z.string(),
  dataPublicacao: z.string().optional(),
  dataAtualizacao: z.string().optional(),
  
  // Histórico de versões
  versao: z.number().default(1),
});

export const insertGradeHorariaSchema = gradeHorariaSchema.omit({ id: true, dataCriacao: true });

export type GradeHoraria = z.infer<typeof gradeHorariaSchema>;
export type InsertGradeHoraria = z.infer<typeof insertGradeHorariaSchema>;

// Aula agendada (instância de uma aula em um dia específico)
export const aulaAgendadaSchema = z.object({
  id: z.string(),
  gradeHorariaId: z.string(),
  turmaId: z.string(),
  turmaNome: z.string(),
  
  // Dados da aula
  data: z.string(), // Data específica (YYYY-MM-DD)
  diaSemana: z.enum(DIAS_SEMANA),
  horarioId: z.string(),
  horarioInicio: z.string(),
  horarioFim: z.string(),
  
  // Matéria e professor
  materia: z.string(),
  professorId: z.string(),
  professorNome: z.string(),
  
  // Status da aula
  status: z.enum(["agendada", "em_andamento", "concluida", "cancelada"]).default("agendada"),
  
  // Confirmação de presença do professor
  professorConfirmou: z.boolean().default(false),
  professorConfirmouEm: z.string().optional(),
  
  // Observações
  observacao: z.string().optional(),
  motivoCancelamento: z.string().optional(),
  
  // Metadados
  dataCriacao: z.string(),
});

export const insertAulaAgendadaSchema = aulaAgendadaSchema.omit({ id: true, dataCriacao: true });

export type AulaAgendada = z.infer<typeof aulaAgendadaSchema>;
export type InsertAulaAgendada = z.infer<typeof insertAulaAgendadaSchema>;

// Presença em aula (registro individual de presença)
export const presencaAulaSchema = z.object({
  id: z.string(),
  aulaAgendadaId: z.string(),
  turmaId: z.string(),
  data: z.string(), // Data da aula
  
  // Dados do aluno
  alunoId: z.string(),
  alunoNome: z.string(),
  alunoMatricula: z.string().optional(),
  
  // Status da presença
  status: z.enum(["aguardando", "presente", "ausente", "justificado"]).default("aguardando"),
  
  // Confirmação pelo aluno
  alunoConfirmou: z.boolean().default(false),
  alunoConfirmouEm: z.string().optional(),
  
  // Confirmação pelo professor
  professorConfirmou: z.boolean().default(false),
  professorConfirmouEm: z.string().optional(),
  professorConfirmouId: z.string().optional(),
  
  // Justificativa (se ausente justificado)
  justificativa: z.string().optional(),
  justificativaAprovada: z.boolean().optional(),
  justificativaAprovadaPor: z.string().optional(),
  justificativaAprovadaPorNome: z.string().optional(),
  
  // Metadados
  dataCriacao: z.string(),
  dataAtualizacao: z.string().optional(),
});

export const insertPresencaAulaSchema = presencaAulaSchema.omit({ id: true, dataCriacao: true });

export type PresencaAula = z.infer<typeof presencaAulaSchema>;
export type InsertPresencaAula = z.infer<typeof insertPresencaAulaSchema>;

// Registro de presenças em lote (por aula/horário)
export const registroPresencaItemSchema = z.object({
  alunoId: z.string(),
  alunoNome: z.string(),
  presente: z.boolean(),
  justificativa: z.string().optional(),
});

export const registroPresencaTurmaSchema = z.object({
  id: z.string(),
  gradeHorariaId: z.string(),
  turmaId: z.string(),
  turmaNome: z.string(),
  horarioId: z.string(),
  materia: z.string(),
  professorId: z.string(),
  professorNome: z.string(),
  data: z.string(), // YYYY-MM-DD
  presencas: z.array(registroPresencaItemSchema),
  registradoPorId: z.string(),
  registradoPorNome: z.string(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});

export const insertRegistroPresencaTurmaSchema = registroPresencaTurmaSchema.omit({ id: true });

export type RegistroPresencaItem = z.infer<typeof registroPresencaItemSchema>;
export type RegistroPresencaTurma = z.infer<typeof registroPresencaTurmaSchema>;
export type InsertRegistroPresencaTurma = z.infer<typeof insertRegistroPresencaTurmaSchema>;

// Notificação de alteração de horário
export const notificacaoHorarioSchema = z.object({
  id: z.string(),
  
  // Destinatário
  destinatarioId: z.string(),
  destinatarioTipo: z.enum(["aluno", "professor"]),
  
  // Tipo de notificação
  tipo: z.enum(["novo_horario", "alteracao_horario", "cancelamento_aula", "lembrete_aula"]),
  
  // Referências
  gradeHorariaId: z.string().optional(),
  aulaAgendadaId: z.string().optional(),
  turmaId: z.string(),
  turmaNome: z.string(),
  
  // Conteúdo
  titulo: z.string(),
  mensagem: z.string(),
  
  // Status
  lida: z.boolean().default(false),
  lidaEm: z.string().optional(),
  
  // Metadados
  dataCriacao: z.string(),
});

export const insertNotificacaoHorarioSchema = notificacaoHorarioSchema.omit({ id: true, dataCriacao: true });

export type NotificacaoHorario = z.infer<typeof notificacaoHorarioSchema>;
export type InsertNotificacaoHorario = z.infer<typeof insertNotificacaoHorarioSchema>;

// Histórico de alterações na grade horária
export const historicoGradeSchema = z.object({
  id: z.string(),
  gradeHorariaId: z.string(),
  turmaId: z.string(),
  turmaNome: z.string(),
  
  // Tipo de alteração
  tipoAlteracao: z.enum(["criacao", "publicacao", "alteracao_slot", "remocao_slot", "cancelamento"]),
  
  // Descrição
  descricao: z.string(),
  
  // Dados anteriores e novos (para reversão se necessário)
  dadosAnteriores: z.any().optional(),
  dadosNovos: z.any().optional(),
  
  // Quem fez a alteração
  alteradoPor: z.string(),
  alteradoPorNome: z.string(),
  
  // Metadados
  dataAlteracao: z.string(),
});

export const insertHistoricoGradeSchema = historicoGradeSchema.omit({ id: true });

export type HistoricoGrade = z.infer<typeof historicoGradeSchema>;
export type InsertHistoricoGrade = z.infer<typeof insertHistoricoGradeSchema>;

// Preferência de disponibilidade do professor
export const disponibilidadeProfessorSchema = z.object({
  id: z.string(),
  professorId: z.string(),
  professorNome: z.string(),
  
  // Disponibilidade por dia e horário
  disponibilidade: z.record(z.enum(DIAS_SEMANA), z.array(z.string())).default({}), // dia -> array de horarioIds disponíveis
  
  // Preferências
  maxAulasDia: z.number().default(6), // Máximo de aulas por dia
  maxAulasConsecutivas: z.number().default(3), // Máximo de aulas consecutivas
  
  // Observações
  observacoes: z.string().optional(),
  
  // Metadados
  dataAtualizacao: z.string().optional(),
});

export const insertDisponibilidadeProfessorSchema = disponibilidadeProfessorSchema.omit({ id: true });

export type DisponibilidadeProfessor = z.infer<typeof disponibilidadeProfessorSchema>;
export type InsertDisponibilidadeProfessor = z.infer<typeof insertDisponibilidadeProfessorSchema>;

// ==================== CONFIGURAÇÃO DE HORÁRIOS PERSONALIZADOS ====================

// Schema para configuração geral de horários da escola (salvo no Firestore)
export const configuracaoHorariosSchema = z.object({
  id: z.string(),
  
  // Lista de horários configurados
  horarios: z.array(horarioAulaSchema).default([]),
  
  // Dias da semana ativos
  diasAtivos: z.array(z.enum(DIAS_SEMANA)).default(["segunda", "terca", "quarta", "quinta", "sexta"]),
  
  // Metadados
  criadoPor: z.string(),
  criadoPorNome: z.string(),
  dataCriacao: z.string(),
  dataAtualizacao: z.string().optional(),
  
  // Nome da configuração (para permitir múltiplas configurações futuras)
  nome: z.string().default("Padrão"),
  ativo: z.boolean().default(true),
});

export const insertConfiguracaoHorariosSchema = configuracaoHorariosSchema.omit({ id: true, dataCriacao: true });

export type ConfiguracaoHorarios = z.infer<typeof configuracaoHorariosSchema>;
export type InsertConfiguracaoHorarios = z.infer<typeof insertConfiguracaoHorariosSchema>;

// ==================== CALENDÁRIO DE PROGRAMAÇÃO ====================

// Schema para evento no calendário de programação
export const eventoCalendarioSchema = z.object({
  id: z.string(),
  
  // Dados do evento
  titulo: z.string(),
  descricao: z.string().optional(),
  tipo: z.enum(["aula", "reuniao", "feriado", "recesso", "evento", "prova", "outro"]),
  
  // Data e horário
  dataInicio: z.string(), // YYYY-MM-DD ou ISO string
  dataFim: z.string().optional(), // Para eventos de múltiplos dias
  horarioInicio: z.string().optional(), // HH:mm
  horarioFim: z.string().optional(), // HH:mm
  diaInteiro: z.boolean().default(false),
  
  // Associações
  turmaId: z.string().optional(),
  turmaNome: z.string().optional(),
  professorId: z.string().optional(),
  professorNome: z.string().optional(),
  materia: z.string().optional(),
  
  // Recorrência
  recorrente: z.boolean().default(false),
  tipoRecorrencia: z.enum(["diario", "semanal", "mensal"]).optional(),
  diasRecorrencia: z.array(z.enum(DIAS_SEMANA)).optional(),
  
  // Cor para exibição no calendário
  cor: z.string().optional(),
  
  // Status
  status: z.enum(["agendado", "confirmado", "cancelado", "concluido"]).default("agendado"),
  
  // Metadados
  criadoPor: z.string(),
  criadoPorNome: z.string(),
  dataCriacao: z.string(),
  dataAtualizacao: z.string().optional(),
});

export const insertEventoCalendarioSchema = eventoCalendarioSchema.omit({ id: true, dataCriacao: true });

export type EventoCalendario = z.infer<typeof eventoCalendarioSchema>;
export type InsertEventoCalendario = z.infer<typeof insertEventoCalendarioSchema>;

// Horários padrão para inicialização (usado quando não há configuração salva)
export const HORARIOS_AULAS_PADRAO: HorarioAula[] = [
  { id: "1", inicio: "07:00", fim: "07:50", nome: "1ª Aula", tipo: "aula", ativo: true },
  { id: "2", inicio: "07:50", fim: "08:40", nome: "2ª Aula", tipo: "aula", ativo: true },
  { id: "3", inicio: "08:40", fim: "09:30", nome: "3ª Aula", tipo: "aula", ativo: true },
  { id: "i1", inicio: "09:30", fim: "09:45", nome: "Intervalo", tipo: "intervalo", ativo: true },
  { id: "4", inicio: "09:45", fim: "10:35", nome: "4ª Aula", tipo: "aula", ativo: true },
  { id: "5", inicio: "10:35", fim: "11:25", nome: "5ª Aula", tipo: "aula", ativo: true },
  { id: "6", inicio: "11:25", fim: "12:15", nome: "6ª Aula", tipo: "aula", ativo: true },
  { id: "i2", inicio: "12:15", fim: "13:30", nome: "Almoço", tipo: "intervalo", ativo: true },
  { id: "7", inicio: "13:30", fim: "14:20", nome: "7ª Aula", tipo: "aula", ativo: true },
  { id: "8", inicio: "14:20", fim: "15:10", nome: "8ª Aula", tipo: "aula", ativo: true },
  { id: "9", inicio: "15:10", fim: "16:00", nome: "9ª Aula", tipo: "aula", ativo: true },
  { id: "i3", inicio: "16:00", fim: "16:15", nome: "Intervalo", tipo: "intervalo", ativo: true },
  { id: "10", inicio: "16:15", fim: "17:05", nome: "10ª Aula", tipo: "aula", ativo: true },
];
