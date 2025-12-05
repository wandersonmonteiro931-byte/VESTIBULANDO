import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LogOut, Loader2, Clock, CheckCircle, XCircle } from "lucide-react";

interface LeaveRequestModalProps {
  open: boolean;
  status: "idle" | "pending" | "approved" | "rejected";
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}

export function LeaveRequestModal({
  open,
  status,
  onClose,
  onSubmit,
}: LeaveRequestModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(reason);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (status !== "pending") {
      setReason("");
      onClose();
    }
  };

  if (status === "pending") {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent 
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-amber-500/10">
                <Clock className="h-6 w-6 text-amber-500 animate-pulse" />
              </div>
              <DialogTitle className="text-xl">
                Aguardando Autorização
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <DialogDescription className="text-base">
              Sua solicitação para sair da aula foi enviada ao professor. Por favor, aguarde a resposta.
            </DialogDescription>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Importante:</strong> Permaneça na aula enquanto aguarda. Sair sem autorização resultará em falta automática.
              </p>
            </div>

            <div className="flex justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (status === "approved") {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <DialogTitle className="text-xl text-green-600 dark:text-green-400">
                Saída Autorizada
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <DialogDescription className="text-base">
              O professor autorizou sua saída. Sua presença foi validada com sucesso.
            </DialogDescription>

            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-800 dark:text-green-200">
                Você pode sair da aula agora. Até a próxima aula!
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              onClick={handleClose}
              size="lg"
              className="w-full"
              data-testid="button-close-approved-leave"
            >
              Sair da Aula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (status === "rejected") {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-destructive/10">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <DialogTitle className="text-xl text-destructive">
                Saída Não Autorizada
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <DialogDescription className="text-base">
              O professor não autorizou sua saída. Você deve permanecer na aula.
            </DialogDescription>

            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <p className="text-sm text-destructive">
                <strong>Atenção:</strong> Se você sair da aula sem autorização, será registrada falta automática.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              onClick={handleClose}
              size="lg"
              className="w-full"
              data-testid="button-close-rejected-leave"
            >
              Entendi, vou permanecer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-primary/10">
              <LogOut className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">
              Pedir para Sair
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <DialogDescription className="text-base">
            Você pode solicitar autorização para sair da aula. O professor será notificado e poderá aprovar ou negar sua solicitação.
          </DialogDescription>

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Textarea
              id="reason"
              placeholder="Informe o motivo da sua solicitação..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              data-testid="input-leave-reason"
            />
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Lembre-se:</strong> Aguarde a resposta do professor antes de sair. Saídas não autorizadas resultam em falta.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isSubmitting}
            data-testid="button-cancel-leave-request"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            data-testid="button-submit-leave-request"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar Solicitação"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
