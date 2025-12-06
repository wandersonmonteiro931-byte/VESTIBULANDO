# 🔐 REGRAS DO FIREBASE - IMPLANTAÇÃO IMEDIATA

**ATENÇÃO:** O erro "permission-denied" que você está vendo é porque as regras no Firebase Console não estão atualizadas. Siga os passos abaixo para corrigir.

---

## 📍 PASSO 1: REGRAS DO FIRESTORE DATABASE

### Como Implantar:
1. Acesse: https://console.firebase.google.com/
2. Selecione o projeto: `plataforma-enem-f3682`
3. Menu lateral → **Firestore Database**
4. Clique na aba **"Regras"** (Rules)
5. **APAGUE TODO O CONTEÚDO ATUAL**
6. **COLE O CÓDIGO ABAIXO**
7. Clique em **"Publicar"**

### Código das Regras do Firestore:

```javascript
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
    
    function getUserTurma() {
      return userDocExists() ? getUserData().turma : null;
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
      
      allow update: if isAuthenticated() && request.auth.uid == userId &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['isOnline', 'lastSeen', 'lastActivity', 'statusPresenca']);
      
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
        (isProfessor() && resource.data.professorId == request.auth.uid) ||
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
      
      allow update: if (isAdmin() && isUserActive()) ||
                       (isAluno() && 
                        resource.data.alunoId == request.auth.uid &&
                        resource.data.tipo == "advertencia" &&
                        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['visualizado', 'dataVisualizacao']));
      
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Disciplinary Requests collection
    match /disciplinaryRequests/{requestId} {
      allow read: if isAuthenticated() && isUserActive() && (
        isAdmin() ||
        (isProfessor() && resource.data.solicitadoPor == request.auth.uid)
      );
      
      allow create: if isUserActive() &&
                       (isProfessor() || isAdmin()) &&
                       request.resource.data.solicitadoPor == request.auth.uid;
      
      allow update: if isUserActive() && (
        isAdmin() ||
        (isProfessor() && 
         resource.data.solicitadoPor == request.auth.uid &&
         resource.data.status == "pendente")
      );
      
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
    
    // User Blocks collection
    match /userBlocks/{blockId} {
      allow list: if isAuthenticated();
      
      allow get: if isAuthenticated() && (
        isAdmin() ||
        resource.data.bloqueadorId == request.auth.uid ||
        resource.data.bloqueadoId == request.auth.uid
      );
      
      allow create: if isAuthenticated() && isUserActive() &&
                       request.resource.data.bloqueadorId == request.auth.uid;
      
      allow update: if isAuthenticated() && isUserActive() &&
                       resource.data.bloqueadorId == request.auth.uid;
      
      allow delete: if isAuthenticated() && (
        isAdmin() ||
        resource.data.bloqueadorId == request.auth.uid
      );
    }
    
    // Chat Reports collection
    match /chatReports/{reportId} {
      allow read: if isAdmin();
      allow create: if isAuthenticated() && isUserActive() &&
                       request.resource.data.denuncianteId == request.auth.uid;
      allow update: if isAdmin() && isUserActive();
      allow delete: if isAdmin();
    }
    
    // Avaliacoes collection
    match /avaliacoes/{avaliacaoId} {
      function isTargetedStudent() {
        return isAluno() && (
          resource.data.turmaId == getUserData().turma ||
          (resource.data.alunosIds != null && request.auth.uid in resource.data.alunosIds)
        );
      }
      
      allow read: if isAuthenticated() && (
        isAdmin() ||
        isProfessor() ||
        isTargetedStudent()
      );
      
      allow create: if isAuthenticated() && isUserActive() && (
        isAdmin() ||
        (isProfessor() && request.resource.data.professorId == request.auth.uid)
      );
      
      allow update: if isAuthenticated() && isUserActive() && (
        isAdmin() ||
        (isProfessor() && resource.data.professorId == request.auth.uid)
      );
      
      allow delete: if isAuthenticated() && isUserActive() && (
        isAdmin() ||
        (isProfessor() && resource.data.professorId == request.auth.uid)
      );
    }
    
    // Avaliacao Questoes collection
    match /avaliacaoQuestoes/{questaoId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && isUserActive() && (isAdmin() || isProfessor());
      allow update: if isAuthenticated() && isUserActive() && (isAdmin() || isProfessor());
      allow delete: if isAuthenticated() && isUserActive() && (isAdmin() || isProfessor());
    }
    
    // Avaliacao Templates collection
    match /avaliacaoTemplates/{templateId} {
      allow read: if isAuthenticated() && (isAdmin() || isProfessor());
      allow create: if isAuthenticated() && isUserActive() && (isAdmin() || isProfessor());
      allow update: if isAuthenticated() && isUserActive() && (isAdmin() || isProfessor());
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Avaliacao Entregas collection
    match /avaliacaoEntregas/{entregaId} {
      function professorOwnsAvaliacao(avaliacaoId) {
        return exists(/databases/$(database)/documents/avaliacoes/$(avaliacaoId)) &&
               get(/databases/$(database)/documents/avaliacoes/$(avaliacaoId)).data.professorId == request.auth.uid;
      }
      
      allow read: if isAuthenticated() && (
        isAdmin() ||
        (isAluno() && resource.data.alunoId == request.auth.uid) ||
        (isProfessor() && resource.data.professorId == request.auth.uid) ||
        (isProfessor() && professorOwnsAvaliacao(resource.data.avaliacaoId))
      );
      
      allow create: if isAluno() && isUserActive() &&
                       request.resource.data.alunoId == request.auth.uid;
      
      allow update: if isAuthenticated() && isUserActive() && (
        isAdmin() ||
        (isProfessor() && professorOwnsAvaliacao(resource.data.avaliacaoId))
      );
      
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Avaliacao Autorizacoes Atraso collection
    match /avaliacaoAutorizacoesAtraso/{autorizacaoId} {
      allow read: if isAuthenticated() && (
        isAdmin() ||
        isProfessor() ||
        (isAluno() && resource.data.alunoId == request.auth.uid)
      );
      
      allow create: if isAluno() && isUserActive() &&
                       request.resource.data.alunoId == request.auth.uid &&
                       request.resource.data.status == 'pendente';
      
      allow update: if isAuthenticated() && isUserActive() && (isAdmin() || isProfessor());
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Boletins collection
    match /boletins/{boletimId} {
      allow read: if isAuthenticated() && (
        isAdmin() ||
        isProfessor() ||
        (isAluno() && resource.data.alunoId == request.auth.uid && resource.data.liberado == true)
      );
      
      allow create: if isAdmin() && isUserActive();
      allow update: if isAdmin() && isUserActive();
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Boletim Configs collection
    match /boletimConfigs/{configId} {
      allow read: if isAuthenticated() && (isAdmin() || isProfessor());
      allow create: if isAdmin() && isUserActive();
      allow update: if isAdmin() && isUserActive();
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Boletim Documentos collection
    match /boletimDocumentos/{docId} {
      allow read: if isAuthenticated() && (
        isAdmin() ||
        isProfessor() ||
        (isAluno() && resource.data.alunoId == request.auth.uid)
      );
      
      allow create: if isAdmin() && isUserActive();
      allow update: if isAdmin() && isUserActive();
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Notas Bimestre collection
    match /notasBimestre/{notaId} {
      allow read: if isAuthenticated() && (
        isAdmin() ||
        isProfessor() ||
        (isAluno() && resource.data.alunoId == request.auth.uid)
      );
      
      allow create: if isAuthenticated() && isUserActive() && (isAdmin() || isProfessor());
      allow update: if isAuthenticated() && isUserActive() && (isAdmin() || isProfessor());
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Frequencia collection
    match /frequencia/{freqId} {
      allow read: if isAuthenticated() && (
        isAdmin() ||
        isProfessor() ||
        (isAluno() && resource.data.alunoId == request.auth.uid)
      );
      
      allow create: if isAuthenticated() && isUserActive() && (isAdmin() || isProfessor());
      allow update: if isAuthenticated() && isUserActive() && (isAdmin() || isProfessor());
      allow delete: if isAdmin() && isUserActive();
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
    
    // Configuracao Horarios collection
    match /configuracaoHorarios/{horarioId} {
      allow read: if isAuthenticated() && isUserActive();
      allow create: if isAdmin() && isUserActive();
      allow update: if isAdmin() && isUserActive();
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Materias collection
    match /materias/{materiaId} {
      allow read: if isAuthenticated() && isUserActive();
      allow create: if isAdmin() && isUserActive();
      allow update: if isAdmin() && isUserActive();
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Eventos Calendario collection
    match /eventosCalendario/{eventoId} {
      allow read: if isAuthenticated() && isUserActive();
      allow create: if isAdmin() && isUserActive();
      allow update: if isAdmin() && isUserActive();
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Chamadas Diarias collection
    match /chamadasDiarias/{chamadaId} {
      allow read: if isAuthenticated() && isUserActive() && (
        isAdmin() ||
        (isProfessor() && resource.data.professorId == request.auth.uid) ||
        (isAluno() && resource.data.turmaId == getUserTurma())
      );
      
      allow create: if isAuthenticated() && isUserActive() && (
        isAdmin() ||
        (isProfessor() && request.resource.data.professorId == request.auth.uid)
      );
      
      allow update: if isAuthenticated() && isUserActive() && (
        isAdmin() ||
        (isProfessor() && 
         resource.data.professorId == request.auth.uid &&
         request.resource.data.diff(resource.data).affectedKeys().hasOnly(['professorConfirmou', 'professorConfirmouEm', 'professorAusente', 'status']))
      );
      
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Registros Presenca Chamada collection
    match /registrosPresencaChamada/{registroId} {
      allow read: if isAuthenticated() && isUserActive() && (
        isAdmin() ||
        isProfessor() ||
        (isAluno() && resource.data.alunoId == request.auth.uid)
      );
      
      allow create: if (isAdmin() || isProfessor()) && isUserActive();
      
      allow update: if isAuthenticated() && isUserActive() && (
        isAdmin() ||
        isProfessor() ||
        (isAluno() && 
         resource.data.alunoId == request.auth.uid &&
         request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'confirmadoPeloAluno', 'dataConfirmacaoAluno', 'dataAtualizacao']) &&
         resource.data.status == "aguardando" &&
         request.resource.data.status == "presente" &&
         resource.data.confirmadoPeloAluno == false &&
         request.resource.data.confirmadoPeloAluno == true)
      );
      
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Resumos Presenca Dia collection
    match /resumosPresencaDia/{resumoId} {
      allow read: if isAuthenticated() && isUserActive() && (
        isAdmin() ||
        isProfessor() ||
        (isAluno() && resource.data.alunoId == request.auth.uid)
      );
      
      allow create, update: if isAuthenticated() && isUserActive();
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Sessoes Aula Ao Vivo collection
    match /sessoesAulaAoVivo/{sessaoId} {
      allow read: if isAuthenticated() && isUserActive() && (
        isAdmin() ||
        (isProfessor() && resource.data.professorId == request.auth.uid) ||
        (isAluno() && resource.data.turmaId == getUserTurma())
      );
      
      allow create: if isAuthenticated() && isUserActive() && (
        isAdmin() ||
        (isProfessor() && request.resource.data.professorId == request.auth.uid)
      );
      
      allow update: if isAuthenticated() && isUserActive() && (
        isAdmin() ||
        (isProfessor() && 
         resource.data.professorId == request.auth.uid &&
         request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'dataFim', 'dataAtualizacao']))
      );
      
      allow delete: if isAdmin() && isUserActive();
    }
  }
}
```

