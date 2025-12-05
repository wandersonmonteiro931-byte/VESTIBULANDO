import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { 
  DIAS_SEMANA, 
  HORARIOS_AULAS,
  type DiaSemana, 
  type SlotAula,
  type GradeHoraria,
  type HorarioAula,
  type SessaoAulaAoVivo
} from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { 
  Clock, 
  Play, 
  CheckCircle, 
  XCircle, 
  Users,
  BookOpen,
  Loader2,
  Coffee
} from "lucide-react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc,
  getDocs
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { User } from "@shared/schema";

const DIAS_LABELS: Record<DiaSemana, string> = {
  domingo: "Domingo",
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
};

interface AulaDodia {
  turmaId: string;
  turmaNome: string;
  materia: string;
  horarioId: string;
  horarioNome: string;
  horarioInicio: string;
  horarioFim: string;
  diaSemana: DiaSemana;
  status?: "aguardando" | "em_andamento" | "finalizada" | "professor_faltou";
  sessaoId?: string;
}

interface TeacherScheduleGridProps {
  grades: GradeHoraria[];
  professorId: string;
  horariosCustom: HorarioAula[];
  diasExibidos?: DiaSemana[];
  compact?: boolean;
  onStartClass?: (aula: AulaDodia) => void;
}

