import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, MoreVertical, Send, Mic, Paperclip, Smile } from "lucide-react";
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
          </div>
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="text-white hover:bg-white/10 shrink-0 h-9 w-9"
          data-testid="button-more-options"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>

      {/* Messages Area */}
      <div className="chat-messages-area whatsapp-bg p-4" style={{"--chat-watermark": `url(${watermarkLogo})`} as React.CSSProperties}>
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

        {message.trim() ? (
          <Button
            size="icon"
            className="bg-[#00a884] hover:bg-[#008069] text-white shrink-0 h-9 w-9"
            onClick={handleSendMessage}
            disabled={isSending}
            data-testid="button-send"
          >
            <Send className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground shrink-0 h-9 w-9"
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
