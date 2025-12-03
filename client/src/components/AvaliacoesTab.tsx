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
  BookOpen, ClipboardList, GraduationCap, ListOrdered, ChevronUp,
  ChevronDown, Copy, Check, X, HelpCircle, PenLine
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import type { Avaliacao, AvaliacaoEntrega, Turma, User, AvaliacaoQuestao } from "@shared/schema";
import { TIPOS_QUESTAO } from "@shared/schema";
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

// Interface para opções de questão
interface QuestaoOpcao {
  letra: string;
  texto: string;
  correta?: boolean;
}

// Interface para questão temporária (antes de salvar)
interface QuestaoTemp {
  id: string;
  ordem: number;
  tipo: "objetiva" | "dissertativa" | "multipla_escolha" | "verdadeiro_falso" | "redacao" | "outros";
  enunciado: string;
  opcoes?: QuestaoOpcao[];
  respostaCorreta?: string;
  valor: number;
  temaRedacao?: string;
  generoTextual?: string;
  minimoLinhas?: number;
  maximoLinhas?: number;
  tipoCustomizado?: string;
  instrucoesEspecificas?: string;
}

export function AvaliacoesTab({ userType }: AvaliacoesTabProps) {
  const { userData } = useAuth();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [selectedAvaliacao, setSelectedAvaliacao] = useState<Avaliacao | null>(null);
  const [editingAvaliacao, setEditingAvaliacao] = useState<Avaliacao | null>(null);
  const [selectedEntrega, setSelectedEntrega] = useState<AvaliacaoEntrega | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState("todas");
  const [editQuestoesDialogOpen, setEditQuestoesDialogOpen] = useState(false);
  const [detailedCorrectionDialogOpen, setDetailedCorrectionDialogOpen] = useState(false);
  const [correcaoMarcacoes, setCorrecaoMarcacoes] = useState<Record<string, "certo" | "errado" | "parcial">>({});
  
  // Estados para criação de questões
  const [questoes, setQuestoes] = useState<QuestaoTemp[]>([]);
  const [questaoDialogOpen, setQuestaoDialogOpen] = useState(false);
  const [editingQuestao, setEditingQuestao] = useState<QuestaoTemp | null>(null);
  const [novaQuestao, setNovaQuestao] = useState<Partial<QuestaoTemp>>({
    tipo: "multipla_escolha",
    enunciado: "",
    valor: 1,
    opcoes: [
      { letra: "A", texto: "", correta: false },
      { letra: "B", texto: "", correta: false },
      { letra: "C", texto: "", correta: false },
      { letra: "D", texto: "", correta: false },
    ],
  });

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

  const editForm = useForm<z.infer<typeof avaliacaoFormSchema>>({
    resolver: zodResolver(avaliacaoFormSchema),
    defaultValues: {
      tipo: "prova",
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
    queryKey: ["/api/avaliacao-entregas", userData?.uid],
    constraints: userData?.uid ? [where("professorId", "==", userData.uid)] : [],
    transform: (docs) => docs as AvaliacaoEntrega[],
    enabled: !!userData?.uid,
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

      let arquivoUrl: string | null = null;
      let arquivoNome: string | null = null;

      if (attachmentFile) {
        const storageRef = ref(storage, `avaliacoes/${userData.uid}/${Date.now()}_${attachmentFile.name}`);
        await uploadBytes(storageRef, attachmentFile);
        arquivoUrl = await getDownloadURL(storageRef);
        arquivoNome = attachmentFile.name;
      }

      const turma = turmas?.find(t => t.id === data.turmaId);

      const avaliacaoData: Record<string, any> = {
        titulo: data.titulo,
        tipo: data.tipo,
        materia: data.materia,
        destinatarioTipo: data.destinatarioTipo,
        dataInicio: data.dataInicio,
        dataFim: data.dataFim,
        valorTotal: data.valorTotal,
        modeloTipo: data.modeloTipo,
        permitirAtraso: data.permitirAtraso,
        mostrarGabarito: data.mostrarGabarito,
        mostrarNota: data.mostrarNota,
        professorId: userData.uid,
        professorNome: userData.nome,
        turmaNome: turma?.nome || "",
        status: "agendada",
        dataCriacao: getNowBrasiliaISO(),
      };

      // Adicionar campos opcionais apenas se tiverem valor
      if (data.descricao) avaliacaoData.descricao = data.descricao;
      if (data.turmaId) avaliacaoData.turmaId = data.turmaId;
      if (data.duracaoMinutos) avaliacaoData.duracaoMinutos = data.duracaoMinutos;
      if (data.instrucoes) avaliacaoData.instrucoes = data.instrucoes;

      if (arquivoUrl) {
        avaliacaoData.arquivoUrl = arquivoUrl;
        avaliacaoData.arquivoNome = arquivoNome;
      }

      // Adicionar questões se o modelo for "questoes"
      if (data.modeloTipo === "questoes" && questoes.length > 0) {
        // Limpar campos undefined das questões também
        avaliacaoData.questoes = questoes.map((q, index) => {
          const questaoData: Record<string, any> = {
            id: q.id,
            ordem: index + 1,
            tipo: q.tipo,
            enunciado: q.enunciado || "",
            valor: q.valor,
          };
          if (q.opcoes && q.opcoes.length > 0) questaoData.opcoes = q.opcoes;
          if (q.respostaCorreta) questaoData.respostaCorreta = q.respostaCorreta;
          if (q.temaRedacao) questaoData.temaRedacao = q.temaRedacao;
          if (q.generoTextual) questaoData.generoTextual = q.generoTextual;
          if (q.minimoLinhas) questaoData.minimoLinhas = q.minimoLinhas;
          if (q.maximoLinhas) questaoData.maximoLinhas = q.maximoLinhas;
          if (q.tipoCustomizado) questaoData.tipoCustomizado = q.tipoCustomizado;
          if (q.instrucoesEspecificas) questaoData.instrucoesEspecificas = q.instrucoesEspecificas;
          return questaoData;
        });
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
      setQuestoes([]); // Limpar questões
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

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof avaliacaoFormSchema> & { id: string }) => {
      if (!userData || !editingAvaliacao) throw new Error("Erro ao atualizar");

      const turma = turmas?.find((t: Turma) => t.id === data.turmaId);

      let arquivoUrl = editingAvaliacao.arquivoUrl;
      let arquivoNome = editingAvaliacao.arquivoNome;

      if (attachmentFile) {
        const storageRef = ref(storage, `avaliacoes/${data.id}/${attachmentFile.name}`);
        await uploadBytes(storageRef, attachmentFile);
        arquivoUrl = await getDownloadURL(storageRef);
        arquivoNome = attachmentFile.name;
      }

      const avaliacaoData: any = {
        titulo: data.titulo,
        descricao: data.descricao || "",
        tipo: data.tipo,
        materia: data.materia,
        turmaId: data.turmaId || "",
        turmaNome: turma?.nome || "",
        dataInicio: new Date(data.dataInicio).toISOString(),
        dataFim: new Date(data.dataFim).toISOString(),
        valorTotal: data.valorTotal,
        modeloTipo: data.modeloTipo,
        instrucoes: data.instrucoes || "",
        permitirAtraso: data.permitirAtraso,
        mostrarGabarito: data.mostrarGabarito,
        mostrarNota: data.mostrarNota,
        atualizadoEm: getNowBrasiliaISO(),
      };

      if (data.duracaoMinutos) avaliacaoData.duracaoMinutos = data.duracaoMinutos;
      if (arquivoUrl) avaliacaoData.arquivoUrl = arquivoUrl;
      if (arquivoNome) avaliacaoData.arquivoNome = arquivoNome;

      if (questoes.length > 0) {
        avaliacaoData.questoes = questoes.map(q => {
          const questaoData: any = {
            id: q.id,
            ordem: q.ordem,
            tipo: q.tipo,
            enunciado: q.enunciado,
            valor: q.valor,
          };
          if (q.opcoes && q.opcoes.length > 0) questaoData.opcoes = q.opcoes;
          if (q.respostaCorreta) questaoData.respostaCorreta = q.respostaCorreta;
          if (q.temaRedacao) questaoData.temaRedacao = q.temaRedacao;
          if (q.generoTextual) questaoData.generoTextual = q.generoTextual;
          if (q.minimoLinhas) questaoData.minimoLinhas = q.minimoLinhas;
          if (q.maximoLinhas) questaoData.maximoLinhas = q.maximoLinhas;
          if (q.tipoCustomizado) questaoData.tipoCustomizado = q.tipoCustomizado;
          if (q.instrucoesEspecificas) questaoData.instrucoesEspecificas = q.instrucoesEspecificas;
          return questaoData;
        });
      } else {
        avaliacaoData.questoes = editingAvaliacao.questoes || [];
      }

      const avaliacaoRef = doc(db, "avaliacoes", data.id);
      await updateDoc(avaliacaoRef, avaliacaoData);
      return avaliacaoData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/avaliacoes"] });
      toast({
        title: "Avaliação atualizada!",
        description: "As alterações foram salvas com sucesso.",
      });
      setEditDialogOpen(false);
      setEditingAvaliacao(null);
      editForm.reset();
      setAttachmentFile(null);
      setQuestoes([]);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar avaliação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenEditDialog = (avaliacao: Avaliacao) => {
    setEditingAvaliacao(avaliacao);
    editForm.reset({
      titulo: avaliacao.titulo,
      descricao: avaliacao.descricao || "",
      tipo: avaliacao.tipo as any,
      materia: avaliacao.materia,
      destinatarioTipo: avaliacao.turmaId ? "turma" : "alunos_especificos",
      turmaId: avaliacao.turmaId || "",
      dataInicio: format(new Date(avaliacao.dataInicio), "yyyy-MM-dd'T'HH:mm"),
      dataFim: format(new Date(avaliacao.dataFim), "yyyy-MM-dd'T'HH:mm"),
      duracaoMinutos: avaliacao.duracaoMinutos,
      valorTotal: avaliacao.valorTotal,
      modeloTipo: avaliacao.modeloTipo as any || "questoes",
      instrucoes: avaliacao.instrucoes || "",
      permitirAtraso: avaliacao.permitirAtraso || false,
      mostrarGabarito: avaliacao.mostrarGabarito || false,
      mostrarNota: avaliacao.mostrarNota !== false,
    });
    if (avaliacao.questoes && avaliacao.questoes.length > 0) {
      setQuestoes(avaliacao.questoes.map((q: any) => ({
        id: q.id,
        ordem: q.ordem,
        tipo: q.tipo,
        enunciado: q.enunciado,
        valor: q.valor,
        opcoes: q.opcoes,
        respostaCorreta: q.respostaCorreta,
        temaRedacao: q.temaRedacao,
        generoTextual: q.generoTextual,
        minimoLinhas: q.minimoLinhas,
        maximoLinhas: q.maximoLinhas,
        tipoCustomizado: q.tipoCustomizado,
        instrucoesEspecificas: q.instrucoesEspecificas,
      })));
    }
    setEditDialogOpen(true);
  };

  // Handler para abrir diálogo de edição de questões diretamente
  const handleOpenEditQuestoesDialog = (avaliacao: Avaliacao) => {
    setEditingAvaliacao(avaliacao);
    if (avaliacao.questoes && avaliacao.questoes.length > 0) {
      setQuestoes(avaliacao.questoes.map((q: any) => ({
        id: q.id,
        ordem: q.ordem,
        tipo: q.tipo,
        enunciado: q.enunciado,
        valor: q.valor,
        opcoes: q.opcoes,
        respostaCorreta: q.respostaCorreta,
        temaRedacao: q.temaRedacao,
        generoTextual: q.generoTextual,
        minimoLinhas: q.minimoLinhas,
        maximoLinhas: q.maximoLinhas,
        tipoCustomizado: q.tipoCustomizado,
        instrucoesEspecificas: q.instrucoesEspecificas,
      })));
    } else {
      setQuestoes([]);
    }
    setEditQuestoesDialogOpen(true);
  };

  // Mutation para atualizar apenas as questões
  const updateQuestoesMutation = useMutation({
    mutationFn: async () => {
      if (!editingAvaliacao) throw new Error("Nenhuma avaliação selecionada");
      
      const questoesData = questoes.map(q => {
        const questaoData: any = {
          id: q.id,
          ordem: q.ordem,
          tipo: q.tipo,
          enunciado: q.enunciado,
          valor: q.valor,
        };
        if (q.opcoes && q.opcoes.length > 0) questaoData.opcoes = q.opcoes;
        if (q.respostaCorreta) questaoData.respostaCorreta = q.respostaCorreta;
        if (q.temaRedacao) questaoData.temaRedacao = q.temaRedacao;
        if (q.generoTextual) questaoData.generoTextual = q.generoTextual;
        if (q.minimoLinhas) questaoData.minimoLinhas = q.minimoLinhas;
        if (q.maximoLinhas) questaoData.maximoLinhas = q.maximoLinhas;
        if (q.tipoCustomizado) questaoData.tipoCustomizado = q.tipoCustomizado;
        if (q.instrucoesEspecificas) questaoData.instrucoesEspecificas = q.instrucoesEspecificas;
        return questaoData;
      });

      const avaliacaoRef = doc(db, "avaliacoes", editingAvaliacao.id);
      await updateDoc(avaliacaoRef, {
        questoes: questoesData,
        atualizadoEm: getNowBrasiliaISO(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/avaliacoes"] });
      toast({
        title: "Questões atualizadas!",
        description: "As questões foram salvas com sucesso.",
      });
      setEditQuestoesDialogOpen(false);
      setEditingAvaliacao(null);
      setQuestoes([]);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar questões",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handler para abrir correção detalhada
  const handleOpenDetailedCorrection = (entrega: AvaliacaoEntrega) => {
    setSelectedEntrega(entrega);
    // Inicializar marcações se já existirem
    const initialMarcacoes: Record<string, "certo" | "errado" | "parcial"> = {};
    if (entrega.respostas) {
      entrega.respostas.forEach(r => {
        if (r.marcacao) {
          initialMarcacoes[r.questaoId] = r.marcacao;
        }
      });
    }
    setCorrecaoMarcacoes(initialMarcacoes);
    setDetailedCorrectionDialogOpen(true);
  };

  // Calcular nota baseada nas marcações
  const calcularNotaFromMarcacoes = (avaliacao: Avaliacao | undefined, marcacoes: Record<string, "certo" | "errado" | "parcial">) => {
    if (!avaliacao?.questoes) return 0;
    
    let totalObtido = 0;
    avaliacao.questoes.forEach((q: any) => {
      const marcacao = marcacoes[q.id];
      if (marcacao === "certo") {
        totalObtido += q.valor;
      } else if (marcacao === "parcial") {
        totalObtido += q.valor / 2;
      }
      // "errado" = 0, então não soma nada
    });
    
    return totalObtido;
  };

  // Mutation para salvar correção detalhada
  const saveDetailedCorrectionMutation = useMutation({
    mutationFn: async ({ entregaId, liberarParaAluno }: { entregaId: string; liberarParaAluno: boolean }) => {
      if (!userData || !selectedEntrega) throw new Error("Dados inválidos");
      
      const avaliacao = avaliacoes?.find(a => a.id === selectedEntrega.avaliacaoId);
      if (!avaliacao) throw new Error("Avaliação não encontrada");
      
      // Calcular nota total baseada nas marcações
      const notaTotal = calcularNotaFromMarcacoes(avaliacao, correcaoMarcacoes);
      const notaPercentual = (notaTotal / avaliacao.valorTotal) * 100;
      
      // Atualizar respostas com marcações e valores obtidos
      const respostasAtualizadas = selectedEntrega.respostas?.map(r => {
        const questao = avaliacao.questoes?.find((q: any) => q.id === r.questaoId);
        const marcacao = correcaoMarcacoes[r.questaoId];
        let valorObtido = 0;
        
        if (marcacao === "certo" && questao) {
          valorObtido = questao.valor;
        } else if (marcacao === "parcial" && questao) {
          valorObtido = questao.valor / 2;
        }
        
        return {
          ...r,
          marcacao,
          valorObtido,
        };
      });
      
      const entregaRef = doc(db, "avaliacaoEntregas", entregaId);
      await updateDoc(entregaRef, {
        nota: notaTotal,
        notaPercentual,
        respostas: respostasAtualizadas,
        feedback: correcaoForm.getValues("feedback") || "",
        status: "corrigida",
        corrigidoPor: userData.uid,
        corrigidoPorNome: userData.nome,
        dataCorrecao: getNowBrasiliaISO(),
        liberadoParaAluno: liberarParaAluno,
        dataLiberacao: liberarParaAluno ? getNowBrasiliaISO() : undefined,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/avaliacao-entregas"] });
      toast({
        title: "Correção salva!",
        description: variables.liberarParaAluno 
          ? "A correção foi liberada para o aluno." 
          : "A correção foi salva mas ainda não foi liberada para o aluno.",
      });
      setDetailedCorrectionDialogOpen(false);
      setSelectedEntrega(null);
      setCorrecaoMarcacoes({});
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

  // Funções auxiliares para gerenciar questões
  const resetNovaQuestao = () => {
    setNovaQuestao({
      tipo: "multipla_escolha",
      enunciado: "",
      valor: 1,
      opcoes: [
        { letra: "A", texto: "", correta: false },
        { letra: "B", texto: "", correta: false },
        { letra: "C", texto: "", correta: false },
        { letra: "D", texto: "", correta: false },
      ],
    });
    setEditingQuestao(null);
  };

  const handleAddQuestao = () => {
    // Nenhum campo é obrigatório - professor pode salvar questões parcialmente preenchidas
    const questao: QuestaoTemp = {
      id: editingQuestao?.id || `q_${Date.now()}`,
      ordem: editingQuestao?.ordem || questoes.length + 1,
      tipo: novaQuestao.tipo || "multipla_escolha",
      enunciado: novaQuestao.enunciado || "",
      valor: novaQuestao.valor || 1,
      opcoes: novaQuestao.opcoes?.filter(o => o.texto.trim()),
      respostaCorreta: novaQuestao.respostaCorreta,
      temaRedacao: novaQuestao.temaRedacao,
      generoTextual: novaQuestao.generoTextual,
      minimoLinhas: novaQuestao.minimoLinhas,
      maximoLinhas: novaQuestao.maximoLinhas,
      tipoCustomizado: novaQuestao.tipoCustomizado,
      instrucoesEspecificas: novaQuestao.instrucoesEspecificas,
    };

    if (editingQuestao) {
      setQuestoes(prev => prev.map(q => q.id === editingQuestao.id ? questao : q));
      toast({ title: "Questão atualizada!" });
    } else {
      setQuestoes(prev => [...prev, questao]);
      toast({ title: "Questão adicionada!" });
    }

    setQuestaoDialogOpen(false);
    resetNovaQuestao();
  };

  const handleEditQuestao = (questao: QuestaoTemp) => {
    setEditingQuestao(questao);
    setNovaQuestao({
      tipo: questao.tipo,
      enunciado: questao.enunciado,
      valor: questao.valor,
      opcoes: questao.opcoes || [
        { letra: "A", texto: "", correta: false },
        { letra: "B", texto: "", correta: false },
        { letra: "C", texto: "", correta: false },
        { letra: "D", texto: "", correta: false },
      ],
      respostaCorreta: questao.respostaCorreta,
      temaRedacao: questao.temaRedacao,
      generoTextual: questao.generoTextual,
      minimoLinhas: questao.minimoLinhas,
      maximoLinhas: questao.maximoLinhas,
      tipoCustomizado: questao.tipoCustomizado,
      instrucoesEspecificas: questao.instrucoesEspecificas,
    });
    setQuestaoDialogOpen(true);
  };

  const handleDeleteQuestao = (id: string) => {
    setQuestoes(prev => prev.filter(q => q.id !== id).map((q, index) => ({ ...q, ordem: index + 1 })));
    toast({ title: "Questão removida!" });
  };

  const handleMoveQuestao = (index: number, direction: "up" | "down") => {
    const newQuestoes = [...questoes];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newQuestoes.length) return;
    
    [newQuestoes[index], newQuestoes[targetIndex]] = [newQuestoes[targetIndex], newQuestoes[index]];
    setQuestoes(newQuestoes.map((q, i) => ({ ...q, ordem: i + 1 })));
  };

  const handleDuplicateQuestao = (questao: QuestaoTemp) => {
    const duplicated: QuestaoTemp = {
      ...questao,
      id: `q_${Date.now()}`,
      ordem: questoes.length + 1,
    };
    setQuestoes(prev => [...prev, duplicated]);
    toast({ title: "Questão duplicada!" });
  };

  const getTipoQuestaoLabel = (tipo: string) => {
    const found = TIPOS_QUESTAO.find(t => t.value === tipo);
    return found?.label || tipo;
  };

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
    
    const generateQuestoesHTML = () => {
      if (!avaliacao.questoes || avaliacao.questoes.length === 0) return "";
      
      return `
        <div class="questoes-section">
          <h3 style="margin-top: 30px; margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">Questões</h3>
          ${avaliacao.questoes.map((q: any, index: number) => `
            <div class="questao" style="margin-bottom: 25px; page-break-inside: avoid;">
              <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px;">
                <span style="font-weight: bold; background: #e5e7eb; padding: 4px 10px; border-radius: 4px; font-size: 14px;">
                  ${index + 1}
                </span>
                <span style="font-size: 12px; color: #666; background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">
                  ${getTipoQuestaoLabel(q.tipo)} - ${q.valor} pt${q.valor !== 1 ? 's' : ''}
                </span>
              </div>
              <p style="margin: 10px 0; line-height: 1.6;">${q.enunciado || "(Sem enunciado)"}</p>
              ${q.tipo === "multipla_escolha" || q.tipo === "objetiva" ? `
                <div style="margin-left: 20px;">
                  ${(q.opcoes || []).map((op: any) => `
                    <div style="margin: 8px 0; display: flex; align-items: center; gap: 8px;">
                      <span style="font-weight: bold; border: 1px solid #000; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;">
                        ${op.letra}
                      </span>
                      <span>${op.texto || ""}</span>
                    </div>
                  `).join("")}
                </div>
              ` : ""}
              ${q.tipo === "verdadeiro_falso" ? `
                <div style="margin-left: 20px;">
                  <div style="margin: 8px 0; display: flex; align-items: center; gap: 8px;">
                    <span style="border: 1px solid #000; width: 20px; height: 20px; display: inline-block;"></span>
                    <span>Verdadeiro</span>
                  </div>
                  <div style="margin: 8px 0; display: flex; align-items: center; gap: 8px;">
                    <span style="border: 1px solid #000; width: 20px; height: 20px; display: inline-block;"></span>
                    <span>Falso</span>
                  </div>
                </div>
              ` : ""}
              ${q.tipo === "dissertativa" ? `
                <div style="margin-top: 15px;">
                  ${Array(5).fill(0).map(() => `
                    <div style="border-bottom: 1px solid #ccc; height: 30px; margin-bottom: 5px;"></div>
                  `).join("")}
                </div>
              ` : ""}
              ${q.tipo === "redacao" ? `
                <div style="margin-top: 10px; padding: 10px; background: #f9fafb; border-radius: 4px;">
                  ${q.temaRedacao ? `<p><strong>Tema:</strong> ${q.temaRedacao}</p>` : ""}
                  ${q.generoTextual ? `<p><strong>Gênero:</strong> ${q.generoTextual}</p>` : ""}
                  ${q.minimoLinhas || q.maximoLinhas ? `<p><strong>Linhas:</strong> ${q.minimoLinhas || 0} a ${q.maximoLinhas || 30}</p>` : ""}
                </div>
                <div style="margin-top: 15px;">
                  ${Array(q.maximoLinhas || 20).fill(0).map((_, i) => `
                    <div style="display: flex; align-items: center; height: 28px; border-bottom: 1px solid #ccc;">
                      <span style="width: 25px; font-size: 10px; color: #999;">${i + 1}</span>
                    </div>
                  `).join("")}
                </div>
              ` : ""}
            </div>
          `).join("")}
        </div>
      `;
    };
    
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
          @media print { body { padding: 20px; } .questao { page-break-inside: avoid; } }
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
        
        ${generateQuestoesHTML()}
        
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
          <h3 className="text-2xl font-bold">Atividades e Avaliações</h3>
          <p className="text-muted-foreground">Gerencie provas, simulados, atividades e trabalhos</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-avaliacao">
          <Plus className="h-4 w-4 mr-2" />
          Nova Demanda
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
            onEdit={handleOpenEditDialog}
            onEditQuestoes={handleOpenEditQuestoesDialog}
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
            onEdit={handleOpenEditDialog}
            onEditQuestoes={handleOpenEditQuestoesDialog}
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
            onEdit={handleOpenEditDialog}
            onEditQuestoes={handleOpenEditQuestoesDialog}
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
            onEdit={handleOpenEditDialog}
            onEditQuestoes={handleOpenEditQuestoesDialog}
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
                <CardFooter className="flex flex-wrap gap-2">
                  {(() => {
                    const avaliacao = avaliacoes?.find(a => a.id === entrega.avaliacaoId);
                    const hasQuestoes = avaliacao?.questoes && avaliacao.questoes.length > 0;
                    return (
                      <>
                        {hasQuestoes && (
                          <Button
                            onClick={() => handleOpenDetailedCorrection(entrega)}
                            data-testid="button-corrigir-detalhado"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Correção Detalhada
                          </Button>
                        )}
                        <Button
                          variant={hasQuestoes ? "outline" : "default"}
                          onClick={() => {
                            setSelectedEntrega(entrega);
                            setGradeDialogOpen(true);
                          }}
                          data-testid="button-corrigir"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          {hasQuestoes ? "Correção Rápida" : "Corrigir"}
                        </Button>
                      </>
                    );
                  })()}
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

              {form.watch("modeloTipo") === "questoes" && (
                <div className="space-y-4 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium flex items-center gap-2">
                        <ListOrdered className="h-4 w-4" />
                        Questões da Avaliação
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {questoes.length === 0 
                          ? "Nenhuma questão adicionada ainda" 
                          : `${questoes.length} questão(ões) - Total: ${questoes.reduce((acc, q) => acc + q.valor, 0)} pontos`}
                      </p>
                    </div>
                    <Button 
                      type="button" 
                      onClick={() => {
                        resetNovaQuestao();
                        setQuestaoDialogOpen(true);
                      }}
                      data-testid="button-add-questao"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Questão
                    </Button>
                  </div>

                  {questoes.length > 0 && (
                    <ScrollArea className="max-h-[300px]">
                      <div className="space-y-2">
                        {questoes.map((questao, index) => (
                          <Card key={questao.id} className="p-3">
                            <div className="flex items-start gap-3">
                              <div className="flex flex-col gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  disabled={index === 0}
                                  onClick={() => handleMoveQuestao(index, "up")}
                                  data-testid={`button-move-up-${questao.id}`}
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  disabled={index === questoes.length - 1}
                                  onClick={() => handleMoveQuestao(index, "down")}
                                  data-testid={`button-move-down-${questao.id}`}
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm">Questão {questao.ordem}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {getTipoQuestaoLabel(questao.tipo)}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {questao.valor} pt{questao.valor !== 1 ? "s" : ""}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {questao.enunciado}
                                </p>
                                {questao.tipo === "multipla_escolha" && questao.opcoes && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {questao.opcoes.map(op => (
                                      <span 
                                        key={op.letra}
                                        className={`text-xs px-1.5 py-0.5 rounded ${
                                          op.correta 
                                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" 
                                            : "bg-muted"
                                        }`}
                                      >
                                        {op.letra}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => handleDuplicateQuestao(questao)}
                                  data-testid={`button-duplicate-${questao.id}`}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => handleEditQuestao(questao)}
                                  data-testid={`button-edit-${questao.id}`}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteQuestao(questao.id)}
                                  data-testid={`button-delete-${questao.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
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

      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) {
          setEditingAvaliacao(null);
          editForm.reset();
          setQuestoes([]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-avaliacao">
          <DialogHeader>
            <DialogTitle>Editar Avaliação</DialogTitle>
            <DialogDescription>
              Atualize os dados da avaliação
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => editingAvaliacao && updateMutation.mutate({ ...data, id: editingAvaliacao.id }))} className="space-y-4">
              <FormField
                control={editForm.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Prova de Matemática - Unidade 1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (opcional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descreva o conteúdo..." rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
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
                  control={editForm.control}
                  name="materia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Matéria</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="turmaId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Turma</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
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

                <FormField
                  control={editForm.control}
                  name="valorTotal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor (pontos)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          max="100" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="dataInicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data/Hora de Início</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="dataFim"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data/Hora Limite</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="instrucoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instruções (opcional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Instruções para os alunos..." rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {editingAvaliacao?.questoes && editingAvaliacao.questoes.length > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">
                    Questões: {editingAvaliacao.questoes.length} questão(ões) cadastrada(s)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Para editar questões, use o botão "Adicionar Questão" após salvar ou crie uma nova avaliação.
                  </p>
                </div>
              )}

              <div className="flex items-center space-x-4">
                <FormField
                  control={editForm.control}
                  name="permitirAtraso"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="font-normal">Permitir atraso</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="mostrarNota"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="font-normal">Mostrar nota</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setEditingAvaliacao(null);
                    editForm.reset();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Edit className="mr-2 h-4 w-4 animate-pulse" />}
                  Salvar Alterações
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

      {/* Diálogo para criar/editar questão */}
      <Dialog open={questaoDialogOpen} onOpenChange={(open) => {
        setQuestaoDialogOpen(open);
        if (!open) resetNovaQuestao();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-questao">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              {editingQuestao ? "Editar Questão" : "Nova Questão"}
            </DialogTitle>
            <DialogDescription>
              Configure os detalhes da questão para a avaliação
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Tipo da Questão */}
            <div className="space-y-2">
              <Label>Tipo da Questão</Label>
              <Select 
                value={novaQuestao.tipo} 
                onValueChange={(value: QuestaoTemp["tipo"]) => {
                  setNovaQuestao(prev => {
                    const newState: Partial<QuestaoTemp> = { ...prev, tipo: value };
                    if (value === "multipla_escolha" && !prev.opcoes?.length) {
                      newState.opcoes = [
                        { letra: "A", texto: "", correta: false },
                        { letra: "B", texto: "", correta: false },
                        { letra: "C", texto: "", correta: false },
                        { letra: "D", texto: "", correta: false },
                      ];
                    }
                    if (value === "verdadeiro_falso") {
                      newState.opcoes = [
                        { letra: "V", texto: "Verdadeiro", correta: false },
                        { letra: "F", texto: "Falso", correta: false },
                      ];
                    }
                    return newState;
                  });
                }}
              >
                <SelectTrigger data-testid="select-tipo-questao">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_QUESTAO.map(tipo => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo Customizado (para "outros") */}
            {novaQuestao.tipo === "outros" && (
              <div className="space-y-2">
                <Label>Descrição do Tipo</Label>
                <Input
                  placeholder="Ex: Questão de associação de colunas"
                  value={novaQuestao.tipoCustomizado || ""}
                  onChange={(e) => setNovaQuestao(prev => ({ ...prev, tipoCustomizado: e.target.value }))}
                  data-testid="input-tipo-customizado"
                />
              </div>
            )}

            {/* Valor da Questão */}
            <div className="space-y-2">
              <Label>Valor (pontos)</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={novaQuestao.valor || 1}
                onChange={(e) => setNovaQuestao(prev => ({ ...prev, valor: parseFloat(e.target.value) || 1 }))}
                data-testid="input-valor-questao"
              />
            </div>

            {/* Enunciado */}
            <div className="space-y-2">
              <Label>Enunciado da Questão *</Label>
              <Textarea
                rows={4}
                placeholder="Digite o texto da questão..."
                value={novaQuestao.enunciado || ""}
                onChange={(e) => setNovaQuestao(prev => ({ ...prev, enunciado: e.target.value }))}
                data-testid="input-enunciado"
              />
            </div>

            {/* Opções para Múltipla Escolha */}
            {novaQuestao.tipo === "multipla_escolha" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Opções de Resposta</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const letras = ["A", "B", "C", "D", "E", "F", "G", "H"];
                      const nextLetter = letras[novaQuestao.opcoes?.length || 0];
                      if (nextLetter) {
                        setNovaQuestao(prev => ({
                          ...prev,
                          opcoes: [...(prev.opcoes || []), { letra: nextLetter, texto: "", correta: false }]
                        }));
                      }
                    }}
                    disabled={(novaQuestao.opcoes?.length || 0) >= 8}
                    data-testid="button-add-opcao"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Opção
                  </Button>
                </div>
                <div className="space-y-2">
                  {novaQuestao.opcoes?.map((opcao, index) => (
                    <div key={opcao.letra} className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant={opcao.correta ? "default" : "outline"}
                        className="h-8 w-8 shrink-0"
                        onClick={() => {
                          setNovaQuestao(prev => ({
                            ...prev,
                            opcoes: prev.opcoes?.map(o => ({
                              ...o,
                              correta: o.letra === opcao.letra
                            }))
                          }));
                        }}
                        data-testid={`button-correta-${opcao.letra}`}
                      >
                        {opcao.correta ? <Check className="h-4 w-4" /> : opcao.letra}
                      </Button>
                      <Input
                        placeholder={`Opção ${opcao.letra}`}
                        value={opcao.texto}
                        onChange={(e) => {
                          setNovaQuestao(prev => ({
                            ...prev,
                            opcoes: prev.opcoes?.map(o => 
                              o.letra === opcao.letra ? { ...o, texto: e.target.value } : o
                            )
                          }));
                        }}
                        data-testid={`input-opcao-${opcao.letra}`}
                      />
                      {(novaQuestao.opcoes?.length || 0) > 2 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => {
                            setNovaQuestao(prev => ({
                              ...prev,
                              opcoes: prev.opcoes?.filter(o => o.letra !== opcao.letra)
                            }));
                          }}
                          data-testid={`button-remove-opcao-${opcao.letra}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Clique na letra para marcar como resposta correta
                </p>
              </div>
            )}

            {/* Opções para Verdadeiro/Falso */}
            {novaQuestao.tipo === "verdadeiro_falso" && (
              <div className="space-y-3">
                <Label>Resposta Correta</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={novaQuestao.opcoes?.find(o => o.letra === "V")?.correta ? "default" : "outline"}
                    onClick={() => {
                      setNovaQuestao(prev => ({
                        ...prev,
                        opcoes: prev.opcoes?.map(o => ({
                          ...o,
                          correta: o.letra === "V"
                        }))
                      }));
                    }}
                    data-testid="button-verdadeiro"
                  >
                    {novaQuestao.opcoes?.find(o => o.letra === "V")?.correta && <Check className="h-4 w-4 mr-2" />}
                    Verdadeiro
                  </Button>
                  <Button
                    type="button"
                    variant={novaQuestao.opcoes?.find(o => o.letra === "F")?.correta ? "default" : "outline"}
                    onClick={() => {
                      setNovaQuestao(prev => ({
                        ...prev,
                        opcoes: prev.opcoes?.map(o => ({
                          ...o,
                          correta: o.letra === "F"
                        }))
                      }));
                    }}
                    data-testid="button-falso"
                  >
                    {novaQuestao.opcoes?.find(o => o.letra === "F")?.correta && <Check className="h-4 w-4 mr-2" />}
                    Falso
                  </Button>
                </div>
              </div>
            )}

            {/* Campo de resposta para objetiva */}
            {novaQuestao.tipo === "objetiva" && (
              <div className="space-y-2">
                <Label>Resposta Esperada (gabarito)</Label>
                <Input
                  placeholder="Ex: Brasil, 42, etc."
                  value={novaQuestao.respostaCorreta || ""}
                  onChange={(e) => setNovaQuestao(prev => ({ ...prev, respostaCorreta: e.target.value }))}
                  data-testid="input-resposta-correta"
                />
                <p className="text-xs text-muted-foreground">
                  A resposta esperada para correção automática
                </p>
              </div>
            )}

            {/* Campos específicos para Redação */}
            {novaQuestao.tipo === "redacao" && (
              <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                <h4 className="font-medium flex items-center gap-2">
                  <PenLine className="h-4 w-4" />
                  Configurações da Redação
                </h4>
                
                <div className="space-y-2">
                  <Label>Tema da Redação</Label>
                  <Input
                    placeholder="Ex: A importância da leitura na formação cidadã"
                    value={novaQuestao.temaRedacao || ""}
                    onChange={(e) => setNovaQuestao(prev => ({ ...prev, temaRedacao: e.target.value }))}
                    data-testid="input-tema-redacao"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Gênero Textual</Label>
                  <Select
                    value={novaQuestao.generoTextual || ""}
                    onValueChange={(value) => setNovaQuestao(prev => ({ ...prev, generoTextual: value }))}
                  >
                    <SelectTrigger data-testid="select-genero-textual">
                      <SelectValue placeholder="Selecione o gênero" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dissertativo-argumentativo">Dissertativo-Argumentativo</SelectItem>
                      <SelectItem value="carta">Carta</SelectItem>
                      <SelectItem value="artigo">Artigo de Opinião</SelectItem>
                      <SelectItem value="narrativo">Texto Narrativo</SelectItem>
                      <SelectItem value="descritivo">Texto Descritivo</SelectItem>
                      <SelectItem value="cronica">Crônica</SelectItem>
                      <SelectItem value="livre">Livre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mínimo de Linhas</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Ex: 20"
                      value={novaQuestao.minimoLinhas || ""}
                      onChange={(e) => setNovaQuestao(prev => ({ ...prev, minimoLinhas: parseInt(e.target.value) || undefined }))}
                      data-testid="input-minimo-linhas"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Máximo de Linhas</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Ex: 30"
                      value={novaQuestao.maximoLinhas || ""}
                      onChange={(e) => setNovaQuestao(prev => ({ ...prev, maximoLinhas: parseInt(e.target.value) || undefined }))}
                      data-testid="input-maximo-linhas"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Instruções Específicas (para todos os tipos) */}
            <div className="space-y-2">
              <Label>Instruções Específicas (opcional)</Label>
              <Textarea
                rows={2}
                placeholder="Ex: Use caneta azul ou preta. Não é permitido rasuras."
                value={novaQuestao.instrucoesEspecificas || ""}
                onChange={(e) => setNovaQuestao(prev => ({ ...prev, instrucoesEspecificas: e.target.value }))}
                data-testid="input-instrucoes-especificas"
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setQuestaoDialogOpen(false);
                resetNovaQuestao();
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleAddQuestao} data-testid="button-save-questao">
              {editingQuestao ? "Atualizar" : "Adicionar"} Questão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Edição Direta de Questões */}
      <Dialog open={editQuestoesDialogOpen} onOpenChange={setEditQuestoesDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-questoes">
          <DialogHeader>
            <DialogTitle>Editar Questões</DialogTitle>
            <DialogDescription>
              {editingAvaliacao?.titulo} - {questoes.length} questão(ões)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Valor total: {questoes.reduce((acc, q) => acc + (q.valor || 0), 0)} pts
              </span>
              <Button
                size="sm"
                onClick={() => setQuestaoDialogOpen(true)}
                data-testid="button-add-questao-edit"
              >
                <Plus className="h-4 w-4 mr-1" />
                Nova Questão
              </Button>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
              {questoes.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">Nenhuma questão cadastrada</p>
                  </CardContent>
                </Card>
              ) : (
                questoes.map((questao, index) => (
                  <Card key={questao.id} className="hover-elevate">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">Q{index + 1}</Badge>
                            <Badge variant="secondary">
                              {questao.tipo === "multipla_escolha" ? "Múltipla Escolha" :
                               questao.tipo === "objetiva" ? "Objetiva" :
                               questao.tipo === "dissertativa" ? "Dissertativa" :
                               questao.tipo === "verdadeiro_falso" ? "V/F" :
                               questao.tipo === "redacao" ? "Redação" : questao.tipo}
                            </Badge>
                            <span className="text-sm text-muted-foreground">{questao.valor} pts</span>
                          </div>
                          <p className="text-sm line-clamp-2">
                            {questao.enunciado || "(Sem enunciado)"}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditQuestao(questao)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteQuestao(questao.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditQuestoesDialogOpen(false);
                setEditingAvaliacao(null);
                setQuestoes([]);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => updateQuestoesMutation.mutate()}
              disabled={updateQuestoesMutation.isPending}
              data-testid="button-save-questoes"
            >
              {updateQuestoesMutation.isPending ? "Salvando..." : "Salvar Questões"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Correção Detalhada com Marcações */}
      <Dialog open={detailedCorrectionDialogOpen} onOpenChange={setDetailedCorrectionDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-detailed-correction">
          <DialogHeader>
            <DialogTitle>Correção Detalhada</DialogTitle>
            <DialogDescription>
              {selectedEntrega?.avaliacaoTitulo} - Aluno: {selectedEntrega?.alunoNome}
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const avaliacao = avaliacoes?.find(a => a.id === selectedEntrega?.avaliacaoId);
            const valorTotal = avaliacao?.valorTotal || 0;
            const notaCalculada = calcularNotaFromMarcacoes(avaliacao, correcaoMarcacoes);
            const percentual = valorTotal > 0 ? ((notaCalculada / valorTotal) * 100).toFixed(1) : "0";
            
            return (
              <div className="space-y-4">
                {/* Resumo da Nota */}
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Nota Calculada</p>
                        <p className="text-2xl font-bold">{notaCalculada} / {valorTotal}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Percentual</p>
                        <p className="text-2xl font-bold">{percentual}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Lista de Questões com Respostas e Marcações */}
                <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-2">
                  {avaliacao?.questoes?.map((questao: any, index: number) => {
                    const resposta = selectedEntrega?.respostas?.find(r => r.questaoId === questao.id);
                    const marcacao = correcaoMarcacoes[questao.id];
                    
                    return (
                      <Card key={questao.id} className={
                        marcacao === "certo" ? "border-green-500 border-2" :
                        marcacao === "errado" ? "border-red-500 border-2" :
                        marcacao === "parcial" ? "border-amber-500 border-2" : ""
                      }>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">Questão {index + 1}</Badge>
                                <span className="text-sm font-medium">{questao.valor} pts</span>
                              </div>
                              <p className="text-sm mb-3 whitespace-pre-wrap">
                                {questao.enunciado}
                              </p>
                              
                              {/* Resposta do aluno */}
                              <div className="bg-muted/50 p-3 rounded-md">
                                <p className="text-xs text-muted-foreground mb-1">Resposta do aluno:</p>
                                <p className="text-sm">
                                  {resposta?.resposta || "(Não respondeu)"}
                                </p>
                              </div>

                              {/* Gabarito (se objetiva) */}
                              {questao.respostaCorreta && (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  Gabarito: <span className="font-medium">{questao.respostaCorreta}</span>
                                </div>
                              )}
                            </div>

                            {/* Botões de Marcação */}
                            <div className="flex flex-col gap-2">
                              <Button
                                size="sm"
                                variant={marcacao === "certo" ? "default" : "outline"}
                                className={marcacao === "certo" ? "bg-green-600 hover:bg-green-700" : ""}
                                onClick={() => setCorrecaoMarcacoes(prev => ({ ...prev, [questao.id]: "certo" }))}
                                data-testid={`button-mark-certo-${questao.id}`}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Certo
                              </Button>
                              <Button
                                size="sm"
                                variant={marcacao === "parcial" ? "default" : "outline"}
                                className={marcacao === "parcial" ? "bg-amber-600 hover:bg-amber-700" : ""}
                                onClick={() => setCorrecaoMarcacoes(prev => ({ ...prev, [questao.id]: "parcial" }))}
                                data-testid={`button-mark-parcial-${questao.id}`}
                              >
                                <AlertCircle className="h-4 w-4 mr-1" />
                                Parcial
                              </Button>
                              <Button
                                size="sm"
                                variant={marcacao === "errado" ? "default" : "outline"}
                                className={marcacao === "errado" ? "bg-red-600 hover:bg-red-700" : ""}
                                onClick={() => setCorrecaoMarcacoes(prev => ({ ...prev, [questao.id]: "errado" }))}
                                data-testid={`button-mark-errado-${questao.id}`}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Errado
                              </Button>
                            </div>
                          </div>

                          {/* Valor obtido */}
                          {marcacao && (
                            <div className="text-sm text-right">
                              Pontos: <span className="font-medium">
                                {marcacao === "certo" ? questao.valor :
                                 marcacao === "parcial" ? (questao.valor / 2) : 0}
                              </span> / {questao.valor}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Feedback Geral */}
                <div className="space-y-2">
                  <Label>Feedback Geral (opcional)</Label>
                  <Textarea
                    placeholder="Escreva um feedback geral sobre a avaliação do aluno..."
                    rows={3}
                    {...correcaoForm.register("feedback")}
                    data-testid="input-feedback-detalhado"
                  />
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDetailedCorrectionDialogOpen(false);
                setSelectedEntrega(null);
                setCorrecaoMarcacoes({});
                correcaoForm.reset();
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={() => selectedEntrega && saveDetailedCorrectionMutation.mutate({ 
                entregaId: selectedEntrega.id, 
                liberarParaAluno: false 
              })}
              disabled={saveDetailedCorrectionMutation.isPending}
              data-testid="button-save-correction-draft"
            >
              Salvar Rascunho
            </Button>
            <Button
              onClick={() => selectedEntrega && saveDetailedCorrectionMutation.mutate({ 
                entregaId: selectedEntrega.id, 
                liberarParaAluno: true 
              })}
              disabled={saveDetailedCorrectionMutation.isPending}
              data-testid="button-save-and-release"
            >
              {saveDetailedCorrectionMutation.isPending ? "Salvando..." : "Salvar e Liberar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface AvaliacaoListProps {
  avaliacoes: Avaliacao[];
  loading: boolean;
  onView: (avaliacao: Avaliacao) => void;
  onEdit: (avaliacao: Avaliacao) => void;
  onEditQuestoes: (avaliacao: Avaliacao) => void;
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
  onEdit,
  onEditQuestoes,
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
              <Button variant="outline" size="sm" onClick={() => onEdit(avaliacao)} data-testid="button-edit-avaliacao">
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
              {avaliacao.modeloTipo === "questoes" && (
                <Button variant="outline" size="sm" onClick={() => onEditQuestoes(avaliacao)} data-testid="button-edit-questoes">
                  <ListOrdered className="h-4 w-4 mr-1" />
                  Editar questões
                </Button>
              )}
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
