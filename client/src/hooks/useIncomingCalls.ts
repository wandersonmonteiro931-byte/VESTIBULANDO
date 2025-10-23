import { useState, useEffect, useCallback } from "react";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CallSignal } from "@shared/schema";

export interface IncomingCall {
  signal: CallSignal;
  onAccept: () => void;
  onReject: () => void;
}

export function useIncomingCalls(userId: string | undefined) {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, "call_signals"),
      where("receiverId", "==", userId),
      where("type", "==", "offer"),
      where("read", "==", false),
      orderBy("timestamp", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const signal = { id: change.doc.id, ...change.doc.data() } as CallSignal;
          
          setIncomingCall({
            signal,
            onAccept: () => handleAccept(signal),
            onReject: () => handleReject(signal),
          });
        }
      });
    });

    return () => unsubscribe();
  }, [userId]);

  const handleAccept = useCallback((signal: CallSignal) => {
    setIncomingCall(null);
  }, []);

  const handleReject = useCallback(async (signal: CallSignal) => {
    setIncomingCall(null);
  }, []);

  return { incomingCall };
}
