import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, query, where, addDoc, updateDoc, doc, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, AlertTriangle, BookOpen, User, Bell } from "lucide-react";
import { getNowBrasilia, getNowBrasiliaISO, brasiliaToUTC } from "@/lib/brasiliaTime";
import { cn } from "@/lib/utils";
import type { 
  GradeHoraria, 
  SlotAula, 
  HorarioAula, 
  DiaSemana,
  ChamadaDiaria,
  RegistroPresencaChamada,
  User as UserType
} from "@shared/schema";

const TEMPO_LIMITE_MINUTOS = 5;

interface AttendanceConfirmationModalProps {
  userType: "aluno" | "professor";
}

export function AttendanceConfirmationModal({ userType }: AttendanceConfirmationModalProps) {
  const { userData } = useAuth() as { userData: any };
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [currentChamada, setCurrentChamada] = useState<ChamadaDiaria | null>(null);
  const [registroPresenca, setRegistroPresenca] = useState<RegistroPresencaChamada | null>(null);
  const [tempoRestante, setTempoRestante] = useState<number>(TEMPO_LIMITE_MINUTOS * 60);
  const [confirmando, setConfirmando] = useState(false);
  const [jaConfirmado, setJaConfirmado] = useState(false);

  const { data: horariosConfig } = useRealtimeQuery<{ id: string; ativo?: boolean; horarios: HorarioAula[]; diasAtivos?: DiaSemana[] }>({
    collectionName: "configuracaoHorarios",
    queryKey: ["configuracaoHorarios"],
  });

  const { data: grades } = useRealtimeQuery<GradeHoraria>({
    collectionName: "gradesHorarias",
    queryKey: ["gradesHorarias"],
  });

  const horariosCustom = useMemo(() => {
    if (horariosConfig && horariosConfig.length > 0) {
      const activeConfig = horariosConfig.find(c => c.ativo) ?? horariosConfig[0];
      if (activeConfig.horarios && activeConfig.horarios.length > 0) {
        const activeHorarios = activeConfig.horarios.filter(h => h.ativo !== false);
        return [...activeHorarios].sort((a, b) => a.inicio.localeCompare(b.inicio));
      }
    }
    return [];
  }, [horariosConfig]);

  const diasAtivos = useMemo(() => {
    if (horariosConfig && horariosConfig.length > 0) {
      const activeConfig = horariosConfig.find(c => c.ativo) ?? horariosConfig[0];
      if (activeConfig.diasAtivos && activeConfig.diasAtivos.length > 0) {
        return activeConfig.diasAtivos;
      }
    }
    return ["segunda", "terca", "quarta", "quinta", "sexta"] as DiaSemana[];
  }, [horariosConfig]);

  const getDiaSemanaAtual = useCallback((): DiaSemana | null => {
    const diasMap: Record<number, DiaSemana> = {
      0: "domingo",
      1: "segunda",
      2: "terca",
      3: "quarta",
      4: "quinta",
      5: "sexta",
      6: "sabado",
    };
    
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
    });
    const dayStr = formatter.format(now).toLowerCase();
    
    const dayMapping: Record<string, DiaSemana> = {
      "domingo": "domingo",
      "segunda-feira": "segunda",
      "terça-feira": "terca",
      "quarta-feira": "quarta",
      "quinta-feira": "quinta",
      "sexta-feira": "sexta",
      "sábado": "sabado",
    };
    
    return dayMapping[dayStr] || null;
  }, []);

  const getAulaAtual = useCallback((): { slot: SlotAula; horario: HorarioAula; grade: GradeHoraria } | null => {
    if (!userData || !grades || grades.length === 0 || horariosCustom.length === 0) return null;

    const diaSemana = getDiaSemanaAtual();
    if (!diaSemana || !diasAtivos.includes(diaSemana)) return null;

    const { timeString } = getNowBrasilia();
    const [horaAtual, minutoAtual] = timeString.split(":").map(Number);
    const minutosAtuais = horaAtual * 60 + minutoAtual;

    let gradeUsuario: GradeHoraria | null = null;
    
    if (userType === "aluno" && userData.turma) {
      gradeUsuario = grades.find(g => g.turmaId === userData.turma && g.status === "publicado") || null;
    } else if (userType === "professor") {
      gradeUsuario = grades.find(g => 
        g.status === "publicado" && 
        g.slots.some(s => s.professorId === userData.uid)
      ) || null;
    }

    if (!gradeUsuario) return null;

    for (const horario of horariosCustom) {
      if (horario.tipo === "intervalo") continue;

      const [horaInicio, minInicio] = horario.inicio.split(":").map(Number);
      const minutosInicio = horaInicio * 60 + minInicio;
      const minutosLimite = minutosInicio + TEMPO_LIMITE_MINUTOS;

      if (minutosAtuais >= minutosInicio && minutosAtuais <= minutosLimite) {
        const slot = gradeUsuario.slots.find(s => 
          s.diaSemana === diaSemana && 
          s.horarioId === horario.id &&
          (userType === "aluno" || s.professorId === userData.uid)
        );

        if (slot) {
          return { slot, horario, grade: gradeUsuario };
        }
      }
    }

    return null;
  }, [userData, grades, horariosCustom, diasAtivos, getDiaSemanaAtual, userType]);

  const verificarOuCriarChamada = useCallback(async (slot: SlotAula, horario: HorarioAula, grade: GradeHoraria) => {
    if (!userData) return null;

    const { dateString } = getNowBrasilia();
    
    const chamadaQuery = query(
      collection(db, "chamadasDiarias"),
      where("data", "==", dateString),
      where("turmaId", "==", grade.turmaId),
      where("horarioId", "==", horario.id)
    );

    const snapshot = await getDocs(chamadaQuery);
    
    if (snapshot.empty) {
      if (userType === "professor") {
        const [horaInicio, minInicio] = horario.inicio.split(":").map(Number);
        const limiteISO = brasiliaToUTC(dateString, `${String(horaInicio).padStart(2, '0')}:${String(minInicio + TEMPO_LIMITE_MINUTOS).padStart(2, '0')}:00`);

        const novaChamada: Omit<ChamadaDiaria, "id"> = {
          data: dateString,
          turmaId: grade.turmaId,
          turmaNome: grade.turmaNome,
          horarioId: horario.id,
          horarioNome: horario.nome,
          horarioInicio: horario.inicio,
          horarioFim: horario.fim,
          materia: slot.materia,
          professorId: slot.professorId,
          professorNome: slot.professorNome,
          status: "em_andamento",
          limiteConfirmacao: limiteISO,
          professorConfirmou: false,
          professorAusente: false,
          dataCriacao: getNowBrasiliaISO(),
        };

        const docRef = await addDoc(collection(db, "chamadasDiarias"), novaChamada);
        return { id: docRef.id, ...novaChamada } as ChamadaDiaria;
      } else {
        return null;
      }
    } else {
      const chamadaDoc = snapshot.docs[0];
      return { id: chamadaDoc.id, ...chamadaDoc.data() } as ChamadaDiaria;
    }
  }, [userData, userType]);

  const buscarRegistroPresenca = useCallback(async (chamada: ChamadaDiaria) => {
    if (!userData || userType !== "aluno") return null;

    const registroQuery = query(
      collection(db, "registrosPresencaChamada"),
      where("chamadaId", "==", chamada.id),
      where("alunoId", "==", userData.uid)
    );

    const snapshot = await getDocs(registroQuery);

    if (!snapshot.empty) {
      const registroDoc = snapshot.docs[0];
      return { id: registroDoc.id, ...registroDoc.data() } as RegistroPresencaChamada;
    }
    
    return null;
  }, [userData, userType]);
  
  const criarRegistrosParaAlunos = useCallback(async (chamada: ChamadaDiaria, alunosTurma: any[]) => {
    if (!userData || userType !== "professor") return;

    const now = getNowBrasiliaISO();
    
    for (const aluno of alunosTurma) {
      const registroQuery = query(
        collection(db, "registrosPresencaChamada"),
        where("chamadaId", "==", chamada.id),
        where("alunoId", "==", aluno.uid)
      );

      const snapshot = await getDocs(registroQuery);

      if (snapshot.empty) {
        const novoRegistro: Omit<RegistroPresencaChamada, "id"> = {
          chamadaId: chamada.id,
          data: chamada.data,
          turmaId: chamada.turmaId,
          horarioId: chamada.horarioId,
          alunoId: aluno.uid,
          alunoNome: aluno.nome,
          alunoMatricula: aluno.matricula,
          status: "aguardando",
          confirmadoPeloAluno: false,
          ausenteAutomatico: false,
          dataCriacao: now,
        };

        await addDoc(collection(db, "registrosPresencaChamada"), novoRegistro);
      }
    }
  }, [userData, userType]);

  const confirmarPresenca = useCallback(async () => {
    if (!userData || !currentChamada) return;

    setConfirmando(true);
    try {
      const now = getNowBrasiliaISO();

      if (userType === "professor") {
        await updateDoc(doc(db, "chamadasDiarias", currentChamada.id), {
          professorConfirmou: true,
          professorConfirmouEm: now,
        });
        
        const alunosQuery = query(
          collection(db, "usuarios"),
          where("turma", "==", currentChamada.turmaId),
          where("tipo", "==", "aluno"),
          where("status", "==", "aprovado")
        );
        const alunosSnapshot = await getDocs(alunosQuery);
        const alunos = alunosSnapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
        
        await criarRegistrosParaAlunos(currentChamada, alunos);

        toast({
          title: "Presença confirmada!",
          description: `Sua presença foi registrada. ${alunos.length} alunos notificados.`,
        });
      } else if (userType === "aluno" && registroPresenca) {
        await updateDoc(doc(db, "registrosPresencaChamada", registroPresenca.id), {
          status: "presente",
          confirmadoPeloAluno: true,
          dataConfirmacaoAluno: now,
          dataAtualizacao: now,
        });

        toast({
          title: "Presença confirmada!",
          description: "Sua presença foi registrada com sucesso.",
        });
      }

      setJaConfirmado(true);
      setTimeout(() => setIsOpen(false), 2000);
    } catch (error) {
      console.error("Erro ao confirmar presença:", error);
      toast({
        title: "Erro ao confirmar presença",
        description: "Tente novamente em alguns segundos.",
        variant: "destructive",
      });
    } finally {
      setConfirmando(false);
    }
  }, [userData, currentChamada, registroPresenca, userType, toast, criarRegistrosParaAlunos]);

  useEffect(() => {
    const verificarAula = async () => {
      const aulaAtual = getAulaAtual();
      
      if (aulaAtual) {
        const chamada = await verificarOuCriarChamada(aulaAtual.slot, aulaAtual.horario, aulaAtual.grade);
        
        if (chamada) {
          if (userType === "professor" && chamada.professorConfirmou) {
            return;
          }

          setCurrentChamada(chamada);

          if (userType === "aluno") {
            const registro = await buscarRegistroPresenca(chamada);
            if (registro) {
              if (registro.status === "presente" || registro.confirmadoPeloAluno) {
                return;
              }
              setRegistroPresenca(registro);
            } else {
              return;
            }
          }

          const limiteDate = new Date(chamada.limiteConfirmacao);
          const now = new Date();
          const diffMs = limiteDate.getTime() - now.getTime();
          const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
          
          if (diffSeconds <= 0) {
            return;
          }
          
          setTempoRestante(diffSeconds);
          setJaConfirmado(false);
          setIsOpen(true);
        }
      }
    };

    if (userData) {
      verificarAula();
      const interval = setInterval(verificarAula, 30000);
      return () => clearInterval(interval);
    }
  }, [userData, getAulaAtual, verificarOuCriarChamada, buscarRegistroPresenca, userType]);

  useEffect(() => {
    if (!isOpen || jaConfirmado) return;

    const timer = setInterval(() => {
      setTempoRestante(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          
          if (!jaConfirmado && currentChamada) {
            if (userType === "professor") {
              updateDoc(doc(db, "chamadasDiarias", currentChamada.id), {
                professorAusente: true,
              }).catch(console.error);
            } else if (registroPresenca) {
              updateDoc(doc(db, "registrosPresencaChamada", registroPresenca.id), {
                status: "ausente",
                ausenteAutomatico: true,
                dataAtualizacao: getNowBrasiliaISO(),
              }).catch(console.error);
            }
            
            toast({
              title: "Tempo esgotado!",
              description: "Você foi marcado como ausente por não confirmar a presença a tempo.",
              variant: "destructive",
            });
            
            setTimeout(() => setIsOpen(false), 3000);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, jaConfirmado, currentChamada, registroPresenca, userType, toast]);

  const formatarTempo = (segundos: number): string => {
    const min = Math.floor(segundos / 60);
    const sec = segundos % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const progressoTempo = ((TEMPO_LIMITE_MINUTOS * 60 - tempoRestante) / (TEMPO_LIMITE_MINUTOS * 60)) * 100;

  if (!currentChamada) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !jaConfirmado && setIsOpen(open)}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-attendance-confirmation">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary animate-pulse" />
            Confirmação de Presença
          </DialogTitle>
          <DialogDescription>
            Confirme sua presença na aula para não ser marcado como ausente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                {currentChamada.materia}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{currentChamada.horarioNome} ({currentChamada.horarioInicio} - {currentChamada.horarioFim})</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Prof. {currentChamada.professorNome.split(" ")[0]}</span>
              </div>
              <Badge variant="outline">{currentChamada.turmaNome}</Badge>
            </CardContent>
          </Card>

          {jaConfirmado ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-3" />
              <p className="text-lg font-medium text-green-600">Presença confirmada!</p>
            </div>
          ) : tempoRestante === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <AlertTriangle className="h-16 w-16 text-destructive mb-3" />
              <p className="text-lg font-medium text-destructive">Tempo esgotado!</p>
              <p className="text-sm text-muted-foreground">Você foi marcado como ausente.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Tempo restante</span>
                  <span className={cn(
                    "text-2xl font-bold tabular-nums",
                    tempoRestante <= 60 ? "text-destructive" : tempoRestante <= 120 ? "text-yellow-500" : "text-primary"
                  )}>
                    {formatarTempo(tempoRestante)}
                  </span>
                </div>
                <Progress 
                  value={100 - progressoTempo} 
                  className={cn(
                    "h-3",
                    tempoRestante <= 60 ? "[&>div]:bg-destructive" : tempoRestante <= 120 ? "[&>div]:bg-yellow-500" : ""
                  )}
                />
                {tempoRestante <= 60 && (
                  <p className="text-xs text-destructive text-center animate-pulse">
                    Atenção! Menos de 1 minuto restante!
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button
                  onClick={confirmarPresenca}
                  disabled={confirmando}
                  className="w-full"
                  size="lg"
                  data-testid="button-confirm-attendance"
                >
                  {confirmando ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Confirmando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Confirmar Presença
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
