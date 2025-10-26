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

interface ReportConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  userName: string;
  isLoading?: boolean;
}

export function ReportConversationDialog({
  open,
  onOpenChange,
  onConfirm,
  userName,
  isLoading = false,
}: ReportConversationDialogProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason.trim());
      setReason("");
    }
  };

  const handleCancel = () => {
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Denunciar conversa com {userName}</DialogTitle>
          <DialogDescription>
            Ao denunciar esta conversa, uma cópia de todas as mensagens será 
            enviada para análise da diretoria. Por favor, justifique sua denúncia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-reason">Motivo da denúncia *</Label>
            <Textarea
              id="report-reason"
              placeholder="Descreva o motivo da denúncia..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[120px]"
              data-testid="textarea-report-reason"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            data-testid="button-cancel-report"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!reason.trim() || isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-report"
          >
            {isLoading ? "Enviando..." : "Denunciar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
