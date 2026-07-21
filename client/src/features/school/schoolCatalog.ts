export type SchoolRole =
  | "diretor"
  | "administrador"
  | "secretaria"
  | "coordenador"
  | "professor"
  | "professor_substituto"
  | "monitor"
  | "financeiro"
  | "bibliotecario"
  | "psicologo"
  | "inspetor"
  | "aluno"
  | "responsavel"
  | "funcionario"
  | "rh"
  | "cantina"
  | "transporte";

export type ModuleCategory =
  | "fundacao"
  | "academico"
  | "portais"
  | "cuidado"
  | "administracao"
  | "governanca";

export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "datetime-local"
  | "time"
  | "select"
  | "checkbox";

export interface SchoolFieldDefinition {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  help?: string;
}

export interface SchoolModuleDefinition {
  id: string;
  number: number;
  title: string;
  shortTitle: string;
  category: ModuleCategory;
  description: string;
  workflows: string[];
  capabilities: string[];
  statuses: string[];
  fields: SchoolFieldDefinition[];
  restricted?: boolean;
  existingResources?: string[];
}

export const SCHOOL_ROLE_LABELS: Record<SchoolRole, string> = {
  diretor: "Diretor",
  administrador: "Administrador",
  secretaria: "Secretaria",
  coordenador: "Coordenador pedagógico",
  professor: "Professor",
  professor_substituto: "Professor substituto",
  monitor: "Monitor",
  financeiro: "Financeiro",
  bibliotecario: "Bibliotecário",
  psicologo: "Psicólogo/orientador",
  inspetor: "Inspetor",
  aluno: "Aluno",
  responsavel: "Pai, mãe ou responsável",
  funcionario: "Funcionário administrativo",
  rh: "Recursos humanos",
  cantina: "Cantina",
  transporte: "Transporte escolar",
};

export const SCHOOL_CATEGORIES: Array<{ id: ModuleCategory; label: string; description: string }> = [
  { id: "fundacao", label: "Estrutura", description: "Instituição, pessoas, matrículas e organização acadêmica" },
  { id: "academico", label: "Acadêmico", description: "Calendário, diário, aprendizagem, avaliações e documentos" },
  { id: "portais", label: "Portais", description: "Experiências do aluno, professor, família e comunicação" },
  { id: "cuidado", label: "Cuidado", description: "Disciplina, segurança, bem-estar e inclusão" },
  { id: "administracao", label: "Administração", description: "Financeiro, secretaria, inteligência e operações" },
  { id: "governanca", label: "Governança", description: "Privacidade, acessibilidade, integrações e continuidade" },
];

const standardStatuses = ["rascunho", "pendente", "em análise", "aprovado", "concluído", "cancelado"];

const field = (
  key: string,
  label: string,
  kind: FieldKind = "text",
  options?: string[],
  required = false,
  help?: string,
): SchoolFieldDefinition => ({ key, label, kind, options, required, help });

