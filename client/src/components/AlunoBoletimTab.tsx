import { useState, useMemo } from "react";
import { where } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  GraduationCap, FileText, Printer, Eye, 
  CheckCircle, AlertCircle, Clock, Search, Lock, Unlock
} from "lucide-react";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useBimestreStatus } from "@/hooks/useBimestreStatus";
import type { Boletim } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatNota } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PERIODOS_BIMESTRE = ["1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre"];
const PERIODOS_TRIMESTRE = ["1º Trimestre", "2º Trimestre", "3º Trimestre"];

export function AlunoBoletimTab() {
  const { userData } = useAuth();
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedBoletim, setSelectedBoletim] = useState<Boletim | null>(null);
  const [filterAno, setFilterAno] = useState<string>("todos");
  const [filterBimestre, setFilterBimestre] = useState<string>("todos");
  const [selectedAnoForStatus, setSelectedAnoForStatus] = useState(new Date().getFullYear().toString());

  const { data: boletins, isLoading: loadingBoletins } = useRealtimeQuery<Boletim>({
    collectionName: "boletins",
    queryKey: ["/api/boletins/aluno", userData?.uid],
    constraints: userData?.uid ? [where("alunoId", "==", userData.uid), where("liberado", "==", true)] : [],
    transform: (docs) => docs as Boletim[],
    enabled: !!userData?.uid,
  });

  const { 
    currentBimestre, 
    bimestresInfo, 
    getBimestreStatus 
  } = useBimestreStatus(selectedAnoForStatus);

  const anosDisponiveis = useMemo(() => {
    if (!boletins) return [];
    const anosSet = new Set(boletins.map(b => b.anoLetivo));
    const anos = Array.from(anosSet);
    return anos.sort((a, b) => parseInt(b) - parseInt(a));
  }, [boletins]);

  const { data: registrosAulaAoVivo } = useRealtimeQuery<any>({
    collectionName: "registrosPresencaChamada",
    queryKey: ["/api/registrosPresencaChamada/aluno", userData?.uid],
    constraints: userData?.uid ? [where("alunoId", "==", userData.uid)] : [],
    enabled: !!userData?.uid,
  });

  const { data: frequencias } = useRealtimeQuery<any>({
    collectionName: "frequencia",
    queryKey: ["/api/frequencia/aluno", userData?.uid],
    constraints: userData?.uid ? [where("alunoId", "==", userData.uid)] : [],
    enabled: !!userData?.uid,
  });

  const filteredBoletins = useMemo(() => {
    if (!boletins) return [];
    return boletins.filter(b => {
      const matchAno = filterAno === "todos" || b.anoLetivo === filterAno;
      
      let matchBimestre = true;
      if (filterBimestre !== "todos") {
        const bimestreKey = `${filterBimestre}º Bimestre`;
        matchBimestre = b.materias?.some(m => m.notas && m.notas[bimestreKey] !== null && m.notas[bimestreKey] !== undefined);
      }
      
      return matchAno && matchBimestre;
    });
  }, [boletins, filterAno, filterBimestre]);

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
    
    const tableHead = [["Matéria", ...periodos, "Média Final", "Média Mínima Esperada"]];
    const tableBody = boletim.materias.map(m => [
      m.materia,
      ...periodos.map(p => formatNota(m.notas[p])),
      formatNota(m.mediaFinal),
      formatNota(m.mediaEsperada || 7),
    ]);

    autoTable(doc, {
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
    doc.text(`Média Final Anual: ${formatNota(boletim.mediaGeral)}`, margin, yPos);
    doc.text(`Situação: ${boletim.situacao.toUpperCase()}`, pageWidth - margin - 50, yPos);
    yPos += 8;

    doc.setFont("helvetica", "normal");
    // Adicionar info sobre aulas ao vivo se houver
    const anoLetivo = boletim.anoLetivo;
    const presencasSistema = frequencias 
      ? frequencias.filter((f: any) => f.tipo === "presente" && f.data?.startsWith(anoLetivo)).length 
      : 0;
    
    const presencasAoVivo = registrosAulaAoVivo
      ? registrosAulaAoVivo.filter((p: any) => 
          (p.presente === true || p.status === "presente") &&
          (p.data || p.criadoEm)?.startsWith(anoLetivo)
        ).length
      : 0;

    const faltas = frequencias
      ? frequencias.filter((f: any) => (f.tipo === "ausente" || f.tipo === "justificada") && f.data?.startsWith(anoLetivo)).length
      : 0;

    const totalPresencas = presencasSistema + presencasAoVivo;
    const freqInfo = `Frequência: ${(totalPresencas + faltas) > 0 ? ((totalPresencas / (totalPresencas + faltas)) * 100).toFixed(1).replace(".", ",") + "%" : "-"}`;
    doc.text(`Presenças: ${totalPresencas}`, margin, yPos);
    doc.text(`Faltas: ${faltas}`, margin + 50, yPos);
    doc.text(freqInfo, margin + 100, yPos);
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
    const lineWidth = 70;
    const lineX = (pageWidth - lineWidth) / 2;
    doc.line(lineX, yPos, lineX + lineWidth, yPos);
    doc.text("Assinatura da Diretoria", pageWidth / 2, yPos + 5, { align: "center" });

    doc.setFontSize(8);
    doc.text(
      `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      pageWidth / 2,
      285,
      { align: "center" }
    );

    doc.save(`boletim_${boletim.alunoNome.replace(/\s+/g, "_")}_${boletim.anoLetivo}.pdf`);
  };

  const getSituacaoBadgeVariant = (situacao: string) => {
    switch (situacao) {
      case "aprovado": return "default";
      case "reprovado": return "destructive";
      default: return "secondary";
    }
  };

  const getSituacaoIcon = (situacao: string) => {
    switch (situacao) {
      case "aprovado": return <CheckCircle className="h-4 w-4" />;
      case "reprovado": return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (loadingBoletins) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold">Meu Boletim Escolar</h2>
            <p className="text-sm text-muted-foreground">
              Visualize suas notas e situação acadêmica
            </p>
          </div>
        </div>
      </div>

      {boletins && boletins.length > 0 && (
        <div className="flex flex-wrap gap-4 items-center">
          <Select value={filterAno} onValueChange={(value) => {
            setFilterAno(value);
            if (value !== "todos") {
              setSelectedAnoForStatus(value);
            }
          }}>
            <SelectTrigger className="w-[160px]" data-testid="filter-ano-aluno">
              <SelectValue placeholder="Filtrar por ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os anos</SelectItem>
              {anosDisponiveis.map(ano => (
                <SelectItem key={ano} value={ano}>{ano}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterBimestre} onValueChange={setFilterBimestre}>
            <SelectTrigger className="w-[180px]" data-testid="filter-bimestre-aluno">
              <SelectValue placeholder="Filtrar por bimestre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os bimestres</SelectItem>
              <SelectItem value="1">1º Bimestre</SelectItem>
              <SelectItem value="2">2º Bimestre</SelectItem>
              <SelectItem value="3">3º Bimestre</SelectItem>
              <SelectItem value="4">4º Bimestre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {(!boletins || boletins.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Nenhum boletim disponível</p>
            <p className="text-sm text-muted-foreground">
              Quando a diretoria liberar seu boletim, ele aparecerá aqui
            </p>
          </CardContent>
        </Card>
      ) : filteredBoletins.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Nenhum boletim encontrado</p>
            <p className="text-sm text-muted-foreground">
              Ajuste os filtros para ver seus boletins
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredBoletins.map(boletim => (
            <Card key={boletim.id} className="hover-elevate" data-testid={`card-boletim-aluno-${boletim.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <GraduationCap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Boletim {boletim.anoLetivo}</CardTitle>
                      <CardDescription>
                        {boletim.turmaNome} | {boletim.periodoTipo === "bimestre" ? "Bimestral" : "Trimestral"}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const bimNum = boletim.bimestreNumero || 1;
                      const bimestreStatus = getBimestreStatus(bimNum);
                      
                      let statusBadgeVariant: "default" | "secondary" | "outline" = "secondary";
                      let statusIcon = <Unlock className="h-3 w-3" />;
                      let statusText = "Liberado";
                      
                      if (bimestreStatus.status === "fechado") {
                        statusBadgeVariant = "secondary";
                        statusIcon = <Lock className="h-3 w-3" />;
                        statusText = "Encerrado";
                      } else if (bimestreStatus.status === "em_andamento") {
                        statusBadgeVariant = "default";
                        statusIcon = <Clock className="h-3 w-3" />;
                        statusText = "Em andamento";
                      }
                      
                      return (
                        <>
                          <Badge variant="outline" className="bg-primary/10 border-primary text-primary">
                            {bimNum}º Bimestre
                          </Badge>
                          <Badge 
                            variant={getSituacaoBadgeVariant(boletim.situacao)}
                            className="flex items-center gap-1"
                          >
                            {getSituacaoIcon(boletim.situacao)}
                            {boletim.situacao.charAt(0).toUpperCase() + boletim.situacao.slice(1)}
                          </Badge>
                          <Badge variant={statusBadgeVariant} className="flex items-center gap-1">
                            {statusIcon}
                            {statusText}
                          </Badge>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Média Anual</p>
                    <p className="text-xl font-bold">{formatNota(boletim.mediaGeral)}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Média Mínima Esperada</p>
                    <p className="text-xl font-bold">{formatNota(boletim.mediaGeralEsperada || 7)}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Frequência</p>
                    <p className="text-xl font-bold">{boletim.percentualPresenca !== null && boletim.percentualPresenca !== undefined ? boletim.percentualPresenca.toFixed(1).replace(".", ",") + "%" : "-"}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Presenças/Faltas</p>
                    <p className="text-xl font-bold">{boletim.presencas}/{boletim.faltas}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => { setSelectedBoletim(boletim); setViewDialogOpen(true); }}
                    data-testid={`button-view-boletim-${boletim.id}`}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Detalhes
                  </Button>
                  <Button onClick={() => handlePrintBoletim(boletim)} data-testid={`button-print-boletim-${boletim.id}`}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Visualização Detalhada */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b pb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Boletim Escolar</DialogTitle>
                <DialogDescription>
                  {selectedBoletim && `${selectedBoletim.escola || "Preparatório Vestibulando"} - ${selectedBoletim.anoLetivo}`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          {selectedBoletim && (
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-6 pr-4 py-4">
                {/* Dados do Aluno */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Aluno</p>
                    <p className="font-semibold">{selectedBoletim.alunoNome}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Matrícula</p>
                    <p className="font-semibold">{selectedBoletim.alunoMatricula || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Turma</p>
                    <p className="font-semibold">{selectedBoletim.turmaNome}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Situação</p>
                    <Badge 
                      variant={getSituacaoBadgeVariant(selectedBoletim.situacao)}
                      className="mt-1"
                    >
                      {selectedBoletim.situacao.charAt(0).toUpperCase() + selectedBoletim.situacao.slice(1)}
                    </Badge>
                  </div>
                </div>

                {/* Tabela de Notas */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-primary/5">
                        <TableHead className="font-bold">Matéria</TableHead>
                        {(selectedBoletim.periodos || PERIODOS_BIMESTRE).map(p => (
                          <TableHead key={p} className="text-center font-bold">{p}</TableHead>
                        ))}
                        <TableHead className="text-center font-bold bg-primary/10">Média Final</TableHead>
                        <TableHead className="text-center font-bold">Média Mínima Esperada</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedBoletim.materias.map((m, idx) => {
                        const abaixoMedia = m.mediaFinal !== null && m.mediaFinal < (m.mediaEsperada || 7);
                        return (
                          <TableRow key={m.materia} className={idx % 2 === 0 ? "bg-muted/30" : ""}>
                            <TableCell className="font-medium">{m.materia}</TableCell>
                            {(selectedBoletim.periodos || PERIODOS_BIMESTRE).map(p => (
                              <TableCell key={p} className="text-center">
                                {formatNota(m.notas[p])}
                              </TableCell>
                            ))}
                            <TableCell className={`text-center font-bold ${abaixoMedia ? "text-red-600" : "text-green-600"}`}>
                              {formatNota(m.mediaFinal)}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {formatNota(m.mediaEsperada || 7)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Resumo */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-primary/5 rounded-lg text-center border border-primary/10">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Média Anual</p>
                    <p className={`text-3xl font-bold ${
                      selectedBoletim.mediaGeral !== null && 
                      selectedBoletim.mediaGeral < (selectedBoletim.mediaGeralEsperada || 7) 
                        ? "text-red-600" : "text-green-600"
                    }`}>
                      {formatNota(selectedBoletim.mediaGeral)}
                    </p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Média Mínima Esperada</p>
                    <p className="text-3xl font-bold">{formatNota(selectedBoletim.mediaGeralEsperada || 7)}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Frequência</p>
                    <p className={`text-3xl font-bold ${
                      selectedBoletim.percentualPresenca !== null && 
                      selectedBoletim.percentualPresenca < 75 
                        ? "text-red-600" : "text-green-600"
                    }`}>
                      {selectedBoletim.percentualPresenca !== null && selectedBoletim.percentualPresenca !== undefined ? selectedBoletim.percentualPresenca.toFixed(1).replace(".", ",") + "%" : "-"}
                    </p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Presenças / Faltas</p>
                    <p className="text-3xl font-bold">{selectedBoletim.presencas}/{selectedBoletim.faltas}</p>
                  </div>
                </div>

                {/* Observações */}
                {selectedBoletim.observacoes && (
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <p className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Observações</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedBoletim.observacoes}</p>
                  </div>
                )}

                {/* Rodapé com assinatura */}
                <div className="flex justify-center pt-8 mt-4 border-t">
                  <div className="text-center">
                    <div className="border-t border-dashed border-muted-foreground/50 pt-2 mt-8 w-64">
                      <p className="text-sm text-muted-foreground">Assinatura da Diretoria</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t pt-4 gap-2 flex-shrink-0">
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
