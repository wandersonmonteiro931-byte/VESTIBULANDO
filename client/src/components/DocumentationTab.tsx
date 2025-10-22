import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, FileText, Download, User as UserIcon, GraduationCap, BookOpen, Calendar, Phone, MapPin, Clock } from "lucide-react";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useAuth } from "@/contexts/AuthContext";
import type { User, LoginHistory, Tarefa, Entrega } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function DocumentationTab() {
  const { userData: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const { data: users, isLoading } = useRealtimeQuery<User>({
    collectionName: "usuarios",
    queryKey: ["/api/usuarios/documentation"],
  });

  const { data: loginHistoryData } = useRealtimeQuery<LoginHistory>({
    collectionName: "loginHistory",
    queryKey: ["/api/loginHistory/all"],
  });

  const { data: tarefas } = useRealtimeQuery<Tarefa>({
    collectionName: "tarefas",
    queryKey: ["/api/tarefas/all"],
  });

  const { data: entregas } = useRealtimeQuery<Entrega>({
    collectionName: "entregas",
    queryKey: ["/api/entregas/all"],
  });

  // Função para converter para horário de Brasília
  const formatBrasiliaTime = (isoString: string | undefined) => {
    if (!isoString) return "N/A";
    
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(date);
    } catch {
      return "Data inválida";
    }
  };

  // Filtrar usuários
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    
    let filtered = users.filter(user => 
      user.status === "aprovado" && 
      user.tipo !== "diretor" // Não mostrar diretores
    );

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user =>
        user.nome.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.matricula && user.matricula.includes(query))
      );
    }

    return filtered.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [users, searchQuery]);

  // Dados do usuário selecionado
  const userHistory = useMemo(() => {
    if (!selectedUser || !loginHistoryData) return [];
    return loginHistoryData
      .filter(h => h.userId === selectedUser.uid)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [selectedUser, loginHistoryData]);

  const userEntregas = useMemo(() => {
    if (!selectedUser || !entregas) return [];
    return entregas.filter(e => e.alunoId === selectedUser.uid);
  }, [selectedUser, entregas]);

  // Verificar se pode ver a foto
  const canViewPhoto = (user: User) => {
    if (!user.fotoBase64) return false;
    if (user.fotoPublica) return true;
    return currentUser?.tipo === "diretor";
  };

  // Gerar PDF
  const generatePDF = () => {
    if (!selectedUser) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let yPos = 20;

    // Título
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("DOCUMENTAÇÃO DO USUÁRIO", pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    // Dados Pessoais
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS PESSOAIS", margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const dadosPessoais = [
      ["Nome", selectedUser.nome],
      ["Email", selectedUser.email],
      ["Tipo", selectedUser.tipo === "aluno" ? "Aluno" : "Professor"],
      ["Matrícula", selectedUser.matricula || "N/A"],
      ["CPF", selectedUser.cpf || "N/A"],
      ["Data de Nascimento", selectedUser.dataNascimento || "N/A"],
      ["Telefone", selectedUser.telefone || "N/A"],
      ["Escolaridade", selectedUser.escolaridade || "N/A"],
    ];

    if (selectedUser.tipo === "aluno") {
      dadosPessoais.push(["Turma", selectedUser.turma || "N/A"]);
    }

    autoTable(doc, {
      startY: yPos,
      head: [["Campo", "Valor"]],
      body: dadosPessoais,
      theme: "grid",
      headStyles: { fillColor: [66, 66, 66] },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Endereço
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("ENDEREÇO", margin, yPos);
    yPos += 8;

    const dadosEndereco = [
      ["CEP", selectedUser.cep || "N/A"],
      ["Rua", selectedUser.rua || "N/A"],
      ["Bairro", selectedUser.bairro || "N/A"],
      ["Cidade", selectedUser.cidade || "N/A"],
      ["Estado", selectedUser.estado || "N/A"],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [["Campo", "Valor"]],
      body: dadosEndereco,
      theme: "grid",
      headStyles: { fillColor: [66, 66, 66] },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Histórico de Login/Logout
    if (userHistory.length > 0) {
      doc.addPage();
      yPos = 20;
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("HISTÓRICO DE ACESSO", margin, yPos);
      yPos += 8;

      const historyData = userHistory.slice(0, 50).map(h => [
        h.action === "login" ? "Login" : "Logout",
        formatBrasiliaTime(h.timestamp),
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["Ação", "Data/Hora (Brasília)"]],
        body: historyData,
        theme: "grid",
        headStyles: { fillColor: [66, 66, 66] },
        margin: { left: margin, right: margin },
      });
    }

    // Tarefas Entregues (se for aluno)
    if (selectedUser.tipo === "aluno" && userEntregas.length > 0) {
      doc.addPage();
      yPos = 20;
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("TAREFAS ENTREGUES", margin, yPos);
      yPos += 8;

      const entregasData = userEntregas.map(e => [
        e.tarefaTitulo,
        formatBrasiliaTime(e.dataEnvio),
        e.nota !== undefined ? e.nota.toString() : "Pendente",
        e.status,
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["Tarefa", "Data de Entrega", "Nota", "Status"]],
        body: entregasData,
        theme: "grid",
        headStyles: { fillColor: [66, 66, 66] },
        margin: { left: margin, right: margin },
      });
    }

    // Salvar PDF
    const fileName = `documentacao_${selectedUser.nome.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
    doc.save(fileName);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com pesquisa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentação de Usuários
          </CardTitle>
          <CardDescription>
            Visualize e exporte documentação completa de alunos e professores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, email ou matrícula..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-documentation"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de usuários */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usuários ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Foto</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.uid} data-testid={`row-doc-user-${user.uid}`}>
                      <TableCell>
                        <Avatar className="h-10 w-10">
                          {canViewPhoto(user) && (
                            <AvatarImage src={user.fotoBase64} alt={user.nome} />
                          )}
                          <AvatarFallback>
                            {user.nome.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{user.nome}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={user.tipo === "aluno" ? "default" : "secondary"}
                          className="no-default-hover-elevate no-default-active-elevate"
                        >
                          {user.tipo === "aluno" ? "Aluno" : "Professor"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {user.matricula || "-"}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedUser(user);
                            setDetailsDialogOpen(true);
                          }}
                          data-testid={`button-view-doc-${user.uid}`}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Ver Documentação
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de detalhes */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="dialog-user-documentation">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {canViewPhoto(selectedUser) && (
                      <AvatarImage src={selectedUser.fotoBase64} alt={selectedUser.nome} />
                    )}
                    <AvatarFallback>
                      {selectedUser.nome.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {selectedUser.nome}
                </DialogTitle>
                <DialogDescription>
                  Documentação completa e histórico de atividades
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="flex justify-end">
                  <Button onClick={generatePDF} data-testid="button-download-pdf">
                    <Download className="h-4 w-4 mr-2" />
                    Baixar PDF
                  </Button>
                </div>

                <Tabs defaultValue="personal" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="personal">Dados Pessoais</TabsTrigger>
                    <TabsTrigger value="address">Endereço</TabsTrigger>
                    <TabsTrigger value="history">Histórico</TabsTrigger>
                    {selectedUser.tipo === "aluno" && (
                      <TabsTrigger value="tasks">Tarefas</TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="personal" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <UserIcon className="h-5 w-5" />
                          Informações Pessoais
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Nome Completo</p>
                          <p className="font-medium">{selectedUser.nome}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Email</p>
                          <p className="font-medium">{selectedUser.email}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">CPF</p>
                          <p className="font-medium">{selectedUser.cpf || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Data de Nascimento</p>
                          <p className="font-medium">{selectedUser.dataNascimento || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Telefone</p>
                          <p className="font-medium">{selectedUser.telefone || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Escolaridade</p>
                          <p className="font-medium">{selectedUser.escolaridade || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Matrícula</p>
                          <p className="font-medium">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {selectedUser.matricula || "N/A"}
                            </code>
                          </p>
                        </div>
                        {selectedUser.tipo === "aluno" && (
                          <div>
                            <p className="text-sm text-muted-foreground">Turma</p>
                            <p className="font-medium">{selectedUser.turma || "Sem turma"}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="address" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          Endereço Residencial
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">CEP</p>
                          <p className="font-medium">{selectedUser.cep || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Rua</p>
                          <p className="font-medium">{selectedUser.rua || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Bairro</p>
                          <p className="font-medium">{selectedUser.bairro || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Cidade</p>
                          <p className="font-medium">{selectedUser.cidade || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Estado</p>
                          <p className="font-medium">{selectedUser.estado || "N/A"}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="history" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Clock className="h-5 w-5" />
                          Histórico de Login/Logout
                        </CardTitle>
                        <CardDescription>
                          Horários em fuso de Brasília (GMT-3)
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {userHistory.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            Nenhum registro de acesso encontrado
                          </p>
                        ) : (
                          <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Ação</TableHead>
                                  <TableHead>Data/Hora</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {userHistory.map((history, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell>
                                      <Badge variant={history.action === "login" ? "default" : "secondary"}>
                                        {history.action === "login" ? "Login" : "Logout"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{formatBrasiliaTime(history.timestamp)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {selectedUser.tipo === "aluno" && (
                    <TabsContent value="tasks" className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <BookOpen className="h-5 w-5" />
                            Tarefas Entregues
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {userEntregas.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                              Nenhuma tarefa entregue
                            </p>
                          ) : (
                            <div className="border rounded-lg overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Tarefa</TableHead>
                                    <TableHead>Data de Entrega</TableHead>
                                    <TableHead>Nota</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {userEntregas.map((entrega) => (
                                    <TableRow key={entrega.id}>
                                      <TableCell className="font-medium">{entrega.tarefaTitulo}</TableCell>
                                      <TableCell>{formatBrasiliaTime(entrega.dataEnvio)}</TableCell>
                                      <TableCell>
                                        {entrega.nota !== undefined ? (
                                          <Badge variant="default" className="no-default-hover-elevate no-default-active-elevate">
                                            {entrega.nota}/10
                                          </Badge>
                                        ) : (
                                          <span className="text-sm text-muted-foreground">Pendente</span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">
                                          {entrega.status}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
