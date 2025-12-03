import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  collection, 
  query as firestoreQuery, 
  where, 
  onSnapshot,
  orderBy,
  QueryConstraint,
  getDocs
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChatConversation } from "@shared/schema";

export interface ConversationWithBlockInfo extends ChatConversation {
  isBlocked?: boolean;
  iBlockedOther?: boolean;
  otherBlockedMe?: boolean;
}

export function useChatConversations() {
  const { userData } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithBlockInfo[]>([]);
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

    const updateConversations = async () => {
      if (loaded.q1 && loaded.q2) {
        const blocksRef = collection(db, "userBlocks");
        const blockQuery = firestoreQuery(
          blocksRef,
          where("ativo", "==", true)
        );
        
        const blocksSnapshot = await getDocs(blockQuery);
        const blocks = blocksSnapshot.docs.map(doc => doc.data());
        
        const conversationsWithMessages = allConversations.filter(
          conv => conv.ultimaMensagem && conv.ultimaMensagem.trim() !== ""
        );
        
        const conversationsWithBlockInfo: ConversationWithBlockInfo[] = conversationsWithMessages.map(conv => {
          const otherParticipantId = 
            conv.participante1Id === userData.uid 
              ? conv.participante2Id 
              : conv.participante1Id;
          
          const iBlockedOther = blocks.some(
            block => block.bloqueadorId === userData.uid && block.bloqueadoId === otherParticipantId
          );
          
          const otherBlockedMe = blocks.some(
            block => block.bloqueadorId === otherParticipantId && block.bloqueadoId === userData.uid
          );
          
          return {
            ...conv,
            isBlocked: iBlockedOther || otherBlockedMe,
            iBlockedOther,
            otherBlockedMe,
          };
        });
        
        const sorted = conversationsWithBlockInfo.sort((a, b) => {
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
