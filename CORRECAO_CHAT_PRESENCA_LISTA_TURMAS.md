# Correção do chat — presença, lista e turmas

Alterações realizadas somente no módulo de chat, conforme solicitado:

- usuário permanece online enquanto a página estiver aberta, visível e conectada;
- removido o desligamento por falta de movimento do mouse/teclado;
- status online usa heartbeat recente e expira automaticamente se a conexão for encerrada abruptamente;
- ponto de presença online agora é fixo, sem animação piscando;
- lista de Nova Conversa não recarrega quando o próprio documento de presença é atualizado;
- contatos online aparecem com ponto verde na lista de conversas, pesquisa e Nova Conversa;
- turmas repetidas de professores são removidas antes da exibição;
- combinação das conversas foi estabilizada para evitar duplicações e renderizações desnecessárias.
- atualizações de heartbeat não recarregam fotos e dados de perfil da lista.

Nenhum outro módulo do sistema foi alterado nesta correção.
