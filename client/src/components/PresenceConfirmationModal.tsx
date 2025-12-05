import { useState, useEffect } from "react";
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
import { Progress } from "@/components/ui/progress";

interface PresenceConfirmationModalProps {
  open: boolean;
  countdown: number;
  maxTime: number;
  onConfirm: () => void;
}

export function PresenceConfirmationModal({
  open,
  countdown,
  maxTime,
  onConfirm,
}: PresenceConfirmationModalProps) {
  const progressValue = (countdown / maxTime) * 100;
  const isUrgent = countdown <= 30;

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
              <AlertTriangle className={`h-6 w-6 ${isUrgent ? "text-destructive" : "text-amber-500"}`} />
            </div>
            <DialogTitle className="text-xl">
              Você ainda está aí?
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <DialogDescription className="text-base">
            Detectamos que você está inativo há algum tempo. Por favor, confirme sua presença para continuar na aula.
          </DialogDescription>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Tempo restante para confirmar:
              </span>
              <span className={`text-2xl font-bold ${isUrgent ? "text-destructive" : "text-foreground"}`}>
                {formatTime(countdown)}
              </span>
            </div>
            <Progress 
              value={progressValue} 
              className={`h-2 ${isUrgent ? "[&>div]:bg-destructive" : "[&>div]:bg-amber-500"}`}
            />
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Atenção:</strong> Se você não confirmar sua presença em tempo, será removido da aula e receberá falta automática.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button 
            onClick={onConfirm} 
            size="lg"
            className="w-full"
            data-testid="button-confirm-presence"
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            Confirmar Presença
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
