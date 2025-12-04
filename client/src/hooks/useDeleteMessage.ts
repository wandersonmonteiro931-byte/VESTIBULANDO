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
      const messageDoc = await getDoc(messageRef);

      if (params.deleteForEveryone) {
        if (messageDoc.exists()) {
          const messageData = messageDoc.data();
          const conversationId = messageData.conversationId;
          
          await updateDoc(messageRef, {
            deletadaParaTodos: true,
            dataDeletadaParaTodos: now,
            deletadaParaTodosPorId: userData.uid,
          });
          
          if (conversationId) {
            const conversationRef = doc(db, "chatConversations", conversationId);
            const conversationDoc = await getDoc(conversationRef);
            
            if (conversationDoc.exists()) {
              const conversationData = conversationDoc.data();
              const messageTimestamp = messageData.timestamp;
              
              if (conversationData.ultimaMensagemTimestamp === messageTimestamp) {
                await updateDoc(conversationRef, {
                  ultimaMensagem: "Mensagem apagada",
                });
              }
            }
          }
        } else {
          await updateDoc(messageRef, {
            deletadaParaTodos: true,
            dataDeletadaParaTodos: now,
            deletadaParaTodosPorId: userData.uid,
          });
        }
      } else {
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
