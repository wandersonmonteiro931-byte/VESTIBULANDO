import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { collection, where, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, storageAvailable } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useWarningAlert } from "@/contexts/WarningAlertContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrasiliaClock } from "@/components/BrasiliaClock";
import { StatusBadge } from "@/components/StatusBadge";
import { FileUploadZone } from "@/components/FileUploadZone";
import { AnnouncementsCarousel } from "@/components/AnnouncementsCarousel";
import { ChatNotificationBubble } from "@/components/ChatNotificationBubble";
import { LogOut, FileText, Upload, Download, Calendar, Award, CheckCircle2, Clock, AlertTriangle, MessageCircle, WalletCards, Video, ClipboardList, Sparkles } from "lucide-react";
import { AlunoAvaliacoesTab } from "@/components/AlunoAvaliacoesTab";
import { AlunoBoletimTab } from "@/components/AlunoBoletimTab";
import { AlunoPresencasTab } from "@/components/AlunoPresencasTab";
import { AlunoAulasTab } from "@/components/AlunoAulasTab";
import { StudentFinanceTab } from "@/components/StudentFinanceTab";
import { HorarioViewer } from "@/components/HorarioViewer";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import type { Tarefa, Entrega, DisciplinaryAction } from "@shared/schema";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import assinaturaDeclaracaoUrl from "@assets/Captura de tela 2025-10-23 011843_1761193443162.png";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { AttendanceConfirmationModal } from "@/components/AttendanceConfirmationModal";
import { LiveClassNotification } from "@/components/LiveClassNotification";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { MobileBottomNav } from "@/components/MobileBottomNav";