export function TeacherScheduleGrid({
  grades,
  professorId,
  horariosCustom,
  diasExibidos = ["segunda", "terca", "quarta", "quinta", "sexta"] as DiaSemana[],
  compact = false,
  onStartClass,
}: TeacherScheduleGridProps) {
  const authContext = useAuth();
  const userData: User | null = (authContext && typeof authContext === 'object' && authContext !== null && 'userData' in authContext) 
    ? (authContext.userData as User | null) 
    : null;
  const { toast } = useToast();
  
  const [sessoesDia, setSessoesDia] = useState<SessaoAulaAoVivo[]>([]);
  const [isStartingClass, setIsStartingClass] = useState(false);
  const [selectedAula, setSelectedAula] = useState<AulaDodia | null>(null);
  const [showStartDialog, setShowStartDialog] = useState(false);

  const horarios = horariosCustom && horariosCustom.length > 0 ? horariosCustom : HORARIOS_AULAS;

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const diaHoje = getDayOfWeekName(today);

  function getDayOfWeekName(date: Date): DiaSemana | null {
    const dayMap: Record<number, DiaSemana> = {
      0: "domingo",
      1: "segunda",
      2: "terca",
      3: "quarta",
      4: "quinta",
      5: "sexta",
      6: "sabado",
    };
    return dayMap[date.getDay()] || null;
  }

  useEffect(() => {
    if (!professorId) return;

    const sessionsRef = collection(db, "sessoesAulaAoVivo");
    const q = query(
      sessionsRef,
      where("professorId", "==", professorId),
      where("data", "==", todayStr)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SessaoAulaAoVivo[];
      setSessoesDia(sessions);
    });

    return () => unsubscribe();
  }, [professorId, todayStr]);

  const minhasAulas = useMemo(() => {
    const aulas: Map<string, AulaDodia> = new Map();
    
    grades.forEach(grade => {
      grade.slots
        .filter(s => s.professorId === professorId)
        .forEach(slot => {
          const horario = horarios.find(h => h.id === slot.horarioId);
          const key = `${slot.diaSemana}-${slot.horarioId}`;
          
          const sessao = sessoesDia.find(s => 
            s.turmaId === grade.turmaId && 
            s.horarioId === slot.horarioId
          );

          aulas.set(key, {
            turmaId: grade.turmaId,
            turmaNome: grade.turmaNome,
            materia: slot.materia,
            horarioId: slot.horarioId,
            horarioNome: horario?.nome || "",
            horarioInicio: horario?.inicio || "",
            horarioFim: horario?.fim || "",
            diaSemana: slot.diaSemana,
            status: sessao?.status as any,
            sessaoId: sessao?.id,
          });
        });
    });
    
    return aulas;
  }, [grades, professorId, horarios, sessoesDia]);

  const getSlotInfo = (dia: DiaSemana, horarioId: string) => {
    return minhasAulas.get(`${dia}-${horarioId}`);
  };

  const formatISOTime = () => {
    return new Date().toISOString();
  };

  const isCurrentTimeSlot = (horario: HorarioAula, dia: DiaSemana): boolean => {
    if (dia !== diaHoje) return false;
    
    const now = new Date();
    const [startH, startM] = horario.inicio.split(":").map(Number);
    const [endH, endM] = horario.fim.split(":").map(Number);
    
    const start = new Date();
    start.setHours(startH, startM, 0);
    
    const end = new Date();
    end.setHours(endH, endM, 0);
    
    return now >= start && now <= end;
  };

  const canStartClass = (aula: AulaDodia): boolean => {
    if (aula.diaSemana !== diaHoje) return false;
    if (aula.status === "em_andamento" || aula.status === "finalizada") return false;
    
    const now = new Date();
    const [startH, startM] = aula.horarioInicio.split(":").map(Number);
    const [endH, endM] = aula.horarioFim.split(":").map(Number);
    
    const start = new Date();
    start.setHours(startH, startM, 0);
    start.setMinutes(start.getMinutes() - 10);
    
    const end = new Date();
    end.setHours(endH, endM, 0);
    
    return now >= start && now <= end;
  };

  const handleStartClass = async () => {
    if (!userData || !selectedAula) return;
    setIsStartingClass(true);

    try {
      const sessionsRef = collection(db, "sessoesAulaAoVivo");
      
      await addDoc(sessionsRef, {
        chamadaId: "",
        turmaId: selectedAula.turmaId,
        turmaNome: selectedAula.turmaNome,
        materia: selectedAula.materia,
        horarioId: selectedAula.horarioId,
        horarioNome: selectedAula.horarioNome,
        data: todayStr,
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
        description: `A aula de ${selectedAula.materia} na turma ${selectedAula.turmaNome} foi iniciada.`,
      });
      
      setShowStartDialog(false);
      setSelectedAula(null);
      
      if (onStartClass) {
        onStartClass(selectedAula);
      }
    } catch (error) {
      console.error("Error starting class:", error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a aula.",
        variant: "destructive",
      });
    } finally {
      setIsStartingClass(false);
    }
  };

  const getStatusIcon = (aula: AulaDodia | undefined, isToday: boolean) => {
    if (!aula) return null;
    
    if (aula.status === "finalizada") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </TooltipTrigger>
          <TooltipContent>Aula concluída</TooltipContent>
        </Tooltip>
      );
    }
    
    if (aula.status === "professor_faltou") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <XCircle className="h-4 w-4 text-destructive" />
          </TooltipTrigger>
          <TooltipContent>Professor faltou</TooltipContent>
        </Tooltip>
      );
    }
    
    if (aula.status === "em_andamento") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          </TooltipTrigger>
          <TooltipContent>Aula em andamento</TooltipContent>
        </Tooltip>
      );
    }
    
    return null;
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th className={cn(
                  "border border-border bg-muted/50 font-medium text-muted-foreground",
                  compact ? "p-1 text-xs" : "p-2 text-sm"
                )}>
                  <div className="flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Horário</span>
                  </div>
                </th>
                {diasExibidos.map(dia => (
                  <th 
                    key={dia} 
                    className={cn(
                      "border border-border bg-muted/50 font-medium text-muted-foreground",
                      compact ? "p-1 text-xs" : "p-2 text-sm",
                      dia === diaHoje && "bg-primary/10"
                    )}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {DIAS_LABELS[dia]}
                      {dia === diaHoje && (
                        <Badge variant="outline" className="text-xs ml-1">Hoje</Badge>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {horarios.map(horario => {
                const isIntervalo = horario.tipo === "intervalo";
                
                return (
                  <tr key={horario.id} className={cn(isIntervalo && "bg-muted/40")}>
                    <td className={cn(
                      "border border-border bg-muted/30 text-center font-medium",
                      compact ? "p-1 text-xs" : "p-2 text-sm",
                      isIntervalo && "bg-muted/50"
                    )}>
                      <div className="flex flex-col items-center">
                        <span className="font-semibold">{horario.nome}</span>
                        <span className="text-xs text-muted-foreground">
                          {horario.inicio} - {horario.fim}
                        </span>
                      </div>
                    </td>
                    {isIntervalo ? (
                      <td 
                        colSpan={diasExibidos.length}
                        className={cn(
                          "border border-border text-center bg-muted/30",
                          compact ? "p-1 text-xs" : "p-2 text-sm"
                        )}
                        data-testid={`cell-intervalo-${horario.id}`}
                      >
                        <div className="flex items-center justify-center gap-2 text-muted-foreground italic">
                          <Coffee className="h-4 w-4" />
                          <span>{horario.nome}</span>
                        </div>
                      </td>
                    ) : (
                      diasExibidos.map(dia => {
                        const aula = getSlotInfo(dia, horario.id);
                        const isToday = dia === diaHoje;
                        const isCurrent = isCurrentTimeSlot(horario, dia);
                        const canStart = aula && canStartClass(aula);

                        return (
                          <td
                            key={`${dia}-${horario.id}`}
                            className={cn(
                              "border border-border transition-colors",
                              compact ? "p-1" : "p-1.5",
                              isToday && "bg-primary/5",
                              isCurrent && "ring-2 ring-primary ring-inset"
                            )}
                            data-testid={`cell-teacher-${dia}-${horario.id}`}
                          >
                            {aula ? (
                              <div className={cn(
                                "rounded border p-2 text-center relative",
                                "bg-primary/10 border-primary/30",
                                compact ? "text-xs p-1" : "text-sm"
                              )}>
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <Users className="h-3 w-3 text-primary" />
                                  <span className="font-medium text-primary">{aula.turmaNome}</span>
                                  {getStatusIcon(aula, isToday)}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {aula.materia}
                                </div>
                                
                                {canStart && (
                                  <Button
                                    size="sm"
                                    className="mt-2 h-7 text-xs w-full"
                                    onClick={() => {
                                      setSelectedAula(aula);
                                      setShowStartDialog(true);
                                    }}
                                    data-testid={`button-start-${dia}-${horario.id}`}
                                  >
                                    <Play className="h-3 w-3 mr-1" />
                                    Iniciar
                                  </Button>
                                )}
                                
                                {aula.status === "em_andamento" && (
                                  <Badge className="mt-2 bg-green-500 text-xs">
                                    Em andamento
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <div className={cn(
                                "h-16 flex items-center justify-center text-muted-foreground/60",
                                compact && "h-10 text-xs"
                              )}>
                                <span className="text-xs italic">Horário Livre</span>
                              </div>
                            )}
                          </td>
                        );
                      })
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-3 pt-2 border-t text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Aula concluída</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="h-4 w-4 text-destructive" />
            <span>Professor faltou</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="ml-1">Em andamento</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-4 w-4 rounded border border-dashed border-muted-foreground/40" />
            <span>Horário Livre</span>
          </div>
        </div>
      </div>

      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Iniciar Aula
            </DialogTitle>
            <DialogDescription>
              Você está prestes a iniciar uma aula. Os alunos poderão entrar na sala assim que a aula começar.
            </DialogDescription>
          </DialogHeader>
          
          {selectedAula && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Turma:</span>
                <span className="font-medium">{selectedAula.turmaNome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Matéria:</span>
                <span className="font-medium">{selectedAula.materia}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Horário:</span>
                <span className="font-medium">
                  {selectedAula.horarioInicio} - {selectedAula.horarioFim}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleStartClass} disabled={isStartingClass}>
              {isStartingClass ? (
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
    </TooltipProvider>
  );
}
