import { useState, useEffect } from "react";
import { Search, AlertTriangle, Eye, MessageCircle, Shield, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ChatMessage, ChatPenalty, ChatConversation, ChatLog } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ChatAuditPanel() {
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const [deletedMessages, setDeletedMessages] = useState<ChatMessage[]>([]);
  const [penalties, setPenalties] = useState<ChatPenalty[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [selectedPenalty, setSelectedPenalty] = useState<ChatPenalty | null>(null);
  const [reviewDialog, setReviewDialog] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewDecision, setReviewDecision] = useState<"mantida" | "removida">("mantida");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadAuditData();
  }, []);

  const loadAuditData = async () => {
    setLoading(true);
    try {
      // Carregar todas as mensagens (últimas 1000)
      const messagesRef = collection(db, "chatMessages");
      const messagesQuery = query(messagesRef, orderBy("timestamp", "desc"), limit(1000));
      const messagesSnapshot = await getDocs(messagesQuery);
      const msgs = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setAllMessages(msgs);

      // Filtrar mensagens deletadas
      const deleted = msgs.filter(msg => msg.deletadaPorRemetente || msg.deletadaPorDestinatario);
      setDeletedMessages(deleted);

      // Carregar penalidades
      const penaltiesRef = collection(db, "chatPenalties");
      const penaltiesQuery = query(penaltiesRef, orderBy("dataInfracao", "desc"));
      const penaltiesSnapshot = await getDocs(penaltiesQuery);
      const pens = penaltiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatPenalty));
      setPenalties(pens);

      // Carregar conversas
      const conversationsRef = collection(db, "chatConversations");
      const conversationsQuery = query(conversationsRef, orderBy("dataUltimaAtualizacao", "desc"));
      const conversationsSnapshot = await getDocs(conversationsQuery);
      const convs = conversationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatConversation));
      setConversations(convs);

      // Carregar logs
      const logsRef = collection(db, "chatLogs");
      const logsQuery = query(logsRef, orderBy("timestamp", "desc"), limit(500));
      const logsSnapshot = await getDocs(logsQuery);
      const chatLogs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatLog));
      setLogs(chatLogs);
    } catch (error) {
      console.error("Erro ao carregar dados de auditoria:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os dados de auditoria.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReviewPenalty = async () => {
    if (!selectedPenalty) return;

    try {
      const penaltyRef = doc(db, "chatPenalties", selectedPenalty.id);
      await updateDoc(penaltyRef, {
        revisadoPorDiretor: true,
        decisaoDiretor: reviewDecision,
        comentarioDiretor: reviewComment,
        dataRevisao: new Date().toISOString(),
        ativa: reviewDecision === "removida" ? false : selectedPenalty.ativa,
      });

      // Se foi removida a suspensão, reativar o usuário
      if (reviewDecision === "removida" && selectedPenalty.tipo === "suspensao_conta") {
        const usersRef = collection(db, "users");
        const userQuery = query(usersRef, where("uid", "==", selectedPenalty.usuarioId));
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
          const userDocRef = doc(db, "users", userSnapshot.docs[0].id);
          await updateDoc(userDocRef, {
            ativo: true,
          });
        }
      }

      toast({
        title: "Penalidade revisada",
        description: `A penalidade foi ${reviewDecision === "removida" ? "removida" : "mantida"}.`,
      });

      setReviewDialog(false);
      setSelectedPenalty(null);
      setReviewComment("");
      loadAuditData();
    } catch (error) {
      console.error("Erro ao revisar penalidade:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível revisar a penalidade.",
      });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    } catch {
      return "";
    }
  };

  const getInitials = (nome: string) => {
    if (nome === "Diretoria") return "DIR";
    const names = nome.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  const getPenaltyLabel = (tipo: string) => {
    switch (tipo) {
      case "advertencia": return "Advertência";
      case "bloqueio_24h": return "Bloqueio 24h";
      case "suspensao_conta": return "Suspensão de Conta";
      default: return tipo;
    }
  };

  const filteredMessages = allMessages.filter(msg => 
    msg.conteudo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.remetenteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.destinatarioNome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPenalties = penalties.filter(pen =>
    pen.usuarioNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pen.mensagemInfratora.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLogs = logs.filter(log =>
    log.usuarioNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.detalhes.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.tipo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "error": return "destructive";
      case "warning": return "secondary";
      default: return "outline";
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case "critical": return "Crítico";
      case "error": return "Erro";
      case "warning": return "Aviso";
      default: return "Info";
    }
  };

  const getLogTypeLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      "mensagem_enviada": "Mensagem Enviada",
      "mensagem_lida": "Mensagem Lida",
      "mensagem_deletada": "Mensagem Deletada",
      "arquivo_enviado": "Arquivo Enviado",
      "erro_envio": "Erro ao Enviar",
      "erro_upload": "Erro no Upload",
      "conexao_perdida": "Conexão Perdida",
      "conexao_restaurada": "Conexão Restaurada",
      "violacao_detectada": "Violação Detectada",
      "penalidade_aplicada": "Penalidade Aplicada",
    };
    return labels[tipo] || tipo;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Carregando dados de auditoria...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Auditoria de Chat</h2>
          <p className="text-muted-foreground">
            Monitoramento completo de mensagens, conversas e penalidades
          </p>
        </div>
        <Button onClick={loadAuditData} data-testid="button-refresh-audit">
          Atualizar
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por usuário ou conteúdo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          data-testid="input-search-audit"
        />
      </div>

      <Tabs defaultValue="messages" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="messages" data-testid="tab-messages">
            <MessageCircle className="h-4 w-4 mr-2" />
            Mensagens ({filteredMessages.length})
          </TabsTrigger>
          <TabsTrigger value="deleted" data-testid="tab-deleted">
            <Eye className="h-4 w-4 mr-2" />
            Deletadas ({deletedMessages.length})
          </TabsTrigger>
          <TabsTrigger value="penalties" data-testid="tab-penalties">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Penalidades ({filteredPenalties.length})
          </TabsTrigger>
          <TabsTrigger value="conversations" data-testid="tab-conversations">
            <Shield className="h-4 w-4 mr-2" />
            Conversas ({conversations.length})
          </TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">
            <FileText className="h-4 w-4 mr-2" />
            Logs ({filteredLogs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Mensagens</CardTitle>
              <CardDescription>
                Todas as mensagens enviadas na plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {filteredMessages.map(msg => (
                  <div key={msg.id} className="flex gap-3 p-3 rounded border" data-testid={`audit-message-${msg.id}`}>
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{getInitials(msg.remetenteNome)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{msg.remetenteNome}</p>
                        <span className="text-xs text-muted-foreground">→</span>
                        <p className="font-medium text-sm">{msg.destinatarioNome}</p>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {msg.tipo}
                        </Badge>
                      </div>
                      <p className="text-sm">{msg.conteudo}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimestamp(msg.timestamp)}
                        {(msg.deletadaPorRemetente || msg.deletadaPorDestinatario) && (
                          <span className="ml-2 text-destructive">• Deletada</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deleted" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mensagens Deletadas</CardTitle>
              <CardDescription>
                Mensagens removidas pelos usuários (mantidas para auditoria)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {deletedMessages.map(msg => {
                  const deletadaPorRemetente = msg.deletadaPorRemetente;
                  const deletadaPorDestinatario = msg.deletadaPorDestinatario;
                  
                  return (
                    <div key={msg.id} className="flex gap-3 p-3 rounded border border-destructive/50" data-testid={`deleted-message-${msg.id}`}>
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{getInitials(msg.remetenteNome)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{msg.remetenteNome}</p>
                          <span className="text-xs text-muted-foreground">→</span>
                          <p className="font-medium text-sm">{msg.destinatarioNome}</p>
                          <Badge variant="destructive" className="ml-auto text-xs">
                            Deletada
                          </Badge>
                        </div>
                        <p className="text-sm">{msg.conteudo}</p>
                        <div className="space-y-1 mt-2">
                          <p className="text-xs text-muted-foreground">
                            📤 Enviada {formatTimestamp(msg.timestamp)}
                          </p>
                          {deletadaPorRemetente && msg.dataDeletadaPorRemetente && (
                            <p className="text-xs text-destructive font-medium">
                              🗑️ Removida pelo remetente em {new Date(msg.dataDeletadaPorRemetente).toLocaleString('pt-BR', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </p>
                          )}
                          {deletadaPorDestinatario && msg.dataDeletadaPorDestinatario && (
                            <p className="text-xs text-destructive font-medium">
                              🗑️ Removida pelo destinatário em {new Date(msg.dataDeletadaPorDestinatario).toLocaleString('pt-BR', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="penalties" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Penalidades Aplicadas</CardTitle>
              <CardDescription>
                Infrações e penalidades aplicadas automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {filteredPenalties.map(penalty => (
                  <div key={penalty.id} className="flex gap-3 p-3 rounded border" data-testid={`penalty-${penalty.id}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium">{penalty.usuarioNome}</p>
                        {penalty.usuarioMatricula && (
                          <span className="text-xs text-muted-foreground">
                            Mat. {penalty.usuarioMatricula}
                          </span>
                        )}
                        <Badge 
                          variant={penalty.tipo === "suspensao_conta" ? "destructive" : "secondary"}
                          className="ml-auto"
                        >
                          {getPenaltyLabel(penalty.tipo)}
                        </Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        <p className="text-muted-foreground">
                          <strong>Infração #{penalty.numeroDaInfracao}</strong> - {formatTimestamp(penalty.dataInfracao)}
                        </p>
                        <p className="p-2 bg-muted rounded">
                          Mensagem: "{penalty.mensagemInfratora}"
                        </p>
                        {penalty.revisadoPorDiretor && (
                          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 rounded">
                            <p className="text-xs font-medium">
                              Revisada: {penalty.decisaoDiretor === "mantida" ? "Mantida" : "Removida"}
                            </p>
                            {penalty.comentarioDiretor && (
                              <p className="text-xs mt-1">{penalty.comentarioDiretor}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {!penalty.revisadoPorDiretor && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedPenalty(penalty);
                          setReviewDialog(true);
                        }}
                        data-testid={`button-review-${penalty.id}`}
                      >
                        Revisar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Todas as Conversas</CardTitle>
              <CardDescription>
                Visualização de todas as conversas ativas na plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {conversations.map(conv => (
                  <div key={conv.id} className="flex gap-3 p-3 rounded border" data-testid={`conversation-${conv.id}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{conv.participante1Nome}</p>
                        <span className="text-xs text-muted-foreground">↔</span>
                        <p className="font-medium text-sm">{conv.participante2Nome}</p>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.ultimaMensagem || "Nenhuma mensagem ainda"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {conv.ultimaMensagemTimestamp 
                          ? formatTimestamp(conv.ultimaMensagemTimestamp)
                          : formatTimestamp(conv.dataCriacao)
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Atividades</CardTitle>
              <CardDescription>
                Registro detalhado de todas as ações realizadas no chat
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredLogs.map(log => {
                  let detalhes: any = {};
                  try {
                    detalhes = JSON.parse(log.detalhes);
                  } catch {
                    detalhes = { info: log.detalhes };
                  }

                  return (
                    <div 
                      key={log.id} 
                      className={`p-3 rounded border ${
                        log.nivelSeveridade === "critical" || log.nivelSeveridade === "error" 
                          ? "border-destructive/50 bg-destructive/5" 
                          : ""
                      }`}
                      data-testid={`log-${log.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={getSeverityColor(log.nivelSeveridade) as any} className="text-xs">
                              {getSeverityLabel(log.nivelSeveridade)}
                            </Badge>
                            <span className="text-sm font-medium">{getLogTypeLabel(log.tipo)}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {formatTimestamp(log.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">
                            Usuário: <span className="font-medium text-foreground">{log.usuarioNome}</span>
                          </p>
                          {Object.keys(detalhes).length > 0 && (
                            <div className="text-xs bg-muted p-2 rounded mt-2">
                              {Object.entries(detalhes).map(([key, value]) => (
                                <div key={key} className="flex gap-2">
                                  <span className="font-medium capitalize">{key}:</span>
                                  <span>{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar Penalidade</DialogTitle>
            <DialogDescription>
              Analise a infração e decida se a penalidade deve ser mantida ou removida
            </DialogDescription>
          </DialogHeader>

          {selectedPenalty && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Usuário:</p>
                <p className="text-sm">{selectedPenalty.usuarioNome}</p>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Tipo de Penalidade:</p>
                <Badge variant="secondary">{getPenaltyLabel(selectedPenalty.tipo)}</Badge>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Mensagem Infratora:</p>
                <p className="text-sm p-2 bg-muted rounded">{selectedPenalty.mensagemInfratora}</p>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Decisão:</p>
                <div className="flex gap-2">
                  <Button
                    variant={reviewDecision === "mantida" ? "default" : "outline"}
                    onClick={() => setReviewDecision("mantida")}
                    data-testid="button-decision-mantida"
                  >
                    Manter Penalidade
                  </Button>
                  <Button
                    variant={reviewDecision === "removida" ? "default" : "outline"}
                    onClick={() => setReviewDecision("removida")}
                    data-testid="button-decision-removida"
                  >
                    Remover Penalidade
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Comentário:</p>
                <Textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Adicione um comentário sobre sua decisão..."
                  data-testid="textarea-review-comment"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setReviewDialog(false);
                    setSelectedPenalty(null);
                    setReviewComment("");
                  }}
                  data-testid="button-cancel-review"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleReviewPenalty}
                  disabled={!reviewComment.trim()}
                  data-testid="button-confirm-review"
                >
                  Confirmar Decisão
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
