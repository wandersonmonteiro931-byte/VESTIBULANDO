import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, updateDoc, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";

interface DeleteConversationParams {
  conversationId: string;
}

export function useDeleteConversation() {
  const { userData } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deleteConversation = async (params: DeleteConversationParams) => {
    if (!userData) {
      throw new Error("User not authenticated");
    }

    setIsLoading(true);
    setError(null);

    try {
      const now = getNowBrasiliaISO();
      const conversationRef = doc(db, "chatConversations", params.conversationId);

      const { getDoc: fbGetDoc } = await import("firebase/firestore");
      const conversationSnap = await fbGetDoc(conversationRef);
      if (!conversationSnap.exists()) {
        throw new Error("Conversation not found");
      }

      const conversationData = conversationSnap.data();
      const isParticipant1 = conversationData.participante1Id === userData.uid;

      if (isParticipant1) {
        await updateDoc(conversationRef, {
          deletadaPorParticipante1: true,
          dataDelecaoParticipante1: now,
        });
      } else {
        await updateDoc(conversationRef, {
          deletadaPorParticipante2: true,
          dataDelecaoParticipante2: now,
        });
      }

      const messagesRef = collection(db, "chatMessages");
      const messagesQuery = query(
        messagesRef,
        where("conversationId", "==", params.conversationId)
      );

      const messagesSnapshot = await getDocs(messagesQuery);
      const batch = writeBatch(db);

      messagesSnapshot.forEach((messageDoc) => {
        const messageData = messageDoc.data();
        const isSender = messageData.remetenteId === userData.uid;

        if (isSender) {
          batch.update(doc(db, "chatMessages", messageDoc.id), {
            deletadaPorRemetente: true,
            dataDeletadaPorRemetente: now,
          });
        } else {
          batch.update(doc(db, "chatMessages", messageDoc.id), {
            deletadaPorDestinatario: true,
            dataDeletadaPorDestinatario: now,
          });
        }
      });

      await batch.commit();

      setIsLoading(false);
      return { success: true };
    } catch (err) {
      console.error("Error deleting conversation:", err);
      setError(err as Error);
      setIsLoading(false);
      throw err;
    }
  };

  return { deleteConversation, isLoading, error };
}
