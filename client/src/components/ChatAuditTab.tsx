import { useState } from "react";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { ChatMessage } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, MessageSquare } from "lucide-react";
import { orderBy, where } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function ChatAuditTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const { data: messages, isLoading } = useRealtimeQuery<ChatMessage>({
    collectionName: "chat_messages",
    queryKey: ["/api/chat/audit", selectedUser, dateFilter],
    constraints: [orderBy("timestamp", "desc")],
    transform: (docs) => docs as ChatMessage[],
  });

  const filteredMessages = messages?.filter((msg) => {
    const matchesSearch =
      msg.conteudo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.remetenteNome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.destinatarioNome.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesUser = true;
    if (selectedUser !== "all") {
      matchesUser = msg.remetenteId === selectedUser || msg.destinatarioId === selectedUser;
    }

    let matchesDate = true;
    if (dateFilter !== "all") {
      const msgDate = new Date(msg.timestamp);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - msgDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      switch (dateFilter) {
        case "today":
          matchesDate = diffDays <= 1;
          break;
        case "week":
          matchesDate = diffDays <= 7;
          break;
        case "month":
          matchesDate = diffDays <= 30;
          break;
      }
    }

    return matchesSearch && matchesUser && matchesDate;
  });

  const exportToPDF = () => {
    if (!filteredMessages || filteredMessages.length === 0) return;

    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("Relatório de Auditoria de Chat", 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Data de geração: ${new Date().toLocaleString("pt-BR")}`, 14, 22);
    doc.text(`Total de mensagens: ${filteredMessages.length}`, 14, 27);

    const tableData = filteredMessages.map((msg) => [
      new Date(msg.timestamp).toLocaleString("pt-BR"),
      msg.remetenteNome,
      msg.destinatarioNome,
      msg.conteudo.substring(0, 50) + (msg.conteudo.length > 50 ? "..." : ""),
      msg.lida ? "Sim" : "Não",
    ]);

    autoTable(doc, {
      head: [["Data/Hora", "Remetente", "Destinatário", "Mensagem", "Lida"]],
      body: tableData,
      startY: 32,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`auditoria-chat-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const uniqueUsers = Array.from(
    new Set(
      messages?.flatMap((msg) => [
        { id: msg.remetenteId, nome: msg.remetenteNome },
        { id: msg.destinatarioId, nome: msg.destinatarioNome },
      ]) || []
    ).values()
  ).filter((user, index, self) => 
    index === self.findIndex((u) => u.id === user.id)
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Auditoria de Mensagens de Chat
              </CardTitle>
              <CardDescription>
                Histórico completo de todas as conversas realizadas no sistema
              </CardDescription>
            </div>
            <Button onClick={exportToPDF} disabled={!filteredMessages || filteredMessages.length === 0} data-testid="button-export-chat-audit">
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar mensagens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
                data-testid="input-search-messages"
              />
            </div>

            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger data-testid="select-user-filter">
                <SelectValue placeholder="Filtrar por usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os usuários</SelectItem>
                {uniqueUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger data-testid="select-date-filter">
                <SelectValue placeholder="Filtrar por data" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as datas</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Último mês</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            Mostrando {filteredMessages?.length || 0} mensagem(ns)
          </div>

          {isLoading ? (
            <div className="text-center py-8">Carregando mensagens...</div>
          ) : filteredMessages && filteredMessages.length > 0 ? (
            <ScrollArea className="h-[calc(100vh-24rem)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Remetente</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMessages.map((msg) => (
                    <TableRow key={msg.id} data-testid={`audit-row-${msg.id}`}>
                      <TableCell className="text-sm">
                        {new Date(msg.timestamp).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{msg.remetenteNome}</p>
                          <Badge variant="outline" className="text-xs">
                            {msg.remetenteTipo}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{msg.destinatarioNome}</p>
                          <Badge variant="outline" className="text-xs">
                            {msg.destinatarioTipo}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-sm truncate">{msg.conteudo}</p>
                      </TableCell>
                      <TableCell>
                        {msg.lida ? (
                          <Badge variant="default" className="text-xs">
                            Lida
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Não lida
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Nenhuma mensagem encontrada</p>
              <p className="text-sm text-muted-foreground">
                {searchQuery || selectedUser !== "all" || dateFilter !== "all"
                  ? "Tente ajustar os filtros de busca"
                  : "Ainda não há mensagens no sistema"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
