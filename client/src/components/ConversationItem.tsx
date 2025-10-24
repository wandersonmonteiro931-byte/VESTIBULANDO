import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { useUserPresence } from "@/hooks/useUserPresence";
import type { ChatConversation, User } from "@shared/schema";
import { MoreVertical, Trash2, Ban, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConversationItemProps {
  conversation: ChatConversation;
  currentUserId: string;
  otherUser?: User;
  isSelected: boolean;
  isBlocked: boolean;
  onSelectConversation: (conversation: ChatConversation) => void;
  onDeleteConversation: (conversation: ChatConversation) => void;
  onBlockUser: (userId: string, userName: string) => void;
  onUnblockUser: (userId: string) => void;
}

export function ConversationItem({
  conversation,
  currentUserId,
  otherUser,
  isSelected,
  isBlocked,
  onSelectConversation,
  onDeleteConversation,
  onBlockUser,
  onUnblockUser,
}: ConversationItemProps) {
  const other = conversation.participante1Id === currentUserId
    ? {
        id: conversation.participante2Id,
        nome: conversation.participante2Tipo === "diretor" ? "Diretoria" : conversation.participante2Nome,
        tipo: conversation.participante2Tipo,
      }
    : {
        id: conversation.participante1Id,
        nome: conversation.participante1Tipo === "diretor" ? "Diretoria" : conversation.participante1Nome,
        tipo: conversation.participante1Tipo,
      };

  const unreadCount = conversation.participante1Id === currentUserId
    ? conversation.mensagensNaoLidas1 || 0
    : conversation.mensagensNaoLidas2 || 0;

  const presenceData = useUserPresence(other.id);

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
    <div
      className={`p-3 hover-elevate cursor-pointer group flex items-center gap-2 ${
        isSelected ? "bg-accent" : ""
      }`}
      data-testid={`conversation-${conversation.id}`}
    >
      <div className="flex-1 min-w-0" onClick={() => onSelectConversation(conversation)}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-10 w-10 shrink-0">
              {otherUser?.fotoBase64 && otherUser.fotoPublica ? (
                <AvatarImage src={otherUser.fotoBase64} alt={other.nome} />
              ) : null}
              <AvatarFallback>
                {getInitials(other.nome)}
              </AvatarFallback>
            </Avatar>
            <div
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${
                presenceData.isOnline ? "bg-green-500" : "bg-gray-400"
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm truncate">{other.nome}</p>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs shrink-0">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {conversation.ultimaMensagem}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {conversation.ultimaMensagemTimestamp && (
                <p className="text-xs text-muted-foreground">
                  {formatTimestamp(conversation.ultimaMensagemTimestamp)}
                </p>
              )}
              <span className="text-xs text-muted-foreground">•</span>
              <PresenceIndicator
                isOnline={presenceData.isOnline}
                lastSeen={presenceData.lastSeen}
                lastActivity={presenceData.lastActivity}
                showLabel={false}
                variant="icon"
              />
            </div>
          </div>
        </div>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 opacity-0 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
            data-testid={`button-conversation-menu-${conversation.id}`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => onDeleteConversation(conversation)}
            className="text-destructive"
            data-testid="button-delete-conversation"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir conversa
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isBlocked ? (
            <DropdownMenuItem
              onClick={() => onUnblockUser(other.id)}
              data-testid="button-unblock-user"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Desbloquear usuário
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => onBlockUser(other.id, other.nome)}
              className="text-destructive"
              data-testid="button-block-user"
            >
              <Ban className="h-4 w-4 mr-2" />
              Bloquear usuário
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
