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
import { useUserPresence } from "@/hooks/useUserPresence";
import type { ChatConversation, User } from "@shared/schema";
import { MoreVertical, Trash2, Ban, UserPlus, Check } from "lucide-react";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
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

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      if (isToday(date)) {
        return format(date, "HH:mm");
      }
      if (isYesterday(date)) {
        return "Ontem";
      }
      return format(date, "dd/MM/yyyy");
    } catch {
      return "";
    }
  };

  const isSentByMe = conversation.ultimaMensagemRemetenteId === currentUserId;

  return (
    <div
      className={`p-3 whatsapp-conversation-item cursor-pointer group flex items-center gap-3 border-b whatsapp-divider ${
        isSelected ? "bg-[#f0f2f5] dark:bg-[#2a3942]" : ""
      }`}
      onClick={() => onSelectConversation(conversation)}
      data-testid={`conversation-${conversation.id}`}
    >
      <div className="relative flex-shrink-0">
        <Avatar className="h-12 w-12">
          {otherUser?.fotoBase64 && otherUser.fotoPublica ? (
            <AvatarImage src={otherUser.fotoBase64} alt={other.nome} />
          ) : null}
          <AvatarFallback className="bg-[#6b7c85] text-white dark:bg-[#404b52] dark:text-white">
            {getInitials(other.nome)}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <p className="font-medium text-[15px] truncate text-foreground">
            {other.nome}
          </p>
          {conversation.ultimaMensagemTimestamp && (
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatTime(conversation.ultimaMensagemTimestamp)}
            </span>
          )}
        </div>
        
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {isSentByMe && (
              <Check className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <p className="text-sm text-muted-foreground truncate">
              {conversation.ultimaMensagem}
            </p>
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            {unreadCount > 0 && (
              <Badge 
                className="bg-[#25d366] hover:bg-[#20bd5a] text-white text-xs rounded-full h-5 min-w-5 flex items-center justify-center px-1.5"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700"
                  data-testid={`button-conversation-menu-${conversation.id}`}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conversation);
                  }}
                  className="text-destructive"
                  data-testid="button-delete-conversation"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir conversa
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {isBlocked ? (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnblockUser(other.id);
                    }}
                    data-testid="button-unblock-user"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Desbloquear usuário
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onBlockUser(other.id, other.nome);
                    }}
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
        </div>
      </div>
    </div>
  );
}
