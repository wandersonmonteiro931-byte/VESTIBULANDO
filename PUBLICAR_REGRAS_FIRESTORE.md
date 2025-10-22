# 🔐 Como Publicar as Regras do Firestore

## ⚠️ IMPORTANTE
Você precisa publicar as regras atualizadas do Firestore para que o cadastro de alunos funcione corretamente.

## 📝 Passos para Publicar

### 1. Acesse o Firebase Console
- Vá para: https://console.firebase.google.com/
- Selecione seu projeto: **plataforma-enem**

### 2. Navegue até Firestore Rules
- No menu lateral esquerdo, clique em **Firestore Database**
- Clique na aba **Rules** (Regras) no topo

### 3. Substitua as Regras
- **Apague** todo o conteúdo atual
- **Copie** o conteúdo do arquivo `firestore.rules` deste projeto
- **Cole** no editor do Firebase Console

### 4. Publique as Mudanças
- Clique no botão **Publish** (Publicar)
- Aguarde a confirmação de sucesso

## ✅ O que foi modificado

### Antes:
```javascript
// Turmas collection
match /turmas/{turmaId} {
  // Anyone authenticated can read turmas
  allow read: if isAuthenticated() && isUserActive();
  ...
}
```

### Depois:
```javascript
// Turmas collection
match /turmas/{turmaId} {
  // Anyone can read turmas (needed for registration page)
  allow read: if true;
  ...
}
```

## 🎯 Por que essa mudança é necessária?

Na tela de cadastro, os alunos **ainda não estão autenticados** (eles estão se registrando pela primeira vez). Portanto, eles precisam poder ler as turmas disponíveis para escolher uma durante o cadastro.

## 🔒 Segurança

Essa mudança é segura porque:
- ✅ Apenas a **leitura** de turmas está aberta
- ✅ **Criar, editar e deletar** turmas continua restrito aos administradores
- ✅ As informações de turmas são públicas (nome, vagas disponíveis)
- ✅ Dados sensíveis de alunos continuam protegidos

## 🚀 Após Publicar

Depois de publicar as regras:
1. Recarregue a página de cadastro
2. Você verá as turmas disponíveis com:
   - Nome da turma
   - Quantidade de alunos matriculados / Total de vagas
   - Status (Aberta, Últimas vagas, Completa, Fechada, Em breve)

## ❓ Dúvidas?

Se após publicar as regras ainda aparecer "Nenhuma turma disponível":
1. Verifique se você tem turmas criadas no Firestore
2. Verifique se as turmas estão com `ativa: true`
3. Verifique se as turmas têm `vagasTotais` configurado
