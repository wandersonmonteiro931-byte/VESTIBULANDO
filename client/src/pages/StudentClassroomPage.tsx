import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveClass } from "@/contexts/LiveClassContext";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Whiteboard } from "@/components/Whiteboard";
import { db } from "@/lib/firebase";
import { 
  collection, 
  doc, 
  onSnapshot, 
  updateDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Camera, 
  CameraOff,
  Mic, 
  MicOff, 
  Users, 
  ArrowLeft,
  Loader2,
  CheckCircle,
  LogOut,
  BookOpen,
  Clock,
  AlertTriangle
} from "lucide-react";
import { PresenceConfirmationModal } from "@/components/PresenceConfirmationModal";
import { AbsenceModal } from "@/components/AbsenceModal";
import { AbsenceWarningModal } from "@/components/AbsenceWarningModal";
import { LeaveRequestModal } from "@/components/LeaveRequestModal";
import { ReturnModal } from "@/components/ReturnModal";
import { usePresenceMonitor } from "@/hooks/usePresenceMonitor";
import type { SessaoAulaAoVivo, PresencaAulaAoVivo, User } from "@shared/schema";

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

  const teacherVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const webrtcConfig = currentSession && userData ? {
    sessionId: currentSession.id,
    userId: userData.uid,
    userNome: userData.nome,
    userTipo: "aluno" as const,
    isTeacher: false,
  } : null;

  const {
    localStream,
    remoteStreams,
    isCameraOn,
    isMicOn,
    startCamera,
    stopCamera,
    toggleCamera,
    toggleMic,
    announceJoin,
    announceLeave,
    cleanup,
  } = useWebRTC(webrtcConfig);

  const maxAbsenceTime = currentSession?.tempoMaxAusencia || 300;
  const inactivityTimeout = currentSession?.tempoInatividade || 180;
  const confirmationTimeout = currentSession?.tempoConfirmacao || 120;

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
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (teacherVideoRef.current && remoteStreams.size > 0) {
      const teacherStream = Array.from(remoteStreams.values())[0];
      if (teacherStream) {
        teacherVideoRef.current.srcObject = teacherStream;
      }
    }
  }, [remoteStreams]);

  useEffect(() => {
    if (isInClass) {
      const interval = setInterval(() => {
        updateActivity();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isInClass, updateActivity]);

  const updatePresenceMedia = useCallback(async (updates: Partial<PresencaAulaAoVivo>) => {
    if (!studentPresence) return;
    
    try {
      const presenceRef = doc(db, "presencasAulaAoVivo", studentPresence.id);
      await updateDoc(presenceRef, updates);
    } catch (error) {
      console.error("Error updating presence:", error);
    }
  }, [studentPresence]);

  const handleEnterClass = async () => {
    if (!currentSession) return;
    setIsEntering(true);
    try {
      await enterClass(currentSession.id);
      await announceJoin();
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

  const handleStartCamera = async () => {
    try {
      await startCamera();
      await updatePresenceMedia({ cameraLigada: true, micLigado: true });
      toast({
        title: "Camera ativada",
        description: "Sua camera e microfone estao ativos.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Nao foi possivel ativar a camera. Verifique as permissoes do navegador.",
        variant: "destructive",
      });
    }
  };

  const handleToggleCamera = async () => {
    toggleCamera();
    await updatePresenceMedia({ cameraLigada: !isCameraOn });
  };

  const handleToggleMic = async () => {
    toggleMic();
    await updatePresenceMedia({ micLigado: !isMicOn });
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
    cleanup();
    setLocation("/aluno");
  };

  const handleLeaveApproved = () => {
    setLeaveRequestStatus("idle");
    setShowLeaveModal(false);
    cleanup();
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-4 py-3">
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

      <div className="flex-1 flex flex-col lg:flex-row">
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-4 bg-black/5 dark:bg-black/20">
            {session?.modoVisualizacao === "quadro_branco" && session?.quadroBrancoData ? (
              <div className="h-full bg-white rounded-lg shadow-lg overflow-hidden">
                <Whiteboard 
                  initialData={session.quadroBrancoData}
                  readOnly
                />
              </div>
            ) : (session?.transmitindoTela || session?.transmitindoCamera) && remoteStreams.size > 0 ? (
              <div className="h-full flex items-center justify-center relative">
                <video
                  ref={teacherVideoRef}
                  autoPlay
                  playsInline
                  className="max-w-full max-h-full rounded-lg shadow-lg"
                />
                {localStream && (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute bottom-4 right-4 w-32 h-24 object-cover rounded-lg shadow-lg border-2 border-white"
                    style={{ transform: "scaleX(-1)" }}
                  />
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">
                    {session?.status === "em_andamento" 
                      ? "Aguardando transmissao do professor" 
                      : "Aula nao iniciada"}
                  </p>
                  <p className="text-sm mt-1">
                    {session?.transmitindoTela && "Compartilhando tela"}
                    {session?.transmitindoCamera && !session?.transmitindoTela && "Camera ligada"}
                    {!session?.transmitindoTela && !session?.transmitindoCamera && "O professor ainda nao iniciou a transmissao"}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 p-3 bg-card border-t">
            {!localStream ? (
              <Button
                variant="outline"
                onClick={handleStartCamera}
                data-testid="button-start-camera"
              >
                <Camera className="h-4 w-4 mr-2" />
                Ligar Camera
              </Button>
            ) : (
              <>
                <Button
                  size="icon"
                  variant={isCameraOn ? "default" : "secondary"}
                  onClick={handleToggleCamera}
                  data-testid="button-toggle-camera"
                >
                  {isCameraOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
                </Button>
                <Button
                  size="icon"
                  variant={isMicOn ? "default" : "secondary"}
                  onClick={handleToggleMic}
                  data-testid="button-toggle-mic"
                >
                  {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                </Button>
              </>
            )}

            <div className="flex-1" />

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Ausencia: {Math.floor(getCurrentAbsenceTime() / 60)}m / {Math.floor(maxAbsenceTime / 60)}m</span>
            </div>

            <Button 
              variant="outline"
              onClick={() => setShowLeaveModal(true)}
              data-testid="button-request-leave"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Pedir para Sair
            </Button>
          </div>
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
