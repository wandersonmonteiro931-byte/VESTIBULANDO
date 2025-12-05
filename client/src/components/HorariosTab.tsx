import { useState, useMemo } from "react";
import { collection, addDoc, updateDoc, doc, deleteDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useToast } from "@/hooks/use-toast";
import { 
  DIAS_SEMANA, 
  HORARIOS_AULAS,
  MATERIAS_DISPONIVEIS,
  MATERIAS_SEM_PROFESSOR,
  type DiaSemana, 
  type SlotAula,
  type GradeHoraria,
  type ConfiguracaoMateria,
  type User,
  type HorarioAula,
  type MateriaCustomizada
} from "@shared/schema";
import { ScheduleGrid, SlotEditDialog, ScheduleViewCard } from "./ScheduleGrid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Wand2, 
  Calendar, 
  BookOpen, 
  Users, 
  Edit, 
  Trash2, 
  Save,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileSpreadsheet,
  Printer,
  History,
  Eye
} from "lucide-react";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface HorariosTabProps {
  turmas: any[];
  professores: User[];
}

export function HorariosTab({ turmas, professores }: HorariosTabProps) {
  const { userData } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("grades");
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<GradeHoraria | null>(null);
  const [editSlotDialog, setEditSlotDialog] = useState<{
    open: boolean;
    dia: DiaSemana;
    horarioId: string;
    existingSlot?: SlotAula;
  }>({ open: false, dia: "segunda", horarioId: "1" });
  const [tempSlots, setTempSlots] = useState<SlotAula[]>([]);
  const [configMaterias, setConfigMaterias] = useState<ConfiguracaoMateria[]>([]);
  const [autoGenDialogOpen, setAutoGenDialogOpen] = useState(false);
  const [autoGenerating, setSaving] = useState(false);
  const [viewGradeDialog, setViewGradeDialog] = useState<GradeHoraria | null>(null);

  const { data: grades, isLoading: loadingGrades, refetch: refetchGrades } = useRealtimeQuery<GradeHoraria>({
    collectionName: "gradesHorarias",
    queryKey: ["gradesHorarias"],
  });

  const { data: horariosConfig } = useRealtimeQuery<{ id: string; ativo?: boolean; horarios: HorarioAula[]; diasAtivos?: DiaSemana[] }>({
    collectionName: "configuracaoHorarios",
    queryKey: ["configuracaoHorarios"],
  });

  const horariosCustom = useMemo(() => {
    if (horariosConfig && horariosConfig.length > 0) {
      const activeConfig = horariosConfig.find(c => c.ativo) ?? horariosConfig[0];
      if (activeConfig.horarios && activeConfig.horarios.length > 0) {
        const activeHorarios = activeConfig.horarios.filter(h => h.ativo !== false);
        return [...activeHorarios].sort((a, b) => a.inicio.localeCompare(b.inicio));
      }
    }
    return HORARIOS_AULAS;
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

  const { data: materiasCustomizadas } = useRealtimeQuery<MateriaCustomizada>({
    collectionName: "materiasCustomizadas",
    queryKey: ["materiasCustomizadas"],
  });

  const todasMaterias = useMemo(() => {
    const materias = [...MATERIAS_DISPONIVEIS, ...MATERIAS_SEM_PROFESSOR];
    if (materiasCustomizadas && materiasCustomizadas.length > 0) {
      const customNomes = materiasCustomizadas.filter(m => m.ativo).map(m => m.nome);
      return [...materias, ...customNomes];
    }
    return materias;
  }, [materiasCustomizadas]);

  const DIAS_LABELS: Record<DiaSemana, string> = {
    domingo: "Domingo",
    segunda: "Segunda",
    terca: "Terça",
    quarta: "Quarta",
    quinta: "Quinta",
    sexta: "Sexta",
    sabado: "Sábado",
  };

  const selectedTurma = turmas.find(t => t.id === selectedTurmaId);
  
  const professoresFiltrados = useMemo(() => {
    return professores.filter(p => p.tipo === "professor" && p.materias && p.materias.length > 0);
  }, [professores]);

  const gradesFiltradas = useMemo(() => {
    if (!selectedTurmaId) return grades || [];
    return (grades || []).filter(g => g.turmaId === selectedTurmaId);
  }, [grades, selectedTurmaId]);

  const handleCreateGrade = () => {
    if (!selectedTurmaId || !selectedTurma) {
      toast({
        title: "Selecione uma turma",
        description: "Escolha uma turma para criar a grade horária.",
        variant: "destructive",
      });
      return;
    }

    const existingGrade = grades?.find(g => g.turmaId === selectedTurmaId && g.status === "rascunho");
    if (existingGrade) {
      setEditingGrade(existingGrade);
      setTempSlots(existingGrade.slots);
      setConfigMaterias(existingGrade.configMaterias);
    } else {
      setTempSlots([]);
      setConfigMaterias([]);
    }
    setCreateDialogOpen(true);
  };

  const handleSlotClick = (dia: DiaSemana, horarioId: string, existingSlot?: SlotAula) => {
    setEditSlotDialog({
      open: true,
      dia,
      horarioId,
      existingSlot,
    });
  };

  const handleSlotSave = (slotData: Omit<SlotAula, "diaSemana" | "horarioId">) => {
    const newSlot: SlotAula = {
      ...slotData,
      diaSemana: editSlotDialog.dia,
      horarioId: editSlotDialog.horarioId,
    };

    setTempSlots(prev => {
      const filtered = prev.filter(
        s => !(s.diaSemana === editSlotDialog.dia && s.horarioId === editSlotDialog.horarioId)
      );
      return [...filtered, newSlot];
    });
  };

  const handleSlotRemove = (dia: DiaSemana, horarioId: string) => {
    setTempSlots(prev => prev.filter(
      s => !(s.diaSemana === dia && s.horarioId === horarioId)
    ));
  };

  const checkProfessorConflict = (professorId: string): SlotAula | undefined => {
    const allGrades = grades || [];
    for (const grade of allGrades) {
      if (grade.id === editingGrade?.id) continue;
      const conflict = grade.slots.find(
        s => s.professorId === professorId && 
             s.diaSemana === editSlotDialog.dia && 
             s.horarioId === editSlotDialog.horarioId
      );
      if (conflict) return conflict;
    }
    
    return tempSlots.find(
      s => s.professorId === professorId && 
           s.diaSemana === editSlotDialog.dia && 
           s.horarioId === editSlotDialog.horarioId
    );
  };

  const handleSaveGrade = async (publish: boolean = false) => {
    if (!selectedTurma || !userData) return;

    setSaving(true);
    try {
      const gradeData: Partial<GradeHoraria> = {
        turmaId: selectedTurmaId,
        turmaNome: selectedTurma.nome,
        anoLetivo: selectedTurma.ano || new Date().getFullYear().toString(),
        configMaterias,
        slots: tempSlots,
        status: publish ? "publicado" : "rascunho",
        dataAtualizacao: getNowBrasiliaISO(),
        ...(publish && { dataPublicacao: getNowBrasiliaISO() }),
      };

      if (editingGrade) {
        await updateDoc(doc(db, "gradesHorarias", editingGrade.id), gradeData);
        toast({
          title: publish ? "Grade publicada!" : "Grade salva!",
          description: publish 
            ? "A grade horária foi publicada e está disponível para professores e alunos."
            : "As alterações foram salvas como rascunho.",
        });
      } else {
        await addDoc(collection(db, "gradesHorarias"), {
          ...gradeData,
          criadoPor: userData.uid,
          criadoPorNome: userData.nome,
          dataCriacao: getNowBrasiliaISO(),
          versao: 1,
        });
        toast({
          title: "Grade criada!",
          description: publish 
            ? "A grade horária foi criada e publicada."
            : "A grade horária foi criada como rascunho.",
        });
      }

      setCreateDialogOpen(false);
      setEditingGrade(null);
      refetchGrades();
    } catch (error) {
      console.error("Erro ao salvar grade:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a grade horária.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGrade = async (gradeId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta grade horária?")) return;

    try {
      await deleteDoc(doc(db, "gradesHorarias", gradeId));
      toast({
        title: "Grade excluída!",
        description: "A grade horária foi removida com sucesso.",
      });
      refetchGrades();
    } catch (error) {
      console.error("Erro ao excluir grade:", error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a grade horária.",
        variant: "destructive",
      });
    }
  };

  const handleAutoGenerate = async () => {
    if (configMaterias.length === 0) {
      toast({
        title: "Configure as matérias",
        description: "Adicione pelo menos uma matéria com professor antes de gerar automaticamente.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const newSlots: SlotAula[] = [];
      const professorSchedule: Record<string, Set<string>> = {};
      
      const shuffledConfigs = [...configMaterias].sort(() => Math.random() - 0.5);
      
      for (const config of shuffledConfigs) {
        let aulasAlocadas = 0;
        const diasShuffled = [...diasAtivos].sort(() => Math.random() - 0.5);
        
        for (const dia of diasShuffled) {
          if (aulasAlocadas >= config.aulasPorSemana) break;
          
          const horariosShuffled = [...horariosCustom].sort(() => Math.random() - 0.5);
          
          for (const horario of horariosShuffled) {
            if (aulasAlocadas >= config.aulasPorSemana) break;
            
            const slotKey = `${dia}-${horario.id}`;
            const profKey = `${config.professorId}-${slotKey}`;
            
            const slotOcupado = newSlots.some(
              s => s.diaSemana === dia && s.horarioId === horario.id
            );
            
            if (slotOcupado) continue;
            
            if (!professorSchedule[config.professorId]) {
              professorSchedule[config.professorId] = new Set();
            }
            
            if (professorSchedule[config.professorId].has(slotKey)) continue;
            
            const allGrades = grades || [];
            let hasConflict = false;
            for (const grade of allGrades) {
              if (grade.id === editingGrade?.id) continue;
              const conflict = grade.slots.find(
                s => s.professorId === config.professorId && 
                     s.diaSemana === dia && 
                     s.horarioId === horario.id
              );
              if (conflict) {
                hasConflict = true;
                break;
              }
            }
            
            if (hasConflict) continue;
            
            newSlots.push({
              diaSemana: dia,
              horarioId: horario.id,
              materia: config.materia,
              professorId: config.professorId,
              professorNome: config.professorNome,
            });
            
            professorSchedule[config.professorId].add(slotKey);
            aulasAlocadas++;
          }
        }
        
        if (aulasAlocadas < config.aulasPorSemana) {
          toast({
            title: "Aviso",
            description: `Não foi possível alocar todas as ${config.aulasPorSemana} aulas de ${config.materia}. Alocadas: ${aulasAlocadas}`,
            variant: "destructive",
          });
        }
      }
      
      setTempSlots(newSlots);
      setAutoGenDialogOpen(false);
      
      toast({
        title: "Grade gerada!",
        description: `${newSlots.length} aulas foram alocadas automaticamente.`,
      });
    } catch (error) {
      console.error("Erro na geração automática:", error);
      toast({
        title: "Erro na geração",
        description: "Não foi possível gerar a grade automaticamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addConfigMateria = (materia: string, professorId: string, aulasPorSemana: number) => {
    const isSemProfessor = !professorId || professorId === "";
    const professor = isSemProfessor ? null : professoresFiltrados.find(p => p.uid === professorId);
    
    if (!isSemProfessor && !professor) return;
    
    const existing = configMaterias.find(c => c.materia === materia);
    if (existing) {
      setConfigMaterias(prev => prev.map(c => 
        c.materia === materia 
          ? { ...c, professorId: professorId || "", professorNome: professor?.nome || "", aulasPorSemana }
          : c
      ));
    } else {
      setConfigMaterias(prev => [...prev, {
        materia,
        professorId: professorId || "",
        professorNome: professor?.nome || "",
        aulasPorSemana,
      }]);
    }
  };

  const removeConfigMateria = (materia: string) => {
    setConfigMaterias(prev => prev.filter(c => c.materia !== materia));
  };

  const exportToPDF = (grade: GradeHoraria) => {
    const pdf = new jsPDF({ orientation: "landscape" });
    
    pdf.setFontSize(18);
    pdf.text(`Grade Horária - ${grade.turmaNome}`, 14, 22);
    pdf.setFontSize(12);
    pdf.text(`Ano Letivo: ${grade.anoLetivo}`, 14, 30);
    
    const tableData: string[][] = [];
    
    horariosCustom.forEach(horario => {
      if (horario.tipo === "intervalo") {
        const row = [`${horario.nome}\n${horario.inicio}-${horario.fim}`];
        diasAtivos.forEach(() => {
          row.push("Intervalo");
        });
        tableData.push(row);
      } else {
        const row = [`${horario.nome}\n${horario.inicio}-${horario.fim}`];
        diasAtivos.forEach(dia => {
          const slot = grade.slots.find(s => s.diaSemana === dia && s.horarioId === horario.id);
          row.push(slot ? `${slot.materia}\n${slot.professorNome}` : "");
        });
        tableData.push(row);
      }
    });
    
    const headerRow = ["Horário", ...diasAtivos.map(dia => DIAS_LABELS[dia])];
    
    autoTable(pdf, {
      head: [headerRow],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [66, 66, 66] },
    });
    
    pdf.save(`grade-${grade.turmaNome.replace(/\s+/g, "-")}.pdf`);
    
    toast({
      title: "PDF exportado!",
      description: "O arquivo foi baixado com sucesso.",
    });
  };

  const printGrade = (grade: GradeHoraria) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    const headerCells = diasAtivos.map(dia => `<th>${DIAS_LABELS[dia]}</th>`).join('');
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Grade Horária - ${grade.turmaNome}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #333; padding: 8px; text-align: center; }
          th { background: #333; color: white; }
          .slot { font-weight: bold; }
          .professor { font-size: 0.8em; color: #666; }
          .intervalo { background: #f0f0f0; color: #666; font-style: italic; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <h1>Grade Horária - ${grade.turmaNome}</h1>
        <p style="text-align:center">Ano Letivo: ${grade.anoLetivo}</p>
        <table>
          <thead>
            <tr>
              <th>Horário</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>
    `;
    
    horariosCustom.forEach(horario => {
      if (horario.tipo === "intervalo") {
        html += `<tr class="intervalo"><td>${horario.nome}<br><small>${horario.inicio}-${horario.fim}</small></td>`;
        html += `<td colspan="${diasAtivos.length}" class="intervalo">Intervalo</td></tr>`;
      } else {
        html += `<tr><td>${horario.nome}<br><small>${horario.inicio}-${horario.fim}</small></td>`;
        diasAtivos.forEach(dia => {
          const slot = grade.slots.find(s => s.diaSemana === dia && s.horarioId === horario.id);
          html += `<td>${slot ? `<div class="slot">${slot.materia}</div><div class="professor">${slot.professorNome}</div>` : ""}</td>`;
        });
        html += "</tr>";
      }
    });
    
    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Grades Horárias
          </h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os horários de aulas das turmas
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedTurmaId} onValueChange={setSelectedTurmaId}>
            <SelectTrigger className="w-[200px]" data-testid="select-turma-filter">
              <SelectValue placeholder="Filtrar por turma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as turmas</SelectItem>
              {turmas.filter(t => t.ativa).map(turma => (
                <SelectItem key={turma.id} value={turma.id}>
                  {turma.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleCreateGrade} data-testid="button-create-grade">
            <Plus className="h-4 w-4 mr-2" />
            Nova Grade
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="grades" className="gap-2">
            <Calendar className="h-4 w-4" />
            Grades
          </TabsTrigger>
          <TabsTrigger value="visao-geral" className="gap-2">
            <Eye className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grades" className="mt-4">
          {loadingGrades ? (
            <div className="grid grid-cols-1 gap-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : gradesFiltradas.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {gradesFiltradas.map(grade => (
                <Card key={grade.id} data-testid={`card-grade-${grade.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <BookOpen className="h-5 w-5" />
                          {grade.turmaNome}
                        </CardTitle>
                        <CardDescription>
                          Ano letivo: {grade.anoLetivo} | {grade.slots.length} aulas configuradas
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={grade.status === "publicado" ? "default" : "secondary"}>
                          {grade.status === "publicado" ? "Publicado" : "Rascunho"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScheduleGrid 
                      slots={grade.slots} 
                      compact
                      showLegend={false}
                      horariosCustom={horariosCustom}
                    />
                  </CardContent>
                  <CardFooter className="flex justify-end gap-2 flex-wrap">
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingGrade(grade);
                        setTempSlots(grade.slots);
                        setConfigMaterias(grade.configMaterias);
                        setSelectedTurmaId(grade.turmaId);
                        setCreateDialogOpen(true);
                      }}
                      data-testid={`button-edit-grade-${grade.id}`}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    {grade.status === "rascunho" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditingGrade(grade);
                          setTempSlots(grade.slots);
                          handleSaveGrade(true);
                        }}
                        data-testid={`button-publish-grade-${grade.id}`}
                      >
                        Publicar
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteGrade(grade.id)}
                      data-testid={`button-delete-grade-${grade.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Nenhuma grade horária</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {selectedTurmaId 
                    ? "Esta turma ainda não possui grade horária cadastrada."
                    : "Selecione uma turma e crie a primeira grade horária."}
                </p>
                <Button onClick={handleCreateGrade} data-testid="button-create-first-grade">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Grade Horária
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="visao-geral" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Visão Geral dos Professores</CardTitle>
              <CardDescription>
                Resumo das aulas atribuídas a cada professor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Professor</TableHead>
                    <TableHead>Matérias</TableHead>
                    <TableHead className="text-center">Total de Aulas</TableHead>
                    <TableHead className="text-center">Turmas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {professoresFiltrados.map(professor => {
                    const aulasProf = (grades || []).flatMap(g => 
                      g.slots.filter(s => s.professorId === professor.uid)
                    );
                    const turmasProf = Array.from(new Set((grades || [])
                      .filter(g => g.slots.some(s => s.professorId === professor.uid))
                      .map(g => g.turmaNome)
                    ));
                    
                    return (
                      <TableRow key={professor.uid}>
                        <TableCell className="font-medium">{professor.nome}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {professor.materias?.map(m => (
                              <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge>{aulasProf.length}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {turmasProf.length > 0 ? turmasProf.join(", ") : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEditingGrade(null);
          setTempSlots([]);
          setConfigMaterias([]);
        }
        setCreateDialogOpen(open);
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-grade">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {editingGrade ? "Editar Grade Horária" : "Nova Grade Horária"}
            </DialogTitle>
            <DialogDescription>
              {selectedTurma?.nome || "Selecione uma turma"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {!editingGrade && (
              <div className="space-y-2">
                <Label>Turma</Label>
                <Select value={selectedTurmaId} onValueChange={setSelectedTurmaId}>
                  <SelectTrigger data-testid="select-turma-grade">
                    <SelectValue placeholder="Selecione a turma" />
                  </SelectTrigger>
                  <SelectContent>
                    {turmas.filter(t => t.ativa).map(turma => (
                      <SelectItem key={turma.id} value={turma.id}>
                        {turma.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Configuração de Matérias</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAutoGenDialogOpen(true)}
                    disabled={configMaterias.length === 0}
                    data-testid="button-auto-generate"
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Gerar Automaticamente
                  </Button>
                </div>
                <CardDescription>
                  Defina as matérias, professores e quantidade de aulas por semana
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {configMaterias.map((config, idx) => (
                    <div key={config.materia} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                      <Badge variant="secondary">{config.materia}</Badge>
                      <span className="text-sm text-muted-foreground">-</span>
                      <span className="text-sm">{config.professorNome}</span>
                      <span className="text-sm text-muted-foreground">-</span>
                      <Badge variant="outline">{config.aulasPorSemana} aulas/sem</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto h-6 w-6"
                        onClick={() => removeConfigMateria(config.materia)}
                        data-testid={`button-remove-config-${idx}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  <ConfigMateriaForm 
                    materias={todasMaterias}
                    professores={professoresFiltrados}
                    existingMaterias={configMaterias.map(c => c.materia)}
                    onAdd={addConfigMateria}
                    materiasCustomizadas={materiasCustomizadas || []}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Grade de Horários</CardTitle>
                <CardDescription>
                  Clique em um slot vazio para adicionar uma aula
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScheduleGrid
                  slots={tempSlots}
                  editable
                  onSlotClick={handleSlotClick}
                  onSlotRemove={handleSlotRemove}
                  professores={professoresFiltrados}
                  materias={todasMaterias}
                  horariosCustom={horariosCustom}
                />
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSaveGrade(false)}
              disabled={autoGenerating}
              data-testid="button-save-draft"
            >
              <Save className="h-4 w-4 mr-2" />
              Salvar Rascunho
            </Button>
            <Button
              onClick={() => handleSaveGrade(true)}
              disabled={autoGenerating || tempSlots.length === 0}
              data-testid="button-save-publish"
            >
              Salvar e Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SlotEditDialog
        open={editSlotDialog.open}
        onOpenChange={(open) => setEditSlotDialog(prev => ({ ...prev, open }))}
        dia={editSlotDialog.dia}
        horarioId={editSlotDialog.horarioId}
        existingSlot={editSlotDialog.existingSlot}
        professores={professoresFiltrados}
        materias={todasMaterias}
        materiasCustomizadas={materiasCustomizadas || []}
        onSave={handleSlotSave}
        onRemove={editSlotDialog.existingSlot ? () => handleSlotRemove(editSlotDialog.dia, editSlotDialog.horarioId) : undefined}
        conflictCheck={checkProfessorConflict}
        horariosCustom={horariosCustom}
      />

      <Dialog open={autoGenDialogOpen} onOpenChange={setAutoGenDialogOpen}>
        <DialogContent data-testid="dialog-auto-generate">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Gerar Grade Automaticamente
            </DialogTitle>
            <DialogDescription>
              O sistema tentará distribuir as aulas de forma equilibrada, respeitando:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Quantidade de aulas por matéria definida</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Disponibilidade dos professores</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Sem conflitos de horário entre turmas</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Distribuição equilibrada ao longo da semana</span>
            </div>

            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Esta ação substituirá todos os horários atuais. Você pode editar manualmente após a geração.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoGenDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAutoGenerate} disabled={autoGenerating}>
              {autoGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Gerar Grade
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ConfigMateriaFormProps {
  materias: readonly string[] | string[];
  professores: User[];
  existingMaterias: string[];
  onAdd: (materia: string, professorId: string, aulasPorSemana: number) => void;
  materiasCustomizadas: MateriaCustomizada[];
}

function materiaSemProfessor(materia: string, materiasCustomizadas: MateriaCustomizada[]): boolean {
  if (MATERIAS_SEM_PROFESSOR.includes(materia as any)) {
    return true;
  }
  const custom = materiasCustomizadas.find(m => m.nome === materia);
  return custom ? !custom.requerProfessor : false;
}

function ConfigMateriaForm({ materias, professores, existingMaterias, onAdd, materiasCustomizadas }: ConfigMateriaFormProps) {
  const [materia, setMateria] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [aulas, setAulas] = useState("4");

  const materiasDisponiveis = materias.filter(m => !existingMaterias.includes(m));
  const semProfessor = materia ? materiaSemProfessor(materia, materiasCustomizadas) : false;
  const professoresMateria = professorId 
    ? professores 
    : materia 
      ? professores.filter(p => p.materias?.includes(materia))
      : professores;

  const handleAdd = () => {
    if (!materia) return;
    if (semProfessor) {
      onAdd(materia, "", parseInt(aulas) || 4);
    } else {
      if (!professorId) return;
      onAdd(materia, professorId, parseInt(aulas) || 4);
    }
    setMateria("");
    setProfessorId("");
    setAulas("4");
  };

  const canAdd = materia && (semProfessor || professorId);

  return (
    <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
      <div className="flex-1 min-w-[150px]">
        <Label className="text-xs">Matéria</Label>
        <Select value={materia} onValueChange={(v) => {
          setMateria(v);
          setProfessorId("");
        }}>
          <SelectTrigger className="h-9" data-testid="select-new-materia">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {materiasDisponiveis.map(m => (
              <SelectItem key={m} value={m}>
                {m}
                {materiaSemProfessor(m, materiasCustomizadas) && (
                  <span className="ml-2 text-xs text-muted-foreground">(sem prof.)</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!semProfessor && (
        <div className="flex-1 min-w-[150px]">
          <Label className="text-xs">Professor</Label>
          <Select value={professorId} onValueChange={setProfessorId} disabled={!materia}>
            <SelectTrigger className="h-9" data-testid="select-new-professor">
              <SelectValue placeholder={materia ? "Selecione" : "Escolha a matéria"} />
            </SelectTrigger>
            <SelectContent>
              {professoresMateria.map(p => (
                <SelectItem key={p.uid} value={p.uid}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {semProfessor && materia && (
        <div className="flex-1 min-w-[150px] flex items-center">
          <span className="text-sm text-muted-foreground">Atividade sem professor</span>
        </div>
      )}
      <div className="w-24">
        <Label className="text-xs">Aulas/Sem</Label>
        <Input
          type="number"
          min="1"
          max="10"
          value={aulas}
          onChange={(e) => setAulas(e.target.value)}
          className="h-9"
          data-testid="input-aulas-semana"
        />
      </div>
      <Button 
        size="sm" 
        onClick={handleAdd} 
        disabled={!canAdd}
        data-testid="button-add-config"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
