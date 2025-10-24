import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { AlertTriangle, UserX, Trash2 } from "lucide-react";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otherUserName: string;
  onConfirm: (motivo: string) => void;
  isLoading?: boolean;
}

export function ReportDialog({ open, onOpenChange, otherUserName, onConfirm, isLoading }: ReportDialogProps) {
  const [motivo, setMotivo] = useState("");

  const handleConfirm = () => {
    if (motivo.trim()) {
      onConfirm(motivo.trim());
      setMotivo("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-report-conversation">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Denunciar conversa
          </DialogTitle>
          <DialogDescription>
            Você está prestes a denunciar a conversa com <strong>{otherUserName}</strong>.
            Esta denúncia será enviada ao diretor para análise.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="motivo">
              Motivo da denúncia <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="motivo"
              placeholder="Descreva o motivo da denúncia (obrigatório)..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="min-h-[120px]"
              data-testid="textarea-report-reason"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            ⚠️ Denúncias falsas podem resultar em penalidades.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setMotivo("");
            }}
            disabled={isLoading}
            data-testid="button-cancel-report"
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!motivo.trim() || isLoading}
            data-testid="button-confirm-report"
          >
            {isLoading ? "Enviando..." : "Enviar denúncia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otherUserName: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function BlockDialog({ open, onOpenChange, otherUserName, onConfirm, isLoading }: BlockDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="dialog-block-user">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-destructive" />
            Bloquear usuário
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Você está prestes a bloquear <strong>{otherUserName}</strong>.
              </p>
              <p>
                Após o bloqueio:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Você não poderá enviar mensagens para este usuário</li>
                <li>Este usuário não poderá enviar mensagens para você</li>
                <li>A conversa continuará visível no histórico</li>
              </ul>
              <p className="font-semibold text-foreground">
                Tem certeza que deseja continuar?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading} data-testid="button-cancel-block">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-destructive hover:bg-destructive/90"
            data-testid="button-confirm-block"
          >
            {isLoading ? "Bloqueando..." : "Sim, bloquear"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otherUserName: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function DeleteDialog({ open, onOpenChange, otherUserName, onConfirm, isLoading }: DeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="dialog-delete-conversation">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Excluir conversa
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Você está prestes a excluir a conversa com <strong>{otherUserName}</strong>.
              </p>
              <p>
                Após a exclusão:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Todo o histórico de mensagens será removido da sua visualização</li>
                <li>O outro usuário ainda terá acesso às mensagens</li>
                <li>Esta ação não pode ser desfeita</li>
              </ul>
              <p className="font-semibold text-foreground">
                Tem certeza que deseja excluir esta conversa?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading} data-testid="button-cancel-delete">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-destructive hover:bg-destructive/90"
            data-testid="button-confirm-delete"
          >
            {isLoading ? "Excluindo..." : "Sim, excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
