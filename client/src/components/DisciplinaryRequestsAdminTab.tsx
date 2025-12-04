import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { collection, addDoc, updateDoc, doc, where, query, getDocs } from "firebase/firestore";
import { db, auth as firebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertTriangle, Clock, CheckCircle, XCircle, 
  ShieldAlert, Ban, Search, User, GraduationCap
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import type { DisciplinaryRequest, User as UserType } from "@shared/schema";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";

export function DisciplinaryRequestsAdminTab() {
  const { userData } = useAuth();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<DisciplinaryRequest | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [comentarioDiretor, setComentarioDiretor] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: requests, isLoading: loadingRequests } = useRealtimeQuery<DisciplinaryRequest>({
    collectionName: "disciplinaryRequests",
    queryKey: ["/api/disciplinary-requests/all"],
    transform: (docs) => docs as DisciplinaryRequest[],
  });

  const { data: users } = useRealtimeQuery<UserType>({
    collectionName: "usuarios",
    queryKey: ["/api/usuarios"],
    transform: (docs) => docs as UserType[],
  });

  const pendingRequests = useMemo(() => {
    if (!requests) return [];
    return requests
      .filter(r => r.status === "pendente")
      .filter(r => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
          r.alunoNome.toLowerCase().includes(searchLower) ||
          r.alunoMatricula?.toLowerCase().includes(searchLower) ||
          r.solicitadoPorNome?.toLowerCase().includes(searchLower)
        );
      })
      .sort((a, b) => new Date(b.dataSolicitacao).getTime() - new Date(a.dataSolicitacao).getTime());
  }, [requests, searchTerm]);

  const processedRequests = useMemo(() => {
    if (!requests) return [];
    return requests
      .filter(r => r.status !== "pendente")
      .filter(r => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
          r.alunoNome.toLowerCase().includes(searchLower) ||
          r.alunoMatricula?.toLowerCase().includes(searchLower) ||
          r.solicitadoPorNome?.toLowerCase().includes(searchLower)
        );
      })
      .sort((a, b) => new Date(b.dataAnalise || b.dataSolicitacao).getTime() - new Date(a.dataAnalise || a.dataSolicitacao).getTime());
  }, [requests, searchTerm]);

  const handleApprove = async () => {
    if (!selectedRequest || !userData || !firebaseAuth.currentUser) return;
    
    setIsProcessing(true);
    try {
      const directorUid = userData.uid || firebaseAuth.currentUser.uid;
      const directorNome = userData.nome;
      
      if (selectedRequest.tipo === "advertencia") {
        const actionsQuery = query(
          collection(db, "disciplinaryActions"),
          where("alunoId", "==", selectedRequest.alunoId),
          where("tipo", "==", "advertencia"),
          where("ativo", "==", true)
        );
        const actionsSnapshot = await getDocs(actionsQuery);
        const activeWarnings = actionsSnapshot.docs.length;
        
        if (activeWarnings >= 3) {
          toast({
            title: "Limite atingido",
            description: "Este aluno já possui 3 advertências ativas.",
            variant: "destructive",
          });
          setIsProcessing(false);
          return;
        }
        
        const actionData = {
          alunoId: selectedRequest.alunoId,
          alunoNome: selectedRequest.alunoNome,
          alunoMatricula: selectedRequest.alunoMatricula,
          alunoTurma: selectedRequest.alunoTurma,
          tipo: "advertencia",
          comentario: selectedRequest.motivo + (comentarioDiretor ? `\n\nComentário do(a) diretor(a): ${comentarioDiretor}` : ""),
          aplicadoPor: directorUid,
          aplicadoPorNome: directorNome,
          dataAplicacao: getNowBrasiliaISO(),
          ativo: true,
          visualizado: false,
        };
        
        await addDoc(collection(db, "disciplinaryActions"), actionData);
      } else {
        const dataTermino = new Date();
        dataTermino.setDate(dataTermino.getDate() + 2);
        
        const actionData = {
          alunoId: selectedRequest.alunoId,
          alunoNome: selectedRequest.alunoNome,
          alunoMatricula: selectedRequest.alunoMatricula,
          alunoTurma: selectedRequest.alunoTurma,
          tipo: "suspensao",
          comentario: selectedRequest.motivo + (comentarioDiretor ? `\n\nComentário do(a) diretor(a): ${comentarioDiretor}` : ""),
          aplicadoPor: directorUid,
          aplicadoPorNome: directorNome,
          dataAplicacao: getNowBrasiliaISO(),
          dataTerminoSuspensao: dataTermino.toISOString(),
          ativo: true,
        };
        
        await addDoc(collection(db, "disciplinaryActions"), actionData);
        
        await updateDoc(doc(db, "usuarios", selectedRequest.alunoId), {
          ativo: false,
          suspensaoAtiva: true,
          suspensaoDataAplicacao: actionData.dataAplicacao,
          suspensaoDataTermino: actionData.dataTerminoSuspensao,
          suspensaoMotivo: actionData.comentario || null,
          suspensaoAplicadoPorNome: directorNome,
        });
      }
      
      await updateDoc(doc(db, "disciplinaryRequests", selectedRequest.id), {
        status: "aprovado",
        analisadoPor: directorUid,
        analisadoPorNome: directorNome,
        dataAnalise: getNowBrasiliaISO(),
        comentarioDiretor: comentarioDiretor || null,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/disciplinary-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/disciplinaryActions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      
      toast({
        title: "Solicitação aprovada",
        description: `A ${selectedRequest.tipo === "advertencia" ? "advertência" : "suspensão"} foi aplicada com sucesso.`,
      });
      
      setApproveDialogOpen(false);
      setSelectedRequest(null);
      setComentarioDiretor("");
    } catch (error: any) {
      console.error("Erro ao aprovar solicitação:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível aprovar a solicitação.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !userData || !firebaseAuth.currentUser) return;
    
    setIsProcessing(true);
    try {
      const directorUid = userData.uid || firebaseAuth.currentUser.uid;
      const directorNome = userData.nome;
      
      await updateDoc(doc(db, "disciplinaryRequests", selectedRequest.id), {
        status: "rejeitado",
        analisadoPor: directorUid,
        analisadoPorNome: directorNome,
        dataAnalise: getNowBrasiliaISO(),
        comentarioDiretor: comentarioDiretor || null,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/disciplinary-requests"] });
      
      toast({
        title: "Solicitação rejeitada",
        description: "A solicitação foi rejeitada e o professor será notificado.",
      });
      
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setComentarioDiretor("");
    } catch (error: any) {
      console.error("Erro ao rejeitar solicitação:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível rejeitar a solicitação.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "aprovado":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case "rejeitado":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTipoBadge = (tipo: string) => {
    if (tipo === "advertencia") {
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30"><AlertTriangle className="h-3 w-3 mr-1" />Advertência</Badge>;
    }
    return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30"><Ban className="h-3 w-3 mr-1" />Suspensão</Badge>;
  };

  if (loadingRequests) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Solicitações de Ações Disciplinares
        </h3>
        {pendingRequests.length > 0 && (
          <Badge variant="destructive">{pendingRequests.length} pendente(s)</Badge>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome do aluno, matrícula ou professor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="input-search-requests"
        />
      </div>

      <Tabs defaultValue="pendentes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pendentes" data-testid="tab-pendentes">
            Pendentes
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingRequests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="processadas" data-testid="tab-processadas">
            Processadas ({processedRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="space-y-4">
          {pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                <p className="text-lg font-medium mb-2">Nenhuma solicitação pendente</p>
                <p className="text-sm text-muted-foreground">
                  Todas as solicitações de ações disciplinares foram processadas.
                </p>
              </CardContent>
            </Card>
          ) : (
            pendingRequests.map((request) => (
              <Card key={request.id} className="hover-elevate" data-testid={`card-pending-request-${request.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <GraduationCap className="h-5 w-5" />
                        {request.alunoNome}
                      </CardTitle>
                      <CardDescription>
                        Matrícula: {request.alunoMatricula} | Turma: {request.alunoTurmaNome || request.alunoTurma}
                      </CardDescription>
                    </div>
                    {getTipoBadge(request.tipo)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    Solicitado por: <strong>{request.solicitadoPorNome}</strong>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground">Motivo</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap bg-muted/50 p-3 rounded">{request.motivo}</p>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Solicitado em {format(parseISO(request.dataSolicitacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button 
                    variant="default"
                    onClick={() => {
                      setSelectedRequest(request);
                      setComentarioDiretor("");
                      setApproveDialogOpen(true);
                    }}
                    data-testid={`button-aprovar-${request.id}`}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Aprovar e Aplicar
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setSelectedRequest(request);
                      setComentarioDiretor("");
                      setRejectDialogOpen(true);
                    }}
                    data-testid={`button-rejeitar-${request.id}`}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Rejeitar
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="processadas" className="space-y-4">
          {processedRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Nenhuma solicitação processada</p>
                <p className="text-sm text-muted-foreground">
                  O histórico de solicitações processadas aparecerá aqui.
                </p>
              </CardContent>
            </Card>
          ) : (
            processedRequests.map((request) => (
              <Card key={request.id} data-testid={`card-processed-request-${request.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{request.alunoNome}</CardTitle>
                      <CardDescription>
                        Matrícula: {request.alunoMatricula} | Turma: {request.alunoTurmaNome || request.alunoTurma}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getTipoBadge(request.tipo)}
                      {getStatusBadge(request.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    Solicitado por: <strong>{request.solicitadoPorNome}</strong>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground">Motivo</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{request.motivo}</p>
                  </div>
                  
                  {request.dataAnalise && (
                    <div className="pt-3 border-t">
                      <div className="text-xs text-muted-foreground">
                        {request.status === "aprovado" ? "Aprovado" : "Rejeitado"} por <strong>{request.analisadoPorNome}</strong> em{" "}
                        {format(parseISO(request.dataAnalise), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                      {request.comentarioDiretor && (
                        <div className="mt-2 p-2 bg-muted/50 rounded">
                          <Label className="text-xs text-muted-foreground">Comentário</Label>
                          <p className="text-sm mt-1">{request.comentarioDiretor}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Aprovar Solicitação
            </DialogTitle>
            <DialogDescription>
              Você está prestes a aplicar uma {selectedRequest?.tipo === "advertencia" ? "advertência" : "suspensão"} para{" "}
              <strong>{selectedRequest?.alunoNome}</strong>.
              {selectedRequest?.tipo === "suspensao" && (
                <span className="block mt-2 text-red-500 font-medium">
                  A conta do aluno será bloqueada por 2 dias.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted/50 rounded space-y-2">
              <div className="text-sm">
                <strong>Motivo informado pelo professor:</strong>
              </div>
              <p className="text-sm whitespace-pre-wrap">{selectedRequest?.motivo}</p>
            </div>

            <div className="space-y-2">
              <Label>Comentário adicional (opcional)</Label>
              <Textarea
                value={comentarioDiretor}
                onChange={(e) => setComentarioDiretor(e.target.value)}
                placeholder="Adicione um comentário se necessário..."
                className="min-h-[80px]"
                data-testid="textarea-comentario-aprovar"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button onClick={handleApprove} disabled={isProcessing} data-testid="button-confirmar-aprovar">
              {isProcessing ? "Processando..." : "Confirmar e Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Rejeitar Solicitação
            </DialogTitle>
            <DialogDescription>
              Você está rejeitando a solicitação de {selectedRequest?.tipo === "advertencia" ? "advertência" : "suspensão"} para{" "}
              <strong>{selectedRequest?.alunoNome}</strong>. O professor será notificado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted/50 rounded space-y-2">
              <div className="text-sm">
                <strong>Motivo informado pelo professor:</strong>
              </div>
              <p className="text-sm whitespace-pre-wrap">{selectedRequest?.motivo}</p>
            </div>

            <div className="space-y-2">
              <Label>Motivo da rejeição (opcional)</Label>
              <Textarea
                value={comentarioDiretor}
                onChange={(e) => setComentarioDiretor(e.target.value)}
                placeholder="Explique por que a solicitação foi rejeitada..."
                className="min-h-[80px]"
                data-testid="textarea-comentario-rejeitar"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isProcessing} data-testid="button-confirmar-rejeitar">
              {isProcessing ? "Processando..." : "Confirmar Rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
