# Correção do login da Diretoria

Esta versão corrige a tela branca ao entrar como diretor no Cloudflare Pages.

## Alterações aplicadas

- Corrigido o loop de renderização do React que gerava o erro `Minified React error #185`.
- Atualizado e fixado `@radix-ui/react-presence` na versão `1.1.7`.
- Estabilizado o controle de abertura do menu lateral da Diretoria.
- Corrigido o redirecionamento entre `/login`, `/aluno`, `/professor` e `/diretor`.
- O login da Diretoria agora recarrega o usuário autenticado diretamente do Firebase antes de abrir o painel.
- A rota protegida não tenta mais navegar repetidamente para o mesmo endereço.
- Mantida a configuração fixa do Firebase e o deploy do Cloudflare Pages em `dist/public`.

## Publicar

Extraia o ZIP e execute, na raiz do projeto:

`ATUALIZAR_GITHUB_E_CLOUDFLARE.bat`

O arquivo executa o build, cria o commit e envia para:

`https://github.com/wandersonmonteiro931-byte/VESTIBULANDO.git`

Se o Cloudflare Pages estiver conectado à branch `main`, o deploy será iniciado automaticamente.
