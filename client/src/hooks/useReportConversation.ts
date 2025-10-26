import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";

interface ReportConversationParams {
  conversationId: string;
  reportedUserId: string;
  reportedUserName: string;
  reportedUserType: "aluno" | "professor" | "diretor";
  reason: string;
}

export function useReportConversation() {
  const { userData } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reportConversation = async (params: ReportConversationParams) => {
    if (!userData) {
      throw new Error("User not authenticated");
    }

    setIsLoading(true);
    setError(null);

    try {
      const now = getNowBrasiliaISO();

      const messagesRef = collection(db, "chatMessages");
      const messagesQuery = query(
        messagesRef,
        where("conversationId", "==", params.conversationId)
      );

      const messagesSnapshot = await getDocs(messagesQuery);
      const conversationMessages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const reportData = {
        conversationId: params.conversationId,
        denuncianteId: userData.uid,
        denuncianteNome: userData.nome,
        denuncianteTipo: userData.tipo,
        denunciadoId: params.reportedUserId,
        denunciadoNome: params.reportedUserName,
        denunciadoTipo: params.reportedUserType,
        motivo: params.reason,
        mensagensConversa: JSON.stringify(conversationMessages),
        dataDenuncia: now,
        status: "pendente" as const,
      };

      await addDoc(collection(db, "chatReports"), reportData);

      setIsLoading(false);
      return { success: true };
    } catch (err) {
      console.error("Error reporting conversation:", err);
      setError(err as Error);
      setIsLoading(false);
      throw err;
    }
  };

  return { reportConversation, isLoading, error };
}