export default function StudentDashboard() {
  const { userData, signOut } = useAuth();
  const { toast } = useToast();
  const { triggerWarningAlert } = useWarningAlert();
  const [selectedTarefa, setSelectedTarefa] = useState<Tarefa | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [submissionDialogOpen, setSubmissionDialogOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState("inicio");
  const warningAlertShownRef = useRef(false);
  
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

  const { data: turmas } = useRealtimeQuery({
    collectionName: "turmas",
    queryKey: ["/api/turmas/all"],
  });

  const nomeTurma = turmas?.find((t: any) => t.id === userData?.turma)?.nome || userData?.turma;

  const { data: tarefas, isLoading: loadingTarefas } = useRealtimeQuery<Tarefa>({
    collectionName: "tarefas",
    queryKey: ["/api/tarefas", userData?.turma],
    constraints: userData?.turma ? [where("turma", "==", userData.turma)] : [],
    transform: (docs) => docs as Tarefa[],
    enabled: !!userData?.turma,
  });

  const { data: entregas, isLoading: loadingEntregas } = useRealtimeQuery<Entrega>({
    collectionName: "entregas",
    queryKey: ["/api/entregas", userData?.uid],
    constraints: userData?.uid ? [where("alunoId", "==", userData.uid)] : [],
    transform: (docs) => docs as Entrega[],
    enabled: !!userData?.uid,
  });

  const { data: disciplinaryActions, isLoading: loadingDisciplinary } = useRealtimeQuery({
    collectionName: "disciplinaryActions",
    queryKey: ["/api/disciplinaryActions", userData?.uid],
    constraints: userData?.uid ? [where("alunoId", "==", userData.uid)] : [],
    enabled: !!userData?.uid,
  });

  useEffect(() => {
    if (!disciplinaryActions || loadingDisciplinary || warningAlertShownRef.current) return;
    
    const activeWarnings = (disciplinaryActions as DisciplinaryAction[]).filter(
      (action) => action.tipo === "advertencia" && action.ativo === true
    );
    
    const unviewedWarning = activeWarnings.find((action) => !action.visualizado);
    
    if (unviewedWarning && userData) {
      warningAlertShownRef.current = true;
      triggerWarningAlert({
        id: unviewedWarning.id,
        alunoNome: userData.nome,
        comentario: unviewedWarning.comentario,
        dataAplicacao: unviewedWarning.dataAplicacao,
        aplicadoPorNome: unviewedWarning.aplicadoPorNome,
        warningsCount: activeWarnings.length,
      });
    }
  }, [disciplinaryActions, loadingDisciplinary, userData, triggerWarningAlert]);

  const submitMutation = useMutation({
    mutationFn: async ({ tarefaId, file }: { tarefaId: string; file: File }) => {
      if (!userData) throw new Error("Usuário não autenticado");
      
      const tarefa = tarefas?.find(t => t.id === tarefaId);
      if (!tarefa) throw new Error("Tarefa não encontrada");
      
      if (!storageAvailable || !storage) {
        throw new Error("O envio de arquivos não está disponível no momento. Por favor, entre em contato com a escola.");
      }
      
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
        professorId: tarefa.professorId,
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

  const pendingCount = stats.pendentes;
  const warningsCount = disciplinaryActions?.filter((a: any) => a.ativo).length || 0;

  const generateDeclaracaoMatricula = async () => {
    if (!userData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPos = 30;

    const addCenteredText = (text: string, y: number, fontSize: number, bold: boolean = false) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.text(text, pageWidth / 2, y, { align: "center" });
    };

    const addJustifiedText = (text: string, y: number, fontSize: number = 11) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
      doc.text(lines, margin, y, { align: "justify", maxWidth: pageWidth - 2 * margin });
      return y + (lines.length * fontSize * 0.5);
    };

    addCenteredText("PREPARATÓRIO VESTIBULANDO", yPos, 14, true);
    yPos += 10;
    addCenteredText("DECLARAÇÃO DE MATRÍCULA", yPos, 12, true);
    yPos += 15;

    const nome = userData.nome.toUpperCase();
    const cpf = userData.cpf || "N/A";
    const texto1 = `          Declaramos para os devidos fins, que o(a) aluno(a): ${nome}, portador(a) do CPF de Número: ${cpf}, encontra-se devidamente matriculado(a) no CURSO ONLINE PREPARATÓRIO, na área de formação continuada em EDUCAÇÃO. O curso é oferecido por VESTIBULANDO EAD, por meio da plataforma online.`;
    yPos = addJustifiedText(texto1, yPos);
    yPos += 10;

    const texto2 = `          Esta declaração não substitui o certificado de conclusão de curso, caso o aluno não apresente o respectivo em 60(sessenta) dias, a mesma será considerada inválida.`;
    yPos = addJustifiedText(texto2, yPos);
    yPos += 10;

    const texto3 = `          Somos uma Instituição de Ensino a Distância, devidamente constituída, fazemos parte do grupo Vestibulando Cursos On-line. Nossos cursos são todos online e são considerados cursos livres (nível básico). Não somos uma IES (Instituição de Ensino Superior). Não oferecemos cursos de graduação, extensão ou pós-graduação.`;
    yPos = addJustifiedText(texto3, yPos);
    yPos += 10;

    const texto4 = `          Nosso certificado é um documento verídico, com amparo legal em todo o território nacional, pois está em conformidade com a Lei nº 9.394/96, com o Decreto Presidencial nº 5.154/04 e o 1º a ser emitido, de acordo com os critérios do Ministério Público de Goiás.`;
    yPos = addJustifiedText(texto4, yPos);
    yPos += 10;

    const texto5 = `          O título do curso não implica em formação profissional. Sua certificação não permite o exercício da profissão regulamentada em lei, sem que sejam atendidos todos os requisitos legalmente exigidos pela categoria.`;
    yPos = addJustifiedText(texto5, yPos);
    yPos += 10;

    const matricula = userData.matricula || "N/A";
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`          Número de matrícula atual do aluno: ${matricula}`, margin, yPos);
    yPos += 20;

    const hoje = new Date();
    const dia = hoje.getDate().toString().padStart(2, '0');
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const mes = meses[hoje.getMonth()];
    const ano = hoje.getFullYear();
    const dataExtenso = `${dia} de ${mes} de ${ano}.`;
    
    addCenteredText(dataExtenso, yPos, 11);
    yPos += 10;

    try {
      const assinaturaImg = new Image();
      assinaturaImg.src = assinaturaDeclaracaoUrl;
      await new Promise((resolve) => {
        assinaturaImg.onload = resolve;
        assinaturaImg.onerror = resolve;
      });
      const imgWidth = assinaturaImg.width * 0.18;
      const imgHeight = assinaturaImg.height * 0.18;
      doc.addImage(assinaturaImg, "PNG", (pageWidth - imgWidth) / 2, yPos, imgWidth, imgHeight);
    } catch (error) {
      console.error("Erro ao carregar assinatura:", error);
      yPos += 5;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("_".repeat(50), pageWidth / 2, yPos, { align: "center" });
      yPos += 5;
      doc.text("Diretor Responsável", pageWidth / 2, yPos, { align: "center" });
    }

    const fileName = `Declaracao_Matricula_${userData.nome.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
    doc.save(fileName);

    toast({
      title: "Declaração gerada!",
      description: "O download começará automaticamente.",
    });
  };

  return (
    <SidebarProvider style={{ "--sidebar-width": "280px" } as React.CSSProperties}>
      <div className="dashboard-modern dashboard-student flex min-h-screen w-full">
        <DashboardSidebar
          role="aluno"
          selectedItem={selectedSection}
          onSelectItem={setSelectedSection}
          pendingCounts={{ pendentes: pendingCount, advertencias: warningsCount }}
          userName={userData?.nome}
          userRole="Aluno"
        />
        <div className="flex-1 flex flex-col">
          <header className="dashboard-topbar sticky top-0 z-50 w-full">
            <div className="dashboard-topbar-inner container flex items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-3">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="dashboard-brand-mark">
                  <FileText className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="dashboard-brand-title">Vestibulando</h1>
                  <p className="text-xs text-muted-foreground font-medium">Área do Aluno</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="text-right mr-2 hidden sm:block">
                  <p className="text-sm font-semibold">{userData?.nome}</p>
                  <p className="text-xs text-muted-foreground">Turma {nomeTurma}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={generateDeclaracaoMatricula}
                  data-testid="button-declaracao-matricula"
                  className="hidden sm:flex"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Declaração
                </Button>
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

          <main className="dashboard-main container px-4 sm:px-6 pt-6 pb-28 md:pb-8 max-w-7xl mx-auto flex-1">
            {selectedSection === "inicio" && (
              <>
                <div className="mb-6 md:hidden">
                  <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/10 via-background to-sky-50 shadow-sm dark:to-slate-900">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                            <Sparkles className="h-3.5 w-3.5" /> Espaço do aluno
                          </div>
                          <h2 className="text-2xl font-bold tracking-tight text-foreground">Sua jornada escolar começa aqui</h2>
                          <p className="mt-2 text-sm text-muted-foreground">Turma {nomeTurma} • {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
                        </div>
                        <Badge className="rounded-full bg-primary/15 px-3 py-1 text-primary">Aluno</Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Button variant="outline" className="h-auto justify-start rounded-2xl px-3 py-3" onClick={() => setSelectedSection('horarios')}>
                          <Clock className="mr-2 h-4 w-4 text-primary" /> Meu horário
                        </Button>
                        <Button variant="outline" className="h-auto justify-start rounded-2xl px-3 py-3" onClick={() => setSelectedSection('aulas')}>
                          <Video className="mr-2 h-4 w-4 text-primary" /> Aulas ao vivo
                        </Button>
                        <Button variant="outline" className="h-auto justify-start rounded-2xl px-3 py-3" onClick={() => setSelectedSection('todas')}>
                          <ClipboardList className="mr-2 h-4 w-4 text-primary" /> Tarefas
                        </Button>
                        <Button variant="outline" className="h-auto justify-start rounded-2xl px-3 py-3" onClick={() => setSelectedSection('financeiro')}>
                          <WalletCards className="mr-2 h-4 w-4 text-primary" /> Financeiro
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="dashboard-hero mb-8">
                  <span className="dashboard-eyebrow">Visão geral</span>
                  <h2 className="dashboard-hero-title">
                    {(() => {
                      const now = new Date();
                      const brasiliaOffset = -3;
                      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                      const brasiliaTime = new Date(utc + (3600000 * brasiliaOffset));
                      const hour = brasiliaTime.getHours();
                      
                      let greeting = "";
                      if (hour >= 5 && hour < 12) {
                        greeting = "Bom dia";
                      } else if (hour >= 12 && hour < 18) {
                        greeting = "Boa tarde";
                      } else {
                        greeting = "Boa noite";
                      }
                      
                      return `${greeting}, ${userData?.nome?.split(' ')[0]}!`;
                    })()}
                  </h2>
                  <p className="dashboard-hero-subtitle">Acompanhe suas tarefas, entregas e evolução acadêmica.</p>
                </div>

                <div className="mb-10">
                  <AnnouncementsCarousel userType="aluno" userTurma={userData?.turma} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                  <Card className="dashboard-stat-card dashboard-stat-amber">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
                      <CardTitle className="text-sm font-semibold">Pendentes</CardTitle>
                      <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                        <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-amber-600 dark:text-amber-400" data-testid="stat-pendentes">{stats.pendentes}</div>
                      <p className="text-xs text-muted-foreground mt-1">Tarefas para fazer</p>
                    </CardContent>
                  </Card>

                  <Card className="dashboard-stat-card dashboard-stat-blue">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
                      <CardTitle className="text-sm font-semibold">Entregues</CardTitle>
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                        <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400" data-testid="stat-entregues">{stats.entregues}</div>
                      <p className="text-xs text-muted-foreground mt-1">Aguardando avaliação</p>
                    </CardContent>
                  </Card>

                  <Card className="dashboard-stat-card dashboard-stat-green">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
                      <CardTitle className="text-sm font-semibold">Avaliadas</CardTitle>
                      <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
                        <Award className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="stat-avaliadas">{stats.avaliadas}</div>
                      <p className="text-xs text-muted-foreground mt-1">Com nota</p>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            <div className="space-y-6">
              {selectedSection === "todas" && (
                <div className="space-y-4">
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
                </div>
              )}

              {selectedSection === "horarios" && (
                <HorarioViewer 
                  userType="aluno"
                  turmaId={userData?.turma}
                  turmaNome={nomeTurma}
                />
              )}

              {selectedSection === "presencas" && (
                <AlunoPresencasTab />
              )}

              {selectedSection === "avaliacoes" && (
                <div className="space-y-4">
                  <AlunoAvaliacoesTab />
                </div>
              )}

              {selectedSection === "aulas" && (
                <AlunoAulasTab />
              )}

              {selectedSection === "pendentes" && (
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
              )}

              {selectedSection === "entregues" && (
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
              )}

              {selectedSection === "notas" && (
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
              )}

              {selectedSection === "advertencias" && (
                <div className="space-y-4">
                  {loadingDisciplinary ? (
                    <>
                      <Skeleton className="h-32 w-full" />
                      <Skeleton className="h-32 w-full" />
                    </>
                  ) : !disciplinaryActions || disciplinaryActions.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <CheckCircle2 className="h-16 w-16 text-green-600 mb-4" />
                        <p className="text-lg font-medium mb-2">Nenhuma advertência</p>
                        <p className="text-sm text-muted-foreground">
                          Você não possui advertências ou suspensões registradas
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {disciplinaryActions
                        .filter((action: any) => action.ativo)
                        .sort((a: any, b: any) => new Date(b.dataAplicacao).getTime() - new Date(a.dataAplicacao).getTime())
                        .map((action: any) => {
                          const isSuspension = action.tipo === "suspensao";
                          const dataAplicacao = new Date(action.dataAplicacao);
                          const dataTermino = action.dataTerminoSuspensao ? new Date(action.dataTerminoSuspensao) : null;

                          return (
                            <Card key={action.id} className={isSuspension ? "border-red-500" : "border-yellow-500"}>
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className={`h-5 w-5 ${isSuspension ? 'text-red-600' : 'text-yellow-600'}`} />
                                    <CardTitle className="text-lg">
                                      {isSuspension ? "Suspensão Disciplinar" : "Advertência"}
                                    </CardTitle>
                                  </div>
                                  <Badge 
                                    variant={isSuspension ? "destructive" : "outline"}
                                    className={isSuspension ? "" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"}
                                  >
                                    Ativa
                                  </Badge>
                                </div>
                                <CardDescription>
                                  Aplicada em {dataAplicacao.toLocaleDateString('pt-BR')} às {dataAplicacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {isSuspension && dataTermino && (
                                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                    <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
                                      Sua conta está suspensa
                                    </p>
                                    <p className="text-sm text-red-700 dark:text-red-300">
                                      Término: {dataTermino.toLocaleDateString('pt-BR')} às {dataTermino.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                )}

                                <div>
                                  <p className="text-sm text-muted-foreground mb-1">Aplicada por:</p>
                                  <p className="text-sm font-medium">{action.aplicadoPorNome}</p>
                                </div>

                                {action.comentario && (
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-1">Motivo:</p>
                                    <div className="p-3 bg-muted rounded-lg">
                                      <p className="text-sm">{action.comentario}</p>
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}

                      {disciplinaryActions.filter((action: any) => action.ativo).length === 0 && (
                        <Card>
                          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                            <CheckCircle2 className="h-16 w-16 text-green-600 mb-4" />
                            <p className="text-lg font-medium mb-2">Nenhuma advertência ativa</p>
                            <p className="text-sm text-muted-foreground">
                              Você não possui advertências ou suspensões ativas
                            </p>
                          </CardContent>
                        </Card>
                      )}

                      {disciplinaryActions.filter((action: any) => !action.ativo).length > 0 && (
                        <div className="mt-6">
                          <h3 className="text-sm font-medium mb-3 text-muted-foreground">Histórico (Removidas)</h3>
                          <div className="space-y-3">
                            {disciplinaryActions
                              .filter((action: any) => !action.ativo)
                              .sort((a: any, b: any) => new Date(b.dataAplicacao).getTime() - new Date(a.dataAplicacao).getTime())
                              .map((action: any) => {
                                const isSuspension = action.tipo === "suspensao";
                                const dataAplicacao = new Date(action.dataAplicacao);
                                const dataRemocao = action.dataRemocao ? new Date(action.dataRemocao) : null;

                                return (
                                  <Card key={action.id} className="opacity-60">
                                    <CardHeader className="pb-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <CardTitle className="text-base">
                                            {isSuspension ? "Suspensão" : "Advertência"}
                                          </CardTitle>
                                        </div>
                                        <Badge variant="secondary">Removida</Badge>
                                      </div>
                                      <CardDescription className="text-xs">
                                        Aplicada em {dataAplicacao.toLocaleDateString('pt-BR')}
                                        {dataRemocao && ` • Removida em ${dataRemocao.toLocaleDateString('pt-BR')}`}
                                      </CardDescription>
                                    </CardHeader>
                                    {action.comentario && (
                                      <CardContent className="pt-2">
                                        <p className="text-xs text-muted-foreground">{action.comentario}</p>
                                      </CardContent>
                                    )}
                                  </Card>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {selectedSection === "financeiro" && (
                <StudentFinanceTab />
              )}

              {selectedSection === "boletim" && (
                <div className="space-y-4">
                  <AlunoBoletimTab />
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

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
      <AttendanceConfirmationModal userType="aluno" />
      <LiveClassNotification />
    </SidebarProvider>
  );
}
