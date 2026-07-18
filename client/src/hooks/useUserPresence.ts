import { useEffect } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const HEARTBEAT_INTERVAL_MS = 25_000;

/**
 * Mantém a presença do usuário no Firestore.
 *
 * Regras:
 * - online enquanto a página estiver aberta, visível e com internet;
 * - não fica offline apenas por ausência de mouse/teclado;
 * - offline ao ocultar/fechar a página, perder a conexão ou sair da conta;
 * - lastActivity é renovado periodicamente enquanto online;
 * - as gravações são enfileiradas para impedir que uma escrita antiga de
 *   "offline" sobrescreva uma escrita mais nova de "online".
 */
export function useUserPresence(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;

    const userRef = doc(db, "usuarios", userId);
    let disposed = false;
    let desiredOnline = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let writeQueue: Promise<void> = Promise.resolve();

    const clearHeartbeat = () => {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    };

    const reportWriteError = (online: boolean, error: any) => {
      if (
        error?.code !== "permission-denied" &&
        !error?.message?.includes("INTERNAL ASSERTION FAILED")
      ) {
        console.error(
          `[Presence] Não foi possível marcar ${userId} como ${online ? "online" : "offline"}:`,
          error,
        );
      }
    };

    const enqueuePresenceWrite = (online: boolean) => {
      desiredOnline = online;

      writeQueue = writeQueue
        .catch(() => undefined)
        .then(async () => {
          // Descarta uma escrita antiga quando o estado desejado já mudou.
          if (desiredOnline !== online) return;
          if (disposed && online) return;

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
            reportWriteError(online, error);
          }
        });
    };

    const refreshHeartbeat = () => {
      if (disposed || !desiredOnline || document.hidden || !navigator.onLine) {
        return;
      }

      enqueuePresenceWrite(true);
    };

    const startHeartbeat = () => {
      clearHeartbeat();
      heartbeat = setInterval(refreshHeartbeat, HEARTBEAT_INTERVAL_MS);
    };

    const markOnline = () => {
      if (disposed || document.hidden || !navigator.onLine) return;

      enqueuePresenceWrite(true);
      startHeartbeat();
    };

    const markOffline = () => {
      clearHeartbeat();

      if (!desiredOnline) return;
      enqueuePresenceWrite(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        markOffline();
      } else {
        markOnline();
      }
    };

    const handleNetworkOnline = () => markOnline();
    const handleNetworkOffline = () => markOffline();
    const handlePageExit = () => markOffline();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", markOnline);
    window.addEventListener("focus", markOnline);
    window.addEventListener("online", handleNetworkOnline);
    window.addEventListener("offline", handleNetworkOffline);
    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("beforeunload", handlePageExit);

    if (!document.hidden && navigator.onLine) {
      markOnline();
    }

    return () => {
      disposed = true;
      clearHeartbeat();

      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", markOnline);
      window.removeEventListener("focus", markOnline);
      window.removeEventListener("online", handleNetworkOnline);
      window.removeEventListener("offline", handleNetworkOffline);
      window.removeEventListener("pagehide", handlePageExit);
      window.removeEventListener("beforeunload", handlePageExit);

      if (desiredOnline) {
        enqueuePresenceWrite(false);
      }
    };
  }, [userId]);
}
