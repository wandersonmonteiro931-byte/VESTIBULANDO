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
  ativo: z.boolean().default(true),
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
});

export const insertDisciplinaryActionSchema = disciplinaryActionSchema.omit({ id: true });

export type DisciplinaryAction = z.infer<typeof disciplinaryActionSchema>;
export type InsertDisciplinaryAction = z.infer<typeof insertDisciplinaryActionSchema>;

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
