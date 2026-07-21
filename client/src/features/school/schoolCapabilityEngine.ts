import type { SchoolFieldDefinition, SchoolModuleDefinition } from "./schoolCatalog";

export type SchoolAutomationHealth = "ok" | "attention" | "blocked";

export interface SchoolAutomationSummary {
  health: SchoolAutomationHealth;
  rules: string[];
  warnings: string[];
  nextAction: string;
  calculatedAt: string;
}

export interface SchoolCapabilityBlueprint {
  id: string;
  index: number;
  title: string;
  workflow: string;
  fields: SchoolFieldDefinition[];
  automations: string[];
}

type PrimitiveData = Record<string, string | number | boolean>;

const field = (
  key: string,
  label: string,
  kind: SchoolFieldDefinition["kind"] = "text",
  options?: string[],
  required = false,
  help?: string,
): SchoolFieldDefinition => ({ key, label, kind, options, required, help });

const COMMON_OPERATION_FIELDS: SchoolFieldDefinition[] = [
  field("dataReferencia", "Data de referência", "date"),
  field("prazo", "Prazo/SLA", "datetime-local"),
  field("prioridade", "Prioridade", "select", ["Baixa", "Normal", "Alta", "Urgente"]),
  field("evidenciaResultado", "Resultado, parecer ou evidência", "textarea", undefined, false, "Registre o resultado verificável da operação."),
];

