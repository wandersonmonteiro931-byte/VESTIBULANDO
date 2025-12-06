# Firebase Setup Guide

## Configuração Inicial

### 1. Criar Projeto Firebase
1. Acesse o [Console do Firebase](https://console.firebase.google.com/)
2. Clique em "Adicionar projeto"
3. Siga o assistente para criar o projeto

### 2. Habilitar Autenticação
1. No Console do Firebase, vá em **Authentication**
2. Clique em "Começar"
3. Habilite o método **Email/Senha**

### 3. Criar Banco de Dados Firestore
1. Vá em **Firestore Database**
2. Clique em "Criar banco de dados"
3. Selecione **Modo de produção**
4. Escolha a localização mais próxima dos seus usuários

### 4. Habilitar Storage
1. Vá em **Storage**
2. Clique em "Começar"
3. Use a mesma localização do Firestore

### 5. Configurar App Web
1. Vá em **Configurações do Projeto** (ícone de engrenagem)
2. Role até "Seus apps"
3. Clique no ícone web (</>)
4. Registre o app
5. Copie as credenciais e adicione como Secrets no Replit:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`

## Implantar Regras de Segurança

### Regras do Firestore

As regras do Firestore estão definidas no arquivo `firestore.rules` na raiz do projeto.

Para implantar:
```bash
firebase deploy --only firestore:rules
```

### Regras do Storage

As regras do Storage estão definidas no arquivo `storage.rules` na raiz do projeto.

Para implantar:
```bash
firebase deploy --only storage:rules
```

### Implantar Ambas
```bash
firebase deploy --only firestore:rules,storage:rules
```

## Criar Primeiro Usuário Admin

1. **Registre-se como aluno** através da interface
2. **No Console do Firebase > Firestore Database**:
   - Navegue até a coleção `usuarios`
   - Encontre seu documento de usuário
   - Altere o campo `tipo` de `"aluno"` para `"diretor"`
   - Certifique-se de que `ativo` é `true`
3. **Faça logout e login novamente**

## Solução de Problemas

### Erro de Permissão
- Verifique se as regras foram implantadas
- Confirme os campos `tipo` e `ativo` do usuário no Firestore

### Erro de CORS no Storage
- Certifique-se de que as regras do Storage estão implantadas
- Verifique se o Storage está habilitado no Firebase Console

### Usuário Não Consegue Fazer Login
- Verifique se o domínio está autorizado em Authentication > Settings > Authorized domains

## Arquivos de Regras

- **firestore.rules** - Regras de segurança do Firestore (ÚNICO local para editar)
- **storage.rules** - Regras de segurança do Storage
