import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";

interface DeleteMessageParams {
  messageId: string;
  deleteForEveryone: boolean;
}

export function useDeleteMessage() {
  const { userData } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deleteMessage = async (params: DeleteMessageParams) => {
    if (!userData) {
      throw new Error("User not authenticated");
    }

    setIsLoading(true);
    setError(null);

    try {
      const now = getNowBrasiliaISO();
      const messageRef = doc(db, "chatMessages", params.messageId);

      if (params.deleteForEveryone) {
        await updateDoc(messageRef, {
          deletadaParaTodos: true,
          dataDeletadaParaTodos: now,
          deletadaParaTodosPorId: userData.uid,
        });
      } else {
        const messageDoc = await getDoc(messageRef);
        if (messageDoc.exists()) {
          const messageData = messageDoc.data();
          const isSender = messageData.remetenteId === userData.uid;

          if (isSender) {
            await updateDoc(messageRef, {
              deletadaPorRemetente: true,
              dataDeletadaPorRemetente: now,
            });
          } else {
            await updateDoc(messageRef, {
              deletadaPorDestinatario: true,
              dataDeletadaPorDestinatario: now,
            });
          }
        }
      }

      setIsLoading(false);
      return { success: true };
    } catch (err) {
      console.error("Error deleting message:", err);
      setError(err as Error);
      setIsLoading(false);
      throw err;
    }
  };

  return { deleteMessage, isLoading, error };
}
