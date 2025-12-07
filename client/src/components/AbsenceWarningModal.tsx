import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Clock } from "lucide-react";

interface AbsenceWarningModalProps {
  open: boolean;
  currentAbsenceTime: number;
  maxAbsenceTime: number;
  onReturn: () => void;
}

export function AbsenceWarningModal({
  open,
  currentAbsenceTime,
  maxAbsenceTime,
  onReturn,
}: AbsenceWarningModalProps) {
  const remainingTime = Math.max(0, maxAbsenceTime - currentAbsenceTime);
  const progressValue = (remainingTime / maxAbsenceTime) * 100;
  const isUrgent = remainingTime <= 60;

  const formatTime = (seconds: number) => {
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
            <div className={`p-3 rounded-full ${isUrgent ? "bg-destructive/10" : "bg-amber-500/10"}`}>
              <AlertTriangle className={`h-6 w-6 ${isUrgent ? "text-destructive animate-pulse" : "text-amber-500"}`} />
            </div>
            <DialogTitle className={`text-xl ${isUrgent ? "text-destructive" : ""}`}>
              Você saiu da aula!
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <DialogDescription className="text-base">
            Detectamos que você saiu da aba ou minimizou a janela. Retorne imediatamente para não receber falta.
          </DialogDescription>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Tempo restante:
              </span>
              <span className={`text-2xl font-bold ${isUrgent ? "text-destructive" : "text-foreground"}`}>
                {formatTime(remainingTime)}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${isUrgent ? "bg-destructive" : "bg-amber-500"}`}
                style={{ width: `${progressValue}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Tempo total de ausência permitido: {formatTime(maxAbsenceTime)}
            </p>
          </div>

          <div className={`rounded-lg p-4 ${isUrgent ? "bg-destructive/10 border border-destructive/30" : "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"}`}>
            <p className={`text-sm ${isUrgent ? "text-destructive" : "text-amber-800 dark:text-amber-200"}`}>
              <strong>Atenção:</strong> Para validar sua presença, você deve permanecer na página da aula até o final. O tempo máximo de ausência é de 5 minutos somados durante toda a aula.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button 
            onClick={onReturn} 
            size="lg"
            className="w-full"
            variant={isUrgent ? "destructive" : "default"}
            data-testid="button-return-to-class"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Voltar para a Aula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
