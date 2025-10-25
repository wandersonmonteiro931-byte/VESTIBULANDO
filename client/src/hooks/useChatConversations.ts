import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  collection, 
  query as firestoreQuery, 
  where, 
  onSnapshot,
  orderBy,
  QueryConstraint
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChatConversation } from "@shared/schema";

export function useChatConversations() {
  const { userData } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userData?.uid) {
      setConversations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

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

    const unsubscribers: (() => void)[] = [];

    let allConversations: ChatConversation[] = [];
    let loaded = { q1: false, q2: false };

    const updateConversations = () => {
      if (loaded.q1 && loaded.q2) {
        // Filtrar apenas conversas que têm mensagens reais
        const conversationsWithMessages = allConversations.filter(
          conv => conv.ultimaMensagem && conv.ultimaMensagem.trim() !== ""
        );
        
        const sorted = conversationsWithMessages.sort((a, b) => {
          const aTime = a.ultimaMensagemTimestamp || a.dataUltimaAtualizacao || "";
          const bTime = b.ultimaMensagemTimestamp || b.dataUltimaAtualizacao || "";
          return bTime.localeCompare(aTime);
        });
        setConversations(sorted);
        setIsLoading(false);
      }
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
        updateConversations();
      },
      (err) => {
        console.error("Error loading conversations (q1):", err);
        setError(err as Error);
        setIsLoading(false);
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
        updateConversations();
      },
      (err) => {
        console.error("Error loading conversations (q2):", err);
        setError(err as Error);
        setIsLoading(false);
      }
    );

    unsubscribers.push(unsubscribe1, unsubscribe2);

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [userData?.uid]);

  return { conversations, isLoading, error };
}
