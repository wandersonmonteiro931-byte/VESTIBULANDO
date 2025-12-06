import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { XCircle, AlertTriangle, ShieldAlert, Scale } from "lucide-react";

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
        return "Removido por Ausência Injustificada";
      case "inatividade":
        return "Removido por Inatividade";
      case "saida_nao_autorizada":
        return "Removido por Saída Não Autorizada";
      default:
        return "Você foi removido da aula";
    }
  };

  const getReasonDescription = () => {
    switch (reason) {
      case "ausencia_prolongada":
        return "Você permaneceu fora da sala de aula por mais de 5 minutos no total. Seu tempo de ausência excedeu o limite máximo permitido.";
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
                  Você foi marcado com <strong>FALTA</strong> nesta aula por ausência injustificada. Esta ocorrência ficará registrada no seu histórico acadêmico.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-amber-100 dark:bg-amber-950/50 border border-amber-400 dark:border-amber-700 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-700 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="font-bold text-amber-800 dark:text-amber-200">
                  Aviso de Ações Disciplinares
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Se esse comportamento continuar se repetindo, você poderá sofrer <strong>ações disciplinares pela diretoria</strong>, incluindo advertências formais e até o <strong>banimento permanente do sistema</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Scale className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="font-bold text-primary">
                  Projeto Vestibulando
                </p>
                <p className="text-sm text-foreground/80">
                  O Projeto Vestibulando é levado <strong>muito a sério</strong>. Nosso compromisso é preparar você para o vestibular com disciplina e dedicação. A sua presença e participação ativa nas aulas são fundamentais para o seu sucesso.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted-foreground font-medium">
              Para evitar futuras ocorrências:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Permaneça na aba da aula durante toda a sessão</li>
              <li>Sempre confirme sua presença quando o sistema solicitar</li>
              <li>Se precisar sair, utilize o botão "Pedir para sair" e aguarde autorização</li>
              <li>Evite alternar entre abas ou minimizar o navegador</li>
            </ul>
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
