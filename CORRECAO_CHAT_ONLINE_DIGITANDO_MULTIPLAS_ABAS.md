# Correção do chat: online e digitando

Correções aplicadas apenas ao chat/presença:

- Online imediatamente após login.
- Offline após 30 segundos sem atividade.
- Atividade sincronizada entre várias abas do mesmo navegador.
- Uma aba inativa não derruba outra aba ativa.
- Antes de marcar offline, o sistema verifica se outra aba, navegador ou dispositivo registrou atividade recente.
- Visto por último não mostra horário futuro por diferença de relógio.
- Digitando usa o horário da última tecla, evitando que outra aba esconda o indicador.
- Indicador de digitando também foi corrigido na lista de conversas.
- Sem polling contínuo; usa eventos, snapshots e timeouts.

Build do Cloudflare Pages validado com sucesso.
