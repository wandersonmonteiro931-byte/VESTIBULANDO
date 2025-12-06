import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
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
import { 
  HORARIOS_AULAS,
  DIAS_SEMANA,
  type GradeHoraria,
  type HorarioAula,
  type DiaSemana,
  type SlotAula
} from "@shared/schema";
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

interface MateriaDisponivel {
  materia: string;
  turmaId: string;
  turmaNome: string;
  horarioInicio: string;
  horarioFim: string;
  disponivel: boolean;
  proximaAula?: string;
}

export function TeacherClassControl() {
  const [, setLocation] = useLocation();
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
  const [gradesHorarias, setGradesHorarias] = useState<GradeHoraria[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

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

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!userData) return;

    const fetchGradesHorarias = async () => {
      try {
        const gradesRef = collection(db, "gradesHorarias");
        const q = query(gradesRef, where("status", "==", "publicado"));
        const snapshot = await getDocs(q);
        const gradesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as GradeHoraria[];
        setGradesHorarias(gradesData);
      } catch (error) {
        console.error("Error fetching grades horarias:", error);
      }
    };

    fetchGradesHorarias();
  }, [userData]);

  const getDiaSemanaAtual = (): DiaSemana => {
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const dayIndex = brasiliaTime.getDay();
    return DIAS_SEMANA[dayIndex] as DiaSemana;
  };

  const getHorarioBrasiliaMinutos = (): number => {
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    return brasiliaTime.getHours() * 60 + brasiliaTime.getMinutes();
  };

  const horarioParaMinutos = (horario: string): number => {
    const [horas, minutos] = horario.split(":").map(Number);
    return horas * 60 + minutos;
  };

  const materiasDisponiveis = useMemo((): MateriaDisponivel[] => {
    if (!userData || gradesHorarias.length === 0) return [];

    console.log("[TeacherClassControl] Debug - userData.uid:", userData.uid);
    console.log("[TeacherClassControl] Debug - gradesHorarias:", gradesHorarias);
    console.log("[TeacherClassControl] Debug - selectedTurmaId:", selectedTurmaId);

    const diaAtual = getDiaSemanaAtual();
    const minutosAtual = getHorarioBrasiliaMinutos();
    const resultado: MateriaDisponivel[] = [];
    const materiasJaAdicionadas = new Set<string>();

    for (const grade of gradesHorarias) {
      console.log("[TeacherClassControl] Debug - Checking grade:", grade.id, "turmaId:", grade.turmaId, "slots:", grade.slots?.length);
      
      if (grade.slots) {
        grade.slots.forEach((slot, i) => {
          console.log(`[TeacherClassControl] Debug - Slot ${i}: professorId=${slot.professorId}, materia=${slot.materia}`);
        });
      }
      
      const slotsDoProf = grade.slots.filter(slot => slot.professorId === userData.uid);
      console.log("[TeacherClassControl] Debug - slotsDoProf for this grade:", slotsDoProf.length);
      
      for (const slot of slotsDoProf) {
        const horario = HORARIOS_AULAS.find(h => h.id === slot.horarioId);
        if (!horario) continue;

        const inicioMinutos = horarioParaMinutos(horario.inicio);
        const fimMinutos = horarioParaMinutos(horario.fim);
        const chaveMateria = `${slot.materia}-${grade.turmaId}`;

        if (materiasJaAdicionadas.has(chaveMateria)) continue;
        materiasJaAdicionadas.add(chaveMateria);

        const janelaInicio = inicioMinutos - 20;
        const janelaFim = fimMinutos + 20;
        const disponivel = slot.diaSemana === diaAtual && 
                          minutosAtual >= janelaInicio && 
                          minutosAtual <= janelaFim;

        let proximaAula: string | undefined;
        if (!disponivel) {
          const diasOrdem = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
          const diaAtualIndex = diasOrdem.indexOf(diaAtual);
          const slotDiaIndex = diasOrdem.indexOf(slot.diaSemana);
          
          if (slot.diaSemana === diaAtual && minutosAtual < janelaInicio) {
            proximaAula = `Hoje às ${horario.inicio}`;
          } else if (slotDiaIndex > diaAtualIndex) {
            const diasNomes: Record<string, string> = {
              domingo: "Domingo", segunda: "Segunda", terca: "Terça",
              quarta: "Quarta", quinta: "Quinta", sexta: "Sexta", sabado: "Sábado"
            };
            proximaAula = `${diasNomes[slot.diaSemana]} às ${horario.inicio}`;
          } else {
            const diasNomes: Record<string, string> = {
              domingo: "Domingo", segunda: "Segunda", terca: "Terça",
              quarta: "Quarta", quinta: "Quinta", sexta: "Sexta", sabado: "Sábado"
            };
            proximaAula = `${diasNomes[slot.diaSemana]} às ${horario.inicio}`;
          }
        }

        resultado.push({
          materia: slot.materia,
          turmaId: grade.turmaId,
          turmaNome: grade.turmaNome,
          horarioInicio: horario.inicio,
          horarioFim: horario.fim,
          disponivel,
          proximaAula
        });
      }
    }

    return resultado.sort((a, b) => {
      if (a.disponivel && !b.disponivel) return -1;
      if (!a.disponivel && b.disponivel) return 1;
      return a.materia.localeCompare(b.materia);
    });
  }, [userData, gradesHorarias, currentTime]);

  const materiasDisponiveisParaTurma = useMemo(() => {
    if (!selectedTurmaId) return materiasDisponiveis;
    return materiasDisponiveis.filter(m => m.turmaId === selectedTurmaId);
  }, [materiasDisponiveis, selectedTurmaId]);

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
    if (!userData || !selectedTurmaId || !materia) return;
    setIsStarting(true);

    try {
      const today = new Date().toISOString().split("T")[0];
      const sessionsRef = collection(db, "sessoesAulaAoVivo");
      const generatedHorarioId = `horario_${Date.now()}`;
      const generatedHorarioNome = `Aula de ${materia}`;
      
      const docRef = await addDoc(sessionsRef, {
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
        transmitindoTela: false,
        transmitindoCamera: false,
        transmitindoAudio: false,
        modoVisualizacao: "tela",
        dataCriacao: formatBrasiliaTime(),
      });

      toast({
        title: "Aula Iniciada",
        description: "Redirecionando para a sala de aula...",
      });
      
      setLocation(`/sala-professor/${docRef.id}`);
    } catch (error) {
      console.error("Error starting class:", error);
      toast({
        title: "Erro",
        description: "Nao foi possivel iniciar a aula.",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };
  
  const handleEnterClassroom = () => {
    if (currentSession) {
      setLocation(`/sala-professor/${currentSession.id}`);
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
                <Select value={selectedTurmaId} onValueChange={(value) => {
                  setSelectedTurmaId(value);
                  setMateria("");
                }}>
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
                <Label htmlFor="materia-select">Matéria / Disciplina</Label>
                {/* Debug info - remover após correção */}
                {selectedTurmaId && materiasDisponiveisParaTurma.length === 0 && (
                  <div className="text-xs text-amber-500 bg-amber-50 dark:bg-amber-950/30 p-2 rounded mb-2 space-y-1">
                    <div>Debug: UID do professor: {userData?.uid}</div>
                    <div>Grades publicadas: {gradesHorarias.length}</div>
                    <div>Matérias do professor (todas turmas): {materiasDisponiveis.length}</div>
                    <div>Turma selecionada: {selectedTurmaId}</div>
                    <div>Grades com esta turma: {gradesHorarias.filter(g => g.turmaId === selectedTurmaId).length}</div>
                    {gradesHorarias.map(g => (
                      <div key={g.id} className="text-[10px] border-t pt-1">
                        Grade: {g.id} | TurmaId: {g.turmaId} | Status: {g.status} | Slots: {g.slots?.length || 0}
                        {g.slots?.slice(0, 3).map((s, i) => (
                          <div key={i} className="ml-2">Slot {i}: {s.materia} - Prof: {s.professorId?.substring(0, 10)}...</div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                <Select value={materia} onValueChange={setMateria}>
                  <SelectTrigger id="materia-select" data-testid="select-materia">
                    <SelectValue placeholder="Selecione a matéria" />
                  </SelectTrigger>
                  <SelectContent>
                    {materiasDisponiveisParaTurma.length > 0 ? (
                      <>
                        {materiasDisponiveisParaTurma.filter(m => m.disponivel).length > 0 && (
                          <div className="px-2 py-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
                            Disponíveis agora
                          </div>
                        )}
                        {materiasDisponiveisParaTurma.filter(m => m.disponivel).map((m) => (
                          <SelectItem key={`${m.materia}-${m.turmaId}`} value={m.materia}>
                            <div className="flex items-center gap-2">
                              <span>{m.materia}</span>
                              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                                {m.horarioInicio} - {m.horarioFim}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                        {materiasDisponiveisParaTurma.filter(m => !m.disponivel).length > 0 && (
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2 border-t pt-2">
                            Próximas aulas
                          </div>
                        )}
                        {materiasDisponiveisParaTurma.filter(m => !m.disponivel).map((m) => (
                          <SelectItem 
                            key={`${m.materia}-${m.turmaId}-disabled`} 
                            value={`disabled-${m.materia}`} 
                            disabled
                          >
                            <div className="flex items-center gap-2 opacity-60">
                              <span>{m.materia}</span>
                              <span className="text-xs text-muted-foreground">
                                ({m.proximaAula})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    ) : selectedTurmaId ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                        Nenhuma aula programada para esta turma
                      </div>
                    ) : (
                      <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                        Selecione uma turma primeiro
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {selectedTurmaId && materiasDisponiveisParaTurma.filter(m => m.disponivel).length === 0 && materiasDisponiveisParaTurma.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3" />
                    Nenhuma matéria disponível no momento. Aguarde o horário da próxima aula.
                  </p>
                )}
              </div>
              <Button
                onClick={handleStartClass}
                disabled={isStarting || !selectedTurmaId || !materia}
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

              <div className="flex gap-2">
                <Button 
                  className="flex-1"
                  onClick={handleEnterClassroom}
                  data-testid="button-enter-classroom"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Entrar na Sala
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => setShowEndConfirmation(true)}
                  data-testid="button-end-class"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Encerrar
                </Button>
              </div>
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
