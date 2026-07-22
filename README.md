# Vestibulando Platform

Plataforma educacional completa para preparação de vestibulares e ENEM com gerenciamento de tarefas, submissões e avaliações.

## 🚀 Configuração Rápida (Para Remix)

### Secrets Obrigatórios

Antes de usar este sistema, você DEVE configurar os seguintes secrets no Replit:

1. **VITE_FIREBASE_API_KEY** - Chave de API do Firebase
2. **VITE_FIREBASE_PROJECT_ID** - ID do projeto Firebase
3. **VITE_FIREBASE_APP_ID** - ID da aplicação Firebase

### Como Obter os Secrets do Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto ou crie um novo
3. Clique no ícone ⚙️ > **Project Settings**
4. Em "Your apps", selecione o app Web (ou crie um novo clicando em `</>`)
5. Em "SDK setup and configuration", copie os valores:
   - `apiKey` → **VITE_FIREBASE_API_KEY**
   - `projectId` → **VITE_FIREBASE_PROJECT_ID**
   - `appId` → **VITE_FIREBASE_APP_ID**

### Como Adicionar Secrets no Replit

1. No Replit, clique em **Tools** (no menu lateral)
2. Selecione **Secrets**
3. Adicione cada secret com o nome exato e o valor correspondente
4. Reinicie o servidor após adicionar todos os secrets

## 📋 Configuração Completa do Firebase

Para configuração completa do Firebase (Authentication, Firestore, Storage, Security Rules), consulte o arquivo `FIREBASE_SETUP.md`.

## 🎯 Funcionalidades

### Para Alunos
- 📚 Visualizar tarefas da turma
- 📤 Enviar arquivos de submissões
- 📊 Acompanhar notas e feedback
- 📅 Monitorar prazos

### Para Professores
- ✏️ Criar tarefas com anexos
- 👀 Visualizar submissões dos alunos
- ✅ Avaliar com notas (0-10) e feedback
- 📈 Acompanhar progresso da turma

### Para Administradores
- 👥 Gerenciar usuários (criar, ativar/desativar)
- 🏫 Gerenciar turmas e vagas
- 📢 Criar anúncios direcionados
- 📊 Visualizar estatísticas da plataforma

## 🛠️ Stack Tecnológica

- **Frontend**: React + TypeScript + Vite
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Estilo**: TailwindCSS + Shadcn UI
- **Formulários**: React Hook Form + Zod
- **Estado**: TanStack Query + React Context
- **Roteamento**: Wouter

## 📝 Notas Importantes

- ❌ **DATABASE_URL não é necessário** - Este projeto usa Firebase Firestore, não PostgreSQL
- ⚠️ Novos cadastros criam apenas contas de "Aluno" por segurança
- 🔒 Contas de Professor e Admin devem ser criadas pelo painel administrativo
- 🇧🇷 Sistema totalmente em português com formatação brasileira (CPF, CEP, telefone)

## 🔐 Primeiro Acesso Admin

Veja instruções detalhadas em `FIREBASE_SETUP.md` sobre como criar o primeiro usuário administrador.

## 📖 Documentação

- `FIREBASE_SETUP.md` - Guia completo de configuração do Firebase
- `replit.md` - Arquitetura e decisões do projeto
- `.env.example` - Template de secrets necessários

## 🐛 Solução de Problemas

### "Firebase não inicializado"
- Verifique se todos os 3 secrets estão configurados corretamente
- Certifique-se de usar os nomes exatos: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`
- Reinicie o servidor após adicionar os secrets

### "Permission denied" no Firestore
- Deploy das security rules: `firebase deploy --only firestore:rules`
- Verifique se o usuário tem os campos `tipo` e `ativo` corretos

### Falha no upload de arquivos
- Verifique se o Storage está habilitado no Firebase
- Deploy das storage rules: `firebase deploy --only storage:rules`
- Limite de 10MB por arquivo

## 🚀 Como Executar

Após configurar os secrets:

```bash
npm install
npm run dev
```

A aplicação estará disponível em `http://localhost:5000`

## 📄 Licença

Este projeto foi desenvolvido para uso educacional.