const MODULE_OPERATION_DEFAULTS: Record<string, { automations: string[]; fields: SchoolFieldDefinition[] }> = {
  instituicao: { automations: ["Aplicação por unidade, curso ou turma com vigência"], fields: [field("escopoConfiguracao", "Escopo", "select", ["Instituição", "Unidade", "Curso", "Turma"]), field("vigenciaInicio", "Início da vigência", "date"), field("vigenciaFim", "Fim da vigência", "date")] },
  acessos: { automations: ["Controle de conta, papel e permissão individual"], fields: [field("usuarioAlvo", "Usuário/conta"), field("papelAcesso", "Papel de acesso"), field("escopoAcesso", "Permissões e restrições", "textarea"), field("validadeAcesso", "Validade", "datetime-local")] },
  alunos: { automations: ["Versionamento do prontuário e separação de dados sensíveis"], fields: [field("categoriaCadastro", "Categoria do dado", "select", ["Pessoal", "Documental", "Contato", "Escolar", "Saúde", "Acessibilidade", "Guarda", "Consentimento"]), field("origemInformacao", "Origem da informação"), field("conferenciaRealizada", "Conferência realizada", "checkbox")] },
  responsaveis: { automations: ["Vínculo e permissão independentes para cada filho"], fields: [field("parentesco", "Parentesco"), field("tipoResponsabilidade", "Responsabilidade", "select", ["Pedagógica", "Financeira", "Pedagógica e financeira", "Guarda compartilhada", "Autorizado"]), field("permissoesVinculo", "Permissões do vínculo", "textarea")] },
  matriculas: { automations: ["Controle de etapa, vaga, documento e duplicidade"], fields: [field("etapaMatricula", "Etapa da matrícula"), field("documentosCompletos", "Documentos completos", "checkbox"), field("vagaConfirmada", "Vaga confirmada", "checkbox"), field("motivoMovimento", "Motivo/decisão", "textarea")] },
  "estrutura-academica": { automations: ["Validação de matriz, vínculo docente e capacidade"], fields: [field("cursoEstrutura", "Curso/etapa"), field("componenteCurricular", "Componente curricular"), field("cargaHorariaPrevista", "Carga horária prevista", "number"), field("vigenciaMatriz", "Vigência", "date")] },
  "calendario-horarios": { automations: ["Agenda institucional com conflito e notificação"], fields: [field("inicio", "Início", "datetime-local"), field("fim", "Fim", "datetime-local"), field("sala", "Sala/ambiente"), field("professor", "Professor/responsável"), field("turma", "Turma") ] },
  "diario-planejamento": { automations: ["Fluxo docente, aprovação pedagógica e assinatura"], fields: [field("disciplinaOperacao", "Disciplina"), field("turmaOperacao", "Turma"), field("conteudoMinistrado", "Conteúdo/planejamento", "textarea"), field("assinaturaDocente", "Assinatura docente", "checkbox")] },
  frequencia: { automations: ["Chamada auditável, fechamento e mínimo configurável"], fields: [field("totalAulas", "Total de aulas/horas", "number"), field("presencas", "Presenças", "number"), field("faltasJustificadas", "Faltas justificadas", "number"), field("frequenciaMinima", "Frequência mínima (%)", "number")] },
  atividades: { automations: ["Publicação, entrega, correção e versão da atividade"], fields: [field("prazoEntrega", "Prazo de entrega", "datetime-local"), field("pontuacaoMaxima", "Pontuação máxima", "number"), field("permiteReenvio", "Permitir reenvio", "checkbox"), field("criteriosCorrecao", "Critérios/rubrica", "textarea")] },
  avaliacoes: { automations: ["Aplicação segura, correção e análise por questão"], fields: [field("modalidadeAvaliacao", "Modalidade", "select", ["Presencial", "On-line", "Híbrida"]), field("duracaoMinutos", "Duração (min)", "number"), field("pontuacaoMaxima", "Pontuação máxima", "number"), field("adaptacaoAvaliacao", "Adaptação aplicada", "textarea")] },
  "notas-boletim": { automations: ["Cálculo, publicação, fechamento e reabertura autorizada"], fields: [field("nota1", "Nota 1", "number"), field("peso1", "Peso 1", "number"), field("nota2", "Nota 2", "number"), field("peso2", "Peso 2", "number"), field("mediaMinima", "Média mínima", "number")] },
  acompanhamento: { automations: ["Plano individual com risco, meta e reavaliação"], fields: [field("classificacaoRisco", "Risco", "select", ["Baixo", "Moderado", "Alto", "Crítico"]), field("meta", "Meta", "number"), field("proximaIntervencao", "Próxima intervenção", "textarea"), field("dataReavaliacao", "Reavaliação", "date")] },
  conteudos: { automations: ["Liberação, validade, progresso e direitos do material"], fields: [field("categoriaConteudo", "Categoria/assunto"), field("liberacao", "Liberação", "datetime-local"), field("validadeDocumento", "Validade", "date"), field("obrigatorio", "Conteúdo obrigatório", "checkbox"), field("downloadPermitido", "Permitir download", "checkbox")] },
  "aulas-ao-vivo": { automations: ["Sala, participantes, presença, permanência e gravação"], fields: [field("salaVirtual", "Sala virtual/URL"), field("inicio", "Início", "datetime-local"), field("duracaoMinutos", "Duração (min)", "number"), field("gravacaoDisponivel", "Gravação disponível", "checkbox")] },
  "documentos-escolares": { automations: ["Emissão autenticável, assinatura, QR Code e arquivo permanente"], fields: [field("tipoDocumento", "Tipo/modelo"), field("numeroDocumento", "Numeração"), field("aceiteConfirmado", "Assinatura confirmada", "checkbox"), field("dataEmissao", "Emissão", "date")] },
  "portal-aluno": { automations: ["Disponibilização individual e preferência do aluno"], fields: [field("recursoPortal", "Recurso/tela"), field("disponivelAoAluno", "Disponível ao aluno", "checkbox"), field("ordemExibicao", "Ordem de exibição", "number"), field("preferenciaNotificacao", "Preferência de notificação")] },
  "portal-professor": { automations: ["Operação docente por turma, disciplina e obrigação"], fields: [field("recursoDocente", "Recurso/obrigação"), field("turmaOperacao", "Turma"), field("disciplinaOperacao", "Disciplina"), field("prazo", "Prazo", "datetime-local")] },
  "portal-responsaveis": { automations: ["Visibilidade por filho e por permissão do vínculo"], fields: [field("recursoFamilia", "Recurso/serviço"), field("permissaoNecessaria", "Permissão necessária"), field("confirmarLeitura", "Exigir confirmação", "checkbox"), field("prazo", "Prazo", "datetime-local")] },
  comunicacao: { automations: ["Segmentação, programação, entrega, leitura e moderação"], fields: [field("canalEnvio", "Canal", "select", ["Sistema", "Push", "E-mail", "WhatsApp", "SMS"]), field("publicoSegmentado", "Público/segmento"), field("envioProgramado", "Envio programado", "datetime-local"), field("confirmarLeitura", "Exigir leitura", "checkbox"), field("mensagem", "Mensagem", "textarea")] },
  "bem-estar": { automations: ["Fluxo sigiloso de ocorrência, decisão, ciência e resposta"], fields: [field("tipoOcorrencia", "Tipo de registro"), field("classificacaoRisco", "Risco", "select", ["Baixo", "Moderado", "Alto", "Crítico"]), field("encaminhamento", "Encaminhamento", "textarea"), field("sigiloso", "Sigiloso", "checkbox")] },
  inclusao: { automations: ["PEI/AEE restrito com adaptação e evolução"], fields: [field("necessidadeIdentificada", "Necessidade", "textarea"), field("adaptacaoAplicada", "Adaptação/recurso", "textarea"), field("profissionalApoio", "Profissional de apoio"), field("dataReavaliacao", "Reavaliação", "date"), field("acessoRestrito", "Acesso restrito", "checkbox")] },
  financeiro: { automations: ["Cobrança, baixa, saldo, conciliação e exportação contábil"], fields: [field("valorOriginal", "Valor original (R$)", "number"), field("valorPago", "Valor pago (R$)", "number"), field("vencimento", "Vencimento", "date"), field("formaPagamento", "Forma de pagamento"), field("centroCustoOperacao", "Centro de custo")] },
  secretaria: { automations: ["Protocolo, responsável, SLA, notificação e avaliação"], fields: [field("solicitante", "Solicitante"), field("tipoSolicitacao", "Tipo de solicitação"), field("prazo", "Prazo/SLA", "datetime-local"), field("avaliacaoAtendimento", "Avaliação (1 a 5)", "number")] },
  relatorios: { automations: ["Indicadores, filtros, totalizadores e exportação reproduzível"], fields: [field("periodoInicio", "Período inicial", "date"), field("periodoFim", "Período final", "date"), field("filtrosRelatorio", "Filtros/agrupamentos", "textarea"), field("formatoSaida", "Formato", "select", ["Painel", "PDF", "Excel", "CSV", "Educacenso"])] },
  operacoes: { automations: ["Ordem de serviço, responsável, quantidade, custo e prazo"], fields: [field("setorOperacional", "Setor"), field("itemServico", "Item/serviço"), field("quantidade", "Quantidade", "number"), field("custo", "Custo (R$)", "number"), field("responsavelOperacao", "Responsável")] },
  "lgpd-seguranca": { automations: ["Base legal, consentimento, retenção, incidente e direito do titular"], fields: [field("categoriaDado", "Categoria de dado"), field("baseLegal", "Base legal"), field("finalidade", "Finalidade", "textarea"), field("retencaoAte", "Retenção até", "date"), field("consentimentoRegistrado", "Consentimento registrado", "checkbox")] },
  acessibilidade: { automations: ["Avaliação WCAG/eMAG e validação com tecnologia assistiva"], fields: [field("criterioAcessibilidade", "Critério WCAG/eMAG"), field("barreiraEncontrada", "Barreira/necessidade", "textarea"), field("adaptacaoAplicada", "Correção/adaptação", "textarea"), field("validadoComUsuario", "Validado com usuário", "checkbox")] },
  integracoes: { automations: ["Conector HTTPS, fila, idempotência, retentativa e saúde"], fields: [field("provedor", "Provedor/conector"), field("ambiente", "Ambiente", "select", ["Teste", "Homologação", "Produção"]), field("endpoint", "Endpoint público"), field("credencialRef", "Referência da credencial"), field("usarFila", "Usar fila", "checkbox")] },
  continuidade: { automations: ["Backup, hash, retenção, restauração e auditoria imutável"], fields: [field("tipoBackup", "Tipo/escopo"), field("destinoBackup", "Destino"), field("retencaoDias", "Retenção (dias)", "number"), field("hashIntegridade", "Hash"), field("recuperacaoValidada", "Recuperação validada", "checkbox")] },
};

