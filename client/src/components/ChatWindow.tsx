import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Send, Paperclip, Smile, Ban, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatConversation, ChatMessage } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useSendMessage } from "@/hooks/useSendMessage";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { TypingIndicator } from "@/components/TypingIndicator";
import { formatBrasiliaTime, formatBrasiliaDate } from "@/lib/brasiliaTime";
import UserProfileDialog from "@/components/UserProfileDialog";
import { useUserData } from "@/hooks/useUserData";
import watermarkLogo from "@/assets/watermark-logo.png";
import { UserPresenceIndicator } from "@/components/UserPresenceIndicator";
import { MessageContextMenu } from "@/components/MessageContextMenu";
import { useDeleteMessage } from "@/hooks/useDeleteMessage";
import { useToast } from "@/hooks/use-toast";
import { ConversationOptionsMenu } from "@/components/ConversationOptionsMenu";
import { BlockConfirmDialog } from "@/components/BlockConfirmDialog";
import { DeleteConversationDialog } from "@/components/DeleteConversationDialog";
import { ReportConversationDialog } from "@/components/ReportConversationDialog";
import { useBlockUser } from "@/hooks/useBlockUser";
import { useDeleteConversation } from "@/hooks/useDeleteConversation";
import { useReportConversation } from "@/hooks/useReportConversation";
import { useLocation } from "wouter";
import { ChatTermsNotice } from "@/components/ChatTermsNotice";
import type { ConversationWithBlockInfo } from "@/hooks/useChatConversations";

interface ChatWindowProps {
  conversation: ConversationWithBlockInfo;
  onBack: () => void;
}

