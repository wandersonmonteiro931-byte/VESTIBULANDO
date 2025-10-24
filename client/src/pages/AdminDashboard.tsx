import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { collection, addDoc, updateDoc, doc, where, setDoc, deleteDoc, getDoc, getDocs, query, runTransaction, increment } from "firebase/firestore";
import { db, auth as firebaseAuth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, deleteUser, fetchSignInMethodsForEmail } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { MonitoringTab } from "@/components/MonitoringTab";
import { DocumentationTab } from "@/components/DocumentationTab";
import { AnnouncementsTab } from "@/components/AnnouncementsTab";
import { InternalDocumentsTab } from "@/components/InternalDocumentsTab";
import { BrasiliaClock } from "@/components/BrasiliaClock";
import ChatButton from "@/components/ChatButton";
import ChatAuditPanel from "@/components/ChatAuditPanel";
import { LogOut, Plus, Users, BookOpen, GraduationCap, FileText, Edit, Trash2, CheckCircle, XCircle, RefreshCw, MessageCircle, ArrowRightLeft, Clock, Search, Eye, AlertTriangle, Settings, Power, PowerOff, Archive, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import type { User, Turma, Maintenance } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { brasiliaToUTC, utcToBrasilia, formatBrasiliaDateTime, getNowBrasilia, getNowBrasiliaISO } from "@/lib/brasiliaTime";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const turmaFormSchema = z.object({
  nome: z.string().min(1, "Nome da turma é obrigatório"),
  ano: z.string().min(1, "Ano é obrigatório"),
  vagasTotais: z.coerce.number().min(1, "Número de vagas deve ser maior que 0"),
  periodoMatriculaInicio: z.string().optional(),
  periodoMatriculaFim: z.string().optional(),
  linkWhatsApp: z.string().optional(),
});

const alunoFormSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  turma: z.string().optional(),
  tipo: z.enum(["aluno", "professor", "diretor"]).default("aluno"),
}).refine((data) => {
  if (data.tipo === "aluno" && !data.turma) {
    return false;
  }
  return true;
}, {
  message: "Turma é obrigatória para alunos",
  path: ["turma"],
});

const professorDiretorFormSchema = z.object({
  nome: z.string().min(1, "Nome completo é obrigatório"),
  dataNascimento: z.string().min(1, "Data de nascimento é obrigatória"),
  cpf: z.string().min(14, "CPF inválido"),
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  telefone: z.string().min(1, "Telefone é obrigatório"),
  cep: z.string().min(9, "CEP inválido"),
  rua: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  escolaridade: z.string().min(1, "Escolaridade é obrigatória"),
  tipo: z.enum(["professor", "diretor"]),
  turmas: z.array(z.string()).optional(),
});

const editStudentFormSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  matricula: z.string().optional(),
  dataNascimento: z.string().min(1, "Data de nascimento é obrigatória"),
  cpf: z.string().min(1, "CPF é obrigatório"),
  telefone: z.string().min(1, "Telefone é obrigatório"),
  escolaridade: z.string().min(1, "Escolaridade é obrigatória"),
  cep: z.string().min(1, "CEP é obrigatório"),
  rua: z.string().min(1, "Rua é obrigatória"),
  bairro: z.string().min(1, "Bairro é obrigatório"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  estado: z.string().min(1, "Estado é obrigatório"),
  turma: z.string().min(1, "Turma é obrigatória"),
  disponibilidade: z.array(z.string()).min(1, "Selecione pelo menos uma disponibilidade"),
});

