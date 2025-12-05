import { useEffect, useRef } from "react";
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const remainingTime = Math.max(0, maxAbsenceTime - currentAbsenceTime);
  const progressValue = (remainingTime / maxAbsenceTime) * 100;
  const isUrgent = remainingTime <= 60;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (open) {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio();
          audioRef.current.src = "data:audio/wav;base64,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";
        }
        audioRef.current.volume = 0.4;
        audioRef.current.play().catch(() => {});
      } catch (e) {
        console.log("Could not play alert sound");
      }
    }
  }, [open]);

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
