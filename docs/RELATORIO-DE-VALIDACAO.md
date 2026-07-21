# Relatório de validação da entrega

## Resultado

- TypeScript: aprovado (`npm run check`).
- Cobertura escolar: aprovada (`npm run verify:school`).
- Build Vite + API Node: aprovado (`npm run build`).
- Smoke test da API e arquivos públicos: aprovado (`npm run smoke:api`).
- Catálogo: 30 módulos e 483 requisitos executáveis, cada um com identificador, formulário contextual, fluxo, automações e auditoria.
- OpenAPI: 21 rotas documentadas, incluindo catálogo e despacho seguro de integrações.
- PWA: manifest, service worker, ícones 192/512 e rotas legais servidos.
- Chat protegido: quatro arquivos conferidos por SHA-256, sem alterações.
- Correções visuais: rótulo `DIRETORIA` integral e menu de categorias sem rolagem vertical indevida.
- Acessibilidade: preferências globais e acesso direto nos cabeçalhos da diretoria, professor e aluno.
- Modo sem Storage: anexos e backups em blocos Firestore com limite de 8 MB, controle de acesso e SHA-256.

## Hashes do chat protegido

```text
6f3c287a96137cd4805960e6fa6f9a09b7dc7228f1be1dff30348505b22f0e2d  client/src/pages/ChatPage.tsx
6ff0dc76d9964e5f037841b7b512cf87ecc7955c89871dab9270d283e2690b66  client/src/pages/ChatConversationPage.tsx
366866188eb9d08374a8c1afd17a2a920e2f625e01602ba774d2b6ce3bf8437c  client/src/components/ChatWindow.tsx
cdee1860db894cbb16c8b27a53c056c28befd0991bc2fdff59a83b7cbbf50298  client/src/components/ConversationItem.tsx
```

## Avisos não bloqueantes do build

O Vite informa que o bundle principal é grande e que alguns módulos Firebase são importados de forma estática e dinâmica. Esses avisos não impedem compilação ou execução; uma futura otimização pode separar dashboards em chunks para reduzir o carregamento inicial.

## Testes dependentes do ambiente de produção

Os testes com Firebase real, envio por fornecedores, cobrança, assinatura e videoconferência externa exigem as credenciais descritas em `.env.example`. O Firebase Storage não é necessário nem utilizado.
