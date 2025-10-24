import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Paperclip, X, File, Image as ImageIcon, Video, Music, FileText, Trash2, AlertTriangle, WifiOff, Wifi, User as UserIcon, MoreVertical, Flag, UserX } from "lucide-react";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { TypingIndicator } from "@/components/TypingIndicator";
import { MessageStatusIndicator } from "@/components/MessageStatusIndicator";
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
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { checkMessageForViolations, applyPenalty } from "@/lib/chatModeration";
import { ChatLogger } from "@/lib/chatLogger";
import { validateFile, getFileTypeCategory } from "@/lib/fileValidation";
import { useNetworkStatus, retryWithBackoff } from "@/hooks/useNetworkStatus";
import { useChatThread } from "@/hooks/useChatThread";
import { useUserPresence } from "@/hooks/useUserPresence";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import UserProfileDialog from "@/components/UserProfileDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ReportDialog, BlockDialog, DeleteDialog } from "@/components/ChatModerationDialogs";

interface ChatMessageAreaProps {
  conversation?: ChatConversation;
  selectedUser?: User;
  onBack: () => void;
  onOpenTerms: () => void;
  onStartVideoCall?: () => void;
  onStartAudioCall?: () => void;
}

interface OtherParticipant {
  id: string;
  nome: string;
  tipo: string;
  isOnline?: boolean;
  lastSeen?: string;
  lastActivity?: string;
  fotoBase64?: string;
  fotoPublica?: boolean;
}


