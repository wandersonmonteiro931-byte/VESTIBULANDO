# Guia rápido — Preparatório EAD

## Aluno

No menu unificado do aluno, acesse diretamente as áreas escolares e do Preparatório EAD.

- **Meu dia:** perfil, objetivo, prova, série, turno, nível, resumo, pendências
  e próximos eventos.
- **Plano de estudos:** cronograma diário, semanal e mensal, metas, checklist,
  plano automático e replanejamento.
- **Conteúdos:** módulos, trilhas, vídeo, áudio, PDF, slides, favoritos,
  histórico, continuação e modo offline.
- **Banco de questões:** filtros, cronômetro, correção, vídeos, anotações,
  favoritos, caderno personalizado e lista de erros.
- **Simulados:** prova completa ou por disciplina, autosalvamento, correção,
  estimativa pedagógica, ranking opcional e plano de revisão.
- **Redação:** texto ou foto, salvamento automático, versões, revisão
  gramatical, envio e acompanhamento da correção.
- **Aulas ao vivo:** agenda, sala, presença, perguntas, enquetes, materiais e
  gravações.
- **Dúvidas e fórum:** tópicos por disciplina, plantões, comentários,
  comunicados e acesso ao chat preservado.
- **Desempenho:** progresso, horas, frequência, acertos, evolução, simulados,
  dificuldades, sequência, metas e relatório.
- **Financeiro:** planos, renovação, cobranças, cupons, comprovantes,
  vencimentos e histórico.
- **Acessibilidade:** tema, fonte, contraste, movimento, legendas, teclado,
  leitor de tela, baixo consumo e uso offline.
- **Ajuda e suporte:** perguntas frequentes, chamados, reclamações e LGPD.

## Professor

No menu unificado do professor, acesse diretamente o Estúdio, a Programação de aulas e as demais áreas.

- **Estúdio do professor:** cadastre aulas, materiais, questões, simulados,
  temas de redação, aulas ao vivo e plantões.
- **Correções:** avalie redações nas cinco competências e envie comentários.
- **Turmas e relatórios:** acompanhe alunos, presença, atividades e
  desempenho.
- **Conteúdos, aulas ao vivo e comunidade:** publique, acompanhe e responda.

## Diretoria

No menu unificado da diretoria, acesse diretamente a gestão escolar e do Preparatório EAD.

- **Gestão EAD:** usuários, acessos, publicações, comunicados, moderação e
  atendimento.
- **Financeiro:** planos, cupons, cobranças, comprovantes, inadimplência,
  cancelamentos, reembolsos e liberação após confirmação.
- **Segurança e LGPD:** auditoria, acessos, erros, solicitações e backup JSON.

## Arquivos e pagamentos

Firebase Storage não é usado. Anexos pequenos são comprimidos e validados no
Firestore; vídeos e arquivos grandes usam links externos.

O fluxo administrativo de cobrança funciona no sistema. Para movimentar
dinheiro real por Pix, boleto ou cartão, a instituição deve contratar um
provedor de pagamentos e cadastrar o link desse provedor. O sistema nunca
solicita nem armazena número de cartão.

## Programação automática de aulas por turma ou aluno

Acesse **Preparatório EAD > Programação de aulas**. Professores visualizam somente as turmas vinculadas ao próprio cadastro; a direção pode programar para qualquer turma, aluno específico ou para todos os alunos.

1. Clique em **Programar aula**.
2. Informe título, disciplina, descrição, data/hora da aula, horário de liberação e duração.
3. Escolha o público: uma ou mais turmas, um aluno específico ou todos os alunos (direção).
4. Defina se a presença do professor é obrigatória, opcional ou se será uma atividade autônoma.
5. Selecione a sala: Microsoft Teams, sala interna, transmissão externa ou somente conteúdos.
6. Adicione links de vídeos, PDFs, áudios, apostilas, livros, slides e materiais complementares.
7. Salve a programação.

Antes do horário, o aluno vê apenas os dados da agenda. Os links e materiais ficam em documento protegido no Firestore e somente podem ser lidos pelo público correto após o horário configurado. O professor pode editar, cancelar, reativar, excluir, abrir a sala e consultar as participações registradas.

### Microsoft Teams

Crie a reunião no Microsoft Teams e cole o link de participação no campo **Link da reunião do Teams**. No horário programado, o botão **Entrar pelo Microsoft Teams** aparece para os alunos envolvidos. Recursos como áudio, vídeo, treinamento, chat e compartilhamento de tela são executados dentro do Teams.

A criação automática de reuniões pela API Microsoft Graph não foi ativada porque exige um aplicativo Microsoft Entra registrado, permissões e consentimento da organização. O projeto não cria outro aplicativo nem armazena credenciais Microsoft no Firestore.
