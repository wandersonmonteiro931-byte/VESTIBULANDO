import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, CheckCircle } from "lucide-react";

interface ReturnModalProps {
  open: boolean;
  absenceDuration: number;
  totalAbsenceTime: number;
  maxAbsenceTime: number;
  onDismiss: () => void;
}

export function ReturnModal({
  open,
  absenceDuration,
  totalAbsenceTime,
  maxAbsenceTime,
  onDismiss,
}: ReturnModalProps) {
  const remainingAllowedAbsence = Math.max(0, maxAbsenceTime - totalAbsenceTime);
  const isWarning = remainingAllowedAbsence < 120;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) {
      return `${secs} segundo${secs !== 1 ? "s" : ""}`;
    }
    return `${mins} minuto${mins !== 1 ? "s" : ""} e ${secs} segundo${secs !== 1 ? "s" : ""}`;
  };

  const formatTimeShort = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full ${isWarning ? "bg-amber-500/10" : "bg-primary/10"}`}>
              {isWarning ? (
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              ) : (
                <CheckCircle className="h-6 w-6 text-primary" />
              )}
            </div>
            <DialogTitle className="text-xl">
              Voce voltou para a aula
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <DialogDescription className="text-base">
            Detectamos que voce saiu da aba por <strong>{formatTime(absenceDuration)}</strong>. 
            Esse tempo foi contabilizado como ausencia.
          </DialogDescription>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Ausencia desta vez:
              </span>
              <span className="font-semibold">
                {formatTimeShort(absenceDuration)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Total acumulado:
              </span>
              <span className="font-semibold">
                {formatTimeShort(totalAbsenceTime)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Tempo restante permitido:
              </span>
              <span className={`font-bold ${isWarning ? "text-amber-500" : ""}`}>
                {formatTimeShort(remainingAllowedAbsence)}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${
                  isWarning ? "bg-amber-500" : "bg-primary"
                }`}
                style={{ width: `${Math.min(100, (totalAbsenceTime / maxAbsenceTime) * 100)}%` }}
              />
            </div>
          </div>

          <div className={`rounded-lg p-4 ${
            isWarning 
              ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" 
              : "bg-muted/50 border border-border"
          }`}>
            <p className={`text-sm ${isWarning ? "text-amber-800 dark:text-amber-200" : "text-muted-foreground"}`}>
              {isWarning ? (
                <>
                  <strong>Cuidado!</strong> Voce esta com pouco tempo de ausencia restante. 
                  Se precisar sair novamente, peca permissao ao professor para evitar receber falta.
                </>
              ) : (
                <>
                  Lembre-se: voce pode se ausentar por no maximo {formatTimeShort(maxAbsenceTime)} durante toda a aula. 
                  Se precisar sair, peca permissao ao professor.
                </>
              )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button 
            onClick={onDismiss} 
            size="lg"
            className="w-full"
            data-testid="button-dismiss-return-modal"
          >
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
