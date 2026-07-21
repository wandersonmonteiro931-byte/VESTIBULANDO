# Matriz operacional dos 483 requisitos

Esta versão transforma cada item da especificação em uma operação executável. A Central de funcionalidades exibe um identificador permanente (`VE-RQ-MM-II`), permite abrir o formulário correspondente, acompanha registros e pendências e aplica regras contextuais antes da gravação.

## Cobertura por módulo

| Módulo | Área | Requisitos acionáveis | Identificadores |
|---:|---|---:|---|
| 01 | Configuração da instituição | 9 | VE-RQ-01-01 a VE-RQ-01-09 |
| 02 | Usuários e permissões | 21 | VE-RQ-02-01 a VE-RQ-02-21 |
| 03 | Cadastro completo do aluno | 17 | VE-RQ-03-01 a VE-RQ-03-17 |
| 04 | Responsáveis e família | 12 | VE-RQ-04-01 a VE-RQ-04-12 |
| 05 | Inscrição, matrícula e rematrícula | 19 | VE-RQ-05-01 a VE-RQ-05-19 |
| 06 | Estrutura acadêmica | 14 | VE-RQ-06-01 a VE-RQ-06-14 |
| 07 | Calendário e horários | 13 | VE-RQ-07-01 a VE-RQ-07-13 |
| 08 | Diário de classe e planejamento | 12 | VE-RQ-08-01 a VE-RQ-08-12 |
| 09 | Presença e frequência | 17 | VE-RQ-09-01 a VE-RQ-09-17 |
| 10 | Atividades, trabalhos e tarefas | 15 | VE-RQ-10-01 a VE-RQ-10-15 |
| 11 | Avaliações e provas | 17 | VE-RQ-11-01 a VE-RQ-11-17 |
| 12 | Notas, médias e boletim | 19 | VE-RQ-12-01 a VE-RQ-12-19 |
| 13 | Recuperação e acompanhamento pedagógico | 13 | VE-RQ-13-01 a VE-RQ-13-13 |
| 14 | Conteúdos e ambiente virtual | 13 | VE-RQ-14-01 a VE-RQ-14-13 |
| 15 | Aulas ao vivo e gravadas | 16 | VE-RQ-15-01 a VE-RQ-15-16 |
| 16 | Documentos escolares | 19 | VE-RQ-16-01 a VE-RQ-16-19 |
| 17 | Portal do aluno | 16 | VE-RQ-17-01 a VE-RQ-17-16 |
| 18 | Portal do professor | 17 | VE-RQ-18-01 a VE-RQ-18-17 |
| 19 | Portal dos responsáveis | 13 | VE-RQ-19-01 a VE-RQ-19-13 |
| 20 | Comunicação | 15 | VE-RQ-20-01 a VE-RQ-20-15 |
| 21 | Disciplina, segurança e bem-estar | 17 | VE-RQ-21-01 a VE-RQ-21-17 |
| 22 | Inclusão e atendimento especializado | 12 | VE-RQ-22-01 a VE-RQ-22-12 |
| 23 | Financeiro | 23 | VE-RQ-23-01 a VE-RQ-23-23 |
| 24 | Secretaria e solicitações | 16 | VE-RQ-24-01 a VE-RQ-24-16 |
| 25 | Relatórios e inteligência | 20 | VE-RQ-25-01 a VE-RQ-25-20 |
| 26 | Recursos administrativos adicionais | 15 | VE-RQ-26-01 a VE-RQ-26-15 |
| 27 | Segurança e LGPD | 24 | VE-RQ-27-01 a VE-RQ-27-24 |
| 28 | Acessibilidade e experiência | 18 | VE-RQ-28-01 a VE-RQ-28-18 |
| 29 | Integrações e funcionamento técnico | 19 | VE-RQ-29-01 a VE-RQ-29-19 |
| 30 | Backup, auditoria e continuidade | 12 | VE-RQ-30-01 a VE-RQ-30-12 |
|  | **Total** | **483** | **483 identificadores únicos** |

## O que “acionável” significa

Todo requisito possui, sem exceção:

- botão **Executar**, seleção direta e filtro na listagem;
- formulário contextual, processo, status, protocolo, responsável, aluno/turma, unidade, prazo, prioridade, evidência e anexos;
- gravação em tempo real, histórico de versões, autor, data, antes/depois, comentários, notas internas e lixeira recuperável;
- permissões por perfil, público explícito e compartilhamento familiar condicionado ao vínculo e à permissão daquele responsável;
- exportação CSV, Excel, PDF e backup JSON;
- automações e validações aplicáveis à natureza do requisito.

## Automações aplicadas

O motor operacional identifica o tipo de requisito e combina as regras necessárias:

- média simples/ponderada, pesos, arredondamento, média mínima e situação calculada;
- frequência, faltas justificadas, referência mínima configurável e alertas aos responsáveis autorizados;
- desconto, multa, juros, valor final, pagamento, saldo e vencimento;
- capacidade, ocupação, reserva e disponibilidade;
- carga horária/progresso, metas e evolução;
- conflito e coerência de datas, horários, salas, turmas e professores;
- CPF/CNPJ, documentos, assinatura, consentimento, aceite e QR Code;
- prazos/SLA, notificações e lembretes;
- sigilo, risco, acessibilidade, LGPD, retenção e minimização;
- API/webhook, fila, ambiente, referência segura de credencial, saúde e retentativa;
- backup, hash, recuperação, versões e auditoria imutável.

## Integração entre portais

- Diretoria, professores e alunos acessam a Gestão 360 no menu principal, respeitando seus módulos de leitura e escrita.
- O portal da família recebe somente registros do filho e somente quando a permissão específica do vínculo permite (acadêmico, frequência, disciplina, financeiro, documentos ou comunicação).
- Os módulos legados continuam disponíveis; nenhuma funcionalidade existente foi removida.
- Os quatro arquivos protegidos do chat são verificados por hash e permanecem sem alteração.

## Serviços externos

Os conectores usam referências de credenciais no servidor, webhooks autenticados e fila. Pix, banco, nota fiscal, WhatsApp, e-mail, assinatura e videoconferência passam a operar com o provedor escolhido assim que as credenciais correspondentes forem configuradas no ambiente; segredos não são armazenados no navegador nem nos registros escolares.

## Verificação automática

`npm run verify:school` falha caso qualquer um dos 483 itens deixe de ter ID único, formulário contextual, automação, processo válido ou caso um arquivo protegido do chat seja alterado.