const FIELD_GROUPS: Array<{ pattern: RegExp; automations: string[]; fields: SchoolFieldDefinition[] }> = [
  {
    pattern: /cnpj|cpf|rg|certid|document|contrato|termo|carteir|diploma|hist[oó]rico escolar|declara[cç][aã]o|comprovante|recibo|nota fiscal/i,
    automations: ["Validação e rastreabilidade documental", "Numeração e evidência anexável"],
    fields: [field("numeroDocumento", "Número do documento"), field("validadeDocumento", "Validade", "date"), field("documentoConferido", "Documento conferido", "checkbox")],
  },
  {
    pattern: /nota|m[eé]dia|pontua[cç][aã]o|peso|rendimento|aprova[cç][aã]o|reprova[cç][aã]o|resultado|conceito|ranking|recupera[cç][aã]o/i,
    automations: ["Cálculo de média simples ou ponderada", "Aplicação de arredondamento e situação acadêmica"],
    fields: [
      field("nota1", "Nota 1", "number"), field("peso1", "Peso 1", "number"),
      field("nota2", "Nota 2", "number"), field("peso2", "Peso 2", "number"),
      field("nota3", "Nota 3", "number"), field("peso3", "Peso 3", "number"),
      field("nota4", "Nota 4", "number"), field("peso4", "Peso 4", "number"),
      field("mediaMinima", "Média mínima", "number"),
      field("casasDecimais", "Casas decimais", "select", ["0", "1", "2"]),
    ],
  },
  {
    pattern: /frequ[eê]ncia|presen[cç]a|falta|ausente|atrasad|sa[ií]da antecipada|perman[eê]ncia|horas letivas|carga hor[aá]ria frequentada/i,
    automations: ["Cálculo de frequência acumulada", "Alerta automático abaixo do mínimo configurado"],
    fields: [field("totalAulas", "Total de aulas/horas", "number"), field("presencas", "Presenças", "number"), field("faltasJustificadas", "Faltas justificadas", "number"), field("frequenciaMinima", "Frequência mínima (%)", "number", undefined, false, "Referência inicial: 75%, quando aplicável.")],
  },
  {
    pattern: /mensalidade|financeir|pagamento|pix|boleto|cart[aã]o|cobran[cç]a|multa|juros|desconto|bolsa|inadimpl|caixa|contas a pagar|contas a receber|concilia|estorno|renegocia|valor|custo|folha de pagamento/i,
    automations: ["Cálculo de desconto, multa, juros e saldo", "Classificação automática da situação financeira"],
    fields: [field("valorOriginal", "Valor original (R$)", "number"), field("descontoPercentual", "Desconto (%)", "number"), field("multaPercentual", "Multa (%)", "number"), field("jurosPercentual", "Juros (%)", "number"), field("valorPago", "Valor pago (R$)", "number"), field("vencimento", "Vencimento", "date")],
  },
  {
    pattern: /vaga|capacidade|estoque|quantidade|livro|empr[eé]stimo|patrim[oô]nio|equipamento|sala de recursos|merenda|cantina/i,
    automations: ["Controle de capacidade e disponibilidade", "Bloqueio de quantidade negativa ou excedida"],
    fields: [field("capacidadeTotal", "Capacidade/quantidade total", "number"), field("ocupacaoAtual", "Ocupação/quantidade utilizada", "number"), field("quantidadeReservada", "Quantidade reservada", "number")],
  },
  {
    pattern: /calend[aá]rio|hor[aá]rio|intervalo|evento|feriado|recesso|bimestre|per[ií]odo de prova|agendar|agenda|reserva|reposi[cç][aã]o|substitui[cç][aã]o|reuni[aã]o|f[eé]rias/i,
    automations: ["Validação cronológica", "Detecção de conflito de horário, sala, turma e responsável"],
    fields: [field("inicio", "Início", "datetime-local"), field("fim", "Fim", "datetime-local"), field("sala", "Sala/ambiente"), field("professor", "Professor/responsável"), field("turma", "Turma/grupo")],
  },
  {
    pattern: /assinatura|autoriza[cç][aã]o|consentimento|ci[eê]ncia|confirma[cç][aã]o|aprovar|recusar|deferir|indeferir|direito de resposta/i,
    automations: ["Fluxo de aceite com autor, data e versão", "Bloqueio de conclusão sem confirmação quando exigida"],
    fields: [field("aceiteSolicitadoA", "Aceite solicitado a"), field("aceiteConfirmado", "Aceite/assinatura confirmado", "checkbox"), field("dataAceite", "Data do aceite", "datetime-local"), field("motivoDecisao", "Fundamentação da decisão", "textarea")],
  },
  {
    pattern: /aviso|comunica[cç][aã]o|mensagem|e-mail|whatsapp|push|notifica[cç][aã]o|leitura|entrega|emerg[eê]ncia|chat|modelo de mensagem/i,
    automations: ["Distribuição segmentada em tempo real", "Registro de envio, entrega e leitura"],
    fields: [field("canalEnvio", "Canal", "select", ["Sistema", "Push", "E-mail", "WhatsApp", "SMS"]), field("envioProgramado", "Envio programado", "datetime-local"), field("confirmarEntrega", "Exigir confirmação de entrega", "checkbox"), field("confirmarLeitura", "Exigir confirmação de leitura", "checkbox"), field("mensagem", "Conteúdo da comunicação", "textarea")],
  },
  {
    pattern: /atividade|tarefa|trabalho|prova|avalia[cç][aã]o|quest[aã]o|gabarito|rubrica|material|conte[uú]do|apostila|pdf|apresenta[cç][aã]o|v[ií]deo|[aá]udio|certificado por conclus[aã]o/i,
    automations: ["Controle de liberação e prazo", "Acompanhamento de entrega, progresso e avaliação"],
    fields: [field("liberacao", "Liberação", "datetime-local"), field("prazoEntrega", "Prazo de entrega", "datetime-local"), field("pontuacaoMaxima", "Pontuação máxima", "number"), field("obrigatorio", "Obrigatório", "checkbox"), field("permiteReenvio", "Permitir reenvio", "checkbox")],
  },
  {
    pattern: /aula ao vivo|aula on-line|grava[cç][aã]o|videoconfer[eê]ncia|microfone|c[aâ]mera|compartilhamento de tela|quadro branco|participante/i,
    automations: ["Controle de presença e tempo de permanência", "Registro de gravação, participantes e encerramento"],
    fields: [field("salaVirtual", "Sala virtual/URL"), field("duracaoMinutos", "Duração prevista (min)", "number"), field("tempoPermanencia", "Permanência registrada (min)", "number"), field("quantidadeParticipantes", "Participantes", "number"), field("gravacaoDisponivel", "Gravação disponível", "checkbox")],
  },
  {
    pattern: /defici[eê]ncia|tea|altas habilidades|inclus[aã]o|especializado|pei|libras|acessibilidade|adapta[cç][aã]o|leitor de tela|legenda|transcri[cç][aã]o|contraste|tecnologia assistiva|wcag|emag/i,
    automations: ["Proteção reforçada de informação sensível", "Registro da adaptação e validação de acessibilidade"],
    fields: [field("necessidadeIdentificada", "Necessidade identificada", "textarea"), field("adaptacaoAplicada", "Adaptação/recurso aplicado", "textarea"), field("tecnologiaAssistiva", "Tecnologia assistiva"), field("validadoComUsuario", "Validado com o usuário", "checkbox"), field("acessoRestrito", "Restringir à equipe autorizada", "checkbox")],
  },
  {
    pattern: /m[eé]dic|alergia|medicamento|acidente|bullying|viol[eê]ncia|psicol[oó]g|den[uú]ncia|seguran[cç]a escolar|emerg[eê]ncia|guarda|restri[cç][aã]o judicial|pessoa autorizada/i,
    automations: ["Classificação de risco e sigilo", "Encaminhamento e alerta de emergência"],
    fields: [field("classificacaoRisco", "Classificação de risco", "select", ["Baixo", "Moderado", "Alto", "Crítico"]), field("contatoEmergencia", "Contato de emergência"), field("encaminhamento", "Encaminhamento/medida adotada", "textarea"), field("sigiloso", "Registro sigiloso", "checkbox")],
  },
  {
    pattern: /permiss[aã]o|acesso|login|senha|mfa|sess[aã]o|dispositivo|ip|bloqueio|suspens[aã]o|desativa[cç][aã]o|delega[cç][aã]o|menor privil[eé]gio/i,
    automations: ["Aplicação do menor privilégio", "Auditoria de acesso, validade e revogação"],
    fields: [field("escopoAcesso", "Escopo/permissões", "textarea"), field("validadeAcesso", "Validade do acesso", "datetime-local"), field("mfaObrigatorio", "MFA obrigatório", "checkbox"), field("encerrarSessoes", "Encerrar sessões existentes", "checkbox"), field("motivoAcesso", "Justificativa", "textarea")],
  },
  {
    pattern: /lgpd|privacidade|base legal|titular|reten[cç][aã]o|descarte|cookie|criptografia|dado sens[ií]vel|incidente|crian[cç]a|adolescente|imagem|tratamento de dados/i,
    automations: ["Controle de base legal, consentimento e retenção", "Separação e minimização de dados sensíveis"],
    fields: [field("baseLegal", "Base legal"), field("finalidade", "Finalidade", "textarea"), field("consentimentoRegistrado", "Consentimento registrado", "checkbox"), field("retencaoAte", "Reter até", "date"), field("planoResposta", "Resposta, descarte ou mitigação", "textarea")],
  },
  {
    pattern: /api|webhook|integra[cç][aã]o|calendar|banco|pix|nota fiscal|assinatura eletr[oô]nica|armazenamento|importa[cç][aã]o|exporta[cç][aã]o|educacenso|fila|monitoramento de erros|sa[uú]de do sistema|ambiente de testes|atualiza[cç][oõ]es/i,
    automations: ["Teste de conectividade e ambiente", "Fila, retentativa e trilha técnica sem expor segredos"],
    fields: [field("provedor", "Provedor/conector"), field("ambiente", "Ambiente", "select", ["Teste", "Homologação", "Produção"]), field("endpoint", "Endpoint público"), field("eventoIntegracao", "Evento/operação"), field("credencialRef", "Referência da credencial", "text", undefined, false, "Nunca cole a chave secreta; informe somente a referência configurada no servidor."), field("usarFila", "Processar em fila", "checkbox"), field("resultadoTeste", "Resultado do teste", "textarea")],
  },
  {
    pattern: /relat[oó]rio|painel|gr[aá]fico|indicador|filtro|totalizador|estat[ií]stica|inconsist[eê]ncia|pdf|excel|csv|impress[aã]o/i,
    automations: ["Totalização e filtros reproduzíveis", "Exportação com data, autor e recorte"],
    fields: [field("periodoInicio", "Período inicial", "date"), field("periodoFim", "Período final", "date"), field("filtrosRelatorio", "Filtros e agrupamentos", "textarea"), field("formatoSaida", "Formato", "select", ["Painel", "PDF", "Excel", "CSV", "JSON"]), field("incluirTotalizadores", "Incluir totalizadores", "checkbox")],
  },
  {
    pattern: /backup|restaura[cç][aã]o|lixeira|vers[aã]o|auditoria|imut[aá]vel|comportamento suspeito|indisponibilidade|encerramento do contrato/i,
    automations: ["Versionamento e trilha imutável", "Integridade, retenção e recuperação verificável"],
    fields: [field("retencaoDias", "Retenção (dias)", "number"), field("destinoBackup", "Destino/repositório"), field("hashIntegridade", "Hash de integridade"), field("testeRecuperacao", "Teste de recuperação", "date"), field("recuperacaoValidada", "Recuperação validada", "checkbox")],
  },
  {
    pattern: /progresso|evolu[cç][aã]o|meta|plano|acompanhamento|atendimento|parecer|risco|evas[aã]o|dificuldade/i,
    automations: ["Acompanhamento de meta e evolução", "Alerta de risco e definição da próxima intervenção"],
    fields: [field("valorInicial", "Indicador inicial", "number"), field("meta", "Meta", "number"), field("valorAtual", "Indicador atual", "number"), field("proximaIntervencao", "Próxima intervenção", "textarea"), field("dataReavaliacao", "Data de reavaliação", "date")],
  },
  {
    pattern: /carga hor[aá]ria|cr[eé]dito|cumprida|conclus[aã]o|progresso/i,
    automations: ["Cálculo de carga/progresso cumprido"],
    fields: [field("cargaHorariaPrevista", "Carga/progresso previsto", "number"), field("cargaHorariaCumprida", "Carga/progresso cumprido", "number")],
  },
];

