import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveClass } from "@/contexts/LiveClassContext";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Whiteboard } from "@/components/Whiteboard";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc,
  getDoc
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Monitor, 
  Camera, 
  CameraOff,
  Mic, 
  MicOff, 
  MonitorOff,
  Users, 
  ArrowLeft,
  Square,
  Loader2,
  PenTool,
  CheckCircle,
  XCircle,
  Video,
  VideoOff,
  Bell
} from "lucide-react";
import type { SessaoAulaAoVivo, PresencaAulaAoVivo, SolicitacaoSaida, User } from "@shared/schema";

type ViewMode = "screen" | "camera" | "whiteboard" | "screen_camera";

export default function TeacherClassroomPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/sala-professor/:sessionId");
  const sessionId = params?.sessionId;
  
  const authContext = useAuth();
  const userData: User | null = (authContext && typeof authContext === 'object' && authContext !== null && 'userData' in authContext) 
    ? (authContext.userData as User | null) 
    : null;
  const { respondToLeaveRequest, pendingLeaveRequests } = useLiveClass();
  const { toast } = useToast();

  const [session, setSession] = useState<SessaoAulaAoVivo | null>(null);
  const [participants, setParticipants] = useState<PresencaAulaAoVivo[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("screen");
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SolicitacaoSaida | null>(null);
  const [isResponding, setIsResponding] = useState(false);
  const [whiteboardData, setWhiteboardData] = useState<string>("");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  const webrtcConfig = session && userData ? {
    sessionId: session.id,
    userId: userData.uid,
    userNome: userData.nome,
    userTipo: "professor" as const,
    isTeacher: true,
  } : null;

  const {
    localStream,
    screenStream,
    isScreenSharing,
    isCameraOn,
    isMicOn,
    startCamera,
    stopCamera,
    toggleCamera,
    toggleMic,
    startScreenShare,
    stopScreenShare,
    cleanup,
  } = useWebRTC(webrtcConfig);

  const formatBrasiliaTime = () => {
    return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  };

  useEffect(() => {
    if (!sessionId) return;

    const sessionRef = doc(db, "sessoesAulaAoVivo", sessionId);
    const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const sessionData = { id: snapshot.id, ...snapshot.data() } as SessaoAulaAoVivo;
        setSession(sessionData);
        if (sessionData.modoVisualizacao) {
          setViewMode(sessionData.modoVisualizacao as ViewMode);
        }
      } else {
        toast({
          title: "Sessao nao encontrada",
          description: "A aula nao foi encontrada.",
          variant: "destructive",
        });
        setLocation("/professor");
      }
    });

    return () => unsubscribe();
  }, [sessionId, setLocation, toast]);

  useEffect(() => {
    if (!session) return;

    const participantsRef = collection(db, "presencasAulaAoVivo");
    const q = query(participantsRef, where("sessaoId", "==", session.id));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const participantsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PresencaAulaAoVivo[];
      setParticipants(participantsList);
    });

    return () => unsubscribe();
  }, [session]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  const updateSessionMedia = useCallback(async (updates: Partial<SessaoAulaAoVivo>) => {
    if (!session) return;
    
    try {
      const sessionRef = doc(db, "sessoesAulaAoVivo", session.id);
      await updateDoc(sessionRef, updates);
    } catch (error) {
      console.error("Error updating session:", error);
    }
  }, [session]);

  const handleStartScreenShare = async () => {
    try {
      await startScreenShare();
      await updateSessionMedia({ 
        transmitindoTela: true,
        modoVisualizacao: "tela" as any,
      });
      setViewMode("screen");
      toast({
        title: "Compartilhamento iniciado",
        description: "Sua tela esta sendo transmitida para os alunos.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Nao foi possivel compartilhar a tela.",
        variant: "destructive",
      });
    }
  };

  const handleStopScreenShare = async () => {
    stopScreenShare();
    await updateSessionMedia({ transmitindoTela: false });
    toast({
      title: "Compartilhamento encerrado",
      description: "O compartilhamento de tela foi encerrado.",
    });
  };

  const handleStartCamera = async () => {
    try {
      await startCamera();
      await updateSessionMedia({ 
        transmitindoCamera: true,
        transmitindoAudio: true,
      });
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

  const handleStopCamera = async () => {
    stopCamera();
    await updateSessionMedia({ 
      transmitindoCamera: false,
      transmitindoAudio: false,
    });
  };

  const handleToggleMic = async () => {
    toggleMic();
    await updateSessionMedia({ transmitindoAudio: !isMicOn });
  };

  const handleToggleCamera = async () => {
    toggleCamera();
    await updateSessionMedia({ transmitindoCamera: !isCameraOn });
  };

  const handleViewModeChange = async (mode: ViewMode) => {
    setViewMode(mode);
    await updateSessionMedia({ modoVisualizacao: mode as any });
  };

  const handleWhiteboardDataChange = async (data: string) => {
    setWhiteboardData(data);
    await updateSessionMedia({ quadroBrancoData: data });
  };

  const handleEndClass = async () => {
    if (!session) return;
    setIsEnding(true);

    try {
      const sessionRef = doc(db, "sessoesAulaAoVivo", session.id);
      await updateDoc(sessionRef, {
        status: "finalizada",
        dataFim: formatBrasiliaTime(),
        transmitindoTela: false,
        transmitindoCamera: false,
        transmitindoAudio: false,
      });

      const participantsRef = collection(db, "presencasAulaAoVivo");
      const q = query(participantsRef, where("sessaoId", "==", session.id));
      const snapshot = await onSnapshot(q, () => {});
      snapshot();

      cleanup();

      toast({
        title: "Aula Encerrada",
        description: "Todos os alunos presentes tiveram a presenca validada.",
      });
      
      setShowEndConfirmation(false);
      setLocation("/professor");
    } catch (error) {
      console.error("Error ending class:", error);
      toast({
        title: "Erro",
        description: "Nao foi possivel encerrar a aula.",
        variant: "destructive",
      });
    } finally {
      setIsEnding(false);
    }
  };

  const handleRespondToRequest = async (approved: boolean) => {
    if (!selectedRequest) return;
    setIsResponding(true);

    try {
      await respondToLeaveRequest(selectedRequest.id, approved);
      toast({
        title: approved ? "Saida Autorizada" : "Saida Negada",
        description: approved 
          ? `${selectedRequest.alunoNome} foi liberado(a) da aula.`
          : `${selectedRequest.alunoNome} deve permanecer na aula.`,
      });
      setSelectedRequest(null);
    } catch (error) {
      console.error("Error responding to request:", error);
      toast({
        title: "Erro",
        description: "Nao foi possivel responder a solicitacao.",
        variant: "destructive",
      });
    } finally {
      setIsResponding(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "na_sala":
        return <Badge className="bg-green-500" variant="default">Na Sala</Badge>;
      case "ausente":
        return <Badge variant="secondary">Ausente</Badge>;
      case "removido":
        return <Badge variant="destructive">Removido</Badge>;
      case "liberado":
        return <Badge className="bg-blue-500">Liberado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const presentCount = participants.filter(p => p.status === "na_sala").length;
  const totalCount = participants.length;

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowEndConfirmation(true)}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{session.materia}</h1>
              <p className="text-sm text-muted-foreground">{session.turmaNome}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {presentCount}/{totalCount}
            </Badge>
            <Badge className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Ao Vivo
            </Badge>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 p-3 bg-muted/50 border-b flex-wrap">
            <div className="flex items-center gap-1 bg-card rounded-lg p-1">
              <Button
                size="sm"
                variant={viewMode === "screen" ? "default" : "ghost"}
                onClick={() => handleViewModeChange("screen")}
                disabled={!isScreenSharing}
                data-testid="button-view-screen"
              >
                <Monitor className="h-4 w-4 mr-1" />
                Tela
              </Button>
              <Button
                size="sm"
                variant={viewMode === "camera" ? "default" : "ghost"}
                onClick={() => handleViewModeChange("camera")}
                disabled={!isCameraOn}
                data-testid="button-view-camera"
              >
                <Camera className="h-4 w-4 mr-1" />
                Camera
              </Button>
              <Button
                size="sm"
                variant={viewMode === "whiteboard" ? "default" : "ghost"}
                onClick={() => handleViewModeChange("whiteboard")}
                data-testid="button-view-whiteboard"
              >
                <PenTool className="h-4 w-4 mr-1" />
                Quadro
              </Button>
              <Button
                size="sm"
                variant={viewMode === "screen_camera" ? "default" : "ghost"}
                onClick={() => handleViewModeChange("screen_camera")}
                disabled={!isScreenSharing || !isCameraOn}
                data-testid="button-view-both"
              >
                <Video className="h-4 w-4 mr-1" />
                Ambos
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            <div className="flex items-center gap-1">
              {!isScreenSharing ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStartScreenShare}
                  data-testid="button-start-screen"
                >
                  <Monitor className="h-4 w-4 mr-1" />
                  Compartilhar Tela
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleStopScreenShare}
                  data-testid="button-stop-screen"
                >
                  <MonitorOff className="h-4 w-4 mr-1" />
                  Parar
                </Button>
              )}

              {!localStream ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStartCamera}
                  data-testid="button-start-camera"
                >
                  <Camera className="h-4 w-4 mr-1" />
                  Iniciar Camera
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
            </div>

            <div className="flex-1" />

            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowEndConfirmation(true)}
              data-testid="button-end-class"
            >
              <Square className="h-4 w-4 mr-1" />
              Encerrar Aula
            </Button>
          </div>

          <div className="flex-1 p-4 bg-black/5 dark:bg-black/20">
            {viewMode === "whiteboard" ? (
              <div className="h-full bg-white rounded-lg shadow-lg overflow-hidden">
                <Whiteboard 
                  onDataChange={handleWhiteboardDataChange}
                  initialData={whiteboardData}
                />
              </div>
            ) : viewMode === "screen" && isScreenSharing ? (
              <div className="h-full flex items-center justify-center">
                <video
                  ref={screenVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="max-w-full max-h-full rounded-lg shadow-lg"
                />
              </div>
            ) : viewMode === "camera" && localStream ? (
              <div className="h-full flex items-center justify-center">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="max-w-full max-h-full rounded-lg shadow-lg"
                  style={{ transform: "scaleX(-1)" }}
                />
              </div>
            ) : viewMode === "screen_camera" && isScreenSharing && localStream ? (
              <div className="h-full relative">
                <video
                  ref={screenVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain rounded-lg shadow-lg"
                />
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute bottom-4 right-4 w-48 h-36 object-cover rounded-lg shadow-lg border-2 border-white"
                  style={{ transform: "scaleX(-1)" }}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Monitor className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Nenhuma transmissao ativa</p>
                  <p className="text-sm mt-1">
                    Clique em "Compartilhar Tela" ou "Iniciar Camera" para comecar
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-80 border-l bg-card flex flex-col">
          <div className="p-3 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Alunos na Aula
              <Badge variant="secondary" className="ml-auto">{presentCount}</Badge>
            </h3>
          </div>

          {pendingLeaveRequests.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border-b">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="h-4 w-4 text-amber-500" />
                <span className="font-medium text-amber-800 dark:text-amber-200 text-sm">
                  Solicitacoes de Saida
                </span>
              </div>
              <div className="space-y-2">
                {pendingLeaveRequests.map((request) => (
                  <div 
                    key={request.id} 
                    className="flex items-center justify-between bg-white dark:bg-background rounded p-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{request.alunoNome}</p>
                      {request.motivoAluno && (
                        <p className="text-xs text-muted-foreground truncate">{request.motivoAluno}</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button 
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => {
                          setSelectedRequest(request);
                          handleRespondToRequest(true);
                        }}
                        data-testid={`button-approve-${request.id}`}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setSelectedRequest(request);
                          handleRespondToRequest(false);
                        }}
                        data-testid={`button-deny-${request.id}`}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {participants.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum aluno entrou ainda
                </p>
              ) : (
                participants.map((participant) => (
                  <div 
                    key={participant.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{participant.alunoNome}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {participant.cameraLigada ? (
                          <Camera className="h-3 w-3 text-green-500" />
                        ) : (
                          <CameraOff className="h-3 w-3 text-muted-foreground" />
                        )}
                        {participant.micLigado ? (
                          <Mic className="h-3 w-3 text-green-500" />
                        ) : (
                          <MicOff className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    {getStatusBadge(participant.status)}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <Dialog open={showEndConfirmation} onOpenChange={setShowEndConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar Aula?</DialogTitle>
            <DialogDescription>
              Ao encerrar a aula, todos os alunos presentes terao a presenca validada automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm">
              <strong>{presentCount}</strong> aluno(s) presente(s) terao presenca confirmada.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEndConfirmation(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleEndClass} disabled={isEnding}>
              {isEnding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Encerrando...
                </>
              ) : (
                "Encerrar Aula"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitacao de Saida</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Aluno:</span>
                  <span className="font-medium">{selectedRequest.alunoNome}</span>
                </div>
                {selectedRequest.motivoAluno && (
                  <div>
                    <span className="text-sm text-muted-foreground">Motivo:</span>
                    <p className="mt-1">{selectedRequest.motivoAluno}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="destructive" 
              onClick={() => handleRespondToRequest(false)}
              disabled={isResponding}
            >
              {isResponding ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
              Negar Saida
            </Button>
            <Button 
              onClick={() => handleRespondToRequest(true)}
              disabled={isResponding}
            >
              {isResponding ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Autorizar Saida
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
