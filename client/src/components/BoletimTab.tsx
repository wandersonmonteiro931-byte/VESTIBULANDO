import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { collection, addDoc, updateDoc, doc, where, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, FileText, Calendar, Eye, Edit, Trash2, Printer, 
  GraduationCap, Users, CheckCircle, Lock, Unlock, Download,
  ClipboardList, AlertCircle, Search
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import type { Boletim, BoletimNota, User, Turma, BoletimConfig } from "@shared/schema";
import { MATERIAS_BOLETIM } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";
import jsPDF from "jspdf";
import "jspdf-autotable";

const PERIODOS_BIMESTRE = ["1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre"];
const PERIODOS_TRIMESTRE = ["1º Trimestre", "2º Trimestre", "3º Trimestre"];

export function BoletimTab() {
  const { userData } = useAuth();
  const { toast } = useToast();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [selectedBoletim, setSelectedBoletim] = useState<Boletim | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTurma, setFilterTurma] = useState<string>("todas");
  const [filterSituacao, setFilterSituacao] = useState<string>("todas");
  
  const [selectedAlunoId, setSelectedAlunoId] = useState("");
  const [selectedTurmaId, setSelectedTurmaId] = useState("");
  const [anoLetivo, setAnoLetivo] = useState(new Date().getFullYear().toString());
  const [periodoTipo, setPeriodoTipo] = useState<"bimestre" | "trimestre">("bimestre");
  const [materiasNotas, setMateriasNotas] = useState<BoletimNota[]>([]);
  const [presencas, setPresencas] = useState(0);
  const [faltas, setFaltas] = useState(0);
  const [observacoes, setObservacoes] = useState("");
  const [situacao, setSituacao] = useState<"cursando" | "aprovado" | "reprovado">("cursando");

  const { data: turmas } = useRealtimeQuery<Turma>({
    collectionName: "turmas",
    queryKey: ["/api/turmas"],
    transform: (docs) => docs as Turma[],
  });

  const { data: alunos } = useRealtimeQuery<User>({
    collectionName: "usuarios",
    queryKey: ["/api/usuarios/alunos"],
    constraints: [where("tipo", "==", "aluno"), where("status", "==", "aprovado")],
    transform: (docs) => docs as User[],
  });

  const { data: boletins, isLoading: loadingBoletins } = useRealtimeQuery<Boletim>({
    collectionName: "boletins",
    queryKey: ["/api/boletins"],
    transform: (docs) => docs as Boletim[],
  });

  const { data: boletimConfigs } = useRealtimeQuery<BoletimConfig>({
    collectionName: "boletimConfigs",
    queryKey: ["/api/boletim-configs"],
    transform: (docs) => docs as BoletimConfig[],
  });

  const periodos = periodoTipo === "bimestre" ? PERIODOS_BIMESTRE : PERIODOS_TRIMESTRE;

  const filteredBoletins = useMemo(() => {
    if (!boletins) return [];
    return boletins.filter(b => {
      const matchSearch = b.alunoNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         b.turmaNome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTurma = filterTurma === "todas" || b.turmaId === filterTurma;
      const matchSituacao = filterSituacao === "todas" || b.situacao === filterSituacao;
      return matchSearch && matchTurma && matchSituacao;
    });
  }, [boletins, searchTerm, filterTurma, filterSituacao]);

  const initializeMateriasNotas = () => {
    const materias: BoletimNota[] = MATERIAS_BOLETIM.map(materia => ({
      materia,
      notas: Object.fromEntries(periodos.map(p => [p, null])),
      mediaFinal: null,
      mediaEsperada: 7,
    }));
    setMateriasNotas(materias);
  };

  const calcularMediaMateria = (notas: Record<string, number | null>): number | null => {
    const valores = Object.values(notas).filter((n): n is number => n !== null);
    if (valores.length === 0) return null;
    return valores.reduce((a, b) => a + b, 0) / valores.length;
  };

  const calcularMediaGeral = (materias: BoletimNota[]): number | null => {
    const medias = materias
      .map(m => m.mediaFinal)
      .filter((m): m is number => m !== null);
    if (medias.length === 0) return null;
    return medias.reduce((a, b) => a + b, 0) / medias.length;
  };

  const handleNotaChange = (materiaIndex: number, periodo: string, valor: string) => {
    const novaNotas = [...materiasNotas];
    const nota = valor === "" ? null : parseFloat(valor);
    novaNotas[materiaIndex].notas[periodo] = nota;
    novaNotas[materiaIndex].mediaFinal = calcularMediaMateria(novaNotas[materiaIndex].notas);
    setMateriasNotas(novaNotas);
  };

  const openCreateDialog = () => {
    setSelectedAlunoId("");
    setSelectedTurmaId("");
    setAnoLetivo(new Date().getFullYear().toString());
    setPeriodoTipo("bimestre");
    initializeMateriasNotas();
    setPresencas(0);
    setFaltas(0);
    setObservacoes("");
    setSituacao("cursando");
    setCreateDialogOpen(true);
  };

  const openEditDialog = (boletim: Boletim) => {
    setSelectedBoletim(boletim);
    setSelectedAlunoId(boletim.alunoId);
    setSelectedTurmaId(boletim.turmaId || "");
    setAnoLetivo(boletim.anoLetivo);
    setPeriodoTipo(boletim.periodoTipo);
    setMateriasNotas(boletim.materias);
    setPresencas(boletim.presencas);
    setFaltas(boletim.faltas);
    setObservacoes(boletim.observacoes || "");
    setSituacao(boletim.situacao);
    setEditDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!userData) throw new Error("Usuário não autenticado");
      if (!selectedAlunoId) throw new Error("Selecione um aluno");
      if (!selectedTurmaId) throw new Error("Selecione uma turma");

      const aluno = alunos?.find(a => a.uid === selectedAlunoId);
      const turma = turmas?.find(t => t.id === selectedTurmaId);
      
      if (!aluno || !turma) throw new Error("Aluno ou turma não encontrados");

      const mediaGeral = calcularMediaGeral(materiasNotas);
      const percentualPresenca = (presencas + faltas) > 0 
        ? (presencas / (presencas + faltas)) * 100 
        : null;

      const boletimData: any = {
        alunoId: selectedAlunoId,
        alunoNome: aluno.nome,
        alunoMatricula: aluno.matricula,
        escola: "Preparatório Vestibulando",
        turmaId: selectedTurmaId,
        turmaNome: turma.nome,
        anoLetivo,
        periodoTipo,
        periodos,
        materias: materiasNotas,
        mediaGeral,
        mediaGeralEsperada: 7,
        situacao,
        presencas,
        faltas,
        percentualPresenca,
        observacoes,
        liberado: false,
        criadoPor: userData.uid,
        criadoPorNome: userData.nome,
        dataCriacao: getNowBrasiliaISO(),
      };

      await addDoc(collection(db, "boletins"), boletimData);
      return boletimData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boletins"] });
      toast({
        title: "Boletim criado!",
        description: "O boletim foi criado com sucesso.",
      });
      setCreateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar boletim",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!userData || !selectedBoletim) throw new Error("Erro ao atualizar");

      const mediaGeral = calcularMediaGeral(materiasNotas);
      const percentualPresenca = (presencas + faltas) > 0 
        ? (presencas / (presencas + faltas)) * 100 
        : null;

      const boletimData: any = {
        materias: materiasNotas,
        mediaGeral,
        situacao,
        presencas,
        faltas,
        percentualPresenca,
        observacoes,
        dataAtualizacao: getNowBrasiliaISO(),
      };

      await updateDoc(doc(db, "boletins", selectedBoletim.id), boletimData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boletins"] });
      toast({
        title: "Boletim atualizado!",
        description: "As alterações foram salvas.",
      });
      setEditDialogOpen(false);
      setSelectedBoletim(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleReleaseMutation = useMutation({
    mutationFn: async ({ boletimId, liberar }: { boletimId: string; liberar: boolean }) => {
      if (!userData) throw new Error("Usuário não autenticado");

      const updateData: any = {
        liberado: liberar,
        dataAtualizacao: getNowBrasiliaISO(),
      };

      if (liberar) {
        updateData.liberadoEm = getNowBrasiliaISO();
        updateData.liberadoPor = userData.uid;
        updateData.liberadoPorNome = userData.nome;
      }

      await updateDoc(doc(db, "boletins", boletimId), updateData);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/boletins"] });
      toast({
        title: variables.liberar ? "Boletim liberado!" : "Boletim bloqueado!",
        description: variables.liberar 
          ? "O aluno pode visualizar o boletim agora." 
          : "O boletim não está mais visível para o aluno.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (boletimId: string) => {
      await deleteDoc(doc(db, "boletins", boletimId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boletins"] });
      toast({
        title: "Boletim excluído",
        description: "O boletim foi removido do sistema.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePrintBoletim = (boletim: Boletim) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("BOLETIM ESCOLAR", pageWidth / 2, yPos, { align: "center" });
    yPos += 8;

    doc.setFontSize(12);
    doc.text(boletim.escola || "Preparatório Vestibulando", pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    doc.text(`Aluno: ${boletim.alunoNome}`, margin, yPos);
    doc.text(`Matrícula: ${boletim.alunoMatricula || "-"}`, pageWidth - margin - 50, yPos);
    yPos += 6;
    
    doc.text(`Turma: ${boletim.turmaNome}`, margin, yPos);
    doc.text(`Ano Letivo: ${boletim.anoLetivo}`, pageWidth - margin - 50, yPos);
    yPos += 10;

    const periodos = boletim.periodos || (boletim.periodoTipo === "bimestre" ? PERIODOS_BIMESTRE : PERIODOS_TRIMESTRE);
    
    const tableHead = [["Matéria", ...periodos, "Média Final", "Média Esperada"]];
    const tableBody = boletim.materias.map(m => [
      m.materia,
      ...periodos.map(p => m.notas[p]?.toFixed(1) || "-"),
      m.mediaFinal?.toFixed(1) || "-",
      (m.mediaEsperada || 7).toFixed(1),
    ]);

    (doc as any).autoTable({
      startY: yPos,
      head: tableHead,
      body: tableBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    doc.setFont("helvetica", "bold");
    doc.text(`Média Geral: ${boletim.mediaGeral?.toFixed(2) || "-"}`, margin, yPos);
    doc.text(`Situação: ${boletim.situacao.toUpperCase()}`, pageWidth - margin - 50, yPos);
    yPos += 8;

    doc.setFont("helvetica", "normal");
    doc.text(`Presenças: ${boletim.presencas}`, margin, yPos);
    doc.text(`Faltas: ${boletim.faltas}`, margin + 50, yPos);
    doc.text(`Frequência: ${boletim.percentualPresenca?.toFixed(1) || "-"}%`, margin + 100, yPos);
    yPos += 10;

    if (boletim.observacoes) {
      doc.setFont("helvetica", "bold");
      doc.text("Observações:", margin, yPos);
      yPos += 5;
      doc.setFont("helvetica", "normal");
      const obsLines = doc.splitTextToSize(boletim.observacoes, pageWidth - 2 * margin);
      doc.text(obsLines, margin, yPos);
      yPos += obsLines.length * 5 + 10;
    }

    yPos = Math.max(yPos, 250);
    doc.line(margin, yPos, margin + 60, yPos);
    doc.text("Assinatura do Professor", margin, yPos + 5);

    doc.line(pageWidth - margin - 60, yPos, pageWidth - margin, yPos);
    doc.text("Assinatura da Coordenação", pageWidth - margin - 60, yPos + 5);

    doc.setFontSize(8);
    doc.text(
      `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      pageWidth / 2,
      285,
      { align: "center" }
    );

    doc.save(`boletim_${boletim.alunoNome.replace(/\s+/g, "_")}_${boletim.anoLetivo}.pdf`);
  };

  const alunosDaTurma = useMemo(() => {
    if (!selectedTurmaId || !alunos) return [];
    return alunos.filter(a => a.turma === selectedTurmaId);
  }, [selectedTurmaId, alunos]);

  const stats = useMemo(() => ({
    total: boletins?.length || 0,
    liberados: boletins?.filter(b => b.liberado).length || 0,
    aprovados: boletins?.filter(b => b.situacao === "aprovado").length || 0,
    reprovados: boletins?.filter(b => b.situacao === "reprovado").length || 0,
    cursando: boletins?.filter(b => b.situacao === "cursando").length || 0,
  }), [boletins]);

  const renderBoletimForm = () => (
    <div className="overflow-y-auto max-h-[60vh] pr-2">
      <div className="space-y-6">
        {!selectedBoletim && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Turma</Label>
              <Select value={selectedTurmaId} onValueChange={setSelectedTurmaId}>
                <SelectTrigger data-testid="select-turma-boletim">
                  <SelectValue placeholder="Selecione a turma" />
                </SelectTrigger>
                <SelectContent>
                  {turmas?.filter(t => t.ativa).map(turma => (
                    <SelectItem key={turma.id} value={turma.id}>{turma.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Aluno</Label>
              <Select value={selectedAlunoId} onValueChange={setSelectedAlunoId} disabled={!selectedTurmaId}>
                <SelectTrigger data-testid="select-aluno-boletim">
                  <SelectValue placeholder={selectedTurmaId ? "Selecione o aluno" : "Selecione a turma primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {alunosDaTurma.map(aluno => (
                    <SelectItem key={aluno.uid} value={aluno.uid}>{aluno.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ano Letivo</Label>
              <Input 
                value={anoLetivo} 
                onChange={(e) => setAnoLetivo(e.target.value)}
                placeholder="2025"
                data-testid="input-ano-letivo"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Período</Label>
              <Select value={periodoTipo} onValueChange={(v: "bimestre" | "trimestre") => {
                setPeriodoTipo(v);
                initializeMateriasNotas();
              }}>
                <SelectTrigger data-testid="select-periodo-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bimestre">Bimestral</SelectItem>
                  <SelectItem value="trimestre">Trimestral</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-lg font-semibold">Notas por Matéria</Label>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Matéria</TableHead>
                  {periodos.map(p => (
                    <TableHead key={p} className="text-center w-24">{p}</TableHead>
                  ))}
                  <TableHead className="text-center w-24">Média</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materiasNotas.map((materia, idx) => (
                  <TableRow key={materia.materia}>
                    <TableCell className="font-medium">{materia.materia}</TableCell>
                    {periodos.map(p => (
                      <TableCell key={p} className="p-1">
                        <Input
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          className="w-full text-center h-8"
                          value={materia.notas[p] ?? ""}
                          onChange={(e) => handleNotaChange(idx, p, e.target.value)}
                          data-testid={`input-nota-${idx}-${p}`}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-semibold">
                      {materia.mediaFinal?.toFixed(1) || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Presenças</Label>
            <Input 
              type="number" 
              min="0" 
              value={presencas}
              onChange={(e) => setPresencas(parseInt(e.target.value) || 0)}
              data-testid="input-presencas"
            />
          </div>
          <div className="space-y-2">
            <Label>Faltas</Label>
            <Input 
              type="number" 
              min="0" 
              value={faltas}
              onChange={(e) => setFaltas(parseInt(e.target.value) || 0)}
              data-testid="input-faltas"
            />
          </div>
          <div className="space-y-2">
            <Label>Situação</Label>
            <Select value={situacao} onValueChange={(v: "cursando" | "aprovado" | "reprovado") => setSituacao(v)}>
              <SelectTrigger data-testid="select-situacao">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cursando">Cursando</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="reprovado">Reprovado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea 
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Observações sobre o desempenho do aluno..."
            rows={3}
            data-testid="input-observacoes"
          />
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Média Geral</p>
              <p className="text-2xl font-bold">
                {calcularMediaGeral(materiasNotas)?.toFixed(2) || "-"}
              </p>
            </div>
            <div>
              <p className="font-medium">Frequência</p>
              <p className="text-2xl font-bold">
                {(presencas + faltas) > 0 
                  ? ((presencas / (presencas + faltas)) * 100).toFixed(1) + "%" 
                  : "-"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            Boletins Escolares
          </h2>
          <p className="text-muted-foreground">Gerencie os boletins dos alunos</p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-create-boletim">
          <Plus className="h-4 w-4 mr-2" />
          Novo Boletim
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Liberados</CardTitle>
            <Unlock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.liberados}</div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovados</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.aprovados}</div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reprovados</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.reprovados}</div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cursando</CardTitle>
            <Users className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.cursando}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por aluno ou turma..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-boletim"
            />
          </div>
        </div>
        <Select value={filterTurma} onValueChange={setFilterTurma}>
          <SelectTrigger className="w-[180px]" data-testid="filter-turma">
            <SelectValue placeholder="Filtrar por turma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as turmas</SelectItem>
            {turmas?.filter(t => t.ativa).map(turma => (
              <SelectItem key={turma.id} value={turma.id}>{turma.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSituacao} onValueChange={setFilterSituacao}>
          <SelectTrigger className="w-[180px]" data-testid="filter-situacao">
            <SelectValue placeholder="Filtrar por situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="cursando">Cursando</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="reprovado">Reprovado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loadingBoletins ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : filteredBoletins.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <GraduationCap className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Nenhum boletim encontrado</p>
            <p className="text-sm text-muted-foreground">Crie um novo boletim para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredBoletins.map(boletim => (
            <Card key={boletim.id} className="hover-elevate" data-testid={`card-boletim-${boletim.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <GraduationCap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{boletim.alunoNome}</CardTitle>
                      <CardDescription>
                        {boletim.turmaNome} | Ano: {boletim.anoLetivo}
                        {boletim.alunoMatricula && ` | Matrícula: ${boletim.alunoMatricula}`}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={boletim.liberado ? "default" : "secondary"}>
                      {boletim.liberado ? "Liberado" : "Não liberado"}
                    </Badge>
                    <Badge variant={
                      boletim.situacao === "aprovado" ? "default" :
                      boletim.situacao === "reprovado" ? "destructive" : "secondary"
                    }>
                      {boletim.situacao.charAt(0).toUpperCase() + boletim.situacao.slice(1)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium">Média Geral:</span>{" "}
                    <span className="font-bold text-foreground">{boletim.mediaGeral?.toFixed(2) || "-"}</span>
                  </div>
                  <div>
                    <span className="font-medium">Frequência:</span>{" "}
                    <span className="font-bold text-foreground">{boletim.percentualPresenca?.toFixed(1) || "-"}%</span>
                  </div>
                  <div>
                    <span className="font-medium">Presenças/Faltas:</span>{" "}
                    <span className="font-bold text-foreground">{boletim.presencas}/{boletim.faltas}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => { setSelectedBoletim(boletim); setViewDialogOpen(true); }}>
                  <Eye className="h-4 w-4 mr-1" />
                  Ver
                </Button>
                <Button variant="outline" size="sm" onClick={() => openEditDialog(boletim)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button variant="outline" size="sm" onClick={() => handlePrintBoletim(boletim)}>
                  <Printer className="h-4 w-4 mr-1" />
                  Imprimir
                </Button>
                <Button 
                  variant={boletim.liberado ? "secondary" : "default"} 
                  size="sm"
                  onClick={() => toggleReleaseMutation.mutate({ boletimId: boletim.id, liberar: !boletim.liberado })}
                  disabled={toggleReleaseMutation.isPending}
                >
                  {boletim.liberado ? <Lock className="h-4 w-4 mr-1" /> : <Unlock className="h-4 w-4 mr-1" />}
                  {boletim.liberado ? "Bloquear" : "Liberar"}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm("Tem certeza que deseja excluir este boletim?")) {
                      deleteMutation.mutate(boletim.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Criação */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Novo Boletim</DialogTitle>
            <DialogDescription>Crie um novo boletim escolar para um aluno</DialogDescription>
          </DialogHeader>
          {renderBoletimForm()}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !selectedAlunoId}
              data-testid="button-save-boletim"
            >
              {createMutation.isPending ? "Salvando..." : "Criar Boletim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Editar Boletim</DialogTitle>
            <DialogDescription>
              {selectedBoletim && `${selectedBoletim.alunoNome} - ${selectedBoletim.turmaNome}`}
            </DialogDescription>
          </DialogHeader>
          {renderBoletimForm()}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              data-testid="button-update-boletim"
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Visualização */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Boletim Escolar</DialogTitle>
            <DialogDescription>
              {selectedBoletim && `${selectedBoletim.alunoNome} - ${selectedBoletim.turmaNome} - ${selectedBoletim.anoLetivo}`}
            </DialogDescription>
          </DialogHeader>
          
          {selectedBoletim && (
            <div className="overflow-y-auto max-h-[60vh] pr-2">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Aluno</p>
                    <p className="font-medium">{selectedBoletim.alunoNome}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Matrícula</p>
                    <p className="font-medium">{selectedBoletim.alunoMatricula || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Turma</p>
                    <p className="font-medium">{selectedBoletim.turmaNome}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Situação</p>
                    <Badge variant={
                      selectedBoletim.situacao === "aprovado" ? "default" :
                      selectedBoletim.situacao === "reprovado" ? "destructive" : "secondary"
                    }>
                      {selectedBoletim.situacao.charAt(0).toUpperCase() + selectedBoletim.situacao.slice(1)}
                    </Badge>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Matéria</TableHead>
                        {(selectedBoletim.periodos || PERIODOS_BIMESTRE).map(p => (
                          <TableHead key={p} className="text-center">{p}</TableHead>
                        ))}
                        <TableHead className="text-center">Média</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedBoletim.materias.map(m => (
                        <TableRow key={m.materia}>
                          <TableCell className="font-medium">{m.materia}</TableCell>
                          {(selectedBoletim.periodos || PERIODOS_BIMESTRE).map(p => (
                            <TableCell key={p} className="text-center">
                              {m.notas[p]?.toFixed(1) || "-"}
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-bold">
                            {m.mediaFinal?.toFixed(1) || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Média Geral</p>
                    <p className="text-2xl font-bold">{selectedBoletim.mediaGeral?.toFixed(2) || "-"}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Presenças/Faltas</p>
                    <p className="text-2xl font-bold">{selectedBoletim.presencas}/{selectedBoletim.faltas}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Frequência</p>
                    <p className="text-2xl font-bold">{selectedBoletim.percentualPresenca?.toFixed(1) || "-"}%</p>
                  </div>
                </div>

                {selectedBoletim.observacoes && (
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Observações</p>
                    <p className="text-sm">{selectedBoletim.observacoes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Fechar
            </Button>
            <Button onClick={() => selectedBoletim && handlePrintBoletim(selectedBoletim)}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
