import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { doc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  KeyRound, CheckCircle, XCircle, Clock, AlertCircle,
  MessageSquare, Eye, RefreshCw
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import type { SolicitacaoEdicaoNota } from "@shared/schema";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";
import { formatNota } from "@/lib/utils";

const ANOS_DISPONIVEIS = [
  (new Date().getFullYear() - 1).toString(),
  new Date().getFullYear().toString(),
  (new Date().getFullYear() + 1).toString(),
];

export function AutorizacaoNotasTab() {
  const { userData } = useAuth();
  const { toast } = useToast();
  
  const [selectedAno, setSelectedAno] = useState(new Date().getFullYear().toString());
  const [filterStatus, setFilterStatus] = useState<"todas" | "pendente" | "autorizado" | "negado">("pendente");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<SolicitacaoEdicaoNota | null>(null);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [comentarioDiretor, setComentarioDiretor] = useState("");

  const { data: solicitacoes, isLoading, refetch } = useRealtimeQuery<SolicitacaoEdicaoNota>({
    collectionName: "solicitacoesEdicaoNota",
    queryKey: ["/api/solicitacoes-edicao-nota-todas", selectedAno],
    constraints: [where("ano", "==", selectedAno)],
    transform: (docs) => docs as SolicitacaoEdicaoNota[],
  });

  const filteredSolicitacoes = useMemo(() => {
    if (!solicitacoes) return [];
    if (filterStatus === "todas") return solicitacoes;
    return solicitacoes.filter(s => s.status === filterStatus);
  }, [solicitacoes, filterStatus]);

  const sortedSolicitacoes = useMemo(() => {
    return [...filteredSolicitacoes].sort((a, b) => {
      const dateA = new Date(a.dataSolicitacao);
      const dateB = new Date(b.dataSolicitacao);
      return dateB.getTime() - dateA.getTime();
    });
  }, [filteredSolicitacoes]);

  const stats = useMemo(() => {
    if (!solicitacoes) return { total: 0, pendentes: 0, autorizadas: 0, negadas: 0 };
    return {
      total: solicitacoes.length,
      pendentes: solicitacoes.filter(s => s.status === "pendente").length,
      autorizadas: solicitacoes.filter(s => s.status === "autorizado").length,
      negadas: solicitacoes.filter(s => s.status === "negado").length,
    };
  }, [solicitacoes]);

  const openViewDialog = (solicitacao: SolicitacaoEdicaoNota) => {
    setSelectedSolicitacao(solicitacao);
    setViewDialogOpen(true);
  };

  const openResponseDialog = (solicitacao: SolicitacaoEdicaoNota) => {
    setSelectedSolicitacao(solicitacao);
    setComentarioDiretor("");
    setResponseDialogOpen(true);
  };

  const authorizeMutation = useMutation({
    mutationFn: async (autorizar: boolean) => {
      if (!userData || !selectedSolicitacao) throw new Error("Dados incompletos");

      const solicitacaoRef = doc(db, "solicitacoesEdicaoNota", selectedSolicitacao.id);
      await updateDoc(solicitacaoRef, {
        status: autorizar ? "autorizado" : "negado",
        diretorId: userData.uid,
        diretorNome: userData.nome,
        dataResposta: getNowBrasiliaISO(),
        comentarioDiretor: comentarioDiretor.trim() || undefined,
      });

      if (autorizar) {
        const notaRef = doc(db, "notasBimestre", selectedSolicitacao.notaBimestreId);
        await updateDoc(notaRef, {
          edicaoAutorizada: true,
          edicaoAutorizadaPor: userData.uid,
          edicaoAutorizadaPorNome: userData.nome,
          dataAutorizacaoEdicao: getNowBrasiliaISO(),
          motivoSolicitacaoEdicao: selectedSolicitacao.motivo,
        });
      }

      return { autorizar };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitacoes-edicao-nota"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solicitacoes-edicao-nota-todas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notas-bimestre"] });
      refetch();
      toast({
        title: data.autorizar ? "Autorizado!" : "Negado",
        description: data.autorizar 
          ? "O professor agora pode editar a nota."
          : "A solicitação foi negada.",
      });
      setResponseDialogOpen(false);
      setSelectedSolicitacao(null);
      setComentarioDiretor("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="h-6 w-6" />
            Autorizações de Edição de Notas
          </h2>
          <p className="text-muted-foreground">Gerencie solicitações de professores para editar notas já entregues</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Label>Ano:</Label>
          <Select value={selectedAno} onValueChange={setSelectedAno}>
            <SelectTrigger className="w-28" data-testid="select-ano">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANOS_DISPONIVEIS.map(ano => (
                <SelectItem key={ano} value={ano}>{ano}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="hover-elevate cursor-pointer" onClick={() => setFilterStatus("todas")}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer border-orange-200 dark:border-orange-800" onClick={() => setFilterStatus("pendente")}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pendentes}</div>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer border-green-200 dark:border-green-800" onClick={() => setFilterStatus("autorizado")}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Autorizadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.autorizadas}</div>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer border-red-200 dark:border-red-800" onClick={() => setFilterStatus("negado")}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Negadas</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.negadas}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-lg">Solicitações</CardTitle>
            <CardDescription>
              {filterStatus === "todas" ? "Todas as solicitações" : 
               filterStatus === "pendente" ? "Solicitações aguardando resposta" :
               filterStatus === "autorizado" ? "Solicitações autorizadas" : "Solicitações negadas"}
            </CardDescription>
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="w-40" data-testid="select-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="autorizado">Autorizadas</SelectItem>
              <SelectItem value="negado">Negadas</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {sortedSolicitacoes.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma solicitação encontrada</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Professor</TableHead>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead>Matéria</TableHead>
                    <TableHead>Bimestre</TableHead>
                    <TableHead className="text-center">Nota Atual</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSolicitacoes.map((solicitacao) => (
                    <TableRow key={solicitacao.id} data-testid={`row-solicitacao-${solicitacao.id}`}>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(parseISO(solicitacao.dataSolicitacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">{solicitacao.professorNome}</TableCell>
                      <TableCell>{solicitacao.alunoNome}</TableCell>
                      <TableCell>{solicitacao.turmaNome}</TableCell>
                      <TableCell>{solicitacao.materia}</TableCell>
                      <TableCell>{solicitacao.bimestreNome}</TableCell>
                      <TableCell className="text-center">
                        {formatNota(solicitacao.notaAtual)}
                      </TableCell>
                      <TableCell className="text-center">
                        {solicitacao.status === "pendente" ? (
                          <Badge variant="outline" className="text-orange-600 border-orange-400">
                            <Clock className="h-3 w-3 mr-1" />
                            Pendente
                          </Badge>
                        ) : solicitacao.status === "autorizado" ? (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Autorizado
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Negado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openViewDialog(solicitacao)}
                            data-testid={`button-view-${solicitacao.id}`}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          {solicitacao.status === "pendente" && (
                            <Button
                              size="sm"
                              onClick={() => openResponseDialog(solicitacao)}
                              data-testid={`button-respond-${solicitacao.id}`}
                            >
                              Responder
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent data-testid="dialog-view">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Detalhes da Solicitação
            </DialogTitle>
          </DialogHeader>

          {selectedSolicitacao && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Professor</p>
                  <p className="font-medium">{selectedSolicitacao.professorNome}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data da Solicitação</p>
                  <p className="font-medium">
                    {format(parseISO(selectedSolicitacao.dataSolicitacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aluno</p>
                  <p className="font-medium">{selectedSolicitacao.alunoNome}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Matrícula</p>
                  <p className="font-medium">{selectedSolicitacao.alunoMatricula || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Turma</p>
                  <p className="font-medium">{selectedSolicitacao.turmaNome}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Matéria</p>
                  <p className="font-medium">{selectedSolicitacao.materia}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bimestre</p>
                  <p className="font-medium">{selectedSolicitacao.bimestreNome}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nota Atual</p>
                  <p className="font-medium">{formatNota(selectedSolicitacao.notaAtual)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Motivo da Solicitação</Label>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">{selectedSolicitacao.motivo}</p>
                </div>
              </div>

              {selectedSolicitacao.status !== "pendente" && (
                <div className="space-y-2">
                  <Label>Resposta do Diretor</Label>
                  <div className={`p-3 rounded-lg ${selectedSolicitacao.status === "autorizado" ? "bg-green-100 dark:bg-green-950/30" : "bg-red-100 dark:bg-red-950/30"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={selectedSolicitacao.status === "autorizado" ? "default" : "destructive"}>
                        {selectedSolicitacao.status === "autorizado" ? "Autorizado" : "Negado"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        por {selectedSolicitacao.diretorNome} em {selectedSolicitacao.dataResposta && format(parseISO(selectedSolicitacao.dataResposta), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    {selectedSolicitacao.comentarioDiretor && (
                      <p className="text-sm">{selectedSolicitacao.comentarioDiretor}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Fechar
            </Button>
            {selectedSolicitacao?.status === "pendente" && (
              <Button onClick={() => {
                setViewDialogOpen(false);
                openResponseDialog(selectedSolicitacao);
              }}>
                Responder
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
        <DialogContent data-testid="dialog-respond">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Responder Solicitação
            </DialogTitle>
            <DialogDescription>
              Autorize ou negue a solicitação de edição de nota.
            </DialogDescription>
          </DialogHeader>

          {selectedSolicitacao && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p><strong>Professor:</strong> {selectedSolicitacao.professorNome}</p>
                <p><strong>Aluno:</strong> {selectedSolicitacao.alunoNome}</p>
                <p><strong>Turma:</strong> {selectedSolicitacao.turmaNome}</p>
                <p><strong>Matéria:</strong> {selectedSolicitacao.materia}</p>
                <p><strong>Bimestre:</strong> {selectedSolicitacao.bimestreNome}</p>
                <p><strong>Nota Atual:</strong> {formatNota(selectedSolicitacao.notaAtual)}</p>
              </div>

              <div className="space-y-2">
                <Label>Motivo apresentado pelo professor:</Label>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">{selectedSolicitacao.motivo}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comentario">Comentário (opcional)</Label>
                <Textarea
                  id="comentario"
                  value={comentarioDiretor}
                  onChange={(e) => setComentarioDiretor(e.target.value)}
                  placeholder="Adicione um comentário sobre sua decisão..."
                  className="min-h-[80px]"
                  data-testid="input-comentario"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setResponseDialogOpen(false)}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => authorizeMutation.mutate(false)}
              disabled={authorizeMutation.isPending}
              data-testid="button-negar"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Negar
            </Button>
            <Button
              onClick={() => authorizeMutation.mutate(true)}
              disabled={authorizeMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-autorizar"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {authorizeMutation.isPending ? "Processando..." : "Autorizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
