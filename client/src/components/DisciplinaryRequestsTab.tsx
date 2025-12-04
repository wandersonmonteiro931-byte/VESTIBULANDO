import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { collection, addDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertTriangle, AlertCircle, Clock, CheckCircle, XCircle, 
  Plus, Users, ShieldAlert, Ban
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import type { Turma, User, DisciplinaryRequest } from "@shared/schema";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";

export function DisciplinaryRequestsTab() {
  const { userData } = useAuth();
  const { toast } = useToast();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTurma, setSelectedTurma] = useState<string>("");
  const [selectedAluno, setSelectedAluno] = useState<string>("");
  const [tipoAcao, setTipoAcao] = useState<"advertencia" | "suspensao">("advertencia");
  const [motivo, setMotivo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: turmas, isLoading: loadingTurmas } = useRealtimeQuery<Turma>({
    collectionName: "turmas",
    queryKey: ["/api/turmas"],
    transform: (docs) => docs as Turma[],
  });

  const { data: alunos, isLoading: loadingAlunos } = useRealtimeQuery<User>({
    collectionName: "usuarios",
    queryKey: ["/api/usuarios/alunos"],
    constraints: [where("tipo", "==", "aluno"), where("status", "==", "aprovado")],
    transform: (docs) => docs as User[],
  });

  const { data: requests, isLoading: loadingRequests } = useRealtimeQuery<DisciplinaryRequest>({
    collectionName: "disciplinaryRequests",
    queryKey: ["/api/disciplinary-requests", userData?.uid],
    constraints: userData?.uid ? [where("solicitadoPor", "==", userData.uid)] : [],
    transform: (docs) => docs as DisciplinaryRequest[],
    enabled: !!userData?.uid,
  });

  const professorTurmas = useMemo(() => {
    if (!turmas || !userData) return [];
    if (userData.tipo === "diretor") {
      return turmas.filter(t => t.ativa);
    }
    if (userData.tipo === "professor") {
      if (userData.turmas && userData.turmas.length > 0) {
        return turmas.filter(t => t.ativa && userData.turmas?.includes(t.id));
      }
      return [];
    }
    return [];
  }, [turmas, userData]);

  const alunosTurma = useMemo(() => {
    if (!alunos || !selectedTurma) return [];
    return alunos
      .filter(a => a.turma === selectedTurma && a.ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [alunos, selectedTurma]);

  const selectedAlunoData = useMemo(() => {
    if (!alunos || !selectedAluno) return null;
    return alunos.find(a => a.uid === selectedAluno) || null;
  }, [alunos, selectedAluno]);

  const selectedTurmaData = useMemo(() => {
    if (!turmas || !selectedTurma) return null;
    return turmas.find(t => t.id === selectedTurma) || null;
  }, [turmas, selectedTurma]);

  const sortedRequests = useMemo(() => {
    if (!requests) return [];
    return [...requests].sort((a, b) => 
      new Date(b.dataSolicitacao).getTime() - new Date(a.dataSolicitacao).getTime()
    );
  }, [requests]);

  const pendingRequestsCount = useMemo(() => {
    if (!requests) return 0;
    return requests.filter(r => r.status === "pendente").length;
  }, [requests]);

  const handleCreateRequest = async () => {
    if (!userData || !selectedAlunoData || !selectedTurmaData || !motivo.trim()) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const requestData: Omit<DisciplinaryRequest, "id"> = {
        alunoId: selectedAlunoData.uid,
        alunoNome: selectedAlunoData.nome,
        alunoMatricula: selectedAlunoData.matricula || "",
        alunoTurma: selectedTurma,
        alunoTurmaNome: selectedTurmaData.nome,
        tipo: tipoAcao,
        motivo: motivo.trim(),
        solicitadoPor: userData.uid,
        solicitadoPorNome: userData.nome,
        dataSolicitacao: getNowBrasiliaISO(),
        status: "pendente",
      };

      await addDoc(collection(db, "disciplinaryRequests"), requestData);

      toast({
        title: "Solicitação enviada",
        description: `Sua solicitação de ${tipoAcao === "advertencia" ? "advertência" : "suspensão"} foi enviada para análise da diretoria.`,
      });

      setCreateDialogOpen(false);
      setSelectedTurma("");
      setSelectedAluno("");
      setTipoAcao("advertencia");
      setMotivo("");
      
      queryClient.invalidateQueries({ queryKey: ["/api/disciplinary-requests"] });
    } catch (error) {
      console.error("Erro ao criar solicitação:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a solicitação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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

  if (loadingTurmas || loadingAlunos || loadingRequests) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (professorTurmas.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Nenhuma turma cadastrada</p>
          <p className="text-sm text-muted-foreground">
            Você precisa estar cadastrado em turmas para solicitar ações disciplinares.
            Entre em contato com a diretoria.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Solicitações de Ações Disciplinares
              </CardTitle>
              <CardDescription>
                Solicite advertências ou suspensões para alunos das suas turmas
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-nova-solicitacao">
              <Plus className="h-4 w-4 mr-2" />
              Nova Solicitação
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pendingRequestsCount > 0 && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <span className="text-sm text-amber-700 dark:text-amber-400">
                Você tem {pendingRequestsCount} solicitação(ões) pendente(s) de análise.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {sortedRequests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Nenhuma solicitação</p>
            <p className="text-sm text-muted-foreground">
              Você ainda não fez nenhuma solicitação de ação disciplinar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedRequests.map((request) => (
            <Card key={request.id} className="hover-elevate" data-testid={`card-request-${request.id}`}>
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
                <div>
                  <Label className="text-xs text-muted-foreground">Motivo da solicitação</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{request.motivo}</p>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  Solicitado em {format(parseISO(request.dataSolicitacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>

                {request.status !== "pendente" && request.dataAnalise && (
                  <div className="pt-3 border-t">
                    <div className="text-xs text-muted-foreground mb-1">
                      Analisado por <strong>{request.analisadoPorNome}</strong> em{" "}
                      {format(parseISO(request.dataAnalise), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                    {request.comentarioDiretor && (
                      <div className="mt-2 p-2 bg-muted/50 rounded">
                        <Label className="text-xs text-muted-foreground">Comentário da diretoria</Label>
                        <p className="text-sm mt-1">{request.comentarioDiretor}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Nova Solicitação Disciplinar
            </DialogTitle>
            <DialogDescription>
              Preencha os dados para solicitar uma ação disciplinar. A diretoria irá analisar e decidir se aplica ou não.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Turma *</Label>
              <Select value={selectedTurma} onValueChange={(value) => {
                setSelectedTurma(value);
                setSelectedAluno("");
              }}>
                <SelectTrigger data-testid="select-turma">
                  <SelectValue placeholder="Selecione a turma" />
                </SelectTrigger>
                <SelectContent>
                  {professorTurmas.map((turma) => (
                    <SelectItem key={turma.id} value={turma.id}>
                      {turma.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Aluno *</Label>
              <Select value={selectedAluno} onValueChange={setSelectedAluno} disabled={!selectedTurma}>
                <SelectTrigger data-testid="select-aluno">
                  <SelectValue placeholder={selectedTurma ? "Selecione o aluno" : "Selecione uma turma primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {alunosTurma.map((aluno) => (
                    <SelectItem key={aluno.uid} value={aluno.uid}>
                      {aluno.nome} ({aluno.matricula})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Ação *</Label>
              <Select value={tipoAcao} onValueChange={(value: "advertencia" | "suspensao") => setTipoAcao(value)}>
                <SelectTrigger data-testid="select-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="advertencia">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Advertência
                    </div>
                  </SelectItem>
                  <SelectItem value="suspensao">
                    <div className="flex items-center gap-2">
                      <Ban className="h-4 w-4 text-red-500" />
                      Suspensão
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Motivo / Justificativa *</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Descreva detalhadamente o motivo da solicitação..."
                className="min-h-[120px]"
                data-testid="textarea-motivo"
              />
              <p className="text-xs text-muted-foreground">
                Descreva o ocorrido de forma clara e objetiva para facilitar a análise pela diretoria.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateRequest} 
              disabled={isSubmitting || !selectedAluno || !motivo.trim()}
              data-testid="button-enviar-solicitacao"
            >
              {isSubmitting ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
