import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  collection, 
  addDoc,
  updateDoc,
  doc,
  getDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface SendMessageParams {
  conversationId: string;
  destinatarioId: string;
  destinatarioNome: string;
  destinatarioTipo: "aluno" | "professor" | "diretor";
  conteudo: string;
  tipo?: "texto" | "audio" | "imagem" | "documento" | "video";
  arquivoUrl?: string;
  arquivoNome?: string;
  arquivoTipo?: string;
  arquivoTamanho?: number;
}

export function useSendMessage() {
  const { userData } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendMessage = async (params: SendMessageParams) => {
    if (!userData) {
      throw new Error("User not authenticated");
    }

    setIsLoading(true);
    setError(null);

    try {
      const now = new Date().toISOString();

      const messageData = {
        conversationId: params.conversationId,
        remetenteId: userData.uid,
        remetenteNome: userData.nome,
        remetenteTipo: userData.tipo,
        destinatarioId: params.destinatarioId,
        destinatarioNome: params.destinatarioNome,
        destinatarioTipo: params.destinatarioTipo,
        tipo: params.tipo || "texto",
        conteudo: params.conteudo,
        arquivoUrl: params.arquivoUrl,
        arquivoNome: params.arquivoNome,
        arquivoTipo: params.arquivoTipo,
        arquivoTamanho: params.arquivoTamanho,
        timestamp: now,
        entregue: true,
        dataEntrega: now,
        lida: false,
        deletadaPorRemetente: false,
        deletadaPorDestinatario: false,
      };

      const messagesRef = collection(db, "chatMessages");
      const messageDoc = await addDoc(messagesRef, messageData);

      const conversationRef = doc(db, "chatConversations", params.conversationId);
      const conversationSnap = await getDoc(conversationRef);
      
      if (conversationSnap.exists()) {
        const conversation = conversationSnap.data();
        const isParticipant1 = conversation.participante1Id === userData.uid;
        
        const updateData: any = {
          ultimaMensagem: params.conteudo.substring(0, 100),
          ultimaMensagemTimestamp: now,
          ultimaMensagemRemetenteId: userData.uid,
          ultimaMensagemEntregue: true,
          ultimaMensagemLida: false,
          dataUltimaAtualizacao: now,
        };

        const unreadField = isParticipant1 ? "mensagensNaoLidas2" : "mensagensNaoLidas1";
        const currentUnread = conversation[unreadField] || 0;
        updateData[unreadField] = currentUnread + 1;
        
        await updateDoc(conversationRef, updateData);
      }

      setIsLoading(false);
      return { success: true, messageId: messageDoc.id };
    } catch (err) {
      console.error("Error sending message:", err);
      setError(err as Error);
      setIsLoading(false);
      throw err;
    }
  };

  return { sendMessage, isLoading, error };
}
