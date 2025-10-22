import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { collection, addDoc, updateDoc, doc, where, setDoc, deleteDoc, getDoc, runTransaction } from "firebase/firestore";
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
import { LogOut, Plus, Users, BookOpen, GraduationCap, FileText, Edit, Trash2, CheckCircle, XCircle, RefreshCw, MessageCircle, ArrowRightLeft } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import type { User, Turma } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

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
  tipo: z.enum(["aluno", "professor", "admin"]).default("aluno"),
}).refine((data) => {
  if (data.tipo === "aluno" && !data.turma) {
    return false;
  }
  return true;
}, {
  message: "Turma é obrigatória para alunos",
  path: ["turma"],
});

const professorAdminFormSchema = z.object({
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
  tipo: z.enum(["professor", "admin"]),
  turmas: z.array(z.string()).optional(),
});

export default function AdminDashboard() {
  const { userData, signOut, refreshUserData } = useAuth();
  const { toast } = useToast();
  const [createTurmaDialogOpen, setCreateTurmaDialogOpen] = useState(false);
  const [createAlunoDialogOpen, setCreateAlunoDialogOpen] = useState(false);
  const [createProfessorAdminDialogOpen, setCreateProfessorAdminDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [userToReject, setUserToReject] = useState<any | null>(null);
  const [rejectComment, setRejectComment] = useState("");
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

  const professorAdminForm = useForm<z.infer<typeof professorAdminFormSchema>>({
    resolver: zodResolver(professorAdminFormSchema),
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

  const pendingUsers = solicitacoes?.map((sol: any) => ({
    ...sol,
    docId: sol.id
  }));
  
  const loadingPendingUsers = loadingSolicitacoes;

  const approveUserMutation = useMutation({
    mutationFn: async ({ solicitacaoId, senha }: { solicitacaoId: string; senha: string }) => {
      const solicitacaoDoc = await getDoc(doc(db, "solicitacoes", solicitacaoId));
      const solicitacao = solicitacaoDoc.data();
      
      if (!solicitacao) {
        throw new Error("Solicitação não encontrada");
      }
      
      let userId: string;
      let userAlreadyExists = false;
      
      try {
        const userCredential = await createUserWithEmailAndPassword(firebaseAuth, solicitacao.email, senha);
        userId = userCredential.user.uid;
        
        await setDoc(doc(db, "usuarios", userId), {
          uid: userId,
          nome: solicitacao.nome,
          email: solicitacao.email,
          tipo: solicitacao.tipo,
          turma: solicitacao.turma || "",
          ativo: true,
          status: "aprovado",
          matricula: solicitacao.matricula,
          dataSolicitacao: solicitacao.dataSolicitacao,
          dataAprovacao: new Date().toISOString(),
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
      } catch (error: any) {
        if (error.code === "auth/email-already-in-use") {
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
              dataAprovacao: new Date().toISOString(),
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
          } else {
            throw new Error("Usuário existe no Authentication mas não no Firestore. Por favor, remova a solicitação duplicada.");
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
          ? "O usuário foi aprovado e pode continuar usando a conta existente."
          : "O usuário agora pode fazer login com a senha definida.",
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
      
      const { getDocs, query, collection: firestoreCollection, where } = await import("firebase/firestore");
      const usersSnapshot = await getDocs(query(firestoreCollection(db, "usuarios"), where("email", "==", solicitacao.email)));
      
      if (!usersSnapshot.empty) {
        const userId = usersSnapshot.docs[0].id;
        
        await setDoc(doc(db, "reprovacoes", userId), {
          email: solicitacao.email,
          nome: solicitacao.nome,
          comentario: comentario || "Sua solicitação foi reprovada pelo administrador.",
          dataReprovacao: new Date().toISOString(),
          matricula: solicitacao.matricula,
        });
        
        await deleteDoc(doc(db, "usuarios", userId));
      } else {
        await setDoc(doc(db, "reprovacoes", solicitacao.email.replace(/[.@]/g, "_")), {
          email: solicitacao.email,
          nome: solicitacao.nome,
          comentario: comentario || "Sua solicitação foi reprovada pelo administrador.",
          dataReprovacao: new Date().toISOString(),
          matricula: solicitacao.matricula,
        });
      }
      
      await deleteDoc(doc(db, "solicitacoes", solicitacaoId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitacoes"] });
      setRejectDialogOpen(false);
      setUserToReject(null);
      setRejectComment("");
      toast({
        title: "Solicitação rejeitada",
        description: "O usuário foi notificado sobre a reprovação.",
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
        description: "O status do usuário foi alterado.",
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
      
      return userCredential.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios/all"] });
      toast({
        title: "Usuário criado com sucesso!",
        description: "O usuário pode acessar a plataforma.",
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
        title: "Erro ao criar usuário",
        description: message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (user: any) => {
      if (user.tipo === "admin" && user.status === "aprovado") {
        throw new Error("Não é permitido excluir administradores ativos");
      }
      const docId = user.docId || user.uid || user.id;
      if (!docId) {
        throw new Error("ID do documento não encontrado");
      }
      await deleteDoc(doc(db, "usuarios", docId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios/all"] });
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

  const createProfessorAdminMutation = useMutation({
    mutationFn: async (data: z.infer<typeof professorAdminFormSchema>) => {
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

      // Criar usuário no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, data.email, data.senha);
      
      // Criar documento do usuário
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
        dataCriacao: new Date().toISOString(),
      });
      
      return { user: userCredential.user, matricula: novaMatricula };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      toast({
        title: "Conta criada com sucesso!",
        description: `Matrícula gerada: ${data.matricula}`,
      });
      setCreateProfessorAdminDialogOpen(false);
      professorAdminForm.reset();
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
      await updateDoc(userRef, { turma: novaTurma });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
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

  // Funções auxiliares
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
          professorAdminForm.setValue('rua', data.logradouro || '');
          professorAdminForm.setValue('bairro', data.bairro || '');
          professorAdminForm.setValue('cidade', data.localidade || '');
          professorAdminForm.setValue('estado', data.uf || '');
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
              <p className="text-xs text-muted-foreground font-medium">Painel do Administrador</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right mr-2 hidden sm:block">
              <p className="text-sm font-semibold">{userData?.nome}</p>
              <p className="text-xs text-muted-foreground">Administrador</p>
            </div>
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
            Painel Administrativo
          </h2>
          <p className="text-muted-foreground text-lg">Gerencie usuários, turmas e acompanhe estatísticas</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5 hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold">Total de Usuários</CardTitle>
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
            <TabsTrigger value="usuarios" data-testid="tab-usuarios">Usuários</TabsTrigger>
            <TabsTrigger value="turmas" data-testid="tab-turmas">Turmas</TabsTrigger>
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
                            <TableCell>{user.turma || "-"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {user.dataSolicitacao 
                                ? new Date(user.dataSolicitacao).toLocaleDateString('pt-BR')
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => {
                                    setSolicitacaoToApprove(user);
                                    setApproveDialogOpen(true);
                                  }}
                                  disabled={approveUserMutation.isPending || rejectUserMutation.isPending}
                                  data-testid="button-approve"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Aprovar
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    setUserToReject(user);
                                    setRejectDialogOpen(true);
                                  }}
                                  disabled={approveUserMutation.isPending || rejectUserMutation.isPending}
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
              <h3 className="text-xl font-semibold">Gerenciar Usuários</h3>
              <div className="flex gap-2">
                <Button onClick={() => setCreateAlunoDialogOpen(true)} variant="outline" data-testid="button-create-user">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Aluno
                </Button>
                <Button onClick={() => setCreateProfessorAdminDialogOpen(true)} data-testid="button-create-professor-admin">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Professor/Admin
                </Button>
              </div>
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
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.uid} data-testid={`row-user-${user.uid}`}>
                            <TableCell className="font-medium">{user.nome}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant={
                                user.tipo === "admin" ? "default" : 
                                user.tipo === "professor" ? "secondary" : "outline"
                              }>
                                {user.tipo}
                              </Badge>
                            </TableCell>
                            <TableCell>{user.turma || "-"}</TableCell>
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
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
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
                                {user.tipo !== "admin" && (
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
                    <p className="text-lg font-medium mb-2">Nenhum usuário cadastrado</p>
                    <p className="text-sm text-muted-foreground">Novos usuários devem se cadastrar na tela de login e aguardar aprovação</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="turmas" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">Gerenciar Turmas</h3>
              <Button onClick={() => setCreateTurmaDialogOpen(true)} data-testid="button-create-turma">
                <Plus className="h-4 w-4 mr-2" />
                Nova Turma
              </Button>
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
                  const alunosTurma = users?.filter(u => u.turma === turma.nome).length || 0;
                  const vagasDisponiveis = (turma.vagasTotais || 0) - alunosTurma;
                  
                  return (
                    <Card key={turma.id} className="hover-elevate" data-testid={`card-turma-${turma.id}`}>
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
                          {turma.ativa ? (
                            <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Aberta
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                              Fechada
                            </Badge>
                          )}
                          {vagasDisponiveis > 0 ? (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              {vagasDisponiveis} vagas disponíveis
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                              Sem vagas
                            </Badge>
                          )}
                        </div>

                        {turma.periodoMatriculaInicio && turma.periodoMatriculaFim && (
                          <div className="text-xs text-muted-foreground">
                            Matrículas: {new Date(turma.periodoMatriculaInicio).toLocaleDateString('pt-BR')} até {new Date(turma.periodoMatriculaFim).toLocaleDateString('pt-BR')}
                          </div>
                        )}

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

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent data-testid="dialog-approve-user">
          <DialogHeader>
            <DialogTitle>Aprovar Cadastro</DialogTitle>
            <DialogDescription>
              Defina uma senha inicial para <strong>{solicitacaoToApprove?.nome}</strong>.
              O usuário poderá fazer login com esta senha.
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
                Informe esta senha ao usuário após a aprovação.
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

      <Dialog open={createAlunoDialogOpen} onOpenChange={setCreateAlunoDialogOpen}>
        <DialogContent data-testid="dialog-create-user">
          <DialogHeader>
            <DialogTitle>Adicionar Usuário</DialogTitle>
            <DialogDescription>
              Crie um novo usuário com acesso imediato à plataforma
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
                      <Input placeholder="Nome do usuário" {...field} data-testid="input-user-nome" />
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
                        <SelectItem value="admin">Administrador</SelectItem>
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
                  {createAlunoMutation.isPending ? "Criando..." : "Criar Usuário"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={createProfessorAdminDialogOpen} onOpenChange={setCreateProfessorAdminDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-professor-admin">
          <DialogHeader>
            <DialogTitle>Criar Professor/Administrador</DialogTitle>
            <DialogDescription>
              Crie uma conta completa para professor ou administrador com acesso imediato
            </DialogDescription>
          </DialogHeader>

          <Form {...professorAdminForm}>
            <form onSubmit={professorAdminForm.handleSubmit((data) => createProfessorAdminMutation.mutate(data))} className="space-y-4">
              <FormField
                control={professorAdminForm.control}
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
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={professorAdminForm.control}
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
                  control={professorAdminForm.control}
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
                  control={professorAdminForm.control}
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
                  control={professorAdminForm.control}
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
                  control={professorAdminForm.control}
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
                  control={professorAdminForm.control}
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
                control={professorAdminForm.control}
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
                control={professorAdminForm.control}
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
                  control={professorAdminForm.control}
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
                  control={professorAdminForm.control}
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
                  control={professorAdminForm.control}
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
                  control={professorAdminForm.control}
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

              {professorAdminForm.watch('tipo') === 'professor' && (
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
                    setCreateProfessorAdminDialogOpen(false);
                    professorAdminForm.reset();
                    setDisponibilidadeHorario([]);
                    setTurmasSelecionadas([]);
                  }}
                  data-testid="button-cancel-prof"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createProfessorAdminMutation.isPending} data-testid="button-save-prof">
                  {createProfessorAdminMutation.isPending ? "Criando..." : "Criar Conta"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-user">
          <DialogHeader>
            <DialogTitle>Excluir Usuário</DialogTitle>
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
              {deleteUserMutation.isPending ? "Excluindo..." : "Excluir Usuário"}
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
                      .filter(t => t.nome !== userToTransfer?.turma)
                      .map((turma) => (
                        <SelectItem key={turma.id} value={turma.nome}>
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
    </div>
  );
}
