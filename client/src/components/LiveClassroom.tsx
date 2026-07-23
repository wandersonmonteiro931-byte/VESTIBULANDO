import { useState, useEffect, useCallback, useRef } from "react";
import { useLiveClass } from "@/contexts/LiveClassContext";
import { usePresenceMonitor } from "@/hooks/usePresenceMonitor";
import { PresenceConfirmationModal } from "./PresenceConfirmationModal";
import { AbsenceModal } from "./AbsenceModal";
import { AbsenceWarningModal } from "./AbsenceWarningModal";
import { LeaveRequestModal } from "./LeaveRequestModal";
import { ReturnModal } from "./ReturnModal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  LogOut, 
  Clock, 
  Users, 
  BookOpen, 
  CheckCircle,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";

interface LiveClassroomProps {
  onExit?: () => void;
}

export function LiveClassroom({ onExit }: LiveClassroomProps) {
  const { toast } = useToast();
  const { 
    currentSession, 
    studentPresence, 
    isInClass,
    enterClass,
    markAsAbsent,
    requestLeave,
    updateActivity,
  } = useLiveClass();

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveRequestStatus, setLeaveRequestStatus] = useState<"idle" | "pending" | "approved" | "rejected">("idle");
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [absenceReason, setAbsenceReason] = useState<"ausencia_prolongada" | "inatividade" | "saida_nao_autorizada">("inatividade");
  const [isEntering, setIsEntering] = useState(false);
  const [classParticipants, setClassParticipants] = useState(0);
  const [leaveRequestId, setLeaveRequestId] = useState<string | null>(null);
  const [showClassEndedModal, setShowClassEndedModal] = useState(false);
  const [endedSessionInfo, setEndedSessionInfo] = useState<{materia: string; turmaNome: string; professorNome: string} | null>(null);
  const previousSessionRef = useRef<string | null>(null);
  const wasInClassRef = useRef(false);

  const maxAbsenceTime = currentSession?.tempoMaxAusencia || 300;
  const inactivityTimeout = currentSession?.tempoInatividade || 180;
  const confirmationTimeout = currentSession?.tempoConfirmacao || 120;

  console.log("[LiveClassroom] isInClass:", isInClass, "currentSession:", !!currentSession);

  const handleInactivityDetected = useCallback(() => {
    console.log("Inactivity detected");
  }, []);

  const handleAbsenceDetected = useCallback(() => {
    console.log("Absence detected - tab hidden");
  }, []);

  const handleAbsenceReturn = useCallback(() => {
    console.log("Returned to tab");
    updateActivity();
  }, [updateActivity]);

  const handleConfirmationRequired = useCallback(() => {
    console.log("Confirmation required");
  }, []);

  const handleConfirmationTimeout = useCallback(async () => {
    console.log("Confirmation timeout - marking as absent");
    setAbsenceReason("inatividade");
    await markAsAbsent("inatividade");
    setShowAbsenceModal(true);
  }, [markAsAbsent]);

  const handleMaxAbsenceReached = useCallback(async () => {
    console.log("Max absence reached");
    setAbsenceReason("ausencia_prolongada");
    await markAsAbsent("ausencia_prolongada");
    setShowAbsenceModal(true);
  }, [markAsAbsent]);

  const { 
    state: presenceState, 
    confirmPresence, 
    getCurrentAbsenceTime,
    dismissReturnModal,
  } = usePresenceMonitor({
    inactivityTimeout,
    confirmationTimeout,
    maxAbsenceTime,
    onInactivityDetected: handleInactivityDetected,
    onAbsenceDetected: handleAbsenceDetected,
    onAbsenceReturn: handleAbsenceReturn,
    onConfirmationRequired: handleConfirmationRequired,
    onConfirmationTimeout: handleConfirmationTimeout,
    onMaxAbsenceReached: handleMaxAbsenceReached,
    enabled: isInClass,
  });

  useEffect(() => {
    if (!currentSession) return;

    let unsubscribe: (() => void) | null = null;
    let isMounted = true;

    const setupListener = () => {
      try {
        const participantsRef = collection(db, "presencasAulaAoVivo");
        const q = query(
          participantsRef,
          where("sessaoId", "==", currentSession.id),
          where("status", "==", "na_sala")
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
          if (!isMounted) return;
          setClassParticipants(snapshot.size);
        }, (error: any) => {
          if (error?.message?.includes('INTERNAL ASSERTION FAILED')) {
            console.warn("[LiveClassroom] Firebase SDK bug detectado - recarregue a página se persistir");
            return;
          }
          console.error("[LiveClassroom] Erro ao escutar participantes:", error);
        });
      } catch (error: any) {
        if (!error?.message?.includes('INTERNAL ASSERTION FAILED')) {
          console.error("[LiveClassroom] Falha ao configurar listener:", error);
        }
      }
    };

    setupListener();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [currentSession]);

  useEffect(() => {
    if (isInClass) {
      const interval = setInterval(() => {
        updateActivity();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isInClass, updateActivity]);

  // Salvar informações da sessão e marcar quando está em aula
  useEffect(() => {
    if (currentSession) {
      previousSessionRef.current = currentSession.id;
      setEndedSessionInfo({
        materia: currentSession.materia,
        turmaNome: currentSession.turmaNome,
        professorNome: currentSession.professorNome,
      });
    }
  }, [currentSession]);

  useEffect(() => {
    if (isInClass) {
      wasInClassRef.current = true;
    }
  }, [isInClass]);

  // Detectar quando a aula é encerrada pelo professor
  useEffect(() => {
    if (!currentSession && wasInClassRef.current && previousSessionRef.current) {
      console.log("[LiveClassroom] Aula encerrada pelo professor");
      setShowClassEndedModal(true);
      wasInClassRef.current = false;
      previousSessionRef.current = null;
    }
  }, [currentSession]);

  const handleEnterClass = async () => {
    if (!currentSession) return;
    setIsEntering(true);
    try {
      await enterClass(currentSession.id);
    } catch (error: any) {
      console.error("Error entering class:", error);
      const isFirebaseBug = error?.message?.includes('INTERNAL ASSERTION FAILED');
      toast({
        variant: "destructive",
        title: "Erro ao entrar na aula",
        description: isFirebaseBug 
          ? "Ocorreu um erro temporário. Por favor, recarregue a página e tente novamente."
          : "Não foi possível entrar na aula. Tente novamente.",
      });
    } finally {
      setIsEntering(false);
    }
  };

  const handleLeaveRequest = async (reason: string) => {
    try {
      setLeaveRequestStatus("pending");
      const requestId = await requestLeave(reason);
      console.log("[LiveClassroom] Leave request created:", requestId);
      setLeaveRequestId(requestId);
    } catch (error: any) {
      console.error("Error requesting leave:", error);
      setLeaveRequestStatus("idle");
      toast({
        variant: "destructive",
        title: "Erro ao solicitar saída",
        description: error?.message || "Não foi possível enviar sua solicitação. Tente novamente.",
      });
    }
  };

  useEffect(() => {
    if (!leaveRequestId) return;

    console.log("[LiveClassroom] Setting up listener for leave request:", leaveRequestId);

    const unsubscribe = onSnapshot(
      doc(db, "solicitacoesSaida", leaveRequestId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log("[LiveClassroom] Leave request status update:", data.status);
          
          if (data.status === "aprovada") {
            setLeaveRequestStatus("approved");
            setShowLeaveModal(true);
            setLeaveRequestId(null);
          } else if (data.status === "recusada") {
            setLeaveRequestStatus("rejected");
            setShowLeaveModal(true);
            setLeaveRequestId(null);
          }
        }
      },
      (error) => {
        console.error("[LiveClassroom] Error listening to leave request:", error);
      }
    );

    return () => unsubscribe();
  }, [leaveRequestId]);

  const handleAbsenceModalClose = () => {
    setShowAbsenceModal(false);
    onExit?.();
  };

  const handleLeaveApproved = () => {
    setLeaveRequestStatus("idle");
    setShowLeaveModal(false);
    onExit?.();
  };

  if (!currentSession) {
    return (
      <>
        <Card className="max-w-md mx-auto mt-8 live-empty-card">
          <CardHeader className="premium-empty-state text-center">
            <div className="premium-empty-icon mx-auto">
              <BookOpen className="h-7 w-7" />
            </div>
            <CardTitle className="premium-empty-title text-foreground">Nenhuma Aula em Andamento</CardTitle>
            <CardDescription className="premium-empty-text">
              Não há nenhuma aula ao vivo no momento. Aguarde o professor iniciar a aula.
            </CardDescription>
          </CardHeader>
        </Card>

        <Dialog open={showClassEndedModal} onOpenChange={() => {}}>
          <DialogContent 
            className="sm:max-w-md"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-green-500/10">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <DialogTitle className="text-xl text-green-600 dark:text-green-400">
                  Aula Encerrada
                </DialogTitle>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <DialogDescription className="text-base">
                O professor encerrou a aula. Sua presença foi contabilizada com sucesso!
              </DialogDescription>

              {endedSessionInfo && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Aula:</span>
                    <span className="font-medium">{endedSessionInfo.materia}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Turma:</span>
                    <span className="font-medium">{endedSessionInfo.turmaNome}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Professor:</span>
                    <span className="font-medium">{endedSessionInfo.professorNome}</span>
                  </div>
                </div>
              )}

              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <p className="text-sm text-green-800 dark:text-green-200">
                  Sua presença foi validada automaticamente ao final da aula. Obrigado por participar!
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button 
                onClick={() => {
                  setShowClassEndedModal(false);
                  setEndedSessionInfo(null);
                  onExit?.();
                }}
                size="lg"
                className="w-full"
                data-testid="button-return-home-after-class"
              >
                Voltar à Tela Inicial
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (studentPresence?.status === "liberado") {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader className="text-center">
          <div className="mx-auto p-3 rounded-full bg-green-500/10 w-fit mb-2">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <CardTitle className="text-green-600 dark:text-green-400">Você Foi Liberado</CardTitle>
          <CardDescription>
            Sua saída da aula foi autorizada pelo professor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Aula:</span>
              <span className="font-medium">{currentSession.materia}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Turma:</span>
              <span className="font-medium">{currentSession.turmaNome}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Professor:</span>
              <span className="font-medium">{currentSession.professorNome}</span>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-sm text-green-800 dark:text-green-200">
              Sua presença foi validada com sucesso. Você pode sair da plataforma agora.
            </p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Atenção:</strong> Quando você solicita a saída de uma aula e é liberado pelo professor, você não poderá entrar novamente. Aguarde a próxima aula.
            </p>
          </div>

          <Button 
            onClick={() => onExit?.()}
            variant="outline"
            className="w-full" 
            size="lg"
            data-testid="button-leave-after-released"
          >
            <LogOut className="h-5 w-5 mr-2" />
            Sair da Sala de Aula
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!isInClass) {
    return (
      <Card className="max-w-lg mx-auto mt-8">
        <CardHeader className="text-center">
          <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit mb-2">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Aula em Andamento</CardTitle>
          <CardDescription>
            {currentSession.materia} - {currentSession.turmaNome}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Professor:</span>
              <span className="font-medium">{currentSession.professorNome}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Horário:</span>
              <span className="font-medium">{currentSession.horarioNome}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Alunos na sala:</span>
              <span className="font-medium">{classParticipants}</span>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Atenção:</strong> Ao entrar na aula, você deve permanecer até o final. Sair sem autorização resultará em falta.
            </p>
          </div>

          <Button 
            onClick={handleEnterClass} 
            className="w-full" 
            size="lg"
            disabled={isEntering}
            data-testid="button-enter-class"
          >
            {isEntering ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Entrando...
              </>
            ) : (
              <>
                <Users className="h-5 w-5 mr-2" />
                Entrar na Aula
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-500/10">
                  <BookOpen className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">{currentSession.materia}</CardTitle>
                  <CardDescription>{currentSession.turmaNome} - {currentSession.professorNome}</CardDescription>
                </div>
              </div>
              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Na Aula
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Horário</p>
                <p className="font-medium text-sm">{currentSession.horarioNome}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Alunos</p>
                <p className="font-medium text-sm">{classParticipants}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <CheckCircle className="h-4 w-4 mx-auto mb-1 text-green-500" />
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium text-sm text-green-600 dark:text-green-400">Presente</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                <p className="text-xs text-muted-foreground">Ausência</p>
                <p className="font-medium text-sm">{Math.floor(getCurrentAbsenceTime() / 60)}m / {Math.floor(maxAbsenceTime / 60)}m</p>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Permaneça nesta página durante toda a aula. Se precisar sair, utilize o botão abaixo para solicitar autorização ao professor.
              </p>
            </div>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowLeaveModal(true)}
              data-testid="button-request-leave"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Pedir para Sair
            </Button>
          </CardContent>
        </Card>
      </div>

      <PresenceConfirmationModal
        open={presenceState.isShowingConfirmation}
        countdown={presenceState.confirmationCountdown}
        maxTime={confirmationTimeout}
        onConfirm={confirmPresence}
      />

      <AbsenceWarningModal
        open={!presenceState.isTabVisible && isInClass}
        currentAbsenceTime={getCurrentAbsenceTime()}
        maxAbsenceTime={maxAbsenceTime}
        onReturn={() => {}}
      />

      <AbsenceModal
        open={showAbsenceModal}
        reason={absenceReason}
        className={currentSession.turmaNome}
        materia={currentSession.materia}
        onClose={handleAbsenceModalClose}
      />

      <LeaveRequestModal
        open={showLeaveModal}
        status={leaveRequestStatus}
        onClose={() => {
          if (leaveRequestStatus === "approved") {
            handleLeaveApproved();
          } else {
            setShowLeaveModal(false);
            setLeaveRequestStatus("idle");
          }
        }}
        onSubmit={handleLeaveRequest}
      />

      <ReturnModal
        open={presenceState.showReturnModal}
        absenceDuration={presenceState.lastAbsenceDuration}
        totalAbsenceTime={presenceState.totalAbsenceTime}
        maxAbsenceTime={maxAbsenceTime}
        onDismiss={dismissReturnModal}
      />

      <Dialog open={showClassEndedModal} onOpenChange={() => {}}>
        <DialogContent 
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <DialogTitle className="text-xl text-green-600 dark:text-green-400">
                Aula Encerrada
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <DialogDescription className="text-base">
              O professor encerrou a aula. Sua presença foi contabilizada com sucesso!
            </DialogDescription>

            {endedSessionInfo && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Aula:</span>
                  <span className="font-medium">{endedSessionInfo.materia}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Turma:</span>
                  <span className="font-medium">{endedSessionInfo.turmaNome}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Professor:</span>
                  <span className="font-medium">{endedSessionInfo.professorNome}</span>
                </div>
              </div>
            )}

            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-sm text-green-800 dark:text-green-200">
                Sua presença foi validada automaticamente ao final da aula. Obrigado por participar!
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              onClick={() => {
                setShowClassEndedModal(false);
                setEndedSessionInfo(null);
                onExit?.();
              }}
              size="lg"
              className="w-full"
              data-testid="button-return-home-after-class"
            >
              Voltar à Tela Inicial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
