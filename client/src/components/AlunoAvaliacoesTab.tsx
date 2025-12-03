import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { collection, addDoc, updateDoc, doc, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { FileUploadZone } from "@/components/FileUploadZone";
import { 
  FileText, Calendar, Clock, Award, Download, Upload, Eye,
  CheckCircle, AlertCircle, FileCheck, BookOpen, ClipboardList, 
  GraduationCap, Timer, AlertTriangle
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import type { Avaliacao, AvaliacaoEntrega, Turma, User } from "@shared/schema";
import { format, formatDistanceToNow, isPast, isFuture, isWithinInterval, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";

export function AlunoAvaliacoesTab() {
  const { userData } = useAuth();
  const { toast } = useToast();
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [selectedAvaliacao, setSelectedAvaliacao] = useState<Avaliacao | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState("disponiveis");

  const { data: avaliacoesTurmaRaw } = useRealtimeQuery<Avaliacao>({
    collectionName: "avaliacoes",
    queryKey: ["/api/avaliacoes/aluno/turma", userData?.turma],
    constraints: userData?.turma 
      ? [where("turmaId", "==", userData.turma)]
      : [],
    transform: (docs) => docs as Avaliacao[],
    enabled: !!userData?.turma,
  });

  const { data: avaliacoesEspecificasRaw } = useRealtimeQuery<Avaliacao>({
    collectionName: "avaliacoes",
    queryKey: ["/api/avaliacoes/aluno/especificas", userData?.uid],
    constraints: userData?.uid 
      ? [where("alunosIds", "array-contains", userData.uid)]
      : [],
    transform: (docs) => docs as Avaliacao[],
    enabled: !!userData?.uid,
  });

  const avaliacoes = useMemo(() => {
    const combined = [...(avaliacoesTurmaRaw || []), ...(avaliacoesEspecificasRaw || [])];
    return combined
      .filter(a => a.status !== "rascunho")
      .filter((avaliacao, index, self) => self.findIndex(av => av.id === avaliacao.id) === index);
  }, [avaliacoesTurmaRaw, avaliacoesEspecificasRaw]);
  
  const loadingAvaliacoes = !avaliacoesTurmaRaw && !avaliacoesEspecificasRaw;

  const { data: minhasEntregas } = useRealtimeQuery<AvaliacaoEntrega>({
    collectionName: "avaliacaoEntregas",
    queryKey: ["/api/avaliacao-entregas/aluno", userData?.uid],
    constraints: userData?.uid ? [where("alunoId", "==", userData.uid)] : [],
    transform: (docs) => docs as AvaliacaoEntrega[],
    enabled: !!userData?.uid,
  });

  const submitMutation = useMutation({
    mutationFn: async ({ avaliacaoId, file }: { avaliacaoId: string; file: File }) => {
      if (!userData) throw new Error("Usuário não autenticado");

      const avaliacao = avaliacoes?.find(a => a.id === avaliacaoId);
      if (!avaliacao) throw new Error("Avaliação não encontrada");

      const prazoFim = new Date(avaliacao.dataFim);
      const now = new Date();
      const isLate = isPast(prazoFim);

      if (isLate && !avaliacao.permitirAtraso) {
        throw new Error("O prazo desta avaliação já expirou e não são permitidas entregas atrasadas.");
      }

      const storageRef = ref(storage, `avaliacaoEntregas/${userData.uid}/${avaliacaoId}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      const status = isLate ? "atrasada" : "enviada";

      const entregaData: any = {
        avaliacaoId,
        avaliacaoTitulo: avaliacao.titulo,
        avaliacaoTipo: avaliacao.tipo,
        alunoId: userData.uid,
        alunoNome: userData.nome,
        alunoMatricula: userData.matricula || "",
        turmaId: userData.turma,
        turmaNome: avaliacao.turmaNome,
        dataEnvio: getNowBrasiliaISO(),
        arquivoUrl: downloadURL,
        arquivoNome: file.name,
        status,
      };

      await addDoc(collection(db, "avaliacaoEntregas"), entregaData);
      return entregaData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/avaliacao-entregas"] });
      toast({
        title: "Avaliação entregue!",
        description: "Sua entrega foi registrada com sucesso.",
      });
      setSubmitDialogOpen(false);
      setUploadFile(null);
      setSelectedAvaliacao(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getEntregaForAvaliacao = (avaliacaoId: string) => {
    return minhasEntregas?.find(e => e.avaliacaoId === avaliacaoId);
  };

  const getStatusAvaliacao = (avaliacao: Avaliacao) => {
    const now = new Date();
    const inicio = new Date(avaliacao.dataInicio);
    const fim = new Date(avaliacao.dataFim);
    const entrega = getEntregaForAvaliacao(avaliacao.id);

    if (entrega) {
      if (entrega.status === "corrigida") {
        return { 
          label: `Nota: ${entrega.nota}`, 
          variant: "default" as const, 
          icon: <Award className="h-4 w-4" /> 
        };
      }
      if (entrega.status === "atrasada") {
        return { 
          label: "Entregue (atrasada)", 
          variant: "destructive" as const, 
          icon: <AlertTriangle className="h-4 w-4" /> 
        };
      }
      return { 
        label: "Entregue", 
        variant: "secondary" as const, 
        icon: <CheckCircle className="h-4 w-4" /> 
      };
    }

    if (avaliacao.status === "cancelada") {
      return { label: "Cancelada", variant: "destructive" as const, icon: <AlertCircle className="h-4 w-4" /> };
    }
    if (isFuture(inicio)) {
      return { label: "Agendada", variant: "outline" as const, icon: <Calendar className="h-4 w-4" /> };
    }
    if (isWithinInterval(now, { start: inicio, end: fim })) {
      return { label: "Disponível", variant: "default" as const, icon: <Clock className="h-4 w-4" /> };
    }
    if (isPast(fim)) {
      return { label: "Encerrada", variant: "destructive" as const, icon: <AlertCircle className="h-4 w-4" /> };
    }
    return { label: avaliacao.status, variant: "outline" as const, icon: <FileText className="h-4 w-4" /> };
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case "prova": return <FileCheck className="h-4 w-4" />;
      case "simulado": return <ClipboardList className="h-4 w-4" />;
      case "atividade": return <BookOpen className="h-4 w-4" />;
      case "trabalho": return <GraduationCap className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case "prova": return "Prova";
      case "simulado": return "Simulado";
      case "atividade": return "Atividade";
      case "trabalho": return "Trabalho";
      default: return tipo;
    }
  };

  const filterAvaliacoes = (tab: string) => {
    if (!avaliacoes) return [];
    const now = new Date();

    switch (tab) {
      case "disponiveis":
        return avaliacoes.filter(a => {
          const inicio = new Date(a.dataInicio);
          const fim = new Date(a.dataFim);
          const entrega = getEntregaForAvaliacao(a.id);
          return isWithinInterval(now, { start: inicio, end: fim }) && !entrega && a.status !== "cancelada";
        });
      case "pendentes":
        return avaliacoes.filter(a => {
          const fim = new Date(a.dataFim);
          const entrega = getEntregaForAvaliacao(a.id);
          return !entrega && !isPast(fim) && a.status !== "cancelada";
        });
      case "entregues":
        return avaliacoes.filter(a => {
          const entrega = getEntregaForAvaliacao(a.id);
          return entrega && entrega.status !== "corrigida";
        });
      case "notas":
        return avaliacoes.filter(a => {
          const entrega = getEntregaForAvaliacao(a.id);
          return entrega && entrega.status === "corrigida";
        });
      default:
        return avaliacoes;
    }
  };

  const calcularMedia = () => {
    const entregasCorrigidas = minhasEntregas?.filter(e => e.status === "corrigida" && e.nota !== undefined);
    if (!entregasCorrigidas || entregasCorrigidas.length === 0) return null;
    
    const soma = entregasCorrigidas.reduce((acc, e) => acc + (e.nota || 0), 0);
    return (soma / entregasCorrigidas.length).toFixed(1);
  };

  const stats = {
    disponiveis: filterAvaliacoes("disponiveis").length,
    pendentes: filterAvaliacoes("pendentes").length,
    entregues: filterAvaliacoes("entregues").length,
    notas: filterAvaliacoes("notas").length,
    media: calcularMedia(),
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="hover-elevate border-blue-200/50 dark:border-blue-900/50 bg-gradient-to-br from-card to-blue-50/30 dark:to-blue-950/10">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponíveis</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.disponiveis}</div>
            <p className="text-xs text-muted-foreground">Para fazer agora</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate border-amber-200/50 dark:border-amber-900/50 bg-gradient-to-br from-card to-amber-50/30 dark:to-amber-950/10">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Calendar className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.pendentes}</div>
            <p className="text-xs text-muted-foreground">Aguardando entrega</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate border-purple-200/50 dark:border-purple-900/50 bg-gradient-to-br from-card to-purple-50/30 dark:to-purple-950/10">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregues</CardTitle>
            <CheckCircle className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.entregues}</div>
            <p className="text-xs text-muted-foreground">Aguardando correção</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate border-green-200/50 dark:border-green-900/50 bg-gradient-to-br from-card to-green-50/30 dark:to-green-950/10">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média</CardTitle>
            <Award className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.media || "-"}
            </div>
            <p className="text-xs text-muted-foreground">{stats.notas} avaliações corrigidas</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="disponiveis">
            Disponíveis
            {stats.disponiveis > 0 && (
              <Badge variant="default" className="ml-2">{stats.disponiveis}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="entregues">Entregues</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
        </TabsList>

        <TabsContent value="disponiveis" className="space-y-4">
          <AvaliacaoListAluno
            avaliacoes={filterAvaliacoes("disponiveis")}
            loading={loadingAvaliacoes}
            onView={(a) => { setSelectedAvaliacao(a); setViewDialogOpen(true); }}
            onSubmit={(a) => { setSelectedAvaliacao(a); setSubmitDialogOpen(true); }}
            getStatus={getStatusAvaliacao}
            getTipoIcon={getTipoIcon}
            getTipoLabel={getTipoLabel}
            getEntrega={getEntregaForAvaliacao}
            emptyMessage="Nenhuma avaliação disponível no momento"
            emptyDescription="Fique atento aos próximos prazos"
          />
        </TabsContent>

        <TabsContent value="pendentes" className="space-y-4">
          <AvaliacaoListAluno
            avaliacoes={filterAvaliacoes("pendentes")}
            loading={loadingAvaliacoes}
            onView={(a) => { setSelectedAvaliacao(a); setViewDialogOpen(true); }}
            onSubmit={(a) => { setSelectedAvaliacao(a); setSubmitDialogOpen(true); }}
            getStatus={getStatusAvaliacao}
            getTipoIcon={getTipoIcon}
            getTipoLabel={getTipoLabel}
            getEntrega={getEntregaForAvaliacao}
            emptyMessage="Nenhuma avaliação pendente"
            emptyDescription="Todas as avaliações foram entregues"
          />
        </TabsContent>

        <TabsContent value="entregues" className="space-y-4">
          <AvaliacaoListAluno
            avaliacoes={filterAvaliacoes("entregues")}
            loading={loadingAvaliacoes}
            onView={(a) => { setSelectedAvaliacao(a); setViewDialogOpen(true); }}
            onSubmit={(a) => { setSelectedAvaliacao(a); setSubmitDialogOpen(true); }}
            getStatus={getStatusAvaliacao}
            getTipoIcon={getTipoIcon}
            getTipoLabel={getTipoLabel}
            getEntrega={getEntregaForAvaliacao}
            emptyMessage="Nenhuma avaliação entregue"
            emptyDescription="Suas entregas aparecerão aqui"
          />
        </TabsContent>

        <TabsContent value="notas" className="space-y-4">
          <AvaliacaoListAluno
            avaliacoes={filterAvaliacoes("notas")}
            loading={loadingAvaliacoes}
            onView={(a) => { setSelectedAvaliacao(a); setViewDialogOpen(true); }}
            onSubmit={(a) => { setSelectedAvaliacao(a); setSubmitDialogOpen(true); }}
            getStatus={getStatusAvaliacao}
            getTipoIcon={getTipoIcon}
            getTipoLabel={getTipoLabel}
            getEntrega={getEntregaForAvaliacao}
            emptyMessage="Nenhuma nota disponível"
            emptyDescription="Suas notas aparecerão aqui após correção"
            showNota
          />
        </TabsContent>
      </Tabs>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-view-avaliacao">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAvaliacao && getTipoIcon(selectedAvaliacao.tipo)}
              {selectedAvaliacao?.titulo}
            </DialogTitle>
            <DialogDescription>
              {selectedAvaliacao && getTipoLabel(selectedAvaliacao.tipo)} de {selectedAvaliacao?.materia}
            </DialogDescription>
          </DialogHeader>

          {selectedAvaliacao && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Professor</Label>
                  <p className="font-medium">{selectedAvaliacao.professorNome}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Valor</Label>
                  <p className="font-medium">{selectedAvaliacao.valorTotal} pontos</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Início</Label>
                  <p className="font-medium">
                    {format(new Date(selectedAvaliacao.dataInicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Prazo Final</Label>
                  <p className="font-medium">
                    {format(new Date(selectedAvaliacao.dataFim), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              {selectedAvaliacao.duracaoMinutos && (
                <div className="flex items-center gap-2 text-sm">
                  <Timer className="h-4 w-4" />
                  <span>Duração: {selectedAvaliacao.duracaoMinutos} minutos</span>
                </div>
              )}

              {selectedAvaliacao.descricao && (
                <div>
                  <Label className="text-muted-foreground">Descrição</Label>
                  <p className="mt-1">{selectedAvaliacao.descricao}</p>
                </div>
              )}

              {selectedAvaliacao.instrucoes && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
                  <Label className="text-amber-700 dark:text-amber-400">Instruções</Label>
                  <p className="mt-1 text-amber-900 dark:text-amber-100">{selectedAvaliacao.instrucoes}</p>
                </div>
              )}

              {selectedAvaliacao.arquivoUrl && (
                <div>
                  <Label className="text-muted-foreground">Material da Avaliação</Label>
                  <Button variant="outline" size="sm" className="mt-1" asChild>
                    <a href={selectedAvaliacao.arquivoUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      {selectedAvaliacao.arquivoNome || "Baixar arquivo"}
                    </a>
                  </Button>
                </div>
              )}

              {(() => {
                const entrega = getEntregaForAvaliacao(selectedAvaliacao.id);
                if (entrega) {
                  return (
                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-muted-foreground">Sua Entrega</Label>
                        <Badge variant={entrega.status === "corrigida" ? "default" : "secondary"}>
                          {entrega.status === "corrigida" ? "Corrigida" : "Aguardando correção"}
                        </Badge>
                      </div>

                      {entrega.dataEnvio && (
                        <p className="text-sm text-muted-foreground">
                          Enviado em {format(new Date(entrega.dataEnvio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}

                      {entrega.arquivoUrl && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={entrega.arquivoUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-2" />
                            {entrega.arquivoNome || "Seu arquivo"}
                          </a>
                        </Button>
                      )}

                      {entrega.status === "corrigida" && entrega.nota !== undefined && (
                        <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Award className="h-5 w-5 text-green-600" />
                            <span className="font-bold text-lg text-green-700 dark:text-green-400">
                              Nota: {entrega.nota}/{selectedAvaliacao.valorTotal}
                            </span>
                          </div>
                          {entrega.feedback && (
                            <div className="mt-2">
                              <Label className="text-green-700 dark:text-green-400">Feedback do Professor</Label>
                              <p className="mt-1 text-green-900 dark:text-green-100">{entrega.feedback}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}

          <DialogFooter>
            {selectedAvaliacao && !getEntregaForAvaliacao(selectedAvaliacao.id) && (
              <Button 
                onClick={() => { 
                  setViewDialogOpen(false);
                  setSubmitDialogOpen(true); 
                }}
                disabled={
                  !isWithinInterval(new Date(), { 
                    start: new Date(selectedAvaliacao.dataInicio), 
                    end: new Date(selectedAvaliacao.dataFim) 
                  })
                }
              >
                <Upload className="h-4 w-4 mr-2" />
                Entregar
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent data-testid="dialog-submit-avaliacao">
          <DialogHeader>
            <DialogTitle>Entregar Avaliação</DialogTitle>
            <DialogDescription>
              {selectedAvaliacao?.titulo}
            </DialogDescription>
          </DialogHeader>

          {selectedAvaliacao && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Prazo:</span>
                  <span className="font-medium">
                    {format(new Date(selectedAvaliacao.dataFim), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Tempo restante:</span>
                  <span className={`font-medium ${isPast(new Date(selectedAvaliacao.dataFim)) ? 'text-destructive' : 'text-green-600'}`}>
                    {isPast(new Date(selectedAvaliacao.dataFim)) 
                      ? "Prazo encerrado" 
                      : formatDistanceToNow(new Date(selectedAvaliacao.dataFim), { addSuffix: true, locale: ptBR })
                    }
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Arquivo da Entrega</Label>
                <FileUploadZone
                  onFileSelect={setUploadFile}
                  onFileRemove={() => setUploadFile(null)}
                  selectedFile={uploadFile}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSubmitDialogOpen(false);
                setUploadFile(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedAvaliacao && uploadFile) {
                  submitMutation.mutate({ avaliacaoId: selectedAvaliacao.id, file: uploadFile });
                }
              }}
              disabled={!uploadFile || submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-pulse" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Entregar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface AvaliacaoListAlunoProps {
  avaliacoes: Avaliacao[];
  loading: boolean;
  onView: (avaliacao: Avaliacao) => void;
  onSubmit: (avaliacao: Avaliacao) => void;
  getStatus: (avaliacao: Avaliacao) => { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: JSX.Element };
  getTipoIcon: (tipo: string) => JSX.Element;
  getTipoLabel: (tipo: string) => string;
  getEntrega: (id: string) => AvaliacaoEntrega | undefined;
  emptyMessage: string;
  emptyDescription: string;
  showNota?: boolean;
}

function AvaliacaoListAluno({
  avaliacoes,
  loading,
  onView,
  onSubmit,
  getStatus,
  getTipoIcon,
  getTipoLabel,
  getEntrega,
  emptyMessage,
  emptyDescription,
  showNota = false,
}: AvaliacaoListAlunoProps) {
  if (loading) {
    return (
      <>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </>
    );
  }

  if (avaliacoes.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">{emptyMessage}</p>
          <p className="text-sm text-muted-foreground">{emptyDescription}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {avaliacoes.map((avaliacao) => {
        const status = getStatus(avaliacao);
        const entrega = getEntrega(avaliacao.id);
        const now = new Date();
        const inicio = new Date(avaliacao.dataInicio);
        const fim = new Date(avaliacao.dataFim);
        const disponivel = isWithinInterval(now, { start: inicio, end: fim });

        return (
          <Card key={avaliacao.id} className="hover-elevate" data-testid={`card-avaliacao-${avaliacao.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {getTipoIcon(avaliacao.tipo)}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{avaliacao.titulo}</CardTitle>
                    <CardDescription className="mt-1">
                      {getTipoLabel(avaliacao.tipo)} de {avaliacao.materia} | Prof. {avaliacao.professorNome}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={status.variant} className="flex items-center gap-1">
                  {status.icon}
                  {status.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Prazo: {format(fim, "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Award className="h-4 w-4" />
                  <span>Valor: {avaliacao.valorTotal} pts</span>
                </div>
                {!entrega && disponivel && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-green-600 font-medium">
                      {formatDistanceToNow(fim, { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                )}
              </div>

              {showNota && entrega && entrega.nota !== undefined && (
                <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-green-600" />
                    <span className="font-bold text-green-700 dark:text-green-400">
                      Nota: {entrega.nota}/{avaliacao.valorTotal}
                    </span>
                    <span className="text-sm text-green-600">
                      ({((entrega.nota / avaliacao.valorTotal) * 100).toFixed(0)}%)
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => onView(avaliacao)}>
                <Eye className="h-4 w-4 mr-1" />
                Ver Detalhes
              </Button>
              {!entrega && disponivel && (
                <Button size="sm" onClick={() => onSubmit(avaliacao)}>
                  <Upload className="h-4 w-4 mr-1" />
                  Entregar
                </Button>
              )}
              {avaliacao.arquivoUrl && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={avaliacao.arquivoUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-1" />
                    Material
                  </a>
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </>
  );
}