export const SCHOOL_MODULES: SchoolModuleDefinition[] = [
  {
    id: "instituicao",
    number: 1,
    title: "Configuração da instituição",
    shortTitle: "Instituição",
    category: "fundacao",
    description: "Identidade, unidades, períodos letivos e regras acadêmicas configuráveis.",
    workflows: ["Cadastro institucional", "Unidade, polo ou campus", "Sala e ambiente", "Ano/período letivo", "Turno e horário", "Feriado/recesso", "Regra acadêmica", "Curso e modalidade"],
    capabilities: ["Cadastro da instituição, CNPJ, endereço, contatos e responsáveis", "Unidades, polos, campus e salas", "Logo, cores, documentos e identidade visual", "Anos e períodos letivos", "Turnos, horários e intervalos", "Feriados, recessos e dias letivos", "Regras de notas, médias, arredondamentos e frequência", "Cursos, níveis, séries, módulos e modalidades", "Configuração independente por unidade, curso ou turma"],
    statuses: ["rascunho", "ativo", "inativo", "arquivado"],
    fields: [field("cnpj", "CNPJ"), field("tipoUnidade", "Tipo de unidade", "select", ["Matriz", "Filial", "Polo", "Campus", "Sala", "Laboratório"]), field("endereco", "Endereço", "textarea"), field("responsavel", "Responsável"), field("anoLetivo", "Ano letivo", "number"), field("frequenciaMinima", "Frequência mínima (%)", "number"), field("regraMedia", "Regra de média e arredondamento", "textarea")],
  },
  {
    id: "acessos",
    number: 2,
    title: "Usuários e permissões",
    shortTitle: "Acessos",
    category: "fundacao",
    description: "Contas, papéis, menor privilégio, sessões, MFA e delegações temporárias.",
    workflows: ["Conta de acesso", "Perfil de permissão", "Permissão individual", "Delegação temporária", "Sessão e dispositivo", "Redefinição de senha", "Revisão de acesso"],
    capabilities: ["Diretor", "Administrador", "Secretaria", "Coordenador pedagógico", "Professor", "Professor substituto", "Monitor", "Financeiro", "Bibliotecário", "Psicólogo/orientador", "Inspetor", "Aluno", "Pai, mãe e responsável", "Funcionários administrativos", "Permissões individuais por função", "Bloqueio, suspensão e desativação de contas", "Redefinição e troca obrigatória de senha", "Autenticação em duas etapas", "Histórico de login, dispositivo, data, horário e IP", "Encerramento remoto das sessões", "Delegação temporária de acesso"],
    statuses: ["pendente", "ativo", "bloqueado", "suspenso", "expirado", "revogado"],
    fields: [field("papel", "Papel", "select", Object.values(SCHOOL_ROLE_LABELS), true), field("permissoes", "Permissões adicionais", "textarea"), field("mfa", "MFA obrigatório", "checkbox"), field("delegadoPor", "Delegado por"), field("validade", "Validade da delegação", "datetime-local"), field("motivo", "Motivo", "textarea")],
    restricted: true,
    existingResources: ["usuarios", "loginHistory"],
  },
  {
    id: "alunos",
    number: 3,
    title: "Cadastro completo do aluno",
    shortTitle: "Alunos",
    category: "fundacao",
    description: "Prontuário cadastral, médico, documental, acessibilidade e consentimentos.",
    workflows: ["Dados pessoais", "Documentação", "Endereço e contatos", "Histórico escolar", "Saúde e emergência", "Acessibilidade", "Pessoa autorizada", "Guarda/restrição", "Consentimento", "Alteração cadastral"],
    capabilities: ["Nome completo e nome social", "CPF, RG e certidão de nascimento", "Matrícula automática ou personalizada", "Data de nascimento, sexo e nacionalidade", "Foto", "Endereço e contatos", "Escolaridade anterior", "Dados médicos, alergias e medicamentos", "Deficiência, TEA, altas habilidades ou necessidades especiais", "Recursos de acessibilidade necessários", "Contatos de emergência", "Documentos digitalizados", "Responsáveis vinculados", "Pessoas autorizadas a buscar o estudante", "Situação de guarda ou restrição judicial", "Consentimento para imagem, comunicação e tratamento de dados", "Histórico completo de alterações cadastrais"],
    statuses: ["incompleto", "em conferência", "regular", "com pendência", "arquivado"],
    fields: [field("nomeSocial", "Nome social"), field("cpf", "CPF"), field("rg", "RG"), field("certidao", "Certidão de nascimento"), field("nacionalidade", "Nacionalidade"), field("dadosMedicos", "Dados médicos, alergias e medicamentos", "textarea"), field("acessibilidade", "Necessidades e recursos de acessibilidade", "textarea"), field("emergencia", "Contato de emergência"), field("consentimentos", "Consentimentos registrados", "textarea")],
    restricted: true,
    existingResources: ["usuarios", "solicitacoes"],
  },
  {
    id: "responsaveis",
    number: 4,
    title: "Responsáveis e família",
    shortTitle: "Família",
    category: "fundacao",
    description: "Vínculos familiares, guarda, permissões e acompanhamento dos filhos.",
    workflows: ["Vínculo familiar", "Responsável financeiro", "Responsável pedagógico", "Guarda compartilhada", "Autorização", "Assinatura", "Justificativa", "Reunião"],
    capabilities: ["Vários responsáveis por aluno", "Um responsável ligado a vários filhos", "Responsável financeiro separado do responsável pedagógico", "Guarda compartilhada", "Permissões diferentes para cada responsável", "Visualização de notas, faltas, ocorrências e pagamentos", "Assinatura de documentos", "Justificativa de ausência", "Autorização para atividades e passeios", "Recebimento de comunicados", "Confirmação de leitura", "Reuniões com professores e coordenação"],
    statuses: ["convite pendente", "ativo", "restrito", "revogado"],
    fields: [field("parentesco", "Parentesco", "select", ["Mãe", "Pai", "Responsável legal", "Tutor", "Avó/avô", "Outro"], true), field("filhos", "Alunos vinculados", "textarea"), field("perfil", "Perfil", "select", ["Financeiro", "Pedagógico", "Ambos"]), field("guarda", "Situação de guarda", "textarea"), field("permissoesFamilia", "Permissões do responsável", "textarea")],
    restricted: true,
  },
  {
    id: "matriculas",
    number: 5,
    title: "Inscrição, matrícula e rematrícula",
    shortTitle: "Matrículas",
    category: "fundacao",
    description: "Jornada completa do candidato ao arquivamento, com vagas e documentos.",
    workflows: ["Inscrição on-line", "Processo seletivo", "Lista de espera", "Conferência documental", "Matrícula provisória", "Matrícula definitiva", "Contrato e assinatura", "Bolsa/reserva", "Rematrícula", "Mudança", "Transferência", "Trancamento", "Cancelamento", "Evasão", "Conclusão"],
    capabilities: ["Formulário de inscrição on-line", "Processo seletivo, prova e entrevista", "Lista de espera", "Número de vagas por turma", "Conferência automática de documentos", "Aprovar, reprovar ou devolver cadastro para correção", "Matrícula provisória e definitiva", "Geração de contrato", "Assinatura eletrônica", "Matrícula gratuita, paga ou com bolsa", "Reserva de vaga", "Rematrícula anual", "Mudança de curso, turma, turno ou unidade", "Transferência de entrada e saída", "Trancamento", "Cancelamento", "Abandono/evasão", "Conclusão e arquivamento", "Detecção de aluno duplicado"],
    statuses: ["inscrição", "seleção", "lista de espera", "documentos pendentes", "provisória", "matriculado", "trancado", "transferido", "cancelado", "evadido", "concluído"],
    fields: [field("candidatoCpf", "CPF do candidato"), field("curso", "Curso"), field("turma", "Turma"), field("modalidadePagamento", "Modalidade", "select", ["Gratuita", "Paga", "Bolsa parcial", "Bolsa integral"]), field("etapa", "Etapa do processo"), field("documentos", "Conferência de documentos", "textarea"), field("duplicidade", "Verificação de duplicidade", "checkbox")],
    existingResources: ["solicitacoes", "turmas"],
  },
  {
    id: "estrutura-academica",
    number: 6,
    title: "Estrutura acadêmica",
    shortTitle: "Estrutura acadêmica",
    category: "fundacao",
    description: "Matrizes, componentes, modalidades, capacidades e vínculos docentes.",
    workflows: ["Curso/série/módulo", "Matriz curricular", "Componente curricular", "Pré-requisito/crédito", "Itinerário/eletiva", "Turma regular", "Turma especial", "Reforço/recuperação", "Vínculo docente", "Mudança estrutural"],
    capabilities: ["Cursos, séries, anos, módulos e etapas", "Matriz curricular", "Disciplinas e componentes curriculares", "Carga horária obrigatória e cumprida", "Pré-requisitos", "Créditos", "Itinerários formativos", "Disciplinas eletivas", "Turmas regulares e especiais", "Turmas de reforço e recuperação", "Educação presencial, híbrida e a distância", "Vínculo entre professores, disciplinas e turmas", "Vagas e capacidade máxima", "Histórico das mudanças de estrutura"],
    statuses: ["rascunho", "em revisão", "vigente", "substituído", "arquivado"],
    fields: [field("nivel", "Nível/série/módulo"), field("modalidade", "Modalidade", "select", ["Presencial", "Híbrida", "A distância"]), field("cargaHoraria", "Carga horária", "number"), field("creditos", "Créditos", "number"), field("preRequisitos", "Pré-requisitos", "textarea"), field("capacidade", "Capacidade máxima", "number"), field("vinculoDocente", "Professor, disciplina e turma")],
    existingResources: ["turmas", "materiasCustomizadas"],
  },
  {
    id: "calendario-horarios",
    number: 7,
    title: "Calendário e horários",
    shortTitle: "Calendário",
    category: "academico",
    description: "Agenda letiva, grades, reservas e prevenção de conflitos.",
    workflows: ["Evento letivo", "Bimestre/período", "Prova/recuperação", "Grade semanal", "Aula extra/reposição", "Substituição", "Reserva de sala", "Alteração emergencial"],
    capabilities: ["Calendário letivo anual", "Feriados, recessos e eventos", "Início e encerramento de bimestres", "Períodos de prova e recuperação", "Grade horária semanal", "Horário individual do aluno e professor", "Controle de choque de professor, sala ou turma", "Aulas extras e reposições", "Substituição de professor", "Reserva de salas e laboratórios", "Alterações emergenciais", "Notificação automática de mudança", "Impressão e exportação em PDF"],
    statuses: ["planejado", "confirmado", "alterado", "realizado", "cancelado"],
    fields: [field("inicio", "Início", "datetime-local", undefined, true), field("fim", "Fim", "datetime-local"), field("sala", "Sala/laboratório"), field("professor", "Professor"), field("turma", "Turma"), field("tipoMudanca", "Tipo", "select", ["Regular", "Extra", "Reposição", "Substituição", "Reserva", "Emergencial"]), field("notificar", "Notificar envolvidos", "checkbox")],
    existingResources: ["eventosCalendario", "gradesHorarias", "configuracaoHorarios", "bimestresConfig"],
  },
  {
    id: "diario-planejamento",
    number: 8,
    title: "Diário de classe e planejamento",
    shortTitle: "Diário",
    category: "academico",
    description: "Planejamento, aula ministrada, aprovação pedagógica e assinatura.",
    workflows: ["Plano anual", "Plano bimestral", "Plano de aula", "Diário eletrônico", "Aula realizada", "Aula cancelada", "Aula reposta", "Aprovação da coordenação", "Assinatura docente"],
    capabilities: ["Diário eletrônico", "Plano anual, bimestral e de aula", "Conteúdo ministrado por aula", "Objetivos de aprendizagem", "Habilidades e competências", "Material utilizado", "Tarefa atribuída", "Observações sobre a turma", "Registro de aula realizada, cancelada ou reposta", "Aprovação do planejamento pela coordenação", "Histórico de alterações", "Assinatura digital do professor"],
    statuses: ["rascunho", "enviado", "em revisão", "aprovado", "devolvido", "assinado", "fechado"],
    fields: [field("disciplina", "Disciplina", "text", undefined, true), field("turma", "Turma", "text", undefined, true), field("objetivos", "Objetivos de aprendizagem", "textarea"), field("habilidades", "Habilidades e competências", "textarea"), field("conteudo", "Conteúdo ministrado", "textarea"), field("materiais", "Materiais utilizados", "textarea"), field("situacaoAula", "Situação", "select", ["Planejada", "Realizada", "Cancelada", "Reposta"]), field("assinatura", "Assinatura digital confirmada", "checkbox")],
  },
  {
    id: "frequencia",
    number: 9,
    title: "Presença e frequência",
    shortTitle: "Frequência",
    category: "academico",
    description: "Chamada, justificativas, alertas, carga horária e fechamento auditável.",
    workflows: ["Chamada por aula", "Chamada diária", "Correção de presença", "Justificativa/atestado", "Análise de justificativa", "Alerta de falta", "Fechamento de chamada", "Relatório de frequência"],
    capabilities: ["Chamada por aula ou por dia", "Presente, ausente, atrasado, saída antecipada e justificado", "Chamada individual ou em massa", "Confirmação do professor", "Correção com autorização", "Justificativa com anexo de atestado", "Aprovação ou recusa da justificativa", "Frequência por aluno, matéria, turma, mês e período", "Carga horária frequentada", "Alertas de excesso de faltas", "Comunicação automática ao responsável", "Relatório de alunos ausentes", "Presença em aula on-line", "Histórico de quem alterou cada registro", "Fechamento e bloqueio da chamada", "Controle da frequência mínima configurável, com referência inicial de 75% quando aplicável", "Emissão de históricos, declarações e certificados baseada na frequência"],
    statuses: ["aberta", "confirmada", "correção solicitada", "justificada", "fechada", "bloqueada"],
    fields: [field("aluno", "Aluno"), field("disciplina", "Disciplina"), field("situacao", "Situação", "select", ["Presente", "Ausente", "Atrasado", "Saída antecipada", "Justificado"], true), field("cargaMinutos", "Minutos frequentados", "number"), field("percentual", "Frequência acumulada (%)", "number"), field("frequenciaMinima", "Frequência mínima aplicável (%)", "number", undefined, false, "Use 75% como referência inicial quando esta for a regra da instituição."), field("justificativa", "Justificativa", "textarea"), field("fechada", "Chamada fechada", "checkbox")],
    existingResources: ["registroPresencas", "chamadasDiarias", "registrosPresencaChamada", "presencasAulaAoVivo"],
  },
  {
    id: "atividades",
    number: 10,
    title: "Atividades, trabalhos e tarefas",
    shortTitle: "Atividades",
    category: "academico",
    description: "Criação, entrega, correção, rubricas, grupos e controle de versões.",
    workflows: ["Atividade", "Trabalho em grupo", "Entrega", "Reenvio", "Correção", "Rubrica", "Feedback privado", "Análise de semelhança", "Notificação de prazo"],
    capabilities: ["Criar atividades por turma e disciplina", "Descrição, prazo e pontuação", "Arquivos, imagens, vídeos e links", "Entrega pelo aluno", "Entrega atrasada ou bloqueada", "Reenvio autorizado", "Correção individual", "Nota e feedback", "Rubricas e critérios", "Comentários privados", "Histórico das versões", "Plágio ou semelhança de respostas", "Atividades em grupo", "Lista de entregues e pendentes", "Notificação de prazo próximo"],
    statuses: ["rascunho", "programada", "aberta", "entregue", "atrasada", "em correção", "avaliada", "fechada"],
    fields: [field("disciplina", "Disciplina"), field("turma", "Turma"), field("prazo", "Prazo", "datetime-local"), field("pontuacao", "Pontuação", "number"), field("rubrica", "Rubrica e critérios", "textarea"), field("grupo", "Atividade em grupo", "checkbox"), field("reenvio", "Reenvio autorizado", "checkbox"), field("feedback", "Feedback privado", "textarea")],
    existingResources: ["tarefas", "entregas"],
  },
  {
    id: "avaliacoes",
    number: 11,
    title: "Avaliações e provas",
    shortTitle: "Avaliações",
    category: "academico",
    description: "Provas presenciais/on-line, banco de questões, correção e análise pedagógica.",
    workflows: ["Banco de questão", "Prova presencial", "Prova on-line", "Segunda chamada", "Recuperação", "Substitutiva", "Adaptação", "Gabarito", "Correção/revisão", "Recurso de nota", "Estatística de questão"],
    capabilities: ["Prova presencial ou on-line", "Banco de questões", "Questões objetivas, discursivas e de múltipla escolha", "Imagens, áudio e vídeo", "Sorteio de questões e alternativas", "Tempo limite", "Senha de acesso", "Correção automática e manual", "Segunda chamada", "Recuperação", "Prova substitutiva", "Adaptação para aluno com necessidade especial", "Gabarito", "Revisão e recurso de nota", "Liberação programada do resultado", "Estatísticas por questão", "Detecção dos conteúdos com maior dificuldade"],
    statuses: ["rascunho", "agendada", "liberada", "em aplicação", "em correção", "resultado programado", "publicada", "encerrada"],
    fields: [field("modalidade", "Modalidade", "select", ["Presencial", "On-line"]), field("tipoQuestao", "Questões", "select", ["Objetivas", "Discursivas", "Múltipla escolha", "Mistas"]), field("duracao", "Tempo limite (minutos)", "number"), field("senhaAcesso", "Senha de acesso"), field("sorteio", "Sortear questões e alternativas", "checkbox"), field("adaptacao", "Adaptação necessária", "textarea"), field("liberacaoResultado", "Liberação do resultado", "datetime-local")],
    existingResources: ["avaliacoes", "avaliacaoEntregas"],
  },
  {
    id: "notas-boletim",
    number: 12,
    title: "Notas, médias e boletim",
    shortTitle: "Notas e boletim",
    category: "academico",
    description: "Cálculo configurável, fechamentos, conselho de classe e resultados finais.",
    workflows: ["Lançamento de nota", "Configuração de média", "Recuperação", "Segunda chamada", "Fechamento de período", "Reabertura", "Boletim parcial", "Boletim final", "Conselho de classe", "Resultado final"],
    capabilities: ["Lançamento de notas", "Pesos diferentes", "Média simples ou ponderada", "Notas por atividade, prova e participação", "Arredondamento configurável", "Recuperação paralela e final", "Segunda chamada", "Nota substitutiva", "Conceitos em vez de números", "Faltas por disciplina", "Boletim parcial e final", "Comparação entre períodos", "Média da turma", "Ranking somente quando permitido", "Bloqueio do período após fechamento", "Autorização para reabrir notas", "Histórico de alterações", "Conselho de classe", "Resultado: aprovado, reprovado, transferido, desistente ou em andamento"],
    statuses: ["aberto", "em lançamento", "em conferência", "fechado", "reabertura solicitada", "reaberto", "homologado"],
    fields: [field("metodo", "Método de média", "select", ["Simples", "Ponderada", "Conceitos"]), field("peso", "Peso", "number"), field("nota", "Nota", "number"), field("mediaMinima", "Média mínima aplicável", "number"), field("conceito", "Conceito"), field("arredondamento", "Arredondamento", "select", ["Nenhum", "Uma casa", "Inteiro", "Para cima"]), field("rankingPermitido", "Ranking permitido", "checkbox"), field("resultado", "Resultado", "select", ["Em andamento", "Aprovado", "Reprovado", "Transferido", "Desistente"]), field("justificativaReabertura", "Justificativa de reabertura", "textarea")],
    restricted: true,
    existingResources: ["boletins", "boletimDocumentos", "autorizacoesNotas"],
  },
  {
    id: "acompanhamento",
    number: 13,
    title: "Recuperação e acompanhamento pedagógico",
    shortTitle: "Acompanhamento",
    category: "academico",
    description: "Risco acadêmico, planos individualizados, atendimentos e evolução.",
    workflows: ["Alerta de baixo rendimento", "Plano de recuperação", "Atividade de reforço", "Meta de aprendizagem", "Atendimento", "Parecer docente", "Parecer da coordenação", "Reunião familiar", "Conselho de classe", "PEI", "Risco de evasão"],
    capabilities: ["Identificação automática de baixo rendimento", "Plano de recuperação individual", "Atividades de reforço", "Metas de aprendizagem", "Registro de atendimento", "Parecer do professor", "Parecer do coordenador", "Acompanhamento por disciplina", "Reuniões com responsáveis", "Conselho de classe", "Plano educacional individualizado", "Evolução histórica", "Alertas de risco de reprovação ou evasão"],
    statuses: ["risco identificado", "plano aberto", "em acompanhamento", "meta atingida", "encaminhado", "concluído"],
    fields: [field("aluno", "Aluno", "text", undefined, true), field("disciplina", "Disciplina"), field("risco", "Nível de risco", "select", ["Baixo", "Moderado", "Alto", "Crítico"]), field("meta", "Meta de aprendizagem", "textarea"), field("plano", "Plano de recuperação/PEI", "textarea"), field("parecerProfessor", "Parecer do professor", "textarea"), field("parecerCoordenador", "Parecer da coordenação", "textarea"), field("proximoAtendimento", "Próximo atendimento", "datetime-local")],
    restricted: true,
  },
  {
    id: "conteudos",
    number: 14,
    title: "Conteúdos e ambiente virtual",
    shortTitle: "Conteúdos",
    category: "academico",
    description: "Biblioteca didática organizada, programada, rastreável e certificável.",
    workflows: ["Material didático", "Módulo", "Aula/assunto", "Liberação programada", "Trilha obrigatória", "Trilha complementar", "Dúvida/comentário", "Certificado", "Direitos e validade"],
    capabilities: ["Materiais por disciplina", "Apostilas, PDFs, apresentações e vídeos", "Organização por módulo, aula e assunto", "Liberação programada", "Controle do progresso", "Favoritos", "Busca", "Download permitido ou bloqueado", "Comentários e dúvidas", "Conteúdo obrigatório ou complementar", "Registro de visualização", "Certificado por conclusão", "Controle de direitos e validade do material"],
    statuses: ["rascunho", "programado", "publicado", "expirado", "arquivado"],
    fields: [field("disciplina", "Disciplina"), field("modulo", "Módulo/aula/assunto"), field("tipoMaterial", "Tipo", "select", ["Apostila", "PDF", "Apresentação", "Vídeo", "Link", "Áudio"]), field("liberacao", "Liberação", "datetime-local"), field("validade", "Validade", "date"), field("obrigatorio", "Conteúdo obrigatório", "checkbox"), field("downloadPermitido", "Permitir download", "checkbox"), field("direitos", "Direitos de uso", "textarea")],
  },
  {
    id: "aulas-ao-vivo",
    number: 15,
    title: "Aulas ao vivo e gravadas",
    shortTitle: "Aulas ao vivo",
    category: "academico",
    description: "Agendamento, sala interativa, presença, gravação e relatório.",
    workflows: ["Agendamento", "Sala ao vivo", "Participante", "Presença automática", "Gravação", "Material da aula", "Relatório", "Publicação posterior"],
    capabilities: ["Criar e agendar aula", "Sala exclusiva para cada turma", "Professor, monitor e alunos", "Áudio, vídeo e compartilhamento de tela", "Quadro branco", "Chat da aula", "Levantar a mão", "Lista de participantes", "Controle de microfone e câmera", "Presença automática com confirmação", "Tempo de permanência", "Gravação", "Disponibilização posterior", "Materiais da aula", "Encerramento pelo professor", "Relatório da aula"],
    statuses: ["agendada", "sala aberta", "em andamento", "encerrada", "processando gravação", "publicada", "cancelada"],
    fields: [field("turma", "Turma"), field("professor", "Professor"), field("monitor", "Monitor"), field("inicio", "Início", "datetime-local"), field("duracao", "Duração prevista (minutos)", "number"), field("gravacao", "Gravação habilitada", "checkbox"), field("urlGravacao", "URL da gravação"), field("relatorio", "Relatório da aula", "textarea")],
    existingResources: ["sessoesAulaAoVivo", "presencasAulaAoVivo"],
  },
  {
    id: "documentos-escolares",
    number: 16,
    title: "Documentos escolares",
    shortTitle: "Documentos",
    category: "academico",
    description: "Emissão autenticável, assinatura, modelos por unidade e arquivo permanente.",
    workflows: ["Declaração de matrícula", "Declaração de frequência", "Histórico escolar", "Boletim", "Ficha individual", "Ata de resultados", "Certificado/diploma", "Conclusão", "Transferência", "Contrato", "Termo/autorização", "Carteirinha", "Modelo personalizado", "Cancelamento de documento"],
    capabilities: ["Declaração de matrícula", "Declaração de frequência", "Histórico escolar", "Boletim", "Ficha individual", "Ata de resultados", "Certificado e diploma", "Declaração de conclusão", "Transferência", "Contrato", "Termos e autorizações", "Carteirinha estudantil", "Documentos personalizados", "Numeração automática", "Assinatura eletrônica", "QR Code ou código para validar autenticidade", "Registro de emissão, download e cancelamento", "Modelos diferentes por unidade", "Arquivo permanente dos documentos"],
    statuses: ["solicitado", "em elaboração", "aguardando assinatura", "emitido", "baixado", "cancelado", "arquivado"],
    fields: [field("aluno", "Aluno"), field("numero", "Número automático"), field("unidade", "Unidade/modelo"), field("assinante", "Assinante"), field("codigoValidacao", "Código de validação"), field("emissao", "Data de emissão", "date"), field("arquivoPermanente", "Arquivo permanente", "checkbox"), field("motivoCancelamento", "Motivo do cancelamento", "textarea")],
    restricted: true,
    existingResources: ["boletimDocumentos", "documentosInternos"],
  },
  {
    id: "portal-aluno",
    number: 17,
    title: "Portal do aluno",
    shortTitle: "Portal do aluno",
    category: "portais",
    description: "Experiência integrada do estudante com autosserviço e preferências.",
    workflows: ["Resumo do aluno", "Agenda e horário", "Desempenho", "Conteúdos/aulas", "Financeiro", "Documentos", "Ocorrências", "Solicitação", "Atualização cadastral", "Preferência de notificação"],
    capabilities: ["Página inicial com resumo", "Horários e calendário", "Presenças", "Atividades e avaliações", "Notas e boletim", "Conteúdos", "Aulas ao vivo", "Financeiro", "Documentos", "Avisos", "Chat", "Ocorrências", "Solicitações à secretaria", "Atualização cadastral", "Troca de senha", "Preferências de notificação"],
    statuses: ["disponível", "pendente", "em processamento", "concluído"],
    fields: [field("preferencias", "Preferências de notificação", "textarea"), field("atualizacao", "Atualização cadastral solicitada", "textarea"), field("canal", "Canal preferido", "select", ["Aplicativo", "E-mail", "WhatsApp", "SMS"]), field("notificacoes", "Notificações ativadas", "checkbox")],
    existingResources: ["tarefas", "entregas", "avaliacoes", "boletins", "financialInvoices", "announcements"],
  },
  {
    id: "portal-professor",
    number: 18,
    title: "Portal do professor",
    shortTitle: "Portal docente",
    category: "portais",
    description: "Ambiente docente completo para planejamento, ensino, avaliação e comunicação.",
    workflows: ["Turma/disciplina", "Diário/chamada", "Plano de aula", "Conteúdo", "Atividade/prova", "Correção/nota", "Recuperação", "Relatório", "Aula ao vivo", "Ocorrência", "Substituição", "Obrigação"],
    capabilities: ["Turmas e disciplinas", "Horários", "Diário", "Chamada", "Plano de aula", "Conteúdos", "Criação de atividades e provas", "Correção", "Notas", "Boletins", "Recuperação", "Relatórios da turma", "Aulas ao vivo", "Solicitação de ocorrência disciplinar", "Comunicação com alunos e responsáveis", "Substituições", "Calendário de obrigações"],
    statuses: ["a fazer", "em andamento", "enviado", "aprovado", "concluído", "atrasado"],
    fields: [field("turma", "Turma"), field("disciplina", "Disciplina"), field("obrigacao", "Obrigação docente"), field("prazo", "Prazo", "datetime-local"), field("substituto", "Professor substituto"), field("relatorio", "Relatório/observações", "textarea")],
    existingResources: ["tarefas", "avaliacoes", "boletins", "registroPresencas", "disciplinaryRequests", "sessoesAulaAoVivo"],
  },
  {
    id: "portal-responsaveis",
    number: 19,
    title: "Portal dos responsáveis",
    shortTitle: "Portal da família",
    category: "portais",
    description: "Todos os filhos, acompanhamento em tempo real e interação com a escola.",
    workflows: ["Painel dos filhos", "Frequência/notas", "Atividade pendente", "Ocorrência", "Financeiro", "Documento", "Comunicado", "Autorização", "Reunião", "Justificativa de falta", "Atualização de contato"],
    capabilities: ["Todos os filhos na mesma conta", "Frequência em tempo real", "Notas e boletim", "Atividades pendentes", "Ocorrências", "Financeiro", "Documentos", "Comunicados", "Autorizações", "Reuniões", "Justificativa de faltas", "Atualização de contatos", "Comunicação com professores e escola"],
    statuses: ["novo", "aguardando ciência", "confirmado", "em atendimento", "concluído"],
    fields: [field("filho", "Aluno vinculado"), field("tipoInteracao", "Interação", "select", ["Autorização", "Justificativa", "Reunião", "Contato", "Comunicado"]), field("resposta", "Resposta/observação", "textarea"), field("ciente", "Ciência confirmada", "checkbox"), field("dataReuniao", "Data da reunião", "datetime-local")],
    restricted: true,
  },
  {
    id: "comunicacao",
    number: 20,
    title: "Comunicação",
    shortTitle: "Comunicação",
    category: "portais",
    description: "Comunicados segmentados, multicanal, programados e auditáveis.",
    workflows: ["Aviso geral", "Aviso segmentado", "Mensagem programada", "Modelo automático", "Emergência", "Grupo", "Confirmação de leitura", "Moderação/denúncia", "Janela de comunicação", "Fila multicanal"],
    capabilities: ["Avisos gerais", "Avisos por turma, curso ou usuário", "Chat individual e em grupo", "Comunicação professor–aluno", "Comunicação escola–responsável", "E-mail, notificação push e WhatsApp", "Confirmação de entrega e leitura", "Mensagens programadas", "Anexos, imagens, áudio e documentos", "Moderação", "Denúncia, bloqueio e exclusão", "Auditoria pela direção", "Horários permitidos para mensagens", "Modelos de mensagens automáticas", "Comunicação de emergência"],
    statuses: ["rascunho", "programada", "na fila", "enviada", "entregue", "lida", "falhou", "moderada"],
    fields: [field("publico", "Público", "select", ["Todos", "Curso", "Turma", "Usuário", "Responsáveis", "Professores"]), field("canais", "Canais", "textarea"), field("agendamento", "Agendamento", "datetime-local"), field("janela", "Horário permitido"), field("confirmacao", "Exigir confirmação de leitura", "checkbox"), field("emergencia", "Comunicação de emergência", "checkbox"), field("mensagem", "Mensagem", "textarea")],
    existingResources: ["announcements", "chatMessages", "chatConversations", "chatReports", "userBlocks"],
  },
  {
    id: "bem-estar",
    number: 21,
    title: "Disciplina, segurança e bem-estar",
    shortTitle: "Bem-estar",
    category: "cuidado",
    description: "Ocorrências, proteção, resposta, apoio e controle seguro de acesso.",
    workflows: ["Advertência", "Suspensão", "Ocorrência", "Pedido docente", "Direito de resposta", "Ciência", "Bullying/violência", "Denúncia sigilosa", "Atendimento psicológico", "Acidente", "Entrada/saída", "Plano de segurança"],
    capabilities: ["Advertência", "Suspensão", "Ocorrência", "Pedido do professor para análise", "Aprovação ou recusa pela direção", "Direito de resposta", "Ciência do aluno e responsável", "Histórico disciplinar", "Bullying e violência", "Canal de denúncia sigilosa", "Acompanhamento psicológico e pedagógico", "Registro de acidentes", "Contatos de emergência", "Controle de entrada e saída", "Pessoas autorizadas", "Plano de segurança escolar", "Restrição de acesso a informações sensíveis"],
    statuses: ["registrado", "em análise", "acolhimento", "resposta pendente", "aprovado", "recusado", "acompanhamento", "encerrado"],
    fields: [field("aluno", "Aluno"), field("natureza", "Natureza", "select", ["Disciplina", "Bullying", "Violência", "Acidente", "Entrada/saída", "Apoio psicológico", "Denúncia sigilosa"]), field("sigiloso", "Registro sigiloso", "checkbox"), field("direitoResposta", "Direito de resposta", "textarea"), field("responsavelCiente", "Responsável ciente", "checkbox"), field("encaminhamento", "Encaminhamento/plano de segurança", "textarea")],
    restricted: true,
    existingResources: ["disciplinaryActions", "disciplinaryRequests", "chatReports"],
  },
  {
    id: "inclusao",
    number: 22,
    title: "Inclusão e atendimento especializado",
    shortTitle: "Inclusão",
    category: "cuidado",
    description: "AEE, PEI, adaptações, apoios e evolução sob acesso restrito.",
    workflows: ["Cadastro de necessidade", "AEE", "PEI", "Adaptação de avaliação", "Profissional de apoio", "Intérprete de Libras", "Recurso de acessibilidade", "Sala de recursos", "Atendimento", "Relatório de evolução", "Dados Educacenso"],
    capabilities: ["Cadastro de deficiência, TEA e altas habilidades", "Atendimento educacional especializado", "Plano educacional individualizado", "Adaptações de provas e atividades", "Profissional de apoio", "Intérprete de Libras", "Recursos de acessibilidade", "Sala de recursos", "Registro de atendimentos", "Relatórios de evolução", "Compartilhamento restrito dessas informações", "Estrutura para vínculos de educação especial, intérpretes e auxiliares compatível com exportações censitárias"],
    statuses: ["identificado", "avaliação", "plano aberto", "em atendimento", "revisão", "concluído"],
    fields: [field("aluno", "Aluno", "text", undefined, true), field("necessidade", "Deficiência, TEA, altas habilidades ou necessidade", "textarea"), field("aee", "Atendimento educacional especializado", "textarea"), field("pei", "Plano educacional individualizado", "textarea"), field("adaptacoes", "Adaptações", "textarea"), field("profissionalApoio", "Profissional de apoio/intérprete"), field("salaRecursos", "Sala e recursos"), field("proximaRevisao", "Próxima revisão", "date")],
    restricted: true,
  },
  {
    id: "financeiro",
    number: 23,
    title: "Financeiro",
    shortTitle: "Financeiro",
    category: "administracao",
    description: "Cobrança, bolsas, caixa, conciliação, contabilidade e documentos fiscais.",
    workflows: ["Plano/mensalidade", "Matrícula/rematrícula", "Bolsa/desconto", "Cobrança avulsa", "Parcelamento/recorrência", "Pix/boleto/cartão", "Baixa", "Recibo/nota fiscal", "Cancelamento/estorno", "Renegociação", "Inadimplência", "Conta a pagar", "Conta a receber", "Centro de custo", "Conciliação", "Exportação contábil"],
    capabilities: ["Planos e mensalidades", "Matrícula e rematrícula", "Bolsa integral ou parcial", "Descontos e convênios", "Responsável financeiro", "Cobranças avulsas", "Parcelamento", "Pix, boleto e cartão", "Recorrência", "Multa, juros e desconto por antecipação", "Baixa automática e manual", "Comprovante e recibo", "Nota fiscal", "Cancelamento e estorno", "Renegociação", "Inadimplência", "Bloqueios configuráveis sem impedir acesso indevido a documentos", "Fluxo de caixa", "Contas a pagar e receber", "Centro de custos", "Relatórios financeiros", "Exportação contábil", "Conciliação bancária"],
    statuses: ["rascunho", "aberto", "aguardando pagamento", "pago", "vencido", "renegociado", "estornado", "cancelado", "conciliado"],
    fields: [field("responsavelFinanceiro", "Responsável financeiro"), field("valor", "Valor (R$)", "number"), field("vencimento", "Vencimento", "date"), field("formaPagamento", "Forma de pagamento", "select", ["Pix", "Boleto", "Cartão", "Dinheiro", "Transferência"]), field("parcelas", "Parcelas", "number"), field("bolsaDesconto", "Bolsa/desconto", "text"), field("centroCusto", "Centro de custo"), field("conciliado", "Conciliado", "checkbox")],
    restricted: true,
    existingResources: ["financialInvoices", "financialSettings", "scholarships"],
  },
  {
    id: "secretaria",
    number: 24,
    title: "Secretaria e solicitações",
    shortTitle: "Secretaria",
    category: "administracao",
    description: "Central de atendimento com protocolos, SLA, responsáveis e avaliação.",
    workflows: ["Solicitação de documento", "Segunda via", "Alteração cadastral", "Transferência", "Trancamento", "Cancelamento", "Revisão de nota", "Justificativa de ausência", "Atendimento geral"],
    capabilities: ["Central de atendimento", "Protocolos numerados", "Solicitação de documentos", "Segunda via", "Alteração cadastral", "Transferência", "Trancamento", "Cancelamento", "Revisão de nota", "Justificativa de ausência", "Prazo de atendimento", "Responsável pela solicitação", "Status e histórico", "Anexos", "Notificações", "Avaliação do atendimento"],
    statuses: ["aberto", "triagem", "em atendimento", "aguardando usuário", "deferido", "indeferido", "concluído", "cancelado"],
    fields: [field("protocolo", "Protocolo automático"), field("solicitante", "Solicitante"), field("prazo", "Prazo de atendimento", "datetime-local"), field("responsavel", "Responsável pelo atendimento"), field("detalhes", "Detalhes", "textarea"), field("notificar", "Notificar solicitante", "checkbox"), field("avaliacao", "Avaliação (1 a 5)", "number")],
  },
  {
    id: "relatorios",
    number: 25,
    title: "Relatórios e inteligência",
    shortTitle: "Relatórios",
    category: "administracao",
    description: "Indicadores, filtros, inconsistências e exportações acadêmicas/administrativas.",
    workflows: ["Matrículas/vagas", "Frequência", "Notas/médias", "Rendimento/movimentação", "Risco", "Desempenho", "Pendências", "Ocorrências", "Financeiro", "Uso/acessos", "Relatório personalizado", "Educacenso", "Inconsistências"],
    capabilities: ["Matrículas ativas e pendentes", "Vagas por turma", "Frequência", "Notas e médias", "Aprovação, reprovação e evasão", "Alunos em risco", "Desempenho por professor, matéria e turma", "Atividades pendentes", "Ocorrências", "Inadimplência", "Receitas e despesas", "Uso da plataforma", "Acessos e logins", "Relatórios personalizados", "Filtros e totalizadores", "Exportação para PDF, Excel e CSV", "Painéis com gráficos", "Dados para Educacenso", "Verificação de inconsistências", "Acompanhamento de matrícula inicial, rendimento e movimentação"],
    statuses: ["configurado", "gerando", "disponível", "com inconsistências", "validado", "arquivado"],
    fields: [field("indicadores", "Indicadores", "textarea"), field("filtros", "Filtros", "textarea"), field("periodoInicio", "Período inicial", "date"), field("periodoFim", "Período final", "date"), field("formato", "Formato", "select", ["Painel", "PDF", "Excel", "CSV", "Educacenso"]), field("inconsistencias", "Inconsistências detectadas", "textarea")],
    restricted: true,
    existingResources: ["loginHistory"],
  },
  {
    id: "operacoes",
    number: 26,
    title: "Recursos administrativos adicionais",
    shortTitle: "Operações",
    category: "administracao",
    description: "Serviços e recursos administrativos ativados conforme a oferta da instituição.",
    workflows: ["Biblioteca/empréstimo", "Transporte/rota", "Merenda/alimentação", "Cantina", "Estoque/compra", "Patrimônio", "Sala/equipamento", "Manutenção", "Chamado interno", "Evento/passeio", "Visitante", "RH", "Ponto", "Contrato/férias", "Folha de pagamento"],
    capabilities: ["Biblioteca e empréstimo de livros", "Transporte escolar e rotas", "Merenda e alimentação", "Cantina", "Estoque e compras", "Patrimônio", "Salas, laboratórios e equipamentos", "Manutenção", "Chamados internos", "Eventos, passeios e excursões", "Controle de visitantes", "Recursos humanos", "Ponto dos funcionários", "Contratos e férias", "Folha de pagamento"],
    statuses: ["disponível", "reservado", "em uso", "emprestado", "pendente", "em atendimento", "concluído", "inativo"],
    fields: [field("setor", "Setor", "select", ["Biblioteca", "Transporte", "Alimentação", "Cantina", "Estoque", "Patrimônio", "Infraestrutura", "Manutenção", "Eventos", "Portaria", "RH", "Folha"]), field("codigoItem", "Código/item"), field("quantidade", "Quantidade", "number"), field("responsavel", "Responsável"), field("inicio", "Início", "datetime-local"), field("fim", "Fim", "datetime-local"), field("custo", "Custo (R$)", "number"), field("observacao", "Observações", "textarea")],
    restricted: true,
    existingResources: ["systemMaintenance"],
  },
  {
    id: "lgpd-seguranca",
    number: 27,
    title: "Segurança e LGPD",
    shortTitle: "LGPD e segurança",
    category: "governanca",
    description: "Privacidade desde a concepção, direitos do titular, segurança e incidentes.",
    workflows: ["Política/termo", "Base legal", "Consentimento", "Direito do titular", "Retenção/descarte", "Exportação de dados", "Controle de sessão/MFA", "Revisão de menor privilégio", "Auditoria", "Tentativa excessiva", "Backup/recuperação", "Incidente", "Mapa de dados"],
    capabilities: ["Política de privacidade", "Termos de uso", "Política de cookies", "Registro da base legal de cada dado", "Consentimentos separados", "Consentimento do responsável quando aplicável", "Canal para o encarregado de dados", "Solicitação de acesso e correção dos dados", "Retenção e descarte seguro", "Exportação dos dados do titular", "Criptografia", "Senhas protegidas", "Controle de sessão", "MFA para direção", "Permissão pelo menor privilégio", "Logs de auditoria", "Registro de criação, alteração e exclusão", "Bloqueio contra tentativas excessivas", "Backups automáticos", "Plano de recuperação", "Comunicação de incidentes", "Separação entre dados financeiros, pedagógicos, médicos e disciplinares", "Nenhum dado sensível exposto desnecessariamente", "Proteção, privacidade e mecanismos de segurança adequados à idade e ao melhor interesse de crianças e adolescentes"],
    statuses: ["mapeado", "consentimento pendente", "vigente", "em atendimento", "em investigação", "mitigado", "encerrado"],
    fields: [field("categoriaDado", "Categoria de dado", "select", ["Cadastral", "Pedagógico", "Financeiro", "Médico", "Disciplinar", "Biométrico", "Comunicação"]), field("baseLegal", "Base legal"), field("retencao", "Prazo de retenção"), field("titular", "Titular"), field("consentimento", "Consentimento registrado", "checkbox"), field("encarregado", "Encarregado/DPO"), field("incidente", "Incidente e resposta", "textarea"), field("medidas", "Medidas técnicas e administrativas", "textarea")],
    restricted: true,
    existingResources: ["loginHistory"],
  },
  {
    id: "acessibilidade",
    number: 28,
    title: "Acessibilidade e experiência",
    shortTitle: "Acessibilidade",
    category: "governanca",
    description: "Experiência inclusiva, responsiva, resiliente e compatível com WCAG/eMAG.",
    workflows: ["Auditoria de acessibilidade", "Preferência individual", "Legenda/transcrição", "Correção de barreira", "Teste móvel/tablet", "Modo offline/lento", "Impressão", "PWA", "Usabilidade"],
    capabilities: ["Funcionamento em computador, celular e tablet", "PWA instalável", "Navegação por teclado", "Leitor de tela", "Texto ampliável", "Contraste adequado", "Legendas nos vídeos", "Transcrição de áudio", "Campos com rótulos claros", "Mensagens de erro compreensíveis", "Não depender apenas de cores", "Botões grandes no celular", "Modo claro e escuro", "Internet lenta", "Salvamento automático", "Confirmação antes de ações destrutivas", "Impressão adequada", "Acessibilidade baseada em WCAG/eMAG"],
    statuses: ["não avaliado", "em auditoria", "barreira identificada", "em correção", "validado", "monitorado"],
    fields: [field("criterio", "Critério WCAG/eMAG"), field("pagina", "Tela/fluxo"), field("impacto", "Impacto", "select", ["Baixo", "Médio", "Alto", "Crítico"]), field("tecnologiaAssistiva", "Tecnologia assistiva testada"), field("correcao", "Correção/aceite", "textarea"), field("validadoPor", "Validado por"), field("dataTeste", "Data do teste", "date")],
  },
  {
    id: "integracoes",
    number: 29,
    title: "Integrações e funcionamento técnico",
    shortTitle: "Integrações",
    category: "governanca",
    description: "Conectores, APIs, webhooks, filas, ambientes e observabilidade.",
    workflows: ["API", "Webhook", "Google/Microsoft Calendar", "E-mail/WhatsApp", "Banco/Pix", "Nota fiscal", "Assinatura eletrônica", "Videoconferência", "Arquivos", "Importação", "Exportação", "Educacenso", "Fila", "Erro/saúde", "Ambiente", "Atualização"],
    capabilities: ["API documentada", "Webhooks", "Google/Microsoft Calendar", "E-mail e WhatsApp", "Bancos e sistemas Pix", "Nota fiscal", "Assinatura eletrônica", "Videoconferência", "Armazenamento de arquivos", "Importação de alunos e notas", "Exportação para outros sistemas", "Integração com Educacenso quando aplicável", "Notificações em tempo real", "Funcionamento sem verificações contínuas desnecessárias", "Filas para operações demoradas", "Monitoramento de erros", "Painel de saúde do sistema", "Ambiente de testes separado da produção", "Atualizações sem perda de dados"],
    statuses: ["não configurado", "configurado", "teste pendente", "saudável", "degradado", "falha", "pausado"],
    fields: [field("provedor", "Provedor/conector"), field("ambiente", "Ambiente", "select", ["Teste", "Homologação", "Produção"]), field("endpoint", "Endpoint público"), field("evento", "Evento/webhook"), field("credencialRef", "Referência segura da credencial", "text", undefined, false, "Não informe segredos no navegador; registre apenas o nome da credencial configurada no servidor."), field("fila", "Usar fila", "checkbox"), field("ultimoTeste", "Último teste", "datetime-local"), field("retorno", "Resultado/saúde", "textarea")],
    restricted: true,
  },
  {
    id: "continuidade",
    number: 30,
    title: "Backup, auditoria e continuidade",
    shortTitle: "Continuidade",
    category: "governanca",
    description: "Versões, restauração, trilha imutável, backups e recuperação testada.",
    workflows: ["Backup diário", "Backup externo", "Teste de recuperação", "Versão", "Lixeira/restauração", "Auditoria crítica", "Alerta suspeito", "Plano de indisponibilidade", "Exportação de encerramento"],
    capabilities: ["Backup automático diário", "Histórico de versões", "Restauração de registro excluído", "Lixeira com prazo", "Backup externo", "Teste periódico de recuperação", "Registro imutável das ações críticas", "Identificação de quem mudou nota, presença ou pagamento", "Data, horário, valor anterior e novo", "Alertas de comportamento suspeito", "Plano de indisponibilidade", "Exportação completa antes do encerramento do contrato"],
    statuses: ["agendado", "em execução", "concluído", "validado", "falhou", "restauração solicitada", "restaurado"],
    fields: [field("tipoBackup", "Tipo", "select", ["Diário", "Externo", "Completo", "Incremental", "Exportação de encerramento"]), field("destino", "Destino/repositório"), field("retencaoDias", "Retenção (dias)", "number"), field("hash", "Hash de integridade"), field("testeRecuperacao", "Teste de recuperação", "date"), field("resultadoTeste", "Resultado do teste", "textarea"), field("planoIndisponibilidade", "Plano de indisponibilidade", "textarea")],
    restricted: true,
  },
];

