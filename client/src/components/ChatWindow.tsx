import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Phone, Video, MoreVertical, Send, Mic, Paperclip, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatConversation, ChatMessage } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useSendMessage } from "@/hooks/useSendMessage";
import { useUserPresence } from "@/hooks/useUserPresence";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { TypingIndicator } from "@/components/TypingIndicator";
import { formatBrasiliaTime, formatBrasiliaDate } from "@/lib/brasiliaTime";
import UserProfileDialog from "@/components/UserProfileDialog";
import { useUserData } from "@/hooks/useUserData";

interface ChatWindowProps {
  conversation: ChatConversation;
  onBack: () => void;
}

export default function ChatWindow({ conversation, onBack }: ChatWindowProps) {
  const { userData } = useAuth();
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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
  const presenceStatus = useUserPresence(otherParticipant.id);
  
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

  const messageGroups = groupMessagesByDate(messages);

  if (!userData) return null;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden md:flex md:flex-col">
      {/* Header */}
      <div className="chat-header-fixed whatsapp-header flex items-center gap-3 border-b border-border p-3 md:flex-shrink-0 md:static">
        <Button
          size="icon"
          variant="ghost"
          className="text-white hover:bg-white/10"
          onClick={onBack}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div 
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:bg-white/5 rounded-lg p-2 -ml-2 transition-colors"
          onClick={() => setShowUserProfile(true)}
          data-testid="button-open-user-profile"
        >
          <Avatar className="h-10 w-10">
            {otherUserData?.fotoBase64 && otherUserData.fotoPublica ? (
              <AvatarImage src={otherUserData.fotoBase64} alt={otherParticipant.nome} />
            ) : null}
            <AvatarFallback className="bg-white text-[#008069]">
              {otherParticipant.tipo === "diretor" ? "DIR" : otherParticipant.nome.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-white truncate" data-testid="text-chat-participant-name">
              {otherParticipant.tipo === "diretor" ? "Diretoria" : otherParticipant.nome}
            </h2>
            <div className="flex items-center gap-1.5">
              {presenceStatus.isOnline && (
                <div className="w-2 h-2 rounded-full bg-green-400" data-testid="indicator-online" />
              )}
              <p className="text-xs text-white/90" data-testid="text-participant-status">
                {presenceStatus.statusText}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/10"
            data-testid="button-voice-call"
          >
            <Phone className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/10"
            data-testid="button-video-call"
          >
            <Video className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/10"
            data-testid="button-more-options"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="chat-messages-area whatsapp-bg p-4 md:flex-1 md:overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Carregando mensagens...</div>
          </div>
        ) : (
          <div className="space-y-4">
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
                          "max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-lg shadow-sm",
                          isSent
                            ? "message-sent"
                            : "message-received"
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {msg.conteudo}
                        </p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[10px] opacity-70">
                            {formatMessageTime(msg.timestamp)}
                          </span>
                          {isSent && (
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
      <div className="whatsapp-input-area flex items-center gap-2 p-3 border-t border-border md:flex-shrink-0 md:static">
        <Button
          size="icon"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          data-testid="button-emoji"
        >
          <Smile className="h-5 w-5" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          data-testid="button-attach"
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        <Input
          type="text"
          placeholder="Digite uma mensagem"
          className="flex-1 bg-white dark:bg-[#2a3942] border-none focus-visible:ring-1"
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

        {message.trim() ? (
          <Button
            size="icon"
            className="bg-[#00a884] hover:bg-[#008069] text-white"
            onClick={handleSendMessage}
            disabled={isSending}
            data-testid="button-send"
          >
            <Send className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-voice"
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}
      </div>

      {showUserProfile && (
        <UserProfileDialog 
          userId={otherParticipant.id} 
          onClose={() => setShowUserProfile(false)} 
        />
      )}
    </div>
  );
}
