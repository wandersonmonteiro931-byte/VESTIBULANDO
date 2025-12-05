import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useToast } from "@/hooks/use-toast";
import { 
  DIAS_SEMANA, 
  HORARIOS_AULAS,
  type DiaSemana, 
  type GradeHoraria,
  type AulaAgendada,
  type PresencaAula
} from "@shared/schema";
import { ScheduleGrid } from "./ScheduleGrid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  Clock,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Printer,
  User,
  BookOpen,
  RefreshCw
} from "lucide-react";
import { format, startOfWeek, addDays, isToday, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const DIAS_LABELS: Record<DiaSemana, string> = {
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
};

interface HorarioViewerProps {
  userType: "professor" | "aluno";
  turmaId?: string;
  turmaNome?: string;
  professorId?: string;
}

export function HorarioViewer({ userType, turmaId, turmaNome, professorId }: HorarioViewerProps) {
  const { userData } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedAula, setSelectedAula] = useState<any | null>(null);

  const { data: grades, isLoading: loadingGrades, refetch: refetchGrades } = useRealtimeQuery<GradeHoraria>({
    collectionName: "gradesHorarias",
    queryKey: ["gradesHorarias", turmaId, professorId],
  });

  const gradesPublicadas = useMemo(() => {
    if (!grades) return [];
    return grades.filter(g => g.status === "publicado");
  }, [grades]);

  const gradesFiltradas = useMemo(() => {
    if (!gradesPublicadas) return [];
    
    if (userType === "aluno" && turmaId) {
      return gradesPublicadas.filter(g => g.turmaId === turmaId);
    }
    
    if (userType === "professor" && professorId) {
      return gradesPublicadas.filter(g => 
        g.slots.some(s => s.professorId === professorId)
      );
    }
    
    return gradesPublicadas;
  }, [gradesPublicadas, userType, turmaId, professorId]);

  const minhasAulas = useMemo(() => {
    if (userType !== "professor" || !professorId || gradesFiltradas.length === 0) return [];
    
    const aulas: Array<{
      turmaId: string;
      turmaNome: string;
      diaSemana: DiaSemana;
      horarioId: string;
      materia: string;
      horarioInicio: string;
      horarioFim: string;
    }> = [];
    
    gradesFiltradas.forEach(grade => {
      grade.slots
        .filter(s => s.professorId === professorId)
        .forEach(slot => {
          const horario = HORARIOS_AULAS.find(h => h.id === slot.horarioId);
          aulas.push({
            turmaId: grade.turmaId,
            turmaNome: grade.turmaNome,
            diaSemana: slot.diaSemana,
            horarioId: slot.horarioId,
            materia: slot.materia,
            horarioInicio: horario?.inicio || "",
            horarioFim: horario?.fim || "",
          });
        });
    });
    
    return aulas;
  }, [gradesFiltradas, professorId, userType]);

  const getDayOfWeekName = (date: Date): DiaSemana | null => {
    const dayMap: Record<number, DiaSemana> = {
      1: "segunda",
      2: "terca",
      3: "quarta",
      4: "quinta",
      5: "sexta",
      6: "sabado",
    };
    return dayMap[date.getDay()] || null;
  };

  const aulasHoje = useMemo(() => {
    const diaHoje = getDayOfWeekName(new Date());
    if (!diaHoje) return [];
    
    if (userType === "professor") {
      return minhasAulas.filter(a => a.diaSemana === diaHoje);
    }
    
    if (userType === "aluno" && gradesFiltradas.length > 0) {
      const grade = gradesFiltradas[0];
      return grade.slots
        .filter(s => s.diaSemana === diaHoje)
        .map(slot => {
          const horario = HORARIOS_AULAS.find(h => h.id === slot.horarioId);
          return {
            ...slot,
            horarioInicio: horario?.inicio || "",
            horarioFim: horario?.fim || "",
          };
        })
        .sort((a, b) => a.horarioInicio.localeCompare(b.horarioInicio));
    }
    
    return [];
  }, [minhasAulas, gradesFiltradas, userType]);

  const exportToPDF = (grade: GradeHoraria) => {
    const pdf = new jsPDF({ orientation: "landscape" });
    
    pdf.setFontSize(18);
    pdf.text(`Meu Horário - ${grade.turmaNome}`, 14, 22);
    pdf.setFontSize(12);
    pdf.text(`Ano Letivo: ${grade.anoLetivo}`, 14, 30);
    
    const tableData: string[][] = [];
    
    HORARIOS_AULAS.forEach(horario => {
      const row = [`${horario.nome}\n${horario.inicio}-${horario.fim}`];
      DIAS_SEMANA.forEach(dia => {
        const slot = grade.slots.find(s => s.diaSemana === dia && s.horarioId === horario.id);
        row.push(slot ? `${slot.materia}\n${slot.professorNome}` : "");
      });
      tableData.push(row);
    });
    
    autoTable(pdf, {
      head: [["Horário", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [66, 66, 66] },
    });
    
    pdf.save(`meu-horario-${grade.turmaNome.replace(/\s+/g, "-")}.pdf`);
    
    toast({
      title: "PDF exportado!",
      description: "O arquivo foi baixado com sucesso.",
    });
  };

  const printGrade = (grade: GradeHoraria) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Meu Horário - ${grade.turmaNome}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #333; padding: 8px; text-align: center; }
          th { background: #333; color: white; }
          .slot { font-weight: bold; }
          .professor { font-size: 0.8em; color: #666; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Meu Horário - ${grade.turmaNome}</h1>
        <p style="text-align:center">Ano Letivo: ${grade.anoLetivo}</p>
        <table>
          <thead>
            <tr>
              <th>Horário</th>
              <th>Segunda</th>
              <th>Terça</th>
              <th>Quarta</th>
              <th>Quinta</th>
              <th>Sexta</th>
              <th>Sábado</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    HORARIOS_AULAS.forEach(horario => {
      html += `<tr><td>${horario.nome}<br><small>${horario.inicio}-${horario.fim}</small></td>`;
      DIAS_SEMANA.forEach(dia => {
        const slot = grade.slots.find(s => s.diaSemana === dia && s.horarioId === horario.id);
        html += `<td>${slot ? `<div class="slot">${slot.materia}</div><div class="professor">${slot.professorNome}</div>` : ""}</td>`;
      });
      html += "</tr>";
    });
    
    html += `</tbody></table></body></html>`;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  if (loadingGrades) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {userType === "professor" ? "Meus Horários" : "Meu Horário"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {userType === "professor" 
              ? "Visualize seus horários em todas as turmas"
              : `Turma: ${turmaNome || "Não definida"}`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchGrades()}
          data-testid="button-refresh-horarios"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {aulasHoje.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Aulas de Hoje - {format(new Date(), "EEEE, dd/MM", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {aulasHoje.map((aula, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary"
                  className="text-sm py-1.5 px-3"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  {aula.horarioInicio} - {aula.materia}
                  {userType === "professor" && (
                    <span className="ml-1 opacity-70">({(aula as any).turmaNome})</span>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {gradesFiltradas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">
              {userType === "professor" 
                ? "Nenhum horário atribuído"
                : "Grade horária não disponível"}
            </p>
            <p className="text-sm text-muted-foreground">
              {userType === "professor"
                ? "Você ainda não possui aulas atribuídas em nenhuma turma."
                : "A grade horária da sua turma ainda não foi publicada."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={gradesFiltradas[0]?.id}>
          {userType === "professor" && gradesFiltradas.length > 1 && (
            <TabsList className="mb-4">
              {gradesFiltradas.map(grade => (
                <TabsTrigger key={grade.id} value={grade.id}>
                  {grade.turmaNome}
                </TabsTrigger>
              ))}
            </TabsList>
          )}

          {gradesFiltradas.map(grade => (
            <TabsContent key={grade.id} value={grade.id}>
              <Card data-testid={`card-horario-${grade.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        {grade.turmaNome}
                      </CardTitle>
                      <CardDescription>
                        Ano letivo: {grade.anoLetivo} | {grade.slots.length} aulas por semana
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScheduleGrid 
                    slots={userType === "professor" && professorId
                      ? grade.slots.filter(s => s.professorId === professorId)
                      : grade.slots
                    } 
                    highlightProfessorId={userType === "professor" ? professorId : undefined}
                    showLegend
                  />
                </CardContent>
                <CardFooter className="flex justify-end gap-2 flex-wrap border-t pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToPDF(grade)}
                    data-testid={`button-export-pdf-${grade.id}`}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1" />
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => printGrade(grade)}
                    data-testid={`button-print-${grade.id}`}
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimir
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {userType === "professor" && minhasAulas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo Semanal</CardTitle>
            <CardDescription>
              Total de {minhasAulas.length} aulas em {Array.from(new Set(minhasAulas.map(a => a.turmaNome))).length} turma(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {DIAS_SEMANA.map(dia => {
                const aulasDia = minhasAulas.filter(a => a.diaSemana === dia);
                return (
                  <div 
                    key={dia}
                    className={cn(
                      "p-3 rounded-md border text-center",
                      aulasDia.length > 0 
                        ? "bg-primary/10 border-primary/30" 
                        : "bg-muted/30"
                    )}
                  >
                    <p className="text-sm font-medium">{DIAS_LABELS[dia]}</p>
                    <p className="text-2xl font-bold">{aulasDia.length}</p>
                    <p className="text-xs text-muted-foreground">aula(s)</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
