# 🚨 DEPLOY URGENTE - Regras do Firestore Atualizadas

## ⚠️ CORREÇÃO APLICADA
Corrigi o problema de permissões nas regras do Firestore. Agora você precisa publicar essas regras.

## 📝 PASSOS PARA RESOLVER O ERRO

### 1️⃣ Acesse o Firebase Console
🔗 https://console.firebase.google.com/project/plataforma-enem-f3682/firestore/rules

### 2️⃣ Cole as Novas Regras
- No editor que aparece, **DELETE TUDO** que está lá
- **COPIE** o conteúdo do arquivo `firestore.rules` deste projeto (veja abaixo)
- **COLE** no editor do Firebase Console

### 3️⃣ Publique
- Clique no botão **"Publicar"** (azul, no canto superior direito)
- Aguarde a confirmação (leva 5-10 segundos)

### 4️⃣ Teste
- Recarregue a página da aplicação (F5)
- Tente aplicar a advertência/suspensão novamente

---

## 📋 COPIE ESTE CONTEÚDO COMPLETO

Copie tudo entre as linhas abaixo (inclusive a primeira e última linha):

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
      allow get: if isAuthenticated() && (
        request.auth.uid == userId || 
        (exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) && 
         get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.tipo == 'diretor')
      );
      
      allow list: if isAuthenticated() && 
                     exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) && 
                     get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.tipo == 'diretor';
      
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

## 🔍 O QUE FOI CORRIGIDO

A função `isUserActive()` agora aceita tanto o valor booleano `true` quanto a string `"true"`, resolvendo o problema de permissão.

**Antes:**
```javascript
function isUserActive() {
  return userDocExists() && getUserData().ativo == true;
}
```

**Depois (CORRIGIDO):**
```javascript
function isUserActive() {
  return userDocExists() && (getUserData().ativo == true || getUserData().ativo == 'true');
}
```

## ✅ Após Publicar

Aguarde 10-15 segundos e então:
1. Recarregue a página (F5)
2. Tente aplicar a advertência/suspensão novamente
3. Deve funcionar perfeitamente!

---

Se tiver qualquer dúvida, me avise!
