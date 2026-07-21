# Vestibulando · Sistema Escolar 360

Sistema escolar completo em React, TypeScript, Firebase e Node, com 30 módulos funcionais, 483 requisitos catalogados, portais por perfil, API documentada, PWA, auditoria, backups e regras de segurança. O visual do portal **Pais e Alunos** foi recriado a partir da referência fornecida; os quatro arquivos protegidos do chat permanecem sem alterações.

## O que está pronto

- 30 módulos numerados e 483 funcionalidades realmente executáveis, com identificador rastreável, formulário contextual, fluxo e automações próprias.
- CRUD operacional com processos, estados, campos específicos, anexos, comentários, atribuição, público e protocolos automáticos.
- Permissões por papel e por usuário, MFA/TOTP, primeiro acesso, senha forte, delegação temporária, sessões e revogação remota.
- Vínculos familiares de muitos-para-muitos, papel financeiro/pedagógico por filho e permissões individuais por responsável.
- Justificativa de falta com atestado protegido, análise pela escola, auditoria e notificação.
- Histórico imutável de versões, valor anterior/novo, lixeira de 90 dias, restauração e exportação completa.
- Relatórios em PDF, Excel e CSV, painéis, importação em lote e pré-validação Educacenso.
- Documentos escolares em PDF com marca, protocolo, QR Code e validação pública mínima.
- Arquivos de até 8 MB e backups compactados em blocos protegidos no Firestore, com SHA-256 e teste automatizado de recuperação, sem Firebase Storage.
- API OpenAPI 3.0.3, webhooks, fila assíncrona, health check e rate limiting.
- Inscrição pública segura, matrícula atômica, bloqueio de duplicidade, consulta de status e correção com identidade confirmada.
- PWA instalável, modo claro/escuro, contraste alto, ampliação de texto, fonte legível e redução de movimento.
- Políticas de privacidade, termos e cookies, além de exportação dos dados do titular.

As matrizes estão em [docs/IMPLEMENTACAO-30-MODULOS.md](docs/IMPLEMENTACAO-30-MODULOS.md) e [docs/MATRIZ-OPERACIONAL-483-REQUISITOS.md](docs/MATRIZ-OPERACIONAL-483-REQUISITOS.md).

## Execução local

1. Copie `.env.example` para `.env` e preencha as credenciais.
2. Instale e valide:

```bash
npm install
npm run check
npm run verify:school
npm run dev
```

O servidor completo inicia em `http://localhost:5000`.

## Build e validação

```bash
npm run check
npm run verify:school
npm run build
```

- `npm run build`: frontend e API Node.
- `npm run build:pages`: somente frontend estático; os caminhos `/api/*` precisam ser encaminhados a um serviço Node.
- `npm run verify:school`: valida 30 módulos, cobertura mínima dos requisitos, JSONs, artefatos de PWA, regras públicas indevidas e integridade do chat protegido.

## Implantação obrigatória

No Windows, execute `ATUALIZAR_GITHUB_E_CLOUDFLARE.bat` na raiz do projeto. A versão corrigida publica `dist/public` diretamente no Cloudflare Pages, registra um identificador de deploy, atualiza o cache da PWA e só depois sincroniza Firebase e GitHub. Consulte [docs/ATUALIZACAO-CLOUDFLARE.md](docs/ATUALIZACAO-CLOUDFLARE.md).

Publique as regras e índices incluídos no projeto:

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

Depois publique a aplicação Node ou configure um proxy `/api/*` para ela. A inscrição, login por CPF/matrícula, recuperação protegida, histórico de IP, webhooks, backups e revogação real de tokens dependem dessa API.

Veja o passo a passo em [docs/IMPLANTACAO-PRODUCAO.md](docs/IMPLANTACAO-PRODUCAO.md) e os controles em [docs/SEGURANCA-E-OPERACAO.md](docs/SEGURANCA-E-OPERACAO.md).

## Credenciais externas

Firebase, e-mail/WhatsApp, Google ou Microsoft Calendar, banco/Pix, nota fiscal, assinatura e videoconferência exigem contas e chaves do respectivo fornecedor. O módulo de integrações fornece cadastro, ambiente de teste, webhooks, fila, auditoria e monitoramento; nenhum segredo é salvo no navegador.

## Stack

- React 18, TypeScript, Vite, Wouter e TanStack Query.
- Tailwind CSS, shadcn/ui, jsPDF e PWA.
- Firebase Authentication e Firestore; o Firebase Storage não é usado.
- Express, Firebase Admin, OpenAPI, filas e tarefas agendadas.

## Chat protegido

O verificador impede alterações acidentais em:

- `client/src/pages/ChatPage.tsx`
- `client/src/pages/ChatConversationPage.tsx`
- `client/src/components/ChatWindow.tsx`
- `client/src/components/ConversationItem.tsx`

As regras de acesso do chat foram reforçadas sem modificar esses arquivos.
