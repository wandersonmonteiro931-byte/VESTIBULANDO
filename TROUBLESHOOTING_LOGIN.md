# 🔧 Guia de Resolução de Problemas de Login

## ❌ Problema: Não consigo fazer login como Diretor ou Aluno

### Erro recebido
```
auth/invalid-credential
Email ou senha incorretos
```

---

## ✅ Checklist de Verificação no Firebase Console

Siga TODOS os passos abaixo em ordem:

### 1️⃣ Verificar se Email/Password está HABILITADO

**PASSO A PASSO:**

1. Acesse https://console.firebase.google.com/
2. Selecione seu projeto: **plataforma-enem**
3. No menu lateral esquerdo, clique em **Authentication** (🔐)
4. Clique na aba **Sign-in method** (segunda aba no topo)
5. Na lista de provedores, procure **Email/Password**
6. **VERIFIQUE** se está com status **Enabled** (verde)
7. Se estiver **Disabled** (cinza):
   - Clique nele
   - Clique no toggle para **Enable**
   - **Marque também** "Email link (passwordless sign-in)" se disponível
   - Clique em **Save**

⚠️ **IMPORTANTE**: Se esse método não estiver habilitado, NENHUM login funcionará!

---

### 2️⃣ Criar um Usuário de Teste do ZERO

Vamos criar um usuário completamente novo para testar:

**NO AUTHENTICATION:**

1. Ainda em **Authentication** > **Users**
2. Clique em **Add user** (botão azul)
3. Preencha:
   - **Email**: `teste@enemplus.com`
   - **Password**: `Teste123456!`
   - **User UID**: deixe em branco (Firebase gera automaticamente)
4. Clique em **Add user**
5. **COPIE O UID** gerado (exemplo: `AbC123XyZ...`)

**NO FIRESTORE:**

1. No menu lateral, vá em **Firestore Database**
2. Clique na coleção **usuarios**
3. Clique em **Add document** (ou **Adicionar documento**)
4. **Document ID**: Cole o **UID** que você copiou
5. Adicione os seguintes campos:

```
Campo: tipo          Tipo: string      Valor: "diretor"
Campo: nome          Tipo: string      Valor: "Usuario Teste"
Campo: email         Tipo: string      Valor: "teste@enemplus.com"
Campo: ativo         Tipo: boolean     Valor: true
Campo: status        Tipo: string      Valor: "aprovado"
```

6. Clique em **Save**

---

### 3️⃣ Testar o Login

1. Volte para a aplicação ENEM+
2. Clique em **"Acesso da Diretoria"**
3. Digite:
   - **Email**: `teste@enemplus.com`
   - **Senha**: `Teste123456!`
4. Clique em **Entrar**

**✅ Se funcionar**: O problema era com as credenciais antigas
**❌ Se NÃO funcionar**: Vá para o próximo passo

---

### 4️⃣ Verificar Domínios Autorizados

1. No Firebase Console, **Authentication** > **Settings** (aba Configurações)
2. Role até **Authorized domains** (Domínios autorizados)
3. Verifique se está na lista:
   - `replit.dev`
   - O domínio específico do seu Repl (exemplo: `abc123.replit.dev`)
4. Se não estiver, clique em **Add domain** e adicione

---

### 5️⃣ Verificar Regras do Firestore

1. No Firebase Console, **Firestore Database** > **Rules**
2. Verifique se as regras permitem leitura da coleção `usuarios`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{userId} {
      allow read: if request.auth != null && 
                     (request.auth.uid == userId || 
                      get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.tipo == 'diretor');
      
      allow create: if request.auth != null && 
                       request.auth.uid == userId;
    }
  }
}
```

3. Se as regras estiverem muito restritivas, clique em **Publish** para atualizar

---

### 6️⃣ Verificar Secrets do Replit

1. No Replit, abra o painel **Secrets** (ícone de cadeado no menu lateral)
2. Verifique se existem as variáveis:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`

3. **Para obter os valores corretos**:
   - Firebase Console > ⚙️ **Project Settings** (Configurações do Projeto)
   - Role até **Your apps** (Seus apps)
   - Clique no app Web
   - Copie os valores de `firebaseConfig`:
     - `apiKey` → VITE_FIREBASE_API_KEY
     - `projectId` → VITE_FIREBASE_PROJECT_ID
     - `appId` → VITE_FIREBASE_APP_ID

4. Se algum estiver faltando ou errado, **atualize** e **reinicie o servidor**

---

## 🔍 Debug Avançado

Se NADA funcionar, abra o Console do navegador (F12) e:

1. Vá na aba **Console**
2. Tente fazer login
3. Procure por mensagens começando com:
   - 🔑 Tentando login...
   - ❌ Erro durante login...
   - ✅ Firebase inicializado...

4. **Tire um print** dessas mensagens e envie para análise

---

## 📞 Última Tentativa

Se seguiu TODOS os passos acima e ainda não funciona:

1. **Delete TODOS os usuários** do Authentication
2. **Delete TODOS os documentos** da coleção `usuarios` do Firestore
3. **Crie UM usuário novo** seguindo o Passo 2
4. **Tente fazer login** com esse usuário novo

---

## ✅ Solução Funcionou?

Depois que o login de teste funcionar:

1. Você pode criar o usuário diretor real:
   - Email: `wandersonmcamargo@gmail.com`
   - Senha: (escolha uma senha forte)

2. Siga o mesmo processo do Passo 2

3. Faça login com as credenciais reais

---

**Data deste guia**: 22 de Outubro de 2025
