# Vestibulando — Preparatório EAD Completo

Portal escolar original com o chat atual preservado e um preparatório EAD integrado para alunos, professores e direção.

## Publicar no site existente

1. Extraia o ZIP em uma pasta nova.
2. Abra a pasta que contém `package.json`.
3. Execute somente `PUBLICAR_PREPARATORIO_EAD_COMPLETO.bat`.
4. Se o GitHub ou Firebase solicitar login, use a conta ligada ao projeto atual.
5. Aguarde a mensagem `SITE ATUALIZADO E CONFIRMADO`.

O publicador:

- usa o repositório `wandersonmonteiro931-byte/VESTIBULANDO`;
- atualiza o projeto Cloudflare Pages existente `vestibulando.pages.dev`;
- usa o Firebase existente `plataforma-enem-f3682`;
- publica Firestore Rules e índices;
- não cria outro projeto Cloudflare;
- não executa deploy de Firebase Storage.

## Páginas do preparatório

### Aluno

- Meu dia e perfil de preparação
- Plano de estudos diário, semanal e mensal
- Trilhas, módulos e materiais
- Banco de questões e caderno de erros
- Simulados e relatórios
- Redação e acompanhamento de correção
- Aulas ao vivo e comunidade
- Desempenho e relatório do responsável
- Financeiro, acessibilidade e suporte

### Professor

- Biblioteca de conteúdo
- Agenda de aulas ao vivo
- Fórum e plantões
- Estúdio para aulas, questões, simulados e temas
- Correção de redações por competência
- Relatório de turmas

### Direção

- Gestão de usuários e acessos
- Controle de publicações e comunicados
- Moderação e atendimento
- Planos, cupons, cobranças e liberações
- Auditoria, acessos, erros, LGPD e backup

## Pagamentos

O financeiro mantém planos, cobranças, descontos, vencimentos, comprovantes, inadimplência, cancelamento, reembolso e liberação automática após confirmação. Pix, boleto e cartão bancários reais exigem um contrato com provedor de pagamentos; o sistema não coleta nem guarda número de cartão.

## Desenvolvimento

```bash
npm ci
npm run dev
```

Build usado pelo Cloudflare Pages:

```bash
npm run build:pages
```

O resultado é gerado em `dist/public`.

## Primeiro uso

Depois da publicação:

1. entre normalmente em `vestibulando.pages.dev`;
2. no painel de aluno, professor ou diretoria, clique em **Preparatório EAD**;
3. o aluno começa por **Meu dia** e preenche o perfil de preparação;
4. o professor usa **Estúdio do professor** para cadastrar conteúdos, questões,
   simulados, temas, aulas ao vivo e plantões;
5. a diretoria usa **Gestão EAD** e **Financeiro** para usuários, publicações,
   atendimento, planos e cobranças.

Cada operação possui sua própria tela e salva os registros no Firestore. O
catálogo inicial serve como demonstração utilizável e pode ser ampliado pelo
professor e pela diretoria.
