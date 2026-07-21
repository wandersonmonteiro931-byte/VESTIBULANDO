# Financeiro sem Firebase Storage

Esta versão funciona sem Cloud Storage e não exige ativação do plano Blaze. Comprovantes de até 8 MB usam blocos protegidos no Firestore com hash SHA-256.

Fluxo:
1. O aluno copia o PIX ou abre o link de pagamento.
2. Depois de pagar, clica em **Informar pagamento**.
3. Anexa o comprovante no repositório Firestore, quando necessário.
4. A fatura passa para **Pagamento informado**.
5. A diretoria confere o recebimento e confirma ou recusa.

O chat não foi alterado.
