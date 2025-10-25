import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChatConversation } from "@shared/schema";
import { PresenceIndicator } from "./PresenceIndicator";
import { useUserData } from "@/hooks/useUserData";
import { formatBrasiliaTime } from "@/lib/brasiliaTime";

interface ConversationItemProps {
  conversation: ChatConversation;
  otherParticipant: {
    id: string;
    nome: string;
    tipo: "aluno" | "professor" | "diretor";
  };
  unreadCount: number;
}

export default function ConversationItem({ conversation, otherParticipant, unreadCount }: ConversationItemProps) {
  const { userData: otherUserData } = useUserData(otherParticipant.id);

  return (
    <Link
      href={`/chat/${conversation.id}`}
      className="whatsapp-conversation-item flex items-center gap-3 p-3 cursor-pointer border-b border-border hover-elevate"
      data-testid={`conversation-item-${conversation.id}`}
    >
      <div className="relative">
        <Avatar className="h-12 w-12">
          {otherUserData?.fotoBase64 && otherUserData.fotoPublica ? (
            <AvatarImage src={otherUserData.fotoBase64} alt={otherParticipant.nome} />
          ) : null}
          <AvatarFallback className="bg-[#00a884] text-white">
            {otherParticipant.tipo === "diretor" ? "DIR" : otherParticipant.nome.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="absolute bottom-0 right-0">
          <PresenceIndicator userId={otherParticipant.id} />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3
            className="font-semibold text-foreground truncate"
            data-testid={`text-participant-name-${conversation.id}`}
          >
            {otherParticipant.tipo === "diretor" ? "Diretoria" : otherParticipant.nome}
          </h3>
          {conversation.ultimaMensagemTimestamp && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatBrasiliaTime(conversation.ultimaMensagemTimestamp)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-1">
          <p className="text-sm text-muted-foreground truncate">
            {conversation.ultimaMensagem || "Sem mensagens"}
          </p>
          {unreadCount > 0 && (
            <Badge
              className="bg-[#25d366] text-white hover:bg-[#25d366] min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5"
              data-testid={`badge-unread-${conversation.id}`}
            >
              {unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
