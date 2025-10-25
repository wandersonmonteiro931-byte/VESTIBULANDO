import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Paperclip, X, Search, MoreVertical, Image as ImageIcon, Video, File, FileText, Music, Trash2, Ban, Flag, ShieldAlert } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  doc, 
  getDocs,
  orderBy,
  getDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";
import { checkMessageForViolations, applyPenalty } from "@/lib/chatModeration";
import { validateFile, getFileTypeCategory } from "@/lib/fileValidation";
import type { User, ChatConversation, ChatMessage } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Chat() {
  const [, setLocation] = useLocation();
  const { userData } = useAuth();
  const { toast } = useToast();

  // Estados principais
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  // Estados de bloqueio e denúncia
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voltar ao dashboard
  const handleBackToDashboard = () => {
    if (!userData) return;
    switch (userData.tipo) {
      case "aluno":
        setLocation("/aluno");
        break;
      case "professor":
        setLocation("/professor");
        break;
      case "diretor":
        setLocation("/diretor");
        break;
      default:
        setLocation("/");
    }
  };

  // Carregar usuários
  useEffect(() => {
    const loadUsers = async () => {
      if (!userData?.uid) return;
      
      try {
        const usersRef = collection(db, "usuarios");
        const snapshot = await getDocs(usersRef);
        const users: User[] = [];
        
        snapshot.forEach((doc) => {
          const user = { uid: doc.id, ...doc.data() } as User;
          if (user.uid !== userData.uid && user.ativo) {
            if (user.tipo === "diretor" || user.status === "aprovado") {
              users.push(user);
            }
          }
        });
        
        users.sort((a, b) => {
          if (a.tipo === "diretor") return -1;
          if (b.tipo === "diretor") return 1;
          return a.nome.localeCompare(b.nome);
        });
        
        setAllUsers(users);
      } catch (error) {
        console.error("Erro ao carregar usuários:", error);
      }
    };

    loadUsers();
  }, [userData?.uid]);

  // Carregar conversas
  useEffect(() => {
    if (!userData?.uid) return;

    const conversationsRef = collection(db, "chat_conversations");
    const q1 = query(conversationsRef, where("participante1Id", "==", userData.uid));
    const q2 = query(conversationsRef, where("participante2Id", "==", userData.uid));

    let conversations1: ChatConversation[] = [];
    let conversations2: ChatConversation[] = [];

    const unsubscribe1 = onSnapshot(q1, (snapshot) => {
      conversations1 = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as ChatConversation));
      mergeConversations();
    });

    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      conversations2 = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as ChatConversation));
      mergeConversations();
    });

    const mergeConversations = () => {
      const allConvs = [...conversations1, ...conversations2];
      const uniqueConvs = Array.from(new Map(allConvs.map(c => [c.id, c])).values());
      
      uniqueConvs.sort((a, b) => {
        const dateA = a.ultimaMensagemTimestamp ? new Date(a.ultimaMensagemTimestamp).getTime() : 0;
        const dateB = b.ultimaMensagemTimestamp ? new Date(b.ultimaMensagemTimestamp).getTime() : 0;
        return dateB - dateA;
      });
      
      setConversations(uniqueConvs);
    };

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [userData?.uid]);

  // Carregar mensagens da conversa selecionada
  useEffect(() => {
    if (!selectedConversation?.id) return;

    const messagesRef = collection(db, "chat_messages");
    const q = query(
      messagesRef,
      where("conversationId", "==", selectedConversation.id),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as ChatMessage));
      
      setMessages(msgs);
      scrollToBottom();
    });

    return () => unsubscribe();
  }, [selectedConversation?.id]);

  // Scroll para o final
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Selecionar usuário e iniciar conversa
  const handleSelectUser = async (user: User) => {
    if (!userData?.uid) return;

    // Verificar se já existe conversa
    const existing = conversations.find((conv) => {
      const otherId = conv.participante1Id === userData.uid 
        ? conv.participante2Id 
        : conv.participante1Id;
      return otherId === user.uid;
    });

    if (existing) {
      setSelectedConversation(existing);
    } else {
      // Criar nova conversa
      const newConv: Partial<ChatConversation> = {
        participante1Id: userData.uid,
        participante1Nome: userData.nome,
        participante1Tipo: userData.tipo,
        participante2Id: user.uid,
        participante2Nome: user.nome,
        participante2Tipo: user.tipo,
        dataCriacao: getNowBrasiliaISO(),
        dataUltimaAtualizacao: getNowBrasiliaISO(),
        mensagensNaoLidas1: 0,
        mensagensNaoLidas2: 0,
      };

      try {
        const docRef = await addDoc(collection(db, "chat_conversations"), newConv);
        const createdConv = { id: docRef.id, ...newConv } as ChatConversation;
        setSelectedConversation(createdConv);
      } catch (error) {
        console.error("Erro ao criar conversa:", error);
        toast({
          title: "Erro",
          description: "Não foi possível iniciar a conversa.",
          variant: "destructive",
        });
      }
    }
    
    setSearchQuery("");
  };

  // Upload de arquivo
  const uploadFile = async (file: File, conversationId: string): Promise<string> => {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storageRef = ref(storage, `chat/${conversationId}/${fileName}`);
    
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  // Enviar mensagem
  const sendMessage = async () => {
    if (!messageText.trim() && !selectedFile) return;
    if (!userData?.uid || !selectedConversation) return;

    setSending(true);

    try {
      const otherParticipantId = selectedConversation.participante1Id === userData.uid
        ? selectedConversation.participante2Id
        : selectedConversation.participante1Id;
      
      const otherParticipantNome = selectedConversation.participante1Id === userData.uid
        ? selectedConversation.participante2Nome
        : selectedConversation.participante1Nome;
      
      const otherParticipantTipo = selectedConversation.participante1Id === userData.uid
        ? selectedConversation.participante2Tipo
        : selectedConversation.participante1Tipo;

      let arquivoUrl: string | undefined;
      let arquivoNome: string | undefined;
      let arquivoTipo: string | undefined;
      let arquivoTamanho: number | undefined;
      let tipoMensagem: ChatMessage["tipo"] = "texto";

      // Upload de arquivo se houver
      if (selectedFile) {
        const validation = validateFile(selectedFile, 20 * 1024 * 1024);
        
        if (!validation.isValid) {
          toast({
            variant: "destructive",
            title: "Arquivo não permitido",
            description: validation.error,
          });
          setSending(false);
          return;
        }

        setUploading(true);
        arquivoUrl = await uploadFile(selectedFile, selectedConversation.id);
        arquivoNome = selectedFile.name;
        arquivoTipo = selectedFile.type;
        arquivoTamanho = selectedFile.size;
        tipoMensagem = getFileTypeCategory(selectedFile.name) as ChatMessage["tipo"];
        setUploading(false);
      }

      const finalContent = messageText.trim() || `[${tipoMensagem}]`;

      // Verificar violações
      const violation = await checkMessageForViolations(finalContent, userData.uid);
      
      if (violation) {
        await applyPenalty(userData.uid, violation, finalContent, selectedConversation.id, otherParticipantId, otherParticipantNome);
        
        toast({
          variant: "destructive",
          title: "Mensagem bloqueada",
          description: `Sua mensagem viola as regras do chat. ${violation.penaltyMessage}`,
        });
        
        setSending(false);
        setMessageText("");
        setSelectedFile(null);
        return;
      }

      // Criar mensagem
      const messageData: Partial<ChatMessage> = {
        conversationId: selectedConversation.id,
        remetenteId: userData.uid,
        remetenteNome: userData.nome,
        remetenteTipo: userData.tipo,
        destinatarioId: otherParticipantId,
        destinatarioNome: otherParticipantNome,
        destinatarioTipo: otherParticipantTipo,
        tipo: tipoMensagem,
        conteudo: finalContent,
        timestamp: getNowBrasiliaISO(),
        entregue: false,
        lida: false,
        deletadaPorRemetente: false,
        deletadaPorDestinatario: false,
      };

      if (arquivoUrl) {
        messageData.arquivoUrl = arquivoUrl;
        messageData.arquivoNome = arquivoNome;
        messageData.arquivoTipo = arquivoTipo;
        messageData.arquivoTamanho = arquivoTamanho;
      }

      await addDoc(collection(db, "chat_messages"), messageData);

      // Atualizar conversa
      const conversationRef = doc(db, "chat_conversations", selectedConversation.id);
      const isParticipant1 = selectedConversation.participante1Id === userData.uid;
      
      await updateDoc(conversationRef, {
        ultimaMensagem: finalContent.substring(0, 50),
        ultimaMensagemTimestamp: getNowBrasiliaISO(),
        ultimaMensagemRemetenteId: userData.uid,
        ultimaMensagemEntregue: false,
        ultimaMensagemLida: false,
        [isParticipant1 ? "mensagensNaoLidas2" : "mensagensNaoLidas1"]: 
          ((isParticipant1 ? selectedConversation.mensagensNaoLidas2 : selectedConversation.mensagensNaoLidas1) || 0) + 1,
        dataUltimaAtualizacao: getNowBrasiliaISO(),
      });

      setMessageText("");
      setSelectedFile(null);
      scrollToBottom();
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível enviar a mensagem.",
      });
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  // Excluir mensagem
  const deleteMessage = async (messageId: string) => {
    if (!userData?.uid) return;

    try {
      const msg = messages.find(m => m.id === messageId);
      if (!msg) return;

      const messageRef = doc(db, "chat_messages", messageId);
      
      if (msg.remetenteId === userData.uid) {
        await updateDoc(messageRef, {
          deletadaPorRemetente: true,
          dataDeletadaPorRemetente: getNowBrasiliaISO(),
        });
      } else {
        await updateDoc(messageRef, {
          deletadaPorDestinatario: true,
          dataDeletadaPorDestinatario: getNowBrasiliaISO(),
        });
      }

      toast({
        title: "Mensagem removida",
        description: "A mensagem foi removida da sua visualização.",
      });
    } catch (error) {
      console.error("Erro ao deletar mensagem:", error);
    }
  };

  // Helper para obter iniciais
  const getInitials = (nome: string) => {
    if (nome === "Diretoria") return "DIR";
    const names = nome.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  // Helper para formatar timestamp
  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), "HH:mm", { locale: ptBR });
    } catch {
      return "";
    }
  };

  // Filtrar mensagens visíveis
  const visibleMessages = messages.filter(msg => {
    if (msg.remetenteId === userData?.uid && msg.deletadaPorRemetente) return false;
    if (msg.destinatarioId === userData?.uid && msg.deletadaPorDestinatario) return false;
    return true;
  });

  // Usuários filtrados pela busca
  const filteredUsers = searchQuery.trim()
    ? allUsers.filter(user => {
        const term = searchQuery.toLowerCase();
        const displayName = user.tipo === "diretor" ? "Diretoria" : user.nome;
        return (
          displayName.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term)
        );
      })
    : [];

  const showChatView = !!selectedConversation;
  const otherParticipant = selectedConversation
    ? {
        id: selectedConversation.participante1Id === userData?.uid
          ? selectedConversation.participante2Id
          : selectedConversation.participante1Id,
        nome: selectedConversation.participante1Id === userData?.uid
          ? (selectedConversation.participante2Tipo === "diretor" ? "Diretoria" : selectedConversation.participante2Nome)
          : (selectedConversation.participante1Tipo === "diretor" ? "Diretoria" : selectedConversation.participante1Nome),
        tipo: selectedConversation.participante1Id === userData?.uid
          ? selectedConversation.participante2Tipo
          : selectedConversation.participante1Tipo,
      }
    : null;

  return (
    <div className="flex w-full flex-col bg-background chat-container-mobile md:h-screen">
      {/* Header principal */}
      <header className="flex items-center gap-4 border-b px-4 py-3 bg-card chat-header">
        <Button
          size="icon"
          variant="ghost"
          onClick={handleBackToDashboard}
          data-testid="button-back-to-dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Chat Vestibulando</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Lista de conversas */}
        <div className={`${showChatView ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96 border-r bg-card`}>
          {/* Busca */}
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar usuário..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-users"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {searchQuery.trim() && filteredUsers.length > 0 ? (
              <div className="p-2">
                {filteredUsers.map((user) => (
                  <button
                    key={user.uid}
                    onClick={() => handleSelectUser(user)}
                    className="w-full flex items-center gap-3 p-3 hover-elevate active-elevate-2 rounded-lg"
                    data-testid={`button-select-user-${user.uid}`}
                  >
                    <Avatar>
                      {user.fotoPublica && user.fotoBase64 ? (
                        <AvatarImage src={user.fotoBase64} alt={user.nome} />
                      ) : null}
                      <AvatarFallback>
                        {getInitials(user.tipo === "diretor" ? "Diretoria" : user.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <div className="font-medium">
                        {user.tipo === "diretor" ? "Diretoria" : user.nome}
                      </div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : conversations.length > 0 ? (
              <div className="p-2">
                {conversations.map((conv) => {
                  const otherId = conv.participante1Id === userData?.uid
                    ? conv.participante2Id
                    : conv.participante1Id;
                  const otherName = conv.participante1Id === userData?.uid
                    ? (conv.participante2Tipo === "diretor" ? "Diretoria" : conv.participante2Nome)
                    : (conv.participante1Tipo === "diretor" ? "Diretoria" : conv.participante1Nome);
                  const isSelected = selectedConversation?.id === conv.id;

                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className={`w-full flex items-center gap-3 p-3 hover-elevate active-elevate-2 rounded-lg ${
                        isSelected ? 'bg-accent' : ''
                      }`}
                      data-testid={`conversation-${conv.id}`}
                    >
                      <Avatar>
                        <AvatarFallback>{getInitials(otherName)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left">
                        <div className="font-medium">{otherName}</div>
                        {conv.ultimaMensagem && (
                          <div className="text-sm text-muted-foreground truncate">
                            {conv.ultimaMensagem}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma conversa ainda. Use a busca para iniciar uma conversa.
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Área do chat */}
        <div className={`${showChatView ? 'flex' : 'hidden md:flex'} flex-col flex-1`}>
          {selectedConversation && otherParticipant ? (
            <>
              {/* Header do chat */}
              <div className="flex items-center gap-2 p-3 border-b bg-card">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden"
                  data-testid="button-back-to-list"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Avatar>
                  <AvatarFallback>{getInitials(otherParticipant.nome)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{otherParticipant.nome}</p>
                </div>
              </div>

              {/* Mensagens */}
              <div 
                ref={messagesContainerRef} 
                className="flex-1 p-4 space-y-2 overflow-y-auto chat-messages"
                style={{ overscrollBehavior: 'contain' }}
              >
                {visibleMessages.map((msg) => {
                  const isOwn = msg.remetenteId === userData?.uid;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                      data-testid={`message-${msg.id}`}
                    >
                      <div className={`max-w-[70%] rounded-lg p-2 ${
                        isOwn 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-card"
                      }`}>
                        {msg.arquivoUrl && msg.tipo === "imagem" && (
                          <img
                            src={msg.arquivoUrl}
                            alt={msg.arquivoNome}
                            className="max-w-full rounded mb-1 max-h-64"
                          />
                        )}
                        {msg.conteudo && (
                          <p className="text-sm">{msg.conteudo}</p>
                        )}
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-xs opacity-70">
                            {formatTimestamp(msg.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-2 border-t bg-card chat-input-area">
                {selectedFile && (
                  <div className="mb-2 flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <File className="h-4 w-4" />
                    <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setSelectedFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                  />
                  
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || sending}
                    data-testid="button-attach-file"
                  >
                    <Paperclip className="h-5 w-5" />
                  </Button>

                  <Input
                    placeholder="Mensagem"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    disabled={uploading || sending}
                    data-testid="input-message"
                    className="flex-1"
                  />

                  <Button
                    onClick={sendMessage}
                    disabled={(!messageText.trim() && !selectedFile) || uploading || sending}
                    data-testid="button-send-message"
                    size="icon"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>Selecione uma conversa para começar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
