import { useEffect } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const IDLE_TIMEOUT_MS = 30_000;
const ONLINE_WRITE_THROTTLE_MS = 8_000;
const ACTIVITY_HANDLER_THROTTLE_MS = 250;

/**
 * Presença baseada em atividade real do usuário.
 *
 * Regras:
 * - fica online imediatamente depois do login;
 * - continua online enquanto houver mouse, teclado, toque, rolagem ou foco;
 * - depois de 30 segundos sem atividade é marcado como offline;
 * - ao voltar a interagir fica online imediatamente;
 * - o logout registra offline no AuthContext;
 * - não usa polling nem heartbeat recorrente: somente eventos e um timeout único.
 */
export function useUserPresence(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;

    const userRef = doc(db, "usuarios", userId);
    let disposed = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let lastOnlineWriteAt = 0;
    let lastHandledActivityAt = 0;
    let desiredState: "online" | "offline" = "online";
    let writeQueue: Promise<void> = Promise.resolve();

    const clearIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const reportWriteError = (state: "online" | "offline", error: any) => {
      if (
        error?.code !== "permission-denied" &&
        !error?.message?.includes("INTERNAL ASSERTION FAILED")
      ) {
        console.error(`[Presence] Falha ao marcar ${userId} como ${state}:`, error);
      }
    };

    const enqueuePresenceWrite = (
      state: "online" | "offline",
      force = false,
    ) => {
      if (disposed) return;

      const now = Date.now();
      if (
        state === "online" &&
        !force &&
        desiredState === "online" &&
        now - lastOnlineWriteAt < ONLINE_WRITE_THROTTLE_MS
      ) {
        return;
      }

      desiredState = state;
      if (state === "online") {
        lastOnlineWriteAt = now;
      }

      writeQueue = writeQueue
        .catch(() => undefined)
        .then(async () => {
          if (disposed || desiredState !== state) return;

          try {
            if (state === "online") {
              await updateDoc(userRef, {
                isOnline: true,
                statusPresenca: "online",
                lastActivity: serverTimestamp(),
              });
            } else {
              await updateDoc(userRef, {
                isOnline: false,
                statusPresenca: "offline",
                lastSeen: serverTimestamp(),
                lastActivity: serverTimestamp(),
              });
            }
          } catch (error: any) {
            reportWriteError(state, error);
          }
        });
    };

    const markIdle = () => {
      clearIdleTimer();
      enqueuePresenceWrite("offline", true);
    };

    const scheduleIdle = () => {
      clearIdleTimer();
      idleTimer = setTimeout(markIdle, IDLE_TIMEOUT_MS);
    };

    const markActive = (forceWrite = false) => {
      if (disposed) return;

      scheduleIdle();

      if (!navigator.onLine) return;

      const wasOffline = desiredState === "offline";
      enqueuePresenceWrite("online", forceWrite || wasOffline);
    };

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastHandledActivityAt < ACTIVITY_HANDLER_THROTTLE_MS) return;
      lastHandledActivityAt = now;
      markActive(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Registra o instante em que a aba deixou de ser usada. Outros clientes
        // considerarão a presença expirada após 30 segundos, mesmo que o
        // navegador suspenda o timeout em segundo plano.
        enqueuePresenceWrite("online", true);
        scheduleIdle();
      } else {
        markActive(true);
      }
    };

    const handleOnline = () => markActive(true);

    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "pointermove",
      "keydown",
      "touchstart",
      "scroll",
      "focus",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    // Login concluído: online imediatamente.
    markActive(true);

    return () => {
      disposed = true;
      clearIdleTimer();

      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);

      // Não grava offline no cleanup: mudanças de rota e remontagens do React
      // não devem derrubar a presença. O logout faz a gravação explícita; caso
      // a página seja fechada abruptamente, lastActivity expira em 30 segundos.
    };
  }, [userId]);
}
