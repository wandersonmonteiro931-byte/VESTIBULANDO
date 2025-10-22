# 🔐 Deploy das Regras de Advertências e Suspensões

## ⚠️ AÇÃO NECESSÁRIA
Para que o sistema de advertências e suspensões funcione, você precisa atualizar as regras do Firestore no Firebase Console.

## 📝 Passos para Publicar

### 1. Acesse o Firebase Console
- Vá para: https://console.firebase.google.com/
- Selecione o projeto: **plataforma-enem-f3682**

### 2. Navegue até Firestore Rules
- No menu lateral esquerdo, clique em **Firestore Database**
- Clique na aba **Rules** (Regras) no topo

### 3. Substitua as Regras
- **Copie** todo o conteúdo do arquivo `firestore.rules` deste projeto
- **Cole** no editor do Firebase Console (substituindo as regras antigas)

### 4. Publique as Mudanças
- Clique no botão **Publish** (Publicar)
- Aguarde a confirmação de sucesso (pode levar alguns segundos)

### 5. Recarregue a Aplicação
- Pressione F5 para recarregar a página
- O sistema de advertências deve funcionar normalmente agora

## ✨ O que foi adicionado

### Novas Regras de Segurança:

```javascript
// Disciplinary Actions collection - advertências e suspensões
match /disciplinaryActions/{actionId} {
  // Alunos podem ler suas próprias ações disciplinares
  // Diretores podem ler todas as ações disciplinares
  allow read: if isAuthenticated() && (
    isAdmin() ||
    (isAluno() && resource.data.alunoId == request.auth.uid)
  );
  
  // Apenas diretores podem criar ações disciplinares
  allow create: if isAdmin() && isUserActive() &&
                   request.resource.data.aplicadoPor == request.auth.uid;
  
  // Apenas diretores podem atualizar ações disciplinares (para remover)
  allow update: if isAdmin() && isUserActive();
  
  // Apenas diretores podem deletar ações disciplinares
  allow delete: if isAdmin() && isUserActive();
}
```

## 🎯 Funcionalidades Implementadas

Após publicar as regras, as seguintes funcionalidades estarão disponíveis:

### Para Diretores:
- ✅ Aplicar advertências (máximo 3 por aluno)
- ✅ Aplicar suspensões (bloqueio automático por 2 dias)
- ✅ Remover advertências e suspensões
- ✅ Ver histórico completo de ações disciplinares
- ✅ Buscar alunos por nome ou matrícula
- ✅ Status em tempo real das ações

### Para Alunos:
- ✅ Ver suas advertências e suspensões ativas
- ✅ Ver histórico de advertências removidas
- ✅ Informações detalhadas sobre suspensões (data de término)
- ✅ Notificação visual na aba "Advertências"
- ✅ Bloqueio de login durante suspensão

## 🔒 Segurança

As regras garantem que:
- ✅ Apenas diretores podem aplicar e remover ações disciplinares
- ✅ Alunos só podem ver suas próprias advertências/suspensões
- ✅ Histórico completo é preservado para auditoria
- ✅ Modificações requerem autenticação e autorização adequadas

## ❓ Resolução de Problemas

### Se ainda aparecer "permission-denied":
1. Aguarde 10-15 segundos após publicar (propagação das regras)
2. Limpe o cache do navegador (Ctrl + Shift + Delete)
3. Faça logout e login novamente
4. Recarregue a página completamente (Ctrl + F5)

### Se não conseguir publicar as regras:
1. Verifique se você tem permissão de administrador no projeto Firebase
2. Verifique se está no projeto correto (plataforma-enem-f3682)
3. Tente fazer logout e login novamente no Firebase Console
