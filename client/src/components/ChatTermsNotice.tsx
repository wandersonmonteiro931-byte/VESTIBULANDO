import { AlertTriangle } from "lucide-react";

export function ChatTermsNotice() {
  return (
    <div className="mb-6 mx-auto max-w-md">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
          <div className="space-y-3 text-sm">
            <div>
              <h3 className="font-bold text-yellow-900 dark:text-yellow-100 mb-2">
                Aviso Importante
              </h3>
              <p className="text-yellow-800 dark:text-yellow-200 mb-2">
                Antes de iniciar a conversa, leia com atenção:
              </p>
            </div>

            <p className="text-yellow-800 dark:text-yellow-200">
              Este chat é exclusivo para fins educacionais e deve ser utilizado com respeito e responsabilidade.
            </p>

            <p className="text-yellow-800 dark:text-yellow-200">
              <strong>PROIBIDO:</strong> É proibido enviar conteúdos ofensivos, sexuais, discriminatórios, falsos ou que violem os termos da plataforma.
            </p>

            <p className="text-yellow-800 dark:text-yellow-200">
              <strong>MONITORAMENTO:</strong> Mensagens podem ser monitoradas conforme a Lei nº 12.965/2014 (Marco Civil da Internet) e a Lei nº 13.709/2018 (LGPD).
            </p>

            <p className="text-yellow-800 dark:text-yellow-200 font-medium">
              Ao continuar, você concorda com os Termos de Uso da plataforma.
            </p>

            <p className="text-yellow-800 dark:text-yellow-200">
              <strong>IMPORTANTE:</strong> Este canal é apenas para comunicação entre diretoria, professores e alunos.
              O uso indevido desta ferramenta poderá gerar advertências, suspensão de conta e outras medidas cabíveis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
