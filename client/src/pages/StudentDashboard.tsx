import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatusBadge } from "@/components/StatusBadge";
import { FileUploadZone } from "@/components/FileUploadZone";
import { LogOut, FileText, Upload, Download, Calendar, Award, CheckCircle2, Clock } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { Tarefa, Entrega } from "@shared/schema";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function StudentDashboard() {
  const { userData, signOut } = useAuth();
  const { toast } = useToast();
  const [selectedTarefa, setSelectedTarefa] = useState<Tarefa | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [submissionDialogOpen, setSubmissionDialogOpen] = useState(false);

  useEffect(() => {
    const handleFileError = (event: any) => {
      toast({
        title: "Erro no arquivo",
        description: event.detail.message,
        variant: "destructive",
      });
    };

    window.addEventListener('file-upload-error', handleFileError);
    return () => window.removeEventListener('file-upload-error', handleFileError);
  }, [toast]);

  const { data: tarefas, isLoading: loadingTarefas } = useQuery({
    queryKey: ["/api/tarefas", userData?.turma],
    queryFn: async () => {
      if (!userData?.turma) return [];
      const q = query(collection(db, "tarefas"), where("turma", "==", userData.turma));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Tarefa));
    },
    enabled: !!userData?.turma,
  });

  const { data: entregas, isLoading: loadingEntregas } = useQuery({
    queryKey: ["/api/entregas", userData?.uid],
    queryFn: async () => {
      if (!userData?.uid) return [];
      const q = query(collection(db, "entregas"), where("alunoId", "==", userData.uid));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Entrega));
    },
    enabled: !!userData?.uid,
  });

  const submitMutation = useMutation({
    mutationFn: async ({ tarefaId, file }: { tarefaId: string; file: File }) => {
      if (!userData) throw new Error("Usuário não autenticado");
      
      const tarefa = tarefas?.find(t => t.id === tarefaId);
      if (!tarefa) throw new Error("Tarefa não encontrada");
      
      const storageRef = ref(storage, `entregas/${userData.uid}/${tarefaId}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      const prazo = new Date(tarefa.prazo);
      const now = new Date();
      const status = isPast(prazo) ? "atrasado" : "entregue";
      
      const entregaData = {
        tarefaId,
        tarefaTitulo: tarefa.titulo,
        alunoId: userData.uid,
        alunoNome: userData.nome,
        alunoEmail: userData.email,
        dataEnvio: now.toISOString(),
        arquivo: downloadURL,
        arquivoNome: file.name,
        status,
      };
      
      await addDoc(collection(db, "entregas"), entregaData);
      return entregaData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entregas"] });
      toast({
        title: "Tarefa entregue com sucesso!",
        description: "Sua entrega foi registrada.",
      });
      setSubmissionDialogOpen(false);
      setUploadFile(null);
      setSelectedTarefa(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar tarefa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedTarefa || !uploadFile) return;
    submitMutation.mutate({ tarefaId: selectedTarefa.id, file: uploadFile });
  };

  const getEntregaForTarefa = (tarefaId: string) => {
    return entregas?.find(e => e.tarefaId === tarefaId);
  };

  const getTarefaStatus = (tarefa: Tarefa) => {
    const entrega = getEntregaForTarefa(tarefa.id);
    if (entrega) return entrega.status;
    
    const prazo = new Date(tarefa.prazo);
    if (isPast(prazo)) return "atrasado";
    return "pendente";
  };

  const stats = {
    pendentes: tarefas?.filter(t => getTarefaStatus(t) === "pendente").length || 0,
    entregues: tarefas?.filter(t => ["entregue", "atrasado"].includes(getTarefaStatus(t))).length || 0,
    avaliadas: entregas?.filter(e => e.status === "avaliado").length || 0,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">ENEM+</h1>
              <p className="text-xs text-muted-foreground">Área do Aluno</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-right mr-4 hidden sm:block">
              <p className="text-sm font-medium">{userData?.nome}</p>
              <p className="text-xs text-muted-foreground">Turma {userData?.turma}</p>
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} data-testid="button-logout">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-semibold mb-2">Bem-vindo, {userData?.nome?.split(' ')[0]}!</h2>
          <p className="text-muted-foreground">Acompanhe suas tarefas e progresso</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-pendentes">{stats.pendentes}</div>
              <p className="text-xs text-muted-foreground">Tarefas para fazer</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Entregues</CardTitle>
              <Upload className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-entregues">{stats.entregues}</div>
              <p className="text-xs text-muted-foreground">Aguardando avaliação</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avaliadas</CardTitle>
              <Award className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-avaliadas">{stats.avaliadas}</div>
              <p className="text-xs text-muted-foreground">Com nota</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="todas" className="space-y-4">
          <TabsList>
            <TabsTrigger value="todas" data-testid="tab-todas">Todas</TabsTrigger>
            <TabsTrigger value="pendentes" data-testid="tab-pendentes">Pendentes</TabsTrigger>
            <TabsTrigger value="entregues" data-testid="tab-entregues">Entregues</TabsTrigger>
            <TabsTrigger value="notas" data-testid="tab-notas">Notas</TabsTrigger>
          </TabsList>

          <TabsContent value="todas" className="space-y-4">
            {loadingTarefas ? (
              <>
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
              </>
            ) : tarefas && tarefas.length > 0 ? (
              tarefas.map((tarefa) => {
                const entrega = getEntregaForTarefa(tarefa.id);
                const status = getTarefaStatus(tarefa);
                const prazo = new Date(tarefa.prazo);
                
                return (
                  <Card key={tarefa.id} className="hover-elevate" data-testid={`card-tarefa-${tarefa.id}`}>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-xl">{tarefa.titulo}</CardTitle>
                          <CardDescription className="mt-1">
                            Professor: {tarefa.professorNome}
                          </CardDescription>
                        </div>
                        <StatusBadge status={status} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm">{tarefa.descricao}</p>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>Prazo: {format(prazo, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        </div>
                        <div>
                          <span className={isPast(prazo) ? "text-destructive font-medium" : ""}>
                            {isPast(prazo) ? "Atrasado" : formatDistanceToNow(prazo, { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      
                      {tarefa.arquivoAnexo && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={tarefa.arquivoAnexo} target="_blank" rel="noopener noreferrer" data-testid="button-download-anexo">
                            <Download className="h-4 w-4 mr-2" />
                            Baixar Material
                          </a>
                        </Button>
                      )}
                      
                      {entrega && entrega.nota !== undefined && (
                        <div className="p-4 bg-muted rounded-lg space-y-2">
                          <div className="flex items-center gap-2">
                            <Award className="h-5 w-5 text-primary" />
                            <span className="font-semibold">Nota: {entrega.nota.toFixed(1)}/10</span>
                          </div>
                          {entrega.feedback && (
                            <p className="text-sm text-muted-foreground">{entrega.feedback}</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter>
                      {entrega ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span>Entregue em {format(new Date(entrega.dataEnvio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        </div>
                      ) : (
                        <Button
                          onClick={() => {
                            setSelectedTarefa(tarefa);
                            setSubmissionDialogOpen(true);
                          }}
                          disabled={isPast(prazo)}
                          data-testid="button-entregar"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Entregar Tarefa
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Nenhuma tarefa disponível</p>
                  <p className="text-sm text-muted-foreground">Suas tarefas aparecerão aqui quando forem criadas</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="pendentes">
            <div className="space-y-4">
              {tarefas?.filter(t => getTarefaStatus(t) === "pendente").length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle2 className="h-16 w-16 text-green-600 mb-4" />
                    <p className="text-lg font-medium mb-2">Parabéns!</p>
                    <p className="text-sm text-muted-foreground">Você não tem tarefas pendentes</p>
                  </CardContent>
                </Card>
              ) : (
                tarefas?.filter(t => getTarefaStatus(t) === "pendente").map(tarefa => (
                  <Card key={tarefa.id} className="hover-elevate">
                    <CardHeader>
                      <CardTitle>{tarefa.titulo}</CardTitle>
                      <CardDescription>Professor: {tarefa.professorNome}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm mb-4">{tarefa.descricao}</p>
                      <div className="text-sm text-muted-foreground">
                        Prazo: {format(new Date(tarefa.prazo), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        onClick={() => {
                          setSelectedTarefa(tarefa);
                          setSubmissionDialogOpen(true);
                        }}
                        data-testid="button-entregar"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Entregar
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="entregues">
            <div className="space-y-4">
              {entregas?.filter(e => e.status === "entregue" || e.status === "atrasado").length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Upload className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">Nenhuma entrega aguardando avaliação</p>
                    <p className="text-sm text-muted-foreground">Suas entregas aparecerão aqui</p>
                  </CardContent>
                </Card>
              ) : (
                entregas?.filter(e => e.status === "entregue" || e.status === "atrasado").map(entrega => (
                  <Card key={entrega.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle>{entrega.tarefaTitulo}</CardTitle>
                          <CardDescription>
                            Entregue em {format(new Date(entrega.dataEnvio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </CardDescription>
                        </div>
                        <StatusBadge status={entrega.status} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" size="sm" asChild>
                        <a href={entrega.arquivo} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" />
                          Ver arquivo enviado
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="notas">
            <div className="space-y-4">
              {entregas?.filter(e => e.nota !== undefined).length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Award className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">Nenhuma nota ainda</p>
                    <p className="text-sm text-muted-foreground">Suas notas aparecerão aqui quando as tarefas forem avaliadas</p>
                  </CardContent>
                </Card>
              ) : (
                entregas?.filter(e => e.nota !== undefined).map(entrega => (
                  <Card key={entrega.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle>{entrega.tarefaTitulo}</CardTitle>
                          <CardDescription>
                            Avaliado em {format(new Date(entrega.dataEnvio), "dd/MM/yyyy", { locale: ptBR })}
                          </CardDescription>
                        </div>
                        <Badge variant="default" className="text-lg px-3 py-1">
                          {entrega.nota?.toFixed(1)}/10
                        </Badge>
                      </div>
                    </CardHeader>
                    {entrega.feedback && (
                      <CardContent>
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-sm font-medium mb-2">Feedback do Professor:</p>
                          <p className="text-sm text-muted-foreground">{entrega.feedback}</p>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={submissionDialogOpen} onOpenChange={setSubmissionDialogOpen}>
        <DialogContent data-testid="dialog-submit">
          <DialogHeader>
            <DialogTitle>Entregar Tarefa</DialogTitle>
            <DialogDescription>
              {selectedTarefa?.titulo}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <FileUploadZone
              onFileSelect={setUploadFile}
              onFileRemove={() => setUploadFile(null)}
              selectedFile={uploadFile}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSubmissionDialogOpen(false);
                setUploadFile(null);
              }}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!uploadFile || submitMutation.isPending}
              data-testid="button-confirm-submit"
            >
              {submitMutation.isPending && <Upload className="mr-2 h-4 w-4 animate-pulse" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
