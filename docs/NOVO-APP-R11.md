# Vestibulando R11 — novo aplicativo escolar

## Resultado

A interface escolar foi reconstruída sobre uma nova estrutura visual, mantendo os serviços, coleções do Firestore, regras de negócio, permissões e componentes operacionais existentes. A rota inicial da diretoria agora abre o novo aplicativo; as telas administrativas monolíticas continuam disponíveis apenas como apoio para cadastros avançados já consolidados.

## Estrutura da experiência

- Barra lateral organizada em seis domínios e derivada do catálogo oficial de 30 módulos.
- Mapa inicial que exibe todas as seções disponíveis para o perfil.
- Busca global por seção, processo ou tarefa.
- URL persistente por módulo usando `?modulo=` e suporte aos botões voltar/avançar do navegador.
- Resumo em tempo real de alunos, professores, turmas, solicitações e pendências.
- Página focada por setor, sem menus de categorias com rolagem vertical indevida.
- Design responsivo com gaveta de navegação no celular.

## Operações

Os 483 requisitos do catálogo continuam ligados ao motor operacional. Cada tarefa mostra antes da execução:

- etapa do processo;
- dados que serão solicitados;
- validações e cálculos automáticos;
- registros anteriores relacionados;
- ação específica para iniciar o formulário contextual.

Setores que possuem telas operacionais maduras — chamada, avaliações, notas, calendário, documentos, financeiro, horários, avisos e outros — preservam essas telas e também oferecem a aba **Todas as tarefas**, evitando que requisitos complementares fiquem escondidos.

## Proteções mantidas

- Chat preservado por verificação SHA-256 dos quatro arquivos protegidos.
- Anexos armazenados em blocos no Firestore, sem Firebase Storage.
- Controle de acesso por papel e permissão individual.
- Auditoria, versões, notificações, lixeira e retenção.
- Projeto Cloudflare Pages existente `vestibulando`; o publicador não contém comando para criar projeto.

## Validação

Antes da entrega são executados:

1. `npm run check`
2. `npm run verify:school`
3. `npm run smoke:api`
4. `npm run build`

O verificador exige 30 módulos, 483 identificadores únicos, formulários contextuais, componentes reais, ausência de Firebase Storage, integridade do chat, scripts Windows em CRLF e publicação protegida no projeto Cloudflare existente.