const STOP_WORDS = new Set(["para", "pela", "pelo", "entre", "cada", "quando", "como", "com", "sem", "dos", "das", "uma", "por", "que", "e", "ou", "de", "do", "da", "em", "no", "na"]);

export function normalizeSchoolText(value: unknown): string {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
}

function tokens(value: string): string[] {
  return normalizeSchoolText(value).split(/\s+/).filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

export function capabilityIdentifier(module: SchoolModuleDefinition, capabilityOrIndex: string | number): string {
  const index = typeof capabilityOrIndex === "number" ? capabilityOrIndex : module.capabilities.indexOf(capabilityOrIndex);
  return `VE-RQ-${String(module.number).padStart(2, "0")}-${String(Math.max(0, index) + 1).padStart(2, "0")}`;
}

export function workflowForCapability(module: SchoolModuleDefinition, capability: string): string {
  const capabilityTokens = tokens(capability);
  const scored = module.workflows.map((workflow, index) => {
    const workflowTokens = tokens(workflow);
    const score = workflowTokens.reduce((total, token) => total + (capabilityTokens.some((item) => item.startsWith(token.slice(0, 5)) || token.startsWith(item.slice(0, 5))) ? 1 : 0), 0);
    return { workflow, index, score };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  return scored[0]?.score ? scored[0].workflow : module.workflows[0] || "Registro geral";
}

function uniqueFields(fields: SchoolFieldDefinition[]): SchoolFieldDefinition[] {
  const seen = new Set<string>();
  return fields.filter((item) => !seen.has(item.key) && seen.add(item.key));
}

export function capabilityBlueprint(module: SchoolModuleDefinition, capability: string): SchoolCapabilityBlueprint {
  const index = Math.max(0, module.capabilities.indexOf(capability));
  const matched = FIELD_GROUPS.filter((group) => group.pattern.test(capability));
  const moduleDefaults = MODULE_OPERATION_DEFAULTS[module.id] || { automations: ["Fluxo específico do módulo"], fields: [] };
  return {
    id: capabilityIdentifier(module, index),
    index,
    title: capability,
    workflow: workflowForCapability(module, capability),
    fields: uniqueFields([...COMMON_OPERATION_FIELDS, ...moduleDefaults.fields, ...matched.flatMap((group) => group.fields)]),
    automations: Array.from(new Set(["Protocolo, histórico, permissões e auditoria", ...moduleDefaults.automations, ...matched.flatMap((group) => group.automations)])),
  };
}

export function capabilityById(module: SchoolModuleDefinition, id?: string): string | undefined {
  if (!id) return undefined;
  const index = module.capabilities.findIndex((_, capabilityIndex) => capabilityIdentifier(module, capabilityIndex) === id);
  return index >= 0 ? module.capabilities[index] : undefined;
}

function numeric(value: unknown): number | undefined {
  if (value === "" || value === undefined || value === null) return undefined;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** Math.max(0, Math.min(4, digits));
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function completedStatus(status: string): boolean {
  return /aprov|conclu|emitid|pago|valid|publicad|homolog|encerrad|fechad|assinado|restaurado|conciliado/i.test(status);
}

function cpfIsValid(value: unknown): boolean {
  const cpf = String(value || "").replace(/\D/g, "");
  if (!cpf) return true;
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const digit = (length: number) => {
    let total = 0;
    for (let index = 0; index < length; index += 1) total += Number(cpf[index]) * (length + 1 - index);
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

function cnpjIsValid(value: unknown): boolean {
  const cnpj = String(value || "").replace(/\D/g, "");
  if (!cnpj) return true;
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calculate = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const total = weights.reduce((sum, weight, index) => sum + Number(cnpj[index]) * weight, 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculate(12) === Number(cnpj[12]) && calculate(13) === Number(cnpj[13]);
}

export function validateCapabilityData(module: SchoolModuleDefinition, capability: string, data: PrimitiveData, status: string): string[] {
  const errors: string[] = [];
  if (!module.capabilities.includes(capability)) errors.push("Selecione uma funcionalidade válida deste módulo.");
  const cpf = data.cpf ?? data.candidatoCpf;
  if (!cpfIsValid(cpf)) errors.push("CPF inválido. Confira os 11 dígitos e os verificadores.");
  if (!cnpjIsValid(data.cnpj)) errors.push("CNPJ inválido. Confira os 14 dígitos e os verificadores.");

  const start = data.inicio ? new Date(String(data.inicio)).getTime() : Number.NaN;
  const end = data.fim ? new Date(String(data.fim)).getTime() : Number.NaN;
  if (Number.isFinite(start) && Number.isFinite(end) && end <= start) errors.push("O término deve ser posterior ao início.");

  const total = numeric(data.totalAulas);
  const presences = numeric(data.presencas) || 0;
  const justified = numeric(data.faltasJustificadas) || 0;
  if (total !== undefined && (total < 0 || presences < 0 || justified < 0 || presences + justified > total)) errors.push("Os totais de frequência são incompatíveis.");

  const capacity = numeric(data.capacidadeTotal);
  const occupied = numeric(data.ocupacaoAtual) || 0;
  const reserved = numeric(data.quantidadeReservada) || 0;
  if (capacity !== undefined && (capacity < 0 || occupied < 0 || reserved < 0 || occupied + reserved > capacity)) errors.push("A capacidade/quantidade disponível foi excedida.");

  for (const key of ["valorOriginal", "descontoPercentual", "multaPercentual", "jurosPercentual", "valorPago", "nota1", "nota2", "nota3", "nota4", "peso1", "peso2", "peso3", "peso4"]) {
    const value = numeric(data[key]);
    if (value !== undefined && value < 0) errors.push(`${key.replace(/([A-Z])/g, " $1")} não pode ser negativo.`);
  }
  for (const key of ["nota1", "nota2", "nota3", "nota4"]) {
    const value = numeric(data[key]);
    if (value !== undefined && value > 10) errors.push("As notas devem ficar entre 0 e 10.");
  }
  for (const key of ["descontoPercentual", "multaPercentual", "jurosPercentual", "frequenciaMinima"]) {
    const value = numeric(data[key]);
    if (value !== undefined && value > 100) errors.push("Percentuais devem ficar entre 0 e 100.");
  }

  const endpoint = String(data.endpoint || "").trim();
  if (endpoint && !/^https?:\/\//i.test(endpoint)) errors.push("O endpoint deve começar com http:// ou https://.");
  if (String(data.ambiente || "").toLowerCase() === "produção" && endpoint.startsWith("http://")) errors.push("Em produção, use somente endpoint HTTPS.");

  const needsAcceptance = /assinatura|autoriza[cç][aã]o|consentimento|ci[eê]ncia/i.test(capability);
  if (needsAcceptance && completedStatus(status) && !Boolean(data.aceiteConfirmado || data.assinatura || data.consentimentoRegistrado)) {
    errors.push("Confirme o aceite, consentimento ou assinatura antes de concluir esta operação.");
  }
  return Array.from(new Set(errors));
}

export function applyCapabilityAutomations(
  module: SchoolModuleDefinition,
  capability: string,
  source: PrimitiveData,
  status: string,
  calculatedAt = new Date().toISOString(),
): { customData: PrimitiveData; automation: SchoolAutomationSummary } {
  const data: PrimitiveData = { ...source };
  const blueprint = capabilityBlueprint(module, capability);
  const rules = [...blueprint.automations];
  const warnings: string[] = [];

  const total = numeric(data.totalAulas);
  const presences = numeric(data.presencas) || 0;
  const justified = numeric(data.faltasJustificadas) || 0;
  if (total && total > 0) {
    const percentage = round(((presences + justified) / total) * 100, 2);
    const minimum = numeric(data.frequenciaMinima) ?? 75;
    data.percentual = percentage;
    data.faltasCalculadas = Math.max(0, total - presences - justified);
    data.situacaoFrequencia = percentage >= minimum ? "Regular" : "Abaixo do mínimo";
    if (percentage < minimum) warnings.push(`Frequência em ${percentage}%, abaixo do mínimo de ${minimum}%.`);
  }

  const gradePairs = [1, 2, 3, 4].map((index) => ({ grade: numeric(data[`nota${index}`]), weight: numeric(data[`peso${index}`]) })).filter((item) => item.grade !== undefined);
  if (gradePairs.length) {
    const hasWeights = gradePairs.some((item) => item.weight !== undefined);
    const denominator = hasWeights ? gradePairs.reduce((sum, item) => sum + (item.weight ?? 1), 0) : gradePairs.length;
    const rawAverage = denominator ? gradePairs.reduce((sum, item) => sum + (item.grade || 0) * (hasWeights ? item.weight ?? 1 : 1), 0) / denominator : 0;
    const decimals = numeric(data.casasDecimais) ?? 1;
    const average = round(rawAverage, decimals);
    const minimum = numeric(data.mediaMinima) ?? 6;
    data.mediaCalculada = average;
    data.resultadoCalculado = average >= minimum ? "Aprovado" : "Em recuperação";
    if (average < minimum) warnings.push(`Média ${average}, abaixo da referência ${minimum}.`);
  }

  const original = numeric(data.valorOriginal) ?? numeric(data.valor);
  if (original !== undefined) {
    const discount = original * ((numeric(data.descontoPercentual) || 0) / 100);
    const fine = original * ((numeric(data.multaPercentual) || 0) / 100);
    const interest = original * ((numeric(data.jurosPercentual) || 0) / 100);
    const calculated = round(Math.max(0, original - discount + fine + interest), 2);
    const paid = numeric(data.valorPago) || 0;
    const balance = round(Math.max(0, calculated - paid), 2);
    data.valorCalculado = calculated;
    data.saldoAberto = balance;
    data.situacaoFinanceira = balance === 0 ? "Quitado" : "Em aberto";
    if (balance > 0 && data.vencimento && new Date(String(data.vencimento)).getTime() < new Date(calculatedAt).getTime()) warnings.push(`Saldo vencido de R$ ${balance.toFixed(2)}.`);
  }

  const capacity = numeric(data.capacidadeTotal);
  if (capacity !== undefined) {
    const occupied = numeric(data.ocupacaoAtual) || 0;
    const reserved = numeric(data.quantidadeReservada) || 0;
    data.disponibilidadeCalculada = Math.max(0, capacity - occupied - reserved);
    data.capacidadeAtingida = occupied + reserved >= capacity;
  }

  const planned = numeric(data.cargaHorariaPrevista);
  const completed = numeric(data.cargaHorariaCumprida);
  if (planned && planned > 0 && completed !== undefined) data.percentualCumprido = round(Math.min(100, (completed / planned) * 100), 2);

  const initial = numeric(data.valorInicial);
  const current = numeric(data.valorAtual);
  const target = numeric(data.meta);
  if (initial !== undefined && current !== undefined) data.evolucaoCalculada = round(current - initial, 2);
  if (target !== undefined && current !== undefined) data.metaAtingida = current >= target;

  const dueValue = data.prazo || data.prazoEntrega || data.vencimento || data.fim || data.validadeAcesso || data.retencaoAte;
  if (dueValue) {
    const due = new Date(String(dueValue)).getTime();
    if (Number.isFinite(due)) {
      const now = new Date(calculatedAt).getTime();
      data.situacaoPrazo = completedStatus(status) ? "Concluído" : due < now ? "Vencido" : due - now <= 48 * 60 * 60 * 1000 ? "Próximo" : "No prazo";
      if (data.situacaoPrazo === "Vencido") warnings.push("Prazo/SLA vencido.");
    }
  }

  data.requisitoId = blueprint.id;
  data.regraProcessadaEm = calculatedAt;
  data.automacaoAtiva = true;
  const health: SchoolAutomationHealth = warnings.length ? "attention" : "ok";
  const nextAction = completedStatus(status)
    ? "Acompanhar retenção, auditoria e eventuais revisões."
    : warnings.length
      ? "Tratar os alertas e registrar a decisão antes de concluir."
      : "Executar o fluxo, anexar evidências e atualizar o status.";
  return { customData: data, automation: { health, rules, warnings, nextAction, calculatedAt } };
}

export function schoolCapabilityCount(modules: SchoolModuleDefinition[]): number {
  return modules.reduce((total, module) => total + module.capabilities.length, 0);
}
