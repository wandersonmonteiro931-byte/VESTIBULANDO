import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Phone, Video, MoreVertical, Send, Mic, Paperclip, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChatConversation, ChatMessage } from "@shared/schema";
import { collection, query as firestoreQuery, where, orderBy, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";

interface ChatWindowProps {
  conversation: ChatConversation;
  onBack: () => void;
}

export default function ChatWindow({ conversation, onBack }: ChatWindowProps) {
  const { userData } = useAuth();
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
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

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages", conversation.id],
    enabled: !!conversation.id,
    refetchInterval: 1000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", "/api/chat/send", {
        conversationId: conversation.id,
        destinatarioId: otherParticipant.id,
        destinatarioNome: otherParticipant.nome,
        destinatarioTipo: otherParticipant.tipo,
        conteudo: content,
        tipo: "texto",
      });
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", conversation.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      scrollToBottom();
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (message.trim() && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate(message.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), "HH:mm", { locale: ptBR });
    } catch {
      return "";
    }
  };

  const formatMessageDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return "Hoje";
      } else if (date.toDateString() === yesterday.toDateString()) {
        return "Ontem";
      } else {
        return format(date, "dd/MM/yyyy", { locale: ptBR });
      }
    } catch {
      return "";
    }
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
      <div className="chat-header-fixed whatsapp-header flex items-center gap-3 p-3 border-b border-border">
        <Button
          size="icon"
          variant="ghost"
          className="text-white hover:bg-white/10 md:hidden"
          onClick={onBack}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <Avatar className="h-10 w-10">
          <AvatarImage src="" />
          <AvatarFallback className="bg-white text-[#008069]">
            {otherParticipant.nome.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-white truncate" data-testid="text-chat-participant-name">
            {otherParticipant.nome}
          </h2>
          <p className="text-xs text-white/70" data-testid="text-participant-status">
            {otherParticipant.tipo === "aluno" ? "Aluno" : otherParticipant.tipo === "professor" ? "Professor" : "Diretor"}
          </p>
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
      <div className="chat-messages-area flex-1 whatsapp-bg p-4 overflow-y-auto">
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
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="whatsapp-input-area flex items-center gap-2 p-3 border-t border-border">
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
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={sendMessageMutation.isPending}
          data-testid="input-message"
        />

        {message.trim() ? (
          <Button
            size="icon"
            className="bg-[#00a884] hover:bg-[#008069] text-white"
            onClick={handleSendMessage}
            disabled={sendMessageMutation.isPending}
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
    </div>
  );
}
