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
    statusText: 'NUNCA VISTO',
  });

  useEffect(() => {
    if (!userId) {
      setStatus({ isOnline: false, statusText: 'NUNCA VISTO' });
      return;
    }

    const userRef = doc(db, 'usuarios', userId);
    
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setStatus({ isOnline: false, statusText: 'NUNCA VISTO' });
          return;
        }

        const userData = snapshot.data() as User;
        const isOnline = userData.isOnline || false;

        if (isOnline) {
          setStatus({
            isOnline: true,
            statusText: 'ONLINE AGORA',
          });
        } else {
          // Usuário está offline, calcular última vez visto
          const lastSeenTimestamp = userData.lastSeen;
          
          if (!lastSeenTimestamp) {
            setStatus({
              isOnline: false,
              statusText: 'NUNCA VISTO',
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

            // Formatar conforme especificação EXATA:
            // HOJE: "VISTO POR ÚLTIMO HOJE AS XX:XX"
            // ONTEM: "VISTO POR ÚLTIMO ONTEM AS XX:XX"
            // OUTRA DATA: "VISTO POR ÚLTIMO EM XX/XX/XXXX AS XX:XX"
            
            const timeStr = format(lastSeenDate, 'HH:mm');
            
            if (isToday(lastSeenDate)) {
              statusText = `VISTO POR ÚLTIMO HOJE AS ${timeStr}`;
            } else if (isYesterday(lastSeenDate)) {
              statusText = `VISTO POR ÚLTIMO ONTEM AS ${timeStr}`;
            } else {
              const dateStr = format(lastSeenDate, 'dd/MM/yyyy');
              statusText = `VISTO POR ÚLTIMO EM ${dateStr} AS ${timeStr}`;
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
              statusText: 'NUNCA VISTO',
            });
          }
        }
      },
      (error) => {
        console.error('Erro ao observar presença do usuário:', error);
        setStatus({ isOnline: false, statusText: 'NUNCA VISTO' });
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return status;
}
