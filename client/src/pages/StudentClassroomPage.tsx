import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveClass } from "@/contexts/LiveClassContext";
import { db } from "@/lib/firebase";
import { 
  collection, 
  doc, 
  onSnapshot, 
  query,
  where,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  ArrowLeft,
  Loader2,
  CheckCircle,
  LogOut,
  BookOpen,
  Clock,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { PresenceConfirmationModal } from "@/components/PresenceConfirmationModal";
import { AbsenceModal } from "@/components/AbsenceModal";
import { AbsenceWarningModal } from "@/components/AbsenceWarningModal";
import { LeaveRequestModal } from "@/components/LeaveRequestModal";
import { ReturnModal } from "@/components/ReturnModal";
import { usePresenceMonitor } from "@/hooks/usePresenceMonitor";
import type { SessaoAulaAoVivo, User } from "@shared/schema";

export default function StudentClassroomPage() {
  const [, setLocation] = useLocation();
  
  const authContext = useAuth();
  const userData: User | null = (authContext && typeof authContext === 'object' && authContext !== null && 'userData' in authContext) 
    ? (authContext.userData as User | null) 
    : null;
  
  const { 
    currentSession, 
    studentPresence, 
    isInClass,
    enterClass,
    markAsAbsent,
    requestLeave,
    updateActivity,
  } = useLiveClass();
  
  const { toast } = useToast();

  const [session, setSession] = useState<SessaoAulaAoVivo | null>(null);
  const [classParticipants, setClassParticipants] = useState(0);
  const [isEntering, setIsEntering] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveRequestStatus, setLeaveRequestStatus] = useState<"idle" | "pending" | "approved" | "rejected">("idle");
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [absenceReason, setAbsenceReason] = useState<"ausencia_prolongada" | "inatividade" | "saida_nao_autorizada">("inatividade");
  const [leaveRequestId, setLeaveRequestId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const maxAbsenceTime = currentSession?.tempoMaxAusencia || 300;
  const inactivityTimeout = currentSession?.tempoInatividade || 180;
  const confirmationTimeout = currentSession?.tempoConfirmacao || 120;
  const maxDurationMinutes = session?.duracaoMaximaMinutos || currentSession?.duracaoMaximaMinutos || 50;
  const maxDurationSeconds = maxDurationMinutes * 60;
  const remainingSeconds = Math.max(0, maxDurationSeconds - elapsedSeconds);
  const progressPercentage = Math.min(100, (elapsedSeconds / maxDurationSeconds) * 100);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  console.log("[StudentClassroomPage] isInClass:", isInClass, "currentSession:", !!currentSession);

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
        const sessionRef = doc(db, "sessoesAulaAoVivo", currentSession.id);
        unsubscribe = onSnapshot(sessionRef, (snapshot) => {
          if (!isMounted) return;
          if (snapshot.exists()) {
            const sessionData = { id: snapshot.id, ...snapshot.data() } as SessaoAulaAoVivo;
            setSession(sessionData);
          }
        }, (error: any) => {
          if (error?.message?.includes('INTERNAL ASSERTION FAILED')) {
            console.warn("[StudentClassroomPage] Firebase SDK bug detectado - recarregue a página se persistir");
            return;
          }
          console.error("[StudentClassroomPage] Erro ao escutar sessão:", error);
        });
      } catch (error: any) {
        if (!error?.message?.includes('INTERNAL ASSERTION FAILED')) {
          console.error("[StudentClassroomPage] Falha ao configurar listener de sessão:", error);
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
            console.warn("[StudentClassroomPage] Firebase SDK bug detectado - recarregue a página se persistir");
            return;
          }
          console.error("[StudentClassroomPage] Erro ao escutar participantes:", error);
        });
      } catch (error: any) {
        if (!error?.message?.includes('INTERNAL ASSERTION FAILED')) {
          console.error("[StudentClassroomPage] Falha ao configurar listener de participantes:", error);
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
    const sessionToUse = session || currentSession;
    if (!sessionToUse?.dataInicio) return;
    const sessionStart = sessionToUse.dataInicio;

    const calculateElapsed = () => {
      try {
        const startStr = sessionStart;
        let startTime: number;

        if (startStr.includes("/") && startStr.includes(":")) {
          // Format from formatBrasiliaTime: "DD/MM/YYYY, HH:mm:ss"
          const [datePart, timePart] = startStr.split(", ");
          const [day, month, year] = datePart.split("/").map(Number);
          const [hours, minutes, seconds] = timePart.split(":").map(Number);
          startTime = new Date(year, month - 1, day, hours, minutes, seconds).getTime();
        } else {
          startTime = new Date(startStr).getTime();
        }

        if (isNaN(startTime)) {
          console.error("[StudentClassroomPage] Invalid dataInicio:", startStr);
          return;
        }

        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedSeconds(Math.max(0, elapsed));
      } catch (error) {
        console.error("[StudentClassroomPage] Error calculating elapsed time:", error);
      }
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);

    return () => clearInterval(interval);
  }, [session?.dataInicio, currentSession?.dataInicio]);

  useEffect(() => {
    if (isInClass) {
      const interval = setInterval(() => {
        updateActivity();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isInClass, updateActivity]);

  const handleEnterClass = async () => {
    if (!currentSession) return;
    setIsEntering(true);
    try {
      await enterClass(currentSession.id);
      toast({
        title: "Voce entrou na aula",
        description: "Permaneca nesta pagina durante toda a aula.",
      });
    } catch (error) {
      console.error("Error entering class:", error);
      toast({
        title: "Erro",
        description: "Nao foi possivel entrar na aula.",
        variant: "destructive",
      });
    } finally {
      setIsEntering(false);
    }
  };

  const handleOpenTeams = () => {
    const teamsLink = session?.teamsLink || currentSession?.teamsLink;
    if (teamsLink) {
      window.open(teamsLink, '_blank');
    }
  };

  const handleLeaveRequest = async (reason: string) => {
    try {
      setLeaveRequestStatus("pending");
      const requestId = await requestLeave(reason);
      console.log("[StudentClassroomPage] Leave request created:", requestId);
      setLeaveRequestId(requestId);
    } catch (error) {
      console.error("Error requesting leave:", error);
      setLeaveRequestStatus("idle");
    }
  };

  useEffect(() => {
    if (!leaveRequestId) return;

    console.log("[StudentClassroomPage] Setting up listener for leave request:", leaveRequestId);

    const unsubscribe = onSnapshot(
      doc(db, "solicitacoesSaida", leaveRequestId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log("[StudentClassroomPage] Leave request status update:", data.status);
          
          if (data.status === "aprovada") {
            setLeaveRequestStatus("approved");
            setLeaveRequestId(null);
          } else if (data.status === "recusada") {
            setLeaveRequestStatus("rejected");
            setLeaveRequestId(null);
          }
        }
      },
      (error) => {
        console.error("[StudentClassroomPage] Error listening to leave request:", error);
      }
    );

    return () => unsubscribe();
  }, [leaveRequestId]);

  const handleAbsenceModalClose = () => {
    setShowAbsenceModal(false);
    setLocation("/aluno");
  };

  const handleLeaveApproved = () => {
    setLeaveRequestStatus("idle");
    setShowLeaveModal(false);
    setLocation("/aluno");
  };

  if (!currentSession) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-3 flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setLocation("/aluno")}
              data-testid="button-back-to-dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Sala de Aula</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto p-3 rounded-full bg-muted w-fit mb-2">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <CardTitle>Nenhuma Aula em Andamento</CardTitle>
              <CardDescription>
                Nao ha nenhuma aula ao vivo no momento. Aguarde o professor iniciar a aula.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  if (!isInClass) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-3 flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setLocation("/aluno")}
              data-testid="button-back-to-dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Sala de Aula</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">
          <Card className="max-w-lg mx-auto">
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
                  <span className="text-sm text-muted-foreground">Horario:</span>
                  <span className="font-medium">{currentSession.horarioNome}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Alunos na sala:</span>
                  <span className="font-medium">{classParticipants}</span>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Atencao:</strong> Ao entrar na aula, voce deve permanecer ate o final. Sair sem autorizacao resultara em falta.
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
        </main>
      </div>
    );
  }

  const teamsLink = session?.teamsLink || currentSession?.teamsLink;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-4 py-3 gap-2 flex-wrap">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-semibold">{currentSession.materia}</h1>
              <p className="text-sm text-muted-foreground">{currentSession.turmaNome} - {currentSession.professorNome}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {classParticipants}
            </Badge>
            <Badge className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Na Aula
            </Badge>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 lg:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Tempo de Aula
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold" data-testid="text-elapsed-time">
                    {formatTime(elapsedSeconds)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tempo decorrido
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-semibold ${remainingSeconds <= 300 ? 'text-amber-500' : ''}`} data-testid="text-remaining-time">
                    {formatTime(remainingSeconds)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tempo restante
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Progress 
                  value={progressPercentage} 
                  className={`h-3 ${progressPercentage > 90 ? '[&>div]:bg-amber-500' : ''}`}
                />
                <p className="text-xs text-muted-foreground text-center">
                  Duracao da aula: {maxDurationMinutes} minutos
                </p>
              </div>
            </CardContent>
          </Card>

          {teamsLink && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Reuniao do Teams
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={handleOpenTeams} className="w-full" size="lg" data-testid="button-join-teams">
                  <ExternalLink className="h-5 w-5 mr-2" />
                  Entrar na Reuniao do Teams
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Clique para abrir o Microsoft Teams e participar da aula
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Monitoramento de Presenca
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Tempo de ausencia</span>
                </div>
                <span className="font-medium">
                  {Math.floor(getCurrentAbsenceTime() / 60)}m / {Math.floor(maxAbsenceTime / 60)}m
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                Permaneca nesta pagina durante toda a aula. Sair sem autorizacao ou exceder o tempo maximo de ausencia resultara em falta.
              </p>

              <Button 
                variant="outline"
                onClick={() => setShowLeaveModal(true)}
                className="w-full"
                data-testid="button-request-leave"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Pedir Autorizacao para Sair
              </Button>
            </CardContent>
          </Card>
        </div>
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
    </div>
  );
}
