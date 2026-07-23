# Firebase — configuração do projeto existente

Este pacote está preparado para o projeto Firebase já existente:

- **Project ID:** `plataforma-enem-f3682`
- **Serviços usados:** Authentication e Firestore
- **Firebase Storage:** desativado; não é necessário contratar ou habilitar

O publicador `PUBLICAR_PREPARATORIO_EAD_COMPLETO.bat` valida essa configuração
antes de publicar e interrompe a operação se detectar outro projeto.

## 1. Authentication

No Console do Firebase:

1. Abra o projeto `plataforma-enem-f3682`.
2. Entre em **Authentication > Sign-in method**.
3. Mantenha **E-mail/senha** habilitado.
4. Em **Settings > Authorized domains**, confirme o domínio
   `vestibulando.pages.dev`.

## 2. Firestore

O sistema usa o Firestore para usuários, cursos, conteúdo, planos de estudo,
questões, simulados, redações, aulas ao vivo, fóruns, financeiro, suporte e
auditoria.

As regras e os índices ficam em:

- `firestore.rules`
- `firestore.indexes.json`

O arquivo BAT publica ambos automaticamente. Para uma publicação manual:

```bash
firebase use plataforma-enem-f3682
firebase deploy --only firestore:rules,firestore:indexes --project plataforma-enem-f3682
```

## 3. Arquivos sem Storage

O sistema não envia arquivos ao Firebase Storage:

- imagens pequenas são comprimidas e salvas como dados no Firestore;
- anexos pequenos são validados e salvos no próprio registro;
- aulas e materiais grandes usam links externos;
- aulas podem ser marcadas para consulta offline pelo navegador.

Por segurança e para respeitar a opção de não usar um serviço pago, anexos
salvos no Firestore têm limite de **600 KB**. Vídeos e PDFs grandes devem usar
um link externo.

## 4. Primeiro usuário de diretoria

Se ainda não existir um usuário de diretoria:

1. Crie a conta pela tela de cadastro.
2. Em **Firestore Database > usuarios**, abra o documento do usuário.
3. Altere `tipo` para `diretor` e mantenha `ativo` como `true`.
4. Saia e entre novamente.

## Solução de problemas

### Erro de permissão

- execute o publicador para atualizar as regras;
- confirme que o documento do usuário possui `tipo` e `ativo: true`;
- saia e entre novamente após alterar o perfil.

### Usuário não consegue entrar

- confirme o provedor E-mail/senha;
- confirme `vestibulando.pages.dev` nos domínios autorizados;
- use a recuperação de senha na tela de acesso.

### Arquivo recusado

O arquivo excedeu o limite seguro do Firestore. Comprima-o ou publique-o em um
serviço externo e cadastre o link no material.