export const SCHOOL_MODULE_BY_ID = Object.fromEntries(
  SCHOOL_MODULES.map((module) => [module.id, module]),
) as Record<string, SchoolModuleDefinition>;

export const ROLE_DEFAULT_MODULES: Record<SchoolRole, string[]> = {
  diretor: ["*"],
  administrador: ["*"],
  secretaria: ["instituicao", "acessos", "alunos", "responsaveis", "matriculas", "estrutura-academica", "calendario-horarios", "documentos-escolares", "portal-aluno", "portal-responsaveis", "comunicacao", "secretaria", "relatorios", "operacoes", "lgpd-seguranca", "acessibilidade", "continuidade"],
  coordenador: ["alunos", "responsaveis", "estrutura-academica", "calendario-horarios", "diario-planejamento", "frequencia", "atividades", "avaliacoes", "notas-boletim", "acompanhamento", "conteudos", "aulas-ao-vivo", "documentos-escolares", "portal-professor", "comunicacao", "bem-estar", "inclusao", "relatorios", "acessibilidade"],
  professor: ["calendario-horarios", "diario-planejamento", "frequencia", "atividades", "avaliacoes", "notas-boletim", "acompanhamento", "conteudos", "aulas-ao-vivo", "portal-professor", "comunicacao", "bem-estar", "inclusao", "acessibilidade"],
  professor_substituto: ["calendario-horarios", "diario-planejamento", "frequencia", "atividades", "avaliacoes", "conteudos", "aulas-ao-vivo", "portal-professor", "comunicacao", "bem-estar", "acessibilidade"],
  monitor: ["calendario-horarios", "frequencia", "atividades", "conteudos", "aulas-ao-vivo", "portal-professor", "comunicacao", "bem-estar", "acessibilidade"],
  financeiro: ["responsaveis", "matriculas", "documentos-escolares", "portal-responsaveis", "comunicacao", "financeiro", "secretaria", "relatorios", "lgpd-seguranca", "integracoes", "continuidade"],
  bibliotecario: ["alunos", "conteudos", "portal-aluno", "comunicacao", "operacoes", "relatorios", "acessibilidade"],
  psicologo: ["alunos", "responsaveis", "acompanhamento", "portal-responsaveis", "comunicacao", "bem-estar", "inclusao", "secretaria", "relatorios", "lgpd-seguranca", "acessibilidade"],
  inspetor: ["alunos", "responsaveis", "frequencia", "comunicacao", "bem-estar", "operacoes", "acessibilidade"],
  aluno: ["calendario-horarios", "frequencia", "atividades", "avaliacoes", "notas-boletim", "acompanhamento", "conteudos", "aulas-ao-vivo", "documentos-escolares", "portal-aluno", "comunicacao", "secretaria", "acessibilidade", "lgpd-seguranca"],
  responsavel: ["responsaveis", "matriculas", "calendario-horarios", "frequencia", "atividades", "avaliacoes", "notas-boletim", "acompanhamento", "documentos-escolares", "portal-responsaveis", "comunicacao", "bem-estar", "financeiro", "secretaria", "lgpd-seguranca", "acessibilidade"],
  funcionario: ["instituicao", "acessos", "alunos", "responsaveis", "matriculas", "documentos-escolares", "comunicacao", "secretaria", "operacoes", "lgpd-seguranca", "acessibilidade"],
  rh: ["acessos", "comunicacao", "relatorios", "operacoes", "lgpd-seguranca", "continuidade"],
  cantina: ["comunicacao", "operacoes", "relatorios", "acessibilidade"],
  transporte: ["alunos", "responsaveis", "comunicacao", "bem-estar", "operacoes", "relatorios", "acessibilidade"],
};

