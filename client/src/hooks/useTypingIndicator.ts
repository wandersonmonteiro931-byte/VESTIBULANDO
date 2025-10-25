import { useEffect, useRef, useCallback } from "react";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useState } from "react";

interface UseTypingIndicatorProps {
  conversationId: string;
  userId: string;
  isParticipant1: boolean;
}

export function useTypingIndicator({ conversationId, userId, isParticipant1 }: UseTypingIndicatorProps) {
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!conversationId) return;

    const conversationRef = doc(db, "chatConversations", conversationId);
    
    const unsubscribe = onSnapshot(conversationRef, (snapshot) => {
      if (!snapshot.exists()) return;
      
      const data = snapshot.data();
      const isTyping = isParticipant1 
        ? data.participante2Digitando 
        : data.participante1Digitando;
      
      setOtherUserTyping(isTyping || false);
    });

    return () => unsubscribe();
  }, [conversationId, isParticipant1]);

  const setTyping = useCallback(async (typing: boolean) => {
    if (!conversationId || !userId) return;

    const now = Date.now();
    if (typing && now - lastTypingUpdateRef.current < 3000) {
      return;
    }

    try {
      const conversationRef = doc(db, "chatConversations", conversationId);
      const fieldName = isParticipant1 ? "participante1Digitando" : "participante2Digitando";
      const timestampField = isParticipant1 ? "participante1UltimaDigitacao" : "participante2UltimaDigitacao";
      
      await updateDoc(conversationRef, {
        [fieldName]: typing,
        [timestampField]: new Date().toISOString()
      });

      if (typing) {
        lastTypingUpdateRef.current = now;
      }
    } catch (error) {
      console.error("Error updating typing status:", error);
    }
  }, [conversationId, userId, isParticipant1]);

  const handleTyping = useCallback(() => {
    setTyping(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, 3000);
  }, [setTyping]);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setTyping(false);
  }, [setTyping]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      setTyping(false);
    };
  }, [setTyping]);

  return {
    otherUserTyping,
    handleTyping,
    stopTyping
  };
}
