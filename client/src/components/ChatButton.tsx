import { useState, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ChatWindow from "./ChatWindow";

export default function ChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { userData } = useAuth();

  // Monitorar mensagens não lidas em tempo real
  useEffect(() => {
    if (!userData?.uid) return;

    const conversationsRef = collection(db, "chatConversations");
    const q = query(
      conversationsRef,
      where("participante1Id", "==", userData.uid)
    );
    const q2 = query(
      conversationsRef,
      where("participante2Id", "==", userData.uid)
    );

    let total1 = 0;
    let total2 = 0;

    const unsubscribe1 = onSnapshot(q, (snapshot) => {
      total1 = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        total1 += data.mensagensNaoLidas1 || 0;
      });
      setUnreadCount(total1 + total2);
    });

    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      total2 = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        total2 += data.mensagensNaoLidas2 || 0;
      });
      setUnreadCount(total1 + total2);
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [userData?.uid]);

  return (
    <>
      <div className="relative">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="button-chat"
        >
          <MessageCircle className="h-5 w-5" />
        </Button>
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-1 text-xs"
            data-testid="badge-unread-count"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </div>
      
      {isOpen && (
        <ChatWindow onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}
