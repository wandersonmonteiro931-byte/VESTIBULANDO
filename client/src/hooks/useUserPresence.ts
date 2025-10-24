import { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UserPresenceData {
  isOnline: boolean;
  lastSeen?: string;
  lastActivity?: string;
  isLoading?: boolean;
}

export function useUserPresence(userId: string | undefined): UserPresenceData {
  const [presence, setPresence] = useState<UserPresenceData>({
    isOnline: false,
    lastSeen: undefined,
    lastActivity: undefined,
    isLoading: true,
  });
  
  const previousUserIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!userId) {
      setPresence({
        isOnline: false,
        lastSeen: undefined,
        lastActivity: undefined,
        isLoading: false,
      });
      previousUserIdRef.current = undefined;
      return;
    }

    if (previousUserIdRef.current !== userId) {
      setPresence((prev) => ({
        ...prev,
        isLoading: true,
      }));
      previousUserIdRef.current = userId;
    }

    const userRef = doc(db, 'usuarios', userId);
    
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          console.log('📊 Dados de presença recebidos:', {
            userId,
            isOnline: data.isOnline,
            lastSeen: data.lastSeen,
            lastActivity: data.lastActivity,
          });
          const presenceData = {
            isOnline: data.isOnline || false,
            lastSeen: data.lastSeen,
            lastActivity: data.lastActivity,
            isLoading: false,
          };
          setPresence(presenceData);
        } else {
          console.log('⚠️ Documento de usuário não existe:', userId);
          setPresence({
            isOnline: false,
            lastSeen: undefined,
            lastActivity: undefined,
            isLoading: false,
          });
        }
      },
      (error) => {
        console.error('Erro ao escutar presença do usuário:', error);
        setPresence({
          isOnline: false,
          lastSeen: undefined,
          lastActivity: undefined,
          isLoading: false,
        });
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return presence;
}