---

## 📍 PASSO 2: REGRAS DO FIREBASE STORAGE

### Como Implantar:
1. No mesmo Firebase Console
2. Menu lateral → **Storage**
3. Clique na aba **"Regras"** (Rules)
4. **APAGUE TODO O CONTEÚDO ATUAL**
5. **COLE O CÓDIGO ABAIXO**
6. Clique em **"Publicar"**

### Código das Regras do Storage:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    
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
    
    // Tarefas storage
    match /tarefas/{professorId}/{fileName} {
      allow read: if isAuthenticated() && isUserActive();
      
      allow write: if isProfessor() && isUserActive() && 
                      request.auth.uid == professorId &&
                      request.resource.size < 10 * 1024 * 1024;
      
      allow delete: if isUserActive() && (
        isAdmin() ||
        (isProfessor() && request.auth.uid == professorId)
      );
    }
    
    // Entregas storage
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
                      request.resource.size < 10 * 1024 * 1024;
      
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Fotos publicas
    match /photos/public/{fileName} {
      allow read: if true;
      allow write: if request.resource.size < 50 * 1024 * 1024;
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Fotos privadas
    match /photos/private/{fileName} {
      allow read: if true;
      allow write: if request.resource.size < 50 * 1024 * 1024;
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Perfil de usuarios
    match /usuarios/fotos/{fileName} {
      allow read: if isAuthenticated() && isUserActive();
      
      allow write: if isAuthenticated() && isUserActive() && (
                      isAdmin() ||
                      fileName.matches('profile_' + request.auth.uid + '_.*')
                   ) && request.resource.size < 50 * 1024 * 1024;
      
      allow delete: if isAuthenticated() && isUserActive() && (
                      isAdmin() ||
                      fileName.matches('profile_' + request.auth.uid + '_.*')
                   );
    }
  }
}
```

---

## ✅ DEPOIS DE IMPLANTAR

1. **Aguarde 1-2 minutos** para as regras propagarem
2. **Limpe o cache do navegador** (Ctrl + Shift + Delete)
3. **Recarregue a página** (F5)
4. **Tente fazer login novamente**

---

## 🚨 IMPORTANTE

Se o erro persistir após seguir todos os passos:
- Verifique se copiou o código COMPLETO sem cortar nada
- Confirme que clicou em "Publicar" em ambas as seções
- Aguarde mais alguns minutos e tente novamente
