import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveClass } from "@/contexts/LiveClassContext";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  doc,
  getDocs,
  orderBy
} from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Play, 
  Square, 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle,
  LogOut,
  Loader2,
  AlertTriangle,
  BookOpen,
  Bell
} from "lucide-react";
import type { SessaoAulaAoVivo, PresencaAulaAoVivo, SolicitacaoSaida, User } from "@shared/schema";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Turma {
  id: string;
  nome: string;
}

export function TeacherClassControl() {
  const authContext = useAuth();
  const userData: User | null = (authContext && typeof authContext === 'object' && authContext !== null && 'userData' in authContext) 
    ? (authContext.userData as User | null) 
    : null;
  const { respondToLeaveRequest, pendingLeaveRequests } = useLiveClass();
  const { toast } = useToast();

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>("");
  const [materia, setMateria] = useState<string>("");
  const [loadingTurmas, setLoadingTurmas] = useState(true);

  const [currentSession, setCurrentSession] = useState<SessaoAulaAoVivo | null>(null);
  const [participants, setParticipants] = useState<PresencaAulaAoVivo[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SolicitacaoSaida | null>(null);
  const [isResponding, setIsResponding] = useState(false);

  const selectedTurma = turmas.find(t => t.id === selectedTurmaId);

  useEffect(() => {
    const fetchTurmas = async () => {
      try {
        const turmasRef = collection(db, "turmas");
        const snapshot = await getDocs(turmasRef);
        const turmasData = snapshot.docs.map(doc => ({
          id: doc.id,
          nome: doc.data().nome || doc.id,
        }));
        setTurmas(turmasData);
      } catch (error) {
        console.error("Error fetching turmas:", error);
      } finally {
        setLoadingTurmas(false);
      }
    };

    fetchTurmas();
  }, []);

  const formatBrasiliaTime = () => {
    return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  };

  useEffect(() => {
    if (!userData || !selectedTurmaId) return;

    const sessionsRef = collection(db, "sessoesAulaAoVivo");
    const q = query(
      sessionsRef,
      where("turmaId", "==", selectedTurmaId),
      where("professorId", "==", userData.uid),
      where("status", "in", ["aguardando", "em_andamento"])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const sessionData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as SessaoAulaAoVivo;
        setCurrentSession(sessionData);
      } else {
        setCurrentSession(null);
      }
    });

    return () => unsubscribe();
  }, [userData, selectedTurmaId]);

  useEffect(() => {
    if (!currentSession) {
      setParticipants([]);
      return;
    }

    const participantsRef = collection(db, "presencasAulaAoVivo");
    const q = query(
      participantsRef,
      where("sessaoId", "==", currentSession.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const participantsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PresencaAulaAoVivo[];
      setParticipants(participantsList);
    });

    return () => unsubscribe();
  }, [currentSession]);

  const handleStartClass = async () => {
    if (!userData || !selectedTurmaId || !materia.trim()) return;
    setIsStarting(true);

    try {
      const today = new Date().toISOString().split("T")[0];
      const sessionsRef = collection(db, "sessoesAulaAoVivo");
      const generatedHorarioId = `horario_${Date.now()}`;
      const generatedHorarioNome = `Aula de ${materia}`;
      
      await addDoc(sessionsRef, {
        chamadaId: "",
        turmaId: selectedTurmaId,
        turmaNome: selectedTurma?.nome || "",
        materia,
        horarioId: generatedHorarioId,
        horarioNome: generatedHorarioNome,
        data: today,
        professorId: userData.uid,
        professorNome: userData.nome,
        status: "em_andamento",
        dataInicio: formatBrasiliaTime(),
        tempoMaxAusencia: 300,
        tempoInatividade: 180,
        tempoConfirmacao: 120,
        dataCriacao: formatBrasiliaTime(),
      });

      toast({
        title: "Aula Iniciada",
        description: "Os alunos já podem entrar na sala.",
      });
    } catch (error) {
      console.error("Error starting class:", error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a aula.",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleEndClass = async () => {
    if (!currentSession) return;
    setIsEnding(true);

    try {
      const sessionRef = doc(db, "sessoesAulaAoVivo", currentSession.id);
      await updateDoc(sessionRef, {
        status: "finalizada",
        dataFim: formatBrasiliaTime(),
      });

      const participantsRef = collection(db, "presencasAulaAoVivo");
      const q = query(participantsRef, where("sessaoId", "==", currentSession.id));
      const snapshot = await getDocs(q);

      for (const docSnap of snapshot.docs) {
        const presence = docSnap.data() as PresencaAulaAoVivo;
        if (presence.status === "na_sala") {
          await updateDoc(doc(db, "presencasAulaAoVivo", docSnap.id), {
            status: "liberado",
            presencaValidada: true,
            dataSaida: formatBrasiliaTime(),
            dataAtualizacao: formatBrasiliaTime(),
          });
        }
      }

      toast({
        title: "Aula Encerrada",
        description: "Todos os alunos presentes tiveram a presença validada.",
      });
      setShowEndConfirmation(false);
    } catch (error) {
      console.error("Error ending class:", error);
      toast({
        title: "Erro",
        description: "Não foi possível encerrar a aula.",
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
        title: approved ? "Saída Autorizada" : "Saída Negada",
        description: approved 
          ? `${selectedRequest.alunoNome} foi liberado(a) da aula.`
          : `${selectedRequest.alunoNome} deve permanecer na aula.`,
      });
      setSelectedRequest(null);
    } catch (error) {
      console.error("Error responding to request:", error);
      toast({
        title: "Erro",
        description: "Não foi possível responder à solicitação.",
        variant: "destructive",
      });
    } finally {
      setIsResponding(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "na_sala":
        return <Badge className="bg-green-500">Na Sala</Badge>;
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
  const removedCount = participants.filter(p => p.status === "removido").length;

  if (loadingTurmas) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${currentSession?.status === "em_andamento" ? "bg-green-500/10" : "bg-muted"}`}>
                <BookOpen className={`h-5 w-5 ${currentSession?.status === "em_andamento" ? "text-green-500" : "text-muted-foreground"}`} />
              </div>
              <div>
                <CardTitle className="text-lg">
                  {currentSession?.status === "em_andamento" ? currentSession.materia : "Gerenciar Aula ao Vivo"}
                </CardTitle>
                <CardDescription>
                  {currentSession?.status === "em_andamento" 
                    ? `${currentSession.turmaNome}` 
                    : "Configure e inicie uma aula ao vivo para monitorar a presença dos alunos"}
                </CardDescription>
              </div>
            </div>
            {currentSession?.status === "em_andamento" ? (
              <Badge className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Aula em Andamento
              </Badge>
            ) : (
              <Badge variant="secondary">Aguardando Início</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!currentSession && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="turma-select">Turma</Label>
                <Select value={selectedTurmaId} onValueChange={setSelectedTurmaId}>
                  <SelectTrigger id="turma-select" data-testid="select-turma">
                    <SelectValue placeholder="Selecione a turma" />
                  </SelectTrigger>
                  <SelectContent>
                    {turmas.map((turma) => (
                      <SelectItem key={turma.id} value={turma.id}>
                        {turma.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="materia-input">Matéria / Disciplina</Label>
                <Input 
                  id="materia-input" 
                  placeholder="Ex: Matemática, Física, Português..."
                  value={materia}
                  onChange={(e) => setMateria(e.target.value)}
                  data-testid="input-materia"
                />
              </div>
              <Button
                onClick={handleStartClass}
                disabled={isStarting || !selectedTurmaId || !materia.trim()}
                className="w-full"
                data-testid="button-start-class"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Iniciar Aula ao Vivo
                  </>
                )}
              </Button>
            </div>
          )}

          {currentSession?.status === "em_andamento" ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <Users className="h-4 w-4 mx-auto mb-1 text-green-500" />
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{presentCount}</p>
                  <p className="text-xs text-muted-foreground">Presentes</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <XCircle className="h-4 w-4 mx-auto mb-1 text-destructive" />
                  <p className="text-2xl font-bold text-destructive">{removedCount}</p>
                  <p className="text-xs text-muted-foreground">Removidos</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <LogOut className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingLeaveRequests.length}</p>
                  <p className="text-xs text-muted-foreground">Pedidos</p>
                </div>
              </div>

              {pendingLeaveRequests.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell className="h-4 w-4 text-amber-500" />
                    <span className="font-medium text-amber-800 dark:text-amber-200">
                      Solicitações de Saída Pendentes
                    </span>
                  </div>
                  <div className="space-y-2">
                    {pendingLeaveRequests.map((request) => (
                      <div 
                        key={request.id} 
                        className="flex items-center justify-between bg-white dark:bg-background rounded p-2"
                      >
                        <div>
                          <p className="font-medium text-sm">{request.alunoNome}</p>
                          {request.motivoAluno && (
                            <p className="text-xs text-muted-foreground">{request.motivoAluno}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="h-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => setSelectedRequest(request)}
                            data-testid={`button-respond-leave-${request.id}`}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setSelectedRequest(request);
                            }}
                            data-testid={`button-deny-leave-${request.id}`}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-2">Alunos na Sala</h4>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {participants.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum aluno entrou ainda
                      </p>
                    ) : (
                      participants.map((participant) => (
                        <div 
                          key={participant.id}
                          className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-sm">{participant.alunoNome}</p>
                            {participant.alunoMatricula && (
                              <p className="text-xs text-muted-foreground">Mat: {participant.alunoMatricula}</p>
                            )}
                          </div>
                          {getStatusBadge(participant.status)}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>

              <Button 
                variant="destructive" 
                className="w-full"
                onClick={() => setShowEndConfirmation(true)}
                data-testid="button-end-class"
              >
                <Square className="h-4 w-4 mr-2" />
                Encerrar Aula
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={showEndConfirmation} onOpenChange={setShowEndConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar Aula?</DialogTitle>
            <DialogDescription>
              Ao encerrar a aula, todos os alunos presentes terão a presença validada automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm">
              <strong>{presentCount}</strong> aluno(s) presente(s) terão presença confirmada.
            </p>
            {removedCount > 0 && (
              <p className="text-sm text-destructive mt-1">
                <strong>{removedCount}</strong> aluno(s) foram removidos e receberão falta.
              </p>
            )}
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
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-amber-500/10">
                <LogOut className="h-6 w-6 text-amber-500" />
              </div>
              <DialogTitle>Solicitação de Saída</DialogTitle>
            </div>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Aluno:</span>
                  <span className="font-medium">{selectedRequest.alunoNome}</span>
                </div>
                {selectedRequest.alunoMatricula && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Matrícula:</span>
                    <span>{selectedRequest.alunoMatricula}</span>
                  </div>
                )}
                {selectedRequest.motivoAluno && (
                  <div>
                    <span className="text-sm text-muted-foreground">Motivo:</span>
                    <p className="mt-1">{selectedRequest.motivoAluno}</p>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Se autorizar, o aluno será liberado com presença validada. Se negar, o aluno deverá permanecer na aula.
                </p>
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
              Negar Saída
            </Button>
            <Button 
              onClick={() => handleRespondToRequest(true)}
              disabled={isResponding}
            >
              {isResponding ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Autorizar Saída
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
