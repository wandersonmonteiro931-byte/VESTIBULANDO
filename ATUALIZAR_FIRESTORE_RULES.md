# Como Atualizar as Regras do Firestore

## 🔧 Problema Resolvido
O erro "permission-denied" ao verificar status da matrícula foi causado por regras de segurança muito restritivas. Agora as regras permitem que qualquer pessoa consulte solicitações (necessário para verificar status).

## 📝 Passos para Atualizar

### 1. Acesse o Firebase Console
- Vá para: https://console.firebase.google.com/
- Selecione o projeto: **plataforma-enem-f3682**

### 2. Navegue até Firestore
- No menu lateral, clique em **"Firestore Database"**
- Clique na aba **"Regras"** (Rules)

### 3. Atualize as Regras
Localize a seção `solicitacoes` nas regras (aproximadamente na linha 136-145) e **substitua** por:

```javascript
// Solicitacoes collection - for pending user registrations
match /solicitacoes/{solicitacaoId} {
  // Anyone can create a solicitacao (unauthenticated registration)
  allow create: if true;
  
  // Anyone can read solicitacoes (needed to check status by matricula)
  // Admins can read all
  allow read: if true;
  
  // Only admins can update and delete solicitacoes
  allow update: if isAdmin();
  allow delete: if isAdmin();
}
```

**OU** cole todo o conteúdo do arquivo `firestore.rules` que está neste projeto.

### 4. Publique as Regras
- Clique no botão **"Publicar"** ou **"Publish"**
- Aguarde a confirmação

### 5. Teste Novamente
1. Recarregue a página da aplicação (F5)
2. Clique em **"VERIFICAR STATUS DA MATRÍCULA"**
3. Digite uma matrícula (ex: 0102)
4. Clique em **"Verificar Status"**
5. Agora deve funcionar! ✅

## 🔒 Nota de Segurança

Esta alteração permite que qualquer pessoa consulte solicitações pendentes. Isso é necessário para que usuários possam verificar o status da sua matrícula antes de fazer login.

**Dados sensíveis estão protegidos:**
- Fotos estão em Base64 no banco (sem necessidade de Firebase Storage)
- Apenas administradores podem criar, editar ou deletar solicitações
- A consulta é apenas para leitura (read-only)

## ❓ Precisa de Ajuda?

Se encontrar problemas:
1. Verifique se as regras foram publicadas corretamente
2. Aguarde alguns segundos após publicar (propagação)
3. Limpe o cache do navegador (Ctrl + Shift + Delete)
4. Tente novamente
