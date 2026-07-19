import { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const STOP_TYPING_AFTER_MS = 2_000;
const REMOTE_TYPING_STALE_AFTER_MS = 5_000;
const TRUE_WRITE_THROTTLE_MS = 700;

type TimestampLike =
  | string
  | number
  | Date
  | {
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
    }
  | null
  | undefined;

function toMillis(value: TimestampLike): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const result = new Date(value).getTime();
    return Number.isNaN(result) ? null : result;
  }
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1_000;
  if (typeof value._seconds === "number") return value._seconds * 1_000;
  return null;
}

interface UseTypingIndicatorProps {
  conversationId: string;
  userId: string;
  isParticipant1: boolean;
}

export function useTypingIndicator({
  conversationId,
  userId,
  isParticipant1,
}: UseTypingIndicatorProps) {
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const stopOwnTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteExpiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrueWriteRef = useRef(0);
  const desiredTypingRef = useRef(false);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  const clearOwnTimer = () => {
    if (stopOwnTypingTimerRef.current) {
      clearTimeout(stopOwnTypingTimerRef.current);
      stopOwnTypingTimerRef.current = null;
    }
  };

  const clearRemoteTimer = () => {
    if (remoteExpiryTimerRef.current) {
      clearTimeout(remoteExpiryTimerRef.current);
      remoteExpiryTimerRef.current = null;
    }
  };

  useEffect(() => {
    clearRemoteTimer();
    setOtherUserTyping(false);

    if (!conversationId || !userId) return;

    const conversationRef = doc(db, "chatConversations", conversationId);

    const unsubscribe = onSnapshot(
      conversationRef,
      (snapshot) => {
        clearRemoteTimer();

        if (!snapshot.exists()) {
          setOtherUserTyping(false);
          return;
        }

        const data = snapshot.data();
        const isTyping = isParticipant1
          ? data.participante2Digitando === true
          : data.participante1Digitando === true;
        const typingTimestamp = isParticipant1
          ? data.participante2UltimaDigitacao
          : data.participante1UltimaDigitacao;

        if (!isTyping) {
          setOtherUserTyping(false);
          return;
        }

        const timestampMs = toMillis(typingTimestamp as TimestampLike);
        const age = timestampMs == null ? 0 : Date.now() - timestampMs;
        const remaining =
          timestampMs == null
            ? REMOTE_TYPING_STALE_AFTER_MS
            : REMOTE_TYPING_STALE_AFTER_MS - age;

        if (remaining <= 0) {
          setOtherUserTyping(false);
          return;
        }

        setOtherUserTyping(true);
        remoteExpiryTimerRef.current = setTimeout(() => {
          setOtherUserTyping(false);
        }, remaining + 100);
      },
      (error) => {
        console.error("Erro ao observar o indicador de digitação:", error);
        clearRemoteTimer();
        setOtherUserTyping(false);
      },
    );

    return () => {
      unsubscribe();
      clearRemoteTimer();
    };
  }, [conversationId, userId, isParticipant1]);

  const queueTypingWrite = useCallback(
    (typing: boolean, force = false) => {
      if (!conversationId || !userId) return;

      const now = Date.now();
      if (
        typing &&
        !force &&
        now - lastTrueWriteRef.current < TRUE_WRITE_THROTTLE_MS
      ) {
        return;
      }

      desiredTypingRef.current = typing;
      if (typing) lastTrueWriteRef.current = now;

      const fieldName = isParticipant1
        ? "participante1Digitando"
        : "participante2Digitando";
      const timestampField = isParticipant1
        ? "participante1UltimaDigitacao"
        : "participante2UltimaDigitacao";
      const conversationRef = doc(db, "chatConversations", conversationId);

      writeQueueRef.current = writeQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (desiredTypingRef.current !== typing) return;

          try {
            await updateDoc(conversationRef, {
              [fieldName]: typing,
              [timestampField]: serverTimestamp(),
            });
          } catch (error) {
            console.error("Erro ao atualizar o indicador de digitação:", error);
          }
        });
    },
    [conversationId, userId, isParticipant1],
  );

  const handleTyping = useCallback(() => {
    queueTypingWrite(true);
    clearOwnTimer();
    stopOwnTypingTimerRef.current = setTimeout(() => {
      queueTypingWrite(false, true);
    }, STOP_TYPING_AFTER_MS);
  }, [queueTypingWrite]);

  const stopTyping = useCallback(() => {
    clearOwnTimer();
    queueTypingWrite(false, true);
  }, [queueTypingWrite]);

  useEffect(() => {
    return () => {
      clearOwnTimer();
      desiredTypingRef.current = false;
      queueTypingWrite(false, true);
    };
  }, [queueTypingWrite]);

  return {
    otherUserTyping,
    handleTyping,
    stopTyping,
  };
}
