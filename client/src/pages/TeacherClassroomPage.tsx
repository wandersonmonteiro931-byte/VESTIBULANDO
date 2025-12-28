import { useState, useEffect, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveClass } from "@/contexts/LiveClassContext";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
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
  Users, 
  ArrowLeft,
  Square,
  Loader2,
  CheckCircle,
  XCircle,
  Bell,
  Clock,
  ExternalLink,
  Copy,
  AlertTriangle,
} from "lucide-react";
import type { SessaoAulaAoVivo, PresencaAulaAoVivo, SolicitacaoSaida, User } from "@shared/schema";

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
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SolicitacaoSaida | null>(null);
  const [isResponding, setIsResponding] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showTimeWarning, setShowTimeWarning] = useState(false);

  const formatBrasiliaTime = () => {
    return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  };

  const maxDurationMinutes = session?.duracaoMaximaMinutos || 50;
  const maxDurationSeconds = maxDurationMinutes * 60;
  const remainingSeconds = Math.max(0, maxDurationSeconds - elapsedSeconds);
  const progressPercentage = Math.min(100, (elapsedSeconds / maxDurationSeconds) * 100);
  const isOverTime = elapsedSeconds >= maxDurationSeconds;

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!sessionId) return;

    let unsubscribe: (() => void) | null = null;
    let isMounted = true;

    const setupListener = () => {
      try {
        const sessionRef = doc(db, "sessoesAulaAoVivo", sessionId);
        unsubscribe = onSnapshot(sessionRef, (snapshot) => {
          if (!isMounted) return;
          if (snapshot.exists()) {
            const sessionData = { id: snapshot.id, ...snapshot.data() } as SessaoAulaAoVivo;
            setSession(sessionData);
          } else {
            toast({
              title: "Sessao nao encontrada",
              description: "A aula nao foi encontrada.",
              variant: "destructive",
            });
            setLocation("/professor");
          }
        }, (error: any) => {
          if (error?.message?.includes('INTERNAL ASSERTION FAILED')) {
            console.warn("[TeacherClassroomPage] Firebase SDK bug detectado - recarregue a página se persistir");
            return;
          }
          console.error("[TeacherClassroomPage] Erro ao escutar sessão:", error);
        });
      } catch (error: any) {
        if (!error?.message?.includes('INTERNAL ASSERTION FAILED')) {
          console.error("[TeacherClassroomPage] Falha ao configurar listener de sessão:", error);
        }
      }
    };

    setupListener();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [sessionId, setLocation, toast]);

  useEffect(() => {
    if (!session) return;

    let unsubscribe: (() => void) | null = null;
    let isMounted = true;

    const setupListener = () => {
      try {
        const participantsRef = collection(db, "presencasAulaAoVivo");
        const q = query(participantsRef, where("sessaoId", "==", session.id));

        unsubscribe = onSnapshot(q, (snapshot) => {
          if (!isMounted) return;
          const participantsList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as PresencaAulaAoVivo[];
          setParticipants(participantsList);
        }, (error: any) => {
          if (error?.message?.includes('INTERNAL ASSERTION FAILED')) {
            console.warn("[TeacherClassroomPage] Firebase SDK bug detectado - recarregue a página se persistir");
            return;
          }
          console.error("[TeacherClassroomPage] Erro ao escutar participantes:", error);
        });
      } catch (error: any) {
        if (!error?.message?.includes('INTERNAL ASSERTION FAILED')) {
          console.error("[TeacherClassroomPage] Falha ao configurar listener de participantes:", error);
        }
      }
    };

    setupListener();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [session]);

  useEffect(() => {
    if (!session?.dataInicio) return;

    const calculateElapsed = () => {
      try {
        // Handle ISO string or common date formats from Firebase
        const startStr = session.dataInicio;
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
          console.error("[TeacherClassroomPage] Invalid dataInicio:", startStr);
          return;
        }

        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedSeconds(Math.max(0, elapsed));
      } catch (error) {
        console.error("[TeacherClassroomPage] Error calculating elapsed time:", error);
      }
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);

    return () => clearInterval(interval);
  }, [session?.dataInicio]);

  useEffect(() => {
    const fiveMinutesRemaining = maxDurationSeconds - 300;
    if (elapsedSeconds >= fiveMinutesRemaining && elapsedSeconds < fiveMinutesRemaining + 2 && !showTimeWarning) {
      setShowTimeWarning(true);
      toast({
        title: "Tempo quase esgotado",
        description: "Restam menos de 5 minutos para o fim da aula.",
        variant: "destructive",
      });
    }
  }, [elapsedSeconds, maxDurationSeconds, showTimeWarning, toast]);

  const handleOpenTeams = () => {
    if (session?.teamsLink) {
      window.open(session.teamsLink, '_blank');
    }
  };

  const handleCopyLink = async () => {
    if (session?.teamsLink) {
      try {
        await navigator.clipboard.writeText(session.teamsLink);
        toast({
          title: "Link copiado",
          description: "O link do Teams foi copiado para a area de transferencia.",
        });
      } catch (error) {
        toast({
          title: "Erro",
          description: "Nao foi possivel copiar o link.",
          variant: "destructive",
        });
      }
    }
  };

  const handleEndClass = async () => {
    if (!session) return;
    setIsEnding(true);

    try {
      const sessionRef = doc(db, "sessoesAulaAoVivo", session.id);
      await updateDoc(sessionRef, {
        status: "finalizada",
        dataFim: formatBrasiliaTime(),
      });

      // Validar presenças dos alunos na sessão
      const participantsRef = collection(db, "presencasAulaAoVivo");
      const q = query(participantsRef, where("sessaoId", "==", session.id), where("status", "==", "na_sala"));
      const querySnapshot = await getDocs(q);
      
      console.log(`Found ${querySnapshot.size} participants to validate`);

      for (const participantDoc of querySnapshot.docs) {
        const pData = participantDoc.data();
        const pId = participantDoc.id;
        
        try {
          // Update live class presence
          await updateDoc(doc(db, "presencasAulaAoVivo", pId), {
            presencaValidada: true,
            dataAtualizacao: formatBrasiliaTime()
          });

          // Also create a record in the general attendance system
          const registrosRef = collection(db, "registrosPresencaChamada");
          await addDoc(registrosRef, {
            alunoId: pData.alunoId,
            alunoNome: pData.alunoNome,
            turmaId: session.turmaId,
            data: new Date().toISOString().slice(0, 10),
            status: "presente",
            materia: session.materia,
            professorId: session.professorId,
            professorNome: session.professorNome,
            tipo: "aula_ao_vivo",
            sessaoId: session.id,
            criadoEm: formatBrasiliaTime()
          });
        } catch (e) {
          console.error(`Error processing participant ${pData.alunoNome}:`, e);
        }
      }

      toast({
        title: "Aula Encerrada",
        description: "As presenças foram validadas com sucesso.",
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

  const handleRespondToRequest = async (request: SolicitacaoSaida, approved: boolean) => {
    setSelectedRequest(request);
    setIsResponding(true);

    try {
      await respondToLeaveRequest(request.id, approved);
      toast({
        title: approved ? "Saida Autorizada" : "Saida Negada",
        description: approved 
          ? `${request.alunoNome} foi liberado(a) da aula.`
          : `${request.alunoNome} deve permanecer na aula.`,
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
        <div className="flex items-center justify-between px-4 py-3 gap-2 flex-wrap">
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

      <div className="flex-1 flex flex-col lg:flex-row">
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
                    <p className={`text-2xl font-semibold ${isOverTime ? 'text-destructive' : remainingSeconds <= 300 ? 'text-amber-500' : ''}`} data-testid="text-remaining-time">
                      {isOverTime ? `+${formatTime(elapsedSeconds - maxDurationSeconds)}` : formatTime(remainingSeconds)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isOverTime ? 'Tempo excedido' : 'Tempo restante'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Progress 
                    value={progressPercentage} 
                    className={`h-3 ${isOverTime ? '[&>div]:bg-destructive' : progressPercentage > 90 ? '[&>div]:bg-amber-500' : ''}`}
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Duracao maxima: {maxDurationMinutes} minutos
                  </p>
                </div>

                {isOverTime && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
                    <p className="text-sm text-destructive">
                      O tempo maximo da aula foi excedido. Por favor, encerre a aula.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Reuniao do Teams
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {session.teamsLink ? (
                  <>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-mono break-all text-muted-foreground" data-testid="text-teams-link">
                        {session.teamsLink}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button onClick={handleOpenTeams} className="flex-1" data-testid="button-open-teams">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir no Teams
                      </Button>
                      <Button variant="outline" onClick={handleCopyLink} data-testid="button-copy-link">
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar Link
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum link do Teams configurado para esta aula.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-center">
              <Button
                size="lg"
                variant="destructive"
                onClick={() => setShowEndConfirmation(true)}
                data-testid="button-end-class"
              >
                <Square className="h-4 w-4 mr-2" />
                Encerrar Aula
              </Button>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l bg-card flex flex-col">
          <div className="p-3 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Alunos na Aula
              <Badge variant="secondary" className="ml-auto">{presentCount}</Badge>
            </h3>
          </div>

          {pendingLeaveRequests && pendingLeaveRequests.length > 0 && (
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
                        className="h-7 w-7 text-green-600"
                        onClick={() => handleRespondToRequest(request, true)}
                        disabled={isResponding}
                        data-testid={`button-approve-${request.id}`}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleRespondToRequest(request, false)}
                        disabled={isResponding}
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
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    data-testid={`participant-${participant.id}`}
                  >
                    <span className="text-sm font-medium truncate">{participant.alunoNome}</span>
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
              Ao encerrar a aula, todos os alunos presentes terao sua presenca validada automaticamente.
              Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEndConfirmation(false)}
              disabled={isEnding}
              data-testid="button-cancel-end"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleEndClass}
              disabled={isEnding}
              data-testid="button-confirm-end"
            >
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
    </div>
  );
}
