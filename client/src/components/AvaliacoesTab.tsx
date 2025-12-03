import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { collection, addDoc, updateDoc, doc, where, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { FileUploadZone } from "@/components/FileUploadZone";
import { 
  Plus, FileText, Calendar, Clock, Users, Award, Download, Edit, 
  Trash2, Eye, CheckCircle, AlertCircle, FileCheck, Printer,
  BookOpen, ClipboardList, GraduationCap
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import type { Avaliacao, AvaliacaoEntrega, Turma, User, MATERIAS_DISPONIVEIS } from "@shared/schema";
import { format, isPast, isFuture, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";

const MATERIAS = [
  "Matemática",
  "Português",
  "Redação",
  "Literatura",
  "História",
  "Geografia",
  "Física",
  "Química",
  "Biologia",
  "Inglês",
  "Espanhol",
  "Filosofia",
  "Sociologia",
  "Artes",
  "Educação Física",
  "Atualidades",
  "Interdisciplinar",
];

const avaliacaoFormSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().optional(),
  tipo: z.enum(["prova", "simulado", "atividade", "trabalho"]),
  materia: z.string().min(1, "Matéria é obrigatória"),
  destinatarioTipo: z.enum(["turma", "alunos_especificos"]),
  turmaId: z.string().optional(),
  dataInicio: z.string().min(1, "Data de início é obrigatória"),
  dataFim: z.string().min(1, "Data limite é obrigatória"),
  duracaoMinutos: z.number().optional(),
  valorTotal: z.number().min(0).max(100).default(10),
  modeloTipo: z.enum(["questoes", "arquivo_anexo", "template"]),
  instrucoes: z.string().optional(),
  permitirAtraso: z.boolean().default(false),
  mostrarGabarito: z.boolean().default(false),
  mostrarNota: z.boolean().default(true),
});

const correcaoFormSchema = z.object({
  nota: z.number().min(0).max(100),
  feedback: z.string().optional(),
});

interface AvaliacoesTabProps {
  userType: "professor" | "diretor";
}

export function AvaliacoesTab({ userType }: AvaliacoesTabProps) {
  const { userData } = useAuth();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [selectedAvaliacao, setSelectedAvaliacao] = useState<Avaliacao | null>(null);
  const [selectedEntrega, setSelectedEntrega] = useState<AvaliacaoEntrega | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState("todas");

  const form = useForm<z.infer<typeof avaliacaoFormSchema>>({
    resolver: zodResolver(avaliacaoFormSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      tipo: "atividade",
      materia: "",
      destinatarioTipo: "turma",
      turmaId: "",
      dataInicio: "",
      dataFim: "",
      valorTotal: 10,
      modeloTipo: "arquivo_anexo",
      instrucoes: "",
      permitirAtraso: false,
      mostrarGabarito: false,
      mostrarNota: true,
    },
  });

  const correcaoForm = useForm<z.infer<typeof correcaoFormSchema>>({
    resolver: zodResolver(correcaoFormSchema),
    defaultValues: {
      nota: 0,
      feedback: "",
    },
  });

  const { data: turmas } = useRealtimeQuery<Turma>({
    collectionName: "turmas",
    queryKey: ["/api/turmas"],
    transform: (docs) => (docs as Turma[]).filter((t) => t.ativa),
  });

  const { data: avaliacoes, isLoading: loadingAvaliacoes } = useRealtimeQuery<Avaliacao>({
    collectionName: "avaliacoes",
    queryKey: ["/api/avaliacoes", userData?.uid],
    constraints: userType === "professor" && userData?.uid 
      ? [where("professorId", "==", userData.uid)] 
      : [],
    transform: (docs) => docs as Avaliacao[],
    enabled: !!userData?.uid,
  });

  const { data: entregas } = useRealtimeQuery<AvaliacaoEntrega>({
    collectionName: "avaliacaoEntregas",
    queryKey: ["/api/avaliacao-entregas"],
    transform: (docs) => docs as AvaliacaoEntrega[],
  });

  const { data: alunos } = useRealtimeQuery<User>({
    collectionName: "usuarios",
    queryKey: ["/api/usuarios/alunos"],
    constraints: [where("tipo", "==", "aluno"), where("status", "==", "aprovado")],
    transform: (docs) => docs as User[],
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof avaliacaoFormSchema>) => {
      if (!userData) throw new Error("Usuário não autenticado");

      let arquivoUrl = undefined;
      let arquivoNome = undefined;

      if (attachmentFile) {
        const storageRef = ref(storage, `avaliacoes/${userData.uid}/${Date.now()}_${attachmentFile.name}`);
        await uploadBytes(storageRef, attachmentFile);
        arquivoUrl = await getDownloadURL(storageRef);
        arquivoNome = attachmentFile.name;
      }

      const turma = turmas?.find(t => t.id === data.turmaId);

      const avaliacaoData: any = {
        ...data,
        professorId: userData.uid,
        professorNome: userData.nome,
        turmaNome: turma?.nome || "",
        status: "agendada",
        dataCriacao: getNowBrasiliaISO(),
      };

      if (arquivoUrl) {
        avaliacaoData.arquivoUrl = arquivoUrl;
        avaliacaoData.arquivoNome = arquivoNome;
      }

      await addDoc(collection(db, "avaliacoes"), avaliacaoData);
      return avaliacaoData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/avaliacoes"] });
      toast({
        title: "Avaliação criada com sucesso!",
        description: "A avaliação foi agendada e estará disponível na data de início.",
      });
      setCreateDialogOpen(false);
      form.reset();
      setAttachmentFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar avaliação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const gradeMutation = useMutation({
    mutationFn: async ({ entregaId, data }: { entregaId: string; data: z.infer<typeof correcaoFormSchema> }) => {
      if (!userData) throw new Error("Usuário não autenticado");
      
      const entregaRef = doc(db, "avaliacaoEntregas", entregaId);
      await updateDoc(entregaRef, {
        nota: data.nota,
        feedback: data.feedback || "",
        status: "corrigida",
        corrigidoPor: userData.uid,
        corrigidoPorNome: userData.nome,
        dataCorrecao: getNowBrasiliaISO(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/avaliacao-entregas"] });
      toast({
        title: "Correção salva!",
        description: "O aluno poderá visualizar a nota.",
      });
      setGradeDialogOpen(false);
      setSelectedEntrega(null);
      correcaoForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar correção",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (avaliacaoId: string) => {
      await deleteDoc(doc(db, "avaliacoes", avaliacaoId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/avaliacoes"] });
      toast({
        title: "Avaliação excluída",
        description: "A avaliação foi removida com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusAvaliacao = (avaliacao: Avaliacao) => {
    const now = new Date();
    const inicio = new Date(avaliacao.dataInicio);
    const fim = new Date(avaliacao.dataFim);

    if (avaliacao.status === "cancelada") return { label: "Cancelada", variant: "destructive" as const };
    if (avaliacao.status === "rascunho") return { label: "Rascunho", variant: "secondary" as const };
    if (isFuture(inicio)) return { label: "Agendada", variant: "outline" as const };
    if (isWithinInterval(now, { start: inicio, end: fim })) return { label: "Em andamento", variant: "default" as const };
    if (isPast(fim)) return { label: "Encerrada", variant: "secondary" as const };
    return { label: avaliacao.status, variant: "outline" as const };
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

  const getEntregasForAvaliacao = (avaliacaoId: string) => {
    return entregas?.filter(e => e.avaliacaoId === avaliacaoId) || [];
  };

  const pendingCorrections = entregas?.filter(e => e.status === "enviada" || e.status === "atrasada").length || 0;

  const handlePrintPDF = (avaliacao: Avaliacao) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const turma = turmas?.find(t => t.id === avaliacao.turmaId);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${avaliacao.titulo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 5px 0; color: #666; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
          .info-item { padding: 10px; background: #f5f5f5; border-radius: 4px; }
          .info-label { font-weight: bold; font-size: 12px; color: #666; }
          .info-value { font-size: 14px; }
          .student-info { border: 1px solid #000; padding: 15px; margin-bottom: 20px; }
          .student-info p { margin: 5px 0; }
          .instructions { background: #fffbeb; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
          .instructions h3 { margin-top: 0; }
          .content { margin-top: 30px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>ENEM+ Preparatório</h1>
          <p>${getTipoLabel(avaliacao.tipo).toUpperCase()}</p>
        </div>
        
        <h2 style="text-align: center; margin-bottom: 20px;">${avaliacao.titulo}</h2>
        
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Matéria</div>
            <div class="info-value">${avaliacao.materia}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Professor(a)</div>
            <div class="info-value">${avaliacao.professorNome}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Turma</div>
            <div class="info-value">${turma?.nome || avaliacao.turmaNome || "-"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Valor</div>
            <div class="info-value">${avaliacao.valorTotal} pontos</div>
          </div>
          <div class="info-item">
            <div class="info-label">Data de Início</div>
            <div class="info-value">${format(new Date(avaliacao.dataInicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Data Limite</div>
            <div class="info-value">${format(new Date(avaliacao.dataFim), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
          </div>
        </div>
        
        <div class="student-info">
          <p><strong>Nome do Aluno:</strong> _____________________________________________</p>
          <p><strong>Matrícula:</strong> _________________ <strong>Data:</strong> ___/___/_____</p>
        </div>
        
        ${avaliacao.instrucoes ? `
          <div class="instructions">
            <h3>Instruções</h3>
            <p>${avaliacao.instrucoes}</p>
          </div>
        ` : ""}
        
        ${avaliacao.descricao ? `
          <div class="content">
            <h3>Descrição</h3>
            <p>${avaliacao.descricao}</p>
          </div>
        ` : ""}
        
        <div style="margin-top: 50px; text-align: center; color: #999; font-size: 12px;">
          <p>Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const filterAvaliacoes = (tab: string) => {
    if (!avaliacoes) return [];
    const now = new Date();
    
    switch (tab) {
      case "agendadas":
        return avaliacoes.filter(a => isFuture(new Date(a.dataInicio)) && a.status !== "cancelada");
      case "andamento":
        return avaliacoes.filter(a => {
          const inicio = new Date(a.dataInicio);
          const fim = new Date(a.dataFim);
          return isWithinInterval(now, { start: inicio, end: fim }) && a.status !== "cancelada";
        });
      case "encerradas":
        return avaliacoes.filter(a => isPast(new Date(a.dataFim)) || a.status === "cancelada");
      default:
        return avaliacoes;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold">Avaliações</h3>
          <p className="text-muted-foreground">Gerencie provas, simulados e atividades</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-avaliacao">
          <Plus className="h-4 w-4 mr-2" />
          Nova Avaliação
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avaliacoes?.length || 0}</div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {filterAvaliacoes("andamento").length}
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agendadas</CardTitle>
            <Calendar className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {filterAvaliacoes("agendadas").length}
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Correções Pendentes</CardTitle>
            <Award className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{pendingCorrections}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="andamento">
            Em Andamento
            {filterAvaliacoes("andamento").length > 0 && (
              <Badge variant="default" className="ml-2">{filterAvaliacoes("andamento").length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="agendadas">Agendadas</TabsTrigger>
          <TabsTrigger value="encerradas">Encerradas</TabsTrigger>
          <TabsTrigger value="correcoes">
            Correções
            {pendingCorrections > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingCorrections}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todas" className="space-y-4">
          <AvaliacaoList 
            avaliacoes={filterAvaliacoes("todas")} 
            loading={loadingAvaliacoes}
            onView={(a) => { setSelectedAvaliacao(a); setViewDialogOpen(true); }}
            onPrint={handlePrintPDF}
            onDelete={(id) => deleteMutation.mutate(id)}
            getStatus={getStatusAvaliacao}
            getTipoIcon={getTipoIcon}
            getTipoLabel={getTipoLabel}
            getEntregas={getEntregasForAvaliacao}
          />
        </TabsContent>

        <TabsContent value="andamento" className="space-y-4">
          <AvaliacaoList 
            avaliacoes={filterAvaliacoes("andamento")} 
            loading={loadingAvaliacoes}
            onView={(a) => { setSelectedAvaliacao(a); setViewDialogOpen(true); }}
            onPrint={handlePrintPDF}
            onDelete={(id) => deleteMutation.mutate(id)}
            getStatus={getStatusAvaliacao}
            getTipoIcon={getTipoIcon}
            getTipoLabel={getTipoLabel}
            getEntregas={getEntregasForAvaliacao}
          />
        </TabsContent>

        <TabsContent value="agendadas" className="space-y-4">
          <AvaliacaoList 
            avaliacoes={filterAvaliacoes("agendadas")} 
            loading={loadingAvaliacoes}
            onView={(a) => { setSelectedAvaliacao(a); setViewDialogOpen(true); }}
            onPrint={handlePrintPDF}
            onDelete={(id) => deleteMutation.mutate(id)}
            getStatus={getStatusAvaliacao}
            getTipoIcon={getTipoIcon}
            getTipoLabel={getTipoLabel}
            getEntregas={getEntregasForAvaliacao}
          />
        </TabsContent>

        <TabsContent value="encerradas" className="space-y-4">
          <AvaliacaoList 
            avaliacoes={filterAvaliacoes("encerradas")} 
            loading={loadingAvaliacoes}
            onView={(a) => { setSelectedAvaliacao(a); setViewDialogOpen(true); }}
            onPrint={handlePrintPDF}
            onDelete={(id) => deleteMutation.mutate(id)}
            getStatus={getStatusAvaliacao}
            getTipoIcon={getTipoIcon}
            getTipoLabel={getTipoLabel}
            getEntregas={getEntregasForAvaliacao}
          />
        </TabsContent>

        <TabsContent value="correcoes" className="space-y-4">
          {entregas?.filter(e => e.status === "enviada" || e.status === "atrasada").length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                <p className="text-lg font-medium mb-2">Nenhuma correção pendente</p>
                <p className="text-sm text-muted-foreground">Todas as entregas foram corrigidas</p>
              </CardContent>
            </Card>
          ) : (
            entregas?.filter(e => e.status === "enviada" || e.status === "atrasada").map(entrega => (
              <Card key={entrega.id} className="hover-elevate">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{entrega.avaliacaoTitulo}</CardTitle>
                      <CardDescription>
                        Aluno: {entrega.alunoNome} {entrega.alunoMatricula && `(${entrega.alunoMatricula})`}
                      </CardDescription>
                    </div>
                    <Badge variant={entrega.status === "atrasada" ? "destructive" : "default"}>
                      {entrega.status === "atrasada" ? "Atrasada" : "Enviada"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    Turma: {entrega.turmaNome}
                  </div>
                  {entrega.dataEnvio && (
                    <div className="text-sm text-muted-foreground">
                      Enviado em {format(new Date(entrega.dataEnvio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  )}
                  {entrega.arquivoUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={entrega.arquivoUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4 mr-2" />
                        {entrega.arquivoNome || "Baixar arquivo"}
                      </a>
                    </Button>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={() => {
                      setSelectedEntrega(entrega);
                      setGradeDialogOpen(true);
                    }}
                    data-testid="button-corrigir"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Corrigir
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-avaliacao">
          <DialogHeader>
            <DialogTitle>Nova Avaliação</DialogTitle>
            <DialogDescription>
              Crie uma prova, simulado ou atividade para seus alunos
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tipo">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="prova">Prova</SelectItem>
                          <SelectItem value="simulado">Simulado</SelectItem>
                          <SelectItem value="atividade">Atividade</SelectItem>
                          <SelectItem value="trabalho">Trabalho</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="materia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Matéria</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-materia">
                            <SelectValue placeholder="Selecione a matéria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MATERIAS.map((materia) => (
                            <SelectItem key={materia} value={materia}>{materia}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Prova de Matemática - Unidade 1" {...field} data-testid="input-titulo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (opcional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descreva o conteúdo da avaliação..." 
                        rows={3}
                        {...field} 
                        data-testid="input-descricao"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="destinatarioTipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destinatário</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-destinatario">
                            <SelectValue placeholder="Para quem" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="turma">Turma inteira</SelectItem>
                          <SelectItem value="alunos_especificos">Alunos específicos</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("destinatarioTipo") === "turma" && (
                  <FormField
                    control={form.control}
                    name="turmaId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Turma</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-turma">
                              <SelectValue placeholder="Selecione a turma" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {turmas?.map((turma) => (
                              <SelectItem key={turma.id} value={turma.id}>{turma.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dataInicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data/Hora de Início</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-data-inicio" />
                      </FormControl>
                      <FormDescription>Quando a avaliação fica disponível</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dataFim"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data/Hora Limite</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-data-fim" />
                      </FormControl>
                      <FormDescription>Prazo final para entrega</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="valorTotal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Total (pontos)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          max="100" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          data-testid="input-valor"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="duracaoMinutos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duração (minutos) - Opcional</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          placeholder="Ex: 120"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          data-testid="input-duracao"
                        />
                      </FormControl>
                      <FormDescription>Tempo máximo para realizar</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="modeloTipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo da Avaliação</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-modelo">
                          <SelectValue placeholder="Como criar a avaliação" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="arquivo_anexo">Anexar arquivo (PDF, Word, etc)</SelectItem>
                        <SelectItem value="questoes">Criar questões no sistema</SelectItem>
                        <SelectItem value="template">Usar template pré-definido</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Você pode anexar um arquivo criado externamente ou criar questões diretamente
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch("modeloTipo") === "arquivo_anexo" && (
                <div className="space-y-2">
                  <Label>Arquivo da Avaliação</Label>
                  <FileUploadZone
                    onFileSelect={setAttachmentFile}
                    onFileRemove={() => setAttachmentFile(null)}
                    selectedFile={attachmentFile}
                  />
                </div>
              )}

              <FormField
                control={form.control}
                name="instrucoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instruções para os Alunos (opcional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Ex: Leia atentamente cada questão antes de responder..." 
                        rows={3}
                        {...field} 
                        data-testid="input-instrucoes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4 border rounded-lg p-4">
                <h4 className="font-medium">Configurações</h4>
                
                <FormField
                  control={form.control}
                  name="permitirAtraso"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-permitir-atraso"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Permitir entrega com atraso (mediante autorização)</FormLabel>
                        <FormDescription>
                          Alunos podem solicitar autorização para entregar após o prazo
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mostrarNota"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-mostrar-nota"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Mostrar nota para o aluno</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mostrarGabarito"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-mostrar-gabarito"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Mostrar gabarito após correção</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCreateDialogOpen(false);
                    form.reset();
                    setAttachmentFile(null);
                  }}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save">
                  {createMutation.isPending && <Plus className="mr-2 h-4 w-4 animate-pulse" />}
                  Criar Avaliação
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

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
                  <Label className="text-muted-foreground">Turma</Label>
                  <p className="font-medium">{selectedAvaliacao.turmaNome || "-"}</p>
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
                <div>
                  <Label className="text-muted-foreground">Valor</Label>
                  <p className="font-medium">{selectedAvaliacao.valorTotal} pontos</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge variant={getStatusAvaliacao(selectedAvaliacao).variant}>
                    {getStatusAvaliacao(selectedAvaliacao).label}
                  </Badge>
                </div>
              </div>

              {selectedAvaliacao.descricao && (
                <div>
                  <Label className="text-muted-foreground">Descrição</Label>
                  <p className="mt-1">{selectedAvaliacao.descricao}</p>
                </div>
              )}

              {selectedAvaliacao.instrucoes && (
                <div>
                  <Label className="text-muted-foreground">Instruções</Label>
                  <p className="mt-1">{selectedAvaliacao.instrucoes}</p>
                </div>
              )}

              {selectedAvaliacao.arquivoUrl && (
                <div>
                  <Label className="text-muted-foreground">Arquivo Anexado</Label>
                  <Button variant="outline" size="sm" className="mt-1" asChild>
                    <a href={selectedAvaliacao.arquivoUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      {selectedAvaliacao.arquivoNome || "Baixar arquivo"}
                    </a>
                  </Button>
                </div>
              )}

              <div className="border-t pt-4">
                <Label className="text-muted-foreground">Entregas</Label>
                <div className="mt-2">
                  {getEntregasForAvaliacao(selectedAvaliacao.id).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma entrega realizada ainda</p>
                  ) : (
                    <div className="space-y-2">
                      {getEntregasForAvaliacao(selectedAvaliacao.id).map(entrega => (
                        <div key={entrega.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                          <div>
                            <p className="font-medium">{entrega.alunoNome}</p>
                            <p className="text-sm text-muted-foreground">
                              {entrega.status === "corrigida" 
                                ? `Nota: ${entrega.nota}` 
                                : entrega.status === "enviada" 
                                  ? "Aguardando correção"
                                  : entrega.status
                              }
                            </p>
                          </div>
                          <Badge variant={
                            entrega.status === "corrigida" ? "default" :
                            entrega.status === "enviada" ? "secondary" :
                            entrega.status === "atrasada" ? "destructive" : "outline"
                          }>
                            {entrega.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => selectedAvaliacao && handlePrintPDF(selectedAvaliacao)}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir PDF
            </Button>
            <Button onClick={() => setViewDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={gradeDialogOpen} onOpenChange={setGradeDialogOpen}>
        <DialogContent data-testid="dialog-corrigir">
          <DialogHeader>
            <DialogTitle>Corrigir Entrega</DialogTitle>
            <DialogDescription>
              {selectedEntrega?.alunoNome} - {selectedEntrega?.avaliacaoTitulo}
            </DialogDescription>
          </DialogHeader>

          <Form {...correcaoForm}>
            <form
              onSubmit={correcaoForm.handleSubmit((data) => {
                if (selectedEntrega) {
                  gradeMutation.mutate({ entregaId: selectedEntrega.id, data });
                }
              })}
              className="space-y-4"
            >
              <FormField
                control={correcaoForm.control}
                name="nota"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nota</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="100"
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
                control={correcaoForm.control}
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
                    correcaoForm.reset();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={gradeMutation.isPending}>
                  {gradeMutation.isPending && <Award className="mr-2 h-4 w-4 animate-pulse" />}
                  Salvar Correção
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface AvaliacaoListProps {
  avaliacoes: Avaliacao[];
  loading: boolean;
  onView: (avaliacao: Avaliacao) => void;
  onPrint: (avaliacao: Avaliacao) => void;
  onDelete: (id: string) => void;
  getStatus: (avaliacao: Avaliacao) => { label: string; variant: "default" | "secondary" | "destructive" | "outline" };
  getTipoIcon: (tipo: string) => JSX.Element;
  getTipoLabel: (tipo: string) => string;
  getEntregas: (id: string) => AvaliacaoEntrega[];
}

function AvaliacaoList({ 
  avaliacoes, 
  loading, 
  onView, 
  onPrint, 
  onDelete, 
  getStatus, 
  getTipoIcon, 
  getTipoLabel,
  getEntregas 
}: AvaliacaoListProps) {
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
          <p className="text-lg font-medium mb-2">Nenhuma avaliação encontrada</p>
          <p className="text-sm text-muted-foreground">Crie uma nova avaliação para começar</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {avaliacoes.map((avaliacao) => {
        const status = getStatus(avaliacao);
        const entregasCount = getEntregas(avaliacao.id).length;
        const corrigidasCount = getEntregas(avaliacao.id).filter(e => e.status === "corrigida").length;

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
                      {getTipoLabel(avaliacao.tipo)} de {avaliacao.materia} | Turma: {avaliacao.turmaNome || "-"}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {avaliacao.descricao && (
                <p className="text-sm text-muted-foreground line-clamp-2">{avaliacao.descricao}</p>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Início: {format(new Date(avaliacao.dataInicio), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>Prazo: {format(new Date(avaliacao.dataFim), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Award className="h-4 w-4" />
                  <span>Valor: {avaliacao.valorTotal} pts</span>
                </div>
              </div>

              {entregasCount > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Entregas:</span>
                  <div className="flex-1 bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${(corrigidasCount / entregasCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground">{corrigidasCount}/{entregasCount}</span>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => onView(avaliacao)}>
                <Eye className="h-4 w-4 mr-1" />
                Ver
              </Button>
              <Button variant="outline" size="sm" onClick={() => onPrint(avaliacao)}>
                <Printer className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(avaliacao.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </>
  );
}
