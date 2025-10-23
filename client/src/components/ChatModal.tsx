import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ChatPanel } from "@/components/ChatPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { where } from "firebase/firestore";
import type { ChatConversation } from "@shared/schema";

export function ChatModal() {
  const { userData } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: conversations } = useRealtimeQuery<ChatConversation>({
    collectionName: "chat_conversations",
    queryKey: ["/api/chat/conversations", userData?.uid],
    constraints: userData?.uid
      ? [where("participante1Id", "in", [userData.uid])]
      : [],
    transform: (docs) => docs as ChatConversation[],
    enabled: !!userData?.uid,
  });

  const { data: conversations2 } = useRealtimeQuery<ChatConversation>({
    collectionName: "chat_conversations",
    queryKey: ["/api/chat/conversations2", userData?.uid],
    constraints: userData?.uid
      ? [where("participante2Id", "in", [userData.uid])]
      : [],
    transform: (docs) => docs as ChatConversation[],
    enabled: !!userData?.uid,
  });

  const allConversations = [...(conversations || []), ...(conversations2 || [])];

  const totalUnreadMessages = allConversations.reduce((total, conversation) => {
    const isParticipant1 = conversation.participante1Id === userData?.uid;
    return total + (isParticipant1 ? conversation.mensagensNaoLidas1 : conversation.mensagensNaoLidas2);
  }, 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-open-chat"
        >
          <MessageCircle className="h-5 w-5" />
          {totalUnreadMessages > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {totalUnreadMessages > 99 ? "99+" : totalUnreadMessages}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-4xl p-6">
        <SheetHeader>
          <SheetTitle className="text-2xl">Chat</SheetTitle>
        </SheetHeader>
        <div className="mt-6 h-[calc(100vh-8rem)]">
          <ChatPanel />
        </div>
      </SheetContent>
    </Sheet>
  );
}
