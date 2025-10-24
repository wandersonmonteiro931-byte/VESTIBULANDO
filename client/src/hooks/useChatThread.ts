import { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";
import type { ChatConversation, ChatMessage, User } from "@shared/schema";

interface UseChatThreadParams {
  conversation?: ChatConversation;
  selectedUser?: User;
  currentUserId?: string;
  currentUserName?: string;
  currentUserType?: "aluno" | "professor" | "diretor";
}

export function useChatThread({
  conversation,
  selectedUser,
  currentUserId,
  currentUserName,
  currentUserType,
}: UseChatThreadParams) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [resolvedConversation, setResolvedConversation] = useState<ChatConversation | null>(conversation || null);
  const [conversationId, setConversationId] = useState<string | null>(conversation?.id || null);

  useEffect(() => {
    if (conversation) {
      setResolvedConversation(conversation);
      setConversationId(conversation.id);
    }
  }, [conversation]);

  useEffect(() => {
    if (!conversationId) return;

    const messagesRef = collection(db, "chat_messages");
    const q = query(
      messagesRef,
      where("conversationId", "==", conversationId),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        const msg = { id: doc.id, ...doc.data() } as ChatMessage;
        msgs.push(msg);
      });
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [conversationId]);

  const createConversationAndSendMessage = async (
    messageData: Partial<ChatMessage>
  ): Promise<{ conversationId: string; messageId: string }> => {
    if (!selectedUser || !currentUserId || !currentUserName || !currentUserType) {
      throw new Error("Missing user data for conversation creation");
    }

    const determinedConversationId = [currentUserId, selectedUser.uid].sort().join("_");
    const conversationRef = doc(db, "chat_conversations", determinedConversationId);
    
    const conversationSnap = await getDoc(conversationRef);
    
    if (!conversationSnap.exists()) {
      const conversationData = {
        participante1Id: currentUserId,
        participante1Nome: currentUserType === "diretor" ? "Diretoria" : currentUserName,
        participante1Tipo: currentUserType,
        participante2Id: selectedUser.uid,
        participante2Nome: selectedUser.tipo === "diretor" ? "Diretoria" : selectedUser.nome,
        participante2Tipo: selectedUser.tipo,
        mensagensNaoLidas1: 0,
        mensagensNaoLidas2: 1,
        dataCriacao: getNowBrasiliaISO(),
        dataUltimaAtualizacao: getNowBrasiliaISO(),
        ultimaMensagem: messageData.conteudo?.substring(0, 50) || "",
        ultimaMensagemTimestamp: getNowBrasiliaISO(),
        ultimaMensagemRemetenteId: currentUserId,
      };

      await setDoc(conversationRef, conversationData);
      
      const newConversation: ChatConversation = {
        id: determinedConversationId,
        ...conversationData,
      };

      setResolvedConversation(newConversation);
    } else {
      const existingConversation = conversationSnap.data() as Omit<ChatConversation, 'id'>;
      setResolvedConversation({
        id: determinedConversationId,
        ...existingConversation,
      });
    }
    
    setConversationId(determinedConversationId);

    const fullMessageData = {
      ...messageData,
      conversationId: determinedConversationId,
      timestamp: getNowBrasiliaISO(),
    };

    const messageRef = await addDoc(collection(db, "chat_messages"), fullMessageData);

    return {
      conversationId: determinedConversationId,
      messageId: messageRef.id,
    };
  };

  return {
    messages,
    conversationId,
    resolvedConversation,
    createConversationAndSendMessage,
  };
}
