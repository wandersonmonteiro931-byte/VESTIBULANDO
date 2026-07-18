import { useEffect, useRef } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const HEARTBEAT_INTERVAL_MS = 30_000;
const INACTIVITY_TIMEOUT_MS = 120_000;

/**
 * Mantém a presença do usuário no Firestore.
 *
 * Regras:
 * - online somente enquanto a página estiver visível e houver conexão;
 * - offline imediatamente ao ocultar/fechar a página ou sair da conta;
 * - lastActivity é renovado a cada 30 segundos enquanto online;
 * - após 2 minutos sem interação, o usuário fica offline.
 *
 * O status exibido por outros usuários também possui expiração por lastActivity,
 * evitando que uma conexão encerrada abruptamente permaneça online para sempre.
 */
export function useUserPresence(userId: string | null | undefined) {
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desiredOnlineRef = useRef(false);
  const writeSequenceRef = useRef(0);

  useEffect(() => {
    if (!userId) return;

    const userRef = doc(db, "usuarios", userId);
    let disposed = false;

    const clearHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    const clearInactivity = () => {
      if (inactivityRef.current) {
        clearTimeout(inactivityRef.current);
        inactivityRef.current = null;
      }
    };

    const writePresence = async (online: boolean) => {
      const sequence = ++writeSequenceRef.current;
      desiredOnlineRef.current = online;

      try {
        if (online) {
          await updateDoc(userRef, {
            isOnline: true,
            lastActivity: serverTimestamp(),
            statusPresenca: "online",
          });
        } else {
          await updateDoc(userRef, {
            isOnline: false,
            lastSeen: serverTimestamp(),
            lastActivity: serverTimestamp(),
            statusPresenca: "offline",
          });
        }
      } catch (error: any) {
        if (
          error?.code !== "permission-denied" &&
          !error?.message?.includes("INTERNAL ASSERTION FAILED")
        ) {
          console.error(
            `[Presence] Não foi possível marcar ${userId} como ${online ? "online" : "offline"}:`,
            error,
          );
        }

        // Só desfaz o estado local quando esta ainda é a operação mais recente.
        if (sequence === writeSequenceRef.current && online) {
          desiredOnlineRef.current = false;
        }
      }
    };

    const refreshHeartbeat = async () => {
      if (
        disposed ||
        !desiredOnlineRef.current ||
        document.hidden ||
        !navigator.onLine
      ) {
        return;
      }

      try {
        await updateDoc(userRef, {
          lastActivity: serverTimestamp(),
          isOnline: true,
          statusPresenca: "online",
        });
      } catch (error: any) {
        if (
          error?.code !== "permission-denied" &&
          !error?.message?.includes("INTERNAL ASSERTION FAILED")
        ) {
          console.error("[Presence] Erro ao renovar atividade:", error);
        }
      }
    };

    const startHeartbeat = () => {
      clearHeartbeat();
      heartbeatRef.current = setInterval(() => {
        void refreshHeartbeat();
      }, HEARTBEAT_INTERVAL_MS);
    };

    const markOnline = () => {
      if (disposed || document.hidden || !navigator.onLine) return;

      if (!desiredOnlineRef.current) {
        void writePresence(true);
      } else {
        void refreshHeartbeat();
      }

      startHeartbeat();
    };

    const markOffline = () => {
      clearHeartbeat();
      clearInactivity();

      if (desiredOnlineRef.current) {
        // Atualiza o estado local antes da escrita para bloquear novos heartbeats.
        desiredOnlineRef.current = false;
        void writePresence(false);
      }
    };

    const scheduleInactivity = () => {
      clearInactivity();
      inactivityRef.current = setTimeout(() => {
        markOffline();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const handleActivity = () => {
      if (disposed || document.hidden || !navigator.onLine) return;

      markOnline();
      scheduleInactivity();
    };

    const throttledActivity = () => {
      if (activityThrottleRef.current) return;

      activityThrottleRef.current = setTimeout(() => {
        activityThrottleRef.current = null;
        handleActivity();
      }, 1_000);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Não espera 3 segundos: fechar a aba não mantém a página viva para concluir o timeout.
        markOffline();
      } else {
        handleActivity();
      }
    };

    const handlePageExit = () => {
      // Firestore pode não concluir uma escrita durante o fechamento abrupto.
      // Mesmo assim, iniciamos a escrita; o leitor usa lastActivity com expiração
      // como proteção definitiva contra status online preso.
      markOffline();
    };

    const handleNetworkOffline = () => {
      markOffline();
    };

    const handleNetworkOnline = () => {
      handleActivity();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handlePageExit);
    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("online", handleNetworkOnline);
    window.addEventListener("offline", handleNetworkOffline);
    window.addEventListener("focus", handleActivity);
    window.addEventListener("mousemove", throttledActivity);
    window.addEventListener("keydown", throttledActivity);
    window.addEventListener("click", throttledActivity);
    window.addEventListener("scroll", throttledActivity);
    window.addEventListener("touchstart", throttledActivity);

    if (!document.hidden && navigator.onLine) {
      markOnline();
      scheduleInactivity();
    }

    return () => {
      disposed = true;
      clearHeartbeat();
      clearInactivity();

      if (activityThrottleRef.current) {
        clearTimeout(activityThrottleRef.current);
        activityThrottleRef.current = null;
      }

      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handlePageExit);
      window.removeEventListener("pagehide", handlePageExit);
      window.removeEventListener("online", handleNetworkOnline);
      window.removeEventListener("offline", handleNetworkOffline);
      window.removeEventListener("focus", handleActivity);
      window.removeEventListener("mousemove", throttledActivity);
      window.removeEventListener("keydown", throttledActivity);
      window.removeEventListener("click", throttledActivity);
      window.removeEventListener("scroll", throttledActivity);
      window.removeEventListener("touchstart", throttledActivity);

      if (desiredOnlineRef.current) {
        desiredOnlineRef.current = false;
        void writePresence(false);
      }
    };
  }, [userId]);
}
