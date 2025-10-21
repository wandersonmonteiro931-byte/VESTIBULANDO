# Firebase Setup Guide for ENEM+

## Prerequisites
- Node.js installed
- Firebase account
- Firebase CLI installed: `npm install -g firebase-tools`

## Initial Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select existing project
3. Enter project name (e.g., "enem-plus")
4. Enable Google Analytics (optional)
5. Click "Create project"

### 2. Enable Authentication
1. In Firebase Console, go to **Authentication**
2. Click "Get started"
3. Enable **Email/Password** sign-in method
4. Enable **Google** sign-in method
5. Add your project email to support email field

### 3. Create Firestore Database
1. Go to **Firestore Database**
2. Click "Create database"
3. Select **Start in production mode** (we'll deploy rules later)
4. Choose a location close to your users
5. Click "Enable"

### 4. Enable Storage
1. Go to **Storage**
2. Click "Get started"
3. Accept default security rules (we'll deploy custom rules)
4. Use same location as Firestore
5. Click "Done"

### 5. Configure Web App
1. Go to **Project Settings** (gear icon)
2. Scroll to "Your apps" section
3. Click web icon (</>)
4. Register app with nickname: "ENEM+ Web"
5. Copy the firebaseConfig values:
   - `apiKey`
   - `projectId`
   - `appId`
6. Add these as Replit Secrets:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`

### 6. Configure Authorized Domains
1. In **Authentication** > **Settings** > **Authorized domains**
2. Add your Replit preview URL (e.g., `your-repl-name.replit.dev`)
3. After deployment, add your production domain

## Deploy Security Rules

### Initialize Firebase in Project
```bash
firebase login
firebase init
```

Select:
- Firestore
- Storage
- Use existing project
- Select your Firebase project
- Accept default file paths or use:
  - Firestore rules: `firestore.rules`
  - Storage rules: `storage.rules`

### Deploy Rules
```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage:rules
```

## Firestore Indexes (Optional for Better Performance)

Create composite indexes if needed:

1. Go to **Firestore Database** > **Indexes**
2. Add index for `tarefas`:
   - Collection: `tarefas`
   - Fields: `turma` (Ascending), `prazo` (Descending)

3. Add index for `entregas`:
   - Collection: `entregas`
   - Fields: `alunoId` (Ascending), `status` (Ascending)

Or wait for Firebase to suggest indexes when queries fail.

## Test Security Rules

Use Firebase Emulator Suite for local testing:

```bash
firebase emulators:start
```

Access the emulator UI at `http://localhost:4000`

## Security Rules Overview

### Firestore Rules
- **usuarios**: Users can read their own data, admins can manage all
- **tarefas**: Teachers create/manage, students read their turma's tasks
- **entregas**: Students submit, teachers/admins grade
- **turmas**: All read, only admins create/manage

### Storage Rules
- **tarefas/**: Teachers upload attachments (10MB limit)
- **entregas/**: Students upload submissions (10MB limit)
- Active users only, role-based access

## Creating First Admin User

**Important Security Note:** For security reasons, new user registrations automatically create "Aluno" (student) accounts only. Professor and Admin accounts must be created by an existing administrator.

### Bootstrap First Admin (One-time Setup)

To create your very first admin user:

1. **Register as a student first**:
   - Go to the app login page
   - Click "Não tem uma conta? Cadastre-se"
   - Register with email/password
   - You'll be created as an "Aluno" account
   - Complete the registration with a turma

2. **Manually upgrade to admin in Firebase Console**:
   - Go to Firebase Console > **Firestore Database**
   - Navigate to the `usuarios` collection
   - Find your user document (by email)
   - Click "Edit field"
   - Change `tipo` from `"aluno"` to `"admin"`
   - Ensure `ativo` is `true`
   - Click "Update"

3. **Log out and log back in**:
   - Log out of the application
   - Log back in with your credentials
   - You will now have admin access

4. **Create other users via Admin Dashboard**:
   - Now you can use the Admin panel to create:
     - Additional admin accounts
     - Professor accounts
     - Student accounts
   - All future accounts should be created through the admin interface

### Creating Additional Users

Once you have an admin account:

1. Log in as admin
2. Go to "Usuários" tab
3. Click "Novo Usuário"
4. Fill in:
   - Nome completo
   - Email
   - Senha (initial password)
   - Tipo de usuário (Aluno, Professor, or Administrador)
   - Turma (if creating an Aluno)
5. Click "Criar Usuário"

The new user can then log in with their email and password.

## Troubleshooting

### Authentication Issues
- Verify authorized domains in Firebase Console
- Check that secrets are correctly set in Replit
- Ensure Google sign-in is enabled in Firebase

### Permission Denied Errors
- Deploy latest security rules
- Verify user `tipo` and `ativo` fields in Firestore
- Check browser console for detailed error messages

### File Upload Failures
- Verify Storage is enabled
- Check file size (must be < 10MB)
- Ensure storage rules are deployed
- Verify user has correct permissions

## Production Deployment

1. Deploy rules: `firebase deploy --only firestore:rules,storage:rules`
2. Add production domain to authorized domains
3. Monitor usage in Firebase Console
4. Set up budget alerts to avoid unexpected costs

## Monitoring

- **Authentication**: Track sign-ins and user growth
- **Firestore**: Monitor reads/writes and document count
- **Storage**: Track file uploads and storage usage
- **Performance**: Use Firebase Performance Monitoring (optional)

## Backup Strategy

Firebase automatically backs up your data, but for extra safety:

1. Enable daily exports in Firebase Console
2. Use Cloud Functions to automate backups
3. Export Firestore data periodically using Firebase CLI

```bash
firebase firestore:export gs://your-bucket/backups/$(date +%Y%m%d)
```

## IMPORTANTE: Regras do Firestore para Permitir Cadastros

### Problema Atual
Se novos usuários não conseguem se cadastrar (os dados não aparecem no Firestore), isso acontece porque as regras de segurança do Firestore estão bloqueando a criação de documentos.

### Solução: Atualizar as Regras do Firestore

1. **Acesse o Console do Firebase**
   - https://console.firebase.google.com/
   - Selecione seu projeto

2. **Navegue até Firestore Database > Regras**

3. **Substitua as regras existentes pelo código abaixo:**

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Permite que qualquer usuário autenticado crie seu próprio documento
    match /usuarios/{userId} {
      // Permite leitura apenas para o próprio usuário ou administradores
      allow read: if request.auth != null && 
                     (request.auth.uid == userId || 
                      get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.tipo == 'admin');
      
      // Permite criação apenas para o próprio usuário (durante cadastro)
      allow create: if request.auth != null && 
                       request.auth.uid == userId &&
                       request.resource.data.uid == userId;
      
      // Permite atualização apenas para administradores
      allow update: if request.auth != null && 
                       get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.tipo == 'admin';
      
      // Permite exclusão apenas para administradores
      allow delete: if request.auth != null && 
                       get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.tipo == 'admin';
    }
    
    // Regras para turmas
    match /turmas/{turmaId} {
      // Todos usuários autenticados podem ler turmas
      allow read: if request.auth != null;
      
      // Apenas administradores podem criar, atualizar e excluir turmas
      allow write: if request.auth != null && 
                      get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.tipo == 'admin';
    }
    
    // Regras para tarefas
    match /tarefas/{tarefaId} {
      // Todos usuários autenticados podem ler tarefas
      allow read: if request.auth != null;
      
      // Apenas professores e administradores podem criar/atualizar/excluir tarefas
      allow write: if request.auth != null && 
                      (get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.tipo == 'professor' ||
                       get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.tipo == 'admin');
    }
    
    // Regras para entregas
    match /entregas/{entregaId} {
      // Todos usuários autenticados podem ler entregas
      allow read: if request.auth != null;
      
      // Usuários podem criar suas próprias entregas
      allow create: if request.auth != null && 
                       request.resource.data.alunoId == request.auth.uid;
      
      // Apenas o próprio aluno ou professores/admins podem atualizar
      allow update: if request.auth != null && 
                       (request.resource.data.alunoId == request.auth.uid ||
                        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.tipo == 'professor' ||
                        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.tipo == 'admin');
      
      // Apenas professores e administradores podem excluir
      allow delete: if request.auth != null && 
                      (get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.tipo == 'professor' ||
                       get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.tipo == 'admin');
    }
  }
}
```

4. **Clique em "Publicar"** para aplicar as novas regras

### Teste Após Atualizar as Regras

1. Tente criar uma nova conta de aluno
2. Verifique no Firestore se o documento foi criado na coleção `usuarios`
3. O novo usuário deve aparecer na lista "Aprovar Contas Pendentes" no painel administrativo
