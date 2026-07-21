# Implantação em produção

## 1. Pré-requisitos

- Node.js 20 ou superior.
- Projeto Firebase somente com Authentication e Firestore habilitados.
- Conta de serviço Firebase somente no backend.
- Domínio HTTPS.
- Segredos aleatórios com pelo menos 24 caracteres.

Copie `.env.example` para o gerenciador de segredos do provedor. Nunca publique `FIREBASE_SERVICE_ACCOUNT`, `WEBHOOK_SECRET`, `CRON_SECRET` ou `PUBLIC_FLOW_SECRET` em variável `VITE_*`.

## 2. Firebase

Configure os cinco valores públicos `VITE_FIREBASE_*` e os valores privados da API. Depois autentique o Firebase CLI e publique:

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

Confirme no console se os índices terminaram de construir antes de liberar a aplicação. Não ative o Firebase Storage: anexos e backups usam documentos em blocos no Firestore.

## 3. Build completo

```bash
npm ci
npm run check
npm run verify:school
npm run build
npm start
```

O mesmo processo Node serve `dist/public` e `/api/*`. Configure `PORT` quando o provedor exigir.

### Frontend estático separado

`npm run build:pages` gera somente o frontend. Nesse modelo, publique a API Node em outro serviço e crie um proxy de mesmo domínio para `/api/*`. Sem esse proxy não funcionam inscrição pública, resolução de CPF/matrícula, recuperação protegida, captura de IP, revogação de tokens, webhooks e backups.

No Windows, `ATUALIZAR_GITHUB_E_CLOUDFLARE.bat` valida o projeto e faz o deploy direto de `dist/public` no projeto Cloudflare Pages `vestibulando`. O script não depende mais de um deploy automático do GitHub e grava o resultado em `ATUALIZACAO_CLOUDFLARE_LOG.txt`.

## 4. Primeiro administrador

Crie a conta no Firebase Authentication e o documento `usuarios/{uid}` com, no mínimo:

```json
{
  "uid": "UID_DA_CONTA",
  "nome": "Direção",
  "email": "direcao@escola.exemplo",
  "tipo": "diretor",
  "papel": "administrador",
  "papelDetalhado": "administrador",
  "permissoes": ["*"],
  "ativo": true,
  "bloqueado": false,
  "status": "aprovado",
  "mfaObrigatorio": true
}
```

No primeiro login, cadastre o TOTP e crie as demais contas pelo painel institucional.

## 5. Agendamentos

Faça requisições `POST` com o cabeçalho `x-cron-secret`:

- Diariamente: `/api/v1/cron/daily-backup`.
- Diariamente ou a cada poucos minutos, conforme volume: `/api/v1/cron/process-integration-queue`.
- A cada hora: `/api/v1/cron/process-reminders` para prazos nas próximas 48 horas.
- Semanalmente: `/api/v1/cron/verify-latest-backup`.

Monitore `schoolBackups`, `schoolBackupTests` e `integrationJobs` pelo painel.

## 6. Integrações externas

Crie credenciais distintas para teste/homologação/produção no fornecedor e mantenha-as apenas no backend. O webhook usa `x-webhook-secret`. Para cada provedor, implemente ou conecte o adaptador ao job enfileirado; registre no módulo 29 o nome da credencial, nunca o segredo.

## 7. Migração de segurança

No painel **Acessos**, execute primeiro a prévia da remoção de campos legados de senha e só depois confirme. O endpoint correspondente é `/api/v1/admin/security/remove-legacy-passwords` e exige direção autenticada.

Os fluxos públicos agora usam a API. Depois de publicar backend e regras, valide:

- login por e-mail, CPF e matrícula;
- recuperação com quatro dados coincidentes;
- nova inscrição e geração de matrícula;
- consulta de status;
- correção após CPF e nascimento;
- bloqueio após excesso de tentativas.

## 8. Testes de aceite

1. Entre com direção e confirme MFA.
2. Crie perfis de secretaria, coordenação, professor, financeiro e responsável.
3. Confirme que cada perfil vê e edita apenas módulos permitidos.
4. Crie dois responsáveis no mesmo aluno e defina permissões diferentes.
5. Envie uma justificativa com atestado e conclua sua análise.
6. Registre horário conflitante, CPF duplicado e turma lotada; todos devem ser bloqueados.
7. Feche uma chamada/nota e tente alterá-la sem direção.
8. Emita um documento, abra o QR Code e valide o código publicamente.
9. Mova um registro à lixeira e restaure-o.
10. Gere backup, teste recuperação e confira o hash.