export default function ChatWindow({ conversation, onBack }: ChatWindowProps) {
  const { userData } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const otherParticipant =
    conversation.participante1Id === userData?.uid
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

  const { userData: otherUserData } = useUserData(otherParticipant.id);

  const { messages = [], isLoading } = useChatMessages(conversation.id);
  const { sendMessage: sendMsg, isLoading: isSending } = useSendMessage();
  const { deleteMessage } = useDeleteMessage();
  const { blockUser, unblockUser } = useBlockUser();
  const { deleteConversation } = useDeleteConversation();
  const { reportConversation, isLoading: isReporting } = useReportConversation();
  
  const isParticipant1 = conversation.participante1Id === userData?.uid;
  const { otherUserTyping, handleTyping, stopTyping } = useTypingIndicator({
    conversationId: conversation.id,
    userId: userData?.uid || "",
    isParticipant1
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, otherUserTyping]);

  useEffect(() => {
    // Scroll automático quando carregar mensagens
    scrollToBottom();
  }, []);

  const handleSendMessage = async () => {
    if (message.trim() && !isSending) {
      try {
        stopTyping();
        await sendMsg({
          conversationId: conversation.id,
          destinatarioId: otherParticipant.id,
          destinatarioNome: otherParticipant.nome,
          destinatarioTipo: otherParticipant.tipo,
          conteudo: message.trim(),
          tipo: "texto",
        });
        setMessage("");
        scrollToBottom();
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (timestamp: string) => {
    return formatBrasiliaTime(timestamp);
  };

  const formatMessageDate = (timestamp: string) => {
    return formatBrasiliaDate(timestamp);
  };

  const groupMessagesByDate = (messages: ChatMessage[]) => {
    const groups: { [key: string]: ChatMessage[] } = {};
    
    messages.forEach((msg) => {
      const dateKey = formatMessageDate(msg.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(msg);
    });

    return groups;
  };

  const handleMessagePressStart = (messageId: string, event: React.MouseEvent | React.TouchEvent) => {
    const isTouchEvent = 'touches' in event;
    const clientX = isTouchEvent ? event.touches[0].clientX : event.clientX;
    const clientY = isTouchEvent ? event.touches[0].clientY : event.clientY;

    pressTimerRef.current = setTimeout(() => {
      setSelectedMessageId(messageId);
      setContextMenuPosition({ x: clientX, y: clientY });
      setShowContextMenu(true);
    }, 500);
  };

  const handleMessagePressEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleDeleteForMe = async () => {
    if (!selectedMessageId) return;

    try {
      await deleteMessage({
        messageId: selectedMessageId,
        deleteForEveryone: false,
      });
      
      toast({
        title: "Mensagem excluída",
        description: "A mensagem foi excluída para você.",
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      toast({
        title: "Erro ao excluir mensagem",
        description: "Não foi possível excluir a mensagem.",
        variant: "destructive",
      });
    } finally {
      setShowContextMenu(false);
      setSelectedMessageId(null);
    }
  };

  const handleDeleteForEveryone = async () => {
    if (!selectedMessageId) return;

    try {
      await deleteMessage({
        messageId: selectedMessageId,
        deleteForEveryone: true,
      });
      
      toast({
        title: "Mensagem excluída",
        description: "A mensagem foi excluída para todos.",
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      toast({
        title: "Erro ao excluir mensagem",
        description: "Não foi possível excluir a mensagem.",
        variant: "destructive",
      });
    } finally {
      setShowContextMenu(false);
      setSelectedMessageId(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showContextMenu) {
        setShowContextMenu(false);
        setSelectedMessageId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showContextMenu]);

  const handleBlock = () => {
    setShowBlockDialog(true);
  };

  const handleConfirmBlock = async () => {
    try {
      await blockUser({
        blockedUserId: otherParticipant.id,
        blockedUserName: otherParticipant.nome,
      });

      toast({
        title: "Usuário bloqueado",
        description: "Você não poderá mais enviar ou receber mensagens desta pessoa.",
      });

      setShowBlockDialog(false);
    } catch (error) {
      console.error("Error blocking user:", error);
      toast({
        title: "Erro ao bloquear",
        description: "Não foi possível bloquear o usuário.",
        variant: "destructive",
      });
    }
  };

  const handleUnblock = async () => {
    try {
      await unblockUser(otherParticipant.id);

      toast({
        title: "Usuário desbloqueado",
        description: "Você pode voltar a trocar mensagens com esta pessoa.",
      });
    } catch (error) {
      console.error("Error unblocking user:", error);
      toast({
        title: "Erro ao desbloquear",
        description: "Não foi possível desbloquear o usuário.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteConversation({
        conversationId: conversation.id,
      });

      toast({
        title: "Conversa excluída",
        description: "A conversa foi excluída apenas para você.",
      });

      setShowDeleteDialog(false);
      navigate("/chat");
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast({
        title: "Erro ao excluir conversa",
        description: "Não foi possível excluir a conversa.",
        variant: "destructive",
      });
    }
  };

  const handleReport = () => {
    setShowReportDialog(true);
  };

  const handleConfirmReport = async (reason: string) => {
    try {
      await reportConversation({
        conversationId: conversation.id,
        reportedUserId: otherParticipant.id,
        reportedUserName: otherParticipant.nome,
        reportedUserType: otherParticipant.tipo,
        reason,
      });

      toast({
        title: "Denúncia enviada",
        description: "A denúncia foi enviada para análise da diretoria.",
      });

      setShowReportDialog(false);
    } catch (error) {
      console.error("Error reporting conversation:", error);
      toast({
        title: "Erro ao denunciar",
        description: "Não foi possível enviar a denúncia.",
        variant: "destructive",
      });
    }
  };

  const messageGroups = groupMessagesByDate(messages);

  if (!userData) return null;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="chat-header-fixed whatsapp-header flex items-center gap-1 px-3 py-2.5 md:px-4 md:py-3">
        <Button
          size="icon"
          variant="ghost"
          className="text-white hover:bg-white/10 shrink-0 h-9 w-9"
          onClick={onBack}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div 
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:bg-white/5 rounded-lg p-1 transition-colors"
          onClick={() => setShowUserProfile(true)}
          data-testid="button-open-user-profile"
        >
          <Avatar className="h-9 w-9 shrink-0">
            {(otherUserData?.fotoUrl || otherUserData?.fotoBase64) && otherUserData?.fotoPublica ? (
              <AvatarImage src={otherUserData.fotoUrl || otherUserData.fotoBase64} alt={otherParticipant.nome} />
            ) : null}
            <AvatarFallback className="bg-white text-[#008069] text-sm">
              {otherParticipant.tipo === "diretor" ? "DIR" : otherParticipant.nome.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-white truncate text-sm leading-tight" data-testid="text-chat-participant-name">
              {otherParticipant.tipo === "diretor" ? "Diretoria" : otherParticipant.nome}
            </h2>
            <UserPresenceIndicator 
              userId={otherParticipant.id} 
              showText={true}
              className="mt-0.5"
              dotClassName="h-1.5 w-1.5"
              variant="light"
              isBlocked={conversation.isBlocked}
            />
          </div>
        </div>

        <ConversationOptionsMenu
          onBlock={handleBlock}
          onUnblock={handleUnblock}
          onDelete={handleDelete}
          onReport={handleReport}
          isBlocked={conversation.isBlocked}
          iBlockedOther={conversation.iBlockedOther}
        />
      </div>

      {/* Messages Area */}
      <div className="chat-messages-area whatsapp-bg p-4" style={{"--chat-watermark": `url(${watermarkLogo})`} as React.CSSProperties}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Carregando mensagens...</div>
          </div>
        ) : (
          <div className="space-y-4">
            <ChatTermsNotice />
            
            {Object.entries(messageGroups).map(([date, msgs]) => (
              <div key={date}>
                {/* Date Divider */}
                <div className="flex items-center justify-center my-4">
                  <div className="bg-white/90 dark:bg-[#202c33]/90 px-3 py-1 rounded-md shadow-sm">
                    <span className="text-xs text-muted-foreground">{date}</span>
                  </div>
                </div>

                {/* Messages for this date */}
                {msgs.map((msg) => {
                  const isSent = msg.remetenteId === userData.uid;
                  const isDeletedForMe = isSent ? msg.deletadaPorRemetente : msg.deletadaPorDestinatario;
                  const isDeletedForEveryone = msg.deletadaParaTodos;
                  const shouldShowDeleted = isDeletedForMe || isDeletedForEveryone;
                  
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex mb-2",
                        isSent ? "justify-end" : "justify-start"
                      )}
                      data-testid={`message-${msg.id}`}
                    >
                      <div
                        className={cn(
                          "max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-lg shadow-sm cursor-pointer select-none",
                          isSent
                            ? "message-sent"
                            : "message-received",
                          selectedMessageId === msg.id && "ring-2 ring-primary"
                        )}
                        onMouseDown={(e) => !shouldShowDeleted && handleMessagePressStart(msg.id, e)}
                        onMouseUp={handleMessagePressEnd}
                        onMouseLeave={handleMessagePressEnd}
                        onTouchStart={(e) => !shouldShowDeleted && handleMessagePressStart(msg.id, e)}
                        onTouchEnd={handleMessagePressEnd}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        {shouldShowDeleted ? (
                          <p className="text-sm italic opacity-60">
                            Mensagem apagada
                          </p>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.conteudo}
                          </p>
                        )}
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[10px] opacity-70">
                            {formatMessageTime(msg.timestamp)}
                          </span>
                          {isSent && !shouldShowDeleted && (
                            <span className="text-[10px]">
                              {msg.lida ? (
                                <CheckCheck className="h-3 w-3 text-blue-500" />
                              ) : msg.entregue ? (
                                <CheckCheck className="h-3 w-3" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            
            <TypingIndicator isTyping={otherUserTyping} />
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      {conversation.isBlocked ? (
        <div className="whatsapp-input-area px-3 py-3 md:px-4 md:py-4">
          <div className="flex flex-col items-center justify-center gap-2 py-2">
            {conversation.iBlockedOther ? (
              <>
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Ban className="h-5 w-5" />
                  <span className="text-sm font-medium">Você bloqueou este contato</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUnblock}
                  className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                  data-testid="button-unblock-inline"
                >
                  <Unlock className="h-4 w-4 mr-2" />
                  Desbloquear
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Ban className="h-5 w-5" />
                <span className="text-sm font-medium">Este contato bloqueou você</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="whatsapp-input-area flex items-center gap-1.5 px-3 py-2.5 md:px-4 md:py-3">
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground shrink-0 h-9 w-9"
            data-testid="button-emoji"
          >
            <Smile className="h-5 w-5" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground shrink-0 h-9 w-9"
            data-testid="button-attach"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <Input
            type="text"
            placeholder="Digite uma mensagem"
            className="flex-1 bg-white dark:bg-[#2a3942] border-none focus-visible:ring-1 h-9 text-sm rounded-full px-3"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={handleKeyPress}
            onBlur={stopTyping}
            disabled={isSending}
            data-testid="input-message"
          />

          <Button
            size="icon"
            className="bg-[#00a884] hover:bg-[#008069] text-white shrink-0 h-9 w-9"
            onClick={handleSendMessage}
            disabled={isSending || !message.trim()}
            data-testid="button-send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}

      {showUserProfile && (
        <UserProfileDialog 
          userId={otherParticipant.id} 
          onClose={() => setShowUserProfile(false)} 
        />
      )}

      <MessageContextMenu
        isVisible={showContextMenu}
        position={contextMenuPosition}
        onDeleteForMe={handleDeleteForMe}
        onDeleteForEveryone={handleDeleteForEveryone}
        canDeleteForEveryone={selectedMessageId ? (messages.find(m => m.id === selectedMessageId)?.remetenteId === userData.uid) : false}
      />

      <BlockConfirmDialog
        open={showBlockDialog}
        onOpenChange={setShowBlockDialog}
        onConfirm={handleConfirmBlock}
        userName={otherParticipant.tipo === "diretor" ? "Diretoria" : otherParticipant.nome}
      />

      <DeleteConversationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleConfirmDelete}
        userName={otherParticipant.tipo === "diretor" ? "Diretoria" : otherParticipant.nome}
      />

      <ReportConversationDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        onConfirm={handleConfirmReport}
        userName={otherParticipant.tipo === "diretor" ? "Diretoria" : otherParticipant.nome}
        isLoading={isReporting}
      />
    </div>
  );
}
