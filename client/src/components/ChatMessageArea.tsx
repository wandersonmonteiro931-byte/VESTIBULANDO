import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Paperclip, X, File, Image as ImageIcon, Video, Music, FileText, Trash2, AlertTriangle, WifiOff, Wifi, User as UserIcon } from "lucide-react";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, serverTimestamp, orderBy, getDocs, deleteDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";
import type { ChatMessage, ChatConversation, User } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { checkMessageForViolations, applyPenalty } from "@/lib/chatModeration";
import { ChatLogger } from "@/lib/chatLogger";
import { validateFile, getFileTypeCategory } from "@/lib/fileValidation";
import { useNetworkStatus, retryWithBackoff } from "@/hooks/useNetworkStatus";
import { useChatThread } from "@/hooks/useChatThread";
import { useUserPresence } from "@/hooks/useUserPresence";
import UserProfileDialog from "@/components/UserProfileDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatMessageAreaProps {
  conversation?: ChatConversation;
  selectedUser?: User;
  onBack: () => void;
}

interface OtherParticipant {
  id: string;
  nome: string;
  tipo: string;
  isOnline?: boolean;
  lastSeen?: string;
  lastActivity?: string;
}

const INSTITUTIONAL_MESSAGE = `⚠️ Atenção: Este canal é exclusivo para assuntos acadêmicos e administrativos da plataforma Vestibulando.

Todas as mensagens, áudios, documentos e mídias são monitorados e registrados pela Diretoria para fins de auditoria e segurança.

O envio de conteúdos ofensivos, inapropriados ou fora do contexto educacional pode resultar em suspensão da conta.

Ao utilizar este chat, o usuário concorda com os termos de uso e a política de conduta da plataforma.`;

