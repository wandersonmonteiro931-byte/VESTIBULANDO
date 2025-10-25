import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  collection, 
  query as firestoreQuery, 
  where, 
  onSnapshot,
  orderBy,
  updateDoc,
  doc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChatMessage } from "@shared/schema";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";

export function useChatMessages(conversationId: string | null) {
  const { userData } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!conversationId || !userData?.uid) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const messagesRef = collection(db, "chatMessages");
    const q = firestoreQuery(
      messagesRef,
      where("conversationId", "==", conversationId),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          } as ChatMessage))
          .filter(msg => 
            msg.remetenteId === userData.uid || 
            msg.destinatarioId === userData.uid
          );
        
        setMessages(msgs);
        setIsLoading(false);

        markMessagesAsRead(conversationId, userData.uid, msgs);
      },
      (err) => {
        console.error("Error loading messages:", err);
        setError(err as Error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [conversationId, userData?.uid]);

  return { messages, isLoading, error };
}

async function markMessagesAsRead(
  conversationId: string, 
  userId: string, 
  messages: ChatMessage[]
) {
  try {
    const now = getNowBrasiliaISO();
    
    const unreadMessages = messages.filter(
      msg => msg.destinatarioId === userId && !msg.lida
    );

    if (unreadMessages.length === 0) return;

    const updatePromises = unreadMessages.map(msg =>
      updateDoc(doc(db, "chatMessages", msg.id), {
        lida: true,
        dataLeitura: now
      })
    );

    await Promise.all(updatePromises);

    const conversationRef = doc(db, "chatConversations", conversationId);
    const conversationSnap = await import("firebase/firestore").then(m => m.getDoc(conversationRef));
    
    if (conversationSnap.exists()) {
      const conversation = conversationSnap.data();
      const isParticipant1 = conversation.participante1Id === userId;
      
      await updateDoc(conversationRef, {
        [isParticipant1 ? "mensagensNaoLidas1" : "mensagensNaoLidas2"]: 0,
        ultimaMensagemLida: true,
      });
    }
  } catch (error) {
    console.error("Error marking messages as read:", error);
  }
}
