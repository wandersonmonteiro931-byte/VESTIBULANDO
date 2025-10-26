import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User } from '@shared/schema';
import { format, isToday, isYesterday } from 'date-fns';

export interface UserPresenceStatus {
  isOnline: boolean;
  statusText: string;
  lastSeenDate?: Date;
}

/**
 * Hook para observar o status de presença de outro usuário em tempo real
 * Retorna se está online e a última vez visto
 */
export function useUserPresenceStatus(userId: string | null | undefined): UserPresenceStatus {
  const [status, setStatus] = useState<UserPresenceStatus>({
    isOnline: false,
    statusText: 'Nunca visto',
  });

  useEffect(() => {
    if (!userId) {
      setStatus({ isOnline: false, statusText: 'Nunca visto' });
      return;
    }

    const userRef = doc(db, 'usuarios', userId);
    
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setStatus({ isOnline: false, statusText: 'Nunca visto' });
          return;
        }

        const userData = snapshot.data() as User;
        const isOnline = userData.isOnline || false;

        console.log(`[PresenceStatus] Usuário ${userId} - isOnline:`, isOnline, 'lastSeen:', userData.lastSeen);

        if (isOnline) {
          setStatus({
            isOnline: true,
            statusText: 'Online agora',
          });
        } else {
          // Usuário está offline, calcular última vez visto
          const lastSeenTimestamp = userData.lastSeen;
          
          if (!lastSeenTimestamp) {
            setStatus({
              isOnline: false,
              statusText: 'Nunca visto',
            });
            return;
          }

          try {
            // Converter timestamp do Firebase para Date
            let lastSeenDate: Date;
            
            if (typeof lastSeenTimestamp === 'string') {
              lastSeenDate = new Date(lastSeenTimestamp);
            } else if (lastSeenTimestamp && typeof lastSeenTimestamp === 'object' && 'toDate' in lastSeenTimestamp) {
              lastSeenDate = (lastSeenTimestamp as any).toDate();
            } else if (lastSeenTimestamp && typeof lastSeenTimestamp === 'object' && 'seconds' in lastSeenTimestamp) {
              lastSeenDate = new Date((lastSeenTimestamp as any).seconds * 1000);
            } else {
              lastSeenDate = new Date();
            }

            let statusText: string;

            // Formatar conforme especificação:
            // CASO SEJA HOJE: "Visto por último hoje às XX:XX"
            // CASO SEJA ONTEM: "Visto por último ontem às XX:XX"
            // CASO SEJA OUTRA DATA: "Visto por último em XX/XX/XXXX às XX:XX"
            
            const timeStr = format(lastSeenDate, 'HH:mm');
            
            if (isToday(lastSeenDate)) {
              statusText = `Visto por último hoje às ${timeStr}`;
            } else if (isYesterday(lastSeenDate)) {
              statusText = `Visto por último ontem às ${timeStr}`;
            } else {
              const dateStr = format(lastSeenDate, 'dd/MM/yyyy');
              statusText = `Visto por último em ${dateStr} às ${timeStr}`;
            }

            setStatus({
              isOnline: false,
              statusText,
              lastSeenDate,
            });
          } catch (error) {
            console.error('Erro ao processar lastSeen:', error);
            setStatus({
              isOnline: false,
              statusText: 'Nunca visto',
            });
          }
        }
      },
      (error) => {
        console.error('Erro ao observar presença do usuário:', error);
        setStatus({ isOnline: false, statusText: 'Nunca visto' });
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return status;
}
