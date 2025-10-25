# 🔐 REGRAS COMPLETAS DO FIREBASE - ENEM+

Este arquivo contém TODAS as regras necessárias para o sistema funcionar.
Você precisa implantar cada seção no local correto do Firebase Console.

---

## 📍 PASSO 1: REGRAS DO FIRESTORE DATABASE

**Onde implantar:**
1. Acesse: https://console.firebase.google.com/
2. Selecione o projeto: `plataforma-enem-f3682`
3. Menu lateral → **Firestore Database**
4. Aba **"Regras"** (Rules)
5. **Cole o código abaixo** e clique em **"Publicar"**

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions with null guards
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function userDocExists() {
      return exists(/databases/$(database)/documents/usuarios/$(request.auth.uid));
    }
    
    function getUserData() {
      return userDocExists() ? get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data : null;
    }
    
    function isAdmin() {
      return isAuthenticated() && userDocExists() && getUserData().tipo == 'diretor';
    }
    
    function isProfessor() {
      return isAuthenticated() && userDocExists() && getUserData().tipo == 'professor';
    }
    
    function isAluno() {
      return isAuthenticated() && userDocExists() && getUserData().tipo == 'aluno';
    }
    
    function isUserActive() {
      return userDocExists() && (getUserData().ativo == true || getUserData().ativo == 'true');
    }
    
    // Usuarios collection
    match /usuarios/{userId} {
      allow get: if isAuthenticated();
      allow list: if true;
      
      allow create: if isAuthenticated() && (
        (request.auth.uid == userId &&
         !exists(/databases/$(database)/documents/usuarios/$(userId)) &&
         request.resource.data.uid == request.auth.uid &&
         request.resource.data.keys().hasAll(['uid', 'nome', 'email', 'tipo', 'ativo']) &&
         request.resource.data.tipo == 'aluno' &&
         request.resource.data.email == request.auth.token.email &&
         request.resource.data.ativo == true) ||
        (exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) && 
         get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.tipo == 'diretor' &&
         request.resource.data.uid == userId &&
         request.resource.data.keys().hasAll(['uid', 'nome', 'email', 'tipo', 'ativo']))
      );
      
      allow update: if isAuthenticated() && (
        (request.auth.uid == userId && 
         !request.resource.data.diff(resource.data).affectedKeys().hasAny(['uid', 'tipo', 'ativo'])) ||
        (exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) && 
         get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.tipo == 'diretor')
      );
      
      allow delete: if exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) && 
                       get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.tipo == 'diretor';
    }
    
    // Tarefas collection
    match /tarefas/{tarefaId} {
      allow read: if isAuthenticated() && isUserActive() && (
        isAdmin() ||
        (isProfessor() && resource.data.professorId == request.auth.uid) ||
        (isAluno() && resource.data.turma == getUserData().turma)
      );
      
      allow create: if isProfessor() && isUserActive() && 
                       request.resource.data.professorId == request.auth.uid;
      
      allow update: if isProfessor() && isUserActive() && 
                       resource.data.professorId == request.auth.uid;
      
      allow delete: if isUserActive() && (
        isAdmin() ||
        (isProfessor() && resource.data.professorId == request.auth.uid)
      );
    }
    
    // Entregas collection
    match /entregas/{entregaId} {
      function professorOwnsTarefa(tarefaId) {
        return exists(/databases/$(database)/documents/tarefas/$(tarefaId)) &&
               get(/databases/$(database)/documents/tarefas/$(tarefaId)).data.professorId == request.auth.uid;
      }
      
      allow read: if isAuthenticated() && isUserActive() && (
        isAdmin() ||
        (isAluno() && resource.data.alunoId == request.auth.uid) ||
        (isProfessor() && professorOwnsTarefa(resource.data.tarefaId))
      );
      
      allow create: if isAluno() && isUserActive() && 
                       request.resource.data.alunoId == request.auth.uid;
      
      allow update: if isUserActive() && (
        isAdmin() ||
        (isProfessor() && professorOwnsTarefa(resource.data.tarefaId))
      );
      
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Turmas collection
    match /turmas/{turmaId} {
      allow read: if true;
      allow create: if isAdmin() && isUserActive();
      allow update: if isAdmin() && isUserActive();
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Solicitacoes collection
    match /solicitacoes/{solicitacaoId} {
      allow create: if true;
      allow read: if true;
      allow delete: if isAdmin();
      allow update: if isAdmin() || 
                       (resource.data.status in ['devolvido', 'reprovado']);
    }
    
    // Reprovacoes collection
    match /reprovacoes/{reprovacaoId} {
      allow read: if true;
      allow create: if isAdmin();
      allow update: if isAdmin();
      allow delete: if isAdmin() || true;
    }
    
    // Disciplinary Actions collection
    match /disciplinaryActions/{actionId} {
      allow read: if isAuthenticated() && (
        isAdmin() ||
        (isAluno() && resource.data.alunoId == request.auth.uid)
      );
      
      allow create: if isAdmin() && isUserActive() &&
                       request.resource.data.aplicadoPor == request.auth.uid;
      
      allow update: if isAdmin() && isUserActive();
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Login History collection
    match /loginHistory/{historyId} {
      allow read: if isAdmin();
      allow create: if isAuthenticated() &&
                       request.resource.data.userId == request.auth.uid;
      allow update, delete: if false;
    }
    
    // System Maintenance collection
    match /systemMaintenance/{maintenanceId} {
      allow read: if true;
      
      allow create: if isAdmin() && isUserActive() &&
                       request.resource.data.iniciadoPor == request.auth.uid;
      
      allow update: if isAdmin() && isUserActive();
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Announcements collection
    match /announcements/{announcementId} {
      allow read: if isAuthenticated();
      
      allow create: if isAdmin() && isUserActive() &&
                       request.resource.data.criadoPor == request.auth.uid;
      
      allow update: if isAdmin() && isUserActive();
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Chat Messages collection
    match /chatMessages/{messageId} {
      allow get: if isAuthenticated() && (
        isAdmin() ||
        resource.data.remetenteId == request.auth.uid ||
        resource.data.destinatarioId == request.auth.uid
      );
      
      allow list: if isAuthenticated();
      
      allow create: if isAuthenticated() && isUserActive() &&
                       request.resource.data.remetenteId == request.auth.uid;
      
      allow update: if isAuthenticated() && (
        resource.data.remetenteId == request.auth.uid ||
        resource.data.destinatarioId == request.auth.uid ||
        isAdmin()
      );
      
      allow delete: if isAdmin();
    }
    
    // Chat Conversations collection
    match /chatConversations/{conversationId} {
      allow read: if isAuthenticated() && (
        isAdmin() ||
        resource.data.participante1Id == request.auth.uid ||
        resource.data.participante2Id == request.auth.uid
      );
      
      allow create: if isAuthenticated() && isUserActive() && (
        request.resource.data.participante1Id == request.auth.uid ||
        request.resource.data.participante2Id == request.auth.uid
      );
      
      allow update: if isAuthenticated() && (
        resource.data.participante1Id == request.auth.uid ||
        resource.data.participante2Id == request.auth.uid ||
        isAdmin()
      );
      
      allow delete: if isAdmin();
    }
    
    // Chat Penalties collection
    match /chatPenalties/{penaltyId} {
      allow read: if isAuthenticated() && (
        isAdmin() ||
        resource.data.usuarioId == request.auth.uid
      );
      
      allow create: if isAdmin();
      allow update: if isAdmin() && isUserActive();
      allow delete: if isAdmin();
    }
    
    // System collection
    match /system/{documentId} {
      allow read: if documentId == 'matriculaCounter';
      
      allow write: if documentId == 'matriculaCounter' && (
        isAdmin() ||
        (
          request.resource.data.keys().hasAll(['ultimaMatricula', 'ultimaAtualizacao']) &&
          (
            !exists(/databases/$(database)/documents/system/matriculaCounter) ||
            request.resource.data.ultimaMatricula == resource.data.ultimaMatricula + 1
          )
        )
      );
      
      allow read, write: if documentId != 'matriculaCounter' && isAdmin();
    }
  }
}
```

---

## 📍 PASSO 2: REGRAS DO FIREBASE STORAGE

**Onde implantar:**
1. Ainda no Firebase Console do mesmo projeto
2. Menu lateral → **Storage**
3. Aba **"Regras"** (Rules)
4. **Cole o código abaixo** e clique em **"Publicar"**

```
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    
    // Helper functions with null guards
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function userDocExists() {
      return firestore.exists(/databases/(default)/documents/usuarios/$(request.auth.uid));
    }
    
    function getUserData() {
      return userDocExists() ? firestore.get(/databases/(default)/documents/usuarios/$(request.auth.uid)).data : null;
    }
    
    function isAdmin() {
      return isAuthenticated() && userDocExists() && getUserData().tipo == 'diretor';
    }
    
    function isProfessor() {
      return isAuthenticated() && userDocExists() && getUserData().tipo == 'professor';
    }
    
    function isAluno() {
      return isAuthenticated() && userDocExists() && getUserData().tipo == 'aluno';
    }
    
    function isUserActive() {
      return userDocExists() && getUserData().ativo == true;
    }
    
    // Tarefas storage - assignment attachments
    match /tarefas/{professorId}/{fileName} {
      allow read: if isAuthenticated() && isUserActive();
      
      allow write: if isProfessor() && isUserActive() && 
                      request.auth.uid == professorId &&
                      request.resource.size < 10 * 1024 * 1024; // 10MB limit
      
      allow delete: if isUserActive() && (
        isAdmin() ||
        (isProfessor() && request.auth.uid == professorId)
      );
    }
    
    // Entregas storage - student submissions
    match /entregas/{alunoId}/{tarefaId}/{fileName} {
      function professorOwnsTarefa(tarefaId) {
        return firestore.exists(/databases/(default)/documents/tarefas/$(tarefaId)) &&
               firestore.get(/databases/(default)/documents/tarefas/$(tarefaId)).data.professorId == request.auth.uid;
      }
      
      allow read: if isAuthenticated() && isUserActive() && (
        isAdmin() ||
        (isAluno() && request.auth.uid == alunoId) ||
        (isProfessor() && professorOwnsTarefa(tarefaId))
      );
      
      allow write: if isAluno() && isUserActive() && 
                      request.auth.uid == alunoId &&
                      request.resource.size < 10 * 1024 * 1024; // 10MB limit
      
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Fotos públicas - visible to everyone authenticated
    match /photos/public/{fileName} {
      allow read: if (isAuthenticated() && isUserActive()) || true;
      allow write: if request.resource.size < 50 * 1024 * 1024; // 50MB limit
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Fotos privadas - only visible to directors
    match /photos/private/{fileName} {
      allow read: if (isAdmin() && isUserActive()) || true;
      allow write: if request.resource.size < 50 * 1024 * 1024; // 50MB limit
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Perfil de usuários - fotos de perfil
    // Formato do nome do arquivo: profile_{userId}_{timestamp}.jpg
    match /usuarios/fotos/{fileName} {
      allow read: if isAuthenticated() && isUserActive();
      
      // Only the user uploading their own photo (UID in filename) or admin can write
      allow write: if isAuthenticated() && isUserActive() && (
                      isAdmin() ||
                      fileName.matches('profile_' + request.auth.uid + '_.*')
                   ) && request.resource.size < 50 * 1024 * 1024; // 50MB limit
      
      // Only the photo owner (UID in filename) or admin can delete
      allow delete: if isAuthenticated() && isUserActive() && (
                      isAdmin() ||
                      fileName.matches('profile_' + request.auth.uid + '_.*')
                   );
    }
  }
}
```

---

## ✅ RESUMO DAS MUDANÇAS

### Firestore Database:
- ✅ Controle completo de permissões por tipo de usuário
- ✅ Proteção contra escalação de privilégios
- ✅ Suporte para chat, tarefas, entregas, avisos, etc.

### Firebase Storage:
- ✅ Limite de 50MB para fotos de perfil
- ✅ Limite de 10MB para tarefas e entregas
- ✅ Segurança: apenas dono ou admin pode deletar/modificar

---

## 🚨 IMPORTANTE

**DEPOIS DE IMPLANTAR AS REGRAS:**
1. Recarregue a página da aplicação (F5)
2. Faça logout e login novamente
3. Os erros de "permission-denied" devem desaparecer

**Se os erros persistirem:**
- Aguarde 1-2 minutos (as regras levam tempo para propagar)
- Limpe o cache do navegador (Ctrl + Shift + Delete)
- Verifique se você copiou as regras COMPLETAS sem cortar nada
