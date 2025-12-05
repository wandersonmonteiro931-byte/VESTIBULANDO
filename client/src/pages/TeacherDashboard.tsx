import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { collection, where, addDoc, updateDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrasiliaClock } from "@/components/BrasiliaClock";
import { StatusBadge } from "@/components/StatusBadge";
import { FileUploadZone } from "@/components/FileUploadZone";
import { AnnouncementsCarousel } from "@/components/AnnouncementsCarousel";
import { ChatNotificationBubble } from "@/components/ChatNotificationBubble";
import { LogOut, Plus, FileText, Users, Download, Edit, Calendar, Award, MessageCircle, ClipboardList, GraduationCap, CalendarClock, AlertTriangle, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AvaliacoesTab } from "@/components/AvaliacoesTab";
import { BoletimTab } from "@/components/BoletimTab";
import { BimestresNotasTab } from "@/components/BimestresNotasTab";
import { DisciplinaryRequestsTab } from "@/components/DisciplinaryRequestsTab";
import { HorarioViewer } from "@/components/HorarioViewer";
import { PresencasTab } from "@/components/PresencasTab";
import { PendingIndicator } from "@/components/PendingIndicator";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { AttendanceConfirmationModal } from "@/components/AttendanceConfirmationModal";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import type { Tarefa, Entrega } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";
import { cn } from "@/lib/utils";

const tarefaFormSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  materia: z.string().min(1, "Matéria é obrigatória"),
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
  const [selectedSection, setSelectedSection] = useState("inicio");
  
  const { hasUnread, latestMessage, showNotification, dismissNotification } = useUnreadMessages();

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
      materia: "",
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

  const { data: tarefas, isLoading: loadingTarefas } = useRealtimeQuery<Tarefa>({
    collectionName: "tarefas",
    queryKey: ["/api/tarefas", userData?.uid],
    constraints: userData?.uid ? [where("professorId", "==", userData.uid)] : [],
    transform: (docs) => docs as Tarefa[],
    enabled: !!userData?.uid,
  });

  const { data: entregas, isLoading: loadingEntregas } = useRealtimeQuery<Entrega>({
    collectionName: "entregas",
    queryKey: ["/api/entregas", userData?.uid],
    constraints: userData?.uid ? [where("professorId", "==", userData.uid)] : [],
    transform: (docs) => docs as Entrega[],
    enabled: !!userData?.uid,
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
      
      const tarefaData: any = {
        ...data,
        professorId: userData.uid,
        professorNome: userData.nome,
        criadoEm: getNowBrasiliaISO(),
      };
      
      if (arquivoAnexo) {
        tarefaData.arquivoAnexo = arquivoAnexo;
        tarefaData.arquivoNome = arquivoNome;
      }
      
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

  const pendingCount = entregas?.filter(e => e.status === "entregue" || e.status === "atrasado").length || 0;

  const stats = {
    tarefas: tarefas?.length || 0,
    pendentes: pendingCount,
    avaliadas: entregas?.filter(e => e.status === "avaliado").length || 0,
  };

  return (
    <SidebarProvider style={{ "--sidebar-width": "280px" } as React.CSSProperties}>
      <div className="flex min-h-screen w-full">
        <DashboardSidebar
          role="professor"
          selectedItem={selectedSection}
          onSelectItem={setSelectedSection}
          pendingCounts={{ correcoes: pendingCount }}
          userName={userData?.nome}
          userRole="Professor"
        />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-50 w-full border-b bg-gradient-to-r from-card via-card to-card/95 backdrop-blur-xl shadow-sm">
            <div className="flex h-16 items-center justify-between px-4 gap-4">
              <div className="flex items-center gap-3">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="hidden sm:flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-md shadow-primary/20">
                    <FileText className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Vestibulando</h1>
                    <p className="text-xs text-muted-foreground font-medium">Área do Professor</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="text-right mr-2 hidden md:block">
                  <p className="text-sm font-semibold">{userData?.nome}</p>
                  <p className="text-xs text-muted-foreground">Professor</p>
                </div>
                <ThemeToggle />
                <BrasiliaClock />
                <Link href="/chat">
                  <Button 
                    variant="outline" 
                    size="icon"
                    className={cn(
                      "flex flex-col h-auto py-2 px-3 gap-1 relative",
                      hasUnread && "animate-pulse border-primary"
                    )}
                    data-testid="button-chat-header"
                  >
                    <MessageCircle className={cn("h-4 w-4", hasUnread && "text-primary")} />
                    <span className="text-xs font-normal">Chat</span>
                    {hasUnread && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-ping" />
                    )}
                    {hasUnread && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full" />
                    )}
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" onClick={signOut} data-testid="button-logout">
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </header>
          
          {latestMessage && (
            <ChatNotificationBubble
              show={showNotification}
              senderName={latestMessage.senderName}
              message={latestMessage.text}
              conversationId={latestMessage.conversationId}
              onDismiss={dismissNotification}
            />
          )}

          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto">
              {selectedSection === "inicio" && (
                <>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                    <div>
                      <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        Painel do Professor
                      </h2>
                      <p className="text-muted-foreground">Gerencie atividades e avalie entregas</p>
                    </div>
                  </div>

                  <div className="mb-8">
                    <AnnouncementsCarousel userType="professor" />
                  </div>

                  {(!userData?.materias || userData.materias.length === 0) && (
                    <Alert variant="destructive" className="mb-8" data-testid="alert-no-subjects">
                      <AlertTriangle className="h-5 w-5" />
                      <AlertTitle>Nenhuma matéria atribuída</AlertTitle>
                      <AlertDescription>
                        Você ainda não possui matérias atribuídas ao seu perfil. Entre em contato com a diretoria para que realizem o cadastro das suas matérias. 
                        Sem matérias cadastradas, você não poderá criar atividades, provas ou lançar notas.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5 hover-elevate">
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
                        <CardTitle className="text-sm font-semibold">Total de Tarefas</CardTitle>
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-primary" data-testid="stat-tarefas">{stats.tarefas}</div>
                        <p className="text-xs text-muted-foreground mt-1">Tarefas criadas</p>
                      </CardContent>
                    </Card>

                    <Card className="border-amber-200/50 dark:border-amber-900/50 bg-gradient-to-br from-card to-amber-50/30 dark:to-amber-950/10 hover-elevate">
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
                        <CardTitle className="text-sm font-semibold">Pendentes</CardTitle>
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                          <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-amber-600 dark:text-amber-400" data-testid="stat-pendentes">{stats.pendentes}</div>
                        <p className="text-xs text-muted-foreground mt-1">Aguardando correção</p>
                      </CardContent>
                    </Card>

                    <Card className="border-green-200/50 dark:border-green-900/50 bg-gradient-to-br from-card to-green-50/30 dark:to-green-950/10 hover-elevate">
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
                        <CardTitle className="text-sm font-semibold">Avaliadas</CardTitle>
                        <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
                          <Award className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="stat-avaliadas">{stats.avaliadas}</div>
                        <p className="text-xs text-muted-foreground mt-1">Já corrigidas</p>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}

              <div className="space-y-6">
                {selectedSection === "avaliacoes" && (
                  <AvaliacoesTab userType="professor" />
                )}

                {selectedSection === "horarios" && (
                  <HorarioViewer 
                    userType="professor"
                    professorId={userData?.uid}
                  />
                )}

                {selectedSection === "presencas" && (
                  <PresencasTab 
                    userType="professor"
                    professorId={userData?.uid}
                  />
                )}

                {selectedSection === "bimestres" && (
                  <BimestresNotasTab />
                )}

                {selectedSection === "disciplinar" && (
                  <DisciplinaryRequestsTab />
                )}

                {selectedSection === "correcoes" && (
                  <div className="space-y-4">
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
                  </div>
                )}

                {selectedSection === "boletins" && userData?.tipo === "diretor" && (
                  <BoletimTab />
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

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
                name="materia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Matéria *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-materia">
                          <SelectValue placeholder="Selecione a matéria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {userData?.materias && userData.materias.length > 0 ? (
                          userData.materias.map((materia: string) => (
                            <SelectItem key={materia} value={materia}>
                              {materia}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="_no_materias" disabled>
                            Nenhuma matéria atribuída
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
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
      <AttendanceConfirmationModal userType="professor" />
    </SidebarProvider>
  );
}
