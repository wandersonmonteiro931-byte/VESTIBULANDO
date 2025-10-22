# Instruções para Configurar o Sistema

## 1. Fazer Deploy das Novas Regras do Firestore

As regras de segurança foram atualizadas para suportar o contador sequencial de matrículas. Execute:

```bash
firebase deploy --only firestore:rules
```

## 2. Inicializar o Contador de Matrículas

Acesse o Firebase Console e crie o documento do contador:

1. Acesse: https://console.firebase.google.com
2. Selecione seu projeto
3. Vá em **Firestore Database**
4. Crie a coleção `system` (se não existir)
5. Crie um documento com ID: `matriculaCounter`
6. Adicione os campos:

```
ultimaMatricula: 9317 (número)
ultimaAtualizacao: (timestamp atual)
```

**Por que 9317?** Porque o próximo número será 9318, que é a matrícula do administrador.

## 3. Criar a Conta de Administrador

A conta de autenticação foi criada parcialmente. Complete o processo:

### Passo A: Verificar/Criar no Firebase Authentication

1. Acesse **Authentication** no Firebase Console
2. Verifique se existe o usuário: `admin@enemplus.com`
   - **UID**: `x3181ai4FBbvnNUclnSusPSM1hJ2`
   - Se não existir, crie manualmente:
     - Email: `admin@enemplus.com`
     - Senha: `123456`

### Passo B: Criar Documento no Firestore

1. Vá em **Firestore Database**
2. Acesse a coleção `usuarios`
3. Crie um novo documento com ID: `x3181ai4FBbvnNUclnSusPSM1hJ2`
4. Adicione os campos:

| Campo | Tipo | Valor |
|-------|------|-------|
| uid | string | x3181ai4FBbvnNUclnSusPSM1hJ2 |
| nome | string | Administrador |
| email | string | admin@enemplus.com |
| tipo | string | admin |
| cpf | string | 709.731.041-39 |
| matricula | string | 9318 |
| ativo | boolean | true |
| status | string | aprovado |
| dataCriacao | timestamp | (timestamp atual) |

## 4. Fazer Login

Após completar os passos acima, você pode fazer login usando:
- **CPF**: `709.731.041-39` ou **Matrícula**: `9318`
- **Senha**: `123456`

## Sistema de Matrículas Sequenciais

O sistema agora gera matrículas sequenciais automaticamente:

- **Início**: 0100
- **Administrador**: 9318 (configurado manualmente)
- **Próximos alunos**: 9319, 9320, 9321...

### Como Funciona

1. A função `generateUniqueMatricula` usa uma transação atômica do Firestore
2. Lê o documento `system/matriculaCounter`
3. Incrementa `ultimaMatricula` por 1
4. Garante que não haverá duplicações mesmo em registros simultâneos
5. Formata sempre com 4 dígitos (ex: 0100, 0101, 9318, 9319)

### Verificação

Para verificar se o sistema está funcionando:
1. Faça um cadastro de teste
2. Verifique no Firestore se a matrícula gerada foi 9319
3. Verifique se o contador foi atualizado para 9319

---

## Notas Importantes

### Segurança
- **ALTERE A SENHA** `123456` após o primeiro login
- As regras do Firestore foram atualizadas para permitir acesso ao contador apenas durante o registro
- Somente administradores podem criar contas de professores

### Ordem das Matrículas
- O contador começa em 100 (matrícula 0100)
- A matrícula 9318 foi configurada manualmente para o admin
- As próximas matrículas serão: 9319, 9320, 9321...
- Nunca haverá duplicação graças ao uso de transações atômicas

### Troubleshooting

**Erro: "Permission Denied" ao registrar**
- Verifique se fez deploy das regras do Firestore
- Confirme que o documento `system/matriculaCounter` foi criado

**Matrícula não incrementa**
- Verifique o documento `system/matriculaCounter` no Firestore
- O campo `ultimaMatricula` deve ser do tipo `number`

**Não consigo fazer login como admin**
- Verifique se o documento foi criado na coleção `usuarios`
- Confirme que o UID do documento corresponde ao UID do Authentication
- Verifique se `status` está como `aprovado` e `ativo` está como `true`

---

## Considerações de Segurança para Produção

### Limitação Atual
O sistema atual permite que o contador de matrículas seja incrementado por clientes não autenticados durante o processo de registro. Embora as regras do Firestore garantam que:
- Apenas incrementos de +1 são permitidos (sem pulos ou decrementos)
- O documento deve conter campos obrigatórios (ultimaMatricula e ultimaAtualizacao)
- Admins podem fazer manutenção

Ainda existe um risco teórico de spam onde um atacante poderia fazer múltiplas solicitações de registro para consumir números de matrícula.

### Recomendações para Produção

**Opção 1: Firebase Cloud Functions (Recomendada)**
Mover a geração de matrículas para uma Cloud Function que:
- Executa no servidor com privilégios administrativos
- Valida rate limiting por IP
- Registra todas as emissões de matrículas

**Opção 2: Monitoramento e Alertas**
Se mantiver a implementação atual:
- Configure alertas no Firebase para detectar picos anormais de registros
- Monitore o documento `system/matriculaCounter` para incrementos suspeitos
- Implemente rate limiting no nível de aplicação

**Opção 3: Autenticação Prévia**
Requerer autenticação antes de gerar matrícula:
- Usuários criam conta primeiro
- Matrícula é gerada após autenticação
- Elimina o risco de spam não autenticado

### Monitoramento Recomendado

Configure os seguintes alertas no Firebase:
1. Mais de 10 registros por minuto
2. Saltos no contador superiores a 100 em uma hora
3. Tentativas de escrita com valores não sequenciais

### Para Ambiente de Desenvolvimento
A implementação atual é adequada para:
- Testes e desenvolvimento
- Ambientes controlados
- Baixo volume de usuários
- Quando você tem monitoramento ativo
