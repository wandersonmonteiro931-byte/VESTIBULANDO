import { useState } from "react";
import { where } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  GraduationCap, FileText, Printer, Eye, Lock, 
  CheckCircle, AlertCircle, Clock
} from "lucide-react";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import type { Boletim } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import "jspdf-autotable";

const PERIODOS_BIMESTRE = ["1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre"];
const PERIODOS_TRIMESTRE = ["1º Trimestre", "2º Trimestre", "3º Trimestre"];

export function AlunoBoletimTab() {
  const { userData } = useAuth();
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedBoletim, setSelectedBoletim] = useState<Boletim | null>(null);

  const { data: boletins, isLoading: loadingBoletins } = useRealtimeQuery<Boletim>({
    collectionName: "boletins",
    queryKey: ["/api/boletins/aluno", userData?.uid],
    constraints: userData?.uid ? [where("alunoId", "==", userData.uid)] : [],
    transform: (docs) => docs as Boletim[],
    enabled: !!userData?.uid,
  });

  const boletinsLiberados = boletins?.filter(b => b.liberado) || [];
  const boletinsNaoLiberados = boletins?.filter(b => !b.liberado) || [];

  const handlePrintBoletim = (boletim: Boletim) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("BOLETIM ESCOLAR", pageWidth / 2, yPos, { align: "center" });
    yPos += 10;

    doc.setFontSize(14);
    doc.text(boletim.escola || "Preparatório Vestibulando", pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS DO ALUNO", margin, yPos);
    yPos += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    doc.text(`Nome: ${boletim.alunoNome}`, margin, yPos);
    yPos += 6;
    doc.text(`Matrícula: ${boletim.alunoMatricula || "-"}`, margin, yPos);
    doc.text(`Turma: ${boletim.turmaNome}`, margin + 80, yPos);
    yPos += 6;
    doc.text(`Ano Letivo: ${boletim.anoLetivo}`, margin, yPos);
    doc.text(`Período: ${boletim.periodoTipo === "bimestre" ? "Bimestral" : "Trimestral"}`, margin + 80, yPos);
    yPos += 12;

    const periodos = boletim.periodos || (boletim.periodoTipo === "bimestre" ? PERIODOS_BIMESTRE : PERIODOS_TRIMESTRE);
    
    const tableHead = [["MATÉRIA", ...periodos, "MÉDIA", "MÉDIA ESP."]];
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
      styles: { 
        fontSize: 8, 
        cellPadding: 3,
        halign: "center"
      },
      headStyles: { 
        fillColor: [41, 128, 185], 
        textColor: 255,
        fontStyle: "bold"
      },
      columnStyles: {
        0: { halign: "left", cellWidth: 35 }
      },
      alternateRowStyles: { fillColor: [245, 248, 250] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 12;

    doc.setFillColor(245, 248, 250);
    doc.rect(margin, yPos - 4, pageWidth - 2 * margin, 28, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("RESUMO", margin + 5, yPos + 3);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    yPos += 10;
    doc.text(`Média Geral: ${boletim.mediaGeral?.toFixed(2) || "-"}`, margin + 5, yPos);
    doc.text(`Média Esperada: ${(boletim.mediaGeralEsperada || 7).toFixed(1)}`, margin + 60, yPos);
    
    const situacaoLabel = boletim.situacao.charAt(0).toUpperCase() + boletim.situacao.slice(1);
    const situacaoColor = boletim.situacao === "aprovado" ? [34, 139, 34] : 
                          boletim.situacao === "reprovado" ? [220, 20, 60] : [255, 165, 0];
    doc.setTextColor(...situacaoColor as [number, number, number]);
    doc.setFont("helvetica", "bold");
    doc.text(`Situação: ${situacaoLabel.toUpperCase()}`, margin + 115, yPos);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    
    yPos += 8;
    doc.text(`Presenças: ${boletim.presencas}`, margin + 5, yPos);
    doc.text(`Faltas: ${boletim.faltas}`, margin + 50, yPos);
    doc.text(`Frequência: ${boletim.percentualPresenca?.toFixed(1) || "-"}%`, margin + 90, yPos);
    yPos += 15;

    if (boletim.observacoes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("OBSERVAÇÕES", margin, yPos);
      yPos += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const obsLines = doc.splitTextToSize(boletim.observacoes, pageWidth - 2 * margin);
      doc.text(obsLines, margin, yPos);
      yPos += obsLines.length * 5 + 15;
    }

    yPos = Math.max(yPos + 10, 250);
    
    doc.setDrawColor(100, 100, 100);
    doc.line(margin, yPos, margin + 70, yPos);
    doc.setFontSize(9);
    doc.text("Assinatura do Professor", margin + 5, yPos + 6);

    doc.line(pageWidth - margin - 70, yPos, pageWidth - margin, yPos);
    doc.text("Assinatura da Coordenação", pageWidth - margin - 65, yPos + 6);

    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Documento gerado em: ${format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}`,
      pageWidth / 2,
      285,
      { align: "center" }
    );

    doc.save(`Boletim_${boletim.alunoNome.replace(/\s+/g, "_")}_${boletim.anoLetivo}.pdf`);
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
      <div className="flex items-center gap-2">
        <GraduationCap className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold">Meu Boletim Escolar</h2>
          <p className="text-sm text-muted-foreground">
            Visualize suas notas e situação acadêmica
          </p>
        </div>
      </div>

      {boletinsNaoLiberados.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-amber-800 dark:text-amber-200">
                Boletins Pendentes de Liberação
              </CardTitle>
            </div>
            <CardDescription className="text-amber-700 dark:text-amber-300">
              {boletinsNaoLiberados.length} boletim(ns) ainda não foram liberados pela diretoria
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {boletinsLiberados.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Nenhum boletim disponível</p>
            <p className="text-sm text-muted-foreground">
              Quando a diretoria liberar seu boletim, ele aparecerá aqui
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {boletinsLiberados.map(boletim => (
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
                  <Badge 
                    variant={getSituacaoBadgeVariant(boletim.situacao)}
                    className="flex items-center gap-1"
                  >
                    {getSituacaoIcon(boletim.situacao)}
                    {boletim.situacao.charAt(0).toUpperCase() + boletim.situacao.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Média Geral</p>
                    <p className="text-xl font-bold">{boletim.mediaGeral?.toFixed(2) || "-"}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Média Esperada</p>
                    <p className="text-xl font-bold">{(boletim.mediaGeralEsperada || 7).toFixed(1)}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Frequência</p>
                    <p className="text-xl font-bold">{boletim.percentualPresenca?.toFixed(1) || "-"}%</p>
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
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader className="border-b pb-4">
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
            <ScrollArea className="max-h-[65vh]">
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
                        <TableHead className="text-center font-bold">Média Esperada</TableHead>
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
                                {m.notas[p]?.toFixed(1) || "-"}
                              </TableCell>
                            ))}
                            <TableCell className={`text-center font-bold ${abaixoMedia ? "text-red-600" : "text-green-600"}`}>
                              {m.mediaFinal?.toFixed(1) || "-"}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {(m.mediaEsperada || 7).toFixed(1)}
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
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Média Geral</p>
                    <p className={`text-3xl font-bold ${
                      selectedBoletim.mediaGeral !== null && 
                      selectedBoletim.mediaGeral < (selectedBoletim.mediaGeralEsperada || 7) 
                        ? "text-red-600" : "text-green-600"
                    }`}>
                      {selectedBoletim.mediaGeral?.toFixed(2) || "-"}
                    </p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Média Esperada</p>
                    <p className="text-3xl font-bold">{(selectedBoletim.mediaGeralEsperada || 7).toFixed(1)}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Frequência</p>
                    <p className={`text-3xl font-bold ${
                      selectedBoletim.percentualPresenca !== null && 
                      selectedBoletim.percentualPresenca < 75 
                        ? "text-red-600" : "text-green-600"
                    }`}>
                      {selectedBoletim.percentualPresenca?.toFixed(1) || "-"}%
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

                {/* Rodapé com assinaturas */}
                <div className="grid grid-cols-2 gap-8 pt-8 mt-4 border-t">
                  <div className="text-center">
                    <div className="border-t border-dashed border-muted-foreground/50 pt-2 mt-8">
                      <p className="text-sm text-muted-foreground">Assinatura do Professor</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-dashed border-muted-foreground/50 pt-2 mt-8">
                      <p className="text-sm text-muted-foreground">Assinatura da Coordenação</p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="border-t pt-4 gap-2">
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
