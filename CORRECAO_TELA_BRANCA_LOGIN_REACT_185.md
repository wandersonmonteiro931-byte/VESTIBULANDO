# Correção da tela branca após login

- Removida a disputa entre redirecionamentos do Login e das rotas protegidas.
- O acesso após autenticação agora faz apenas um redirecionamento completo e controlado.
- Eliminadas chamadas repetidas a history.replaceState que geravam React #185.
- Mantidas as correções de presença online, 30 segundos de inatividade e indicador Digitando.
- Nenhuma função financeira ou visual foi removida.