// Componente para mostrar tempo decorrido da manutenção
function MaintenanceTimer({ startTime, onFinalize }: { startTime: string; onFinalize: () => void }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const calculateElapsed = () => {
      const start = new Date(startTime);
      const now = new Date();
      const diff = now.getTime() - start.getTime();

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    setElapsed(calculateElapsed());
    const interval = setInterval(() => {
      setElapsed(calculateElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20 border-2 border-orange-300 dark:border-orange-700 rounded-lg">
      <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
        <Clock className="h-5 w-5" />
        <span className="text-sm font-medium">Tempo em Manutenção</span>
      </div>
      <div className="text-4xl font-mono font-bold text-orange-600 dark:text-orange-400" data-testid="maintenance-timer">
        {elapsed}
      </div>
      <Button
        variant="destructive"
        size="sm"
        onClick={onFinalize}
        className="mt-1"
        data-testid="button-quick-end-maintenance"
      >
        <PowerOff className="h-4 w-4 mr-2" />
        Finalizar Manutenção
      </Button>
    </div>
  );
}

export default function AdminDashboard() {
  const { userData, signOut, refreshUserData } = useAuth();
  const { toast } = useToast();
  const [createTurmaDialogOpen, setCreateTurmaDialogOpen] = useState(false);
  const [createAlunoDialogOpen, setCreateAlunoDialogOpen] = useState(false);
  const [createProfessorDiretorDialogOpen, setCreateProfessorDiretorDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [userToReject, setUserToReject] = useState<any | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [userToReturn, setUserToReturn] = useState<any | null>(null);
  const [returnComment, setReturnComment] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [solicitacaoToApprove, setSolicitacaoToApprove] = useState<any | null>(null);
  const [senhaInicial, setSenhaInicial] = useState("");
  const [editWhatsAppDialogOpen, setEditWhatsAppDialogOpen] = useState(false);
  const [selectedTurmaForWhatsApp, setSelectedTurmaForWhatsApp] = useState<any | null>(null);
  const [whatsAppLink, setWhatsAppLink] = useState("");
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [userToTransfer, setUserToTransfer] = useState<any | null>(null);
  const [newTurma, setNewTurma] = useState("");
  const [disponibilidadeHorario, setDisponibilidadeHorario] = useState<string[]>([]);
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<string[]>([]);
  const [viewTurmaStudentsDialogOpen, setViewTurmaStudentsDialogOpen] = useState(false);
  const [selectedTurmaForStudents, setSelectedTurmaForStudents] = useState<Turma | null>(null);
  const [addStudentsDialogOpen, setAddStudentsDialogOpen] = useState(false);
  const [selectedStudentsToAdd, setSelectedStudentsToAdd] = useState<string[]>([]);
  const [editVagasDialogOpen, setEditVagasDialogOpen] = useState(false);
  const [selectedTurmaForVagas, setSelectedTurmaForVagas] = useState<Turma | null>(null);
  const [novasVagas, setNovasVagas] = useState(0);
  const [selectedStudentsForBulkAction, setSelectedStudentsForBulkAction] = useState<string[]>([]);
  const [bulkTransferDialogOpen, setBulkTransferDialogOpen] = useState(false);
  const [bulkTransferTurma, setBulkTransferTurma] = useState("");
  const [viewDetailsDialogOpen, setViewDetailsDialogOpen] = useState(false);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<any>(null);
  const [editSolicitacaoDialogOpen, setEditSolicitacaoDialogOpen] = useState(false);
  const [solicitacaoToEdit, setSolicitacaoToEdit] = useState<any>(null);
  const [standbyDialogOpen, setStandbyDialogOpen] = useState(false);
  const [userToStandby, setUserToStandby] = useState<any>(null);
  const [standbyComment, setStandbyComment] = useState("");
  const [editTurmaDialogOpen, setEditTurmaDialogOpen] = useState(false);
  const [turmaToEdit, setTurmaToEdit] = useState<Turma | null>(null);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [studentDetailsDialogOpen, setStudentDetailsDialogOpen] = useState(false);
  const [selectedStudentDetails, setSelectedStudentDetails] = useState<User | null>(null);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editStudentDisponibilidade, setEditStudentDisponibilidade] = useState<string[]>([]);
  const [disciplinarySearchTerm, setDisciplinarySearchTerm] = useState("");
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [suspensionDialogOpen, setSuspensionDialogOpen] = useState(false);
  const [selectedStudentForDisciplinary, setSelectedStudentForDisciplinary] = useState<User | null>(null);
  const [disciplinaryReason, setDisciplinaryReason] = useState("");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<User | null>(null);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [maintenanceType, setMaintenanceType] = useState<"determinada" | "indeterminada">("determinada");
  const [maintenanceStartDate, setMaintenanceStartDate] = useState("");
  const [maintenanceStartTime, setMaintenanceStartTime] = useState("");
  const [maintenanceEndDate, setMaintenanceEndDate] = useState("");
  const [maintenanceEndTime, setMaintenanceEndTime] = useState("");
  const [editMaintenanceDialogOpen, setEditMaintenanceDialogOpen] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState<Maintenance | null>(null);
  const [editMaintenanceType, setEditMaintenanceType] = useState<"determinada" | "indeterminada">("determinada");
  const [editMaintenanceStartDate, setEditMaintenanceStartDate] = useState("");
  const [editMaintenanceStartTime, setEditMaintenanceStartTime] = useState("");
  const [editMaintenanceEndDate, setEditMaintenanceEndDate] = useState("");
  const [editMaintenanceEndTime, setEditMaintenanceEndTime] = useState("");
  const [justificativaDialogOpen, setJustificativaDialogOpen] = useState(false);
  const [maintenanceToJustify, setMaintenanceToJustify] = useState<Maintenance | null>(null);
  const [justificativaText, setJustificativaText] = useState("");
  const [bloqueioDialogOpen, setBloqueioDialogOpen] = useState(false);
  const [manutencoesPendentes, setManutencoesPendentes] = useState<Maintenance[]>([]);
  const [auditHistoryDialogOpen, setAuditHistoryDialogOpen] = useState(false);
  const [expandedJustificativas, setExpandedJustificativas] = useState<Set<string>>(new Set());
  const [confirmEndMaintenanceDialogOpen, setConfirmEndMaintenanceDialogOpen] = useState(false);
  const [maintenanceToEnd, setMaintenanceToEnd] = useState<string | null>(null);

  const turmaForm = useForm<z.infer<typeof turmaFormSchema>>({
    resolver: zodResolver(turmaFormSchema),
    defaultValues: {
      nome: "",
      ano: new Date().getFullYear().toString(),
      vagasTotais: 30,
      periodoMatriculaInicio: "",
      periodoMatriculaFim: "",
      linkWhatsApp: "",
    },
  });

  const alunoForm = useForm<z.infer<typeof alunoFormSchema>>({
    resolver: zodResolver(alunoFormSchema),
    defaultValues: {
      nome: "",
      email: "",
      senha: "",
      turma: "",
      tipo: "aluno",
    },
  });

  const professorDiretorForm = useForm<z.infer<typeof professorDiretorFormSchema>>({
    resolver: zodResolver(professorDiretorFormSchema),
    defaultValues: {
      nome: "",
      dataNascimento: "",
      cpf: "",
      email: "",
      senha: "",
      telefone: "",
      cep: "",
      rua: "",
      bairro: "",
      cidade: "",
      estado: "",
      escolaridade: "",
      tipo: "professor",
      turmas: [],
    },
  });

  const editStudentForm = useForm<z.infer<typeof editStudentFormSchema>>({
    resolver: zodResolver(editStudentFormSchema),
    defaultValues: {
      nome: "",
      email: "",
      matricula: "",
      dataNascimento: "",
      cpf: "",
      telefone: "",
      escolaridade: "",
      cep: "",
      rua: "",
      bairro: "",
      cidade: "",
      estado: "",
      turma: "",
      disponibilidade: [],
    },
  });

  const { data: users, isLoading: loadingUsers } = useRealtimeQuery({
    collectionName: "usuarios",
    queryKey: ["/api/usuarios"],
  });

  const { data: turmas, isLoading: loadingTurmas } = useRealtimeQuery<Turma>({
    collectionName: "turmas",
    queryKey: ["/api/turmas"],
    transform: (docs) => docs as Turma[],
  });

  const { data: tarefas } = useRealtimeQuery({
    collectionName: "tarefas",
    queryKey: ["/api/tarefas/all"],
  });

  const { data: entregas } = useRealtimeQuery({
    collectionName: "entregas",
    queryKey: ["/api/entregas/all"],
  });

  const { data: solicitacoes, refetch: refetchSolicitacoes, isLoading: loadingSolicitacoes } = useRealtimeQuery({
    collectionName: "solicitacoes",
    queryKey: ["/api/solicitacoes"],
  });

  const { data: disciplinaryActions } = useRealtimeQuery({
    collectionName: "disciplinaryActions",
    queryKey: ["/api/disciplinaryActions"],
  });

  const { data: maintenanceData } = useRealtimeQuery<Maintenance>({
    collectionName: "systemMaintenance",
    queryKey: ["/api/maintenance"],
    transform: (docs) => docs as Maintenance[],
  });

  const pendingUsers = solicitacoes?.map((sol: any) => ({
    ...sol,
    docId: sol.id
  }));
  
  const loadingPendingUsers = loadingSolicitacoes;

  // Nota: O fechamento automático foi removido para dar controle total ao diretor.
  // Turmas fora do período são sinalizadas visualmente com cor laranja,
  // mas o diretor pode abrir/fechar manualmente a qualquer momento.

  const approveUserMutation = useMutation({
    mutationFn: async ({ solicitacaoId, senha }: { solicitacaoId: string; senha: string }) => {
      console.log("🔄 Iniciando aprovação da conta...");
      const solicitacaoDoc = await getDoc(doc(db, "solicitacoes", solicitacaoId));
      const solicitacao = solicitacaoDoc.data();
      
      if (!solicitacao) {
        throw new Error("Solicitação não encontrada");
      }
      
      console.log("📋 Dados da solicitação:", solicitacao);
      
      let userId: string;
      let userAlreadyExists = false;
      
      try {
        console.log("🔐 Criando usuário no Firebase Auth...");
        const userCredential = await createUserWithEmailAndPassword(firebaseAuth, solicitacao.email, senha);
        userId = userCredential.user.uid;
        console.log("✅ Usuário criado no Auth, UID:", userId);
        
        console.log("📝 Criando documento no Firestore...");
        const userData = {
          uid: userId,
          nome: solicitacao.nome,
          email: solicitacao.email,
          tipo: solicitacao.tipo,
          turma: solicitacao.turma || "",
          ativo: true,
          status: "aprovado",
          matricula: solicitacao.matricula,
          dataSolicitacao: solicitacao.dataSolicitacao,
          dataAprovacao: getNowBrasiliaISO(),
          // Campos adicionais do cadastro
          dataNascimento: solicitacao.dataNascimento,
          cpf: solicitacao.cpf,
          escolaridade: solicitacao.escolaridade,
          telefone: solicitacao.telefone,
          cep: solicitacao.cep,
          rua: solicitacao.rua,
          bairro: solicitacao.bairro,
          cidade: solicitacao.cidade,
          estado: solicitacao.estado,
          disponibilidade: solicitacao.disponibilidade || [],
        };
        console.log("📄 Dados do usuário a serem salvos:", userData);
        
        try {
          await setDoc(doc(db, "usuarios", userId), userData);
          console.log("✅ Documento criado no Firestore!");
        } catch (firestoreError: any) {
          console.error("❌ Erro ao criar documento no Firestore:", firestoreError);
          console.error("Código do erro:", firestoreError.code);
          console.error("Mensagem:", firestoreError.message);
          throw firestoreError;
        }
        
        // Incrementar contador de vagas preenchidas da turma
        if (solicitacao.tipo === "aluno" && solicitacao.turma) {
          const turmaRef = doc(db, "turmas", solicitacao.turma);
          const turmaDoc = await getDoc(turmaRef);
          if (turmaDoc.exists()) {
            await updateDoc(turmaRef, {
              vagasPreenchidas: increment(1)
            });
          }
        }
      } catch (error: any) {
        console.error("❌ Erro durante a criação:", error);
        console.error("Código do erro:", error.code);
        console.error("Mensagem do erro:", error.message);
        
        if (error.code === "auth/email-already-in-use") {
          console.log("⚠️ Email já existe, tentando atualizar usuário existente...");
          userAlreadyExists = true;
          
          const { getDocs, query, collection, where } = await import("firebase/firestore");
          const usersSnapshot = await getDocs(query(collection(db, "usuarios"), where("email", "==", solicitacao.email)));
          
          if (!usersSnapshot.empty) {
            userId = usersSnapshot.docs[0].id;
            
            await updateDoc(doc(db, "usuarios", userId), {
              nome: solicitacao.nome,
              tipo: solicitacao.tipo,
              turma: solicitacao.turma || "",
              ativo: true,
              status: "aprovado",
              matricula: solicitacao.matricula,
              dataSolicitacao: solicitacao.dataSolicitacao,
              dataAprovacao: getNowBrasiliaISO(),
              // Campos adicionais do cadastro
              dataNascimento: solicitacao.dataNascimento,
              cpf: solicitacao.cpf,
              escolaridade: solicitacao.escolaridade,
              telefone: solicitacao.telefone,
              cep: solicitacao.cep,
              rua: solicitacao.rua,
              bairro: solicitacao.bairro,
              cidade: solicitacao.cidade,
              estado: solicitacao.estado,
              disponibilidade: solicitacao.disponibilidade || [],
            });
            
            // Incrementar contador de vagas preenchidas da turma
            if (solicitacao.tipo === "aluno" && solicitacao.turma) {
              const turmaRef = doc(db, "turmas", solicitacao.turma);
              const turmaDoc = await getDoc(turmaRef);
              if (turmaDoc.exists()) {
                await updateDoc(turmaRef, {
                  vagasPreenchidas: increment(1)
                });
              }
            }
          } else {
            throw new Error("Conta existe no Authentication mas não no Firestore. Por favor, remova a solicitação duplicada.");
          }
        } else {
          throw error;
        }
      }
      
      await deleteDoc(doc(db, "solicitacoes", solicitacaoId));
      
      return { userAlreadyExists };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitacoes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      toast({
        title: data.userAlreadyExists ? "Conta aprovada!" : "Conta aprovada e criada!",
        description: data.userAlreadyExists 
          ? "O aluno foi aprovado e pode continuar usando a conta existente."
          : "O aluno agora pode fazer login com a senha definida.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao aprovar conta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectUserMutation = useMutation({
    mutationFn: async ({ solicitacaoId, comentario }: { solicitacaoId: string; comentario?: string }) => {
      const solicitacaoDoc = await getDoc(doc(db, "solicitacoes", solicitacaoId));
      const solicitacao = solicitacaoDoc.data();
      
      if (!solicitacao) {
        throw new Error("Solicitação não encontrada");
      }
      
      // Se já existe usuário aprovado, deletá-lo
      const { getDocs, query, collection: firestoreCollection, where } = await import("firebase/firestore");
      const usersSnapshot = await getDocs(query(firestoreCollection(db, "usuarios"), where("email", "==", solicitacao.email)));
      
      if (!usersSnapshot.empty) {
        const userId = usersSnapshot.docs[0].id;
        await deleteDoc(doc(db, "usuarios", userId));
      }
      
      // Atualizar solicitação para status "reprovado" (NÃO deletar)
      await updateDoc(doc(db, "solicitacoes", solicitacaoId), {
        status: "reprovado",
        comentarioReprovacao: comentario || "Sua solicitação foi reprovada pela diretoria.",
        dataReprovacao: getNowBrasiliaISO(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitacoes"] });
      setRejectDialogOpen(false);
      setUserToReject(null);
      setRejectComment("");
      toast({
        title: "Solicitação rejeitada",
        description: "O aluno foi notificado sobre a reprovação.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao rejeitar solicitação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const returnUserMutation = useMutation({
    mutationFn: async ({ solicitacaoId, comentario }: { solicitacaoId: string; comentario?: string }) => {
      const solicitacaoDoc = await getDoc(doc(db, "solicitacoes", solicitacaoId));
      const solicitacao = solicitacaoDoc.data();
      
      if (!solicitacao) {
        throw new Error("Solicitação não encontrada");
      }
      
      // Atualizar solicitação para status "devolvido" (permitir edição)
      await updateDoc(doc(db, "solicitacoes", solicitacaoId), {
        status: "devolvido",
        comentarioDevolucao: comentario || "Seu cadastro precisa de correções. Por favor, revise as informações e envie novamente.",
        dataDevolucao: getNowBrasiliaISO(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitacoes"] });
      setReturnDialogOpen(false);
      setUserToReturn(null);
      setReturnComment("");
      toast({
        title: "Cadastro devolvido",
        description: "O aluno foi notificado e poderá fazer as correções necessárias.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao devolver cadastro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const standbyUserMutation = useMutation({
    mutationFn: async ({ solicitacaoId, comentario }: { solicitacaoId: string; comentario?: string }) => {
      const solicitacaoDoc = await getDoc(doc(db, "solicitacoes", solicitacaoId));
      const solicitacao = solicitacaoDoc.data();
      
      if (!solicitacao) {
        throw new Error("Solicitação não encontrada");
      }
      
      // Atualizar solicitação para status "standby" (fila de espera)
      await updateDoc(doc(db, "solicitacoes", solicitacaoId), {
        status: "standby",
        comentarioStandby: comentario || "Você foi colocado em fila de espera. Aguarde contato da diretoria.",
        dataStandby: getNowBrasiliaISO(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitacoes"] });
      setStandbyDialogOpen(false);
      setUserToStandby(null);
      setStandbyComment("");
      toast({
        title: "Aluno em Stand By",
        description: "O aluno foi colocado em fila de espera e será notificado.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao colocar em stand by",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSolicitacaoMutation = useMutation({
    mutationFn: async ({ solicitacaoId, data }: { solicitacaoId: string; data: any }) => {
      await updateDoc(doc(db, "solicitacoes", solicitacaoId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitacoes"] });
      setEditSolicitacaoDialogOpen(false);
      setSolicitacaoToEdit(null);
      toast({
        title: "Solicitação atualizada",
        description: "As informações da solicitação foram atualizadas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar solicitação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ userId, ativo }: { userId: string; ativo: boolean }) => {
      const userRef = doc(db, "usuarios", userId);
      await updateDoc(userRef, { ativo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios/all"] });
      toast({
        title: "Status atualizado",
        description: "O status do aluno foi alterado.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateStudentDataMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editStudentFormSchema> & { userId: string }) => {
      const { userId, ...updateData } = data;
      const userRef = doc(db, "usuarios", userId);
      
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        throw new Error("Aluno não encontrado");
      }
      
      const currentUserData = userDoc.data();
      const oldTurma = currentUserData.turma;
      const newTurma = updateData.turma;
      
      if (oldTurma !== newTurma) {
        if (oldTurma) {
          const oldTurmaRef = doc(db, "turmas", oldTurma);
          const oldTurmaDoc = await getDoc(oldTurmaRef);
          if (oldTurmaDoc.exists()) {
            await updateDoc(oldTurmaRef, {
              vagasPreenchidas: increment(-1)
            });
          }
        }
        
        if (newTurma) {
          const newTurmaRef = doc(db, "turmas", newTurma);
          const newTurmaDoc = await getDoc(newTurmaRef);
          if (newTurmaDoc.exists()) {
            await updateDoc(newTurmaRef, {
              vagasPreenchidas: increment(1)
            });
          }
        }
      }
      
      await updateDoc(userRef, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/turmas"] });
      toast({
        title: "Dados atualizados!",
        description: "Os dados do aluno foram atualizados com sucesso.",
      });
      setIsEditingStudent(false);
      setStudentDetailsDialogOpen(false);
      setSelectedStudentDetails(null);
      editStudentForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar dados",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createTurmaMutation = useMutation({
    mutationFn: async (data: z.infer<typeof turmaFormSchema>) => {
      const turmaData = {
        ...data,
        ativa: true,
        vagasPreenchidas: 0,
      };
      
      await addDoc(collection(db, "turmas"), turmaData);
      return turmaData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/turmas"] });
      toast({
        title: "Turma criada com sucesso!",
        description: "A turma está disponível para uso.",
      });
      setCreateTurmaDialogOpen(false);
      turmaForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar turma",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createAlunoMutation = useMutation({
    mutationFn: async (data: z.infer<typeof alunoFormSchema>) => {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, data.email, data.senha);
      
      await setDoc(doc(db, "usuarios", userCredential.user.uid), {
        uid: userCredential.user.uid,
        nome: data.nome,
        email: data.email,
        tipo: data.tipo,
        turma: data.turma || "",
        ativo: true,
        status: "aprovado",
      });
      
      if (data.tipo === "aluno" && data.turma) {
        const turmaRef = doc(db, "turmas", data.turma);
        const turmaDoc = await getDoc(turmaRef);
        if (turmaDoc.exists()) {
          await updateDoc(turmaRef, {
            vagasPreenchidas: increment(1)
          });
        }
      }
      
      return userCredential.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/turmas"] });
      toast({
        title: "Aluno criado com sucesso!",
        description: "O aluno pode acessar a plataforma.",
      });
      setCreateAlunoDialogOpen(false);
      alunoForm.reset();
    },
    onError: (error: any) => {
      let message = error.message;
      if (error.code === "auth/email-already-in-use") {
        message = "Este email já está em uso";
      } else if (error.code === "auth/weak-password") {
        message = "A senha deve ter pelo menos 6 caracteres";
      } else if (error.code === "auth/invalid-email") {
        message = "Email inválido";
      }
      
      toast({
        title: "Erro ao criar aluno",
        description: message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (user: any) => {
      if (user.tipo === "diretor" && user.status === "aprovado") {
        throw new Error("Não é permitido excluir diretores ativos");
      }
      const docId = user.docId || user.uid || user.id;
      if (!docId) {
        throw new Error("ID do documento não encontrado");
      }
      
      if (user.tipo === "aluno" && user.turma) {
        const turmaRef = doc(db, "turmas", user.turma);
        const turmaDoc = await getDoc(turmaRef);
        if (turmaDoc.exists()) {
          await updateDoc(turmaRef, {
            vagasPreenchidas: increment(-1)
          });
        }
      }
      
      await deleteDoc(doc(db, "usuarios", docId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/turmas"] });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      toast({
        title: "Registro excluído",
        description: "O registro foi removido da base de dados.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir registro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createProfessorDiretorMutation = useMutation({
    mutationFn: async (data: z.infer<typeof professorDiretorFormSchema>) => {
      // Gerar matrícula sequencial usando transação atômica
      const counterRef = doc(db, "system", "matriculaCounter");
      const novaMatricula = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        
        let ultimaMatricula: number;
        if (!counterDoc.exists()) {
          ultimaMatricula = 99;
          transaction.set(counterRef, { ultimaMatricula: 100 });
        } else {
          ultimaMatricula = counterDoc.data().ultimaMatricula || 99;
          transaction.update(counterRef, { ultimaMatricula: ultimaMatricula + 1 });
        }
        
        return String(ultimaMatricula + 1).padStart(4, '0');
      });

      // Criar conta no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, data.email, data.senha);
      
      // Criar documento do aluno/professor/diretor
      await setDoc(doc(db, "usuarios", userCredential.user.uid), {
        uid: userCredential.user.uid,
        nome: data.nome,
        email: data.email,
        cpf: data.cpf,
        matricula: novaMatricula,
        tipo: data.tipo,
        turma: data.tipo === "professor" ? (turmasSelecionadas.join(",") || "") : "",
        turmas: data.tipo === "professor" ? turmasSelecionadas : [],
        telefone: data.telefone,
        cep: data.cep,
        rua: data.rua || "",
        bairro: data.bairro || "",
        cidade: data.cidade || "",
        estado: data.estado || "",
        dataNascimento: data.dataNascimento,
        escolaridade: data.escolaridade,
        disponibilidade: disponibilidadeHorario,
        ativo: true,
        status: "aprovado",
        dataCriacao: getNowBrasiliaISO(),
      });
      
      return { user: userCredential.user, matricula: novaMatricula };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      toast({
        title: "Conta criada com sucesso!",
        description: `Matrícula gerada: ${data.matricula}`,
      });
      setCreateProfessorDiretorDialogOpen(false);
      professorDiretorForm.reset();
      setDisponibilidadeHorario([]);
      setTurmasSelecionadas([]);
    },
    onError: (error: any) => {
      let message = error.message;
      if (error.code === "auth/email-already-in-use") {
        message = "Este email já está em uso";
      }
      toast({
        title: "Erro ao criar conta",
        description: message,
        variant: "destructive",
      });
    },
  });

  const updateWhatsAppMutation = useMutation({
    mutationFn: async ({ turmaId, link }: { turmaId: string; link: string }) => {
      const turmaRef = doc(db, "turmas", turmaId);
      await updateDoc(turmaRef, { linkWhatsApp: link });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/turmas"] });
      toast({
        title: "Link atualizado!",
        description: "O link do WhatsApp foi atualizado.",
      });
      setEditWhatsAppDialogOpen(false);
      setSelectedTurmaForWhatsApp(null);
      setWhatsAppLink("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar link",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const transferUserMutation = useMutation({
    mutationFn: async ({ userId, novaTurma }: { userId: string; novaTurma: string }) => {
      const userRef = doc(db, "usuarios", userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error("Usuário não encontrado");
      }
      
      const userData = userDoc.data();
      const turmaAntiga = userData.turma;
      
      if (userData.tipo === "aluno") {
        if (turmaAntiga) {
          const turmaAntigaRef = doc(db, "turmas", turmaAntiga);
          const turmaAntigaDoc = await getDoc(turmaAntigaRef);
          if (turmaAntigaDoc.exists()) {
            await updateDoc(turmaAntigaRef, {
              vagasPreenchidas: increment(-1)
            });
          }
        }
        
        const novaTurmaRef = doc(db, "turmas", novaTurma);
        const novaTurmaDoc = await getDoc(novaTurmaRef);
        if (novaTurmaDoc.exists()) {
          await updateDoc(novaTurmaRef, {
            vagasPreenchidas: increment(1)
          });
        }
      }
      
      await updateDoc(userRef, { turma: novaTurma });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/turmas"] });
      toast({
        title: "Aluno transferido!",
        description: "O aluno foi transferido para a nova turma.",
      });
      setTransferDialogOpen(false);
      setUserToTransfer(null);
      setNewTurma("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao transferir aluno",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const applyWarningMutation = useMutation({
    mutationFn: async ({ student, comentario }: { student: User; comentario?: string }) => {
      if (!userData || !firebaseAuth.currentUser) throw new Error("Usuário não autenticado");
      
      const directorUid = userData.uid || firebaseAuth.currentUser.uid;
      const directorNome = userData.nome;
      
      if (!directorUid || !directorNome) throw new Error("Dados do usuário incompletos");
      if (!student.uid || !student.nome) throw new Error("Dados do aluno incompletos");
      
      // Verificar quantas advertências ativas o aluno já tem
      const actionsQuery = query(
        collection(db, "disciplinaryActions"),
        where("alunoId", "==", student.uid),
        where("tipo", "==", "advertencia"),
        where("ativo", "==", true)
      );
      const actionsSnapshot = await getDocs(actionsQuery);
      const activeWarnings = actionsSnapshot.docs.length;
      
      if (activeWarnings >= 3) {
        throw new Error("Este aluno já possui 3 advertências ativas. Não é possível adicionar mais advertências.");
      }
      
      const actionData = {
        alunoId: String(student.uid),
        alunoNome: String(student.nome),
        alunoMatricula: String(student.matricula || ""),
        alunoTurma: String(student.turma || ""),
        tipo: "advertencia",
        comentario: String(comentario || ""),
        aplicadoPor: String(directorUid),
        aplicadoPorNome: String(directorNome),
        dataAplicacao: getNowBrasiliaISO(),
        ativo: true,
      };
      
      await addDoc(collection(db, "disciplinaryActions"), actionData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/disciplinaryActions"] });
      toast({
        title: "Advertência aplicada",
        description: "A advertência disciplinar foi registrada com sucesso.",
      });
      setWarningDialogOpen(false);
      setSelectedStudentForDisciplinary(null);
      setDisciplinaryReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao aplicar advertência",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const applySuspensionMutation = useMutation({
    mutationFn: async ({ student, comentario }: { student: User; comentario?: string }) => {
      if (!userData || !firebaseAuth.currentUser) throw new Error("Usuário não autenticado");
      
      const directorUid = userData.uid || firebaseAuth.currentUser.uid;
      const directorNome = userData.nome;
      
      if (!directorUid || !directorNome) throw new Error("Dados do usuário incompletos");
      if (!student.uid || !student.nome) throw new Error("Dados do aluno incompletos");
      
      // Calcular data de término da suspensão (2 dias a partir de agora)
      const dataTermino = new Date();
      dataTermino.setDate(dataTermino.getDate() + 2);
      
      // Criar registro da suspensão
      const actionData = {
        alunoId: String(student.uid),
        alunoNome: String(student.nome),
        alunoMatricula: String(student.matricula || ""),
        alunoTurma: String(student.turma || ""),
        tipo: "suspensao",
        comentario: String(comentario || ""),
        aplicadoPor: String(directorUid),
        aplicadoPorNome: String(directorNome),
        dataAplicacao: getNowBrasiliaISO(),
        dataTerminoSuspensao: dataTermino.toISOString(),
        ativo: true,
      };
      
      await addDoc(collection(db, "disciplinaryActions"), actionData);
      
      // Desativar a conta do aluno
      await updateDoc(doc(db, "usuarios", student.uid), {
        ativo: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/disciplinaryActions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      toast({
        title: "Suspensão aplicada",
        description: "A suspensão disciplinar foi registrada e a conta do aluno foi bloqueada por 2 dias.",
      });
      setSuspensionDialogOpen(false);
      setSelectedStudentForDisciplinary(null);
      setDisciplinaryReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao aplicar suspensão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeDisciplinaryActionMutation = useMutation({
    mutationFn: async ({ actionId, tipo, alunoId }: { actionId: string; tipo: string; alunoId: string }) => {
      if (!userData || !firebaseAuth.currentUser) throw new Error("Usuário não autenticado");
      
      const directorUid = userData.uid || firebaseAuth.currentUser.uid;
      const directorNome = userData.nome;
      
      // Atualizar o registro para marcar como removido
      await updateDoc(doc(db, "disciplinaryActions", actionId), {
        ativo: false,
        dataRemocao: getNowBrasiliaISO(),
        removidoPor: directorUid,
        removidoPorNome: directorNome,
      });
      
      // Se for uma suspensão, reativar a conta do aluno
      if (tipo === "suspensao") {
        await updateDoc(doc(db, "usuarios", alunoId), {
          ativo: true,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/disciplinaryActions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      toast({
        title: "Ação disciplinar removida",
        description: "A ação disciplinar foi removida com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover ação disciplinar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeStudentFromTurmaMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const userRef = doc(db, "usuarios", userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error("Usuário não encontrado");
      }
      
      const userData = userDoc.data();
      const turmaAtual = userData.turma;
      
      if (userData.tipo === "aluno" && turmaAtual) {
        const turmaRef = doc(db, "turmas", turmaAtual);
        const turmaDoc = await getDoc(turmaRef);
        if (turmaDoc.exists()) {
          await updateDoc(turmaRef, {
            vagasPreenchidas: increment(-1)
          });
        }
      }
      
      await updateDoc(userRef, { turma: "" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/turmas"] });
      toast({
        title: "Aluno removido!",
        description: "O aluno foi removido da turma.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover aluno",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncTurmasVagasMutation = useMutation({
    mutationFn: async () => {
      // Buscar todas as turmas
      const turmasSnapshot = await getDocs(collection(db, "turmas"));
      
      // Buscar todos os usuários
      const usuariosSnapshot = await getDocs(collection(db, "usuarios"));
      
      // Contar alunos por turma (usando ID da turma)
      const alunosPorTurma = new Map<string, number>();
      
      usuariosSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        if (userData.tipo === "aluno" && userData.turma) {
          alunosPorTurma.set(userData.turma, (alunosPorTurma.get(userData.turma) || 0) + 1);
        }
      });
      
      // Atualizar cada turma com o valor correto
      const updates: Promise<void>[] = [];
      
      turmasSnapshot.forEach((turmaDoc) => {
        const turmaId = turmaDoc.id;
        const count = alunosPorTurma.get(turmaId) || 0;
        
        updates.push(
          updateDoc(doc(db, "turmas", turmaId), {
            vagasPreenchidas: count
          })
        );
      });
      
      await Promise.all(updates);
      
      return { totalTurmas: turmasSnapshot.size, alunosPorTurma };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/turmas"] });
      toast({
        title: "Sincronização concluída!",
        description: `${data.totalTurmas} turma(s) sincronizada(s) com sucesso.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao sincronizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleTurmaStatusMutation = useMutation({
    mutationFn: async ({ turmaId, ativa }: { turmaId: string; ativa: boolean }) => {
      const turmaRef = doc(db, "turmas", turmaId);
      await updateDoc(turmaRef, { ativa });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/turmas"] });
      toast({
        title: "Status atualizado!",
        description: "O status da turma foi alterado.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const editTurmaMutation = useMutation({
    mutationFn: async ({ turmaId, data }: { turmaId: string; data: z.infer<typeof turmaFormSchema> }) => {
      const turmaRef = doc(db, "turmas", turmaId);
      await updateDoc(turmaRef, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/turmas"] });
      toast({
        title: "Turma atualizada!",
        description: "As informações da turma foram atualizadas com sucesso.",
      });
      setEditTurmaDialogOpen(false);
      setTurmaToEdit(null);
      turmaForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar turma",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addStudentsToTurmaMutation = useMutation({
    mutationFn: async ({ studentIds, turmaId }: { studentIds: string[]; turmaId: string }) => {
      await runTransaction(db, async (transaction) => {
        const turmaRef = doc(db, "turmas", turmaId);
        const turmaDoc = await transaction.get(turmaRef);
        
        if (!turmaDoc.exists()) {
          throw new Error("Turma não encontrada");
        }
        
        // Verificar quais alunos realmente precisam ser movidos (não estão na turma atual)
        const studentsToMove: string[] = [];
        const turmasOrigemMap = new Map<string, number>();
        
        for (const uid of studentIds) {
          const userRef = doc(db, "usuarios", uid);
          const userDoc = await transaction.get(userRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const turmaAtual = userData.turma;
            
            // Só adicionar se não estiver na turma de destino (comparando IDs)
            if (turmaAtual !== turmaId) {
              studentsToMove.push(uid);
              
              // Rastrear turma de origem para decrementar (usando ID)
              if (turmaAtual) {
                turmasOrigemMap.set(turmaAtual, (turmasOrigemMap.get(turmaAtual) || 0) + 1);
              }
            }
          }
        }
        
        if (studentsToMove.length === 0) {
          throw new Error("Todos os alunos selecionados já estão nesta turma");
        }
        
        const turmaData = turmaDoc.data();
        const vagasTotais = turmaData.vagasTotais || 0;
        const vagasPreenchidas = turmaData.vagasPreenchidas || 0;
        const vagasDisponiveis = vagasTotais - vagasPreenchidas;
        
        if (studentsToMove.length > vagasDisponiveis) {
          throw new Error(`Não há vagas suficientes. Disponíveis: ${vagasDisponiveis}, Necessárias: ${studentsToMove.length}`);
        }
        
        // Decrementar vagasPreenchidas das turmas de origem (usando ID)
        for (const [turmaIdOrigem, count] of Array.from(turmasOrigemMap.entries())) {
          const turmaOrigemRef = doc(db, "turmas", turmaIdOrigem);
          const turmaOrigemDoc = await transaction.get(turmaOrigemRef);
          if (turmaOrigemDoc.exists()) {
            const vagasPreencidasOrigem = turmaOrigemDoc.data().vagasPreenchidas || 0;
            transaction.update(turmaOrigemRef, {
              vagasPreenchidas: Math.max(0, vagasPreencidasOrigem - count)
            });
          }
        }
        
        // Atualizar vagasPreenchidas da turma de destino
        transaction.update(turmaRef, {
          vagasPreenchidas: vagasPreenchidas + studentsToMove.length
        });
        
        // Atualizar cada aluno que precisa ser movido (armazenar ID da turma)
        for (const uid of studentsToMove) {
          const userRef = doc(db, "usuarios", uid);
          transaction.update(userRef, { turma: turmaId });
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/turmas"] });
      toast({
        title: "Alunos adicionados!",
        description: "Os alunos foram adicionados à turma com sucesso.",
      });
      setAddStudentsDialogOpen(false);
      setSelectedStudentsToAdd([]);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar alunos",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateVagasTurmaMutation = useMutation({
    mutationFn: async ({ turmaId, vagasTotais }: { turmaId: string; vagasTotais: number }) => {
      const turmaRef = doc(db, "turmas", turmaId);
      await updateDoc(turmaRef, { vagasTotais });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/turmas"] });
      toast({
        title: "Vagas atualizadas!",
        description: "A quantidade de vagas foi atualizada.",
      });
      setEditVagasDialogOpen(false);
      setSelectedTurmaForVagas(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar vagas",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkTransferStudentsMutation = useMutation({
    mutationFn: async ({ studentIds, novaTurmaId }: { studentIds: string[]; novaTurmaId: string }) => {
      await runTransaction(db, async (transaction) => {
        // ===== FASE 1: TODAS AS LEITURAS =====
        
        // Buscar turma de destino usando ID
        const turmaDestinoRef = doc(db, "turmas", novaTurmaId);
        const turmaDestinoDoc = await transaction.get(turmaDestinoRef);
        
        if (!turmaDestinoDoc.exists()) {
          throw new Error("Turma de destino não encontrada");
        }
        
        const turmaDestinoData = turmaDestinoDoc.data();
        const vagasTotais = turmaDestinoData.vagasTotais || 0;
        const vagasPreenchidas = turmaDestinoData.vagasPreenchidas || 0;
        const vagasDisponiveis = vagasTotais - vagasPreenchidas;
        
        if (studentIds.length > vagasDisponiveis) {
          throw new Error(`Não há vagas suficientes. Disponíveis: ${vagasDisponiveis}, Selecionados: ${studentIds.length}`);
        }
        
        // Buscar todos os usuários
        const userRefs = studentIds.map(uid => doc(db, "usuarios", uid));
        const userDocs = await Promise.all(userRefs.map(ref => transaction.get(ref)));
        
        // Mapear turmas de origem
        const turmasOrigemMap = new Map<string, number>();
        const userUpdates: { ref: any; turmaOrigemId: string | null }[] = [];
        
        userDocs.forEach((userDoc, index) => {
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const turmaOrigemId = userData.turma;
            
            if (turmaOrigemId && turmaOrigemId !== novaTurmaId) {
              turmasOrigemMap.set(turmaOrigemId, (turmasOrigemMap.get(turmaOrigemId) || 0) + 1);
            }
            
            userUpdates.push({
              ref: userRefs[index],
              turmaOrigemId
            });
          }
        });
        
        // Buscar todas as turmas de origem
        const turmasOrigemIds = Array.from(turmasOrigemMap.keys());
        const turmasOrigemRefs = turmasOrigemIds.map(id => doc(db, "turmas", id));
        const turmasOrigemDocs = await Promise.all(turmasOrigemRefs.map(ref => transaction.get(ref)));
        
        // ===== FASE 2: TODAS AS ESCRITAS =====
        
        // Atualizar todos os usuários
        userUpdates.forEach(({ ref }) => {
          transaction.update(ref, { turma: novaTurmaId });
        });
        
        // Decrementar vagasPreenchidas das turmas de origem
        turmasOrigemDocs.forEach((turmaOrigemDoc, index) => {
          if (turmaOrigemDoc.exists()) {
            const turmaOrigemId = turmasOrigemIds[index];
            const count = turmasOrigemMap.get(turmaOrigemId) || 0;
            const vagasPreencidasOrigem = turmaOrigemDoc.data().vagasPreenchidas || 0;
            transaction.update(turmasOrigemRefs[index], {
              vagasPreenchidas: Math.max(0, vagasPreencidasOrigem - count)
            });
          }
        });
        
        // Incrementar vagasPreenchidas da turma destino
        transaction.update(turmaDestinoRef, {
          vagasPreenchidas: vagasPreenchidas + studentIds.length
        });
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/turmas"] });
      toast({
        title: "Alunos transferidos!",
        description: "Os alunos foram transferidos para a nova turma.",
      });
      setBulkTransferDialogOpen(false);
      setSelectedStudentsForBulkAction([]);
      setBulkTransferTurma("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao transferir alunos",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkRemoveStudentsMutation = useMutation({
    mutationFn: async ({ studentIds }: { studentIds: string[] }) => {
      await runTransaction(db, async (transaction) => {
        // Contar quantos alunos serão removidos de cada turma (usando IDs)
        const turmasMap = new Map<string, number>();
        
        for (const uid of studentIds) {
          const userRef = doc(db, "usuarios", uid);
          const userDoc = await transaction.get(userRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const turmaAtualId = userData.turma;
            
            if (turmaAtualId) {
              turmasMap.set(turmaAtualId, (turmasMap.get(turmaAtualId) || 0) + 1);
            }
            
            transaction.update(userRef, { turma: "" });
          }
        }
        
        // Decrementar vagasPreenchidas de cada turma (usando IDs diretamente)
        for (const [turmaId, count] of Array.from(turmasMap.entries())) {
          const turmaRef = doc(db, "turmas", turmaId);
          const turmaDoc = await transaction.get(turmaRef);
          if (turmaDoc.exists()) {
            const vagasPreenchidas = turmaDoc.data().vagasPreenchidas || 0;
            transaction.update(turmaRef, {
              vagasPreenchidas: Math.max(0, vagasPreenchidas - count)
            });
          }
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/turmas"] });
      toast({
        title: "Alunos removidos!",
        description: "Os alunos foram removidos da turma.",
      });
      setSelectedStudentsForBulkAction([]);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover alunos",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const iniciarManutencaoMutation = useMutation({
    mutationFn: async ({ tipo, dataInicio, dataFim }: { tipo: "determinada" | "indeterminada"; dataInicio: string; dataFim?: string }) => {
      if (!userData || !firebaseAuth.currentUser) throw new Error("Usuário não autenticado");
      
      const directorUid = userData.uid || firebaseAuth.currentUser.uid;
      const directorNome = userData.nome;
      
      if (!directorUid || !directorNome) throw new Error("Dados do usuário incompletos");
      
      // Verificar se já existe manutenção ativa
      const maintenanceQuery = query(collection(db, "systemMaintenance"), where("ativa", "==", true));
      const maintenanceDocs = await getDocs(maintenanceQuery);
      
      if (!maintenanceDocs.empty) {
        throw new Error("Já existe uma manutenção ativa no sistema");
      }
      
      // VERIFICAÇÃO OBRIGATÓRIA: Bloquear criação de nova manutenção se houver pendentes de justificativa
      const finalizadasQuery = query(
        collection(db, "systemMaintenance"), 
        where("ativa", "==", false),
        where("arquivada", "==", false)
      );
      const finalizadasDocs = await getDocs(finalizadasQuery);
      
      const semJustificativa = finalizadasDocs.docs.filter(doc => {
        const data = doc.data();
        return !data.justificativa || data.justificativa.trim() === "";
      });
      
      if (semJustificativa.length > 0) {
        const detalhes = semJustificativa.map(doc => {
          const data = doc.data();
          return `- Manutenção ${data.numeroManutencao || data.tipo} de ${formatBrasiliaDateTime(data.dataInicio)}`;
        }).join('\n');
        
        throw new Error(`❌ BLOQUEADO: Não é possível iniciar uma nova manutenção!\n\nExistem ${semJustificativa.length} manutenção(ões) finalizada(s) SEM JUSTIFICATIVA:\n\n${detalhes}\n\n⚠️ É OBRIGATÓRIO justificar TODAS as manutenções anteriores antes de iniciar uma nova.\n\nAcesse a aba "Manutenção" e clique em "Adicionar Justificativa" para cada manutenção pendente.`);
      }
      
      // Gerar número sequencial para a manutenção
      const allMaintenancesQuery = query(collection(db, "systemMaintenance"));
      const allMaintenancesDocs = await getDocs(allMaintenancesQuery);
      
      let maxNumber = 0;
      allMaintenancesDocs.docs.forEach(doc => {
        const data = doc.data();
        if (data.numeroManutencao) {
          const num = parseInt(data.numeroManutencao, 10);
          if (!isNaN(num) && num > maxNumber) {
            maxNumber = num;
          }
        }
      });
      
      const nextNumber = maxNumber + 1;
      const numeroManutencao = nextNumber.toString().padStart(4, '0');
      
      const maintenanceData: any = {
        numeroManutencao,
        ativa: true,
        tipo,
        dataInicio,
        dataAtivacao: getNowBrasiliaISO(),
        iniciadoPor: directorUid,
        iniciadoPorNome: directorNome,
        arquivada: false,
      };
      
      // Apenas adicionar dataFim se for manutenção determinada e tiver valor
      if (tipo === "determinada" && dataFim) {
        maintenanceData.dataFim = dataFim;
      }
      
      await addDoc(collection(db, "systemMaintenance"), maintenanceData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      toast({
        title: "Manutenção iniciada!",
        description: "O sistema está agora em modo de manutenção. Apenas diretores podem acessar.",
      });
      setMaintenanceDialogOpen(false);
      setMaintenanceStartDate("");
      setMaintenanceStartTime("");
      setMaintenanceEndDate("");
      setMaintenanceEndTime("");
      setMaintenanceType("determinada");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao iniciar manutenção",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const finalizarManutencaoMutation = useMutation({
    mutationFn: async (maintenanceId?: string) => {
      if (!userData || !firebaseAuth.currentUser) throw new Error("Usuário não autenticado");
      
      const directorUid = userData.uid || firebaseAuth.currentUser.uid;
      const directorNome = userData.nome;
      
      if (!directorUid || !directorNome) throw new Error("Dados do usuário incompletos");
      
      let targetMaintenanceId: string;
      
      if (maintenanceId) {
        // Se um ID foi passado, usar esse ID diretamente
        targetMaintenanceId = maintenanceId;
      } else {
        // Caso contrário, buscar a primeira manutenção ativa
        const maintenanceQuery = query(collection(db, "systemMaintenance"), where("ativa", "==", true));
        const maintenanceDocs = await getDocs(maintenanceQuery);
        
        if (maintenanceDocs.empty) {
          throw new Error("Nenhuma manutenção ativa encontrada");
        }
        
        targetMaintenanceId = maintenanceDocs.docs[0].id;
      }
      
      // Buscar dados da manutenção para calcular duração
      const maintenanceDoc = await getDoc(doc(db, "systemMaintenance", targetMaintenanceId));
      const maintenanceData = maintenanceDoc.data();
      
      if (!maintenanceData) {
        throw new Error("Manutenção não encontrada");
      }
      
      // Calcular duração
      const dataFinalizacao = getNowBrasiliaISO();
      const inicio = new Date(maintenanceData.dataAtivacao);
      const fim = new Date(dataFinalizacao);
      const duracaoMs = fim.getTime() - inicio.getTime();
      const duracaoSegundos = Math.floor(duracaoMs / 1000);
      
      // Formatar duração como HH:MM:SS
      const horas = Math.floor(duracaoSegundos / 3600);
      const minutos = Math.floor((duracaoSegundos % 3600) / 60);
      const segundos = duracaoSegundos % 60;
      const duracaoFormatada = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
      
      // Finalizar a manutenção específica
      await updateDoc(doc(db, "systemMaintenance", targetMaintenanceId), {
        ativa: false,
        dataFinalizacao,
        finalizadoPor: directorUid,
        finalizadoPorNome: directorNome,
        duracaoSegundos,
        duracaoFormatada,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      toast({
        title: "Manutenção finalizada!",
        description: "O sistema está agora disponível para todos os usuários.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao finalizar manutenção",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletarManutencaoMutation = useMutation({
    mutationFn: async (maintenanceId: string) => {
      const maintenanceDoc = await getDoc(doc(db, "systemMaintenance", maintenanceId));
      const maintenanceData = maintenanceDoc.data();
      
      if (!maintenanceData) {
        throw new Error("Manutenção não encontrada");
      }
      
      // Bloquear exclusão de manutenções arquivadas (histórico de auditoria é permanente)
      if (maintenanceData.arquivada) {
        throw new Error("Não é possível deletar uma manutenção arquivada. O histórico de auditoria deve ser mantido permanentemente.");
      }
      
      // Se a manutenção está finalizada e não arquivada, verificar se tem justificativa
      if (!maintenanceData.ativa) {
        if (!maintenanceData.justificativa || maintenanceData.justificativa.trim() === "") {
          throw new Error("Não é possível deletar uma manutenção sem justificativa. Por favor, adicione uma justificativa primeiro.");
        }
      }
      
      await deleteDoc(doc(db, "systemMaintenance", maintenanceId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      toast({
        title: "Manutenção deletada!",
        description: "O registro de manutenção foi removido do sistema.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao deletar manutenção",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const adicionarJustificativaMutation = useMutation({
    mutationFn: async ({ maintenanceId, justificativa }: { maintenanceId: string; justificativa: string }) => {
      if (!userData || !firebaseAuth.currentUser) throw new Error("Usuário não autenticado");
      
      const directorUid = userData.uid || firebaseAuth.currentUser.uid;
      const directorNome = userData.nome;
      
      if (!justificativa || justificativa.trim() === "") {
        throw new Error("A justificativa não pode estar vazia");
      }
      
      await updateDoc(doc(db, "systemMaintenance", maintenanceId), {
        justificativa: justificativa.trim(),
        justificadaPor: directorUid,
        justificadaPorNome: directorNome,
        dataJustificativa: getNowBrasiliaISO(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      toast({
        title: "Justificativa adicionada!",
        description: "A justificativa foi salva com sucesso.",
      });
      setJustificativaDialogOpen(false);
      setMaintenanceToJustify(null);
      setJustificativaText("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar justificativa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const arquivarManutencaoMutation = useMutation({
    mutationFn: async (maintenanceId: string) => {
      // Verificar se tem justificativa antes de arquivar
      const maintenanceDoc = await getDoc(doc(db, "systemMaintenance", maintenanceId));
      const maintenanceData = maintenanceDoc.data();
      
      if (!maintenanceData?.justificativa || maintenanceData.justificativa.trim() === "") {
        throw new Error("Não é possível arquivar uma manutenção sem justificativa");
      }
      
      await updateDoc(doc(db, "systemMaintenance", maintenanceId), {
        arquivada: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      toast({
        title: "Manutenção arquivada!",
        description: "A manutenção foi movida para o histórico de auditoria.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao arquivar manutenção",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const limparTodasManutencoesMutation = useMutation({
    mutationFn: async () => {
      // Buscar todas as manutenções finalizadas (ativa === false)
      const maintenanceQuery = query(collection(db, "systemMaintenance"), where("ativa", "==", false));
      const maintenanceDocs = await getDocs(maintenanceQuery);
      
      // Deletar todas
      const deletePromises = maintenanceDocs.docs.map(docSnap => 
        deleteDoc(doc(db, "systemMaintenance", docSnap.id))
      );
      
      await Promise.all(deletePromises);
      
      return maintenanceDocs.docs.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      toast({
        title: "Manutenções limpas!",
        description: `${count} registro(s) de manutenção finalizada(s) foram removido(s) do sistema.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao limpar manutenções",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const editarManutencaoMutation = useMutation({
    mutationFn: async ({ maintenanceId, tipo, dataInicio, dataFim }: { maintenanceId: string; tipo: "determinada" | "indeterminada"; dataInicio: string; dataFim?: string }) => {
      if (!userData || !firebaseAuth.currentUser) throw new Error("Usuário não autenticado");
      
      const updateData: any = {
        tipo,
        dataInicio,
      };
      
      // Apenas adicionar dataFim se for manutenção determinada e tiver valor
      if (tipo === "determinada" && dataFim) {
        updateData.dataFim = dataFim;
      } else {
        // Se mudou de determinada para indeterminada, remover dataFim
        updateData.dataFim = null;
      }
      
      await updateDoc(doc(db, "systemMaintenance", maintenanceId), updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      toast({
        title: "Manutenção atualizada!",
        description: "As informações da manutenção foram atualizadas com sucesso.",
      });
      setEditMaintenanceDialogOpen(false);
      setEditingMaintenance(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar manutenção",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Funções auxiliares
  const getTurmaNome = (turmaValue: string | undefined) => {
    if (!turmaValue) return "-";
    
    // Se já é um nome de turma (ex: "T-07", "T-10"), retorna o valor
    // IDs do Firestore geralmente têm 20+ caracteres com caracteres aleatórios
    if (turmaValue.length < 20 && turmaValue.includes("-")) {
      return turmaValue;
    }
    
    // Caso contrário, é um ID antigo - busca o nome da turma
    const turma = turmas?.find(t => t.id === turmaValue);
    return turma ? turma.nome : turmaValue;
  };

  const formatarCPF = (cpf: string) => {
    const apenasNumeros = cpf.replace(/\D/g, '');
    return apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatarTelefone = (telefone: string) => {
    const apenasNumeros = telefone.replace(/\D/g, '');
    if (apenasNumeros.length === 11) {
      return apenasNumeros.replace(/(\d{2})(\d{5})(\d{4})/, '($1)$2-$3');
    }
    return telefone;
  };

  const formatarCEP = (cep: string) => {
    const apenasNumeros = cep.replace(/\D/g, '');
    return apenasNumeros.replace(/(\d{5})(\d{3})/, '$1-$2');
  };

  const buscarCEP = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await response.json();
        if (!data.erro) {
          professorDiretorForm.setValue('rua', data.logradouro || '');
          professorDiretorForm.setValue('bairro', data.bairro || '');
          professorDiretorForm.setValue('cidade', data.localidade || '');
          professorDiretorForm.setValue('estado', data.uf || '');
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  const toggleDisponibilidade = (valor: string) => {
    setDisponibilidadeHorario(prev => 
      prev.includes(valor) 
        ? prev.filter(d => d !== valor)
        : [...prev, valor]
    );
  };

  const toggleTurmaSelecionada = (turmaNome: string) => {
    setTurmasSelecionadas(prev => 
      prev.includes(turmaNome) 
        ? prev.filter(t => t !== turmaNome)
        : [...prev, turmaNome]
    );
  };

  const stats = {
    totalUsers: users?.length || 0,
    alunos: users?.filter(u => u.tipo === "aluno").length || 0,
    professores: users?.filter(u => u.tipo === "professor").length || 0,
    pendentes: pendingUsers?.length || 0,
    tarefas: tarefas?.length || 0,
    entregas: entregas?.length || 0,
    turmas: turmas?.length || 0,
  };

  const toggleJustificativa = (maintenanceId: string) => {
    setExpandedJustificativas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(maintenanceId)) {
        newSet.delete(maintenanceId);
      } else {
        newSet.add(maintenanceId);
      }
      return newSet;
    });
  };

  const downloadAuditHistory = () => {
    if (!maintenanceData || maintenanceData.filter(m => m.arquivada).length === 0) {
      toast({
        title: "Nenhum registro",
        description: "Não há manutenções arquivadas para download.",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();
    const arquivadas = maintenanceData.filter(m => m.arquivada).sort((a, b) => 
      new Date(b.dataFinalizacao || b.dataAtivacao).getTime() - new Date(a.dataFinalizacao || a.dataAtivacao).getTime()
    );

    doc.setFontSize(18);
    doc.text("Histórico de Auditoria - Sistema ENEM+", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Data de geração: ${formatBrasiliaDateTime(getNowBrasiliaISO())}`, 14, 28);
    doc.text(`Total de registros: ${arquivadas.length}`, 14, 34);

    let yPosition = 45;

    arquivadas.forEach((maintenance, index) => {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      const maintenanceTitle = maintenance.numeroManutencao 
        ? `Manutenção #${maintenance.numeroManutencao} - ${maintenance.tipo.toUpperCase()}`
        : `Manutenção ${index + 1} - ${maintenance.tipo.toUpperCase()}`;
      doc.text(maintenanceTitle, 14, yPosition);
      yPosition += 7;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      const infoLines = [
        `Início: ${formatBrasiliaDateTime(maintenance.dataInicio)}`,
        maintenance.dataFim ? `Fim Previsto: ${formatBrasiliaDateTime(maintenance.dataFim)}` : null,
        `Iniciada por: ${maintenance.iniciadoPorNome}`,
        maintenance.dataFinalizacao ? `Finalizada em: ${formatBrasiliaDateTime(maintenance.dataFinalizacao)}` : null,
        maintenance.finalizadoPorNome ? `Finalizada por: ${maintenance.finalizadoPorNome}` : null,
        maintenance.duracaoFormatada ? `Duração: ${maintenance.duracaoFormatada}` : null,
      ].filter(Boolean);

      infoLines.forEach((line) => {
        if (line) {
          doc.text(line, 14, yPosition);
          yPosition += 5;
        }
      });

      if (maintenance.justificativa) {
        yPosition += 2;
        doc.setFont("helvetica", "bold");
        doc.text("Justificativa:", 14, yPosition);
        yPosition += 5;
        doc.setFont("helvetica", "normal");

        const splitJustificativa = doc.splitTextToSize(maintenance.justificativa, 180);
        splitJustificativa.forEach((line: string) => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, 14, yPosition);
          yPosition += 5;
        });

        yPosition += 2;
        if (maintenance.justificadaPorNome) {
          doc.text(`Justificada por: ${maintenance.justificadaPorNome}`, 14, yPosition);
          yPosition += 5;
        }
        if (maintenance.dataJustificativa) {
          doc.text(`Data da justificativa: ${formatBrasiliaDateTime(maintenance.dataJustificativa)}`, 14, yPosition);
          yPosition += 5;
        }
      }

      yPosition += 8;
      doc.setDrawColor(200, 200, 200);
      doc.line(14, yPosition, 196, yPosition);
      yPosition += 8;
    });

    const fileName = `historico_auditoria_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    toast({
      title: "Download concluído!",
      description: `Histórico de auditoria salvo como ${fileName}`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-gradient-to-r from-card via-card to-card/95 backdrop-blur-xl shadow-sm">
        <div className="container flex h-20 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-md shadow-primary/20">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">ENEM+</h1>
              <p className="text-xs text-muted-foreground font-medium">Painel da Diretoria</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {maintenanceData && maintenanceData.some(m => m.ativa) && (
              <div className="flex items-center gap-3 px-4 py-2 bg-red-600 dark:bg-red-700 rounded-full border-4 border-red-700 dark:border-red-900 shadow-lg blink-red" data-testid="maintenance-warning-badge">
                <AlertTriangle className="h-5 w-5 text-white animate-pulse" />
                <p className="text-base font-extrabold text-white uppercase tracking-wide">
                  SISTEMA EM MANUTENÇÃO - TODOS USUÁRIOS BLOQUEADOS
                </p>
              </div>
            )}
            <div className="text-right mr-2 hidden sm:block">
              <p className="text-sm font-semibold">{userData?.nome}</p>
              <p className="text-xs text-muted-foreground">Diretoria</p>
            </div>
            <BrasiliaClock />
            <ChatButton />
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} data-testid="button-logout">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-6 py-10 max-w-7xl mx-auto">
        <div className="mb-10">
          <h2 className="text-4xl font-bold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Painel da Diretoria
          </h2>
          <p className="text-muted-foreground text-lg">Gerencie alunos, turmas e acompanhe estatísticas</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5 hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold">Total de Alunos</CardTitle>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary" data-testid="stat-users">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.alunos} alunos, {stats.professores} professores
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-200/50 dark:border-blue-900/50 bg-gradient-to-br from-card to-blue-50/30 dark:to-blue-950/10 hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold">Turmas</CardTitle>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400" data-testid="stat-turmas">{stats.turmas}</div>
              <p className="text-xs text-muted-foreground mt-1">Turmas ativas</p>
            </CardContent>
          </Card>

          <Card className="border-green-200/50 dark:border-green-900/50 bg-gradient-to-br from-card to-green-50/30 dark:to-green-950/10 hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold">Atividades</CardTitle>
              <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
                <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="stat-atividades">{stats.tarefas}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.entregas} entregas</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="aprovacoes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="aprovacoes" data-testid="tab-aprovacoes">
              Aprovações
              {pendingUsers && pendingUsers.length > 0 && (
                <Badge variant="destructive" className="ml-2">{pendingUsers.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="usuarios" data-testid="tab-usuarios">Alunos</TabsTrigger>
            <TabsTrigger value="turmas" data-testid="tab-turmas">Turmas</TabsTrigger>
            <TabsTrigger value="disciplinares" data-testid="tab-disciplinares">Advertências e Suspensões</TabsTrigger>
            <TabsTrigger value="monitoramento" data-testid="tab-monitoramento">Frequência</TabsTrigger>
            <TabsTrigger value="auditoria-chat" data-testid="tab-auditoria-chat">Auditoria de Chat</TabsTrigger>
            <TabsTrigger value="documentos-internos" data-testid="tab-documentos-internos">Documentos Internos</TabsTrigger>
            <TabsTrigger value="documentacao" data-testid="tab-documentacao">Documentação</TabsTrigger>
            <TabsTrigger value="avisos" data-testid="tab-avisos">Avisos</TabsTrigger>
            <TabsTrigger value="manutencao" data-testid="tab-manutencao">Manutenção</TabsTrigger>
          </TabsList>

          <TabsContent value="aprovacoes" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">Aprovar Contas Pendentes</h3>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{pendingUsers?.length || 0} pendente(s)</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await refetchSolicitacoes();
                    toast({
                      title: "Atualizado!",
                      description: "Lista de solicitações atualizada.",
                    });
                  }}
                  data-testid="button-refresh-pending"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Atualizar
                </Button>
              </div>
            </div>
            
            {pendingUsers && pendingUsers.length > 0 && (
              <div className="bg-muted/50 border border-border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Dica:</strong> Verifique a coluna <strong>UID</strong> para identificar registros duplicados. 
                  Registros com emails idênticos mas UIDs diferentes podem ser duplicatas de testes - 
                  use o botão de lixeira para removê-los.
                </p>
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                {loadingPendingUsers ? (
                  <div className="p-8">
                    <Skeleton className="h-12 w-full mb-4" />
                    <Skeleton className="h-12 w-full mb-4" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : pendingUsers && pendingUsers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matrícula</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>UID</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Turma</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingUsers.map((user) => (
                          <TableRow key={user.uid} data-testid={`row-pending-${user.uid}`}>
                            <TableCell>
                              <code className="text-xs font-mono bg-muted px-2 py-1 rounded" data-testid={`code-${user.uid}`}>
                                {user.matricula || "N/A"}
                              </code>
                            </TableCell>
                            <TableCell className="font-medium">{user.nome}</TableCell>
                            <TableCell className="text-sm">{user.email}</TableCell>
                            <TableCell>
                              <code className="text-xs font-mono text-muted-foreground">
                                {user.uid ? user.uid.substring(0, 8) : user.docId?.substring(0, 8) || "N/A"}...
                              </code>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{user.tipo}</Badge>
                            </TableCell>
                            <TableCell>{getTurmaNome(user.turma)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {user.dataSolicitacao 
                                ? new Date(user.dataSolicitacao).toLocaleDateString('pt-BR')
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 flex-wrap">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedSolicitacao(user);
                                    setViewDetailsDialogOpen(true);
                                  }}
                                  data-testid="button-view-details"
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Ver Detalhes
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSolicitacaoToEdit(user);
                                    setEditSolicitacaoDialogOpen(true);
                                  }}
                                  data-testid="button-edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => {
                                    setSolicitacaoToApprove(user);
                                    setApproveDialogOpen(true);
                                  }}
                                  disabled={approveUserMutation.isPending || rejectUserMutation.isPending || returnUserMutation.isPending}
                                  data-testid="button-approve"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Aprovar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setUserToReturn(user);
                                    setReturnDialogOpen(true);
                                  }}
                                  disabled={approveUserMutation.isPending || rejectUserMutation.isPending || returnUserMutation.isPending}
                                  data-testid="button-return"
                                >
                                  <RefreshCw className="h-4 w-4 mr-1" />
                                  Devolver
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setUserToStandby(user);
                                    setStandbyDialogOpen(true);
                                  }}
                                  disabled={approveUserMutation.isPending || rejectUserMutation.isPending || returnUserMutation.isPending}
                                  data-testid="button-standby"
                                >
                                  <Clock className="h-4 w-4 mr-1" />
                                  Stand By
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    setUserToReject(user);
                                    setRejectDialogOpen(true);
                                  }}
                                  disabled={approveUserMutation.isPending || rejectUserMutation.isPending || returnUserMutation.isPending}
                                  data-testid="button-reject"
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reprovar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setUserToDelete(user);
                                    setDeleteDialogOpen(true);
                                  }}
                                  disabled={approveUserMutation.isPending || rejectUserMutation.isPending}
                                  data-testid="button-delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle className="h-16 w-16 text-green-600 mb-4" />
                    <p className="text-lg font-medium mb-2">Nenhuma conta pendente</p>
                    <p className="text-sm text-muted-foreground">Todas as contas foram revisadas</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usuarios" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">Gerenciar Alunos</h3>
              <div className="flex gap-2">
                <Button onClick={() => setCreateAlunoDialogOpen(true)} variant="outline" data-testid="button-create-user">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Aluno
                </Button>
                <Button onClick={() => setCreateProfessorDiretorDialogOpen(true)} data-testid="button-create-professor-admin">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Professor/Diretor
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome ou matrícula..."
                value={studentSearchTerm}
                onChange={(e) => setStudentSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-student"
              />
            </div>

            <Card>
              <CardContent className="p-0">
                {loadingUsers ? (
                  <div className="p-8">
                    <Skeleton className="h-12 w-full mb-4" />
                    <Skeleton className="h-12 w-full mb-4" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : users && users.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Turma</TableHead>
                          <TableHead>Matrícula</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Presença</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.filter((user) => {
                          if (!studentSearchTerm) return true;
                          const searchLower = studentSearchTerm.toLowerCase();
                          return (
                            user.nome?.toLowerCase().includes(searchLower) ||
                            user.matricula?.toLowerCase().includes(searchLower)
                          );
                        }).map((user) => (
                          <TableRow key={user.uid} data-testid={`row-user-${user.uid}`}>
                            <TableCell className="font-medium">{user.nome}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant={
                                user.tipo === "diretor" ? "default" : 
                                user.tipo === "professor" ? "secondary" : "outline"
                              }>
                                {user.tipo}
                              </Badge>
                            </TableCell>
                            <TableCell>{getTurmaNome(user.turma)}</TableCell>
                            <TableCell>{user.matricula || "-"}</TableCell>
                            <TableCell>
                              {user.ativo ? (
                                <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Inativo
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <PresenceIndicator
                                isOnline={user.isOnline}
                                lastSeen={user.lastSeen}
                                lastActivity={user.lastActivity}
                                variant="badge"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {user.tipo === "aluno" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedStudentDetails(user);
                                      setIsEditingStudent(false);
                                      editStudentForm.reset({
                                        nome: user.nome || "",
                                        email: user.email || "",
                                        matricula: user.matricula || "",
                                        dataNascimento: user.dataNascimento || "",
                                        cpf: user.cpf || "",
                                        telefone: user.telefone || "",
                                        escolaridade: user.escolaridade || "",
                                        cep: user.cep || "",
                                        rua: user.rua || "",
                                        bairro: user.bairro || "",
                                        cidade: user.cidade || "",
                                        estado: user.estado || "",
                                        turma: user.turma || "",
                                        disponibilidade: user.disponibilidade || [],
                                      });
                                      setEditStudentDisponibilidade(user.disponibilidade || []);
                                      setStudentDetailsDialogOpen(true);
                                    }}
                                    data-testid={`button-view-details-${user.uid}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleUserStatusMutation.mutate({ 
                                    userId: user.uid, 
                                    ativo: !user.ativo 
                                  })}
                                  data-testid="button-toggle-status"
                                >
                                  {user.ativo ? "Desativar" : "Ativar"}
                                </Button>
                                {user.tipo === "aluno" && user.turma && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setUserToTransfer(user);
                                      setTransferDialogOpen(true);
                                    }}
                                    data-testid={`button-transfer-${user.uid}`}
                                  >
                                    <ArrowRightLeft className="h-4 w-4" />
                                  </Button>
                                )}
                                {user.tipo !== "diretor" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setUserToDelete(user);
                                      setDeleteDialogOpen(true);
                                    }}
                                    data-testid="button-delete-user"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Users className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">Nenhum aluno cadastrado</p>
                    <p className="text-sm text-muted-foreground">Novos alunos devem se cadastrar na tela de login e aguardar aprovação</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="turmas" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">Gerenciar Turmas</h3>
              <div className="flex gap-2">
                <Button 
                  onClick={() => syncTurmasVagasMutation.mutate()} 
                  variant="outline"
                  disabled={syncTurmasVagasMutation.isPending}
                  data-testid="button-sync-vagas"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncTurmasVagasMutation.isPending ? 'animate-spin' : ''}`} />
                  Sincronizar Vagas
                </Button>
                <Button onClick={() => setCreateTurmaDialogOpen(true)} data-testid="button-create-turma">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Turma
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingTurmas ? (
                <>
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </>
              ) : turmas && turmas.length > 0 ? (
                turmas.map((turma) => {
                  const alunosTurma = turma.vagasPreenchidas || 0;
                  const vagasDisponiveis = (turma.vagasTotais || 0) - alunosTurma;
                  
                  // Verificar se a turma está aberta fora do período
                  const hoje = new Date();
                  hoje.setHours(0, 0, 0, 0);
                  let foraDoPeríodo = false;
                  
                  if (turma.ativa && turma.periodoMatriculaFim) {
                    const dataFim = new Date(turma.periodoMatriculaFim + 'T23:59:59');
                    foraDoPeríodo = hoje > dataFim;
                  }
                  
                  return (
                    <Card 
                      key={turma.id} 
                      className={`hover-elevate ${foraDoPeríodo ? 'border-2 border-orange-500 dark:border-orange-400 bg-orange-50 dark:bg-orange-950/20' : ''}`}
                      data-testid={`card-turma-${turma.id}`}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="flex items-center gap-2">
                              <span>{turma.nome}</span>
                              <Badge variant="outline">{turma.ano}</Badge>
                            </CardTitle>
                            <CardDescription className="mt-2">
                              {alunosTurma} / {turma.vagasTotais || 0} vagas preenchidas
                            </CardDescription>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleTurmaStatusMutation.mutate({ turmaId: turma.id, ativa: !turma.ativa })}
                            data-testid={`button-toggle-turma-${turma.id}`}
                          >
                            {turma.ativa ? 
                              <CheckCircle className="h-5 w-5 text-green-600" /> : 
                              <XCircle className="h-5 w-5 text-gray-400" />
                            }
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {foraDoPeríodo ? (
                            <Badge variant="outline" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                              <Clock className="h-3 w-3 mr-1" />
                              Aberta fora do período
                            </Badge>
                          ) : turma.ativa ? (
                            <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Aberta
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                              Fechada
                            </Badge>
                          )}
                          {vagasDisponiveis === 0 ? (
                            <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                              Vagas esgotadas
                            </Badge>
                          ) : vagasDisponiveis <= 5 ? (
                            <Badge variant="outline" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                              Vagas esgotando
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              {vagasDisponiveis} vagas disponíveis
                            </Badge>
                          )}
                        </div>

                        {turma.periodoMatriculaInicio && turma.periodoMatriculaFim && (
                          <div className="text-xs text-muted-foreground">
                            Matrículas: {new Date(turma.periodoMatriculaInicio).toLocaleDateString('pt-BR')} até {new Date(turma.periodoMatriculaFim).toLocaleDateString('pt-BR')}
                          </div>
                        )}

                        <div className="flex flex-col gap-2">
                          <Button
                            variant={turma.ativa ? "destructive" : "default"}
                            size="sm"
                            onClick={() => toggleTurmaStatusMutation.mutate({ turmaId: turma.id, ativa: !turma.ativa })}
                            data-testid={`button-toggle-status-${turma.id}`}
                          >
                            {turma.ativa ? (
                              <>
                                <XCircle className="h-4 w-4 mr-1" />
                                Fechar Turma
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Abrir Turma
                              </>
                            )}
                          </Button>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                setSelectedTurmaForStudents(turma);
                                setViewTurmaStudentsDialogOpen(true);
                                setSelectedStudentsForBulkAction([]);
                              }}
                              data-testid={`button-view-students-${turma.id}`}
                            >
                              <Users className="h-4 w-4 mr-1" />
                              Ver Alunos
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                setTurmaToEdit(turma);
                                turmaForm.reset({
                                  nome: turma.nome,
                                  ano: turma.ano,
                                  vagasTotais: turma.vagasTotais || 30,
                                  periodoMatriculaInicio: turma.periodoMatriculaInicio || "",
                                  periodoMatriculaFim: turma.periodoMatriculaFim || "",
                                  linkWhatsApp: turma.linkWhatsApp || "",
                                });
                                setEditTurmaDialogOpen(true);
                              }}
                              data-testid={`button-edit-turma-${turma.id}`}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                setSelectedTurmaForWhatsApp(turma);
                                setWhatsAppLink(turma.linkWhatsApp || "");
                                setEditWhatsAppDialogOpen(true);
                              }}
                              data-testid={`button-whatsapp-${turma.id}`}
                            >
                              <MessageCircle className="h-4 w-4 mr-1" />
                              {turma.linkWhatsApp ? "Editar" : "Adicionar"} WhatsApp
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                setSelectedTurmaForVagas(turma);
                                setNovasVagas(turma.vagasTotais || 30);
                                setEditVagasDialogOpen(true);
                              }}
                              data-testid={`button-edit-vagas-${turma.id}`}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Vagas
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card className="col-span-full">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">Nenhuma turma cadastrada</p>
                    <p className="text-sm text-muted-foreground mb-4">Crie turmas para organizar os alunos</p>
                    <Button onClick={() => setCreateTurmaDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Turma
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="disciplinares" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">Advertências e Suspensões Disciplinares</h3>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome ou matrícula..."
                value={disciplinarySearchTerm}
                onChange={(e) => setDisciplinarySearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-disciplinary"
              />
            </div>

            <Card>
              <CardContent className="p-0">
                {loadingUsers ? (
                  <div className="p-8">
                    <Skeleton className="h-12 w-full mb-4" />
                    <Skeleton className="h-12 w-full mb-4" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : users && users.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Matrícula</TableHead>
                          <TableHead>Turma</TableHead>
                          <TableHead>Histórico</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users
                          .filter((user) => user.tipo === "aluno")
                          .filter((user) => {
                            if (!disciplinarySearchTerm) return true;
                            const searchLower = disciplinarySearchTerm.toLowerCase();
                            return (
                              user.nome?.toLowerCase().includes(searchLower) ||
                              user.matricula?.toLowerCase().includes(searchLower)
                            );
                          })
                          .sort((a, b) => a.nome.localeCompare(b.nome))
                          .map((student) => {
                            const studentActions = disciplinaryActions?.filter((action: any) => action.alunoId === student.uid && action.ativo === true) || [];
                            const warningsCount = studentActions.filter((action: any) => action.tipo === "advertencia").length;
                            const suspensionsCount = studentActions.filter((action: any) => action.tipo === "suspensao").length;

                            return (
                              <TableRow key={student.uid} data-testid={`row-student-disciplinary-${student.uid}`}>
                                <TableCell className="font-medium">{student.nome}</TableCell>
                                <TableCell>{student.matricula || "-"}</TableCell>
                                <TableCell>{getTurmaNome(student.turma)}</TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    {warningsCount > 0 && (
                                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                        {warningsCount} Advertência{warningsCount > 1 ? 's' : ''}
                                      </Badge>
                                    )}
                                    {suspensionsCount > 0 && (
                                      <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                        {suspensionsCount} Suspensão{suspensionsCount > 1 ? 'ões' : ''}
                                      </Badge>
                                    )}
                                    {warningsCount === 0 && suspensionsCount === 0 && (
                                      <span className="text-sm text-muted-foreground">Nenhum registro</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedStudentForHistory(student);
                                        setHistoryDialogOpen(true);
                                      }}
                                      data-testid={`button-history-${student.uid}`}
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      Histórico
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="border-yellow-500 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                                      onClick={() => {
                                        setSelectedStudentForDisciplinary(student);
                                        setWarningDialogOpen(true);
                                      }}
                                      disabled={warningsCount >= 3}
                                      data-testid={`button-warning-${student.uid}`}
                                    >
                                      <AlertTriangle className="h-4 w-4 mr-1" />
                                      Advertência
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedStudentForDisciplinary(student);
                                        setSuspensionDialogOpen(true);
                                      }}
                                      data-testid={`button-suspension-${student.uid}`}
                                    >
                                      <XCircle className="h-4 w-4 mr-1" />
                                      Suspensão
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Users className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">Nenhum aluno cadastrado</p>
                    <p className="text-sm text-muted-foreground">Nenhum aluno disponível para ações disciplinares</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitoramento" className="space-y-4">
            <MonitoringTab />
          </TabsContent>

          <TabsContent value="auditoria-chat" className="space-y-4">
            <ChatAuditPanel />
          </TabsContent>

          <TabsContent value="documentos-internos" className="space-y-4">
            <InternalDocumentsTab />
          </TabsContent>

          <TabsContent value="documentacao" className="space-y-4">
            <DocumentationTab />
          </TabsContent>

          <TabsContent value="avisos" className="space-y-4">
            <AnnouncementsTab />
          </TabsContent>

          <TabsContent value="manutencao" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">Manutenção do Sistema</h3>
            </div>

            <Card className="border-blue-200/50 dark:border-blue-900/50 bg-gradient-to-br from-card to-blue-50/30 dark:to-blue-950/10">
              <CardHeader>
                <CardTitle className="text-blue-900 dark:text-blue-100">🔒 Atenção: Procedimento de Manutenção</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-foreground">
                  Antes de iniciar qualquer manutenção, certifique-se de bloquear corretamente todo o sistema.
                  Isso evita perda de dados, falhas operacionais e impactos negativos aos usuários da plataforma.
                </p>
                <p className="flex items-start gap-2 text-orange-700 dark:text-orange-300 font-medium">
                  <span>⚠️</span>
                  <span>Sempre verifique o sistema antes de concluir a manutenção para garantir que todos os serviços estejam funcionando corretamente.</span>
                </p>
                <p className="flex items-start gap-2 text-foreground">
                  <span>📝</span>
                  <span>Após a conclusão, registre todos os detalhes da atividade no formulário de Histórico de Auditoria, garantindo rastreabilidade e conformidade dos procedimentos realizados.</span>
                </p>
              </CardContent>
            </Card>

            {maintenanceData && maintenanceData.length > 0 && maintenanceData[0].ativa ? (
              <Card className="border-orange-200/50 dark:border-orange-900/50 bg-gradient-to-br from-card to-orange-50/30 dark:to-orange-950/10">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    <CardTitle>Manutenção Ativa</CardTitle>
                  </div>
                  <CardDescription>
                    O sistema está atualmente em modo de manutenção. Apenas diretores podem acessar o sistema.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Tipo</Label>
                      <p className="font-medium capitalize">{maintenanceData[0].tipo}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Iniciada por</Label>
                      <p className="font-medium">{maintenanceData[0].iniciadoPorNome}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Data/Hora de Início</Label>
                      <p className="font-medium">
                        {formatBrasiliaDateTime(maintenanceData[0].dataInicio)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Previsão de Retorno</Label>
                      <p className="font-medium">
                        {maintenanceData[0].dataFim 
                          ? formatBrasiliaDateTime(maintenanceData[0].dataFim)
                          : "Indeterminado"
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        const maintenance = maintenanceData[0];
                        setEditingMaintenance(maintenance);
                        setEditMaintenanceType(maintenance.tipo);
                        
                        // Preencher os campos com os dados atuais
                        const startData = utcToBrasilia(maintenance.dataInicio);
                        setEditMaintenanceStartDate(startData.dateString);
                        setEditMaintenanceStartTime(startData.timeString);
                        
                        if (maintenance.dataFim) {
                          const endData = utcToBrasilia(maintenance.dataFim);
                          setEditMaintenanceEndDate(endData.dateString);
                          setEditMaintenanceEndTime(endData.timeString);
                        } else {
                          setEditMaintenanceEndDate("");
                          setEditMaintenanceEndTime("");
                        }
                        
                        setEditMaintenanceDialogOpen(true);
                      }}
                      data-testid="button-edit-maintenance"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setMaintenanceToEnd(maintenanceData[0].id);
                        setConfirmEndMaintenanceDialogOpen(true);
                      }}
                      data-testid="button-end-maintenance"
                    >
                      <PowerOff className="h-4 w-4 mr-2" />
                      Finalizar Manutenção
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Iniciar Manutenção</CardTitle>
                  <CardDescription>
                    Coloque o sistema em modo de manutenção. Todos os usuários (exceto diretores) serão impedidos de acessar o sistema.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {maintenanceData && maintenanceData.some(m => m.ativa) ? (
                    <MaintenanceTimer 
                      startTime={maintenanceData.find(m => m.ativa)?.dataAtivacao || ""} 
                      onFinalize={() => {
                        const activeMaintenance = maintenanceData.find(m => m.ativa);
                        if (activeMaintenance) {
                          setMaintenanceToEnd(activeMaintenance.id);
                          setConfirmEndMaintenanceDialogOpen(true);
                        }
                      }}
                    />
                  ) : (
                    <Button
                      onClick={async () => {
                        // VERIFICAÇÃO PRÉVIA: Bloquear abertura do diálogo se houver manutenções sem justificativa
                        const finalizadasSemArquivar = maintenanceData?.filter(m => !m.ativa && !m.arquivada) || [];
                        const semJustificativa = finalizadasSemArquivar.filter(m => !m.justificativa || m.justificativa.trim() === "");
                        
                        if (semJustificativa.length > 0) {
                          setManutencoesPendentes(semJustificativa);
                          setBloqueioDialogOpen(true);
                          return;
                        }
                        
                        // Se não há pendências, abrir o diálogo normalmente
                        setMaintenanceDialogOpen(true);
                        const nowBrasilia = getNowBrasilia();
                        setMaintenanceStartDate(nowBrasilia.dateString);
                        setMaintenanceStartTime(nowBrasilia.timeString);
                        
                        // Calcular 2 horas à frente para o horário de término
                        const [hours, minutes] = nowBrasilia.timeString.split(':').map(Number);
                        const endHours = hours + 2;
                        const endTimeString = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                        
                        setMaintenanceEndDate(nowBrasilia.dateString);
                        setMaintenanceEndTime(endTimeString);
                      }}
                      data-testid="button-start-maintenance"
                    >
                      <Power className="h-4 w-4 mr-2" />
                      Iniciar Manutenção
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Manutenções Recentes (Não Arquivadas) */}
            {maintenanceData && maintenanceData.filter(m => !m.arquivada).length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Manutenções Recentes</CardTitle>
                      <CardDescription>
                        Manutenções que ainda não foram arquivadas no histórico de auditoria
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {maintenanceData
                      .filter(m => !m.arquivada)
                      .map((maintenance) => {
                        const needsJustification = !maintenance.ativa && (!maintenance.justificativa || maintenance.justificativa.trim() === "");
                        const hasJustification = maintenance.justificativa && maintenance.justificativa.trim() !== "";
                        
                        return (
                          <div
                            key={maintenance.id}
                            className={`p-4 rounded-lg border ${
                              maintenance.ativa 
                                ? 'border-orange-200 dark:border-orange-900 bg-orange-50/30 dark:bg-orange-950/10' 
                                : needsJustification
                                ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
                                : 'border-border bg-muted/30'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant={maintenance.ativa ? "destructive" : "secondary"}>
                                    {maintenance.ativa ? "ATIVA" : "Finalizada"}
                                  </Badge>
                                  {needsJustification && (
                                    <Badge variant="destructive" className="animate-pulse">
                                      REQUER JUSTIFICATIVA
                                    </Badge>
                                  )}
                                  {hasJustification && !maintenance.arquivada && (
                                    <Badge variant="default" className="bg-green-600 dark:bg-green-700">
                                      Justificada
                                    </Badge>
                                  )}
                                  <span className="text-sm font-medium capitalize">
                                    {maintenance.tipo}
                                  </span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Início:</span>{" "}
                                    <span className="font-medium">
                                      {formatBrasiliaDateTime(maintenance.dataInicio)}
                                    </span>
                                  </div>
                                  
                                  {maintenance.dataFim && (
                                    <div>
                                      <span className="text-muted-foreground">Fim Previsto:</span>{" "}
                                      <span className="font-medium">
                                        {formatBrasiliaDateTime(maintenance.dataFim)}
                                      </span>
                                    </div>
                                  )}
                                  
                                  <div>
                                    <span className="text-muted-foreground">Iniciada por:</span>{" "}
                                    <span className="font-medium">{maintenance.iniciadoPorNome}</span>
                                  </div>
                                  
                                  {maintenance.dataFinalizacao && (
                                    <div>
                                      <span className="text-muted-foreground">Finalizada em:</span>{" "}
                                      <span className="font-medium">
                                        {formatBrasiliaDateTime(maintenance.dataFinalizacao)}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {maintenance.finalizadoPorNome && (
                                    <div>
                                      <span className="text-muted-foreground">Finalizada por:</span>{" "}
                                      <span className="font-medium">{maintenance.finalizadoPorNome}</span>
                                    </div>
                                  )}
                                  
                                  {maintenance.duracaoFormatada && (
                                    <div>
                                      <span className="text-muted-foreground">Duração:</span>{" "}
                                      <span className="font-medium font-mono">{maintenance.duracaoFormatada}</span>
                                    </div>
                                  )}

                                  {hasJustification && (
                                    <>
                                      <div className="col-span-2">
                                        <span className="text-muted-foreground">Justificativa:</span>{" "}
                                        <p className="text-sm mt-1 p-2 bg-muted rounded">{maintenance.justificativa}</p>
                                      </div>
                                      {maintenance.justificadaPorNome && (
                                        <div>
                                          <span className="text-muted-foreground">Justificada por:</span>{" "}
                                          <span className="font-medium">{maintenance.justificadaPorNome}</span>
                                        </div>
                                      )}
                                      {maintenance.dataJustificativa && (
                                        <div>
                                          <span className="text-muted-foreground">Data da justificativa:</span>{" "}
                                          <span className="font-medium">
                                            {formatBrasiliaDateTime(maintenance.dataJustificativa)}
                                          </span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex gap-2 flex-col">
                                {maintenance.ativa ? (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      setMaintenanceToEnd(maintenance.id);
                                      setConfirmEndMaintenanceDialogOpen(true);
                                    }}
                                    disabled={finalizarManutencaoMutation.isPending}
                                    data-testid={`button-finalize-maintenance-${maintenance.id}`}
                                  >
                                    <PowerOff className="h-4 w-4 mr-2" />
                                    Finalizar
                                  </Button>
                                ) : (
                                  <>
                                    {needsJustification ? (
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => {
                                          setMaintenanceToJustify(maintenance);
                                          setJustificativaText("");
                                          setJustificativaDialogOpen(true);
                                        }}
                                        data-testid={`button-add-justification-${maintenance.id}`}
                                      >
                                        <FileText className="h-4 w-4 mr-2" />
                                        Adicionar Justificativa
                                      </Button>
                                    ) : (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setMaintenanceToJustify(maintenance);
                                            setJustificativaText(maintenance.justificativa || "");
                                            setJustificativaDialogOpen(true);
                                          }}
                                          data-testid={`button-edit-justification-${maintenance.id}`}
                                        >
                                          <Edit className="h-4 w-4 mr-2" />
                                          Editar Justificativa
                                        </Button>
                                        <Button
                                          variant="default"
                                          size="sm"
                                          onClick={() => arquivarManutencaoMutation.mutate(maintenance.id)}
                                          disabled={arquivarManutencaoMutation.isPending}
                                          data-testid={`button-archive-maintenance-${maintenance.id}`}
                                        >
                                          <Archive className="h-4 w-4 mr-2" />
                                          Arquivar
                                        </Button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Acesso ao Histórico de Auditoria - SEMPRE ACESSÍVEL */}
            <Card className="border-blue-200/50 dark:border-blue-900/50 bg-gradient-to-br from-card to-blue-50/30 dark:to-blue-950/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Archive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      Histórico de Auditoria
                    </CardTitle>
                    <CardDescription>
                      Área restrita com registro permanente de todas as manutenções arquivadas.
                      <span className="font-semibold text-blue-600 dark:text-blue-400"> Sempre acessível.</span>
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400">
                    {maintenanceData?.filter(m => m.arquivada).length || 0} Registros
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <div className="p-4 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                    <Archive className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-base font-medium">Acesso Restrito ao Histórico</p>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Clique no botão abaixo para acessar o histórico completo de auditoria com todas as manutenções arquivadas.
                    </p>
                  </div>
                  <Button
                    variant="default"
                    size="lg"
                    onClick={() => setAuditHistoryDialogOpen(true)}
                    className="mt-2"
                    data-testid="button-access-audit-history"
                  >
                    <Archive className="h-5 w-5 mr-2" />
                    Acessar Histórico de Auditoria
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent data-testid="dialog-reject-user">
          <DialogHeader>
            <DialogTitle>Reprovar Cadastro</DialogTitle>
            <DialogDescription>
              Você está prestes a reprovar o cadastro de <strong>{userToReject?.nome}</strong>.
              Adicione um comentário explicando o motivo (opcional).
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {userToReject && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Código:</span>
                  <code className="font-mono">{userToReject.codigoSolicitacao}</code>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Email:</span>
                  <span>{userToReject.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Turma:</span>
                  <span>{userToReject.turma || "-"}</span>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="reject-comment">Comentário (opcional)</Label>
              <Textarea
                id="reject-comment"
                placeholder="Ex: Turma não encontrada no sistema, dados incorretos, etc."
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                rows={4}
                data-testid="textarea-reject-comment"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setUserToReject(null);
                setRejectComment("");
              }}
              data-testid="button-cancel-reject"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (userToReject) {
                  rejectUserMutation.mutate({ 
                    solicitacaoId: userToReject.docId, 
                    comentario: rejectComment 
                  });
                }
              }}
              disabled={rejectUserMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectUserMutation.isPending ? "Reprovando..." : "Reprovar Cadastro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent data-testid="dialog-return-user">
          <DialogHeader>
            <DialogTitle>Devolver Cadastro</DialogTitle>
            <DialogDescription>
              Você está devolvendo o cadastro de <strong>{userToReturn?.nome}</strong> para correções.
              Adicione um comentário explicando o que precisa ser alterado.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {userToReturn && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Matrícula:</span>
                  <code className="font-mono">{userToReturn.matricula}</code>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Email:</span>
                  <span>{userToReturn.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Turma:</span>
                  <span>{userToReturn.turma || "-"}</span>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="return-comment">O que deve ser corrigido? *</Label>
              <Textarea
                id="return-comment"
                placeholder="Ex: Por favor, verifique o CPF informado e corrija a data de nascimento..."
                value={returnComment}
                onChange={(e) => setReturnComment(e.target.value)}
                rows={4}
                data-testid="textarea-return-comment"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReturnDialogOpen(false);
                setUserToReturn(null);
                setReturnComment("");
              }}
              data-testid="button-cancel-return"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (userToReturn) {
                  returnUserMutation.mutate({ 
                    solicitacaoId: userToReturn.docId, 
                    comentario: returnComment 
                  });
                }
              }}
              disabled={returnUserMutation.isPending || !returnComment.trim()}
              data-testid="button-confirm-return"
            >
              {returnUserMutation.isPending ? "Devolvendo..." : "Devolver Cadastro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDetailsDialogOpen} onOpenChange={setViewDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-view-details">
          <DialogHeader>
            <DialogTitle>Detalhes do Cadastro</DialogTitle>
            <DialogDescription>
              Visualize todos os dados da solicitação de matrícula
            </DialogDescription>
          </DialogHeader>
          
          {selectedSolicitacao && (
            <div className="space-y-6">
              {selectedSolicitacao.fotoBase64 && (
                <div className="flex justify-center">
                  <div className="space-y-2">
                    <Label>Foto 3x4</Label>
                    <div className="border rounded-lg p-2 bg-muted/30">
                      <img 
                        src={selectedSolicitacao.fotoBase64} 
                        alt="Foto do aluno" 
                        className="w-32 h-40 object-cover rounded"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Visibilidade: {selectedSolicitacao.fotoPublica ? "Pública" : "Apenas Diretor"}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Matrícula</Label>
                  <div className="p-2 bg-muted rounded">
                    <code className="font-mono">{selectedSolicitacao.matricula}</code>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="p-2 bg-muted rounded">
                    <Badge variant={
                      selectedSolicitacao.status === "pendente" ? "secondary" :
                      selectedSolicitacao.status === "aprovado" ? "default" :
                      selectedSolicitacao.status === "devolvido" ? "outline" : "destructive"
                    }>
                      {selectedSolicitacao.status}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label>Nome Completo</Label>
                  <div className="p-2 bg-muted rounded">
                    {selectedSolicitacao.nome}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="p-2 bg-muted rounded">
                    {selectedSolicitacao.email}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>CPF</Label>
                  <div className="p-2 bg-muted rounded">
                    {selectedSolicitacao.cpf}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <div className="p-2 bg-muted rounded">
                    {selectedSolicitacao.dataNascimento 
                      ? new Date(selectedSolicitacao.dataNascimento).toLocaleDateString('pt-BR')
                      : "-"}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Escolaridade</Label>
                  <div className="p-2 bg-muted rounded">
                    {selectedSolicitacao.escolaridade || "-"}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Telefone (WhatsApp)</Label>
                  <div className="p-2 bg-muted rounded">
                    {selectedSolicitacao.telefone ? formatarTelefone(selectedSolicitacao.telefone) : "-"}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Turma</Label>
                  <div className="p-2 bg-muted rounded">
                    {getTurmaNome(selectedSolicitacao.turma)}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-base font-semibold">Endereço</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <div className="p-2 bg-muted rounded">
                      {selectedSolicitacao.cep ? formatarCEP(selectedSolicitacao.cep) : "-"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Rua</Label>
                    <div className="p-2 bg-muted rounded">
                      {selectedSolicitacao.rua || "-"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <div className="p-2 bg-muted rounded">
                      {selectedSolicitacao.bairro || "-"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <div className="p-2 bg-muted rounded">
                      {selectedSolicitacao.cidade || "-"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <div className="p-2 bg-muted rounded">
                      {selectedSolicitacao.estado || "-"}
                    </div>
                  </div>
                </div>
              </div>

              {selectedSolicitacao.disponibilidade && selectedSolicitacao.disponibilidade.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Disponibilidade de Horário</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedSolicitacao.disponibilidade.map((horario: string) => (
                      <Badge key={horario} variant="outline">{horario}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedSolicitacao.dataSolicitacao && (
                <div className="space-y-2">
                  <Label>Data da Solicitação</Label>
                  <div className="p-2 bg-muted rounded">
                    {new Date(selectedSolicitacao.dataSolicitacao).toLocaleString('pt-BR')}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setViewDetailsDialogOpen(false);
                setSelectedSolicitacao(null);
              }}
              data-testid="button-close-details"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent data-testid="dialog-approve-user">
          <DialogHeader>
            <DialogTitle>Aprovar Cadastro</DialogTitle>
            <DialogDescription>
              Defina uma senha inicial para <strong>{solicitacaoToApprove?.nome}</strong>.
              O aluno poderá fazer login com esta senha.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {solicitacaoToApprove && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Código:</span>
                  <code className="font-mono">{solicitacaoToApprove.codigoSolicitacao}</code>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Email:</span>
                  <span>{solicitacaoToApprove.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Turma:</span>
                  <span>{solicitacaoToApprove.turma || "-"}</span>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="senha-inicial">Senha Inicial</Label>
              <Input
                id="senha-inicial"
                type="password"
                placeholder="Defina uma senha de pelo menos 6 caracteres"
                value={senhaInicial}
                onChange={(e) => setSenhaInicial(e.target.value)}
                minLength={6}
                data-testid="input-senha-inicial"
              />
              <p className="text-sm text-muted-foreground">
                Informe esta senha ao aluno após a aprovação.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setApproveDialogOpen(false);
                setSolicitacaoToApprove(null);
                setSenhaInicial("");
              }}
              data-testid="button-cancel-approve"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => {
                if (solicitacaoToApprove && senhaInicial.length >= 6) {
                  approveUserMutation.mutate({ 
                    solicitacaoId: solicitacaoToApprove.docId, 
                    senha: senhaInicial
                  });
                  setApproveDialogOpen(false);
                  setSolicitacaoToApprove(null);
                  setSenhaInicial("");
                }
              }}
              disabled={approveUserMutation.isPending || senhaInicial.length < 6}
              data-testid="button-confirm-approve"
            >
              {approveUserMutation.isPending ? "Aprovando..." : "Aprovar e Criar Conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createTurmaDialogOpen} onOpenChange={setCreateTurmaDialogOpen}>
        <DialogContent data-testid="dialog-create-turma">
          <DialogHeader>
            <DialogTitle>Nova Turma</DialogTitle>
            <DialogDescription>
              Crie uma nova turma
            </DialogDescription>
          </DialogHeader>

          <Form {...turmaForm}>
            <form onSubmit={turmaForm.handleSubmit((data) => createTurmaMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={turmaForm.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Turma *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 3A, 2B" {...field} data-testid="input-nome-turma" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={turmaForm.control}
                  name="ano"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ano *</FormLabel>
                      <FormControl>
                        <Input placeholder="2025" {...field} data-testid="input-ano" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={turmaForm.control}
                name="vagasTotais"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Vagas *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="30" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-vagas-totais" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={turmaForm.control}
                  name="periodoMatriculaInicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Início das Matrículas</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-matricula-inicio" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={turmaForm.control}
                  name="periodoMatriculaFim"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fim das Matrículas</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-matricula-fim" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={turmaForm.control}
                name="linkWhatsApp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link do Grupo WhatsApp</FormLabel>
                    <FormControl>
                      <Input placeholder="https://chat.whatsapp.com/..." {...field} data-testid="input-link-whatsapp" />
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
                    setCreateTurmaDialogOpen(false);
                    turmaForm.reset();
                  }}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createTurmaMutation.isPending} data-testid="button-save">
                  Criar Turma
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={editTurmaDialogOpen} onOpenChange={setEditTurmaDialogOpen}>
        <DialogContent data-testid="dialog-edit-turma">
          <DialogHeader>
            <DialogTitle>Editar Turma</DialogTitle>
            <DialogDescription>
              Altere as informações da turma. O diretor pode editar datas e reabrir turmas a qualquer momento.
            </DialogDescription>
          </DialogHeader>

          <Form {...turmaForm}>
            <form onSubmit={turmaForm.handleSubmit((data) => {
              if (turmaToEdit) {
                editTurmaMutation.mutate({ turmaId: turmaToEdit.id, data });
              }
            })} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={turmaForm.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Turma *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 3A, 2B" {...field} data-testid="input-edit-nome-turma" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={turmaForm.control}
                  name="ano"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ano *</FormLabel>
                      <FormControl>
                        <Input placeholder="2025" {...field} data-testid="input-edit-ano" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={turmaForm.control}
                name="vagasTotais"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Vagas *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="30" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-edit-vagas-totais" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={turmaForm.control}
                  name="periodoMatriculaInicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Início das Matrículas</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-edit-matricula-inicio" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={turmaForm.control}
                  name="periodoMatriculaFim"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fim das Matrículas</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-edit-matricula-fim" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={turmaForm.control}
                name="linkWhatsApp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link do Grupo WhatsApp</FormLabel>
                    <FormControl>
                      <Input placeholder="https://chat.whatsapp.com/..." {...field} data-testid="input-edit-link-whatsapp" />
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
                    setEditTurmaDialogOpen(false);
                    setTurmaToEdit(null);
                    turmaForm.reset();
                  }}
                  data-testid="button-cancel-edit"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={editTurmaMutation.isPending} data-testid="button-save-edit">
                  {editTurmaMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={createAlunoDialogOpen} onOpenChange={setCreateAlunoDialogOpen}>
        <DialogContent data-testid="dialog-create-user">
          <DialogHeader>
            <DialogTitle>Adicionar Aluno</DialogTitle>
            <DialogDescription>
              Crie um novo aluno com acesso imediato à plataforma
            </DialogDescription>
          </DialogHeader>

          <Form {...alunoForm}>
            <form onSubmit={alunoForm.handleSubmit((data) => createAlunoMutation.mutate(data))} className="space-y-4">
              <FormField
                control={alunoForm.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do aluno" {...field} data-testid="input-user-nome" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={alunoForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} data-testid="input-user-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={alunoForm.control}
                name="senha"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Mínimo 6 caracteres" {...field} data-testid="input-user-senha" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={alunoForm.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-user-tipo">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="aluno">Aluno</SelectItem>
                        <SelectItem value="professor">Professor</SelectItem>
                        <SelectItem value="diretor">Diretor</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={alunoForm.control}
                name="turma"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Turma</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 3A, 2B" {...field} data-testid="input-user-turma" />
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
                    setCreateAlunoDialogOpen(false);
                    alunoForm.reset();
                  }}
                  data-testid="button-cancel-create-user"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createAlunoMutation.isPending} data-testid="button-save-user">
                  {createAlunoMutation.isPending ? "Criando..." : "Criar Aluno"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={createProfessorDiretorDialogOpen} onOpenChange={setCreateProfessorDiretorDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-professor-admin">
          <DialogHeader>
            <DialogTitle>Criar Professor/Diretor</DialogTitle>
            <DialogDescription>
              Crie uma conta completa para professor ou diretor com acesso imediato
            </DialogDescription>
          </DialogHeader>

          <Form {...professorDiretorForm}>
            <form onSubmit={professorDiretorForm.handleSubmit((data) => createProfessorDiretorMutation.mutate(data))} className="space-y-4">
              <FormField
                control={professorDiretorForm.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Conta *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-tipo">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="professor">Professor</SelectItem>
                        <SelectItem value="diretor">Diretor</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={professorDiretorForm.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome completo" {...field} data-testid="input-prof-nome" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={professorDiretorForm.control}
                  name="dataNascimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Nascimento *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-prof-data-nasc" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={professorDiretorForm.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="000.000.000-00" 
                          {...field}
                          onChange={(e) => {
                            const formatted = formatarCPF(e.target.value);
                            field.onChange(formatted);
                          }}
                          maxLength={14}
                          data-testid="input-prof-cpf" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={professorDiretorForm.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="(00)00000-0000" 
                          {...field}
                          onChange={(e) => {
                            const formatted = formatarTelefone(e.target.value);
                            field.onChange(formatted);
                          }}
                          data-testid="input-prof-telefone" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={professorDiretorForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@exemplo.com" {...field} data-testid="input-prof-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={professorDiretorForm.control}
                  name="senha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Mínimo 6 caracteres" {...field} data-testid="input-prof-senha" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={professorDiretorForm.control}
                name="escolaridade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Escolaridade *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-escolaridade">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ensino-medio">Ensino Médio</SelectItem>
                        <SelectItem value="graduacao">Graduação</SelectItem>
                        <SelectItem value="pos-graduacao">Pós-graduação</SelectItem>
                        <SelectItem value="mestrado">Mestrado</SelectItem>
                        <SelectItem value="doutorado">Doutorado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={professorDiretorForm.control}
                name="cep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="00000-000" 
                        {...field}
                        onChange={(e) => {
                          const formatted = formatarCEP(e.target.value);
                          field.onChange(formatted);
                        }}
                        onBlur={(e) => buscarCEP(e.target.value)}
                        maxLength={9}
                        data-testid="input-prof-cep" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={professorDiretorForm.control}
                  name="rua"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rua</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua" {...field} data-testid="input-prof-rua" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={professorDiretorForm.control}
                  name="bairro"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro</FormLabel>
                      <FormControl>
                        <Input placeholder="Bairro" {...field} data-testid="input-prof-bairro" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={professorDiretorForm.control}
                  name="cidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input placeholder="Cidade" {...field} data-testid="input-prof-cidade" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={professorDiretorForm.control}
                  name="estado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <FormControl>
                        <Input placeholder="UF" {...field} maxLength={2} data-testid="input-prof-estado" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {professorDiretorForm.watch('tipo') === 'professor' && (
                <div className="space-y-2">
                  <Label>Turmas (Professor pode ter várias)</Label>
                  <div className="border rounded-lg p-4 space-y-2">
                    {turmas && turmas.length > 0 ? (
                      turmas.map((turma) => (
                        <div key={turma.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`turma-${turma.id}`}
                            checked={turmasSelecionadas.includes(turma.nome)}
                            onCheckedChange={() => toggleTurmaSelecionada(turma.nome)}
                            data-testid={`checkbox-turma-${turma.nome}`}
                          />
                          <Label htmlFor={`turma-${turma.id}`} className="font-normal cursor-pointer">
                            {turma.nome} - {turma.ano}
                          </Label>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhuma turma disponível</p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Disponibilidade de Horário para Aulas *</Label>
                <div className="border rounded-lg p-4 space-y-2">
                  {[
                    "Manhã - Seg a Sex",
                    "Manhã - Seg a Sáb",
                    "Tarde - Seg a Sex",
                    "Tarde - Seg a Sáb",
                    "Noite - Seg a Sex",
                    "Noite - Seg a Sáb",
                    "Domingo",
                    "Qualquer Horário"
                  ].map((opcao) => (
                    <div key={opcao} className="flex items-center space-x-2">
                      <Checkbox
                        id={`disp-${opcao}`}
                        checked={disponibilidadeHorario.includes(opcao)}
                        onCheckedChange={() => toggleDisponibilidade(opcao)}
                        data-testid={`checkbox-disp-${opcao}`}
                      />
                      <Label htmlFor={`disp-${opcao}`} className="font-normal cursor-pointer">
                        {opcao}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCreateProfessorDiretorDialogOpen(false);
                    professorDiretorForm.reset();
                    setDisponibilidadeHorario([]);
                    setTurmasSelecionadas([]);
                  }}
                  data-testid="button-cancel-prof"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createProfessorDiretorMutation.isPending} data-testid="button-save-prof">
                  {createProfessorDiretorMutation.isPending ? "Criando..." : "Criar Conta"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-user">
          <DialogHeader>
            <DialogTitle>Excluir Aluno</DialogTitle>
            <DialogDescription>
              Você está prestes a excluir <strong>{userToDelete?.nome}</strong>.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          
          {userToDelete && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Nome:</span>
                <span className="font-medium">{userToDelete.nome}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Email:</span>
                <span>{userToDelete.email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tipo:</span>
                <span>{userToDelete.tipo}</span>
              </div>
              {userToDelete.turma && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Turma:</span>
                  <span>{userToDelete.turma}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setUserToDelete(null);
              }}
              data-testid="button-cancel-delete"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (userToDelete) {
                  deleteUserMutation.mutate(userToDelete);
                }
              }}
              disabled={deleteUserMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteUserMutation.isPending ? "Excluindo..." : "Excluir Aluno"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editWhatsAppDialogOpen} onOpenChange={setEditWhatsAppDialogOpen}>
        <DialogContent data-testid="dialog-edit-whatsapp">
          <DialogHeader>
            <DialogTitle>Link do Grupo WhatsApp</DialogTitle>
            <DialogDescription>
              Configure o link do grupo WhatsApp para a turma {selectedTurmaForWhatsApp?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp-link">Link do WhatsApp</Label>
              <Input
                id="whatsapp-link"
                placeholder="https://chat.whatsapp.com/..."
                value={whatsAppLink}
                onChange={(e) => setWhatsAppLink(e.target.value)}
                data-testid="input-whatsapp-link"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditWhatsAppDialogOpen(false);
                setSelectedTurmaForWhatsApp(null);
                setWhatsAppLink("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (selectedTurmaForWhatsApp) {
                  updateWhatsAppMutation.mutate({
                    turmaId: selectedTurmaForWhatsApp.id,
                    link: whatsAppLink
                  });
                }
              }}
              disabled={updateWhatsAppMutation.isPending}
              data-testid="button-save-whatsapp"
            >
              {updateWhatsAppMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={studentDetailsDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsEditingStudent(false);
          setSelectedStudentDetails(null);
        }
        setStudentDetailsDialogOpen(open);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-student-details">
          <DialogHeader>
            <DialogTitle>{isEditingStudent ? "Editar Cadastro do Aluno" : "Detalhes do Aluno"}</DialogTitle>
            <DialogDescription>
              {isEditingStudent ? "Edite as informações do aluno e salve as alterações" : "Informações completas do aluno"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedStudentDetails && !isEditingStudent && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Dados Pessoais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-muted-foreground">Nome</Label>
                      <p className="font-medium">{selectedStudentDetails.nome}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="font-medium">{selectedStudentDetails.email}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Matrícula</Label>
                      <p className="font-medium">{selectedStudentDetails.matricula || "Não informada"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">CPF</Label>
                      <p className="font-medium">{selectedStudentDetails.cpf || "Não informado"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Data de Nascimento</Label>
                      <p className="font-medium">{selectedStudentDetails.dataNascimento || "Não informada"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Telefone (WhatsApp)</Label>
                      <p className="font-medium">{selectedStudentDetails.telefone || "Não informado"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Escolaridade</Label>
                      <p className="font-medium">{selectedStudentDetails.escolaridade || "Não informada"}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Endereço</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-muted-foreground">CEP</Label>
                      <p className="font-medium">{selectedStudentDetails.cep || "Não informado"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Rua</Label>
                      <p className="font-medium">{selectedStudentDetails.rua || "Não informada"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Bairro</Label>
                      <p className="font-medium">{selectedStudentDetails.bairro || "Não informado"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Cidade</Label>
                      <p className="font-medium">{selectedStudentDetails.cidade || "Não informada"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Estado</Label>
                      <p className="font-medium">{selectedStudentDetails.estado || "Não informado"}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações Acadêmicas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-muted-foreground">Turma Alocada</Label>
                    <p className="font-medium">{getTurmaNome(selectedStudentDetails.turma)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Disponibilidade de Horários do Aluno</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedStudentDetails.disponibilidade && selectedStudentDetails.disponibilidade.length > 0 ? (
                        selectedStudentDetails.disponibilidade.map((horario, index) => (
                          <Badge key={index} variant="secondary">{horario}</Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">Não informado</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {selectedStudentDetails && isEditingStudent && (
            <Form {...editStudentForm}>
              <form onSubmit={editStudentForm.handleSubmit((data) => {
                updateStudentDataMutation.mutate({
                  ...data,
                  userId: selectedStudentDetails.uid,
                  disponibilidade: editStudentDisponibilidade,
                });
              })} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Dados Pessoais</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={editStudentForm.control}
                        name="nome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome Completo</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-nome" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editStudentForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" disabled data-testid="input-edit-email" />
                            </FormControl>
                            <FormDescription className="text-xs">
                              O email não pode ser alterado pois está vinculado à conta de acesso
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editStudentForm.control}
                        name="matricula"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Matrícula</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-matricula" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editStudentForm.control}
                        name="cpf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-cpf" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editStudentForm.control}
                        name="dataNascimento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data de Nascimento</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" data-testid="input-edit-dataNascimento" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editStudentForm.control}
                        name="telefone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone (WhatsApp)</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-telefone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editStudentForm.control}
                        name="escolaridade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Escolaridade</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-edit-escolaridade">
                                  <SelectValue placeholder="Selecione a escolaridade" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="sem-estudo">Sem estudo - Analfabeto</SelectItem>
                                <SelectItem value="fundamental-cursando">Ensino Fundamental - Cursando</SelectItem>
                                <SelectItem value="fundamental-completo">Ensino Fundamental - Completo</SelectItem>
                                <SelectItem value="fundamental-incompleto">Ensino Fundamental - Incompleto</SelectItem>
                                <SelectItem value="medio-cursando">Ensino Médio - Cursando</SelectItem>
                                <SelectItem value="medio-completo">Ensino Médio - Completo</SelectItem>
                                <SelectItem value="medio-incompleto">Ensino Médio - Incompleto</SelectItem>
                                <SelectItem value="superior-cursando">Ensino Superior - Cursando</SelectItem>
                                <SelectItem value="superior-completo">Ensino Superior - Completo</SelectItem>
                                <SelectItem value="superior-incompleto">Ensino Superior - Incompleto</SelectItem>
                                <SelectItem value="pos-cursando">Pós-Graduação - Cursando</SelectItem>
                                <SelectItem value="pos-completo">Pós-Graduação - Completo</SelectItem>
                                <SelectItem value="pos-incompleto">Pós-Graduação - Incompleto</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Endereço</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={editStudentForm.control}
                        name="cep"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CEP</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-cep" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editStudentForm.control}
                        name="rua"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rua</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-rua" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editStudentForm.control}
                        name="bairro"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bairro</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-bairro" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editStudentForm.control}
                        name="cidade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-cidade" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editStudentForm.control}
                        name="estado"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-edit-estado">
                                  <SelectValue placeholder="Selecione o estado" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="AC">AC</SelectItem>
                                <SelectItem value="AL">AL</SelectItem>
                                <SelectItem value="AP">AP</SelectItem>
                                <SelectItem value="AM">AM</SelectItem>
                                <SelectItem value="BA">BA</SelectItem>
                                <SelectItem value="CE">CE</SelectItem>
                                <SelectItem value="DF">DF</SelectItem>
                                <SelectItem value="ES">ES</SelectItem>
                                <SelectItem value="GO">GO</SelectItem>
                                <SelectItem value="MA">MA</SelectItem>
                                <SelectItem value="MT">MT</SelectItem>
                                <SelectItem value="MS">MS</SelectItem>
                                <SelectItem value="MG">MG</SelectItem>
                                <SelectItem value="PA">PA</SelectItem>
                                <SelectItem value="PB">PB</SelectItem>
                                <SelectItem value="PR">PR</SelectItem>
                                <SelectItem value="PE">PE</SelectItem>
                                <SelectItem value="PI">PI</SelectItem>
                                <SelectItem value="RJ">RJ</SelectItem>
                                <SelectItem value="RN">RN</SelectItem>
                                <SelectItem value="RS">RS</SelectItem>
                                <SelectItem value="RO">RO</SelectItem>
                                <SelectItem value="RR">RR</SelectItem>
                                <SelectItem value="SC">SC</SelectItem>
                                <SelectItem value="SP">SP</SelectItem>
                                <SelectItem value="SE">SE</SelectItem>
                                <SelectItem value="TO">TO</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Informações Acadêmicas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={editStudentForm.control}
                      name="turma"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Turma</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value || undefined}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-edit-turma">
                                <SelectValue placeholder="Selecione a turma" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {turmas?.filter(t => t.ativa).map((turma: any) => (
                                <SelectItem key={turma.id} value={turma.id}>
                                  {turma.nome} - {turma.ano}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="space-y-2">
                      <Label>Disponibilidade de Horários</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {["Segunda de manhã", "Segunda à tarde", "Segunda à noite", "Terça de manhã", "Terça à tarde", "Terça à noite", "Quarta de manhã", "Quarta à tarde", "Quarta à noite", "Quinta de manhã", "Quinta à tarde", "Quinta à noite", "Sexta de manhã", "Sexta à tarde", "Sexta à noite", "Sábado de manhã", "Sábado à tarde", "Domingo de manhã", "Domingo à tarde"].map((horario) => (
                          <div key={horario} className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-horario-${horario}`}
                              checked={editStudentDisponibilidade.includes(horario)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setEditStudentDisponibilidade([...editStudentDisponibilidade, horario]);
                                } else {
                                  setEditStudentDisponibilidade(editStudentDisponibilidade.filter((h) => h !== horario));
                                }
                              }}
                              data-testid={`checkbox-edit-disponibilidade-${horario}`}
                            />
                            <label htmlFor={`edit-horario-${horario}`} className="text-sm">
                              {horario}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </form>
            </Form>
          )}

          <DialogFooter>
            {!isEditingStudent ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStudentDetailsDialogOpen(false);
                    setSelectedStudentDetails(null);
                  }}
                  data-testid="button-close-details"
                >
                  Fechar
                </Button>
                <Button
                  onClick={() => {
                    if (selectedStudentDetails) {
                      editStudentForm.reset({
                        nome: selectedStudentDetails.nome || "",
                        email: selectedStudentDetails.email || "",
                        matricula: selectedStudentDetails.matricula || "",
                        dataNascimento: selectedStudentDetails.dataNascimento || "",
                        cpf: selectedStudentDetails.cpf || "",
                        telefone: selectedStudentDetails.telefone || "",
                        escolaridade: selectedStudentDetails.escolaridade || "",
                        cep: selectedStudentDetails.cep || "",
                        rua: selectedStudentDetails.rua || "",
                        bairro: selectedStudentDetails.bairro || "",
                        cidade: selectedStudentDetails.cidade || "",
                        estado: selectedStudentDetails.estado || "",
                        turma: selectedStudentDetails.turma || "",
                        disponibilidade: selectedStudentDetails.disponibilidade || [],
                      });
                      setEditStudentDisponibilidade(selectedStudentDetails.disponibilidade || []);
                    }
                    setIsEditingStudent(true);
                  }}
                  data-testid="button-edit-student"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Cadastro
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditingStudent(false);
                  }}
                  data-testid="button-cancel-edit"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={editStudentForm.handleSubmit((data) => {
                    updateStudentDataMutation.mutate({
                      ...data,
                      userId: selectedStudentDetails!.uid,
                      disponibilidade: editStudentDisponibilidade,
                    });
                  })}
                  disabled={updateStudentDataMutation.isPending}
                  data-testid="button-save-student"
                >
                  {updateStudentDataMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={warningDialogOpen} onOpenChange={setWarningDialogOpen}>
        <DialogContent data-testid="dialog-warning">
          <DialogHeader>
            <DialogTitle>Aplicar Advertência Disciplinar</DialogTitle>
            <DialogDescription>
              Você está prestes a aplicar uma advertência disciplinar para <strong>{selectedStudentForDisciplinary?.nome}</strong>.
            </DialogDescription>
          </DialogHeader>
          
          {selectedStudentForDisciplinary && (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nome:</span>
                  <span className="font-medium">{selectedStudentForDisciplinary.nome}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Matrícula:</span>
                  <span className="font-medium">{selectedStudentForDisciplinary.matricula || "Não informada"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Turma:</span>
                  <span className="font-medium">{getTurmaNome(selectedStudentForDisciplinary.turma)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="warning-reason">Motivo (opcional)</Label>
                <Textarea
                  id="warning-reason"
                  placeholder="Descreva o motivo da advertência..."
                  value={disciplinaryReason}
                  onChange={(e) => setDisciplinaryReason(e.target.value)}
                  rows={3}
                  data-testid="textarea-warning-reason"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setWarningDialogOpen(false);
                setSelectedStudentForDisciplinary(null);
                setDisciplinaryReason("");
              }}
              data-testid="button-cancel-warning"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => {
                if (selectedStudentForDisciplinary) {
                  applyWarningMutation.mutate({
                    student: selectedStudentForDisciplinary,
                    comentario: disciplinaryReason
                  });
                }
              }}
              disabled={applyWarningMutation.isPending}
              data-testid="button-confirm-warning"
            >
              {applyWarningMutation.isPending ? "Aplicando..." : "Aplicar Advertência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={suspensionDialogOpen} onOpenChange={setSuspensionDialogOpen}>
        <DialogContent data-testid="dialog-suspension">
          <DialogHeader>
            <DialogTitle>Aplicar Suspensão Disciplinar</DialogTitle>
            <DialogDescription>
              Você está prestes a aplicar uma suspensão disciplinar para <strong>{selectedStudentForDisciplinary?.nome}</strong>.
            </DialogDescription>
          </DialogHeader>
          
          {selectedStudentForDisciplinary && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nome:</span>
                  <span className="font-medium">{selectedStudentForDisciplinary.nome}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Matrícula:</span>
                  <span className="font-medium">{selectedStudentForDisciplinary.matricula || "Não informada"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Turma:</span>
                  <span className="font-medium">{getTurmaNome(selectedStudentForDisciplinary.turma)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="suspension-reason">Motivo (opcional)</Label>
                <Textarea
                  id="suspension-reason"
                  placeholder="Descreva o motivo da suspensão..."
                  value={disciplinaryReason}
                  onChange={(e) => setDisciplinaryReason(e.target.value)}
                  rows={3}
                  data-testid="textarea-suspension-reason"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSuspensionDialogOpen(false);
                setSelectedStudentForDisciplinary(null);
                setDisciplinaryReason("");
              }}
              data-testid="button-cancel-suspension"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (selectedStudentForDisciplinary) {
                  applySuspensionMutation.mutate({
                    student: selectedStudentForDisciplinary,
                    comentario: disciplinaryReason
                  });
                }
              }}
              disabled={applySuspensionMutation.isPending}
              data-testid="button-confirm-suspension"
            >
              {applySuspensionMutation.isPending ? "Aplicando..." : "Aplicar Suspensão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-history">
          <DialogHeader>
            <DialogTitle>Histórico de Advertências e Suspensões</DialogTitle>
            <DialogDescription>
              Histórico completo de ações disciplinares para <strong>{selectedStudentForHistory?.nome}</strong>
            </DialogDescription>
          </DialogHeader>
          
          {selectedStudentForHistory && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Matrícula:</span>
                  <span className="font-medium">{selectedStudentForHistory.matricula || "Não informada"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Turma:</span>
                  <span className="font-medium">{getTurmaNome(selectedStudentForHistory.turma)}</span>
                </div>
              </div>

              {disciplinaryActions
                ?.filter((action: any) => action.alunoId === selectedStudentForHistory.uid)
                .sort((a: any, b: any) => new Date(b.dataAplicacao).getTime() - new Date(a.dataAplicacao).getTime())
                .map((action: any) => {
                  const isActive = action.ativo === true;
                  const isSuspension = action.tipo === "suspensao";
                  const dataAplicacao = new Date(action.dataAplicacao);
                  const dataTermino = action.dataTerminoSuspensao ? new Date(action.dataTerminoSuspensao) : null;
                  const dataRemocao = action.dataRemocao ? new Date(action.dataRemocao) : null;

                  return (
                    <Card key={action.id} className={!isActive ? "opacity-60" : ""}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={isSuspension ? "destructive" : "outline"}
                              className={isSuspension ? "" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"}
                            >
                              {isSuspension ? "Suspensão" : "Advertência"}
                            </Badge>
                            {isActive ? (
                              <Badge variant="default">Ativa</Badge>
                            ) : (
                              <Badge variant="secondary">Removida</Badge>
                            )}
                          </div>
                          {isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Tem certeza que deseja remover esta ${isSuspension ? 'suspensão' : 'advertência'}?`)) {
                                  removeDisciplinaryActionMutation.mutate({
                                    actionId: action.id,
                                    tipo: action.tipo,
                                    alunoId: selectedStudentForHistory.uid
                                  });
                                }
                              }}
                              data-testid={`button-remove-action-${action.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remover
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Aplicada em:</p>
                            <p className="font-medium">
                              {dataAplicacao.toLocaleDateString('pt-BR')} às {dataAplicacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          {dataTermino && (
                            <div>
                              <p className="text-muted-foreground">Término da suspensão:</p>
                              <p className="font-medium">
                                {dataTermino.toLocaleDateString('pt-BR')} às {dataTermino.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <p className="text-muted-foreground text-sm">Aplicada por:</p>
                          <p className="font-medium">{action.aplicadoPorNome}</p>
                        </div>

                        {action.comentario && (
                          <div>
                            <p className="text-muted-foreground text-sm">Comentário:</p>
                            <p className="text-sm bg-muted p-2 rounded-md">{action.comentario}</p>
                          </div>
                        )}

                        {!isActive && dataRemocao && (
                          <div className="pt-2 border-t">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-muted-foreground">Removida em:</p>
                                <p className="font-medium">
                                  {dataRemocao.toLocaleDateString('pt-BR')} às {dataRemocao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Removida por:</p>
                                <p className="font-medium">{action.removidoPorNome}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

              {!disciplinaryActions?.some((action: any) => action.alunoId === selectedStudentForHistory.uid) && (
                <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Nenhum registro</p>
                  <p className="text-sm text-muted-foreground">
                    Este aluno não possui histórico de ações disciplinares
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setHistoryDialogOpen(false);
                setSelectedStudentForHistory(null);
              }}
              data-testid="button-close-history"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent data-testid="dialog-transfer-user">
          <DialogHeader>
            <DialogTitle>Transferir Aluno</DialogTitle>
            <DialogDescription>
              Transferir {userToTransfer?.nome} para outra turma
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-turma">Nova Turma</Label>
              <Select value={newTurma} onValueChange={setNewTurma}>
                <SelectTrigger id="new-turma" data-testid="select-new-turma">
                  <SelectValue placeholder="Selecione a turma" />
                </SelectTrigger>
                <SelectContent>
                  {turmas && turmas.length > 0 ? (
                    turmas
                      .filter(t => t.id !== userToTransfer?.turma)
                      .map((turma) => (
                        <SelectItem key={turma.id} value={turma.id}>
                          {turma.nome} - {turma.ano}
                        </SelectItem>
                      ))
                  ) : (
                    <SelectItem value="none" disabled>Nenhuma turma disponível</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTransferDialogOpen(false);
                setUserToTransfer(null);
                setNewTurma("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (userToTransfer && newTurma) {
                  transferUserMutation.mutate({
                    userId: userToTransfer.uid,
                    novaTurma: newTurma
                  });
                }
              }}
              disabled={transferUserMutation.isPending || !newTurma}
              data-testid="button-confirm-transfer"
            >
              {transferUserMutation.isPending ? "Transferindo..." : "Transferir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewTurmaStudentsDialogOpen} onOpenChange={setViewTurmaStudentsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="dialog-view-students">
          <DialogHeader>
            <DialogTitle>Alunos da Turma: {selectedTurmaForStudents?.nome}</DialogTitle>
            <DialogDescription>
              Visualize e gerencie os alunos matriculados nesta turma
            </DialogDescription>
          </DialogHeader>
          
          {selectedTurmaForStudents && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 p-4 bg-muted rounded-lg flex-wrap">
                <div>
                  <p className="text-sm text-muted-foreground">Total de alunos</p>
                  <p className="text-2xl font-bold">
                    {users?.filter(u => u.turma === selectedTurmaForStudents.id && u.tipo === "aluno").length || 0} / {selectedTurmaForStudents.vagasTotais}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vagas disponíveis</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {(selectedTurmaForStudents.vagasTotais || 0) - (users?.filter(u => u.turma === selectedTurmaForStudents.id && u.tipo === "aluno").length || 0)}
                  </p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setAddStudentsDialogOpen(true);
                  }}
                  data-testid="button-add-students"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Alunos
                </Button>
              </div>

              {selectedStudentsForBulkAction.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
                  <span className="text-sm font-medium">
                    {selectedStudentsForBulkAction.length} aluno(s) selecionado(s)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBulkTransferDialogOpen(true);
                      }}
                      data-testid="button-bulk-transfer"
                    >
                      <ArrowRightLeft className="h-4 w-4 mr-1" />
                      Transferir
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja remover ${selectedStudentsForBulkAction.length} aluno(s) da turma?`)) {
                          bulkRemoveStudentsMutation.mutate({ studentIds: selectedStudentsForBulkAction });
                        }
                      }}
                      data-testid="button-bulk-remove"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remover
                    </Button>
                  </div>
                </div>
              )}

              {users && users.filter(u => u.turma === selectedTurmaForStudents.id && u.tipo === "aluno").length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={
                              users.filter(u => u.turma === selectedTurmaForStudents.id && u.tipo === "aluno").length > 0 &&
                              users.filter(u => u.turma === selectedTurmaForStudents.id && u.tipo === "aluno").every(s => selectedStudentsForBulkAction.includes(s.uid))
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedStudentsForBulkAction(
                                  users.filter(u => u.turma === selectedTurmaForStudents.id && u.tipo === "aluno").map(s => s.uid)
                                );
                              } else {
                                setSelectedStudentsForBulkAction([]);
                              }
                            }}
                            data-testid="checkbox-select-all-students"
                          />
                        </TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Matrícula</TableHead>
                        <TableHead>Presença</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users
                        .filter(u => u.turma === selectedTurmaForStudents.id && u.tipo === "aluno")
                        .map((student) => (
                          <TableRow key={student.uid}>
                            <TableCell>
                              <Checkbox
                                checked={selectedStudentsForBulkAction.includes(student.uid)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedStudentsForBulkAction([...selectedStudentsForBulkAction, student.uid]);
                                  } else {
                                    setSelectedStudentsForBulkAction(selectedStudentsForBulkAction.filter(id => id !== student.uid));
                                  }
                                }}
                                data-testid={`checkbox-student-${student.uid}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{student.nome}</TableCell>
                            <TableCell>{student.email}</TableCell>
                            <TableCell>
                              <code className="text-xs">{student.matricula || "-"}</code>
                            </TableCell>
                            <TableCell>
                              <PresenceIndicator
                                isOnline={student.isOnline}
                                lastSeen={student.lastSeen}
                                lastActivity={student.lastActivity}
                                variant="icon"
                                showLabel={false}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setUserToTransfer(student);
                                    setTransferDialogOpen(true);
                                    setViewTurmaStudentsDialogOpen(false);
                                  }}
                                  data-testid={`button-transfer-student-${student.uid}`}
                                >
                                  <ArrowRightLeft className="h-4 w-4 mr-1" />
                                  Transferir
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm(`Tem certeza que deseja remover ${student.nome} da turma?`)) {
                                      removeStudentFromTurmaMutation.mutate({ userId: student.uid });
                                    }
                                  }}
                                  data-testid={`button-remove-student-${student.uid}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Remover
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
                  <Users className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Nenhum aluno nesta turma</p>
                  <p className="text-sm text-muted-foreground">
                    Adicione alunos transferindo de outras turmas ou criando novos cadastros
                  </p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setViewTurmaStudentsDialogOpen(false);
                setSelectedTurmaForStudents(null);
              }}
              data-testid="button-close-students-dialog"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addStudentsDialogOpen} onOpenChange={setAddStudentsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-add-students">
          <DialogHeader>
            <DialogTitle>Adicionar Alunos à Turma: {selectedTurmaForStudents?.nome}</DialogTitle>
            <DialogDescription>
              Selecione os alunos que deseja adicionar ou transferir para esta turma
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {users && users.filter(u => u.tipo === "aluno" && u.status === "aprovado").length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={
                            users.filter(u => u.tipo === "aluno" && u.status === "aprovado" && u.turma !== selectedTurmaForStudents?.id).length > 0 &&
                            users.filter(u => u.tipo === "aluno" && u.status === "aprovado" && u.turma !== selectedTurmaForStudents?.id).every(s => selectedStudentsToAdd.includes(s.uid))
                          }
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedStudentsToAdd(
                                users.filter(u => u.tipo === "aluno" && u.status === "aprovado" && u.turma !== selectedTurmaForStudents?.id).map(s => s.uid)
                              );
                            } else {
                              setSelectedStudentsToAdd([]);
                            }
                          }}
                          data-testid="checkbox-select-all-available"
                        />
                      </TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Turma Atual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users
                      .filter(u => u.tipo === "aluno" && u.status === "aprovado")
                      .sort((a, b) => a.nome.localeCompare(b.nome))
                      .map((student) => {
                        const isInCurrentTurma = student.turma === selectedTurmaForStudents?.id;
                        return (
                          <TableRow key={student.uid} className={isInCurrentTurma ? "opacity-50" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={selectedStudentsToAdd.includes(student.uid)}
                                disabled={isInCurrentTurma}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedStudentsToAdd([...selectedStudentsToAdd, student.uid]);
                                  } else {
                                    setSelectedStudentsToAdd(selectedStudentsToAdd.filter(id => id !== student.uid));
                                  }
                                }}
                                data-testid={`checkbox-add-student-${student.uid}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{student.nome}</TableCell>
                            <TableCell>{student.email}</TableCell>
                            <TableCell>
                              <code className="text-xs">{student.matricula || "-"}</code>
                            </TableCell>
                            <TableCell>
                              {isInCurrentTurma ? (
                                <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                                  Esta turma
                                </Badge>
                              ) : student.turma ? (
                                <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">
                                  {getTurmaNome(student.turma)}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">Sem turma</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
                <Users className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Nenhum aluno disponível</p>
                <p className="text-sm text-muted-foreground">
                  Não há alunos aprovados no sistema
                </p>
              </div>
            )}
            
            {selectedStudentsToAdd.length > 0 && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <span className="text-sm font-medium">
                  {selectedStudentsToAdd.length} aluno(s) selecionado(s)
                </span>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAddStudentsDialogOpen(false);
                setSelectedStudentsToAdd([]);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (selectedTurmaForStudents && selectedStudentsToAdd.length > 0) {
                  addStudentsToTurmaMutation.mutate({
                    studentIds: selectedStudentsToAdd,
                    turmaId: selectedTurmaForStudents.id
                  });
                }
              }}
              disabled={addStudentsToTurmaMutation.isPending || selectedStudentsToAdd.length === 0}
              data-testid="button-confirm-add-students"
            >
              {addStudentsToTurmaMutation.isPending ? "Adicionando..." : `Adicionar ${selectedStudentsToAdd.length} aluno(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editVagasDialogOpen} onOpenChange={setEditVagasDialogOpen}>
        <DialogContent data-testid="dialog-edit-vagas">
          <DialogHeader>
            <DialogTitle>Editar Quantidade de Vagas</DialogTitle>
            <DialogDescription>
              Turma: {selectedTurmaForVagas?.nome}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vagas-totais">Quantidade de Vagas</Label>
              <Input
                id="vagas-totais"
                type="number"
                min="1"
                value={novasVagas}
                onChange={(e) => setNovasVagas(parseInt(e.target.value) || 0)}
                data-testid="input-vagas-totais"
              />
              <p className="text-xs text-muted-foreground">
                Alunos atualmente matriculados: {users?.filter(u => u.turma === selectedTurmaForVagas?.id && u.tipo === "aluno").length || 0}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditVagasDialogOpen(false);
                setSelectedTurmaForVagas(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (selectedTurmaForVagas && novasVagas > 0) {
                  updateVagasTurmaMutation.mutate({
                    turmaId: selectedTurmaForVagas.id,
                    vagasTotais: novasVagas
                  });
                }
              }}
              disabled={updateVagasTurmaMutation.isPending || novasVagas < 1}
              data-testid="button-save-vagas"
            >
              {updateVagasTurmaMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={standbyDialogOpen} onOpenChange={setStandbyDialogOpen}>
        <DialogContent data-testid="dialog-standby-user">
          <DialogHeader>
            <DialogTitle>Colocar em Fila de Espera</DialogTitle>
            <DialogDescription>
              Você está colocando <strong>{userToStandby?.nome}</strong> em fila de espera (Stand By).
              Adicione um comentário explicando a situação (opcional).
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {userToStandby && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Matrícula:</span>
                  <code className="font-mono">{userToStandby.matricula}</code>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Email:</span>
                  <span>{userToStandby.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Turma:</span>
                  <span>{userToStandby.turma || "-"}</span>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="standby-comment">Comentário (opcional)</Label>
              <Textarea
                id="standby-comment"
                placeholder="Ex: Aguardando abertura de vagas na turma..."
                value={standbyComment}
                onChange={(e) => setStandbyComment(e.target.value)}
                rows={4}
                data-testid="textarea-standby-comment"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStandbyDialogOpen(false);
                setUserToStandby(null);
                setStandbyComment("");
              }}
              data-testid="button-cancel-standby"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (userToStandby) {
                  standbyUserMutation.mutate({ 
                    solicitacaoId: userToStandby.docId, 
                    comentario: standbyComment 
                  });
                }
              }}
              disabled={standbyUserMutation.isPending}
              data-testid="button-confirm-standby"
            >
              {standbyUserMutation.isPending ? "Processando..." : "Colocar em Stand By"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editSolicitacaoDialogOpen} onOpenChange={setEditSolicitacaoDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-solicitacao">
          <DialogHeader>
            <DialogTitle>Editar Solicitação</DialogTitle>
            <DialogDescription>
              Edite as informações da solicitação de <strong>{solicitacaoToEdit?.nome}</strong>
            </DialogDescription>
          </DialogHeader>
          
          {solicitacaoToEdit && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-nome">Nome Completo</Label>
                  <Input
                    id="edit-nome"
                    value={solicitacaoToEdit.nome || ""}
                    onChange={(e) => setSolicitacaoToEdit({ ...solicitacaoToEdit, nome: e.target.value })}
                    data-testid="input-edit-nome"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={solicitacaoToEdit.email || ""}
                    onChange={(e) => setSolicitacaoToEdit({ ...solicitacaoToEdit, email: e.target.value })}
                    data-testid="input-edit-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-cpf">CPF</Label>
                  <Input
                    id="edit-cpf"
                    value={solicitacaoToEdit.cpf || ""}
                    onChange={(e) => setSolicitacaoToEdit({ ...solicitacaoToEdit, cpf: e.target.value })}
                    data-testid="input-edit-cpf"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-data-nascimento">Data de Nascimento</Label>
                  <Input
                    id="edit-data-nascimento"
                    type="date"
                    value={solicitacaoToEdit.dataNascimento || ""}
                    onChange={(e) => setSolicitacaoToEdit({ ...solicitacaoToEdit, dataNascimento: e.target.value })}
                    data-testid="input-edit-data-nascimento"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-telefone">Telefone</Label>
                  <Input
                    id="edit-telefone"
                    value={solicitacaoToEdit.telefone || ""}
                    onChange={(e) => setSolicitacaoToEdit({ ...solicitacaoToEdit, telefone: e.target.value })}
                    data-testid="input-edit-telefone"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-turma">Turma</Label>
                  <Select
                    value={solicitacaoToEdit.turma || ""}
                    onValueChange={(value) => setSolicitacaoToEdit({ ...solicitacaoToEdit, turma: value })}
                  >
                    <SelectTrigger id="edit-turma" data-testid="select-edit-turma">
                      <SelectValue placeholder="Selecione a turma" />
                    </SelectTrigger>
                    <SelectContent>
                      {turmas?.map((turma) => (
                        <SelectItem key={turma.id} value={turma.nome}>
                          {turma.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditSolicitacaoDialogOpen(false);
                setSolicitacaoToEdit(null);
              }}
              data-testid="button-cancel-edit"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (solicitacaoToEdit) {
                  updateSolicitacaoMutation.mutate({ 
                    solicitacaoId: solicitacaoToEdit.docId, 
                    data: {
                      nome: solicitacaoToEdit.nome,
                      email: solicitacaoToEdit.email,
                      cpf: solicitacaoToEdit.cpf,
                      dataNascimento: solicitacaoToEdit.dataNascimento,
                      telefone: solicitacaoToEdit.telefone,
                      turma: solicitacaoToEdit.turma,
                    }
                  });
                }
              }}
              disabled={updateSolicitacaoMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {updateSolicitacaoMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkTransferDialogOpen} onOpenChange={setBulkTransferDialogOpen}>
        <DialogContent data-testid="dialog-bulk-transfer">
          <DialogHeader>
            <DialogTitle>Transferir Alunos em Lote</DialogTitle>
            <DialogDescription>
              Transferir {selectedStudentsForBulkAction.length} aluno(s) para outra turma
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-transfer-turma">Nova Turma</Label>
              <Select value={bulkTransferTurma} onValueChange={setBulkTransferTurma}>
                <SelectTrigger id="bulk-transfer-turma" data-testid="select-bulk-transfer-turma">
                  <SelectValue placeholder="Selecione a turma" />
                </SelectTrigger>
                <SelectContent>
                  {turmas && turmas.length > 0 ? (
                    turmas
                      .filter(t => t.id !== selectedTurmaForStudents?.id)
                      .map((turma) => (
                        <SelectItem key={turma.id} value={turma.id}>
                          {turma.nome} - {turma.ano} ({(turma.vagasTotais || 0) - (users?.filter(u => u.turma === turma.id).length || 0)} vagas disponíveis)
                        </SelectItem>
                      ))
                  ) : (
                    <SelectItem value="none" disabled>Nenhuma turma disponível</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBulkTransferDialogOpen(false);
                setBulkTransferTurma("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (selectedStudentsForBulkAction.length > 0 && bulkTransferTurma) {
                  bulkTransferStudentsMutation.mutate({
                    studentIds: selectedStudentsForBulkAction,
                    novaTurmaId: bulkTransferTurma
                  });
                }
              }}
              disabled={bulkTransferStudentsMutation.isPending || !bulkTransferTurma}
              data-testid="button-confirm-bulk-transfer"
            >
              {bulkTransferStudentsMutation.isPending ? "Transferindo..." : "Transferir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-maintenance">
          <DialogHeader>
            <DialogTitle>Iniciar Manutenção do Sistema</DialogTitle>
            <DialogDescription>
              Atenção: Ao iniciar uma manutenção, todos os usuários ficarão impossibilitados de acessar suas contas até que a manutenção seja finalizada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-orange-800 dark:text-orange-200">
                  <p className="font-semibold mb-1">Você realmente deseja iniciar uma manutenção no sistema agora?</p>
                  <p>Todos os usuários (exceto diretores) serão bloqueados e não poderão acessar o sistema durante este período.</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Tipo de Manutenção</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="tipo-determinada"
                    checked={maintenanceType === "determinada"}
                    onCheckedChange={() => setMaintenanceType("determinada")}
                    data-testid="checkbox-determinada"
                  />
                  <label
                    htmlFor="tipo-determinada"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Período Determinado
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="tipo-indeterminada"
                    checked={maintenanceType === "indeterminada"}
                    onCheckedChange={() => setMaintenanceType("indeterminada")}
                    data-testid="checkbox-indeterminada"
                  />
                  <label
                    htmlFor="tipo-indeterminada"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Período Indeterminado
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Data de Início</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={maintenanceStartDate}
                  onChange={(e) => setMaintenanceStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start-time">Horário de Início</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={maintenanceStartTime}
                  onChange={(e) => setMaintenanceStartTime(e.target.value)}
                  data-testid="input-start-time"
                />
              </div>
            </div>

            {maintenanceType === "determinada" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="end-date">Data de Término</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={maintenanceEndDate}
                    onChange={(e) => setMaintenanceEndDate(e.target.value)}
                    data-testid="input-end-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">Horário de Término</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={maintenanceEndTime}
                    onChange={(e) => setMaintenanceEndTime(e.target.value)}
                    data-testid="input-end-time"
                  />
                </div>
              </div>
            )}

            {maintenanceType === "indeterminada" && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Período indeterminado:</strong> Você poderá finalizar a manutenção a qualquer momento através do botão "Finalizar Manutenção" na aba de Manutenção.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMaintenanceDialogOpen(false);
                setMaintenanceStartDate("");
                setMaintenanceStartTime("");
                setMaintenanceEndDate("");
                setMaintenanceEndTime("");
                setMaintenanceType("determinada");
              }}
              data-testid="button-cancel-maintenance"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!maintenanceStartDate || !maintenanceStartTime) {
                  toast({
                    title: "Campos obrigatórios",
                    description: "Por favor, preencha a data e horário de início.",
                    variant: "destructive",
                  });
                  return;
                }

                if (maintenanceType === "determinada" && (!maintenanceEndDate || !maintenanceEndTime)) {
                  toast({
                    title: "Campos obrigatórios",
                    description: "Por favor, preencha a data e horário de término para manutenção determinada.",
                    variant: "destructive",
                  });
                  return;
                }

                // Converter horários de Brasília para UTC
                const dataInicio = brasiliaToUTC(maintenanceStartDate, maintenanceStartTime);
                const dataFim = maintenanceType === "determinada" 
                  ? brasiliaToUTC(maintenanceEndDate, maintenanceEndTime)
                  : undefined;

                iniciarManutencaoMutation.mutate({
                  tipo: maintenanceType,
                  dataInicio,
                  dataFim,
                });
              }}
              disabled={iniciarManutencaoMutation.isPending}
              data-testid="button-confirm-maintenance"
            >
              {iniciarManutencaoMutation.isPending ? "Iniciando..." : "Confirmar e Iniciar Manutenção"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editMaintenanceDialogOpen} onOpenChange={setEditMaintenanceDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-edit-maintenance">
          <DialogHeader>
            <DialogTitle>Editar Manutenção Ativa</DialogTitle>
            <DialogDescription>
              Altere as informações da manutenção em andamento. As mudanças serão aplicadas imediatamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">Atenção: Manutenção ativa</p>
                  <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                    As alterações serão aplicadas imediatamente à manutenção em andamento.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Manutenção</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-tipo-determinada"
                    checked={editMaintenanceType === "determinada"}
                    onCheckedChange={() => setEditMaintenanceType("determinada")}
                    data-testid="checkbox-edit-determinada"
                  />
                  <label
                    htmlFor="edit-tipo-determinada"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Período Determinado
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-tipo-indeterminada"
                    checked={editMaintenanceType === "indeterminada"}
                    onCheckedChange={() => setEditMaintenanceType("indeterminada")}
                    data-testid="checkbox-edit-indeterminada"
                  />
                  <label
                    htmlFor="edit-tipo-indeterminada"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Período Indeterminado
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start-date">Data de Início</Label>
                <Input
                  id="edit-start-date"
                  type="date"
                  value={editMaintenanceStartDate}
                  onChange={(e) => setEditMaintenanceStartDate(e.target.value)}
                  data-testid="input-edit-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-start-time">Horário de Início</Label>
                <Input
                  id="edit-start-time"
                  type="time"
                  value={editMaintenanceStartTime}
                  onChange={(e) => setEditMaintenanceStartTime(e.target.value)}
                  data-testid="input-edit-start-time"
                />
              </div>
            </div>

            {editMaintenanceType === "determinada" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-end-date">Data de Término</Label>
                  <Input
                    id="edit-end-date"
                    type="date"
                    value={editMaintenanceEndDate}
                    onChange={(e) => setEditMaintenanceEndDate(e.target.value)}
                    data-testid="input-edit-end-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end-time">Horário de Término</Label>
                  <Input
                    id="edit-end-time"
                    type="time"
                    value={editMaintenanceEndTime}
                    onChange={(e) => setEditMaintenanceEndTime(e.target.value)}
                    data-testid="input-edit-end-time"
                  />
                </div>
              </div>
            )}

            {editMaintenanceType === "indeterminada" && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Período indeterminado:</strong> A manutenção não terá data de término programada.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditMaintenanceDialogOpen(false);
                setEditingMaintenance(null);
              }}
              data-testid="button-cancel-edit-maintenance"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => {
                if (!editingMaintenance) return;

                if (!editMaintenanceStartDate || !editMaintenanceStartTime) {
                  toast({
                    title: "Campos obrigatórios",
                    description: "Por favor, preencha a data e horário de início.",
                    variant: "destructive",
                  });
                  return;
                }

                if (editMaintenanceType === "determinada" && (!editMaintenanceEndDate || !editMaintenanceEndTime)) {
                  toast({
                    title: "Campos obrigatórios",
                    description: "Por favor, preencha a data e horário de término para manutenção determinada.",
                    variant: "destructive",
                  });
                  return;
                }

                // Converter horários de Brasília para UTC
                const dataInicio = brasiliaToUTC(editMaintenanceStartDate, editMaintenanceStartTime);
                const dataFim = editMaintenanceType === "determinada" 
                  ? brasiliaToUTC(editMaintenanceEndDate, editMaintenanceEndTime)
                  : undefined;

                editarManutencaoMutation.mutate({
                  maintenanceId: editingMaintenance.id,
                  tipo: editMaintenanceType,
                  dataInicio,
                  dataFim,
                });
              }}
              disabled={editarManutencaoMutation.isPending}
              data-testid="button-confirm-edit-maintenance"
            >
              {editarManutencaoMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bloqueioDialogOpen} onOpenChange={setBloqueioDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-bloqueio">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Bloqueado: Justifique as Manutenções Anteriores
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-900 dark:text-red-100 font-medium">
                {manutencoesPendentes.length} manutenção(ões) sem justificativa. É obrigatório justificar todas antes de iniciar uma nova.
              </p>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {manutencoesPendentes.map((maintenance) => (
                <div
                  key={maintenance.id}
                  className="p-2 bg-muted rounded border border-red-200 dark:border-red-800 flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-1">
                      <Badge variant="destructive" className="text-xs">SEM JUSTIFICATIVA</Badge>
                      <Badge variant="outline" className="text-xs capitalize">{maintenance.tipo}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatBrasiliaDateTime(maintenance.dataInicio)} • {maintenance.iniciadoPorNome}
                    </p>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setMaintenanceToJustify(maintenance);
                      setJustificativaText("");
                      setBloqueioDialogOpen(false);
                      setJustificativaDialogOpen(true);
                    }}
                    data-testid={`button-justify-from-bloqueio-${maintenance.id}`}
                  >
                    Justificar
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBloqueioDialogOpen(false);
                setManutencoesPendentes([]);
              }}
              data-testid="button-close-bloqueio"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={justificativaDialogOpen} onOpenChange={setJustificativaDialogOpen}>
        <DialogContent className="max-w-3xl" data-testid="dialog-justificativa">
          <DialogHeader>
            <DialogTitle>Justificativa de Manutenção</DialogTitle>
            <DialogDescription>
              Adicione uma justificativa detalhada explicando todas as alterações realizadas durante a manutenção do sistema.
              Esta justificativa será arquivada permanentemente no histórico de auditoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">Justificativa Obrigatória</p>
                  <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                    É obrigatório justificar todas as manutenções realizadas no sistema. 
                    Descreva detalhadamente quais alterações foram feitas e por qual motivo.
                  </p>
                </div>
              </div>
            </div>

            {maintenanceToJustify && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tipo:</span>{" "}
                    <span className="font-medium capitalize">{maintenanceToJustify.tipo}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Iniciada por:</span>{" "}
                    <span className="font-medium">{maintenanceToJustify.iniciadoPorNome}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data de Início:</span>{" "}
                    <span className="font-medium">
                      {formatBrasiliaDateTime(maintenanceToJustify.dataInicio)}
                    </span>
                  </div>
                  {maintenanceToJustify.dataFinalizacao && (
                    <div>
                      <span className="text-muted-foreground">Data de Finalização:</span>{" "}
                      <span className="font-medium">
                        {formatBrasiliaDateTime(maintenanceToJustify.dataFinalizacao)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="justificativa-text">
                Justificativa das Alterações <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="justificativa-text"
                placeholder="Descreva detalhadamente todas as alterações realizadas no sistema durante esta manutenção. Exemplo: Atualização do módulo de cadastro de alunos, correção de bugs no sistema de notas e entregas, otimização do carregamento de turmas, ajustes no painel de advertências..."
                value={justificativaText}
                onChange={(e) => setJustificativaText(e.target.value)}
                rows={8}
                className="resize-none"
                data-testid="textarea-justificativa"
              />
              <p className="text-xs text-muted-foreground">
                Caracteres: {justificativaText.length}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setJustificativaDialogOpen(false);
                setMaintenanceToJustify(null);
                setJustificativaText("");
              }}
              data-testid="button-cancel-justificativa"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => {
                if (maintenanceToJustify) {
                  adicionarJustificativaMutation.mutate({
                    maintenanceId: maintenanceToJustify.id,
                    justificativa: justificativaText,
                  });
                }
              }}
              disabled={adicionarJustificativaMutation.isPending || !justificativaText.trim()}
              data-testid="button-save-justificativa"
            >
              {adicionarJustificativaMutation.isPending ? "Salvando..." : "Salvar Justificativa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmEndMaintenanceDialogOpen} onOpenChange={setConfirmEndMaintenanceDialogOpen}>
        <DialogContent data-testid="dialog-confirm-end-maintenance">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Finalização de Manutenção
            </DialogTitle>
            <DialogDescription>
              Você tem certeza que deseja finalizar a manutenção do sistema?
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg">
            <p className="text-sm text-orange-900 dark:text-orange-100">
              ⚠️ Ao finalizar a manutenção, todos os usuários poderão acessar o sistema novamente.
              Certifique-se de que todas as alterações necessárias foram concluídas e testadas.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmEndMaintenanceDialogOpen(false);
                setMaintenanceToEnd(null);
              }}
              data-testid="button-cancel-end-maintenance"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (maintenanceToEnd) {
                  finalizarManutencaoMutation.mutate(maintenanceToEnd);
                  setConfirmEndMaintenanceDialogOpen(false);
                  setMaintenanceToEnd(null);
                }
              }}
              disabled={finalizarManutencaoMutation.isPending}
              data-testid="button-confirm-end-maintenance"
            >
              {finalizarManutencaoMutation.isPending ? "Finalizando..." : "Sim, Finalizar Manutenção"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={auditHistoryDialogOpen} onOpenChange={setAuditHistoryDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[85vh] flex flex-col" data-testid="dialog-audit-history">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Archive className="h-5 w-5" />
              Histórico de Auditoria - Manutenções Arquivadas
            </DialogTitle>
            <DialogDescription>
              Registro permanente e imutável de todas as manutenções do sistema que foram justificadas e arquivadas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 pb-4 border-b">
            <Button
              type="button"
              variant="default"
              onClick={downloadAuditHistory}
              disabled={!maintenanceData || maintenanceData.filter(m => m.arquivada).length === 0}
              data-testid="button-download-audit-history"
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar Histórico Completo (PDF)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAuditHistoryDialogOpen(false)}
              data-testid="button-close-audit-history"
            >
              Fechar
            </Button>
          </div>

          <div className="space-y-2 overflow-y-auto flex-1">
            {maintenanceData && maintenanceData.filter(m => m.arquivada).length > 0 ? (
              <>
                <div className="p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-md">
                  <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                    Total: {maintenanceData.filter(m => m.arquivada).length} manutenção(ões) arquivada(s)
                  </p>
                </div>

                <div className="space-y-2.5">
                  {maintenanceData
                    .filter(m => m.arquivada)
                    .sort((a, b) => new Date(b.dataFinalizacao || b.dataAtivacao).getTime() - new Date(a.dataFinalizacao || a.dataAtivacao).getTime())
                    .map((maintenance, index) => {
                      const isExpanded = expandedJustificativas.has(maintenance.id || '');
                      
                      const colors = [
                        'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900',
                        'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900',
                        'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900',
                        'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900',
                        'bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-900',
                        'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-900',
                        'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900',
                        'bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900',
                      ];
                      const colorClass = colors[index % colors.length];
                      
                      return (
                        <div
                          key={maintenance.id}
                          className={`p-3 rounded-md border ${colorClass}`}
                          data-testid={`audit-record-${maintenance.id}`}
                        >
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="font-mono font-bold">#{maintenance.numeroManutencao || 'N/A'}</Badge>
                              <Badge variant="secondary">Arquivada</Badge>
                              <Badge variant="outline" className="capitalize">{maintenance.tipo}</Badge>
                            </div>
                            
                            {maintenance.justificativa && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleJustificativa(maintenance.id || '')}
                                className="h-7 text-xs"
                                data-testid={`button-toggle-justificativa-${maintenance.id}`}
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="h-3.5 w-3.5 mr-1" />
                                    Ocultar Justificativa
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3.5 w-3.5 mr-1" />
                                    Ver Justificativa
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Início:</span>{" "}
                              <span className="font-medium">
                                {formatBrasiliaDateTime(maintenance.dataInicio)}
                              </span>
                            </div>
                            
                            {maintenance.dataFim && (
                              <div>
                                <span className="text-muted-foreground">Fim Previsto:</span>{" "}
                                <span className="font-medium">
                                  {formatBrasiliaDateTime(maintenance.dataFim)}
                                </span>
                              </div>
                            )}
                            
                            <div>
                              <span className="text-muted-foreground">Iniciada por:</span>{" "}
                              <span className="font-medium">{maintenance.iniciadoPorNome}</span>
                            </div>
                            
                            {maintenance.dataFinalizacao && (
                              <div>
                                <span className="text-muted-foreground">Finalizada em:</span>{" "}
                                <span className="font-medium">
                                  {formatBrasiliaDateTime(maintenance.dataFinalizacao)}
                                </span>
                              </div>
                            )}
                            
                            {maintenance.finalizadoPorNome && (
                              <div>
                                <span className="text-muted-foreground">Finalizada por:</span>{" "}
                                <span className="font-medium">{maintenance.finalizadoPorNome}</span>
                              </div>
                            )}
                            
                            {maintenance.duracaoFormatada && (
                              <div>
                                <span className="text-muted-foreground">Duração:</span>{" "}
                                <span className="font-medium font-mono">{maintenance.duracaoFormatada}</span>
                              </div>
                            )}
                          </div>

                          {maintenance.justificativa && isExpanded && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <div className="space-y-2">
                                <div>
                                  <span className="text-muted-foreground font-medium block mb-1.5">Justificativa:</span>
                                  <div className="p-2.5 bg-background border border-border rounded-sm">
                                    <p className="text-sm whitespace-pre-wrap">{maintenance.justificativa}</p>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                                  {maintenance.justificadaPorNome && (
                                    <div>
                                      <span className="text-muted-foreground">Justificada por:</span>{" "}
                                      <span className="font-medium">{maintenance.justificadaPorNome}</span>
                                    </div>
                                  )}
                                  {maintenance.dataJustificativa && (
                                    <div>
                                      <span className="text-muted-foreground">Data:</span>{" "}
                                      <span className="font-medium">
                                        {formatBrasiliaDateTime(maintenance.dataJustificativa)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Archive className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Nenhuma manutenção arquivada</p>
                <p className="text-sm text-muted-foreground max-w-md">
                  Quando manutenções forem finalizadas, justificadas e arquivadas, elas aparecerão neste histórico permanente de auditoria.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
