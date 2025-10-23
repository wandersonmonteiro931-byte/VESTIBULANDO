import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Paperclip, X, File, Image as ImageIcon, Video, Music, FileText, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, serverTimestamp, orderBy, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { ChatMessage, ChatConversation, User } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { checkMessageForViolations, applyPenalty } from "@/lib/chatModeration";

interface ChatMessageAreaProps {
  conversation: ChatConversation;
  onBack: () => void;
}

const INSTITUTIONAL_MESSAGE = `⚠️ Atenção: Este canal é exclusivo para assuntos acadêmicos e administrativos da plataforma Vestibulando.

Todas as mensagens, áudios, documentos e mídias são monitorados e registrados pela Diretoria para fins de auditoria e segurança.

O envio de conteúdos ofensivos, inapropriados ou fora do contexto educacional pode resultar em suspensão da conta.

Ao utilizar este chat, o usuário concorda com os termos de uso e a política de conduta da plataforma.`;

export default function ChatMessageArea({ conversation, onBack }: ChatMessageAreaProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { userData } = useAuth();
  const { toast } = useToast();

  const otherParticipant = conversation.participante1Id === userData?.uid
    ? {
        id: conversation.participante2Id,
        nome: conversation.participante2Nome,
        tipo: conversation.participante2Tipo,
      }
    : {
        id: conversation.participante1Id,
        nome: conversation.participante1Nome,
        tipo: conversation.participante1Tipo,
      };

  useEffect(() => {
    if (!conversation.id) return;

    const messagesRef = collection(db, "chatMessages");
    const q = query(
      messagesRef,
      where("conversationId", "==", conversation.id),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      setMessages(msgs);
      
      // Marcar mensagens como lidas
      setTimeout(() => markMessagesAsRead(msgs), 500);
    });

    return unsubscribe;
  }, [conversation.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Verificar se usuário está bloqueado
  useEffect(() => {
    const checkBlockStatus = async () => {
      if (!userData?.uid) return;

      const penaltiesRef = collection(db, "chatPenalties");
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

  const markMessagesAsRead = async (msgs: ChatMessage[]) => {
    const unreadMessages = msgs.filter(
      (msg) => msg.destinatarioId === userData?.uid && !msg.lida
    );

    for (const msg of unreadMessages) {
      try {
        const msgRef = doc(db, "chatMessages", msg.id);
        await updateDoc(msgRef, {
          lida: true,
          dataLeitura: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Erro ao marcar mensagem como lida:", error);
      }
    }

    if (unreadMessages.length > 0) {
      try {
        const conversationRef = doc(db, "chatConversations", conversation.id);
        const isParticipant1 = conversation.participante1Id === userData?.uid;
        await updateDoc(conversationRef, {
          [isParticipant1 ? "mensagensNaoLidas1" : "mensagensNaoLidas2"]: 0,
        });
      } catch (error) {
        console.error("Erro ao atualizar contador de não lidas:", error);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      toast({
        variant: "destructive",
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 20MB.",
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
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storageRef = ref(storage, `chat/${conversation.id}/${fileName}`);
    
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    
    return downloadURL;
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

    if (!messageText.trim() && !selectedFile) return;
    if (!userData?.uid) return;

    setSending(true);

    try {
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
        tipoMensagem = getFileType(selectedFile);
        setUploading(false);
      }

      const messageContent = messageText.trim() || `[${tipoMensagem}]`;

      // Verificar se a mensagem viola as regras
      const violation = await checkMessageForViolations(messageContent, userData.uid);
      
      if (violation) {
        await applyPenalty(userData.uid, violation, messageContent, conversation.id, otherParticipant.id, otherParticipant.nome);
        
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

      const messageData = {
        conversationId: conversation.id,
        remetenteId: userData.uid,
        remetenteNome: userData.nome,
        remetenteTipo: userData.tipo,
        destinatarioId: otherParticipant.id,
        destinatarioNome: otherParticipant.nome,
        destinatarioTipo: otherParticipant.tipo,
        tipo: tipoMensagem,
        conteudo: messageContent,
        arquivoUrl,
        arquivoNome,
        arquivoTipo,
        arquivoTamanho,
        timestamp: new Date().toISOString(),
        lida: false,
        deletadaPorRemetente: false,
        deletadaPorDestinatario: false,
      };

      await addDoc(collection(db, "chatMessages"), messageData);

      // Atualizar a conversa
      const conversationRef = doc(db, "chatConversations", conversation.id);
      const isParticipant1 = conversation.participante1Id === userData.uid;
      await updateDoc(conversationRef, {
        ultimaMensagem: messageContent.substring(0, 50),
        ultimaMensagemTimestamp: new Date().toISOString(),
        ultimaMensagemRemetenteId: userData.uid,
        [isParticipant1 ? "mensagensNaoLidas2" : "mensagensNaoLidas1"]: 
          (isParticipant1 ? conversation.mensagensNaoLidas2 : conversation.mensagensNaoLidas1) + 1,
        dataUltimaAtualizacao: new Date().toISOString(),
      });

      setMessageText("");
      setSelectedFile(null);
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

  const deleteMessage = async (messageId: string) => {
    if (!userData?.uid) return;

    try {
      const messageRef = doc(db, "chatMessages", messageId);
      const msg = messages.find(m => m.id === messageId);
      
      if (msg?.remetenteId === userData.uid) {
        await updateDoc(messageRef, {
          deletadaPorRemetente: true,
        });
      } else {
        await updateDoc(messageRef, {
          deletadaPorDestinatario: true,
        });
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
        <Avatar className="h-10 w-10">
          <AvatarFallback>{getInitials(otherParticipant.nome)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="font-medium">{otherParticipant.nome}</p>
          <p className="text-sm text-muted-foreground capitalize">{otherParticipant.tipo}</p>
        </div>
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
            disabled={uploading || sending || blocked}
            data-testid="button-attach-file"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <Input
            placeholder={blocked ? "Chat bloqueado" : "Digite sua mensagem..."}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={uploading || sending || blocked}
            data-testid="input-message"
          />

          <Button
            onClick={sendMessage}
            disabled={(!messageText.trim() && !selectedFile) || uploading || sending || blocked}
            data-testid="button-send-message"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
