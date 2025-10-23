import { useEffect, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import { getNowBrasiliaISO } from '@/lib/brasiliaTime';

const ACTIVITY_UPDATE_INTERVAL = 60000; // 1 minuto
const ACTIVITY_THROTTLE = 5000; // 5 segundos

export function usePresence(currentUser: FirebaseUser | null) {
  const lastActivityRef = useRef<number>(Date.now());
  const activityTimeoutRef = useRef<NodeJS.Timeout>();
  const intervalRef = useRef<NodeJS.Timeout>();

  const updatePresence = async (isOnline: boolean) => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, 'usuarios', currentUser.uid);
      const updateData: any = {
        isOnline,
        lastActivity: getNowBrasiliaISO(),
      };

      if (!isOnline) {
        updateData.lastSeen = getNowBrasiliaISO();
      }

      await updateDoc(userRef, updateData);
    } catch (error: any) {
      // Ignorar erro de permissão - usuários sem permissão de escrita não terão presença atualizada
      if (error?.code !== 'permission-denied') {
        console.error('Erro ao atualizar presença:', error);
      }
    }
  };

  const setUserOnline = async () => {
    if (!currentUser) return;
    await updatePresence(true);
  };

  const setUserOffline = async () => {
    if (!currentUser) return;
    await updatePresence(false);
  };

  const handleActivity = () => {
    const now = Date.now();
    if (now - lastActivityRef.current > ACTIVITY_THROTTLE) {
      lastActivityRef.current = now;
      
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }

      activityTimeoutRef.current = setTimeout(() => {
        if (currentUser) {
          updatePresence(true);
        }
      }, 1000);
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    // Marcar como online ao montar
    setUserOnline();

    // Atualizar periodicamente a atividade
    intervalRef.current = setInterval(() => {
      updatePresence(true);
    }, ACTIVITY_UPDATE_INTERVAL);

    // Eventos de atividade do usuário
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Marcar como offline ao sair
    const handleBeforeUnload = () => {
      // Atualizar status offline
      // Nota: Esta atualização pode não completar se a página fechar muito rapidamente
      // Para produção, considere usar Cloud Functions com onDisconnect do Realtime Database
      const userRef = doc(db, 'usuarios', currentUser.uid);
      const offlineData = {
        isOnline: false,
        lastSeen: getNowBrasiliaISO(),
        lastActivity: getNowBrasiliaISO(),
      };
      
      updateDoc(userRef, offlineData).catch((error: any) => {
        // Ignorar erro de permissão
        if (error?.code !== 'permission-denied') {
          console.error(error);
        }
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setUserOffline();
      } else {
        setUserOnline();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Limpar intervalos e eventos
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      // Marcar como offline ao desmontar
      setUserOffline();
    };
  }, [currentUser]);

  return {
    updatePresence,
    setUserOnline,
    setUserOffline,
  };
}
