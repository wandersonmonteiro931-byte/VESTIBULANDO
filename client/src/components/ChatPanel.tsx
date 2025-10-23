import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { User, ChatMessage, ChatConversation } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, Send, Search, X } from "lucide-react";
import { where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, getDocs, updateDoc, doc, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

function getNowBrasiliaISO(): string {
  const now = new Date();
  const brasiliaOffset = -3 * 60;
  const localOffset = now.getTimezoneOffset();
  const diff = brasiliaOffset - localOffset;
  const brasiliaTime = new Date(now.getTime() + diff * 60000);
  return brasiliaTime.toISOString();
}

function getStatusColor(status?: string): string {
  switch (status) {
    case "online":
      return "bg-green-500";
    case "ausente":
      return "bg-yellow-500";
    case "em_reuniao":
      return "bg-red-500";
    case "ocupado":
      return "bg-orange-500";
    default:
      return "bg-gray-400";
  }
}

function getStatusLabel(status?: string): string {
  switch (status) {
    case "online":
      return "Online";
    case "ausente":
      return "Ausente";
    case "em_reuniao":
      return "Em reunião";
    case "ocupado":
      return "Ocupado";
    default:
      return "Offline";
  }
}

function getConversationId(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join("_");
}

export function ChatPanel() {
  const { userData } = useAuth();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: users } = useRealtimeQuery<User>({
    collectionName: "usuarios",
    queryKey: ["/api/usuarios/chat"],
    constraints: [where("status", "==", "aprovado"), where("ativo", "==", true)],
    transform: (docs) => docs.filter((u: any) => u.uid !== userData?.uid) as User[],
  });

  const currentConversationId = selectedUser ? getConversationId(userData!.uid, selectedUser.uid) : null;

  const { data: messages } = useRealtimeQuery<ChatMessage>({
    collectionName: "chat_messages",
    queryKey: ["/api/chat/messages", currentConversationId],
    constraints: currentConversationId
      ? [where("conversationId", "==", currentConversationId), orderBy("timestamp", "asc")]
      : [],
    transform: (docs) => docs as ChatMessage[],
    enabled: !!currentConversationId,
  });

  const { data: conversations } = useRealtimeQuery<ChatConversation>({
    collectionName: "chat_conversations",
    queryKey: ["/api/chat/conversations", userData?.uid],
    constraints: userData?.uid
      ? [
          where("participante1Id", "in", [userData.uid]),
        ]
      : [],
    transform: (docs) => docs as ChatConversation[],
    enabled: !!userData?.uid,
  });

  const { data: conversations2 } = useRealtimeQuery<ChatConversation>({
    collectionName: "chat_conversations",
    queryKey: ["/api/chat/conversations2", userData?.uid],
    constraints: userData?.uid
      ? [
          where("participante2Id", "in", [userData.uid]),
        ]
      : [],
    transform: (docs) => docs as ChatConversation[],
    enabled: !!userData?.uid,
  });

  const allConversations = [...(conversations || []), ...(conversations2 || [])];

  const filteredUsers = users?.filter((user) =>
    user.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (selectedUser && currentConversationId && messages) {
      const unreadMessages = messages.filter(
        (msg) => msg.destinatarioId === userData?.uid && !msg.lida
      );

      if (unreadMessages.length > 0) {
        const batch = writeBatch(db);
        unreadMessages.forEach((msg) => {
          batch.update(doc(db, "chat_messages", msg.id), {
            lida: true,
            dataLeitura: getNowBrasiliaISO(),
          });
        });
        batch.commit().catch((error) => {
          console.error("Erro ao marcar mensagens como lidas:", error);
        });
      }
    }
  }, [selectedUser, currentConversationId, messages, userData?.uid]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedUser || !userData) return;

    try {
      const conversationId = getConversationId(userData.uid, selectedUser.uid);
      const timestamp = getNowBrasiliaISO();

      const messageData: any = {
        conversationId,
        remetenteId: userData.uid,
        remetenteNome: userData.nome,
        remetenteTipo: userData.tipo,
        destinatarioId: selectedUser.uid,
        destinatarioNome: selectedUser.nome,
        destinatarioTipo: selectedUser.tipo,
        conteudo: messageInput,
        timestamp,
        lida: false,
      };

      await addDoc(collection(db, "chat_messages"), messageData);

      const conversationsQuery = query(
        collection(db, "chat_conversations"),
        where("id", "==", conversationId)
      );
      const conversationsSnapshot = await getDocs(conversationsQuery);

      if (conversationsSnapshot.empty) {
        const conversationData: any = {
          id: conversationId,
          participante1Id: userData.uid,
          participante1Nome: userData.nome,
          participante1Tipo: userData.tipo,
          participante2Id: selectedUser.uid,
          participante2Nome: selectedUser.nome,
          participante2Tipo: selectedUser.tipo,
          ultimaMensagem: messageInput,
          ultimaMensagemTimestamp: timestamp,
          ultimaMensagemRemetenteId: userData.uid,
          mensagensNaoLidas1: 0,
          mensagensNaoLidas2: 1,
          dataCriacao: timestamp,
          dataUltimaAtualizacao: timestamp,
        };
        await addDoc(collection(db, "chat_conversations"), conversationData);
      } else {
        const conversationDoc = conversationsSnapshot.docs[0];
        const conversation = conversationDoc.data() as ChatConversation;
        const isParticipant1 = conversation.participante1Id === userData.uid;

        await updateDoc(doc(db, "chat_conversations", conversationDoc.id), {
          ultimaMensagem: messageInput,
          ultimaMensagemTimestamp: timestamp,
          ultimaMensagemRemetenteId: userData.uid,
          ...(isParticipant1
            ? { mensagensNaoLidas2: (conversation.mensagensNaoLidas2 || 0) + 1 }
            : { mensagensNaoLidas1: (conversation.mensagensNaoLidas1 || 0) + 1 }),
          dataUltimaAtualizacao: timestamp,
        });
      }

      setMessageInput("");
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const getUnreadCount = (user: User): number => {
    const conversationId = getConversationId(userData!.uid, user.uid);
    const conversation = allConversations.find((c) => c.id === conversationId);
    if (!conversation) return 0;

    const isParticipant1 = conversation.participante1Id === userData!.uid;
    return isParticipant1 ? conversation.mensagensNaoLidas1 : conversation.mensagensNaoLidas2;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      <Card className="lg:col-span-1">
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Conversas
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuários..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
              data-testid="input-search-users"
            />
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-16rem)]">
            {filteredUsers?.map((user) => {
              const unreadCount = getUnreadCount(user);
              return (
                <button
                  key={user.uid}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full p-3 flex items-center gap-3 hover-elevate transition-colors ${
                    selectedUser?.uid === user.uid ? "bg-accent" : ""
                  }`}
                  data-testid={`button-user-${user.uid}`}
                >
                  <div className="relative">
                    <Avatar>
                      <AvatarImage src={user.fotoBase64} />
                      <AvatarFallback>{user.nome.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${getStatusColor(
                        user.statusPresenca
                      )}`}
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate">{user.nome}</p>
                      {unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          {unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{getStatusLabel(user.statusPresenca)}</p>
                  </div>
                </button>
              );
            })}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        {selectedUser ? (
          <>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar>
                      <AvatarImage src={selectedUser.fotoBase64} />
                      <AvatarFallback>{selectedUser.nome.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${getStatusColor(
                        selectedUser.statusPresenca
                      )}`}
                    />
                  </div>
                  <div>
                    <CardTitle className="text-base">{selectedUser.nome}</CardTitle>
                    <p className="text-xs text-muted-foreground">{getStatusLabel(selectedUser.statusPresenca)}</p>
                    {selectedUser.mensagemStatus && (
                      <p className="text-xs text-muted-foreground italic">{selectedUser.mensagemStatus}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedUser(null)}
                  data-testid="button-close-chat"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-4 space-y-4">
              <ScrollArea className="h-[calc(100vh-20rem)]">
                <div className="space-y-3">
                  {messages?.map((message) => {
                    const isSentByMe = message.remetenteId === userData?.uid;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isSentByMe ? "justify-end" : "justify-start"}`}
                        data-testid={`message-${message.id}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            isSentByMe
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{message.conteudo}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(message.timestamp).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  data-testid="input-message"
                />
                <Button onClick={handleSendMessage} size="icon" data-testid="button-send-message">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Selecione uma conversa para começar</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