export const ROLE_WRITE_MODULES: Partial<Record<SchoolRole, string[]>> = {
  diretor: ["*"],
  administrador: ["*"],
  secretaria: ["instituicao", "acessos", "alunos", "responsaveis", "matriculas", "estrutura-academica", "calendario-horarios", "documentos-escolares", "comunicacao", "secretaria", "operacoes", "lgpd-seguranca"],
  coordenador: ["estrutura-academica", "calendario-horarios", "diario-planejamento", "frequencia", "atividades", "avaliacoes", "notas-boletim", "acompanhamento", "conteudos", "aulas-ao-vivo", "bem-estar", "inclusao", "relatorios"],
  professor: ["diario-planejamento", "frequencia", "atividades", "avaliacoes", "notas-boletim", "acompanhamento", "conteudos", "aulas-ao-vivo", "portal-professor", "bem-estar"],
  professor_substituto: ["diario-planejamento", "frequencia", "atividades", "avaliacoes", "conteudos", "aulas-ao-vivo", "portal-professor", "bem-estar"],
  monitor: ["frequencia", "atividades", "conteudos", "aulas-ao-vivo", "bem-estar"],
  financeiro: ["responsaveis", "matriculas", "financeiro", "secretaria", "relatorios", "integracoes"],
  bibliotecario: ["conteudos", "operacoes"],
  psicologo: ["acompanhamento", "bem-estar", "inclusao"],
  inspetor: ["frequencia", "bem-estar", "operacoes"],
  aluno: ["portal-aluno", "secretaria", "lgpd-seguranca"],
  responsavel: ["responsaveis", "portal-responsaveis", "frequencia", "secretaria", "lgpd-seguranca"],
  funcionario: ["secretaria", "operacoes"],
  rh: ["acessos", "operacoes", "lgpd-seguranca"],
  cantina: ["operacoes"],
  transporte: ["bem-estar", "operacoes"],
};

