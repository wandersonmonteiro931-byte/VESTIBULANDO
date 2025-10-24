import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UserPresenceData {
  isOnline: boolean;
  lastSeen?: string;
  lastActivity?: string;
}

export function useUserPresence(userId: string | undefined): UserPresenceData {
  const [presence, setPresence] = useState<UserPresenceData>({
    isOnline: false,
    lastSeen: undefined,
    lastActivity: undefined,
  });

  useEffect(() => {
    if (!userId) {
      setPresence({
        isOnline: false,
        lastSeen: undefined,
        lastActivity: undefined,
      });
      return;
    }

    const userRef = doc(db, 'usuarios', userId);
    
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const presenceData = {
            isOnline: data.isOnline || false,
            lastSeen: data.lastSeen,
            lastActivity: data.lastActivity,
          };
          setPresence(presenceData);
        } else {
          setPresence({
            isOnline: false,
            lastSeen: undefined,
            lastActivity: undefined,
          });
        }
      },
      (error) => {
        console.error('Erro ao escutar presença do usuário:', error);
        setPresence({
          isOnline: false,
          lastSeen: undefined,
          lastActivity: undefined,
        });
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return presence;
}
