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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { FileUploadZone } from "@/components/FileUploadZone";
import { 
  FileText, Calendar, Clock, Award, Download, Upload, Eye,
  CheckCircle, AlertCircle, FileCheck, BookOpen, ClipboardList, 
  GraduationCap, Timer, AlertTriangle, Edit3, Send, Check, X
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import type { Avaliacao, AvaliacaoEntrega, Turma, User } from "@shared/schema";
import { format, formatDistanceToNow, isPast, isFuture, isWithinInterval, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";

interface Resposta {
  questaoId: string;
  tipo: string;
  resposta: string;
  respostaMultipla?: string[];
}

export function AlunoAvaliacoesTab() {
  const { userData } = useAuth();
  const { toast } = useToast();
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [answerDialogOpen, setAnswerDialogOpen] = useState(false);
  const [selectedAvaliacao, setSelectedAvaliacao] = useState<Avaliacao | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState("disponiveis");
  const [respostas, setRespostas] = useState<Resposta[]>([]);

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
        professorId: avaliacao.professorId,
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

  const answerMutation = useMutation({
    mutationFn: async ({ avaliacaoId, respostasData }: { avaliacaoId: string; respostasData: Resposta[] }) => {
      if (!userData) throw new Error("Usuário não autenticado");

      const avaliacao = avaliacoes?.find(a => a.id === avaliacaoId);
      if (!avaliacao) throw new Error("Avaliação não encontrada");

      const prazoFim = new Date(avaliacao.dataFim);
      const now = new Date();
      const isLate = isPast(prazoFim);

      if (isLate && !avaliacao.permitirAtraso) {
        throw new Error("O prazo desta avaliação já expirou e não são permitidas entregas atrasadas.");
      }

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
        professorId: avaliacao.professorId,
        dataEnvio: getNowBrasiliaISO(),
        respostas: respostasData,
        status,
      };

      await addDoc(collection(db, "avaliacaoEntregas"), entregaData);
      return entregaData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/avaliacao-entregas"] });
      toast({
        title: "Avaliação entregue!",
        description: "Suas respostas foram registradas com sucesso.",
      });
      setAnswerDialogOpen(false);
      setRespostas([]);
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

  const handleRespostaChange = (questaoId: string, tipo: string, valor: string) => {
    setRespostas(prev => {
      const existing = prev.find(r => r.questaoId === questaoId);
      if (existing) {
        return prev.map(r => r.questaoId === questaoId ? { ...r, resposta: valor } : r);
      }
      return [...prev, { questaoId, tipo, resposta: valor }];
    });
  };

  const initializeAnswers = (avaliacao: Avaliacao) => {
    if (avaliacao.questoes && avaliacao.questoes.length > 0) {
      const initialRespostas = avaliacao.questoes.map((q: any) => ({
        questaoId: q.id,
        tipo: q.tipo,
        resposta: "",
      }));
      setRespostas(initialRespostas);
    }
    setSelectedAvaliacao(avaliacao);
    setAnswerDialogOpen(true);
  };

  const getTipoQuestaoLabel = (tipo: string) => {
    switch (tipo) {
      case "multipla_escolha": return "Múltipla Escolha";
      case "objetiva": return "Objetiva";
      case "verdadeiro_falso": return "Verdadeiro/Falso";
      case "dissertativa": return "Dissertativa";
      case "redacao": return "Redação";
      default: return tipo;
    }
  };

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
        // Só mostra nota se liberadoParaAluno === true
        if (entrega.liberadoParaAluno === true) {
          // Para atividades, não mostra nota (só "Corrigida")
          if (avaliacao.tipo === "atividade") {
            return { 
              label: "Corrigida", 
              variant: "default" as const, 
              icon: <CheckCircle className="h-4 w-4" /> 
            };
          }
          return { 
            label: `Nota: ${entrega.nota}`, 
            variant: "default" as const, 
            icon: <Award className="h-4 w-4" /> 
          };
        } else {
          // Corrigida mas não liberada - mostra como "Em correção"
          return { 
            label: "Em correção", 
            variant: "secondary" as const, 
            icon: <Clock className="h-4 w-4" /> 
          };
        }
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
          // Mostra entregas enviadas aguardando correção OU corrigidas mas não liberadas para o aluno
          return entrega && (
            entrega.status !== "corrigida" || 
            (entrega.status === "corrigida" && entrega.liberadoParaAluno !== true)
          );
        });
      case "notas":
        return avaliacoes.filter(a => {
          const entrega = getEntregaForAvaliacao(a.id);
          return entrega && entrega.status === "corrigida" && entrega.liberadoParaAluno === true;
        });
      default:
        return avaliacoes;
    }
  };

  const calcularMedia = () => {
    // Só calcula média de entregas liberadas para aluno e que não são atividades (atividades não têm nota)
    const entregasCorrigidas = minhasEntregas?.filter(e => 
      e.status === "corrigida" && 
      e.liberadoParaAluno === true && 
      e.nota !== undefined &&
      e.avaliacaoTipo !== "atividade"
    );
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-view-avaliacao">
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

              {selectedAvaliacao.questoes && selectedAvaliacao.questoes.length > 0 && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-muted-foreground">Questões ({selectedAvaliacao.questoes.length})</Label>
                    <Badge variant="outline">{selectedAvaliacao.questoes.reduce((acc: number, q: any) => acc + (q.valor || 0), 0)} pts</Badge>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {selectedAvaliacao.questoes.map((q: any, index: number) => (
                      <div key={q.id || index} className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-start gap-2 mb-2">
                          <Badge variant="secondary" className="text-xs">{index + 1}</Badge>
                          <Badge variant="outline" className="text-xs">{getTipoQuestaoLabel(q.tipo)}</Badge>
                          <Badge variant="outline" className="text-xs">{q.valor} pt{q.valor !== 1 ? 's' : ''}</Badge>
                        </div>
                        <p className="text-sm">{q.enunciado}</p>
                        {(q.tipo === "multipla_escolha" || q.tipo === "objetiva") && q.opcoes && (
                          <div className="mt-2 space-y-1 pl-4">
                            {q.opcoes.map((op: any) => (
                              <div key={op.letra} className="text-sm text-muted-foreground flex items-center gap-2">
                                <span className="font-medium">{op.letra})</span>
                                <span>{op.texto}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
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

          <DialogFooter className="flex-wrap gap-2">
            {selectedAvaliacao && !getEntregaForAvaliacao(selectedAvaliacao.id) && (
              <>
                {selectedAvaliacao.questoes && selectedAvaliacao.questoes.length > 0 && (
                  <Button 
                    onClick={() => { 
                      setViewDialogOpen(false);
                      initializeAnswers(selectedAvaliacao);
                    }}
                    disabled={
                      !isWithinInterval(new Date(), { 
                        start: new Date(selectedAvaliacao.dataInicio), 
                        end: new Date(selectedAvaliacao.dataFim) 
                      })
                    }
                    data-testid="button-responder-avaliacao"
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Responder Questões
                  </Button>
                )}
                <Button 
                  variant={selectedAvaliacao.questoes && selectedAvaliacao.questoes.length > 0 ? "outline" : "default"}
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
                  Enviar Arquivo
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={answerDialogOpen} onOpenChange={setAnswerDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]" data-testid="dialog-answer-avaliacao">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Responder Avaliação
            </DialogTitle>
            <DialogDescription>
              {selectedAvaliacao?.titulo} - {selectedAvaliacao?.materia}
            </DialogDescription>
          </DialogHeader>

          {selectedAvaliacao && selectedAvaliacao.questoes && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                {selectedAvaliacao.instrucoes && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
                    <Label className="text-amber-700 dark:text-amber-400">Instruções</Label>
                    <p className="mt-1 text-amber-900 dark:text-amber-100 text-sm">{selectedAvaliacao.instrucoes}</p>
                  </div>
                )}

                {selectedAvaliacao.questoes.map((q: any, index: number) => {
                  const resposta = respostas.find(r => r.questaoId === q.id);
                  
                  return (
                    <div key={q.id || index} className="p-4 border rounded-lg space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{getTipoQuestaoLabel(q.tipo)}</Badge>
                            <Badge variant="secondary">{q.valor} pt{q.valor !== 1 ? 's' : ''}</Badge>
                          </div>
                          <p className="text-sm leading-relaxed">{q.enunciado}</p>
                        </div>
                      </div>

                      <div className="ml-11">
                        {(q.tipo === "multipla_escolha" || q.tipo === "objetiva") && q.opcoes && (
                          <RadioGroup
                            value={resposta?.resposta || ""}
                            onValueChange={(value) => handleRespostaChange(q.id, q.tipo, value)}
                            className="space-y-2"
                          >
                            {q.opcoes.map((op: any) => (
                              <div key={op.letra} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                <RadioGroupItem value={op.letra} id={`${q.id}-${op.letra}`} />
                                <Label htmlFor={`${q.id}-${op.letra}`} className="flex-1 cursor-pointer text-sm">
                                  <span className="font-medium mr-2">{op.letra})</span>
                                  {op.texto}
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                        )}

                        {q.tipo === "verdadeiro_falso" && (
                          <RadioGroup
                            value={resposta?.resposta || ""}
                            onValueChange={(value) => handleRespostaChange(q.id, q.tipo, value)}
                            className="space-y-2"
                          >
                            <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                              <RadioGroupItem value="verdadeiro" id={`${q.id}-verdadeiro`} />
                              <Label htmlFor={`${q.id}-verdadeiro`} className="cursor-pointer text-sm">Verdadeiro</Label>
                            </div>
                            <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                              <RadioGroupItem value="falso" id={`${q.id}-falso`} />
                              <Label htmlFor={`${q.id}-falso`} className="cursor-pointer text-sm">Falso</Label>
                            </div>
                          </RadioGroup>
                        )}

                        {(q.tipo === "dissertativa" || q.tipo === "redacao") && (
                          <div className="space-y-2">
                            {q.tipo === "redacao" && (
                              <div className="text-xs text-muted-foreground space-y-1">
                                {q.temaRedacao && <p><strong>Tema:</strong> {q.temaRedacao}</p>}
                                {q.generoTextual && <p><strong>Gênero:</strong> {q.generoTextual}</p>}
                                {(q.minimoLinhas || q.maximoLinhas) && (
                                  <p><strong>Linhas:</strong> {q.minimoLinhas || 0} a {q.maximoLinhas || 30}</p>
                                )}
                              </div>
                            )}
                            <Textarea
                              placeholder={q.tipo === "redacao" ? "Escreva sua redação aqui..." : "Escreva sua resposta aqui..."}
                              value={resposta?.resposta || ""}
                              onChange={(e) => handleRespostaChange(q.id, q.tipo, e.target.value)}
                              rows={q.tipo === "redacao" ? 15 : 5}
                              className="resize-none"
                            />
                            {q.tipo === "redacao" && resposta?.resposta && (
                              <p className="text-xs text-muted-foreground text-right">
                                {resposta.resposta.split('\n').filter(l => l.trim()).length} linhas
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-muted-foreground">
                {respostas.filter(r => r.resposta).length}/{selectedAvaliacao?.questoes?.length || 0} respondidas
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAnswerDialogOpen(false);
                    setRespostas([]);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (selectedAvaliacao) {
                      answerMutation.mutate({ avaliacaoId: selectedAvaliacao.id, respostasData: respostas });
                    }
                  }}
                  disabled={answerMutation.isPending || respostas.filter(r => r.resposta).length === 0}
                  data-testid="button-enviar-respostas"
                >
                  {answerMutation.isPending ? (
                    <>
                      <Send className="mr-2 h-4 w-4 animate-pulse" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Enviar Respostas
                    </>
                  )}
                </Button>
              </div>
            </div>
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

              {showNota && entrega && (
                <div className="space-y-2">
                  {avaliacao.tipo !== "atividade" && entrega.nota !== undefined ? (
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
                  ) : avaliacao.tipo === "atividade" ? (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                        <span className="font-medium text-blue-700 dark:text-blue-400">
                          Atividade Corrigida
                        </span>
                      </div>
                    </div>
                  ) : null}
                  {entrega.feedback && (
                    <div className="p-3 bg-muted/50 border rounded-lg">
                      <p className="text-sm font-medium mb-1">Feedback do Professor:</p>
                      <p className="text-sm text-muted-foreground">{entrega.feedback}</p>
                    </div>
                  )}
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
