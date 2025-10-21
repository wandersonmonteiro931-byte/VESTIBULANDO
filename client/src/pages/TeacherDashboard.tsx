import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatusBadge } from "@/components/StatusBadge";
import { FileUploadZone } from "@/components/FileUploadZone";
import { LogOut, Plus, FileText, Users, Download, Edit, Calendar, Award } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { Tarefa, Entrega } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const tarefaFormSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  turma: z.string().min(1, "Turma é obrigatória"),
  prazo: z.string().min(1, "Prazo é obrigatório"),
});

const avaliacaoFormSchema = z.object({
  nota: z.number().min(0, "Nota mínima é 0").max(10, "Nota máxima é 10"),
  feedback: z.string().optional(),
});

export default function TeacherDashboard() {
  const { userData, signOut } = useAuth();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [selectedEntrega, setSelectedEntrega] = useState<Entrega | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

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

  const tarefaForm = useForm<z.infer<typeof tarefaFormSchema>>({
    resolver: zodResolver(tarefaFormSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      turma: "",
      prazo: "",
    },
  });

  const avaliacaoForm = useForm<z.infer<typeof avaliacaoFormSchema>>({
    resolver: zodResolver(avaliacaoFormSchema),
    defaultValues: {
      nota: 0,
      feedback: "",
    },
  });

  const { data: tarefas, isLoading: loadingTarefas } = useQuery({
    queryKey: ["/api/tarefas", userData?.uid],
    queryFn: async () => {
      if (!userData?.uid) return [];
      const q = query(collection(db, "tarefas"), where("professorId", "==", userData.uid));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Tarefa));
    },
    enabled: !!userData?.uid,
  });

  const { data: entregas, isLoading: loadingEntregas } = useQuery({
    queryKey: ["/api/entregas"],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, "entregas"));
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Entrega));
    },
  });

  const createTarefaMutation = useMutation({
    mutationFn: async (data: z.infer<typeof tarefaFormSchema>) => {
      if (!userData) throw new Error("Usuário não autenticado");
      
      let arquivoAnexo = undefined;
      let arquivoNome = undefined;
      
      if (attachmentFile) {
        const storageRef = ref(storage, `tarefas/${userData.uid}/${Date.now()}_${attachmentFile.name}`);
        await uploadBytes(storageRef, attachmentFile);
        arquivoAnexo = await getDownloadURL(storageRef);
        arquivoNome = attachmentFile.name;
      }
      
      const tarefaData = {
        ...data,
        professorId: userData.uid,
        professorNome: userData.nome,
        criadoEm: new Date().toISOString(),
        arquivoAnexo,
        arquivoNome,
      };
      
      await addDoc(collection(db, "tarefas"), tarefaData);
      return tarefaData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
      toast({
        title: "Tarefa criada com sucesso!",
        description: "A tarefa foi disponibilizada para os alunos.",
      });
      setCreateDialogOpen(false);
      tarefaForm.reset();
      setAttachmentFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar tarefa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const gradeMutation = useMutation({
    mutationFn: async ({ entregaId, data }: { entregaId: string; data: z.infer<typeof avaliacaoFormSchema> }) => {
      const entregaRef = doc(db, "entregas", entregaId);
      await updateDoc(entregaRef, {
        nota: data.nota,
        feedback: data.feedback || "",
        status: "avaliado",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entregas"] });
      toast({
        title: "Avaliação salva com sucesso!",
        description: "O aluno poderá visualizar a nota e feedback.",
      });
      setGradeDialogOpen(false);
      setSelectedEntrega(null);
      avaliacaoForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao avaliar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getEntregasForTarefa = (tarefaId: string) => {
    return entregas?.filter(e => e.tarefaId === tarefaId) || [];
  };

  const pendingGradings = entregas?.filter(e => e.status === "entregue" || e.status === "atrasado").length || 0;

  const stats = {
    tarefas: tarefas?.length || 0,
    pendentes: pendingGradings,
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
              <p className="text-xs text-muted-foreground">Área do Professor</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-right mr-4 hidden sm:block">
              <p className="text-sm font-medium">{userData?.nome}</p>
              <p className="text-xs text-muted-foreground">Professor</p>
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} data-testid="button-logout">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-semibold mb-2">Minhas Tarefas</h2>
            <p className="text-muted-foreground">Gerencie tarefas e avalie entregas</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-tarefa">
            <Plus className="h-4 w-4 mr-2" />
            Nova Tarefa
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Tarefas</CardTitle>
              <FileText className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-tarefas">{stats.tarefas}</div>
              <p className="text-xs text-muted-foreground">Tarefas criadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Users className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-pendentes">{stats.pendentes}</div>
              <p className="text-xs text-muted-foreground">Aguardando correção</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avaliadas</CardTitle>
              <Award className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-avaliadas">{stats.avaliadas}</div>
              <p className="text-xs text-muted-foreground">Já corrigidas</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="tarefas" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tarefas" data-testid="tab-tarefas">Minhas Tarefas</TabsTrigger>
            <TabsTrigger value="correcoes" data-testid="tab-correcoes">
              Correções Pendentes
              {pendingGradings > 0 && (
                <Badge variant="destructive" className="ml-2">{pendingGradings}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tarefas" className="space-y-4">
            {loadingTarefas ? (
              <>
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
              </>
            ) : tarefas && tarefas.length > 0 ? (
              tarefas.map((tarefa) => {
                const entregasTarefa = getEntregasForTarefa(tarefa.id);
                const totalEntregas = entregasTarefa.length;
                const avaliadas = entregasTarefa.filter(e => e.status === "avaliado").length;
                
                return (
                  <Card key={tarefa.id} className="hover-elevate" data-testid={`card-tarefa-${tarefa.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-xl">{tarefa.titulo}</CardTitle>
                          <CardDescription className="mt-1">
                            Turma: {tarefa.turma}
                          </CardDescription>
                        </div>
                        <Badge variant="outline">
                          {totalEntregas} {totalEntregas === 1 ? "entrega" : "entregas"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm">{tarefa.descricao}</p>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>Prazo: {format(new Date(tarefa.prazo), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        </div>
                      </div>
                      
                      {tarefa.arquivoAnexo && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={tarefa.arquivoAnexo} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-2" />
                            Material anexado
                          </a>
                        </Button>
                      )}
                      
                      {totalEntregas > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Progresso:</span>
                          <div className="flex-1 bg-secondary rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${(avaliadas / totalEntregas) * 100}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground">{avaliadas}/{totalEntregas}</span>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter>
                      <p className="text-sm text-muted-foreground">
                        Criada em {format(new Date(tarefa.criadoEm), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </CardFooter>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Nenhuma tarefa criada</p>
                  <p className="text-sm text-muted-foreground mb-4">Comece criando sua primeira tarefa</p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Tarefa
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="correcoes" className="space-y-4">
            {entregas?.filter(e => e.status === "entregue" || e.status === "atrasado").length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Award className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Nenhuma correção pendente</p>
                  <p className="text-sm text-muted-foreground">Todas as entregas foram avaliadas</p>
                </CardContent>
              </Card>
            ) : (
              entregas?.filter(e => e.status === "entregue" || e.status === "atrasado").map(entrega => (
                <Card key={entrega.id} className="hover-elevate">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle>{entrega.tarefaTitulo}</CardTitle>
                        <CardDescription>
                          Aluno: {entrega.alunoNome} ({entrega.alunoEmail})
                        </CardDescription>
                      </div>
                      <StatusBadge status={entrega.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Entregue em {format(new Date(entrega.dataEnvio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                    
                    <Button variant="outline" size="sm" asChild>
                      <a href={entrega.arquivo} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4 mr-2" />
                        Baixar arquivo ({entrega.arquivoNome})
                      </a>
                    </Button>
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={() => {
                        setSelectedEntrega(entrega);
                        setGradeDialogOpen(true);
                      }}
                      data-testid="button-avaliar"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Avaliar
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-create-tarefa">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
            <DialogDescription>
              Crie uma nova tarefa para seus alunos
            </DialogDescription>
          </DialogHeader>

          <Form {...tarefaForm}>
            <form onSubmit={tarefaForm.handleSubmit((data) => createTarefaMutation.mutate(data))} className="space-y-4">
              <FormField
                control={tarefaForm.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Redação sobre Meio Ambiente" {...field} data-testid="input-titulo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={tarefaForm.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descreva a tarefa em detalhes..." 
                        rows={4}
                        {...field} 
                        data-testid="input-descricao"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={tarefaForm.control}
                name="turma"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Turma</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 3A" {...field} data-testid="input-turma" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={tarefaForm.control}
                name="prazo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prazo</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} data-testid="input-prazo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label>Material de Apoio (opcional)</Label>
                <FileUploadZone
                  onFileSelect={setAttachmentFile}
                  onFileRemove={() => setAttachmentFile(null)}
                  selectedFile={attachmentFile}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCreateDialogOpen(false);
                    tarefaForm.reset();
                    setAttachmentFile(null);
                  }}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createTarefaMutation.isPending} data-testid="button-save">
                  {createTarefaMutation.isPending && <Plus className="mr-2 h-4 w-4 animate-pulse" />}
                  Criar Tarefa
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={gradeDialogOpen} onOpenChange={setGradeDialogOpen}>
        <DialogContent data-testid="dialog-avaliar">
          <DialogHeader>
            <DialogTitle>Avaliar Entrega</DialogTitle>
            <DialogDescription>
              {selectedEntrega?.alunoNome} - {selectedEntrega?.tarefaTitulo}
            </DialogDescription>
          </DialogHeader>

          <Form {...avaliacaoForm}>
            <form 
              onSubmit={avaliacaoForm.handleSubmit((data) => {
                if (selectedEntrega) {
                  gradeMutation.mutate({ entregaId: selectedEntrega.id, data });
                }
              })} 
              className="space-y-4"
            >
              <FormField
                control={avaliacaoForm.control}
                name="nota"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nota (0-10)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        max="10" 
                        step="0.5"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        data-testid="input-nota"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={avaliacaoForm.control}
                name="feedback"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Feedback (opcional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Deixe comentários para o aluno..." 
                        rows={4}
                        {...field}
                        data-testid="input-feedback"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setGradeDialogOpen(false);
                    setSelectedEntrega(null);
                    avaliacaoForm.reset();
                  }}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={gradeMutation.isPending} data-testid="button-save">
                  {gradeMutation.isPending && <Award className="mr-2 h-4 w-4 animate-pulse" />}
                  Salvar Avaliação
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
