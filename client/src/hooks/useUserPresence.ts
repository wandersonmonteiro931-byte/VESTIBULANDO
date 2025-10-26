import { useEffect, useRef } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Hook para gerenciar a presença do usuário em tempo real
 * Atualiza lastActivity enquanto o usuário está ativo
 * Marca como offline quando sai da página ou minimiza
 */
export function useUserPresence(userId: string | null | undefined) {
  const activityIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const offlineTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isOnlineRef = useRef(false);
  const lastActivityUpdateRef = useRef<number>(0);
  const onlineDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!userId) return;

    const userRef = doc(db, 'usuarios', userId);

    // Função para marcar como online (com proteção contra writes duplicados e debounce)
    const setOnline = async () => {
      // Se já está online, não faz nada
      if (isOnlineRef.current) return;
      
      try {
        await updateDoc(userRef, {
          isOnline: true,
          lastActivity: serverTimestamp(),
          statusPresenca: 'online',
        });
        isOnlineRef.current = true;
        lastActivityUpdateRef.current = Date.now();
      } catch (error) {
        console.error('Erro ao marcar usuário como online:', error);
      }
    };

    // Função para marcar como online com debounce (para evitar writes frequentes)
    const setOnlineDebounced = () => {
      if (onlineDebounceRef.current) {
        clearTimeout(onlineDebounceRef.current);
      }
      
      onlineDebounceRef.current = setTimeout(() => {
        setOnline();
      }, 500); // Aguarda 500ms de estabilidade antes de marcar como online
    };

    // Função para marcar como offline
    const setOffline = async () => {
      if (!isOnlineRef.current) return; // Já está offline
      
      try {
        await updateDoc(userRef, {
          isOnline: false,
          lastSeen: serverTimestamp(),
          statusPresenca: 'offline',
        });
        isOnlineRef.current = false;
      } catch (error) {
        console.error('Erro ao marcar usuário como offline:', error);
      }
    };

    // Função para marcar offline via sendBeacon (mais confiável no beforeunload)
    const setOfflineBeacon = () => {
      if (!isOnlineRef.current) return;
      
      // Marcar localmente como offline
      isOnlineRef.current = false;
      
      // Usar sendBeacon com blob JSON
      try {
        const blob = new Blob(
          [JSON.stringify({ timestamp: new Date().toISOString() })],
          { type: 'application/json' }
        );
        navigator.sendBeacon(`/api/user-offline/${userId}`, blob);
      } catch (error) {
        // Fallback silencioso - visibilitychange também tentará marcar offline
      }
    };

    // Função para atualizar atividade (com throttle)
    const updateActivity = async () => {
      if (!isOnlineRef.current) return;
      
      const now = Date.now();
      const timeSinceLastUpdate = now - lastActivityUpdateRef.current;
      
      // Throttle: só atualiza se passaram pelo menos 30 segundos desde a última atualização
      if (timeSinceLastUpdate < 30000) return;
      
      try {
        await updateDoc(userRef, {
          lastActivity: serverTimestamp(),
        });
        lastActivityUpdateRef.current = now;
      } catch (error) {
        console.error('Erro ao atualizar atividade:', error);
      }
    };

    // Handler para quando a página fica visível/oculta
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Cancela qualquer debounce de online pendente
        if (onlineDebounceRef.current) {
          clearTimeout(onlineDebounceRef.current);
          onlineDebounceRef.current = null;
        }
        
        // Página foi minimizada ou usuário saiu da aba
        // Aguarda 3 segundos antes de marcar como offline
        offlineTimeoutRef.current = setTimeout(() => {
          setOffline();
          // Para o intervalo de atualização de atividade
          if (activityIntervalRef.current) {
            clearInterval(activityIntervalRef.current);
            activityIntervalRef.current = null;
          }
        }, 3000);
      } else {
        // Página voltou a ficar visível
        // Cancela o timeout de offline se ainda não executou
        if (offlineTimeoutRef.current) {
          clearTimeout(offlineTimeoutRef.current);
          offlineTimeoutRef.current = null;
        }
        // Marca como online com debounce (para evitar múltiplas escritas em alternâncias rápidas)
        if (!isOnlineRef.current) {
          setOnlineDebounced();
        }
        // Inicia intervalo de atualização de atividade se não existe
        if (!activityIntervalRef.current && isOnlineRef.current) {
          activityIntervalRef.current = setInterval(updateActivity, 30000); // Atualiza a cada 30 segundos
        }
      }
    };

    // Handler para eventos de interação do usuário (com throttle)
    const handleUserActivity = () => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastActivityUpdateRef.current;
      
      // Se estava offline, marca como online
      if (!isOnlineRef.current) {
        setOnline();
        return;
      }
      
      // Se já está online mas passou muito tempo sem atualizar, atualiza
      if (timeSinceLastUpdate >= 30000) {
        updateActivity();
      }
    };

    // Handler para beforeunload (fechar página/navegador)
    const handleBeforeUnload = () => {
      // Usar sendBeacon para tentar marcar como offline
      setOfflineBeacon();
    };

    // Marca como online ao iniciar
    setOnline();

    // Inicia intervalo de atualização de atividade (a cada 30 segundos)
    activityIntervalRef.current = setInterval(updateActivity, 30000);

    // Adiciona listeners para detectar quando usuário sai da página
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Adiciona listeners para detectar atividade do usuário
    // Mas com throttle - só vai chamar handleUserActivity no máximo a cada 30s
    let activityThrottle: NodeJS.Timeout | null = null;
    const throttledActivity = () => {
      if (activityThrottle) return;
      activityThrottle = setTimeout(() => {
        handleUserActivity();
        activityThrottle = null;
      }, 1000); // Throttle de 1 segundo para os eventos de atividade
    };

    window.addEventListener('focus', handleUserActivity);
    window.addEventListener('mousemove', throttledActivity);
    window.addEventListener('keydown', throttledActivity);
    window.addEventListener('click', throttledActivity);
    window.addEventListener('scroll', throttledActivity);
    window.addEventListener('touchstart', throttledActivity);

    // Cleanup
    return () => {
      // Para todos os timers
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
      }
      if (offlineTimeoutRef.current) {
        clearTimeout(offlineTimeoutRef.current);
      }
      if (onlineDebounceRef.current) {
        clearTimeout(onlineDebounceRef.current);
      }
      if (activityThrottle) {
        clearTimeout(activityThrottle);
      }

      // Remove listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('focus', handleUserActivity);
      window.removeEventListener('mousemove', throttledActivity);
      window.removeEventListener('keydown', throttledActivity);
      window.removeEventListener('click', throttledActivity);
      window.removeEventListener('scroll', throttledActivity);
      window.removeEventListener('touchstart', throttledActivity);

      // CRÍTICO: Marca como offline ao desmontar o hook
      // Usa sendBeacon como fallback se updateDoc falhar
      if (isOnlineRef.current) {
        // Tenta marcar offline via Firestore (async - pode não completar)
        setOffline().catch(() => {
          // Se falhar, tenta com sendBeacon
          setOfflineBeacon();
        });
        
        // Também tenta com sendBeacon para garantir
        setOfflineBeacon();
      }
    };
  }, [userId]);
}
