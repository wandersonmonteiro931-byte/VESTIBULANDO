import { z } from "zod";

// User schema - tipos: aluno, professor, admin
// status: pendente (aguardando aprovação), aprovado (pode logar), reprovado (não pode logar)
export const userSchema = z.object({
  uid: z.string(),
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  tipo: z.enum(["aluno", "professor", "admin"]),
  turma: z.string().optional(),
  ativo: z.boolean().default(true),
  status: z.enum(["pendente", "aprovado", "reprovado"]).default("pendente"),
  codigoSolicitacao: z.string().optional(),
  comentarioReprovacao: z.string().optional(),
  dataSolicitacao: z.string().optional(),
});

export const insertUserSchema = userSchema.omit({ uid: true });

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

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
});

export const insertTurmaSchema = turmaSchema.omit({ id: true });

export type Turma = z.infer<typeof turmaSchema>;
export type InsertTurma = z.infer<typeof insertTurmaSchema>;
