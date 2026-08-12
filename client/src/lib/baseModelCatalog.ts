export interface BaseModelCategory {
  id: string;
  label: string;
}

export interface BaseModelTypeDefinition {
  id: string;
  categoryId: string;
  label: string;
  applicability: string;
}

export const BASE_MODEL_CATEGORIES: BaseModelCategory[] = [
  { id: "avaliacoes", label: "Avaliações e atividades" },
  { id: "planejamento", label: "Planejamento pedagógico" },
  { id: "registros", label: "Registros acadêmicos" },
  { id: "acompanhamento", label: "Acompanhamento pedagógico" },
  { id: "inclusao", label: "Inclusão, AEE e adaptações" },
  { id: "comunicacao", label: "Comunicação com famílias e alunos" },
  { id: "coordenacao", label: "Coordenação e gestão pedagógica" },
  { id: "reunioes", label: "Reuniões, conselhos e colegiados" },
  { id: "secretaria", label: "Secretaria e vida escolar" },
  { id: "eventos", label: "Projetos, eventos e atividades externas" },
  { id: "biblioteca-lab", label: "Biblioteca, laboratório e ambientes" },
  { id: "tecnologia", label: "Tecnologia e ensino digital" },
  { id: "seguranca-saude", label: "Segurança, saúde e ocorrências" },
  { id: "rh", label: "Recursos humanos e equipe escolar" },
  { id: "financeiro-patrimonio", label: "Financeiro, compras e patrimônio" },
  { id: "visuais", label: "Cabeçalhos, capas e modelos visuais" },
  { id: "outros", label: "Outros modelos" },
];

