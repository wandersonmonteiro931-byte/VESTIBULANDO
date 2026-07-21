# Atualização do Cloudflare Pages

Use `ATUALIZAR_GITHUB_E_CLOUDFLARE.bat`, sempre na raiz do projeto, ao lado de `package.json`.

O publicador executa nesta ordem:

1. instala as dependências quando necessário;
2. valida TypeScript, os 30 módulos, os 483 requisitos e a integridade do chat;
3. gera `dist/public` com um identificador exclusivo de publicação;
4. usa o perfil exclusivo `vestibulando-yasmin`, autentica `yasminpereiragabrielly88@gmail.com` e confirma que a conta realmente possui o projeto existente `vestibulando.pages.dev`;
5. publica `dist/public` diretamente na produção do projeto Pages `vestibulando`;
6. aguarda até 90 segundos pela propagação de `deploy-version.json`, repetindo consultas sem cache;
7. atualiza regras e índices do Firestore;
8. salva o mesmo código no GitHub, com suporte a caminhos longos do Windows;
9. consulta a lista de deployments e abre o site com um parâmetro ant-cache.

O publicador não executa nenhum comando do Firebase Storage. Arquivos e backups usam o repositório em blocos do Firestore.

O publicador nunca executa `wrangler pages project create`. Antes de enviar qualquer arquivo, ele lista os projetos, encontra exatamente `vestibulando.pages.dev` e consulta as publicações de produção desse mesmo projeto. O deploy roda sem entrada interativa e com a criação automática desativada. Se qualquer conferência falhar, ele encerra sem criar projeto e sem enviar arquivos. O Cloudflare é publicado antes do Firebase e do GitHub; falhas secundárias aparecem como avisos separados.

O índice composto de `schoolRecords` declara explicitamente a ordenação de `__name__`. Isso evita o erro 400 de algumas versões do Firebase CLI ao comparar um índice cujo último campo usa `arrayConfig: CONTAINS`.

## Como confirmar

Ao final deve aparecer `SITE ATUALIZADO COM SUCESSO`, o identificador publicado e a lista de deployments do Cloudflare. O publicador tenta confirmar o próprio endereço `https://vestibulando.pages.dev/deploy-version.json` por até 90 segundos. Se o deployment de produção já foi aceito, mas o domínio ainda estiver propagando, ele conclui com um aviso claro em vez de informar falsamente que a publicação falhou.

Na primeira execução, o navegador pode abrir para criar apenas o perfil local de autenticação `vestibulando-yasmin`. Entre com `yasminpereiragabrielly88@gmail.com` e autorize a conta que já possui `vestibulando.pages.dev`. Isso não cria projeto no Cloudflare. Um endereço como `vestibulando-2mw.pages.dev` é outro projeto e nunca será aceito pelo publicador.

Confirme que o terminal mostra nove etapas (`[1/9]` até `[9/9]`). Se aparecer `[5/8]` ou a opção **Create a new project**, feche a janela: esse é um `.bat` antigo.

O arquivo `ATUALIZACAO_CLOUDFLARE_LOG.txt` é recriado a cada execução. Se houver erro, envie esse arquivo junto com uma captura da mensagem exibida no terminal.

Se uma aba antiga já estava aberta, pressione `Ctrl + F5` uma vez. O projeto também envia cabeçalhos para impedir cache persistente do HTML, do service worker e do identificador de versão.