export default function ChatMessageArea({ conversation, selectedUser, onBack }: ChatMessageAreaProps) {
  const [messageText, setMessageText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [showUserProfile, setShowUserProfile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { userData } = useAuth();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();

  const { messages, conversationId, resolvedConversation, createConversationAndSendMessage } = useChatThread({
    conversation,
    selectedUser,
    currentUserId: userData?.uid,
    currentUserName: userData?.nome,
    currentUserType: userData?.tipo,
  });

  const otherParticipantId = resolvedConversation
    ? (resolvedConversation.participante1Id === userData?.uid
        ? resolvedConversation.participante2Id
        : resolvedConversation.participante1Id)
    : selectedUser?.uid;

  const otherParticipantNome = resolvedConversation
    ? (resolvedConversation.participante1Id === userData?.uid
        ? resolvedConversation.participante2Nome
        : resolvedConversation.participante1Nome)
    : selectedUser?.tipo === "diretor" ? "Diretoria" : selectedUser?.nome;

  const otherParticipantTipo = resolvedConversation
    ? (resolvedConversation.participante1Id === userData?.uid
        ? resolvedConversation.participante2Tipo
        : resolvedConversation.participante1Tipo)
    : selectedUser?.tipo;

  const presenceData = useUserPresence(otherParticipantId);

  const otherParticipant: OtherParticipant | null = otherParticipantId && otherParticipantNome && otherParticipantTipo
    ? {
        id: otherParticipantId,
        nome: otherParticipantNome,
        tipo: otherParticipantTipo,
        isOnline: presenceData.isOnline,
        lastSeen: presenceData.lastSeen,
        lastActivity: presenceData.lastActivity,
      }
    : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!conversationId || !resolvedConversation) return;
    
    const markMessagesAsRead = async () => {
      const unreadMessages = messages.filter(
        (msg) => msg.destinatarioId === userData?.uid && !msg.lida
      );

      for (const msg of unreadMessages) {
        try {
          const msgRef = doc(db, "chat_messages", msg.id);
          await updateDoc(msgRef, {
            lida: true,
            dataLeitura: getNowBrasiliaISO(),
          });
          
          if (userData) {
            await ChatLogger.mensagemLida(
              userData.uid,
              userData.nome,
              conversationId,
              msg.id
            );
          }
        } catch (error) {
          console.error("Erro ao marcar mensagem como lida:", error);
        }
      }

      if (unreadMessages.length > 0) {
        try {
          const conversationRef = doc(db, "chat_conversations", conversationId);
          const conversationSnap = await getDoc(conversationRef);
          
          if (conversationSnap.exists()) {
            const isParticipant1 = resolvedConversation.participante1Id === userData?.uid;
            await updateDoc(conversationRef, {
              [isParticipant1 ? "mensagensNaoLidas1" : "mensagensNaoLidas2"]: 0,
            });
          }
        } catch (error) {
          console.error("Erro ao atualizar contador de não lidas:", error);
        }
      }
    };

    if (messages.length > 0) {
      setTimeout(markMessagesAsRead, 500);
    }
  }, [messages, conversationId, resolvedConversation, userData]);

  // Verificar se usuário está bloqueado
  useEffect(() => {
    const checkBlockStatus = async () => {
      if (!userData?.uid) return;

      const penaltiesRef = collection(db, "chat_penalties");
      const q = query(
        penaltiesRef,
        where("usuarioId", "==", userData.uid),
        where("ativa", "==", true)
      );

      const snapshot = await getDocs(q);
      const activePenalties = snapshot.docs.map(doc => doc.data());

      const bloqueio24h = activePenalties.find(p => p.tipo === "bloqueio_24h");
      if (bloqueio24h) {
        const expiracao = new Date(bloqueio24h.dataExpiracao);
        if (expiracao > new Date()) {
          setBlocked(true);
          setBlockReason("Você está bloqueado por 24 horas devido a violação das regras do chat.");
          return;
        }
      }

      const suspensao = activePenalties.find(p => p.tipo === "suspensao_conta");
      if (suspensao) {
        setBlocked(true);
        setBlockReason("Sua conta foi suspensa. Entre em contato com a Diretoria.");
        return;
      }

      setBlocked(false);
      setBlockReason("");
    };

    checkBlockStatus();
    const interval = setInterval(checkBlockStatus, 60000); // Verificar a cada minuto

    return () => clearInterval(interval);
  }, [userData?.uid]);


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validação avançada de arquivo
    const validation = validateFile(file, 20 * 1024 * 1024);
    
    if (!validation.isValid) {
      if (validation.isDangerous && userData && conversationId) {
        ChatLogger.erroUpload(
          userData.uid,
          userData.nome,
          conversationId,
          file.name,
          validation.error || "Arquivo perigoso detectado"
        );
      }
      
      toast({
        variant: "destructive",
        title: "Arquivo não permitido",
        description: validation.error,
      });
      return;
    }

    setSelectedFile(file);
  };

  const getFileType = (file: File): ChatMessage["tipo"] => {
    if (file.type.startsWith("image/")) return "imagem";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "documento";
  };

  const uploadFile = async (file: File): Promise<string> => {
    if (!conversationId) {
      throw new Error("Conversation ID is required for file upload");
    }
    
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storageRef = ref(storage, `chat/${conversationId}/${fileName}`);
    
    try {
      // Usar retry com backoff exponencial
      const downloadURL = await retryWithBackoff(async () => {
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
      }, 3, 1000);
      
      return downloadURL;
    } catch (error) {
      if (userData && conversationId) {
        ChatLogger.erroUpload(
          userData.uid,
          userData.nome,
          conversationId,
          file.name,
          (error as Error).message
        );
      }
      throw error;
    }
  };

  const sendMessage = async () => {
    if (blocked) {
      toast({
        variant: "destructive",
        title: "Bloqueado",
        description: blockReason,
      });
      return;
    }

    if (!isOnline) {
      toast({
        variant: "destructive",
        title: "Sem conexão",
        description: "Você está offline. Verifique sua conexão com a internet.",
      });
      return;
    }

    if (!messageText.trim() && !selectedFile) return;
    if (!userData?.uid) return;
    if (!otherParticipant) return;

    setSending(true);

    try {
      const messageContent = messageText.trim() || "[arquivo]";
      
      if (!conversationId && selectedUser) {
        const messageData: Partial<ChatMessage> = {
          remetenteId: userData.uid,
          remetenteNome: userData.nome,
          remetenteTipo: userData.tipo,
          destinatarioId: selectedUser.uid,
          destinatarioNome: selectedUser.nome,
          destinatarioTipo: selectedUser.tipo,
          tipo: "texto",
          conteudo: messageContent,
          lida: false,
          deletadaPorRemetente: false,
          deletadaPorDestinatario: false,
        };

        const result = await createConversationAndSendMessage(messageData);
        
        await ChatLogger.mensagemEnviada(
          userData.uid,
          userData.nome,
          result.conversationId,
          result.messageId,
          "texto"
        );

        setMessageText("");
        setSelectedFile(null);
        toast({
          title: "Mensagem enviada",
          description: "Conversa criada e mensagem enviada com sucesso.",
        });
        return;
      }

      if (!conversationId) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível determinar a conversa.",
        });
        return;
      }

      let arquivoUrl: string | undefined;
      let arquivoNome: string | undefined;
      let arquivoTipo: string | undefined;
      let arquivoTamanho: number | undefined;
      let tipoMensagem: ChatMessage["tipo"] = "texto";

      if (selectedFile) {
        setUploading(true);
        arquivoUrl = await uploadFile(selectedFile);
        arquivoNome = selectedFile.name;
        arquivoTipo = selectedFile.type;
        arquivoTamanho = selectedFile.size;
        tipoMensagem = getFileTypeCategory(selectedFile.name) as ChatMessage["tipo"];
        setUploading(false);

        await ChatLogger.arquivoEnviado(
          userData.uid,
          userData.nome,
          conversationId,
          "pending",
          { nome: arquivoNome, tipo: arquivoTipo, tamanho: arquivoTamanho }
        );
      }

      const finalContent = messageText.trim() || `[${tipoMensagem}]`;

      const violation = await checkMessageForViolations(finalContent, userData.uid);
      
      if (violation) {
        await ChatLogger.violacaoDetectada(
          userData.uid,
          userData.nome,
          conversationId,
          finalContent,
          violation.reason || "Violação detectada"
        );

        await applyPenalty(userData.uid, violation, finalContent, conversationId, otherParticipant.id, otherParticipant.nome);
        
        await ChatLogger.penalidadeAplicada(
          userData.uid,
          userData.nome,
          conversationId,
          violation.penaltyMessage || "Penalidade aplicada",
          violation.infractionNumber || 1
        );
        
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

      const messageData: any = {
        conversationId: conversationId,
        remetenteId: userData.uid,
        remetenteNome: userData.nome,
        remetenteTipo: userData.tipo,
        destinatarioId: otherParticipant.id,
        destinatarioNome: otherParticipant.nome,
        destinatarioTipo: otherParticipant.tipo,
        tipo: tipoMensagem,
        conteudo: finalContent,
        timestamp: getNowBrasiliaISO(),
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

      const docRef = await retryWithBackoff(async () => {
        return await addDoc(collection(db, "chat_messages"), messageData);
      }, 3, 1000);

      await ChatLogger.mensagemEnviada(
        userData.uid,
        userData.nome,
        conversationId,
        docRef.id,
        tipoMensagem
      );

      if (resolvedConversation) {
        const conversationRef = doc(db, "chat_conversations", conversationId);
        const conversationSnap = await getDoc(conversationRef);
        
        if (conversationSnap.exists()) {
          const isParticipant1 = resolvedConversation.participante1Id === userData.uid;
          await updateDoc(conversationRef, {
            ultimaMensagem: finalContent.substring(0, 50),
            ultimaMensagemTimestamp: getNowBrasiliaISO(),
            ultimaMensagemRemetenteId: userData.uid,
            [isParticipant1 ? "mensagensNaoLidas2" : "mensagensNaoLidas1"]: 
              ((isParticipant1 ? resolvedConversation.mensagensNaoLidas2 : resolvedConversation.mensagensNaoLidas1) || 0) + 1,
            dataUltimaAtualizacao: getNowBrasiliaISO(),
          });
        }
      }

      setMessageText("");
      setSelectedFile(null);
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      
      if (conversationId) {
        await ChatLogger.erroEnvio(
          userData.uid,
          userData.nome,
          conversationId,
          (error as Error).message
        );
      }
      
      toast({
        variant: "destructive",
        title: "Erro ao enviar",
        description: "Não foi possível enviar a mensagem. Tentando novamente...",
      });
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!userData?.uid || !conversationId) return;

    try {
      const messageRef = doc(db, "chat_messages", messageId);
      const msg = messages.find(m => m.id === messageId);
      const now = new Date().toISOString();
      
      if (msg?.remetenteId === userData.uid) {
        await updateDoc(messageRef, {
          deletadaPorRemetente: true,
          dataDeletadaPorRemetente: now,
        });
        
        await ChatLogger.mensagemDeletada(
          userData.uid,
          userData.nome,
          conversationId,
          messageId,
          "remetente"
        );
      } else {
        await updateDoc(messageRef, {
          deletadaPorDestinatario: true,
          dataDeletadaPorDestinatario: now,
        });
        
        await ChatLogger.mensagemDeletada(
          userData.uid,
          userData.nome,
          conversationId,
          messageId,
          "destinatario"
        );
      }

      toast({
        title: "Mensagem removida",
        description: "A mensagem foi removida da sua visualização.",
      });
    } catch (error) {
      console.error("Erro ao deletar mensagem:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível remover a mensagem.",
      });
    }
  };

  const getFileIcon = (tipo: ChatMessage["tipo"]) => {
    switch (tipo) {
      case "imagem": return <ImageIcon className="h-4 w-4" />;
      case "video": return <Video className="h-4 w-4" />;
      case "audio": return <Music className="h-4 w-4" />;
      case "documento": return <FileText className="h-4 w-4" />;
      default: return <File className="h-4 w-4" />;
    }
  };

  const shouldShowMessage = (msg: ChatMessage) => {
    if (msg.remetenteId === userData?.uid && msg.deletadaPorRemetente) return false;
    if (msg.destinatarioId === userData?.uid && msg.deletadaPorDestinatario) return false;
    return true;
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

  if (!otherParticipant) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-muted-foreground">Selecione uma conversa para começar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b">
        <Button
          size="icon"
          variant="ghost"
          onClick={onBack}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="relative">
          <Avatar className="h-10 w-10">
            <AvatarFallback>{getInitials(otherParticipant.nome)}</AvatarFallback>
          </Avatar>
          <div
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${
              otherParticipant.isOnline ? "bg-green-500" : "bg-gray-400"
            }`}
          />
        </div>
        <div className="flex-1">
          <p className="font-medium">{otherParticipant.nome}</p>
          <PresenceIndicator 
            isOnline={otherParticipant.isOnline}
            lastSeen={otherParticipant.lastSeen}
            lastActivity={otherParticipant.lastActivity}
            variant="text"
            showLabel={true}
          />
        </div>
        
        {!isOnline && (
          <Badge variant="destructive" className="gap-1">
            <WifiOff className="h-3 w-3" />
            Sem conexão
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-line">
            {INSTITUTIONAL_MESSAGE}
          </AlertDescription>
        </Alert>

        {messages.filter(shouldShowMessage).map((msg) => {
          const isOwn = msg.remetenteId === userData?.uid;

          return (
            <div
              key={msg.id}
              className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
              data-testid={`message-${msg.id}`}
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="text-xs">
                  {getInitials(isOwn ? userData.nome : otherParticipant.nome)}
                </AvatarFallback>
              </Avatar>

              <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[70%]`}>
                <div
                  className={`rounded-lg p-3 ${
                    isOwn 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted"
                  }`}
                >
                  {msg.arquivoUrl && msg.tipo === "imagem" && (
                    <img
                      src={msg.arquivoUrl}
                      alt={msg.arquivoNome || "Imagem"}
                      className="max-w-full rounded mb-2 max-h-64 object-contain"
                    />
                  )}

                  {msg.arquivoUrl && msg.tipo === "video" && (
                    <video
                      src={msg.arquivoUrl}
                      controls
                      className="max-w-full rounded mb-2 max-h-64"
                    />
                  )}

                  {msg.arquivoUrl && msg.tipo === "audio" && (
                    <audio
                      src={msg.arquivoUrl}
                      controls
                      className="mb-2"
                    />
                  )}

                  {msg.arquivoUrl && msg.tipo === "documento" && (
                    <a
                      href={msg.arquivoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 mb-2 hover:underline"
                    >
                      {getFileIcon(msg.tipo)}
                      <span className="text-sm">{msg.arquivoNome}</span>
                    </a>
                  )}

                  <p className="text-sm">{msg.conteudo}</p>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                  {isOwn && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5"
                      onClick={() => deleteMessage(msg.id)}
                      data-testid={`button-delete-${msg.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t">
        {!isOnline && (
          <Alert variant="destructive" className="mb-4">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>Você está offline. Conecte-se à internet para enviar mensagens.</AlertDescription>
          </Alert>
        )}
        
        {blocked && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{blockReason}</AlertDescription>
          </Alert>
        )}

        {selectedFile && (
          <div className="mb-2 flex items-center gap-2 p-2 bg-muted rounded">
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

        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          />
          
          <Button
            size="icon"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || sending || blocked || !isOnline}
            data-testid="button-attach-file"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <Input
            placeholder={
              !isOnline 
                ? "Sem conexão..." 
                : blocked 
                ? "Chat bloqueado" 
                : uploading 
                ? "Enviando arquivo..." 
                : "Digite sua mensagem..."
            }
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={uploading || sending || blocked || !isOnline}
            data-testid="input-message"
          />

          <Button
            onClick={sendMessage}
            disabled={(!messageText.trim() && !selectedFile) || uploading || sending || blocked || !isOnline}
            data-testid="button-send-message"
          >
            {uploading ? "..." : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
