import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Calendar, Users, FileText, History, Scale } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWarningAlert } from "@/contexts/WarningAlertContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";

export function WarningAlertOverlay() {
  const { showAlert, warningData, dismissAlert } = useWarningAlert();
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  const handleAcknowledge = async () => {
    if (!warningData) return;
    
    setIsAcknowledging(true);
    try {
      await updateDoc(doc(db, "disciplinaryActions", warningData.id), {
        visualizado: true,
        dataVisualizacao: getNowBrasiliaISO(),
      });
      console.log("✅ Advertência marcada como visualizada");
    } catch (error) {
      console.error("Erro ao marcar advertência como visualizada:", error);
    } finally {
      dismissAlert();
      setIsAcknowledging(false);
    }
  };

  if (!showAlert || !warningData) return null;

  return (
    <div
      className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center p-3"
      style={{ zIndex: 999999 }}
      data-testid="overlay-warning-alert"
    >
      <Card className="w-full max-w-md border-amber-500 max-h-[90vh] overflow-auto">
        <CardHeader className="space-y-2 text-center pb-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-amber-600 dark:text-amber-500">
            ADVERTÊNCIA DISCIPLINAR
          </CardTitle>
          <CardDescription className="text-sm">
            Você recebeu uma advertência disciplinar da diretoria.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
            <p className="text-xs text-muted-foreground mb-1">Advertências ativas</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-500" data-testid="text-warning-count">
              {warningData.warningsCount} de 3
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">Data da Advertência</p>
                <p className="text-xs text-muted-foreground" data-testid="text-warning-date">
                  {format(new Date(warningData.dataAplicacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">Aplicado por</p>
                <p className="text-xs text-muted-foreground" data-testid="text-warning-applied-by">
                  Diretoria
                </p>
              </div>
            </div>

            {warningData.comentario && (
              <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">Motivo</p>
                  <p className="text-xs text-muted-foreground break-words" data-testid="text-warning-reason">
                    {warningData.comentario}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex items-start gap-2">
              <History className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Esta advertência ficará <strong>registrada em seu histórico escolar</strong> permanentemente.
              </p>
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Scale className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <strong>Atenção:</strong> Caso continue com as práticas atuais, poderão ser aplicadas novas correções disciplinares, incluindo suspensão temporária do sistema.
              </p>
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-3">
          <Button
            onClick={handleAcknowledge}
            variant="outline"
            className="w-full"
            disabled={isAcknowledging}
            data-testid="button-acknowledge-warning"
          >
            {isAcknowledging ? "Confirmando..." : "Estou ciente"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
