import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  collection, 
  query as firestoreQuery, 
  where, 
  onSnapshot,
  orderBy,
  limit
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChatConversation, ChatMessage } from "@shared/schema";

export interface UnreadInfo {
  totalUnread: number;
  latestMessage: {
    senderName: string;
    text: string;
    conversationId: string;
    timestamp: string;
  } | null;
}

export function useUnreadMessages() {
  const { userData } = useAuth();
  const [unreadInfo, setUnreadInfo] = useState<UnreadInfo>({ totalUnread: 0, latestMessage: null });
  const [showNotification, setShowNotification] = useState(false);
  const previousUnreadRef = useRef<number>(0);
  const latestMessageIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (!userData?.uid) {
      setUnreadInfo({ totalUnread: 0, latestMessage: null });
      return;
    }

    const conversationsRef = collection(db, "chatConversations");
    
    const q1 = firestoreQuery(
      conversationsRef,
      where("participante1Id", "==", userData.uid),
      where("deletadaPorParticipante1", "==", false)
    );
    
    const q2 = firestoreQuery(
      conversationsRef,
      where("participante2Id", "==", userData.uid),
      where("deletadaPorParticipante2", "==", false)
    );

    let allConversations: ChatConversation[] = [];
    let loaded = { q1: false, q2: false };

    const updateUnreadCount = () => {
      if (!loaded.q1 || !loaded.q2) return;

      let totalUnread = 0;
      let latestMessage: UnreadInfo["latestMessage"] = null;
      let latestTimestamp = "";

      allConversations.forEach(conv => {
        const isParticipant1 = conv.participante1Id === userData.uid;
        const unreadCount = isParticipant1 
          ? (conv.mensagensNaoLidas1 || 0) 
          : (conv.mensagensNaoLidas2 || 0);
        
        totalUnread += unreadCount;

        if (unreadCount > 0 && conv.ultimaMensagemTimestamp) {
          if (!latestTimestamp || conv.ultimaMensagemTimestamp > latestTimestamp) {
            latestTimestamp = conv.ultimaMensagemTimestamp;
            const senderName = isParticipant1 ? conv.participante2Nome : conv.participante1Nome;
            const senderTipo = isParticipant1 ? conv.participante2Tipo : conv.participante1Tipo;
            latestMessage = {
              senderName: senderTipo === "diretor" ? "Diretoria" : senderName,
              text: conv.ultimaMensagem || "",
              conversationId: conv.id,
              timestamp: conv.ultimaMensagemTimestamp,
            };
          }
        }
      });

      const newMessageArrived = !isInitialLoadRef.current && 
        totalUnread > previousUnreadRef.current && 
        latestMessage && 
        latestMessage.timestamp !== latestMessageIdRef.current;

      if (newMessageArrived && latestMessage) {
        setShowNotification(true);
        latestMessageIdRef.current = latestMessage.timestamp;
      }

      previousUnreadRef.current = totalUnread;
      isInitialLoadRef.current = false;
      
      setUnreadInfo({ totalUnread, latestMessage });
    };

    const unsubscribe1 = onSnapshot(
      q1,
      (snapshot) => {
        const convs1 = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ChatConversation));
        
        const existingIds = new Set(convs1.map(c => c.id));
        allConversations = [
          ...convs1,
          ...allConversations.filter(c => !existingIds.has(c.id))
        ];
        
        loaded.q1 = true;
        updateUnreadCount();
      }
    );

    const unsubscribe2 = onSnapshot(
      q2,
      (snapshot) => {
        const convs2 = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ChatConversation));
        
        const existingIds = new Set(convs2.map(c => c.id));
        allConversations = [
          ...allConversations.filter(c => !existingIds.has(c.id)),
          ...convs2
        ];
        
        loaded.q2 = true;
        updateUnreadCount();
      }
    );

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [userData?.uid]);

  const dismissNotification = useCallback(() => {
    setShowNotification(false);
  }, []);

  return { 
    ...unreadInfo, 
    showNotification, 
    dismissNotification,
    hasUnread: unreadInfo.totalUnread > 0 
  };
}
