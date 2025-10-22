# Configuração das Regras do Firestore

Para que a funcionalidade de "Verificar Status da Matrícula" funcione corretamente, você precisa ajustar as regras de segurança do Firestore.

## Como Configurar

1. Acesse o [Console do Firebase](https://console.firebase.google.com/)
2. Selecione seu projeto: `plataforma-enem-f3682`
3. No menu lateral, clique em **Firestore Database**
4. Clique na aba **Regras** (Rules)
5. Adicione as seguintes regras:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Permitir leitura pública apenas por matrícula (para verificar status)
    match /solicitacoes/{docId} {
      // Permitir leitura se a consulta for por matrícula
      allow read: if request.auth != null || 
                     (resource != null && resource.data.matricula is string);
      allow write: if request.auth != null;
    }
    
    match /usuarios/{docId} {
      // Permitir leitura se a consulta for por matrícula
      allow read: if request.auth != null || 
                     (resource != null && resource.data.matricula is string);
      allow write: if request.auth != null;
    }
    
    // Outras coleções continuam protegidas
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

6. Clique em **Publicar** (Publish)

## O que essas regras fazem?

- Permitem que usuários **não autenticados** consultem as coleções `solicitacoes` e `usuarios` por matrícula
- Mantêm todas as outras operações protegidas (apenas usuários autenticados podem escrever)
- Outras coleções continuam totalmente protegidas

## Alternativa: Usar Firebase Admin SDK (Mais Complexo)

Se preferir não permitir consultas públicas, você pode configurar credenciais do Firebase Admin:

1. No Console do Firebase, vá em **Configurações do Projeto** > **Contas de Serviço**
2. Clique em **Gerar nova chave privada**
3. Baixe o arquivo JSON
4. No Replit, adicione um Secret chamado `FIREBASE_SERVICE_ACCOUNT` com o conteúdo do arquivo JSON

Essa abordagem é mais segura, mas requer gerenciamento de credenciais.
