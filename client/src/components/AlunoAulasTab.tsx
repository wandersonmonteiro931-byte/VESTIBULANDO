import { useState, useEffect, useMemo } from "react";
import { useLiveClass } from "@/contexts/LiveClassContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useLocation } from "wouter";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { 
  Video, 
  Clock, 
  Users, 
  BookOpen, 
  CheckCircle, 
  AlertCircle, 
  Calendar, 
  Play,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { 
  GradeHoraria, 
  SessaoAulaAoVivo, 
  PresencaAulaAoVivo, 
  ConfiguracaoHorarios,
  User,
  DiaSemana
} from "@shared/schema";
import { HORARIOS_AULAS_PADRAO } from "@shared/schema";

const DIAS_MAP: Record<DiaSemana, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

const DIAS_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

export function AlunoAulasTab() {
  const authContext = useAuth();
  const userData: User | null = (authContext && typeof authContext === 'object' && authContext !== null && 'userData' in authContext) 
    ? (authContext.userData as User | null) 
    : null;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const liveClassContext = useLiveClass();
  const currentSession = liveClassContext?.currentSession ?? null;
  const studentPresence = liveClassContext?.studentPresence ?? null;
  const isInClass = liveClassContext?.isInClass ?? false;
  const enterClass = liveClassContext?.enterClass;
  const isEntering = liveClassContext?.isLoading ?? false;

  const [activeTab, setActiveTab] = useState("aoVivo");
  const [classParticipants, setClassParticipants] = useState(0);
  const [recentSessions, setRecentSessions] = useState<SessaoAulaAoVivo[]>([]);
  const [presenceHistory, setPresenceHistory] = useState<PresencaAulaAoVivo[]>([]);

  const { data: gradeHoraria, isLoading: loadingGrade } = useRealtimeQuery<GradeHoraria>({
    collectionName: "gradesHorarias",
    queryKey: ["/api/grades-horarias", userData?.turma],
    constraints: userData?.turma ? [where("turmaId", "==", userData.turma)] : [],
    enabled: !!userData?.turma,
  });

  const { data: horariosConfig } = useRealtimeQuery<ConfiguracaoHorarios>({
    collectionName: "configuracaoHorarios",
    queryKey: ["configuracaoHorarios"],
  });

  const horariosCustom = useMemo(() => {
    if (horariosConfig && horariosConfig.length > 0) {
      const activeConfig = horariosConfig.find((c: any) => c.ativo) ?? horariosConfig[0];
      if (activeConfig.horarios && activeConfig.horarios.length > 0) {
        const activeHorarios = activeConfig.horarios.filter((h: any) => h.ativo !== false);
        return [...activeHorarios].sort((a: any, b: any) => a.inicio.localeCompare(b.inicio));
      }
    }
    return HORARIOS_AULAS_PADRAO.map(h => ({
      id: h.id,
      nome: h.nome,
      inicio: h.inicio,
      fim: h.fim,
    }));
  }, [horariosConfig]);

  const activeGrade = useMemo(() => {
    if (!gradeHoraria) return null;
    return gradeHoraria.find((g: any) => g.status === "publicado") || gradeHoraria[0];
  }, [gradeHoraria]);

  useEffect(() => {
    if (!currentSession) {
      setClassParticipants(0);
      return;
    }

    let unsubscribe: (() => void) | null = null;

    try {
      const participantsRef = collection(db, "presencasAulaAoVivo");
      const q = query(
        participantsRef,
        where("sessaoId", "==", currentSession.id),
        where("status", "==", "na_sala")
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        setClassParticipants(snapshot.size);
      }, (error: any) => {
        if (!error?.message?.includes('INTERNAL ASSERTION FAILED')) {
          console.error("[AlunoAulasTab] Error listening to participants:", error);
        }
      });
    } catch (error) {
      console.error("[AlunoAulasTab] Failed to setup participants listener:", error);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentSession]);

  useEffect(() => {
    if (!userData?.turma) return;

    let unsubscribe: (() => void) | null = null;

    try {
      const sessionsRef = collection(db, "sessoesAulaAoVivo");
      const q = query(
        sessionsRef,
        where("turmaId", "==", userData.turma),
        where("status", "==", "finalizada"),
        orderBy("dataFim", "desc")
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const sessions = snapshot.docs.slice(0, 10).map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as SessaoAulaAoVivo[];
        setRecentSessions(sessions);
      }, (error: any) => {
        if (!error?.message?.includes('INTERNAL ASSERTION FAILED')) {
          console.error("[AlunoAulasTab] Error listening to recent sessions:", error);
        }
      });
    } catch (error) {
      console.error("[AlunoAulasTab] Failed to setup sessions listener:", error);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userData?.turma]);

  useEffect(() => {
    if (!userData?.uid) return;

    let unsubscribe: (() => void) | null = null;

    try {
      const presenceRef = collection(db, "presencasAulaAoVivo");
      const q = query(
        presenceRef,
        where("alunoId", "==", userData.uid),
        orderBy("dataCriacao", "desc")
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const history = snapshot.docs.slice(0, 20).map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as PresencaAulaAoVivo[];
        setPresenceHistory(history);
      }, (error: any) => {
        if (!error?.message?.includes('INTERNAL ASSERTION FAILED')) {
          console.error("[AlunoAulasTab] Error listening to presence history:", error);
        }
      });
    } catch (error) {
      console.error("[AlunoAulasTab] Failed to setup presence history listener:", error);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userData?.uid]);

  const handleEnterClass = async () => {
    if (!currentSession) return;
    if (!enterClass) {
      toast({
        title: "Aula não disponível",
        description: "Não foi possível conectar ao sistema de aulas. Atualize a página e tente novamente.",
        variant: "destructive"
      });
      return;
    }
    try {
      await enterClass(currentSession.id);
      setLocation("/aluno/sala");
    } catch (error) {
      toast({
        title: "Erro ao entrar na aula",
        description: "Não foi possível entrar na aula. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleGoToClassroom = () => {
    setLocation("/aluno/sala");
  };

  const getTodaySchedule = useMemo(() => {
    if (!activeGrade?.slots) return [];
    
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diasSemana: DiaSemana[] = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    const todayDia = diasSemana[dayOfWeek];
    
    return activeGrade.slots
      .filter((slot: any) => slot.diaSemana === todayDia)
      .map((slot: any) => {
        const horario = horariosCustom.find((h: any) => String(h.id) === String(slot.horarioId));
        return {
          ...slot,
          horarioNome: horario?.nome || slot.horarioId,
          horarioInicio: horario?.inicio || "",
          horarioFim: horario?.fim || "",
        };
      })
      .sort((a: any, b: any) => a.horarioInicio.localeCompare(b.horarioInicio));
  }, [activeGrade, horariosCustom]);

  const weekSchedule = useMemo(() => {
    if (!activeGrade?.slots) return {};
    
    const schedule: Record<number, any[]> = {};
    const diasSemana: DiaSemana[] = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    
    for (let i = 1; i <= 5; i++) {
      const dia = diasSemana[i];
      schedule[i] = activeGrade.slots
        .filter((slot: any) => slot.diaSemana === dia)
        .map((slot: any) => {
          const horario = horariosCustom.find((h: any) => String(h.id) === String(slot.horarioId));
          return {
            ...slot,
            horarioNome: horario?.nome || slot.horarioId,
            horarioInicio: horario?.inicio || "",
            horarioFim: horario?.fim || "",
          };
        })
        .sort((a: any, b: any) => a.horarioInicio.localeCompare(b.horarioInicio));
    }
    
    return schedule;
  }, [activeGrade, horariosCustom]);

  const getPresenceStatusBadge = (status: string) => {
    switch (status) {
      case "na_sala":
        return <Badge className="bg-green-500">Na Sala</Badge>;
      case "liberado":
        return <Badge variant="secondary">Liberado</Badge>;
      case "removido":
        return <Badge variant="destructive">Removido</Badge>;
      case "ausente":
        return <Badge variant="destructive">Ausente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const todaySchedule = getTodaySchedule;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-aulas-title">Minhas Aulas</h2>
          <p className="text-muted-foreground">Acompanhe suas aulas ao vivo e horários</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="aoVivo" data-testid="tab-ao-vivo">
            <Video className="h-4 w-4 mr-2" />
            Ao Vivo
          </TabsTrigger>
          <TabsTrigger value="hoje" data-testid="tab-hoje">
            <Clock className="h-4 w-4 mr-2" />
            Hoje
          </TabsTrigger>
          <TabsTrigger value="semana" data-testid="tab-semana">
            <Calendar className="h-4 w-4 mr-2" />
            Semana
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aoVivo" className="space-y-4 mt-4">
          {currentSession ? (
            <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 to-card dark:from-green-950/20" data-testid="card-live-class">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-green-500/10 animate-pulse">
                      <Video className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-green-700 dark:text-green-400">
                        Aula em Andamento
                      </CardTitle>
                      <CardDescription>{currentSession.materia}</CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-red-500 animate-pulse" data-testid="badge-live">
                    AO VIVO
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-background/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Professor</p>
                    <p className="font-medium text-sm">{currentSession.professorNome}</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Turma</p>
                    <p className="font-medium text-sm">{currentSession.turmaNome}</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Alunos na sala</p>
                    <p className="font-medium text-sm flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {classParticipants}
                    </p>
                  </div>
                </div>

                {isInClass ? (
                  <div className="space-y-3">
                    <div className="bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <p className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Você está na sala de aula
                      </p>
                    </div>
                    <Button 
                      onClick={handleGoToClassroom}
                      className="w-full"
                      size="lg"
                      data-testid="button-go-to-classroom"
                    >
                      <Play className="h-5 w-5 mr-2" />
                      Ir para a Sala de Aula
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        Ao entrar na aula, você deve permanecer até o final. Sair sem autorização resultará em falta.
                      </p>
                    </div>
                    <Button 
                      onClick={handleEnterClass}
                      className="w-full bg-green-600 hover:bg-green-700"
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
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="text-center" data-testid="card-no-live-class">
              <CardHeader>
                <div className="mx-auto p-4 rounded-full bg-muted w-fit mb-2">
                  <Video className="h-8 w-8 text-muted-foreground" />
                </div>
                <CardTitle>Nenhuma Aula ao Vivo</CardTitle>
                <CardDescription>
                  Não há nenhuma aula ao vivo no momento. Aguarde o professor iniciar uma aula.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {recentSessions.length > 0 && (
            <Card data-testid="card-recent-classes">
              <CardHeader>
                <CardTitle className="text-lg">Aulas Recentes</CardTitle>
                <CardDescription>Histórico das suas últimas aulas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentSessions.slice(0, 5).map((session) => {
                    const presence = presenceHistory.find(p => p.sessaoId === session.id);
                    return (
                      <div 
                        key={session.id} 
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        data-testid={`card-session-${session.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/10">
                            <BookOpen className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{session.materia}</p>
                            <p className="text-xs text-muted-foreground">
                              {session.professorNome} - {session.dataInicio ? format(new Date(session.dataInicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "Data não disponível"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {presence ? (
                            getPresenceStatusBadge(presence.status)
                          ) : (
                            <Badge variant="outline">Não participou</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="hoje" className="space-y-4 mt-4">
          <Card data-testid="card-today-schedule">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle>Aulas de Hoje</CardTitle>
              </div>
              <CardDescription>
                {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingGrade ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : todaySchedule.length > 0 ? (
                <div className="space-y-3">
                  {todaySchedule.map((slot, index) => (
                    <div 
                      key={slot.id || index}
                      className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg"
                      data-testid={`card-schedule-slot-${index}`}
                    >
                      <div className="text-center min-w-[60px]">
                        <p className="text-sm font-medium">{slot.horarioInicio}</p>
                        <p className="text-xs text-muted-foreground">{slot.horarioFim}</p>
                      </div>
                      <div className="h-10 w-px bg-border" />
                      <div className="flex-1">
                        <p className="font-medium">{slot.materia}</p>
                        {slot.professorNome && (
                          <p className="text-xs text-muted-foreground">{slot.professorNome}</p>
                        )}
                      </div>
                      {currentSession?.materia === slot.materia && (
                        <Badge className="bg-green-500">Ao Vivo</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhuma aula programada para hoje</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="semana" className="space-y-4 mt-4">
          <Card data-testid="card-week-schedule">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle>Grade da Semana</CardTitle>
              </div>
              <CardDescription>
                Visualize sua grade horária semanal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingGrade ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map(day => (
                    <div key={day} className="space-y-2">
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ))}
                </div>
              ) : Object.keys(weekSchedule).length > 0 ? (
                <div className="space-y-6">
                  {[1, 2, 3, 4, 5].map(day => (
                    <div key={day} data-testid={`card-day-${day}`}>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        {DIAS_LABELS[day]}
                        {new Date().getDay() === day && (
                          <Badge variant="secondary">Hoje</Badge>
                        )}
                      </h4>
                      {weekSchedule[day]?.length > 0 ? (
                        <div className="grid gap-2">
                          {weekSchedule[day].map((slot, index) => (
                            <div 
                              key={slot.id || index}
                              className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg text-sm"
                            >
                              <span className="text-muted-foreground min-w-[100px]">
                                {slot.horarioInicio} - {slot.horarioFim}
                              </span>
                              <span className="font-medium">{slot.materia}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground pl-2">
                          Sem aulas programadas
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Grade horária não disponível</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