export const GENERIC_RECORD_FIELDS: SchoolFieldDefinition[] = [
  field("titulo", "Título", "text", undefined, true),
  field("codigo", "Código/identificador"),
  field("alunoNome", "Aluno relacionado"),
  field("turmaNome", "Turma relacionada"),
  field("unidadeNome", "Unidade"),
  field("responsavelNome", "Responsável/encarregado"),
  field("dataReferencia", "Data de referência", "date"),
  field("prazo", "Prazo", "datetime-local"),
  field("descricao", "Descrição e observações", "textarea"),
];

export function resolveSchoolRole(user: { tipo?: string; papel?: string; papelDetalhado?: string } | null | undefined): SchoolRole {
  const detailed = (user?.papelDetalhado || user?.papel || user?.tipo || "aluno") as SchoolRole;
  return detailed in SCHOOL_ROLE_LABELS ? detailed : user?.tipo === "diretor" ? "diretor" : user?.tipo === "professor" ? "professor" : user?.tipo === "responsavel" ? "responsavel" : user?.tipo === "funcionario" ? "funcionario" : "aluno";
}

export function canAccessModule(role: SchoolRole, moduleId: string, explicitPermissions: string[] = []): boolean {
  if (explicitPermissions.includes("*") || explicitPermissions.includes(`${moduleId}.view`)) return true;
  const modules = ROLE_DEFAULT_MODULES[role] || [];
  return modules.includes("*") || modules.includes(moduleId);
}

export function canWriteModule(role: SchoolRole, moduleId: string, explicitPermissions: string[] = []): boolean {
  if (explicitPermissions.includes("*") || explicitPermissions.includes(`${moduleId}.manage`)) return true;
  const modules = ROLE_WRITE_MODULES[role] || [];
  return modules.includes("*") || modules.includes(moduleId);
}

export function makeProtocol(moduleNumber: number): string {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const time = `${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}${String(date.getSeconds()).padStart(2, "0")}`;
  return `VE-${String(moduleNumber).padStart(2, "0")}-${stamp}-${time}`;
}

export { standardStatuses };
