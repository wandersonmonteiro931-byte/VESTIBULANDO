import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { collection, addDoc, updateDoc, doc, where, setDoc, deleteDoc, getDoc } from "firebase/firestore";
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
import { LogOut, Plus, Users, BookOpen, GraduationCap, FileText, Edit, Trash2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
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

export default function AdminDashboard() {
  const { userData, signOut, refreshUserData } = useAuth();
  const { toast } = useToast();
  const [createTurmaDialogOpen, setCreateTurmaDialogOpen] = useState(false);
  const [createAlunoDialogOpen, setCreateAlunoDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [userToReject, setUserToReject] = useState<any | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [solicitacaoToApprove, setSolicitacaoToApprove] = useState<any | null>(null);
  const [senhaInicial, setSenhaInicial] = useState("");

  const turmaForm = useForm<z.infer<typeof turmaFormSchema>>({
    resolver: zodResolver(turmaFormSchema),
    defaultValues: {
      nome: "",
      ano: new Date().getFullYear().toString(),
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
        const signInMethods = await fetchSignInMethodsForEmail(firebaseAuth, solicitacao.email);
        userAlreadyExists = signInMethods.length > 0;
      } catch (error) {
        console.error("Erro ao verificar email:", error);
      }
      
      if (userAlreadyExists) {
        const usersSnapshot = await import("firebase/firestore").then(m => 
          m.getDocs(m.query(m.collection(db, "usuarios"), m.where("email", "==", solicitacao.email)))
        );
        
        if (!usersSnapshot.empty) {
          userId = usersSnapshot.docs[0].id;
          
          await updateDoc(doc(db, "usuarios", userId), {
            nome: solicitacao.nome,
            tipo: solicitacao.tipo,
            turma: solicitacao.turma || "",
            ativo: true,
            status: "aprovado",
            codigoSolicitacao: solicitacao.codigoSolicitacao,
            dataSolicitacao: solicitacao.dataSolicitacao,
            dataAprovacao: new Date().toISOString(),
          });
        } else {
          throw new Error("Usuário existe no Authentication mas não no Firestore. Entre em contato com o suporte.");
        }
      } else {
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
          codigoSolicitacao: solicitacao.codigoSolicitacao,
          dataSolicitacao: solicitacao.dataSolicitacao,
          dataAprovacao: new Date().toISOString(),
        });
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
      await deleteDoc(doc(db, "solicitacoes", solicitacaoId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitacoes"] });
      setRejectDialogOpen(false);
      setUserToReject(null);
      setRejectComment("");
      toast({
        title: "Solicitação rejeitada",
        description: "A solicitação foi removida.",
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
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">ENEM+</h1>
              <p className="text-xs text-muted-foreground">Painel do Administrador</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-right mr-4 hidden sm:block">
              <p className="text-sm font-medium">{userData?.nome}</p>
              <p className="text-xs text-muted-foreground">Administrador</p>
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
          <h2 className="text-3xl font-semibold mb-2">Painel Administrativo</h2>
          <p className="text-muted-foreground">Gerencie usuários, turmas e acompanhe estatísticas</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-users">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                {stats.alunos} alunos, {stats.professores} professores
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Turmas</CardTitle>
              <BookOpen className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-turmas">{stats.turmas}</div>
              <p className="text-xs text-muted-foreground">Turmas ativas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Atividades</CardTitle>
              <FileText className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-atividades">{stats.tarefas}</div>
              <p className="text-xs text-muted-foreground">{stats.entregas} entregas</p>
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
                          <TableHead>Código</TableHead>
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
                                {user.codigoSolicitacao || "N/A"}
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
              <Button onClick={() => setCreateAlunoDialogOpen(true)} data-testid="button-create-user">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Usuário
              </Button>
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
                  
                  return (
                    <Card key={turma.id} className="hover-elevate" data-testid={`card-turma-${turma.id}`}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>{turma.nome}</span>
                          <Badge variant="outline">{turma.ano}</Badge>
                        </CardTitle>
                        <CardDescription>
                          {alunosTurma} {alunosTurma === 1 ? "aluno" : "alunos"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          {turma.ativa ? (
                            <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Ativa
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                              Inativa
                            </Badge>
                          )}
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
              <FormField
                control={turmaForm.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Turma</FormLabel>
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
                    <FormLabel>Ano</FormLabel>
                    <FormControl>
                      <Input placeholder="2025" {...field} data-testid="input-ano" />
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
    </div>
  );
}
