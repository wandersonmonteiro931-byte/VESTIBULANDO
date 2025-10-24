import { useEffect, useRef, useCallback, useState } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getNowBrasiliaISO } from '@/lib/brasiliaTime';

const TYPING_TIMEOUT = 3000; // 3 segundos sem digitar para remover o indicador
const TYPING_UPDATE_THROTTLE = 1000; // Atualizar no máximo a cada 1 segundo

interface UseTypingIndicatorProps {
  conversationId: string | undefined;
  currentUserId: string | undefined;
  isParticipant1: boolean;
}

interface TypingStatus {
  isTyping: boolean;
  lastTyped?: string;
}

export function useTypingIndicator({
  conversationId,
  currentUserId,
  isParticipant1,
}: UseTypingIndicatorProps) {
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const lastUpdateRef = useRef<number>(0);
  const isTypingRef = useRef(false);

  // Atualizar status de digitação no Firestore
  const updateTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!conversationId || !currentUserId) return;

    try {
      const conversationRef = doc(db, 'chat_conversations', conversationId);
      const updateData = isParticipant1
        ? {
            participante1Digitando: isTyping,
            participante1UltimaDigitacao: isTyping ? getNowBrasiliaISO() : null,
          }
        : {
            participante2Digitando: isTyping,
            participante2UltimaDigitacao: isTyping ? getNowBrasiliaISO() : null,
          };

      await updateDoc(conversationRef, updateData);
      isTypingRef.current = isTyping;
    } catch (error) {
      console.error('Erro ao atualizar status de digitação:', error);
    }
  }, [conversationId, currentUserId, isParticipant1]);

  // Função chamada quando o usuário está digitando
  const onTyping = useCallback(() => {
    const now = Date.now();
    
    // Throttle: só atualizar se passou tempo suficiente desde a última atualização
    if (now - lastUpdateRef.current < TYPING_UPDATE_THROTTLE) {
      // Mesmo assim, renovar o timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        updateTypingStatus(false);
      }, TYPING_TIMEOUT);
      return;
    }

    lastUpdateRef.current = now;

    // Marcar como digitando se ainda não estiver
    if (!isTypingRef.current) {
      updateTypingStatus(true);
    }

    // Limpar timeout anterior
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Criar novo timeout para remover o indicador
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
    }, TYPING_TIMEOUT);
  }, [updateTypingStatus]);

  // Função para limpar o status de digitação
  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTypingRef.current) {
      updateTypingStatus(false);
    }
  }, [updateTypingStatus]);

  // Escutar o status de digitação do outro usuário
  useEffect(() => {
    if (!conversationId) {
      setOtherUserTyping(false);
      return;
    }

    const conversationRef = doc(db, 'chat_conversations', conversationId);
    
    const unsubscribe = onSnapshot(
      conversationRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          // Verificar se o outro participante está digitando
          const otherIsTyping = isParticipant1
            ? data.participante2Digitando || false
            : data.participante1Digitando || false;
          
          setOtherUserTyping(otherIsTyping);
        } else {
          setOtherUserTyping(false);
        }
      },
      (error) => {
        console.error('Erro ao escutar status de digitação:', error);
        setOtherUserTyping(false);
      }
    );

    return () => unsubscribe();
  }, [conversationId, isParticipant1]);

  // Limpar status de digitação quando o componente desmontar
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Limpar o status ao desmontar
      if (isTypingRef.current && conversationId) {
        updateTypingStatus(false);
      }
    };
  }, [conversationId, updateTypingStatus]);

  return {
    otherUserTyping,
    onTyping,
    stopTyping,
  };
}
