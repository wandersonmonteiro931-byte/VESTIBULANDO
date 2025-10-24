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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageCircle, Send, Search, X, Paperclip, Image as ImageIcon, FileText, Video, Mic, Download, AlertTriangle, Phone, VideoIcon, MoreVertical, Trash2 } from "lucide-react";
import { VideoCallDialog } from "@/components/VideoCallDialog";
import { where, orderBy } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, query, getDocs, updateDoc, doc, writeBatch, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getDisplayName(user: User): string {
  if (user.tipo === "diretor") {
    return "Diretoria";
  }
  return user.nome;
}

export function ChatPanel() {
  const { userData } = useAuth();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    transform: (docs) => {
      const allMessages = docs as ChatMessage[];
      return allMessages.filter((msg) => {
        if (msg.remetenteId === userData?.uid) {
          return !msg.deletadaPorRemetente;
        } else {
          return !msg.deletadaPorDestinatario;
        }
      });
    },
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

  const filteredUsers = users?.filter((user) => {
    const query = searchQuery.toLowerCase();
    const displayName = getDisplayName(user);
    
    // Se for diretor, verificar se o termo busca por "dir", "diretor" ou "diretoria"
    if (user.tipo === "diretor") {
      return (
        "diretoria".includes(query) ||
        "diretor".includes(query) ||
        "dir".includes(query) ||
        displayName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
      );
    }
    
    return (
      displayName.toLowerCase().includes(query) ||
      user.nome.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedUser || !userData) return;

    try {
      setUploadingFile(true);

      let messageType: "audio" | "imagem" | "documento" | "video" = "documento";
      
      if (file.type.startsWith("audio/")) {
        messageType = "audio";
      } else if (file.type.startsWith("image/")) {
        messageType = "imagem";
      } else if (file.type.startsWith("video/")) {
        messageType = "video";
      }

      const timestamp = getNowBrasiliaISO();
      const fileName = `chat/${currentConversationId}/${timestamp}_${file.name}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      const conversationId = getConversationId(userData.uid, selectedUser.uid);

      const messageData: any = {
        conversationId,
        remetenteId: userData.uid,
        remetenteNome: userData.nome,
        remetenteTipo: userData.tipo,
        destinatarioId: selectedUser.uid,
        destinatarioNome: selectedUser.nome,
        destinatarioTipo: selectedUser.tipo,
        tipo: messageType,
        conteudo: messageInput.trim() || file.name,
        arquivoUrl: downloadURL,
        arquivoNome: file.name,
        arquivoTipo: file.type,
        arquivoTamanho: file.size,
        timestamp,
        lida: false,
        deletadaPorRemetente: false,
        deletadaPorDestinatario: false,
      };

      await addDoc(collection(db, "chat_messages"), messageData);

      const lastMessagePreview = messageType === "imagem" ? "📷 Imagem" : 
                                 messageType === "audio" ? "🎙️ Áudio" :
                                 messageType === "video" ? "🎬 Vídeo" :
                                 "📄 " + file.name;

      const conversationRef = doc(db, "chat_conversations", conversationId);
      const conversationSnap = await getDoc(conversationRef);

      if (!conversationSnap.exists()) {
        const conversationData: any = {
          participante1Id: userData.uid,
          participante1Nome: userData.nome,
          participante1Tipo: userData.tipo,
          participante2Id: selectedUser.uid,
          participante2Nome: selectedUser.nome,
          participante2Tipo: selectedUser.tipo,
          ultimaMensagem: lastMessagePreview,
          ultimaMensagemTimestamp: timestamp,
          ultimaMensagemRemetenteId: userData.uid,
          mensagensNaoLidas1: 0,
          mensagensNaoLidas2: 1,
          dataCriacao: timestamp,
          dataUltimaAtualizacao: timestamp,
        };
        await setDoc(conversationRef, conversationData);
      } else {
        const conversation = conversationSnap.data() as ChatConversation;
        const isParticipant1 = conversation.participante1Id === userData.uid;

        await updateDoc(conversationRef, {
          ultimaMensagem: lastMessagePreview,
          ultimaMensagemTimestamp: timestamp,
          ultimaMensagemRemetenteId: userData.uid,
          ...(isParticipant1
            ? { mensagensNaoLidas2: (conversation.mensagensNaoLidas2 || 0) + 1 }
            : { mensagensNaoLidas1: (conversation.mensagensNaoLidas1 || 0) + 1 }),
          dataUltimaAtualizacao: timestamp,
        });
      }

      setMessageInput("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      toast({
        title: "Arquivo enviado",
        description: "O arquivo foi enviado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao enviar arquivo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o arquivo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploadingFile(false);
    }
  };

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
        tipo: "texto",
        conteudo: messageInput,
        timestamp,
        lida: false,
        deletadaPorRemetente: false,
        deletadaPorDestinatario: false,
      };

      await addDoc(collection(db, "chat_messages"), messageData);

      const conversationRef = doc(db, "chat_conversations", conversationId);
      const conversationSnap = await getDoc(conversationRef);

      if (!conversationSnap.exists()) {
        const conversationData: any = {
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
        await setDoc(conversationRef, conversationData);
      } else {
        const conversation = conversationSnap.data() as ChatConversation;
        const isParticipant1 = conversation.participante1Id === userData.uid;

        await updateDoc(conversationRef, {
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

  const handleDeleteMessage = async (messageId: string, isSentByMe: boolean) => {
    try {
      const messageRef = doc(db, "chat_messages", messageId);
      const updateData = isSentByMe
        ? { deletadaPorRemetente: true }
        : { deletadaPorDestinatario: true };
      
      await updateDoc(messageRef, updateData);
      
      toast({
        title: "Mensagem removida",
        description: "A mensagem foi removida da sua visualização.",
      });
    } catch (error) {
      console.error("Erro ao deletar mensagem:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a mensagem.",
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

  const renderMessage = (message: ChatMessage) => {
    const isSentByMe = message.remetenteId === userData?.uid;

    if (message.tipo === "texto") {
      return (
        <div
          key={message.id}
          className={`flex ${isSentByMe ? "justify-end" : "justify-start"} group`}
          data-testid={`message-${message.id}`}
        >
          <div className="flex items-start gap-2">
            {isSentByMe && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleDeleteMessage(message.id, isSentByMe)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Deletar mensagem
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
            {!isSentByMe && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => handleDeleteMessage(message.id, isSentByMe)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Deletar mensagem
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      );
    }

    if (message.tipo === "imagem" && message.arquivoUrl) {
      return (
        <div
          key={message.id}
          className={`flex ${isSentByMe ? "justify-end" : "justify-start"}`}
          data-testid={`message-${message.id}`}
        >
          <div
            className={`max-w-[70%] rounded-lg p-2 ${
              isSentByMe
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            }`}
          >
            <img 
              src={message.arquivoUrl} 
              alt={message.arquivoNome}
              className="rounded max-w-full max-h-64 object-contain"
            />
            {message.conteudo !== message.arquivoNome && (
              <p className="text-sm mt-2">{message.conteudo}</p>
            )}
            <p className="text-xs opacity-70 mt-1">
              {new Date(message.timestamp).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      );
    }

    if (message.tipo === "audio" && message.arquivoUrl) {
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
            <div className="flex items-center gap-2 mb-2">
              <Mic className="h-4 w-4" />
              <span className="text-sm font-medium">Mensagem de áudio</span>
            </div>
            <audio controls className="w-full">
              <source src={message.arquivoUrl} type={message.arquivoTipo} />
            </audio>
            <p className="text-xs opacity-70 mt-1">
              {new Date(message.timestamp).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      );
    }

    if (message.tipo === "video" && message.arquivoUrl) {
      return (
        <div
          key={message.id}
          className={`flex ${isSentByMe ? "justify-end" : "justify-start"}`}
          data-testid={`message-${message.id}`}
        >
          <div
            className={`max-w-[70%] rounded-lg p-2 ${
              isSentByMe
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            }`}
          >
            <video controls className="rounded max-w-full max-h-64">
              <source src={message.arquivoUrl} type={message.arquivoTipo} />
            </video>
            {message.conteudo !== message.arquivoNome && (
              <p className="text-sm mt-2">{message.conteudo}</p>
            )}
            <p className="text-xs opacity-70 mt-1">
              {new Date(message.timestamp).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      );
    }

    if (message.tipo === "documento" && message.arquivoUrl) {
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
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{message.arquivoNome}</p>
                <p className="text-xs opacity-70">
                  {message.arquivoTamanho ? formatFileSize(message.arquivoTamanho) : ""}
                </p>
              </div>
              <a
                href={message.arquivoUrl}
                download={message.arquivoNome}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="icon" variant="ghost" className="flex-shrink-0">
                  <Download className="h-4 w-4" />
                </Button>
              </a>
            </div>
            <p className="text-xs opacity-70 mt-2">
              {new Date(message.timestamp).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      );
    }

    return null;
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
                      <AvatarFallback>{getDisplayName(user).charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${getStatusColor(
                        user.statusPresenca
                      )}`}
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate">{getDisplayName(user)}</p>
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
                      <AvatarFallback>{getDisplayName(selectedUser).charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${getStatusColor(
                        selectedUser.statusPresenca
                      )}`}
                    />
                  </div>
                  <div>
                    <CardTitle className="text-base">{getDisplayName(selectedUser)}</CardTitle>
                    <p className="text-xs text-muted-foreground">{getStatusLabel(selectedUser.statusPresenca)}</p>
                    {selectedUser.mensagemStatus && (
                      <p className="text-xs text-muted-foreground italic">{selectedUser.mensagemStatus}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setIsVideoCall(false);
                      setCallDialogOpen(true);
                    }}
                    data-testid="button-audio-call"
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setIsVideoCall(true);
                      setCallDialogOpen(true);
                    }}
                    data-testid="button-video-call"
                  >
                    <VideoIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedUser(null)}
                    data-testid="button-close-chat"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-4 space-y-4">
              <ScrollArea className="h-[calc(100vh-20rem)]">
                <div className="space-y-3">
                  <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertDescription className="text-xs text-amber-900 dark:text-amber-100">
                      <strong>⚠️ Atenção:</strong> Este canal de comunicação é exclusivo para assuntos acadêmicos e administrativos da plataforma Vestibulando.
                      Todas as mensagens, áudios, documentos e chamadas são monitorados e registrados pela Diretoria para fins de auditoria.
                      Não é permitido o envio de conteúdos ofensivos, inapropriados ou fora do contexto educacional.
                      Ao enviar qualquer mensagem, o usuário concorda com os termos de uso e política de conduta da plataforma.
                    </AlertDescription>
                  </Alert>
                  
                  {messages?.map((message) => renderMessage(message))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="space-y-2">
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
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    size="icon"
                    variant="outline"
                    disabled={uploadingFile}
                    data-testid="button-attach-file"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button 
                    onClick={handleSendMessage} 
                    size="icon" 
                    data-testid="button-send-message"
                    disabled={uploadingFile}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                {uploadingFile && (
                  <p className="text-xs text-muted-foreground">Enviando arquivo...</p>
                )}
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

      {selectedUser && (
        <VideoCallDialog
          open={callDialogOpen}
          onOpenChange={setCallDialogOpen}
          recipientName={getDisplayName(selectedUser)}
          recipientId={selectedUser.uid}
          isVideoCall={isVideoCall}
        />
      )}
    </div>
  );
}
