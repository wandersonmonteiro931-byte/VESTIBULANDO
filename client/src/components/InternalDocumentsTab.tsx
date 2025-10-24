import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText, Search, Download, RefreshCw, CheckCircle } from "lucide-react";
import { formatBrasiliaDateTime } from "@/lib/brasiliaTime";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ChatTermsAcceptance {
  uid: string;
  nome: string;
  cpf: string;
  turma?: string;
  tipo: string;
  email: string;
  chatTermsAcceptedDate: string;
  matricula?: string;
}

export function InternalDocumentsTab() {
  const [acceptances, setAcceptances] = useState<ChatTermsAcceptance[]>([]);
  const [filteredAcceptances, setFilteredAcceptances] = useState<ChatTermsAcceptance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const loadAcceptances = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, "usuarios");
      const q = query(
        usersRef,
        where("chatTermsAccepted", "==", true)
      );
      
      const snapshot = await getDocs(q);
      const data: ChatTermsAcceptance[] = [];
      
      snapshot.forEach((doc) => {
        const user = doc.data();
        if (user.chatTermsAcceptedDate) {
          data.push({
            uid: doc.id,
            nome: user.nome || "N/A",
            cpf: user.cpf || "N/A",
            turma: user.turma || "N/A",
            tipo: user.tipo || "N/A",
            email: user.email || "N/A",
            chatTermsAcceptedDate: user.chatTermsAcceptedDate,
            matricula: user.matricula || "N/A",
          });
        }
      });
      
      // Ordenar por data de aceitação (mais recentes primeiro)
      data.sort((a, b) => {
        const dateA = new Date(a.chatTermsAcceptedDate).getTime();
        const dateB = new Date(b.chatTermsAcceptedDate).getTime();
        return dateB - dateA;
      });
      
      setAcceptances(data);
      setFilteredAcceptances(data);
    } catch (error) {
      console.error("Erro ao carregar aceitações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os registros de aceitação.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAcceptances();
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredAcceptances(acceptances);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = acceptances.filter((acceptance) => {
      return (
        acceptance.nome.toLowerCase().includes(term) ||
        acceptance.cpf.toLowerCase().includes(term) ||
        acceptance.email.toLowerCase().includes(term) ||
        acceptance.turma?.toLowerCase().includes(term) ||
        acceptance.matricula?.toLowerCase().includes(term)
      );
    });
    
    setFilteredAcceptances(filtered);
  }, [searchTerm, acceptances]);

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(16);
    doc.text("REGISTRO DE ACEITAÇÃO DOS TERMOS DE USO DO CHAT", 14, 15);
    
    doc.setFontSize(11);
    doc.text("Plataforma Preparatório Vestibulando", 14, 22);
    doc.text(`Gerado em: ${formatBrasiliaDateTime(new Date().toISOString())}`, 14, 28);
    doc.text(`Total de registros: ${filteredAcceptances.length}`, 14, 34);
    
    // Tabela
    const tableData = filteredAcceptances.map((acceptance, index) => [
      (index + 1).toString(),
      acceptance.nome,
      acceptance.cpf,
      acceptance.tipo === "diretor" ? "Diretoria" : acceptance.turma || "N/A",
      acceptance.tipo.charAt(0).toUpperCase() + acceptance.tipo.slice(1),
      formatBrasiliaDateTime(acceptance.chatTermsAcceptedDate),
    ]);

    autoTable(doc, {
      startY: 40,
      head: [["#", "Nome", "CPF", "Turma", "Tipo", "Data/Hora de Aceitação"]],
      body: tableData,
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    
    // Rodapé
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Página ${i} de ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }
    
    doc.save(`termos-chat-aceitos-${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "PDF Gerado",
      description: "O relatório foi baixado com sucesso.",
    });
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case "aluno":
        return "Aluno";
      case "professor":
        return "Professor";
      case "diretor":
        return "Diretor";
      default:
        return tipo;
    }
  };

  const getTipoVariant = (tipo: string): "default" | "secondary" | "outline" => {
    switch (tipo) {
      case "aluno":
        return "default";
      case "professor":
        return "secondary";
      case "diretor":
        return "outline";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentos Internos
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Registros de aceitação dos termos de uso do chat
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {filteredAcceptances.length} registro(s)
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAcceptances}
            data-testid="button-refresh-acceptances"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={exportToPDF}
            disabled={filteredAcceptances.length === 0}
            data-testid="button-export-pdf"
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            Termos de Uso do Chat - Aceitações
          </CardTitle>
          <CardDescription>
            Registro completo de usuários que concordaram com os termos de utilização do chat da plataforma.
            Todos os dados são armazenados de forma segura para fins de auditoria e compliance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF, email, turma ou matrícula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-acceptances"
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredAcceptances.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? (
                <>
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum registro encontrado com "{searchTerm}"</p>
                </>
              ) : (
                <>
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum usuário aceitou os termos do chat ainda</p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Data/Hora de Aceitação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAcceptances.map((acceptance, index) => (
                    <TableRow key={acceptance.uid} data-testid={`row-acceptance-${acceptance.uid}`}>
                      <TableCell className="font-medium text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-name-${acceptance.uid}`}>
                        {acceptance.nome}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {acceptance.cpf}
                        </code>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {acceptance.matricula || "N/A"}
                        </code>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {acceptance.tipo === "diretor" ? "Diretoria" : acceptance.turma || "N/A"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getTipoVariant(acceptance.tipo)}>
                          {getTipoLabel(acceptance.tipo)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {acceptance.email}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-mono">
                            {formatBrasiliaDateTime(acceptance.chatTermsAcceptedDate)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <CardHeader>
          <CardTitle className="text-sm">ℹ️ Informações Importantes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Finalidade:</strong> Este registro documenta formalmente a aceitação dos termos de uso do chat por cada usuário da plataforma.
          </p>
          <p>
            <strong>Segurança:</strong> Todos os dados são armazenados de forma criptografada e seguem as normas da LGPD (Lei nº 13.709/2018).
          </p>
          <p>
            <strong>Auditoria:</strong> Os registros são permanentes e podem ser utilizados para fins de auditoria, investigação administrativa ou legal.
          </p>
          <p>
            <strong>Exportação:</strong> É possível exportar os dados em formato PDF para arquivamento ou apresentação formal.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
