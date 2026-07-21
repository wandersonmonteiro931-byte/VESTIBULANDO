# Segurança, privacidade e operação

## Controles aplicados

- Firebase Authentication para senhas; senhas novas nunca são persistidas no Firestore.
- Senha temporária com 10 ou mais caracteres, maiúscula, minúscula e número, seguida de troca obrigatória.
- MFA/TOTP obrigatório por padrão para direção e administração.
- Token Firebase validado no backend, inclusive revogação.
- Rate limit por IP e rota em login auxiliar, recuperação, matrícula, webhooks e administração.
- Histórico de login/logout com data, navegador, dispositivo, sessão e IP quando a API está ativa.
- Revogação de refresh tokens e desconexão em tempo real.
- Acesso temporário com validade automática.
- Permissões por papel, por módulo, por ação e por vínculo familiar.
- Trilha de auditoria imutável; exclusão lógica com retenção de 90 dias.
- Separação de notas privadas e públicos específicos para dados médicos, pedagógicos, disciplinares e financeiros.
- Listagem pública de `usuarios`, `solicitacoes` e `reprovacoes` negada.
- Correção de inscrição liberada somente após CPF e nascimento, usando token HMAC de 15 minutos.
- Cadastro público limitado, validado no backend, com trava determinística de CPF e matrícula transacional.
- Upload em blocos Firestore restrito a 8 MB e formatos seguros; arquivos executáveis recusados.
- Integridade dos anexos e backups confirmada por SHA-256; Firebase Storage desativado.
- Para proteger a cota gratuita, somente o backup automático completo mais recente permanece no Firestore; exportações manuais podem ser guardadas localmente pela escola.

## Responsabilidades de produção

- Ative HTTPS, proteção DDoS/WAF e alertas do provedor.
- Defina retenção institucional por categoria de dado e base legal com assessoria jurídica/DPO.
- Rotacione segredos e chaves de conta de serviço periodicamente.
- Restrinja administradores no Firebase e habilite logs do Google Cloud.
- Configure App Check para reduzir automação abusiva contra Firebase.
- Valide regras no Firebase Emulator Suite antes de cada publicação.
- Revise usuários, delegações e permissões pelo menos a cada período letivo.
- Faça teste de restauração semanal e simulado completo de continuidade periodicamente.
- Defina canal do encarregado, processo de incidente e prazos legais aplicáveis.

## Dados de crianças e adolescentes

Colete somente o necessário, use linguagem apropriada, mantenha consentimentos separados e vincule o responsável aplicável. Informações de saúde, inclusão, guarda, restrição judicial e disciplina devem ter público mínimo e não devem ser compartilhadas em comunicados gerais.

## Resposta a incidente

1. Preserve logs e evidências sem alterar registros.
2. Revogue sessões e bloqueie a credencial afetada.
3. Isole a integração ou conta comprometida.
4. Registre o incidente no módulo 27, impacto, titulares e medidas.
5. Restaure de backup validado se necessário.
6. Acione direção, DPO e assessoria para avaliar comunicações obrigatórias.

## Verificações antes de cada release

```bash
npm run check
npm run verify:school
npm run build
```

Além da automação, faça teste manual de regras com ao menos um usuário de cada papel e valide os fluxos críticos de matrícula, nota, frequência, financeiro, documento e sessão.