export const BASE_MODEL_TYPES: BaseModelTypeDefinition[] = [
  // Avaliações e atividades
  { id: "atividade-avaliativa", categoryId: "avaliacoes", label: "Atividade avaliativa", applicability: "Atividades com valor de nota, revisão ou verificação de aprendizagem." },
  { id: "atividade-classe", categoryId: "avaliacoes", label: "Atividade de classe", applicability: "Exercícios e atividades realizadas durante a aula." },
  { id: "atividade-casa", categoryId: "avaliacoes", label: "Atividade para casa", applicability: "Tarefas e exercícios destinados à realização fora da aula." },
  { id: "lista-exercicios", categoryId: "avaliacoes", label: "Lista de exercícios", applicability: "Prática, revisão, fixação e preparação para avaliações." },
  { id: "prova-bimestral", categoryId: "avaliacoes", label: "Prova bimestral", applicability: "Avaliação formal referente ao conteúdo de um bimestre." },
  { id: "prova-trimestral", categoryId: "avaliacoes", label: "Prova trimestral", applicability: "Avaliação formal referente ao conteúdo de um trimestre." },
  { id: "prova-semestral", categoryId: "avaliacoes", label: "Prova semestral", applicability: "Avaliação formal referente ao conteúdo de um semestre." },
  { id: "prova-final", categoryId: "avaliacoes", label: "Prova final", applicability: "Avaliação de encerramento do período ou ano letivo." },
  { id: "prova-recuperacao", categoryId: "avaliacoes", label: "Prova de recuperação", applicability: "Recuperação de aprendizagem e/ou nota após avaliação regular." },
  { id: "segunda-chamada", categoryId: "avaliacoes", label: "Prova de segunda chamada", applicability: "Reposição de avaliação para estudante com ausência justificada ou autorizada." },
  { id: "avaliacao-diagnostica", categoryId: "avaliacoes", label: "Avaliação diagnóstica", applicability: "Identificar conhecimentos prévios, lacunas e nível inicial da turma ou estudante." },
  { id: "avaliacao-formativa", categoryId: "avaliacoes", label: "Avaliação formativa", applicability: "Acompanhar a aprendizagem durante o processo de ensino." },
  { id: "avaliacao-somativa", categoryId: "avaliacoes", label: "Avaliação somativa", applicability: "Consolidar resultados ao final de uma unidade, etapa ou período." },
  { id: "simulado", categoryId: "avaliacoes", label: "Simulado", applicability: "Treinamento para provas internas, vestibulares, ENEM e avaliações externas." },
  { id: "quiz", categoryId: "avaliacoes", label: "Quiz / questionário", applicability: "Verificação rápida de conhecimentos, revisão ou sondagem." },
  { id: "roteiro-trabalho", categoryId: "avaliacoes", label: "Roteiro de trabalho", applicability: "Orientar trabalhos individuais ou em grupo, critérios e etapas de entrega." },
  { id: "trabalho-pesquisa", categoryId: "avaliacoes", label: "Modelo de trabalho/pesquisa", applicability: "Padronizar trabalhos acadêmicos, pesquisas e produções dos alunos." },
  { id: "redacao", categoryId: "avaliacoes", label: "Folha/modelo de redação", applicability: "Produção textual, redação escolar, ENEM e concursos de escrita." },
  { id: "rubrica", categoryId: "avaliacoes", label: "Rubrica de avaliação", applicability: "Avaliação por critérios, níveis de desempenho e competências." },
  { id: "gabarito", categoryId: "avaliacoes", label: "Gabarito", applicability: "Correção padronizada de provas, simulados, atividades e questionários." },
  { id: "cartao-resposta", categoryId: "avaliacoes", label: "Cartão-resposta", applicability: "Registro de respostas objetivas em avaliações e simulados." },
  { id: "folha-respostas", categoryId: "avaliacoes", label: "Folha de respostas discursivas", applicability: "Respostas abertas, cálculos, desenvolvimento e justificativas." },
  { id: "correcao-prova", categoryId: "avaliacoes", label: "Modelo de correção de prova", applicability: "Padronizar correção, devolutiva, pontuação e observações." },
  { id: "correcao-redacao", categoryId: "avaliacoes", label: "Modelo de correção de redação", applicability: "Correção por competências, critérios, comentários e nota." },

  // Planejamento
  { id: "plano-aula", categoryId: "planejamento", label: "Plano de aula", applicability: "Planejamento detalhado de uma aula, objetivos, conteúdos, metodologia e avaliação." },
  { id: "plano-aula-semanal", categoryId: "planejamento", label: "Plano semanal de aulas", applicability: "Organização das aulas e objetivos da semana." },
  { id: "plano-mensal", categoryId: "planejamento", label: "Planejamento mensal", applicability: "Organização dos conteúdos, objetivos e atividades do mês." },
  { id: "plano-bimestral", categoryId: "planejamento", label: "Planejamento bimestral", applicability: "Distribuição de conteúdos, habilidades e avaliações no bimestre." },
  { id: "plano-trimestral", categoryId: "planejamento", label: "Planejamento trimestral", applicability: "Distribuição de conteúdos, habilidades e avaliações no trimestre." },
  { id: "plano-semestral", categoryId: "planejamento", label: "Planejamento semestral", applicability: "Planejamento global do semestre letivo." },
  { id: "plano-anual", categoryId: "planejamento", label: "Planejamento anual", applicability: "Organização anual da disciplina, conteúdos, competências e avaliações." },
  { id: "sequencia-didatica", categoryId: "planejamento", label: "Sequência didática", applicability: "Conjunto encadeado de aulas e atividades para um objetivo de aprendizagem." },
  { id: "unidade-didatica", categoryId: "planejamento", label: "Unidade didática", applicability: "Planejamento de uma unidade temática ou conjunto de conteúdos." },
  { id: "projeto-interdisciplinar", categoryId: "planejamento", label: "Projeto interdisciplinar", applicability: "Projetos envolvendo duas ou mais disciplinas ou áreas do conhecimento." },
  { id: "projeto-pedagogico", categoryId: "planejamento", label: "Projeto pedagógico", applicability: "Estruturar ações pedagógicas, objetivos, cronograma e avaliação." },
  { id: "roteiro-aula", categoryId: "planejamento", label: "Roteiro de aula", applicability: "Guia rápido para condução e sequência da aula." },
  { id: "roteiro-estudo", categoryId: "planejamento", label: "Roteiro de estudo", applicability: "Orientar estudo autônomo, recuperação, reforço ou revisão." },
  { id: "cronograma-conteudos", categoryId: "planejamento", label: "Cronograma de conteúdos", applicability: "Distribuir conteúdos e entregas ao longo do período letivo." },
  { id: "mapa-habilidades", categoryId: "planejamento", label: "Mapa de habilidades/competências", applicability: "Relacionar conteúdos, habilidades, competências e objetivos de aprendizagem." },
  { id: "plano-recomposicao", categoryId: "planejamento", label: "Plano de recomposição da aprendizagem", applicability: "Planejar recuperação de habilidades e aprendizagens não consolidadas." },

  // Registros acadêmicos
  { id: "diario-classe", categoryId: "registros", label: "Diário de classe", applicability: "Registro de aulas, conteúdos, frequência, atividades e observações da turma." },
  { id: "lista-presenca", categoryId: "registros", label: "Lista de presença", applicability: "Controle de presença em aulas, eventos, reuniões e atividades." },
  { id: "chamada", categoryId: "registros", label: "Folha de chamada", applicability: "Registro diário de presença, ausência e justificativas." },
  { id: "mapa-frequencia", categoryId: "registros", label: "Mapa de frequência", applicability: "Consolidar frequência de estudantes por período." },
  { id: "mapa-notas", categoryId: "registros", label: "Mapa de notas", applicability: "Consolidar notas por turma, disciplina, avaliação ou período." },
  { id: "planilha-notas", categoryId: "registros", label: "Planilha de notas", applicability: "Lançamento, cálculo e acompanhamento de notas." },
  { id: "ficha-individual-aluno", categoryId: "registros", label: "Ficha individual do aluno", applicability: "Registro acadêmico, pedagógico e administrativo individual." },
  { id: "boletim", categoryId: "registros", label: "Boletim escolar", applicability: "Apresentação de notas, frequência e situação escolar." },
  { id: "historico", categoryId: "registros", label: "Histórico escolar", applicability: "Registro oficial da trajetória acadêmica e componentes cursados." },
  { id: "registro-conteudo", categoryId: "registros", label: "Registro de conteúdo ministrado", applicability: "Documentar conteúdos e habilidades trabalhados em aula." },
  { id: "registro-recuperacao", categoryId: "registros", label: "Registro de recuperação", applicability: "Documentar recuperação paralela/final, atividades e resultados." },
  { id: "registro-dependencia", categoryId: "registros", label: "Registro de dependência/progressão", applicability: "Acompanhar componentes em dependência, progressão ou regime especial." },

  // Acompanhamento pedagógico
  { id: "relatorio-aluno", categoryId: "acompanhamento", label: "Relatório individual do aluno", applicability: "Registrar desenvolvimento, dificuldades, avanços e encaminhamentos." },
  { id: "relatorio-turma", categoryId: "acompanhamento", label: "Relatório da turma", applicability: "Síntese pedagógica, desempenho, frequência e necessidades da turma." },
  { id: "ficha-acompanhamento", categoryId: "acompanhamento", label: "Ficha de acompanhamento pedagógico", applicability: "Monitorar evolução, intervenções, metas e resultados." },
  { id: "ficha-observacao", categoryId: "acompanhamento", label: "Ficha de observação do aluno", applicability: "Registrar comportamentos, participação, aprendizagem e situações relevantes." },
  { id: "plano-intervencao", categoryId: "acompanhamento", label: "Plano de intervenção pedagógica", applicability: "Planejar ações para dificuldades específicas de aprendizagem ou rendimento." },
  { id: "plano-reforco", categoryId: "acompanhamento", label: "Plano de reforço/recuperação", applicability: "Organizar apoio, reforço e recuperação de estudantes." },
  { id: "devolutiva-aluno", categoryId: "acompanhamento", label: "Devolutiva pedagógica ao aluno", applicability: "Registrar feedback de desempenho e orientações de melhoria." },
  { id: "devolutiva-familia", categoryId: "acompanhamento", label: "Devolutiva pedagógica à família", applicability: "Comunicar situação pedagógica e encaminhamentos à família/responsáveis." },
  { id: "encaminhamento-pedagogico", categoryId: "acompanhamento", label: "Encaminhamento pedagógico", applicability: "Formalizar encaminhamentos para coordenação, orientação, AEE ou apoio." },

  // Inclusão
  { id: "pei", categoryId: "inclusao", label: "PEI – Plano Educacional Individualizado", applicability: "Planejamento individualizado de objetivos, estratégias, recursos e avaliação." },
  { id: "pdi", categoryId: "inclusao", label: "PDI – Plano de Desenvolvimento Individual", applicability: "Acompanhamento individual do desenvolvimento e metas do estudante." },
  { id: "plano-aee", categoryId: "inclusao", label: "Plano de Atendimento Educacional Especializado (AEE)", applicability: "Planejar atendimento, recursos e estratégias do AEE." },
  { id: "adaptacao-curricular", categoryId: "inclusao", label: "Adaptação curricular", applicability: "Registrar adequações de objetivos, conteúdos, atividades e avaliação." },
  { id: "avaliacao-adaptada", categoryId: "inclusao", label: "Avaliação adaptada", applicability: "Modelo de avaliação com adaptações de acesso, linguagem ou complexidade." },
  { id: "relatorio-aee", categoryId: "inclusao", label: "Relatório de AEE/inclusão", applicability: "Registrar atendimento, evolução, necessidades e orientações." },
  { id: "ficha-acessibilidade", categoryId: "inclusao", label: "Ficha de necessidades de acessibilidade", applicability: "Registrar recursos, adaptações e apoios necessários ao estudante." },

  // Comunicação
  { id: "comunicado", categoryId: "comunicacao", label: "Comunicado", applicability: "Comunicação formal de informações gerais a alunos, famílias ou equipe." },
  { id: "bilhete", categoryId: "comunicacao", label: "Bilhete escolar", applicability: "Comunicação breve com responsáveis ou estudantes." },
  { id: "circular", categoryId: "comunicacao", label: "Circular", applicability: "Informar orientações ou decisões para um grupo amplo da comunidade escolar." },
  { id: "convocacao-responsavel", categoryId: "comunicacao", label: "Convocação de responsável", applicability: "Solicitar comparecimento de responsável para reunião ou atendimento." },
  { id: "convite-reuniao", categoryId: "comunicacao", label: "Convite para reunião", applicability: "Convidar famílias, alunos ou equipe para reunião ou encontro." },
  { id: "agenda-escolar", categoryId: "comunicacao", label: "Modelo de agenda/recado", applicability: "Registro de recados, orientações e acompanhamento diário." },
  { id: "termo-ciencia", categoryId: "comunicacao", label: "Termo de ciência", applicability: "Formalizar ciência do aluno, responsável ou servidor sobre informação ou procedimento." },
  { id: "autorizacao-saida", categoryId: "comunicacao", label: "Autorização de saída", applicability: "Autorizar saída antecipada, desacompanhada ou com terceiro responsável." },
  { id: "autorizacao-imagem", categoryId: "comunicacao", label: "Autorização de uso de imagem e voz", applicability: "Obter autorização para registro e uso de imagem/voz em atividades escolares." },
  { id: "autorizacao-passeio", categoryId: "comunicacao", label: "Autorização para passeio/visita", applicability: "Autorizar participação em visita técnica, passeio ou atividade externa." },
  { id: "autorizacao-atividade", categoryId: "comunicacao", label: "Autorização para atividade especial", applicability: "Autorizar participação em evento, oficina, apresentação ou atividade específica." },

  // Coordenação
  { id: "pauta-coordenacao", categoryId: "coordenacao", label: "Pauta de coordenação", applicability: "Organizar reuniões pedagógicas, assuntos, encaminhamentos e responsáveis." },
  { id: "plano-acao", categoryId: "coordenacao", label: "Plano de ação", applicability: "Planejar ações, responsáveis, prazos, indicadores e resultados esperados." },
  { id: "relatorio-coordenacao", categoryId: "coordenacao", label: "Relatório de coordenação", applicability: "Registrar acompanhamento pedagógico, ações e resultados da coordenação." },
  { id: "observacao-aula", categoryId: "coordenacao", label: "Ficha de observação de aula", applicability: "Acompanhamento de práticas pedagógicas e devolutiva ao professor." },
  { id: "acompanhamento-professor", categoryId: "coordenacao", label: "Ficha de acompanhamento do professor", applicability: "Registrar orientação, acompanhamento, metas e devolutivas pedagógicas." },
  { id: "cronograma-pedagogico", categoryId: "coordenacao", label: "Cronograma pedagógico", applicability: "Organizar entregas, avaliações, reuniões e ações pedagógicas." },
  { id: "calendario-avaliacoes", categoryId: "coordenacao", label: "Calendário de avaliações", applicability: "Planejar datas de provas, trabalhos, simulados e recuperações." },
  { id: "matriz-avaliativa", categoryId: "coordenacao", label: "Matriz avaliativa", applicability: "Padronizar habilidades, conteúdos, níveis cognitivos e distribuição de questões." },
  { id: "protocolo-correcao", categoryId: "coordenacao", label: "Protocolo de correção e lançamento de notas", applicability: "Padronizar critérios, prazos e procedimentos de correção e registro." },

  // Reuniões e conselhos
  { id: "ata-reuniao", categoryId: "reunioes", label: "Ata de reunião", applicability: "Registrar participantes, assuntos, decisões e encaminhamentos." },
  { id: "pauta-reuniao", categoryId: "reunioes", label: "Pauta de reunião", applicability: "Organizar assuntos, tempo, responsáveis e objetivos da reunião." },
  { id: "lista-presenca-reuniao", categoryId: "reunioes", label: "Lista de presença de reunião", applicability: "Registrar participantes em reunião, formação ou conselho." },
  { id: "ata-conselho-classe", categoryId: "reunioes", label: "Ata de conselho de classe", applicability: "Registrar análise de turma, decisões, resultados e encaminhamentos do conselho." },
  { id: "ficha-conselho-classe", categoryId: "reunioes", label: "Ficha para conselho de classe", applicability: "Subsidiar análise individual e coletiva em conselho de classe." },
  { id: "ata-colegiado", categoryId: "reunioes", label: "Ata de colegiado/conselho escolar", applicability: "Registrar decisões de colegiados, conselhos e comissões." },
  { id: "registro-formacao", categoryId: "reunioes", label: "Registro de formação continuada", applicability: "Documentar formação, participantes, carga horária, conteúdo e avaliação." },

  // Secretaria
  { id: "ficha-matricula", categoryId: "secretaria", label: "Ficha/solicitação de matrícula", applicability: "Coleta e registro de dados para matrícula do estudante." },
  { id: "requerimento", categoryId: "secretaria", label: "Requerimento escolar", applicability: "Solicitações formais de documentos, procedimentos ou providências." },
  { id: "declaracao-matricula", categoryId: "secretaria", label: "Declaração de matrícula", applicability: "Comprovar vínculo/matrícula do estudante." },
  { id: "declaracao-frequencia", categoryId: "secretaria", label: "Declaração de frequência", applicability: "Comprovar frequência ou comparecimento escolar." },
  { id: "declaracao-escolaridade", categoryId: "secretaria", label: "Declaração de escolaridade", applicability: "Comprovar etapa, série, ano ou situação de escolarização." },
  { id: "declaracao-transferencia", categoryId: "secretaria", label: "Declaração de transferência", applicability: "Formalizar processo ou situação de transferência escolar." },
  { id: "solicitacao-transferencia", categoryId: "secretaria", label: "Solicitação de transferência", applicability: "Requerer transferência para outra unidade ou instituição." },
  { id: "certificado", categoryId: "secretaria", label: "Certificado", applicability: "Certificar participação, conclusão, formação, projeto ou atividade." },
  { id: "diploma", categoryId: "secretaria", label: "Diploma/modelo de conclusão", applicability: "Modelo institucional quando a modalidade e legislação aplicável permitirem emissão." },
  { id: "protocolo-entrega-documentos", categoryId: "secretaria", label: "Protocolo de entrega/recebimento de documentos", applicability: "Registrar entrega, retirada ou recebimento de documentos." },
  { id: "oficio", categoryId: "secretaria", label: "Ofício", applicability: "Comunicação formal entre escola e órgãos, instituições ou autoridades." },
  { id: "memorando", categoryId: "secretaria", label: "Memorando", applicability: "Comunicação administrativa interna." },

  // Eventos
  { id: "projeto-evento", categoryId: "eventos", label: "Projeto de evento escolar", applicability: "Planejamento de feira, mostra, gincana, festa, campanha ou evento." },
  { id: "roteiro-evento", categoryId: "eventos", label: "Roteiro de evento/cerimônia", applicability: "Organizar sequência, falas, horários e responsabilidades do evento." },
  { id: "cronograma-evento", categoryId: "eventos", label: "Cronograma de evento", applicability: "Distribuir tarefas e horários de preparação e execução." },
  { id: "visita-tecnica", categoryId: "eventos", label: "Roteiro de visita técnica", applicability: "Orientar objetivos, atividades, registros e avaliação de visita técnica." },
  { id: "relatorio-visita", categoryId: "eventos", label: "Relatório de visita/atividade externa", applicability: "Registrar resultados e aprendizados de visita, passeio ou saída pedagógica." },
  { id: "certificado-evento", categoryId: "eventos", label: "Certificado de participação", applicability: "Certificar participação em evento, oficina, curso, projeto ou formação." },

  // Biblioteca e laboratório
  { id: "emprestimo-livro", categoryId: "biblioteca-lab", label: "Ficha de empréstimo de livro", applicability: "Controle de empréstimos, devoluções e responsabilidade por acervo." },
  { id: "inventario-biblioteca", categoryId: "biblioteca-lab", label: "Inventário de biblioteca", applicability: "Controle de acervo, quantidade, estado e localização de materiais." },
  { id: "roteiro-laboratorio", categoryId: "biblioteca-lab", label: "Roteiro de aula prática/laboratório", applicability: "Orientar objetivos, materiais, procedimentos, segurança e registro de resultados." },
  { id: "relatorio-laboratorio", categoryId: "biblioteca-lab", label: "Relatório de aula prática/laboratório", applicability: "Registrar procedimentos, dados, análise e conclusão de atividades práticas." },
  { id: "reserva-ambiente", categoryId: "biblioteca-lab", label: "Reserva de sala/ambiente/recurso", applicability: "Organizar uso de laboratório, auditório, biblioteca e outros espaços." },
  { id: "termo-equipamento", categoryId: "biblioteca-lab", label: "Termo de responsabilidade por equipamento", applicability: "Formalizar empréstimo e responsabilidade por equipamentos e materiais." },

  // Tecnologia
  { id: "slide-aula", categoryId: "tecnologia", label: "Apresentação/slide de aula", applicability: "Modelo institucional para apresentações, aulas e exposições." },
  { id: "slide-formacao", categoryId: "tecnologia", label: "Apresentação de formação/treinamento", applicability: "Modelo para formação de professores, equipe e treinamentos." },
  { id: "planilha-acompanhamento", categoryId: "tecnologia", label: "Planilha de acompanhamento", applicability: "Controle e análise de dados pedagógicos, atividades, alunos ou projetos." },
  { id: "planilha-cronograma", categoryId: "tecnologia", label: "Planilha de cronograma", applicability: "Organizar prazos, aulas, tarefas, eventos e responsáveis." },
  { id: "dashboard", categoryId: "tecnologia", label: "Painel/dashboard", applicability: "Modelo de visualização e acompanhamento de indicadores escolares." },
  { id: "formulario-online", categoryId: "tecnologia", label: "Modelo de formulário digital", applicability: "Padronizar coleta digital de respostas, inscrições, pesquisas e registros." },
  { id: "roteiro-aula-online", categoryId: "tecnologia", label: "Roteiro de aula online/híbrida", applicability: "Planejar aula síncrona, assíncrona ou híbrida e seus recursos digitais." },

  // Segurança e saúde
  { id: "ficha-ocorrencia", categoryId: "seguranca-saude", label: "Ficha de ocorrência escolar", applicability: "Registrar fatos, envolvidos, providências e encaminhamentos." },
  { id: "registro-acidente", categoryId: "seguranca-saude", label: "Registro de acidente/incidente", applicability: "Registrar acidente, atendimento, comunicação e providências." },
  { id: "ficha-saude", categoryId: "seguranca-saude", label: "Ficha de saúde do aluno", applicability: "Registrar informações relevantes de saúde autorizadas para uso escolar." },
  { id: "autorizacao-medicamento", categoryId: "seguranca-saude", label: "Autorização para administração de medicamento", applicability: "Formalizar autorização e orientações para medicamento, quando permitido pela escola." },
  { id: "plano-emergencia", categoryId: "seguranca-saude", label: "Plano de emergência/evacuação", applicability: "Orientar resposta a emergências, evacuação e responsabilidades." },
  { id: "checklist-seguranca", categoryId: "seguranca-saude", label: "Checklist de segurança", applicability: "Verificar condições de segurança de ambientes, eventos e atividades." },

  // RH
  { id: "folha-ponto", categoryId: "rh", label: "Folha/controle de ponto", applicability: "Registro de jornada, presença ou atividades da equipe, conforme procedimento interno." },
  { id: "escala", categoryId: "rh", label: "Escala de trabalho/plantão", applicability: "Organizar horários, responsabilidades e cobertura da equipe." },
  { id: "avaliacao-desempenho", categoryId: "rh", label: "Avaliação de desempenho", applicability: "Avaliar competências, entregas, metas e desenvolvimento profissional." },
  { id: "plano-desenvolvimento-profissional", categoryId: "rh", label: "Plano de desenvolvimento profissional", applicability: "Definir objetivos e ações de formação/desenvolvimento da equipe." },
  { id: "solicitacao-material", categoryId: "rh", label: "Solicitação de material/recurso", applicability: "Formalizar pedido de material pedagógico, equipamento ou recurso." },
  { id: "termo-entrega-equipamento", categoryId: "rh", label: "Termo de entrega de equipamento", applicability: "Registrar entrega e responsabilidade de equipamento a colaborador." },

  // Financeiro e patrimônio
  { id: "requisicao-compra", categoryId: "financeiro-patrimonio", label: "Requisição de compra", applicability: "Solicitar aquisição de materiais, serviços ou equipamentos." },
  { id: "cotacao", categoryId: "financeiro-patrimonio", label: "Mapa/cotação de preços", applicability: "Comparar fornecedores, preços e condições de aquisição." },
  { id: "prestacao-contas", categoryId: "financeiro-patrimonio", label: "Prestação de contas", applicability: "Registrar despesas, comprovantes, finalidade e saldos." },
  { id: "inventario-patrimonio", categoryId: "financeiro-patrimonio", label: "Inventário patrimonial", applicability: "Controle de bens, identificação, estado e localização." },
  { id: "termo-baixa", categoryId: "financeiro-patrimonio", label: "Termo de baixa patrimonial", applicability: "Registrar baixa, descarte ou retirada de bem conforme procedimento interno." },
  { id: "controle-materiais", categoryId: "financeiro-patrimonio", label: "Controle de materiais/estoque", applicability: "Registrar entrada, saída, saldo e consumo de materiais." },

  // Visuais
  { id: "cabecalho-prova", categoryId: "visuais", label: "Cabeçalho padrão de prova", applicability: "Padronizar identificação de prova, aluno, professor, turma, data, nota e período." },
  { id: "cabecalho-atividade", categoryId: "visuais", label: "Cabeçalho padrão de atividade", applicability: "Padronizar identificação e instruções em atividades escolares." },
  { id: "cabecalho-atividade-avaliativa", categoryId: "visuais", label: "Cabeçalho padrão de Atividade Avaliativa", applicability: "Padronizar atividades avaliativas com identificação do aluno, disciplina, professor, turma, data, valor, nota e instruções da avaliação." },
  { id: "cabecalho-documento", categoryId: "visuais", label: "Cabeçalho institucional de documento", applicability: "Padronizar documentos oficiais, relatórios, comunicados e formulários." },
  { id: "rodape-documento", categoryId: "visuais", label: "Rodapé institucional", applicability: "Padronizar paginação, identificação, contatos e informações institucionais." },
  { id: "capa-trabalho", categoryId: "visuais", label: "Capa de trabalho", applicability: "Padronizar apresentação de trabalhos, pesquisas e projetos." },
  { id: "capa-apostila", categoryId: "visuais", label: "Capa de apostila/material", applicability: "Padronizar apostilas, cadernos, guias e materiais didáticos." },
  { id: "papel-timbrado", categoryId: "visuais", label: "Papel timbrado", applicability: "Documentos institucionais, ofícios, declarações e comunicações formais." },
  { id: "modelo-apresentacao", categoryId: "visuais", label: "Template de apresentação", applicability: "Padronizar slides e apresentações institucionais ou pedagógicas." },
  { id: "modelo-planilha", categoryId: "visuais", label: "Template de planilha", applicability: "Padronizar planilhas de controle, registro e acompanhamento." },
  { id: "modelo-documento", categoryId: "visuais", label: "Template de documento Word/Writer", applicability: "Base institucional para criação de documentos de texto." },

  // Outros
  { id: "outro", categoryId: "outros", label: "Outro modelo/documento", applicability: "Use para qualquer modelo escolar que não esteja listado no catálogo padrão." },
];

