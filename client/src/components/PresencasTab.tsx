import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, doc, query, where, getDocs, Timestamp } from "firebase/firestore";
import { 
  DIAS_SEMANA, 
  HORARIOS_AULAS,
  type DiaSemana, 
  type GradeHoraria,
  type RegistroPresencaTurma
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Calendar, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  UserCheck,
  Users,
  Save,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  CalendarDays
} from "lucide-react";
import { format, addDays, subDays, startOfDay, isSameDay, parseISO, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";

const DIAS_LABELS: Record<DiaSemana, string> = {
  domingo: "Domingo",
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
};

const getDiaSemanaFromDate = (date: Date): DiaSemana | null => {
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
};

interface PresencasTabProps {
  userType: "diretor" | "professor";
  professorId?: string;
}

interface AlunoPresenca {
  alunoId: string;
  alunoNome: string;
  presente: boolean;
  justificativa?: string;
}

export function PresencasTab({ userType, professorId }: PresencasTabProps) {
  const { userData } = useAuth() as { userData: any };
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedAula, setSelectedAula] = useState<{
    gradeId: string;
    turmaId: string;
    turmaNome: string;
    horarioId: string;
    materia: string;
    professorId: string;
    professorNome: string;
  } | null>(null);
  const [presencaDialog, setPresencaDialog] = useState(false);
  const [presencas, setPresencas] = useState<AlunoPresenca[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTurmaFilter, setSelectedTurmaFilter] = useState<string>("all");

  const { data: grades, isLoading: loadingGrades } = useRealtimeQuery<GradeHoraria>({
    collectionName: "gradesHorarias",
    queryKey: ["gradesHorarias", "publicado"],
  });

  const { data: turmas, isLoading: loadingTurmas } = useRealtimeQuery({
    collectionName: "turmas",
    queryKey: ["/api/turmas/all"],
  });

  const { data: alunos } = useRealtimeQuery({
    collectionName: "usuarios",
    queryKey: ["/api/usuarios/alunos"],
  });

  const { data: presencasExistentes, refetch: refetchPresencas } = useRealtimeQuery<RegistroPresencaTurma>({
    collectionName: "registroPresencas",
    queryKey: ["registroPresencas", selectedDate.toISOString().split("T")[0]],
    constraints: [
      where("data", "==", selectedDate.toISOString().split("T")[0])
    ],
  });

  const gradesPublicadas = useMemo(() => {
    if (!grades) return [];
    return grades.filter(g => g.status === "publicado");
  }, [grades]);

  const gradesFiltradas = useMemo(() => {
    if (!gradesPublicadas) return [];
    
    if (userType === "professor" && professorId) {
      return gradesPublicadas.filter(g => 
        g.slots.some(s => s.professorId === professorId)
      );
    }
    
    return gradesPublicadas;
  }, [gradesPublicadas, userType, professorId]);

  const diaSelecionado = getDiaSemanaFromDate(selectedDate);

  const aulasDataSelecionada = useMemo(() => {
    if (!diaSelecionado || gradesFiltradas.length === 0) return [];
    
    console.log("Presenças existentes carregadas:", presencasExistentes);
    console.log("Data selecionada (ISO):", selectedDate.toISOString().split("T")[0]);
    
    const aulas: Array<{
      gradeId: string;
      turmaId: string;
      turmaNome: string;
      horarioId: string;
      horarioNome: string;
      horarioInicio: string;
      horarioFim: string;
      materia: string;
      professorId: string;
      professorNome: string;
      presencaMarcada: boolean;
    }> = [];
    
    gradesFiltradas.forEach(grade => {
      if (selectedTurmaFilter !== "all" && grade.turmaId !== selectedTurmaFilter) return;
      
      grade.slots
        .filter(s => {
          if (s.diaSemana !== diaSelecionado) return false;
          if (userType === "professor" && professorId && s.professorId !== professorId) return false;
          return true;
        })
        .forEach(slot => {
          const horario = HORARIOS_AULAS.find(h => h.id === slot.horarioId);
          const presencaExistente = presencasExistentes?.find(p => {
            const matchTurma = p.turmaId === grade.turmaId;
            const matchHorario = p.horarioId === slot.horarioId;
            
            // Normalize dates to YYYY-MM-DD
            // Handle both ISO strings and simpler YYYY-MM-DD
            const pData = ((p as any).data || p.data || "").split("T")[0];
            const targetData = selectedDate.toISOString().split("T")[0];
            const matchData = pData === targetData;
            
            return matchTurma && matchHorario && matchData;
          });

          // Se for uma aula ao vivo e houver um registro sincronizado,
          // consideramos como "Presença Marcada" automaticamente
          const isLiveClassPresence = presencaExistente?.origem === "aula_ao_vivo" || (presencaExistente as any)?.tipo === "ao_vivo";
          
          aulas.push({
            gradeId: grade.id,
            turmaId: grade.turmaId,
            turmaNome: grade.turmaNome,
            horarioId: slot.horarioId,
            horarioNome: horario?.nome || "",
            horarioInicio: horario?.inicio || "",
            horarioFim: horario?.fim || "",
            materia: slot.materia,
            professorId: slot.professorId,
            professorNome: slot.professorNome,
            presencaMarcada: !!presencaExistente,
            isLiveClass: isLiveClassPresence
          });
        });
    });
    
    return aulas.sort((a, b) => a.horarioInicio.localeCompare(b.horarioInicio));
  }, [gradesFiltradas, diaSelecionado, selectedDate, presencasExistentes, userType, professorId, selectedTurmaFilter]);

  const alunosDaTurma = useMemo(() => {
    if (!selectedAula || !alunos) return [];
    return (alunos as any[])
      .filter(a => a.tipo === "aluno" && a.turma === selectedAula.turmaId && a.status === "aprovado")
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  }, [selectedAula, alunos]);

  const handleOpenPresenca = async (aula: typeof aulasDataSelecionada[0]) => {
    setSelectedAula({
      gradeId: aula.gradeId,
      turmaId: aula.turmaId,
      turmaNome: aula.turmaNome,
      horarioId: aula.horarioId,
      materia: aula.materia,
      professorId: aula.professorId,
      professorNome: aula.professorNome,
    });

    const alunosTurma = (alunos as any[] || [])
      .filter(a => a.tipo === "aluno" && a.turma === aula.turmaId && a.ativo !== false)
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

    const presencaExistente = presencasExistentes?.find(p => {
      const pData = ((p as any).data || p.data || "").split("T")[0];
      const targetData = selectedDate.toISOString().split("T")[0];
      return p.turmaId === aula.turmaId &&
             p.horarioId === aula.horarioId &&
             pData === targetData;
    });

    if (presencaExistente) {
      // Se já existe um registro, usamos os dados do registro
      // mas garantimos que todos os alunos atuais da turma sejam listados
      setPresencas(
        alunosTurma.map(aluno => {
          const registro = presencaExistente.presencas.find(p => p.alunoId === (aluno.uid || aluno.id));
          return {
            alunoId: (aluno.uid || aluno.id),
            alunoNome: aluno.nome || "Sem nome",
            presente: registro?.presente ?? true,
            justificativa: registro?.justificativa,
          };
        })
      );
    } else {
      setPresencas(
        alunosTurma.map(aluno => ({
          alunoId: (aluno.uid || aluno.id),
          alunoNome: aluno.nome || "Sem nome",
          presente: true,
          justificativa: undefined,
        }))
      );
    }

    setPresencaDialog(true);
  };

  const handleTogglePresenca = (alunoId: string) => {
    setPresencas(prev => {
      const updated = prev.map(p =>
        p.alunoId === alunoId ? { ...p, presente: !p.presente } : p
      );
      console.log("Updated presencas:", updated);
      return updated;
    });
  };

  const handleMarcarTodos = (presente: boolean) => {
    setPresencas(prev =>
      prev.map(p => ({ ...p, presente }))
    );
  };

  const handleSavePresenca = async () => {
    if (!selectedAula || !userData) return;

    setSaving(true);
    try {
      const presencaData = {
        gradeHorariaId: selectedAula.gradeId || "",
        turmaId: selectedAula.turmaId || "",
        turmaNome: selectedAula.turmaNome || "",
        horarioId: selectedAula.horarioId || "",
        materia: selectedAula.materia || "",
        professorId: selectedAula.professorId || "",
        professorNome: selectedAula.professorNome || "",
        data: selectedDate.toISOString().split("T")[0],
        presencas: presencas.map(p => ({
          alunoId: p.alunoId || "",
          alunoNome: p.alunoNome || "Sem nome",
          presente: !!p.presente,
          justificativa: p.justificativa || null,
        })),
        registradoPorId: userData?.uid || "",
        registradoPorNome: userData?.nome || "",
        criadoEm: getNowBrasiliaISO(),
        atualizadoEm: getNowBrasiliaISO(),
      };

      const presencaExistenteDoc = presencasExistentes?.find(p => {
        const pData = ((p as any).data || p.data || "").split("T")[0];
        const targetData = selectedDate.toISOString().split("T")[0];
        return p.turmaId === selectedAula.turmaId &&
               p.horarioId === selectedAula.horarioId &&
               pData === targetData;
      });

      if (presencaExistenteDoc) {
        await updateDoc(doc(db, "registroPresencas", presencaExistenteDoc.id), {
          ...presencaData,
          criadoEm: presencaExistenteDoc.criadoEm,
        });
      } else {
        await addDoc(collection(db, "registroPresencas"), presencaData);
      }

      toast({
        title: "Presenças registradas!",
        description: `${presencas.filter(p => p.presente).length} de ${presencas.length} alunos presentes.`,
      });

      setPresencaDialog(false);
      refetchPresencas();
    } catch (error: any) {
      console.error("Erro ao salvar presenças:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível registrar as presenças.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const presencasFiltradas = useMemo(() => {
    if (!searchTerm) return presencas;
    return presencas.filter(p =>
      p.alunoNome.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [presencas, searchTerm]);

  const estatisticas = useMemo(() => {
    const total = presencas.length;
    const presentes = presencas.filter(p => p.presente).length;
    const ausentes = total - presentes;
    const percentual = total > 0 ? Math.round((presentes / total) * 100) : 0;
    return { total, presentes, ausentes, percentual };
  }, [presencas]);

  if (loadingGrades || loadingTurmas) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Registro de Presenças
          </h3>
          <p className="text-sm text-muted-foreground">
            Marque a presença dos alunos nas aulas
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Navegação por Data
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedDate(d => subDays(d, 1))}
                data-testid="button-prev-day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant={isToday(selectedDate) ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDate(new Date())}
                data-testid="button-today"
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedDate(d => addDays(d, 1))}
                data-testid="button-next-day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardDescription className="text-center sm:text-left mt-2">
            {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            {diaSelecionado ? ` (${DIAS_LABELS[diaSelecionado]})` : " (Fim de semana)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userType === "diretor" && (
            <div className="mb-4">
              <Select value={selectedTurmaFilter} onValueChange={setSelectedTurmaFilter}>
                <SelectTrigger className="w-full sm:w-64" data-testid="select-turma-filter">
                  <SelectValue placeholder="Filtrar por turma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as turmas</SelectItem>
                  {(turmas as any[] || []).filter(t => t.ativa).map(turma => (
                    <SelectItem key={turma.id} value={turma.id}>
                      {turma.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!diaSelecionado ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Fim de semana</p>
              <p className="text-sm text-muted-foreground">
                Não há aulas neste dia.
              </p>
            </div>
          ) : aulasDataSelecionada.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nenhuma aula neste dia</p>
              <p className="text-sm text-muted-foreground">
                {userType === "professor"
                  ? "Você não possui aulas programadas para esta data."
                  : "Nenhuma aula foi encontrada para esta data."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {aulasDataSelecionada.map((aula, idx) => (
                <div
                  key={`${aula.gradeId}-${aula.horarioId}`}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border",
                    aula.presencaMarcada ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" : "bg-card"
                  )}
                  data-testid={`aula-item-${idx}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="font-mono">
                        {aula.horarioInicio} - {aula.horarioFim}
                      </Badge>
                      <Badge>{aula.materia}</Badge>
                      {aula.presencaMarcada && (
                        <Badge variant="outline" className={cn(
                          "border-green-300",
                          (aula as any).isLiveClass ? "text-blue-600 border-blue-300" : "text-green-600"
                        )}>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {(aula as any).isLiveClass ? "Sincronizado Aula Ao Vivo" : "Presença registrada"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {aula.turmaNome}
                      {userType === "diretor" && ` • Prof. ${aula.professorNome}`}
                    </p>
                  </div>
                  <Button
                    variant={aula.presencaMarcada ? "outline" : "default"}
                    size="sm"
                    onClick={() => handleOpenPresenca(aula)}
                    data-testid={`button-presenca-${idx}`}
                  >
                    <UserCheck className="h-4 w-4 mr-1" />
                    {aula.presencaMarcada ? "Editar" : "Marcar Presença"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={presencaDialog} onOpenChange={setPresencaDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-presenca">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Registro de Presença
            </DialogTitle>
            <DialogDescription>
              {selectedAula && (
                <span>
                  {selectedAula.materia} • {selectedAula.turmaNome} • {format(selectedDate, "dd/MM/yyyy")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{estatisticas.presentes}</p>
                  <p className="text-xs text-muted-foreground">Presentes</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{estatisticas.ausentes}</p>
                  <p className="text-xs text-muted-foreground">Ausentes</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{estatisticas.percentual}%</p>
                  <p className="text-xs text-muted-foreground">Frequência</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleMarcarTodos(true)}
                  data-testid="button-mark-all-present"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Todos presentes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleMarcarTodos(false)}
                  data-testid="button-mark-all-absent"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Todos ausentes
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar aluno..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-aluno"
              />
            </div>

            {presencasFiltradas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum aluno encontrado</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                {presencasFiltradas.map((aluno, idx) => (
                  <div
                    key={aluno.alunoId}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors",
                      aluno.presente
                        ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                        : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                    )}
                    data-testid={`aluno-presenca-${idx}`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`presenca-${aluno.alunoId}`}
                        checked={aluno.presente}
                        onCheckedChange={() => handleTogglePresenca(aluno.alunoId)}
                        data-testid={`checkbox-presenca-${idx}`}
                      />
                      <Label
                        htmlFor={`presenca-${aluno.alunoId}`}
                        className="text-sm font-medium cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          handleTogglePresenca(aluno.alunoId);
                        }}
                      >
                        {aluno.alunoNome}
                      </Label>
                    </div>
                    <Badge variant={aluno.presente ? "default" : "destructive"}>
                      {aluno.presente ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Presente
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Ausente
                        </>
                      )}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPresencaDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSavePresenca}
              disabled={saving}
              data-testid="button-save-presenca"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Presenças
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
