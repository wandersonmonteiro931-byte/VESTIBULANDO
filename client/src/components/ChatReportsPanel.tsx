import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { ChatReport } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Eye, CheckCircle, Archive } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ChatReportsPanel() {
  const [reports, setReports] = useState<(ChatReport & { id: string })[]>([]);
  const [selectedReport, setSelectedReport] = useState<(ChatReport & { id: string }) | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [comentarioDiretor, setComentarioDiretor] = useState("");
  const [acaoTomada, setAcaoTomada] = useState("");
  const [loading, setLoading] = useState(false);
  const { userData } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!userData?.uid) return;

    const reportsRef = collection(db, "chat_reports");
    const q = query(reportsRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reportsData: (ChatReport & { id: string })[] = [];
      snapshot.forEach((doc) => {
        reportsData.push({
          id: doc.id,
          ...doc.data(),
        } as ChatReport & { id: string });
      });

      reportsData.sort((a, b) => {
        const dateA = new Date(a.dataDenuncia).getTime();
        const dateB = new Date(b.dataDenuncia).getTime();
        return dateB - dateA;
      });

      setReports(reportsData);
    });

    return () => unsubscribe();
  }, [userData?.uid]);

  const handleReview = async (newStatus: "analisada" | "arquivada") => {
    if (!selectedReport || !userData) return;

    setLoading(true);
    try {
      const reportRef = doc(db, "chat_reports", selectedReport.id);
      await updateDoc(reportRef, {
        status: newStatus,
        analisadaPor: userData.uid,
        analisadaPorNome: userData.nome,
        dataAnalise: getNowBrasiliaISO(),
        comentarioDiretor: comentarioDiretor.trim() || undefined,
        acaoTomada: acaoTomada.trim() || undefined,
      });

      toast({
        title: newStatus === "analisada" ? "Denúncia analisada" : "Denúncia arquivada",
        description: "A denúncia foi processada com sucesso.",
      });

      setReviewDialogOpen(false);
      setSelectedReport(null);
      setComentarioDiretor("");
      setAcaoTomada("");
    } catch (error) {
      console.error("Erro ao processar denúncia:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível processar a denúncia.",
      });
    } finally {
      setLoading(false);
    }
  };

  const openReviewDialog = (report: ChatReport & { id: string }) => {
    setSelectedReport(report);
    setComentarioDiretor(report.comentarioDiretor || "");
    setAcaoTomada(report.acaoTomada || "");
    setReviewDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd/MM/yy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge variant="destructive">Pendente</Badge>;
      case "analisada":
        return <Badge variant="default" className="bg-green-600">Analisada</Badge>;
      case "arquivada":
        return <Badge variant="secondary">Arquivada</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const pendingReports = reports.filter((r) => r.status === "pendente");
  const analyzedReports = reports.filter((r) => r.status === "analisada");
  const archivedReports = reports.filter((r) => r.status === "arquivada");

  const ReportTable = ({ reports }: { reports: (ChatReport & { id: string })[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Denunciante</TableHead>
          <TableHead>Denunciado</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reports.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
              Nenhuma denúncia encontrada
            </TableCell>
          </TableRow>
        ) : (
          reports.map((report) => (
            <TableRow key={report.id} data-testid={`row-report-${report.id}`}>
              <TableCell className="whitespace-nowrap">
                {formatDate(report.dataDenuncia)}
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{report.denuncianteNome}</p>
                  <p className="text-xs text-muted-foreground capitalize">{report.denuncianteTipo}</p>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{report.denunciadoNome}</p>
                  <p className="text-xs text-muted-foreground capitalize">{report.denunciadoTipo}</p>
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(report.status)}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openReviewDialog(report)}
                  data-testid={`button-review-${report.id}`}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {report.status === "pendente" ? "Analisar" : "Detalhes"}
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h3 className="text-xl font-semibold">Denúncias de Conversas</h3>
        {pendingReports.length > 0 && (
          <Badge variant="destructive">{pendingReports.length}</Badge>
        )}
      </div>

      <Tabs defaultValue="pendentes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pendentes" data-testid="tab-pending-reports">
            Pendentes
            {pendingReports.length > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingReports.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analisadas" data-testid="tab-analyzed-reports">
            Analisadas ({analyzedReports.length})
          </TabsTrigger>
          <TabsTrigger value="arquivadas" data-testid="tab-archived-reports">
            Arquivadas ({archivedReports.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes">
          <Card>
            <CardContent className="p-0">
              <ReportTable reports={pendingReports} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analisadas">
          <Card>
            <CardContent className="p-0">
              <ReportTable reports={analyzedReports} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="arquivadas">
          <Card>
            <CardContent className="p-0">
              <ReportTable reports={archivedReports} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedReport && (
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-w-2xl" data-testid="dialog-review-report">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Detalhes da Denúncia
              </DialogTitle>
              <DialogDescription>
                Denúncia registrada em {formatDate(selectedReport.dataDenuncia)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Denunciante</Label>
                  <p className="font-medium">{selectedReport.denuncianteNome}</p>
                  <p className="text-sm text-muted-foreground capitalize">{selectedReport.denuncianteTipo}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Denunciado</Label>
                  <p className="font-medium">{selectedReport.denunciadoNome}</p>
                  <p className="text-sm text-muted-foreground capitalize">{selectedReport.denunciadoTipo}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">Status</Label>
                <div className="mt-1">{getStatusBadge(selectedReport.status)}</div>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">Motivo da Denúncia</Label>
                <Card className="mt-1">
                  <CardContent className="p-3">
                    <p className="text-sm">{selectedReport.motivo}</p>
                  </CardContent>
                </Card>
              </div>

              {selectedReport.status !== "pendente" && (
                <>
                  <div>
                    <Label className="text-muted-foreground text-xs">Analisada por</Label>
                    <p className="text-sm">{selectedReport.analisadaPorNome}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedReport.dataAnalise && formatDate(selectedReport.dataAnalise)}
                    </p>
                  </div>

                  {selectedReport.acaoTomada && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Ação Tomada</Label>
                      <Card className="mt-1">
                        <CardContent className="p-3">
                          <p className="text-sm">{selectedReport.acaoTomada}</p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {selectedReport.comentarioDiretor && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Comentário do Diretor</Label>
                      <Card className="mt-1">
                        <CardContent className="p-3">
                          <p className="text-sm">{selectedReport.comentarioDiretor}</p>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </>
              )}

              {selectedReport.status === "pendente" && (
                <>
                  <div>
                    <Label htmlFor="acaoTomada">Ação Tomada</Label>
                    <Textarea
                      id="acaoTomada"
                      placeholder="Descreva a ação tomada (opcional)..."
                      value={acaoTomada}
                      onChange={(e) => setAcaoTomada(e.target.value)}
                      className="mt-1"
                      data-testid="textarea-action-taken"
                    />
                  </div>

                  <div>
                    <Label htmlFor="comentarioDiretor">Comentário do Diretor</Label>
                    <Textarea
                      id="comentarioDiretor"
                      placeholder="Adicione um comentário sobre esta denúncia (opcional)..."
                      value={comentarioDiretor}
                      onChange={(e) => setComentarioDiretor(e.target.value)}
                      className="mt-1"
                      data-testid="textarea-director-comment"
                    />
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setReviewDialogOpen(false)}
                disabled={loading}
                data-testid="button-cancel-review"
              >
                {selectedReport.status === "pendente" ? "Cancelar" : "Fechar"}
              </Button>

              {selectedReport.status === "pendente" && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => handleReview("arquivada")}
                    disabled={loading}
                    data-testid="button-archive-report"
                  >
                    <Archive className="h-4 w-4 mr-1" />
                    Arquivar
                  </Button>
                  <Button
                    onClick={() => handleReview("analisada")}
                    disabled={loading}
                    data-testid="button-analyze-report"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {loading ? "Processando..." : "Marcar como Analisada"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
