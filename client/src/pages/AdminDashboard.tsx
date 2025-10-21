import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { collection, addDoc, updateDoc, doc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOut, Plus, Users, BookOpen, GraduationCap, FileText, Edit, Trash2, CheckCircle, XCircle } from "lucide-react";
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

export default function AdminDashboard() {
  const { userData, signOut, refreshUserData } = useAuth();
  const { toast } = useToast();
  const [createTurmaDialogOpen, setCreateTurmaDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const turmaForm = useForm<z.infer<typeof turmaFormSchema>>({
    resolver: zodResolver(turmaFormSchema),
    defaultValues: {
      nome: "",
      ano: new Date().getFullYear().toString(),
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

  const { data: allUsers } = useRealtimeQuery({
    collectionName: "usuarios",
    queryKey: ["/api/usuarios/all"],
  });

  const pendingUsers = allUsers?.filter((user: any) => user.status === "pendente").map((user: any) => ({
    ...user,
    docId: user.id
  }));
  
  const loadingPendingUsers = !allUsers;

  const approveUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const userRef = doc(db, "usuarios", userId);
      await updateDoc(userRef, { status: "aprovado" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios/pendentes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      toast({
        title: "Conta aprovada!",
        description: "O usuário agora pode acessar a plataforma.",
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
    mutationFn: async (userId: string) => {
      const userRef = doc(db, "usuarios", userId);
      await updateDoc(userRef, { status: "reprovado" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios/pendentes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/usuarios"] });
      toast({
        title: "Conta reprovada",
        description: "O usuário não poderá acessar a plataforma.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao reprovar conta",
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
              <Badge variant="secondary">{pendingUsers?.length || 0} pendente(s)</Badge>
            </div>

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
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Turma</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingUsers.map((user) => (
                          <TableRow key={user.uid} data-testid={`row-pending-${user.uid}`}>
                            <TableCell className="font-medium">{user.nome}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{user.tipo}</Badge>
                            </TableCell>
                            <TableCell>{user.turma || "-"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => approveUserMutation.mutate(user.docId)}
                                  disabled={approveUserMutation.isPending || rejectUserMutation.isPending}
                                  data-testid="button-approve"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Aprovar
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => rejectUserMutation.mutate(user.docId)}
                                  disabled={approveUserMutation.isPending || rejectUserMutation.isPending}
                                  data-testid="button-reject"
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reprovar
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
              <div className="text-sm text-muted-foreground">
                Novos usuários devem se cadastrar e aguardar aprovação
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
    </div>
  );
}
