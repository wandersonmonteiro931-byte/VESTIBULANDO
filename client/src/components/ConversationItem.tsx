import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChatConversation } from "@shared/schema";
import { useUserData } from "@/hooks/useUserData";
import { formatBrasiliaTime } from "@/lib/brasiliaTime";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { UserPresenceIndicator } from "@/components/UserPresenceIndicator";
import { Ban } from "lucide-react";
import type { ConversationWithBlockInfo } from "@/hooks/useChatConversations";



type TimestampLike =
  | string
  | number
  | Date
  | { toDate?: () => Date; seconds?: number; _seconds?: number }
  | null
  | undefined;

function typingTimestampToMillis(value: TimestampLike): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const result = new Date(value).getTime();
    return Number.isNaN(result) ? null : result;
  }
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1_000;
  if (typeof value._seconds === "number") return value._seconds * 1_000;
  return null;
}

const TYPING_VISIBLE_FOR_MS = 2_700;

interface ConversationItemProps {
  conversation: ConversationWithBlockInfo;
  otherParticipant: {
    id: string;
    nome: string;
    tipo: "aluno" | "professor" | "diretor";
  };
  unreadCount: number;
}

export default function ConversationItem({ conversation, otherParticipant, unreadCount }: ConversationItemProps) {
  const { userData: otherUserData } = useUserData(otherParticipant.id);
  const { userData } = useAuth();
  
  const isParticipant1 = conversation.participante1Id === userData?.uid;
  const otherTypingTimestamp = isParticipant1
    ? (conversation as any).participante2UltimaDigitacao
    : (conversation as any).participante1UltimaDigitacao;
  const typingTimestampMs = useMemo(
    () => typingTimestampToMillis(otherTypingTimestamp as TimestampLike),
    [otherTypingTimestamp],
  );
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  useEffect(() => {
    if (typingTimestampMs == null) {
      setOtherUserTyping(false);
      return;
    }

    const age = Math.max(0, Date.now() - typingTimestampMs);
    const remaining = TYPING_VISIBLE_FOR_MS - age;
    if (remaining <= 0) {
      setOtherUserTyping(false);
      return;
    }

    setOtherUserTyping(true);
    const timer = setTimeout(() => setOtherUserTyping(false), remaining + 100);
    return () => clearTimeout(timer);
  }, [typingTimestampMs]);

  return (
    <Link
      href={`/chat/${conversation.id}`}
      className="whatsapp-conversation-item flex items-center gap-3 p-3 cursor-pointer border-b border-border hover-elevate"
      data-testid={`conversation-item-${conversation.id}`}
    >
      <div className="relative">
        <Avatar className="h-12 w-12">
          {(otherUserData?.fotoUrl || otherUserData?.fotoBase64) && otherUserData?.fotoPublica ? (
            <AvatarImage src={otherUserData.fotoUrl || otherUserData.fotoBase64} alt={otherParticipant.nome} />
          ) : null}
          <AvatarFallback className="bg-[#00a884] text-white">
            {otherParticipant.tipo === "diretor" ? "DIR" : otherParticipant.nome.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <UserPresenceIndicator 
          userId={otherParticipant.id} 
          showText={false}
          className="absolute bottom-0 right-0"
          dotClassName="h-3 w-3 border-2 border-background"
          isBlocked={conversation.isBlocked}
        />
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
          {conversation.isBlocked ? (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Ban className="h-3.5 w-3.5" />
              <span className="text-sm font-medium">
                {conversation.iBlockedOther ? "Bloqueado" : "Você foi bloqueado"}
              </span>
            </div>
          ) : otherUserTyping ? (
            <div className="flex items-center gap-1" data-testid={`typing-indicator-${conversation.id}`}>
              <span className="text-sm text-[#25d366] font-medium">digitando</span>
              <div className="flex gap-0.5 items-center">
                <motion.div
                  className="w-1 h-1 rounded-full bg-[#25d366]"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0
                  }}
                />
                <motion.div
                  className="w-1 h-1 rounded-full bg-[#25d366]"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.2
                  }}
                />
                <motion.div
                  className="w-1 h-1 rounded-full bg-[#25d366]"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.4
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground truncate">
              {conversation.ultimaMensagem || "Sem mensagens"}
            </p>
          )}
          {!conversation.isBlocked && unreadCount > 0 && (
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
