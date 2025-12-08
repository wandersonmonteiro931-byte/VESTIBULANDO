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
} from "firebase/firestore";
import { 
  HORARIOS_AULAS,
  HORARIOS_AULAS_PADRAO,
  DIAS_SEMANA,
  type GradeHoraria,
  type HorarioAula,
  type DiaSemana,
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
  Bell,
  ExternalLink,
  Link2,
  Video
} from "lucide-react";
import type { SessaoAulaAoVivo, PresencaAulaAoVivo, SolicitacaoSaida, User } from "@shared/schema";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
  const [horariosCustom, setHorariosCustom] = useState<HorarioAula[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [currentSession, setCurrentSession] = useState<SessaoAulaAoVivo | null>(null);
  const [participants, setParticipants] = useState<PresencaAulaAoVivo[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SolicitacaoSaida | null>(null);
  const [isResponding, setIsResponding] = useState(false);

  const [showTeamsLinkDialog, setShowTeamsLinkDialog] = useState(false);
  const [teamsLink, setTeamsLink] = useState("");
  const [duracaoMinutos, setDuracaoMinutos] = useState(50);

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

    const fetchHorariosCustom = async () => {
      try {
        const configRef = collection(db, "configuracaoHorarios");
        const q = query(configRef, where("ativo", "==", true));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const configData = snapshot.docs[0].data();
          if (configData.horarios && Array.isArray(configData.horarios)) {
            setHorariosCustom(configData.horarios as HorarioAula[]);
          }
        }
      } catch (error) {
        console.error("Error fetching custom horarios:", error);
      }
    };

    fetchGradesHorarias();
    fetchHorariosCustom();
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

  const allHorarios = useMemo(() => {
    return horariosCustom.length > 0 ? horariosCustom : [...HORARIOS_AULAS, ...HORARIOS_AULAS_PADRAO];
  }, [horariosCustom]);

  const materiasDisponiveis = useMemo((): MateriaDisponivel[] => {
    if (!userData || gradesHorarias.length === 0) return [];

    const diaAtual = getDiaSemanaAtual();
    const minutosAtual = getHorarioBrasiliaMinutos();
    const resultado: MateriaDisponivel[] = [];
    const materiasProcessadas = new Map<string, MateriaDisponivel>();

    for (const grade of gradesHorarias) {
      const slotsDoProf = grade.slots.filter(slot => slot.professorId === userData.uid);
      
      for (const slot of slotsDoProf) {
        let horario = allHorarios.find(h => h.id === slot.horarioId);
        
        if (!horario) {
          horario = {
            id: slot.horarioId,
            inicio: "00:00",
            fim: "23:59",
            nome: "Aula",
            tipo: "aula" as const,
            ativo: true
          };
        }

        const inicioMinutos = horarioParaMinutos(horario.inicio);
        const fimMinutos = horarioParaMinutos(horario.fim);

        const janelaInicio = inicioMinutos - 20;
        const janelaFim = fimMinutos + 20;
        const slotDisponivel = slot.diaSemana === diaAtual && 
                          minutosAtual >= janelaInicio && 
                          minutosAtual <= janelaFim;

        const chaveMateria = `${slot.materia}-${grade.turmaId}`;
        const materiaExistente = materiasProcessadas.get(chaveMateria);

        if (slotDisponivel) {
          materiasProcessadas.set(chaveMateria, {
            materia: slot.materia,
            turmaId: grade.turmaId,
            turmaNome: grade.turmaNome,
            horarioInicio: horario.inicio,
            horarioFim: horario.fim,
            disponivel: true,
            proximaAula: undefined
          });
        } else if (!materiaExistente || !materiaExistente.disponivel) {
          const diasOrdem = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
          const diaAtualIndex = diasOrdem.indexOf(diaAtual);
          const slotDiaIndex = diasOrdem.indexOf(slot.diaSemana);
          
          let proximaAula: string;
          if (slot.diaSemana === diaAtual && minutosAtual < janelaInicio) {
            proximaAula = `Hoje às ${horario.inicio}`;
          } else {
            const diasNomes: Record<string, string> = {
              domingo: "Domingo", segunda: "Segunda", terca: "Terça",
              quarta: "Quarta", quinta: "Quinta", sexta: "Sexta", sabado: "Sábado"
            };
            proximaAula = `${diasNomes[slot.diaSemana]} às ${horario.inicio}`;
          }

          if (!materiaExistente) {
            materiasProcessadas.set(chaveMateria, {
              materia: slot.materia,
              turmaId: grade.turmaId,
              turmaNome: grade.turmaNome,
              horarioInicio: horario.inicio,
              horarioFim: horario.fim,
              disponivel: false,
              proximaAula
            });
          }
        }
      }
    }

    const resultadoFinal = Array.from(materiasProcessadas.values());

    return resultadoFinal.sort((a, b) => {
      if (a.disponivel && !b.disponivel) return -1;
      if (!a.disponivel && b.disponivel) return 1;
      return a.materia.localeCompare(b.materia);
    });
  }, [userData, gradesHorarias, currentTime, allHorarios]);

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

  const handleOpenTeamsDialog = () => {
    if (!selectedTurmaId || !materia) {
      toast({
        title: "Selecione turma e matéria",
        description: "Escolha a turma e a matéria antes de iniciar a aula.",
        variant: "destructive",
      });
      return;
    }
    setShowTeamsLinkDialog(true);
  };

  const handleStartClass = async () => {
    if (!userData || !selectedTurmaId || !materia || !teamsLink) return;
    
    if (!teamsLink.includes("teams.microsoft.com") && !teamsLink.includes("teams.live.com")) {
      toast({
        title: "Link inválido",
        description: "Insira um link válido do Microsoft Teams.",
        variant: "destructive",
      });
      return;
    }

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
        teamsLink: teamsLink,
        duracaoMaximaMinutos: duracaoMinutos,
        dataCriacao: formatBrasiliaTime(),
      });

      toast({
        title: "Aula Iniciada",
        description: "Os alunos foram notificados e podem entrar na reunião.",
      });
      
      setShowTeamsLinkDialog(false);
      setTeamsLink("");
      setLocation(`/sala-professor/${docRef.id}`);
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
                onClick={handleOpenTeamsDialog}
                disabled={!selectedTurmaId || !materia}
                className="w-full"
                data-testid="button-start-class"
              >
                <Play className="h-4 w-4 mr-2" />
                Iniciar Aula ao Vivo
              </Button>
            </div>
          )}

          {currentSession?.status === "em_andamento" && (
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
                  <Clock className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{currentSession.duracaoMaximaMinutos || 50}</p>
                  <p className="text-xs text-muted-foreground">Min. Máx.</p>
                </div>
              </div>

              {currentSession.teamsLink && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Video className="h-4 w-4" />
                    <span className="text-sm font-medium">Reunião do Teams ativa</span>
                  </div>
                  <a 
                    href={currentSession.teamsLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1"
                  >
                    Abrir reunião <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleEnterClassroom}
                  className="flex-1"
                  data-testid="button-enter-classroom"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Ver Sala de Aula
                </Button>
                <Button
                  onClick={() => setShowEndConfirmation(true)}
                  variant="destructive"
                  data-testid="button-end-class"
                >
                  <Square className="h-4 w-4" />
                </Button>
              </div>

              {pendingLeaveRequests.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-amber-500" />
                      <h4 className="text-sm font-medium">Solicitações de Saída</h4>
                      <Badge variant="secondary" className="text-xs">
                        {pendingLeaveRequests.length}
                      </Badge>
                    </div>
                    <ScrollArea className="h-[120px]">
                      {pendingLeaveRequests.map((request) => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between p-2 bg-amber-500/10 rounded-lg mb-2 cursor-pointer hover-elevate"
                          onClick={() => setSelectedRequest(request)}
                        >
                          <div>
                            <p className="text-sm font-medium">{request.alunoNome}</p>
                            <p className="text-xs text-muted-foreground">
                              {request.motivo || "Sem motivo informado"}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRequest(request);
                              }}
                            >
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                </>
              )}

              {participants.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Participantes</h4>
                    <ScrollArea className="h-[150px]">
                      {participants.map((participant) => (
                        <div
                          key={participant.id}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded-lg mb-2"
                        >
                          <span className="text-sm">{participant.alunoNome}</span>
                          {getStatusBadge(participant.status)}
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showTeamsLinkDialog} onOpenChange={setShowTeamsLinkDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-blue-500/10">
                <Video className="h-6 w-6 text-blue-500" />
              </div>
              <DialogTitle className="text-xl">Configurar Aula via Teams</DialogTitle>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                Abra o Microsoft Teams
              </h4>
              <p className="text-sm text-muted-foreground ml-8">
                Acesse o Microsoft Teams no seu computador ou navegador e crie uma nova reunião.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                Copie o link da reunião
              </h4>
              <p className="text-sm text-muted-foreground ml-8">
                Após criar a reunião, copie o link de convite gerado pelo Teams.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
                Cole o link abaixo
              </h4>
              <div className="ml-8 space-y-2">
                <Label htmlFor="teams-link">Link da reunião do Teams</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="teams-link"
                      type="url"
                      placeholder="https://teams.microsoft.com/l/meetup-join/..."
                      value={teamsLink}
                      onChange={(e) => setTeamsLink(e.target.value)}
                      className="pl-10"
                      data-testid="input-teams-link"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duracao">Duração máxima da aula (minutos)</Label>
              <Select value={duracaoMinutos.toString()} onValueChange={(v) => setDuracaoMinutos(parseInt(v))}>
                <SelectTrigger id="duracao" data-testid="select-duracao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="45">45 minutos</SelectItem>
                  <SelectItem value="50">50 minutos</SelectItem>
                  <SelectItem value="60">60 minutos (1 hora)</SelectItem>
                  <SelectItem value="90">90 minutos (1h30)</SelectItem>
                  <SelectItem value="120">120 minutos (2 horas)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Após iniciar, os alunos receberão uma notificação com o link para entrar na reunião. 
                  Certifique-se de que a reunião está ativa no Teams.
                </span>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTeamsLinkDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleStartClass}
              disabled={isStarting || !teamsLink}
              data-testid="button-confirm-start-class"
            >
              {isStarting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Iniciar Aula
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEndConfirmation} onOpenChange={setShowEndConfirmation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Encerrar Aula</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja encerrar esta aula? Todos os alunos presentes terão sua presença validada automaticamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEndConfirmation(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleEndClass}
              disabled={isEnding}
              data-testid="button-confirm-end-class"
            >
              {isEnding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Encerrando...
                </>
              ) : (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Encerrar Aula
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitação de Saída</DialogTitle>
            <DialogDescription>
              {selectedRequest?.alunoNome} está solicitando permissão para sair da aula.
            </DialogDescription>
          </DialogHeader>
          {selectedRequest?.motivo && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm">
                <strong>Motivo:</strong> {selectedRequest.motivo}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => handleRespondToRequest(false)}
              disabled={isResponding}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Negar
            </Button>
            <Button
              onClick={() => handleRespondToRequest(true)}
              disabled={isResponding}
              className="bg-green-600 hover:bg-green-700"
            >
              {isResponding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Autorizar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
