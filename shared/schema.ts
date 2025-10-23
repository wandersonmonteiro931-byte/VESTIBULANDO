import { z } from "zod";

// User schema - tipos: aluno, professor, diretor
// status: pendente (aguardando aprovação), aprovado (pode logar), reprovado (não pode logar), devolvido (precisa fazer correções)
export const userSchema = z.object({
  uid: z.string(),
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  tipo: z.enum(["aluno", "professor", "diretor"]),
  turma: z.string().optional(),
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
  // Campo para controlar primeiro acesso e troca de senha
  primeiroAcesso: z.boolean().optional().default(true), // true se ainda não alterou a senha inicial
  // Campos de foto
  fotoBase64: z.string().optional(), // Foto 3x4 em Base64
  fotoPublica: z.boolean().optional().default(false), // se true, foto visível para todos; se false, apenas para diretor
  // Campos obrigatórios para alunos
  dataNascimento: z.string().optional(),
  cpf: z.string().optional(),
  escolaridade: z.string().optional(), // ensino fundamental, médio, superior
  telefone: z.string().optional(), // WhatsApp
  cep: z.string().optional(),
  rua: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  disponibilidade: z.array(z.string()).optional(), // horários disponíveis para estudo
});

// Schema para cadastro de aluno (todos os campos obrigatórios)
export const alunoRegistrationSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  dataNascimento: z.string().min(1, "Data de nascimento é obrigatória"),
  cpf: z.string().min(1, "CPF é obrigatório"),
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

export const insertUserSchema = userSchema.omit({ uid: true });

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type AlunoRegistration = z.infer<typeof alunoRegistrationSchema>;

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

// Announcement schema - avisos para alunos e professores
export const announcementSchema = z.object({
  id: z.string(),
  tipo: z.enum(["texto", "imagem"]), // tipo de aviso: texto ou imagem
  conteudo: z.string(), // texto do aviso ou URL da imagem em base64
  publicoAlvo: z.enum(["alunos", "professores", "turmas"]), // para quem é o aviso
  turmasSelecionadas: z.array(z.string()).optional(), // IDs das turmas específicas (se publicoAlvo === "turmas")
  ativo: z.boolean().default(true), // se o aviso está ativo
  criadoPor: z.string(), // ID do diretor que criou
  criadoPorNome: z.string(), // Nome do diretor
  dataCriacao: z.string(), // Data de criação
  dataAtualizacao: z.string().optional(), // Data da última atualização
});

export const insertAnnouncementSchema = announcementSchema.omit({ id: true });

export type Announcement = z.infer<typeof announcementSchema>;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
