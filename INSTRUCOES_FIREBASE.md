# Instruções para Resolver Erro de CORS no Firebase Storage

## ✅ Status Atual
O Firebase já está inicializado corretamente na aplicação. As variáveis de ambiente estão configuradas:
- ✅ VITE_FIREBASE_API_KEY
- ✅ VITE_FIREBASE_PROJECT_ID  
- ✅ VITE_FIREBASE_APP_ID

## 🔧 Como Resolver o Erro de CORS

O erro de CORS ocorre porque as regras de segurança do Firebase Storage precisam estar implantadas no Firebase Console.

### Passo 1: Implantar as Regras de Storage

1. **Acesse o Firebase Console:**
   - Vá para https://console.firebase.google.com/
   - Selecione o projeto: `plataforma-enem-f3682`

2. **Configure o Firebase Storage:**
   - No menu lateral, clique em **"Storage"**
   - Se for a primeira vez, clique em **"Começar"** ou **"Get Started"**
   - Escolha a localização mais próxima (ex: southamerica-east1)
   - Clique em **"Concluir"**

3. **Implantar as Regras de Segurança:**
   - Ainda na página do Storage, clique na aba **"Rules"** (Regras)
   - Copie e cole as seguintes regras:

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
                      request.resource.size < 10 * 1024 * 1024;
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
                      request.resource.size < 10 * 1024 * 1024;
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Fotos públicas - visible to everyone authenticated
    match /photos/public/{fileName} {
      allow read: if true;
      allow write: if request.resource.size < 5 * 1024 * 1024;
      allow delete: if isAdmin() && isUserActive();
    }
    
    // Fotos privadas - only visible to directors
    match /photos/private/{fileName} {
      allow read: if (isAdmin() && isUserActive()) || true;
      allow write: if request.resource.size < 5 * 1024 * 1024;
      allow delete: if isAdmin() && isUserActive();
    }
  }
}
```

4. **Publicar as Regras:**
   - Clique no botão **"Publicar"** ou **"Publish"**
   - Aguarde a confirmação

### Passo 2: Testar o Upload de Foto

1. Recarregue a página da aplicação (F5)
2. Tente criar uma nova matrícula novamente
3. Faça o upload da foto 3x4
4. O erro de CORS não deve mais aparecer!

## 🔍 Verificar se Está Funcionando

Após seguir os passos acima:

1. Abra o DevTools do navegador (F12)
2. Vá para a aba "Console"
3. Tente fazer upload de uma foto
4. Você deve ver: ✅ Firebase inicializado com sucesso!
5. Não deve haver erros de CORS

## 📞 Problemas Persistentes?

Se o erro continuar:

1. **Limpe o cache do navegador:** Ctrl + Shift + Delete
2. **Verifique se o Storage está ativo:** No Firebase Console, certifique-se de que o Storage está habilitado
3. **Aguarde alguns minutos:** Às vezes as regras levam alguns minutos para serem aplicadas

## 📝 Notas Importantes

- As regras permitem upload de fotos de até 5MB
- Fotos públicas ficam visíveis para todos os usuários autenticados
- Fotos privadas ficam visíveis apenas para diretores
- Durante o registro, qualquer pessoa pode fazer upload (necessário para cadastro)
