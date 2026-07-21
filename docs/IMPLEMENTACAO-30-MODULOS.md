# Matriz de implementação dos 30 módulos

O catálogo em `client/src/features/school/schoolCatalog.ts` contém 30 módulos e 483 requisitos funcionais. Cada requisito possui um identificador estável (`VE-RQ-MM-II`), botão **Executar**, formulário contextual, fluxo próprio e automações aplicáveis. Todos também usam o núcleo transversal de protocolos, anexos, busca, filtros, permissões, notificações, versionamento, auditoria, lixeira, exportação e restauração. A rastreabilidade requisito a requisito está em `docs/MATRIZ-OPERACIONAL-483-REQUISITOS.md`.

| Nº | Módulo | Implementação ativa |
|---:|---|---|
| 1 | Configuração da instituição | Instituição, identidade, unidades, salas, períodos, turnos, calendário, regras de média/frequência e configuração por unidade/turma. |
| 2 | Usuários e permissões | 17 papéis, permissões de leitura/escrita, conta institucional, MFA, primeiro acesso, bloqueio, suspensão, validade temporária, histórico e revogação. |
| 3 | Cadastro completo do aluno | Dados civis, sociais, endereço, saúde, necessidades, acessibilidade, emergência, documentos, guarda, pessoas autorizadas, consentimentos e versões. |
| 4 | Responsáveis e família | Muitos responsáveis/muitos filhos, papel financeiro e pedagógico por vínculo, guarda compartilhada, dez permissões por filho e portal familiar em tempo real. |
| 5 | Inscrição, matrícula e rematrícula | Inscrição protegida, matrícula atômica, vagas, duplicidade, seleção, espera, conferência, aprovação/devolução, correção verificada e todos os movimentos de matrícula. |
| 6 | Estrutura acadêmica | Cursos, matrizes, disciplinas, carga, créditos, pré-requisitos, itinerários, modalidades, turmas, vínculos docentes e capacidade. |
| 7 | Calendário e horários | Calendário, bimestres, provas, grade, extras, reposições, substituições, reservas, alterações, notificação, PDF e bloqueio de conflitos. |
| 8 | Diário e planejamento | Planos anual/bimestral/aula, conteúdo, objetivos, habilidades, materiais, tarefas, situação da aula, aprovação, assinatura e histórico. |
| 9 | Presença e frequência | Chamadas, estados de presença, correção autorizada, fechamento, frequência acumulada, mínimo configurável, alertas, família e justificativa com atestado. |
| 10 | Atividades e tarefas | Tarefas, prazos, pontuação, mídia, entrega, atraso, reenvio, rubrica, correção, feedback privado, versões, grupos, pendências e semelhança. |
| 11 | Avaliações e provas | Banco de questões, presencial/on-line, tipos de questão, mídia, sorteio, tempo/senha, correção, segunda chamada, recuperação, adaptação, recurso e estatística. |
| 12 | Notas, médias e boletim | Notas/pesos, cálculo e arredondamento configurável, recuperações, conceitos, faltas, boletins, comparações, conselho, fechamento/reabertura e risco automático. |
| 13 | Recuperação e acompanhamento | Identificação automática, plano individual, reforço, metas, atendimentos, pareceres, reuniões, PEI, evolução e alertas de reprovação/evasão. |
| 14 | Conteúdos e AVA | Materiais por disciplina/módulo, programação, progresso, favoritos, busca, download, comentários, obrigatoriedade, visualização, certificado e validade. |
| 15 | Aulas ao vivo e gravadas | Agenda/sala, professor/monitor/alunos, áudio/vídeo/tela, quadro, chat preservado, mão levantada, dispositivos, presença, permanência, gravação e relatório. |
| 16 | Documentos escolares | Todos os documentos listados, modelos, numeração, assinatura, PDF, QR Code, código público, estados emitido/baixado/arquivado e auditoria. |
| 17 | Portal do aluno | Painel acadêmico, horários, aulas, materiais, atividades, avaliações, notas, frequência, documentos, solicitações, financeiro e acessibilidade. |
| 18 | Portal do professor | Turmas, agenda, diário, planos, chamada, tarefas, avaliações, notas, mensagens, pendências, substituição, arquivos e relatórios. |
| 19 | Portal dos responsáveis | Seletor de filhos, visão permitida de frequência/notas/tarefas/ocorrências/financeiro, documentos, autorizações, reuniões e contatos. |
| 20 | Comunicação | Avisos segmentados, chat existente preservado, professor/aluno, escola/família, anexos/mídia, programação, entrega/leitura, moderação, denúncia, bloqueio e emergência. |
| 21 | Disciplina, segurança e bem-estar | Advertência, suspensão, ocorrência, aprovação, resposta/ciência, bullying, denúncia sigilosa, psicologia, acidentes, entrada/saída, autorizados e plano de segurança. |
| 22 | Inclusão e AEE | Deficiência/TEA/altas habilidades, AEE, PEI, adaptações, apoio, Libras, recursos, sala, atendimentos, evolução, sigilo e estrutura Educacenso. |
| 23 | Financeiro | Planos, bolsas/descontos, responsável financeiro, cobranças, parcelas, Pix/boleto/cartão, juros, baixa, comprovante, fiscal, estorno, renegociação, caixa e conciliação. |
| 24 | Secretaria e solicitações | Central com protocolo, tipos de pedido, SLA, responsável, estados, histórico, anexos, notificações e avaliação do atendimento. |
| 25 | Relatórios e inteligência | KPIs acadêmicos/financeiros/uso, risco, filtros, totalizadores, gráficos, PDF/Excel/CSV, Educacenso e inconsistências. |
| 26 | Operações administrativas | Biblioteca, transporte, alimentação, cantina, estoque, patrimônio, ambientes, manutenção, chamados, eventos, visitantes, RH, ponto, contratos e folha. |
| 27 | Segurança e LGPD | Páginas legais, bases legais/consentimentos, canal do titular, correção/exportação, retenção, separação de dados, MFA, sessão, auditoria, rate limit, backup e incidentes. |
| 28 | Acessibilidade e experiência | Layout responsivo, PWA, teclado/rótulos, texto ampliado, alto contraste, fonte legível, movimento reduzido, temas, autosave, mensagens e impressão. |
| 29 | Integrações e técnica | OpenAPI, webhooks autenticados, fila, jobs, health check, ambientes, CSV, Educacenso, arquivos e pontos de integração para calendários, mensagens, pagamentos e assinatura. |
| 30 | Backup, auditoria e continuidade | Backup diário gzip/SHA-256 em blocos Firestore, inclusão dos arquivos, teste de recuperação, versões, lixeira 90 dias, restauração, auditoria imutável, alertas e exportação integral — sem Firebase Storage. |

## Regras transversais implementadas

- Escrita por módulo e menor privilégio tanto no cliente quanto no Firestore.
- Dados médicos, disciplinares, financeiros e notas internas separados por público.
- Registro de autor, data, estado anterior e novo em cada alteração.
- Exclusão lógica; exclusão física de registros escolares é negada pelas regras.
- Validações de datas, percentuais, notas, valores, campos obrigatórios, conflitos de horário, CPF duplicado, capacidade e períodos fechados.
- Alertas automáticos para frequência abaixo do mínimo e nota abaixo da média.
- Upload em blocos Firestore com lista de formatos e limite de 8 MB; atestados têm leitura mais restrita.
- Exportação PDF, Excel, CSV, JSON e validação pública de documentos sem expor o prontuário.

## Verificação reproduzível

Execute:

```bash
npm run check
npm run verify:school
npm run build
```

O verificador falha se faltar módulo, requisito, identificador único, campos contextuais, fluxo, automações, artefato obrigatório, rota documentada ou se algum dos quatro arquivos protegidos do chat mudar. Ele também executa cenários determinísticos de frequência, média ponderada, cobrança e capacidade de turma.
