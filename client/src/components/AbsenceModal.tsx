import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { XCircle, AlertTriangle, Info } from "lucide-react";

interface AbsenceModalProps {
  open: boolean;
  reason: "ausencia_prolongada" | "inatividade" | "saida_nao_autorizada";
  className?: string;
  materia?: string;
  onClose: () => void;
}

export function AbsenceModal({
  open,
  reason,
  className,
  materia,
  onClose,
}: AbsenceModalProps) {
  const getReasonTitle = () => {
    switch (reason) {
      case "ausencia_prolongada":
        return "Você foi removido por ausência prolongada";
      case "inatividade":
        return "Você foi removido por inatividade";
      case "saida_nao_autorizada":
        return "Você foi removido por saída não autorizada";
      default:
        return "Você foi removido da aula";
    }
  };

  const getReasonDescription = () => {
    switch (reason) {
      case "ausencia_prolongada":
        return "Você ficou ausente da aula por mais de 5 minutos no total. O limite máximo de ausência foi excedido.";
      case "inatividade":
        return "Você não confirmou sua presença quando solicitado pelo sistema. A confirmação de presença é obrigatória durante a aula.";
      case "saida_nao_autorizada":
        return "Você saiu da aula sem autorização do professor. Para sair da aula, é necessário solicitar permissão através do botão 'Pedir para sair'.";
      default:
        return "Você foi removido da aula.";
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-destructive/10">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <DialogTitle className="text-xl text-destructive">
              {getReasonTitle()}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <DialogDescription className="text-base">
            {getReasonDescription()}
          </DialogDescription>

          {className && materia && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Aula:</strong> {materia} - {className}
              </p>
            </div>
          )}

          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-destructive">Falta Registrada</p>
                <p className="text-sm text-destructive/80">
                  Esta ocorrência foi registrada como falta nesta aula.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="font-semibold text-blue-800 dark:text-blue-200">
                  Aguarde a próxima aula
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Você deverá aguardar a próxima aula para participar novamente. 
                </p>
                <ul className="text-sm text-blue-700 dark:text-blue-300 list-disc list-inside space-y-1 mt-2">
                  <li>Sempre confirme sua presença quando o sistema solicitar</li>
                  <li>Durante a aula, você não pode sair sem autorização do professor</li>
                  <li>Se precisar sair, utilize o botão "Pedir para sair"</li>
                  <li>Saídas não autorizadas resultam em falta automática</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            onClick={onClose}
            variant="destructive"
            size="lg"
            className="w-full"
            data-testid="button-close-absence-modal"
          >
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
