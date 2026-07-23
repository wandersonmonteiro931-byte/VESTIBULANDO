# Segurança e privacidade

## Controles implementados

- contas separadas para aluno, professor e diretoria;
- criação pública restrita ao perfil de aluno;
- campos de perfil privilegiado protegidos pelas regras do Firestore;
- bloqueio e reativação de usuários pela diretoria;
- acesso por proprietário para planos, respostas, simulados e redações;
- moderação de fórum, comunicados, chamados e conteúdos;
- trilha de auditoria para operações do Preparatório EAD;
- histórico de acessos e registro de erros do sistema;
- exportação dos dados do aluno e fluxos de atendimento LGPD;
- anexos validados por tipo e tamanho;
- Firebase Storage desativado por padrão.

## Arquivos e anexos

Este projeto não depende de Firebase Storage. Imagens são comprimidas antes do
envio e anexos pequenos podem ser registrados no Firestore, com limite de
600 KB. Materiais grandes, PDFs e vídeos devem usar links externos.

Nunca cadastre dados de cartão. O módulo financeiro registra a referência da
forma de pagamento; uma cobrança real por Pix, boleto ou cartão exige a
integração posterior de um provedor de pagamentos com credenciais mantidas no
servidor.

## Regras de acesso

As regras vigentes estão em `firestore.rules` e os índices em
`firestore.indexes.json`. O publicador interrompe o processo caso a implantação
das regras falhe, evitando publicar uma interface incompatível com a segurança
do banco.

## Checklist operacional

- [ ] Authentication por e-mail/senha habilitado
- [ ] `vestibulando.pages.dev` autorizado no Firebase
- [ ] regras e índices do Firestore publicados
- [ ] usuários de diretoria e professor revisados
- [ ] contas inativas testadas
- [ ] termos de uso e política de privacidade revisados pela instituição
- [ ] rotina de exportação/backup executada periodicamente
- [ ] alertas e registros de erro acompanhados pela diretoria
- [ ] provedor financeiro homologado antes de aceitar pagamentos reais

## Resposta a incidentes

1. suspenda a conta afetada;
2. preserve os registros de auditoria;
3. corrija e publique as regras, se necessário;
4. revise documentos e operações relacionados;
5. registre o atendimento e as medidas tomadas.