export const BASE_MODEL_FILE_FORMATS = [
  { value: "docx", label: "Word (.docx)" },
  { value: "doc", label: "Word legado (.doc)" },
  { value: "dotx", label: "Modelo do Word (.dotx)" },
  { value: "pdf", label: "PDF (.pdf)" },
  { value: "xlsx", label: "Excel (.xlsx)" },
  { value: "xls", label: "Excel legado (.xls)" },
  { value: "xltx", label: "Modelo do Excel (.xltx)" },
  { value: "csv", label: "Planilha CSV (.csv)" },
  { value: "pptx", label: "PowerPoint (.pptx)" },
  { value: "ppt", label: "PowerPoint legado (.ppt)" },
  { value: "potx", label: "Modelo do PowerPoint (.potx)" },
  { value: "ppsx", label: "Apresentação de slides (.ppsx)" },
  { value: "odt", label: "OpenDocument Texto (.odt)" },
  { value: "ott", label: "Modelo OpenDocument Texto (.ott)" },
  { value: "ods", label: "OpenDocument Planilha (.ods)" },
  { value: "ots", label: "Modelo OpenDocument Planilha (.ots)" },
  { value: "odp", label: "OpenDocument Apresentação (.odp)" },
  { value: "otp", label: "Modelo OpenDocument Apresentação (.otp)" },
  { value: "rtf", label: "Rich Text (.rtf)" },
  { value: "txt", label: "Texto (.txt)" },
  { value: "png", label: "Imagem PNG (.png)" },
  { value: "jpg", label: "Imagem JPEG (.jpg)" },
  { value: "svg", label: "Imagem vetorial (.svg)" },
  { value: "zip", label: "Pacote ZIP (.zip)" },
  { value: "link", label: "Link externo / Google Docs / OneDrive / outro" },
] as const;

export function getBaseModelType(id: string) {
  return BASE_MODEL_TYPES.find((item) => item.id === id);
}

export function getBaseModelCategory(id: string) {
  return BASE_MODEL_CATEGORIES.find((item) => item.id === id);
}