export default function ChatMessageArea({ conversation, selectedUser, onBack, onOpenTerms, onStartVideoCall, onStartAudioCall }: ChatMessageAreaProps) {
  const [messageText, setMessageText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [contextMenuMessage, setContextMenuMessage] = useState<string | null>(null);
  const [usersCache, setUsersCache] = useState<Map<string, User>>(new Map());
  const [otherUserData, setOtherUserData] = useState<User | null>(null);
  
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
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

  const otherParticipantTipo = resolvedConversation
    ? (resolvedConversation.participante1Id === userData?.uid
        ? resolvedConversation.participante2Tipo
        : resolvedConversation.participante1Tipo)
    : selectedUser?.tipo;

  const otherParticipantNome = resolvedConversation
    ? (resolvedConversation.participante1Id === userData?.uid
        ? (resolvedConversation.participante2Tipo === "diretor" ? "Diretoria" : resolvedConversation.participante2Nome)
        : (resolvedConversation.participante1Tipo === "diretor" ? "Diretoria" : resolvedConversation.participante1Nome))
    : selectedUser?.tipo === "diretor" ? "Diretoria" : selectedUser?.nome;

  const presenceData = useUserPresence(otherParticipantId);

  const isParticipant1 = resolvedConversation 
    ? resolvedConversation.participante1Id === userData?.uid
    : false;

  const { otherUserTyping, onTyping, stopTyping } = useTypingIndicator({
    conversationId: conversationId || undefined,
    currentUserId: userData?.uid,
    isParticipant1: isParticipant1,
  });

  useEffect(() => {
    const fetchOtherUserData = async () => {
      if (!otherParticipantId) return;
      
      if (selectedUser && selectedUser.uid === otherParticipantId) {
        setOtherUserData(selectedUser);
        return;
      }
      
      try {
        const userRef = doc(db, "usuarios", otherParticipantId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const user = { uid: userSnap.id, ...userSnap.data() } as User;
          setOtherUserData(user);
        }
      } catch (error) {
        console.error("Erro ao buscar dados do usuário:", error);
      }
    };
    
    fetchOtherUserData();
  }, [otherParticipantId, selectedUser]);

  useEffect(() => {
    const checkForBlocks = async () => {
      if (!userData?.uid || !otherParticipantId) return;

      try {
        const blocksRef = collection(db, "user_blocks");
        const q1 = query(
          blocksRef,
          where("bloqueadorId", "==", userData.uid),
          where("bloqueadoId", "==", otherParticipantId),
          where("ativo", "==", true)
        );
        const q2 = query(
          blocksRef,
          where("bloqueadorId", "==", otherParticipantId),
          where("bloqueadoId", "==", userData.uid),
          where("ativo", "==", true)
        );

        const [snapshot1, snapshot2] = await Promise.all([
          getDocs(q1),
          getDocs(q2),
        ]);

        if (!snapshot1.empty) {
          const blockDoc = snapshot1.docs[0].data();
          setBlocked(true);
          setBlockReason(`Você bloqueou ${blockDoc.bloqueadoNome}. Não é possível enviar mensagens.`);
        } else if (!snapshot2.empty) {
          const blockDoc = snapshot2.docs[0].data();
          setBlocked(true);
          setBlockReason(`Você foi bloqueado por ${blockDoc.bloqueadorNome}. Não é possível enviar mensagens.`);
        } else {
          setBlocked(false);
          setBlockReason("");
        }
      } catch (error) {
        console.error("Erro ao verificar bloqueios:", error);
      }
    };

    checkForBlocks();
  }, [userData?.uid, otherParticipantId]);

  const otherParticipant: OtherParticipant | null = otherParticipantId && otherParticipantNome && otherParticipantTipo
    ? {
        id: otherParticipantId,
        nome: otherParticipantNome,
        tipo: otherParticipantTipo,
        isOnline: presenceData.isOnline,
        lastSeen: presenceData.lastSeen,
        lastActivity: presenceData.lastActivity,
        fotoBase64: otherUserData?.fotoBase64,
        fotoPublica: otherUserData?.fotoPublica,
      }
    : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, otherUserTyping]);

  useEffect(() => {
    if (!conversationId || !resolvedConversation) return;
    
    const markMessagesAsDeliveredAndRead = async () => {
      const myMessages = messages.filter(
        (msg) => msg.destinatarioId === userData?.uid
      );

      const undeliveredMessages = myMessages.filter((msg) => !msg.entregue);
      const unreadMessages = myMessages.filter((msg) => !msg.lida);

      for (const msg of undeliveredMessages) {
        try {
          const msgRef = doc(db, "chat_messages", msg.id);
          await updateDoc(msgRef, {
            entregue: true,
            dataEntrega: getNowBrasiliaISO(),
          });
        } catch (error) {
          console.error("Erro ao marcar mensagem como entregue:", error);
        }
      }

      for (const msg of unreadMessages) {
        try {
          const msgRef = doc(db, "chat_messages", msg.id);
          await updateDoc(msgRef, {
            lida: true,
            dataLeitura: getNowBrasiliaISO(),
            entregue: true,
            dataEntrega: msg.entregue ? msg.dataEntrega : getNowBrasiliaISO(),
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

      if (unreadMessages.length > 0 || undeliveredMessages.length > 0) {
        try {
          const conversationRef = doc(db, "chat_conversations", conversationId);
          const conversationSnap = await getDoc(conversationRef);
          
          if (conversationSnap.exists()) {
            const isParticipant1 = resolvedConversation.participante1Id === userData?.uid;
            const conversation = conversationSnap.data();
            
            // Atualizar contador de não lidas
            const updateData: any = {
              [isParticipant1 ? "mensagensNaoLidas1" : "mensagensNaoLidas2"]: 0,
            };
            
            // Se a última mensagem foi enviada para mim (não foi eu quem enviou)
            if (conversation.ultimaMensagemRemetenteId !== userData?.uid) {
              // Atualizar status de entrega e leitura da última mensagem
              if (undeliveredMessages.length > 0) {
                updateData.ultimaMensagemEntregue = true;
              }
              if (unreadMessages.length > 0) {
                updateData.ultimaMensagemLida = true;
              }
            }
            
            await updateDoc(conversationRef, updateData);
          }
        } catch (error) {
          console.error("Erro ao atualizar contador de não lidas:", error);
        }
      }
    };

    if (messages.length > 0) {
      setTimeout(markMessagesAsDeliveredAndRead, 500);
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
            ultimaMensagemEntregue: false,
            ultimaMensagemLida: false,
            [isParticipant1 ? "mensagensNaoLidas2" : "mensagensNaoLidas1"]: 
              ((isParticipant1 ? resolvedConversation.mensagensNaoLidas2 : resolvedConversation.mensagensNaoLidas1) || 0) + 1,
            dataUltimaAtualizacao: getNowBrasiliaISO(),
          });
        }
      }

      setMessageText("");
      setSelectedFile(null);
      stopTyping();
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
      const now = getNowBrasiliaISO();
      
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

  const deleteMessageForEveryone = async (messageId: string) => {
    if (!userData?.uid || !conversationId) return;

    const msg = messages.find(m => m.id === messageId);
    
    // Só o remetente pode deletar para todos
    if (msg?.remetenteId !== userData.uid) {
      toast({
        variant: "destructive",
        title: "Permissão negada",
        description: "Apenas o remetente pode apagar a mensagem para todos.",
      });
      return;
    }

    try {
      const messageRef = doc(db, "chat_messages", messageId);
      const now = getNowBrasiliaISO();
      
      await updateDoc(messageRef, {
        deletadaPorRemetente: true,
        dataDeletadaPorRemetente: now,
        deletadaPorDestinatario: true,
        dataDeletadaPorDestinatario: now,
      });
      
      await ChatLogger.mensagemDeletada(
        userData.uid,
        userData.nome,
        conversationId,
        messageId,
        "remetente"
      );

      toast({
        title: "Mensagem apagada",
        description: "A mensagem foi removida para todos.",
      });
    } catch (error) {
      console.error("Erro ao deletar mensagem para todos:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível apagar a mensagem.",
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
      return format(date, "HH:mm", { locale: ptBR });
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

  const getPresenceText = () => {
    if (presenceData.isLoading) {
      return "";
    }
    
    if (otherParticipant?.isOnline) {
      return "Online agora";
    }
    
    if (!otherParticipant?.lastSeen) {
      return "Nunca visto";
    }
    
    try {
      const date = new Date(otherParticipant.lastSeen);
      
      if (isNaN(date.getTime())) {
        return "Nunca visto";
      }
      
      const time = format(date, "HH:mm", { locale: ptBR });
      
      if (isToday(date)) {
        return `Visto por último hoje às ${time}`;
      } else if (isYesterday(date)) {
        return `Visto por último ontem às ${time}`;
      } else {
        const dateStr = format(date, "dd/MM/yy", { locale: ptBR });
        return `Visto por último em ${dateStr} às ${time}`;
      }
    } catch (error) {
      return "Nunca visto";
    }
  };

  const handleReportConversation = async (motivo: string) => {
    if (!userData?.uid || !conversationId || !otherParticipant) return;

    setReportLoading(true);
    try {
      await addDoc(collection(db, "chat_reports"), {
        conversationId,
        denuncianteId: userData.uid,
        denuncianteNome: userData.nome,
        denuncianteTipo: userData.tipo,
        denunciadoId: otherParticipant.id,
        denunciadoNome: otherParticipant.nome,
        denunciadoTipo: otherParticipant.tipo,
        motivo,
        dataDenuncia: getNowBrasiliaISO(),
        status: "pendente",
      });

      toast({
        title: "Denúncia enviada",
        description: "Sua denúncia foi enviada ao diretor para análise.",
      });

      setShowReportDialog(false);
    } catch (error) {
      console.error("Erro ao enviar denúncia:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível enviar a denúncia. Tente novamente.",
      });
    } finally {
      setReportLoading(false);
    }
  };

  const handleBlockUser = async () => {
    if (!userData?.uid || !otherParticipant) return;

    setBlockLoading(true);
    try {
      await addDoc(collection(db, "user_blocks"), {
        bloqueadorId: userData.uid,
        bloqueadorNome: userData.nome,
        bloqueadoId: otherParticipant.id,
        bloqueadoNome: otherParticipant.nome,
        dataBloqueio: getNowBrasiliaISO(),
        ativo: true,
      });

      toast({
        title: "Usuário bloqueado",
        description: `Você bloqueou ${otherParticipant.nome}. Vocês não poderão mais trocar mensagens.`,
      });

      setShowBlockDialog(false);
      
      setBlocked(true);
      setBlockReason(`Você bloqueou ${otherParticipant.nome}. Não é possível enviar mensagens.`);
    } catch (error) {
      console.error("Erro ao bloquear usuário:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível bloquear o usuário. Tente novamente.",
      });
    } finally {
      setBlockLoading(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!userData?.uid || !conversationId || !resolvedConversation) return;

    setDeleteLoading(true);
    try {
      const conversationRef = doc(db, "chat_conversations", conversationId);
      const isParticipant1 = resolvedConversation.participante1Id === userData.uid;
      
      await updateDoc(conversationRef, {
        [isParticipant1 ? "deletadaPorParticipante1" : "deletadaPorParticipante2"]: true,
        [isParticipant1 ? "dataDelecaoParticipante1" : "dataDelecaoParticipante2"]: getNowBrasiliaISO(),
      });

      toast({
        title: "Conversa excluída",
        description: "O histórico da conversa foi removido da sua visualização.",
      });

      setShowDeleteDialog(false);
      
      setTimeout(() => {
        onBack();
      }, 500);
    } catch (error) {
      console.error("Erro ao excluir conversa:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir a conversa. Tente novamente.",
      });
    } finally {
      setDeleteLoading(false);
    }
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
      <div className="flex items-center gap-3 p-3 whatsapp-header shadow-sm">
        <Button
          size="icon"
          variant="ghost"
          onClick={onBack}
          data-testid="button-back"
          className="text-white dark:text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div 
          className="relative cursor-pointer hover:bg-white/10 rounded-full p-1 -m-1"
          onClick={() => setShowUserProfile(true)}
          data-testid="button-open-user-profile"
        >
          <Avatar className="h-10 w-10">
            {otherParticipant.fotoBase64 && otherParticipant.fotoPublica ? (
              <AvatarImage src={otherParticipant.fotoBase64} alt={otherParticipant.nome} />
            ) : null}
            <AvatarFallback>{getInitials(otherParticipant.nome)}</AvatarFallback>
          </Avatar>
          <div
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
              otherParticipant.isOnline ? "bg-green-500" : "bg-gray-400"
            }`}
          />
        </div>
        <div 
          className="flex-1 cursor-pointer hover:bg-white/10 rounded p-2 -m-2"
          onClick={() => setShowUserProfile(true)}
        >
          <p className="font-medium text-white">{otherParticipant.nome}</p>
          <p className="text-xs text-white/80">
            {getPresenceText()}
          </p>
        </div>
        
        {!isOnline && (
          <Badge variant="destructive" className="gap-1">
            <WifiOff className="h-3 w-3" />
            Sem conexão
          </Badge>
        )}
        
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="text-white"
              data-testid="button-chat-menu"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]" sideOffset={8}>
            <DropdownMenuItem
              onClick={() => setShowUserProfile(true)}
              className="cursor-pointer"
              data-testid="menu-view-profile"
            >
              <UserIcon className="h-4 w-4 mr-2" />
              Ver perfil
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onOpenTerms}
              className="cursor-pointer"
              data-testid="menu-view-terms"
            >
              <FileText className="h-4 w-4 mr-2" />
              Termos de uso
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowReportDialog(true)}
              className="text-destructive focus:text-destructive cursor-pointer"
              data-testid="menu-report-conversation"
            >
              <Flag className="h-4 w-4 mr-2" />
              Denunciar conversa
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowBlockDialog(true)}
              className="text-destructive focus:text-destructive cursor-pointer"
              data-testid="menu-block-user"
            >
              <UserX className="h-4 w-4 mr-2" />
              Bloquear
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive focus:text-destructive cursor-pointer"
              data-testid="menu-delete-conversation"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir conversa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-4 space-y-2 whatsapp-bg">
        <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-sm text-amber-900 dark:text-amber-100">
            <p className="font-bold mb-2">ATENÇÃO: Antes de iniciar sua conversa, leia atentamente:</p>
            <ul className="space-y-1 list-none">
              <li>💬 Este chat é exclusivo para assuntos acadêmicos e administrativos.</li>
              <li>🚫 É proibido enviar mensagens ofensivas, discriminatórias, políticas, religiosas, propagandas, correntes ou qualquer conteúdo que desrespeite outros usuários.</li>
              <li>📜 Toda a comunicação é monitorada e registrada pela Diretoria, conforme os Termos de Uso e a Lei nº 13.709/2018 (LGPD).</li>
              <li>⚖️ Condutas inadequadas poderão resultar em advertência, suspensão ou outras medidas cabíveis, conforme o Código Civil (Lei nº 10.406/2002) e a Lei nº 9.394/1996 (LDB).</li>
            </ul>
            <p className="mt-3">
              Ao continuar, você declara estar ciente e de acordo com as Regras do Chat e Termos de Uso da Plataforma Vestibulando. 
              Acesse clicando{" "}
              <button
                onClick={onOpenTerms}
                className="underline font-semibold hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                data-testid="link-open-terms"
              >
                aqui
              </button>.
            </p>
          </AlertDescription>
        </Alert>

        {messages.filter(shouldShowMessage).map((msg) => {
          const isOwn = msg.remetenteId === userData?.uid;

          return (
            <div
              key={msg.id}
              className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              data-testid={`message-${msg.id}`}
            >
              <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[85%] md:max-w-[70%] group`}>
                <div className="relative">
                  <div
                    className={`p-2 px-3 ${
                      isOwn 
                        ? "message-sent" 
                        : "message-received"
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

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm flex-1">{msg.conteudo}</p>
                    </div>
                    <div className={`flex items-center gap-1 justify-end text-xs mt-1 ${
                      isOwn ? 'text-gray-600 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      <span>{formatTimestamp(msg.timestamp)}</span>
                      <MessageStatusIndicator
                        entregue={msg.entregue || false}
                        lida={msg.lida || false}
                        isSentByMe={isOwn}
                      />
                    </div>
                  </div>

                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className={`absolute ${isOwn ? '-left-8' : '-right-8'} top-1 h-6 w-6 md:opacity-0 md:group-hover:opacity-100 transition-opacity`}
                        data-testid={`button-message-menu-${msg.id}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isOwn ? "end" : "start"} className="min-w-[180px]" sideOffset={8}>
                      <DropdownMenuItem
                        onClick={() => deleteMessage(msg.id)}
                        className="cursor-pointer"
                        data-testid={`button-delete-for-me-${msg.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Apagar para mim
                      </DropdownMenuItem>
                      {isOwn && (
                        <DropdownMenuItem
                          onClick={() => deleteMessageForEveryone(msg.id)}
                          className="text-destructive cursor-pointer"
                          data-testid={`button-delete-for-all-${msg.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Apagar para todos
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          );
        })}

        <TypingIndicator 
          userName={otherParticipantNome || "Usuário"}
          show={otherUserTyping}
        />

        <div ref={messagesEndRef} />
      </div>

      <div className="p-2 whatsapp-input-area">
        {!isOnline && (
          <Alert variant="destructive" className="mb-2 mx-2">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>Você está offline. Conecte-se à internet para enviar mensagens.</AlertDescription>
          </Alert>
        )}
        
        {blocked && (
          <Alert variant="destructive" className="mb-2 mx-2">
            <AlertDescription>{blockReason}</AlertDescription>
          </Alert>
        )}

        {selectedFile && (
          <div className="mb-2 mx-2 flex items-center gap-2 p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
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

        <div className="flex items-center gap-2 px-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          />
          
          <Button
            size="icon"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || sending || blocked || !isOnline}
            data-testid="button-attach-file"
            className="flex-shrink-0 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
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
                : "Mensagem"
            }
            value={messageText}
            onChange={(e) => {
              setMessageText(e.target.value);
              onTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={uploading || sending || blocked || !isOnline}
            data-testid="input-message"
            className="flex-1 bg-white dark:bg-gray-700 border-0 rounded-full px-4"
          />

          <Button
            onClick={sendMessage}
            disabled={(!messageText.trim() && !selectedFile) || uploading || sending || blocked || !isOnline}
            data-testid="button-send-message"
            size="icon"
            className="flex-shrink-0 rounded-full bg-[#008069] hover:bg-[#006d56] dark:bg-[#005c4b] dark:hover:bg-[#004d3f] text-white"
          >
            {uploading ? "..." : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {showUserProfile && otherParticipant && (
        <UserProfileDialog
          userId={otherParticipant.id}
          onClose={() => setShowUserProfile(false)}
        />
      )}

      {otherParticipant && (
        <>
          <ReportDialog
            open={showReportDialog}
            onOpenChange={setShowReportDialog}
            otherUserName={otherParticipant.nome}
            onConfirm={handleReportConversation}
            isLoading={reportLoading}
          />
          <BlockDialog
            open={showBlockDialog}
            onOpenChange={setShowBlockDialog}
            otherUserName={otherParticipant.nome}
            onConfirm={handleBlockUser}
            isLoading={blockLoading}
          />
          <DeleteDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            otherUserName={otherParticipant.nome}
            onConfirm={handleDeleteConversation}
            isLoading={deleteLoading}
          />
        </>
      )}
    </div>
  );
}
