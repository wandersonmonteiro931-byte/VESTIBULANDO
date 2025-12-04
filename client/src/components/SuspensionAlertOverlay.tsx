import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Shield, Clock, Calendar, Users, FileText, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSuspensionAlert } from "@/contexts/SuspensionAlertContext";
import { auth } from "@/lib/firebase";

export function SuspensionAlertOverlay() {
  const { showAlert, suspensionData, dismissAlert } = useSuspensionAlert();
  const [timeRemaining, setTimeRemaining] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!showAlert || !suspensionData) return;

    const updateCounter = () => {
      const now = new Date();
      const endDate = new Date(suspensionData.dataTerminoSuspensao);
      const diff = endDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Suspensão expirada");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    updateCounter();
    const intervalId = setInterval(updateCounter, 1000);

    return () => clearInterval(intervalId);
  }, [showAlert, suspensionData]);

  const handleClose = async () => {
    setIsLoggingOut(true);
    try {
      if (auth.currentUser) {
        await auth.signOut();
        console.log("🔓 Logout realizado após visualização do alerta de suspensão");
      }
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    } finally {
      dismissAlert();
      setIsLoggingOut(false);
    }
  };

  if (!showAlert || !suspensionData) return null;

  return (
    <div
      className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center p-3"
      style={{ zIndex: 999999 }}
      data-testid="overlay-suspension-alert"
    >
      <Card className="w-full max-w-md border-destructive max-h-[90vh] overflow-auto">
        <CardHeader className="space-y-2 text-center pb-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold text-destructive">
            SUSPENSÃO DISCIPLINAR
          </CardTitle>
          <CardDescription className="text-sm">
            Você recebeu uma suspensão disciplinar. Sua sessão será encerrada.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="p-3 bg-muted rounded-lg text-center">
            <p className="text-xs text-muted-foreground mb-1">Tempo restante da suspensão</p>
            <p className="text-xl font-bold text-destructive font-mono" data-testid="text-suspension-alert-countdown">
              {timeRemaining}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">Duração</p>
                <p className="text-xs text-muted-foreground" data-testid="text-suspension-alert-duration">
                  {suspensionData.duracaoDias} {suspensionData.duracaoDias === 1 ? "dia" : "dias"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">Reativação</p>
                <p className="text-xs text-muted-foreground" data-testid="text-suspension-alert-end">
                  {format(new Date(suspensionData.dataTerminoSuspensao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">Aplicado por</p>
                <p className="text-xs text-muted-foreground" data-testid="text-suspension-alert-applied-by">
                  Diretoria
                </p>
              </div>
            </div>

            {suspensionData.comentario && (
              <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">Motivo</p>
                  <p className="text-xs text-muted-foreground break-words" data-testid="text-suspension-alert-reason">
                    {suspensionData.comentario}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-xs text-destructive">
                Você será desconectado do sistema. Aguarde o término da suspensão para fazer login novamente.
              </p>
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-3">
          <Button
            onClick={handleClose}
            variant="outline"
            className="w-full"
            disabled={isLoggingOut}
            data-testid="button-close-suspension-alert"
          >
            {isLoggingOut ? "Saindo..." : "Entendi"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
