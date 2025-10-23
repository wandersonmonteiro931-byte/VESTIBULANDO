import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import type { ChatConversation } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChatConversationListProps {
  conversations: ChatConversation[];
  selectedConversation: ChatConversation | null;
  onSelectConversation: (conversation: ChatConversation) => void;
}

export default function ChatConversationList({
  conversations,
  selectedConversation,
  onSelectConversation
}: ChatConversationListProps) {
  const { userData } = useAuth();

  const getOtherParticipant = (conversation: ChatConversation) => {
    if (conversation.participante1Id === userData?.uid) {
      return {
        id: conversation.participante2Id,
        nome: conversation.participante2Nome === "Diretoria" ? "Diretoria" : conversation.participante2Nome,
        tipo: conversation.participante2Tipo,
      };
    }
    return {
      id: conversation.participante1Id,
      nome: conversation.participante1Nome === "Diretoria" ? "Diretoria" : conversation.participante1Nome,
      tipo: conversation.participante1Tipo,
    };
  };

  const getUnreadCount = (conversation: ChatConversation) => {
    if (conversation.participante1Id === userData?.uid) {
      return conversation.mensagensNaoLidas1 || 0;
    }
    return conversation.mensagensNaoLidas2 || 0;
  };

  const getInitials = (nome: string) => {
    if (nome === "Diretoria") return "DIR";
    const names = nome.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    } catch {
      return "";
    }
  };

  return (
    <div className="divide-y">
      {conversations.map((conversation) => {
        const other = getOtherParticipant(conversation);
        const unreadCount = getUnreadCount(conversation);
        const isSelected = selectedConversation?.id === conversation.id;

        return (
          <div
            key={conversation.id}
            onClick={() => onSelectConversation(conversation)}
            className={`p-3 hover-elevate cursor-pointer ${
              isSelected ? "bg-accent" : ""
            }`}
            data-testid={`conversation-${conversation.id}`}
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 flex-shrink-0">
                <AvatarFallback>{getInitials(other.nome)}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm truncate">
                    {other.nome}
                  </p>
                  {conversation.ultimaMensagemTimestamp && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {formatTimestamp(conversation.ultimaMensagemTimestamp)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground truncate">
                    {conversation.ultimaMensagemRemetenteId === userData?.uid && "Você: "}
                    {conversation.ultimaMensagem || "Iniciar conversa"}
                  </p>
                  {unreadCount > 0 && (
                    <Badge
                      variant="default"
                      className="ml-2 h-5 min-w-5 flex items-center justify-center px-1.5"
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
