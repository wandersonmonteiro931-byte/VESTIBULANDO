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
import type { User, LoginHistory, Tarefa, Entrega, DisciplinaryAction } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "@assets/Blue and White Online School Logo (1)_1761189954480.png";
import assinaturaUrl from "@assets/image_1761190362373.png";

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

  const { data: disciplinaryActions } = useRealtimeQuery<DisciplinaryAction>({
    collectionName: "disciplinaryActions",
    queryKey: ["/api/disciplinaryActions/all"],
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

  const userDisciplinary = useMemo(() => {
    if (!selectedUser || !disciplinaryActions) return [];
    return disciplinaryActions.filter(d => d.alunoId === selectedUser.uid && d.ativo);
  }, [selectedUser, disciplinaryActions]);

  // Verificar se pode ver a foto
  const canViewPhoto = (user: User) => {
    if (!user.fotoBase64) return false;
    if (user.fotoPublica) return true;
    return currentUser?.tipo === "diretor";
  };

  // Gerar PDF
  const generatePDF = async () => {
    if (!selectedUser) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    let yPos = 15;

    // Adicionar logo da escola no topo
    try {
      const logoImg = new Image();
      logoImg.src = logoUrl;
      await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = resolve;
      });
      doc.addImage(logoImg, "PNG", pageWidth / 2 - 30, yPos, 60, 20);
      yPos += 25;
    } catch (error) {
      console.error("Erro ao carregar logo:", error);
      yPos += 5;
    }

    // Título do documento
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("DOCUMENTAÇÃO DO ALUNO", pageWidth / 2, yPos, { align: "center" });
    yPos += 10;

    // Adicionar foto 3x4 do aluno (canto superior direito)
    if (selectedUser.fotoBase64 && canViewPhoto(selectedUser)) {
      try {
        // Detectar formato da imagem (PNG ou JPEG)
        let imageFormat = "JPEG";
        if (selectedUser.fotoBase64.startsWith("data:image/png")) {
          imageFormat = "PNG";
        } else if (selectedUser.fotoBase64.startsWith("data:image/jpeg") || selectedUser.fotoBase64.startsWith("data:image/jpg")) {
          imageFormat = "JPEG";
        }
        doc.addImage(selectedUser.fotoBase64, imageFormat, pageWidth - margin - 30, yPos, 25, 33);
      } catch (error) {
        console.error("Erro ao adicionar foto:", error);
      }
    }

    // SEÇÃO 1: DADOS PESSOAIS
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS PESSOAIS", margin, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    const dadosPessoais = [
      ["Nome Completo", selectedUser.nome || ""],
      ["CPF", selectedUser.cpf || ""],
      ["Data de Nascimento", selectedUser.dataNascimento || ""],
      ["Email", selectedUser.email || ""],
      ["Telefone (WhatsApp)", selectedUser.telefone || ""],
      ["Escolaridade", selectedUser.escolaridade || ""],
    ];

    autoTable(doc, {
      startY: yPos,
      body: dadosPessoais,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 50 },
        1: { cellWidth: 110 },
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;

    // SEÇÃO 2: ENDEREÇO
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("ENDEREÇO", margin, yPos);
    yPos += 7;

    const dadosEndereco = [
      ["CEP", selectedUser.cep || ""],
      ["Rua", selectedUser.rua || ""],
      ["Bairro", selectedUser.bairro || ""],
      ["Cidade", selectedUser.cidade || ""],
      ["Estado", selectedUser.estado || ""],
    ];

    autoTable(doc, {
      startY: yPos,
      body: dadosEndereco,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 50 },
        1: { cellWidth: 110 },
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;

    // SEÇÃO 3: INFORMAÇÕES ACADÊMICAS
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("INFORMAÇÕES ACADÊMICAS", margin, yPos);
    yPos += 7;

    const dataMatricula = selectedUser.dataSolicitacao 
      ? new Date(selectedUser.dataSolicitacao).toLocaleDateString('pt-BR')
      : "";

    const diasEstudo = selectedUser.disponibilidade && selectedUser.disponibilidade.length > 0
      ? selectedUser.disponibilidade.join(", ")
      : "";

    const dadosAcademicos = [
      ["Número de Matrícula", selectedUser.matricula || ""],
      ["Data de Início da Matrícula", dataMatricula],
      ["Turma", selectedUser.turma || ""],
      ["Dias de Estudo", diasEstudo],
    ];

    autoTable(doc, {
      startY: yPos,
      body: dadosAcademicos,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 50 },
        1: { cellWidth: 110 },
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;

    // SEÇÃO 4: HISTÓRICO DE PRESENÇA
    doc.addPage();
    yPos = 20;
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("HISTÓRICO DE PRESENÇA", margin, yPos);
    yPos += 7;

    const totalLogins = userHistory.filter(h => h.action === "login").length;
    const historicoPresenca = userHistory.length > 0
      ? userHistory.slice(0, 30).map(h => [
          h.action === "login" ? "Presente" : "Saída",
          formatBrasiliaTime(h.timestamp),
        ])
      : [["", ""]];

    autoTable(doc, {
      startY: yPos,
      head: [["Status", "Data/Hora"]],
      body: historicoPresenca,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 98, 255], fontSize: 9 },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Total de Presenças: ${totalLogins}`, margin, yPos);

    // SEÇÃO 5: BOLETIM (NOTAS)
    doc.addPage();
    yPos = 20;
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("BOLETIM - NOTAS E AVALIAÇÕES", margin, yPos);
    yPos += 7;

    const boletimData = userEntregas.length > 0
      ? userEntregas.map(e => [
          e.tarefaTitulo,
          formatBrasiliaTime(e.dataEnvio).split(" ")[0],
          e.nota !== undefined ? e.nota.toFixed(1) : "",
          e.status,
        ])
      : [["", "", "", ""]];

    autoTable(doc, {
      startY: yPos,
      head: [["Tarefa/Avaliação", "Data", "Nota", "Status"]],
      body: boletimData,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 98, 255], fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 30 },
        2: { cellWidth: 20 },
        3: { cellWidth: 30 },
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;

    // Calcular média
    const notasValidas = userEntregas.filter(e => e.nota !== undefined).map(e => e.nota as number);
    const media = notasValidas.length > 0
      ? (notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length).toFixed(2)
      : "";

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Média Geral: ${media}`, margin, yPos);

    // SEÇÃO 6: ADVERTÊNCIAS E SUSPENSÕES
    doc.addPage();
    yPos = 20;
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("ADVERTÊNCIAS E SUSPENSÕES", margin, yPos);
    yPos += 7;

    const disciplinaryData = userDisciplinary.length > 0
      ? userDisciplinary.map(d => [
          d.tipo === "advertencia" ? "Advertência" : "Suspensão",
          formatBrasiliaTime(d.dataAplicacao).split(" ")[0],
          d.comentario || "",
          d.aplicadoPorNome || "",
        ])
      : [["", "", "", ""]];

    autoTable(doc, {
      startY: yPos,
      head: [["Tipo", "Data", "Motivo", "Aplicado Por"]],
      body: disciplinaryData,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [220, 53, 69], fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 30 },
        2: { cellWidth: 80 },
        3: { cellWidth: 40 },
      },
      margin: { left: margin, right: margin },
    });

    // ASSINATURA DO DIRETOR (no final da última página)
    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Adicionar assinatura/carimbo
    try {
      const assinaturaImg = new Image();
      assinaturaImg.src = assinaturaUrl;
      await new Promise((resolve) => {
        assinaturaImg.onload = resolve;
        assinaturaImg.onerror = resolve;
      });
      doc.addImage(assinaturaImg, "PNG", pageWidth / 2 - 45, yPos, 90, 30);
    } catch (error) {
      console.error("Erro ao carregar assinatura:", error);
    }

    // Salvar PDF
    const fileName = `Documentacao_Aluno_${selectedUser.nome.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
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
