# Módulo Financeiro

## Área do aluno
- Consulta de faturas em aberto, vencidas, em análise, pagas e canceladas.
- Resumo de valores em aberto e pagos.
- Exibição da bolsa de estudo ativa e dos descontos aplicados.
- Pagamento por PIX ou link definido pela diretoria.
- Envio de comprovante em PDF, JPG, PNG ou WEBP.
- Histórico financeiro.

## Área da diretoria
- Visão geral de valores a receber, vencidos, recebidos e comprovantes em análise.
- Criação de faturas individuais.
- Aplicação automática de bolsa ativa na criação da fatura.
- Controle financeiro por aluno.
- Confirmação, recusa e cancelamento de cobranças.
- Cadastro e encerramento de bolsas percentuais, de valor fixo ou integrais.
- Configuração do beneficiário, chave PIX, código copia e cola e link de pagamento.

## Firebase
O atualizador publica automaticamente:
- firestore.rules
- firestore.indexes.json
- storage.rules

Na primeira execução, o navegador poderá solicitar login na conta que administra o projeto Firebase plataforma-enem-f3682.

## Observação
A confirmação automática pelo banco não foi incluída porque não foram fornecidas credenciais de um gateway de pagamento. Nesta versão, o aluno paga por PIX/link, envia o comprovante e a diretoria confirma no painel.

## Chat
Nenhum arquivo do módulo de chat foi alterado para criar o Financeiro.
