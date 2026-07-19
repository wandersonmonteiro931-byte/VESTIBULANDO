import { useEffect } from "react";
import { doc, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const IDLE_TIMEOUT_MS = 30_000;
const ONLINE_WRITE_THROTTLE_MS = 8_000;
const ACTIVITY_HANDLER_THROTTLE_MS = 250;
const CROSS_TAB_BROADCAST_THROTTLE_MS = 1_000;


function timestampToMillis(value: any): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const result = new Date(value).getTime();
    return Number.isNaN(result) ? null : result;
  }
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1_000;
  if (typeof value._seconds === "number") return value._seconds * 1_000;
  return null;
}

interface SharedActivityPayload {
  at: number;
  tabId: string;
}

function readActivityPayload(value: string | null): SharedActivityPayload | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<SharedActivityPayload>;
    if (typeof parsed.at !== "number" || typeof parsed.tabId !== "string") {
      return null;
    }
    return { at: parsed.at, tabId: parsed.tabId };
  } catch {
    return null;
  }
}

/**
 * Presença baseada em atividade real e sincronizada entre abas.
 *
 * Regras:
 * - fica online imediatamente depois do login;
 * - qualquer atividade em qualquer aba mantém a conta online;
 * - depois de 30 segundos sem atividade em todas as abas fica offline;
 * - ao voltar a interagir fica online imediatamente;
 * - logout registra offline pelo AuthContext;
 * - sem polling: usa eventos, BroadcastChannel/localStorage e um timeout.
 */
export function useUserPresence(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;

    const userRef = doc(db, "usuarios", userId);
    const storageKey = `vestibulando-presence:${userId}`;
    const channelName = `vestibulando-presence-channel:${userId}`;
    const tabId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    let disposed = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let lastOnlineWriteAt = 0;
    let lastHandledActivityAt = 0;
    let lastCrossTabBroadcastAt = 0;
    let desiredState: "online" | "offline" = "online";
    let writeQueue: Promise<void> = Promise.resolve();
    let channel: BroadcastChannel | null = null;

    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel(channelName);
      }
    } catch {
      channel = null;
    }

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
              // Antes de gravar offline, confirma se outra aba, navegador ou
              // dispositivo da mesma conta não registrou atividade mais recente.
              // Isso impede que uma sessão parada derrube uma sessão ativa.
              await runTransaction(db, async (transaction) => {
                const snapshot = await transaction.get(userRef);
                if (!snapshot.exists()) return;

                const data = snapshot.data();
                const remoteActivityMs = timestampToMillis(data.lastActivity);
                const remoteActivityAge = remoteActivityMs == null
                  ? Number.POSITIVE_INFINITY
                  : Math.max(0, Date.now() - remoteActivityMs);

                if (
                  data.statusPresenca === "online" &&
                  remoteActivityAge < IDLE_TIMEOUT_MS - 250
                ) {
                  return;
                }

                transaction.update(userRef, {
                  isOnline: false,
                  statusPresenca: "offline",
                  lastSeen: serverTimestamp(),
                  lastActivity: serverTimestamp(),
                });
              });
            }
          } catch (error: any) {
            reportWriteError(state, error);
          }
        });
    };

    const getSharedLastActivityAt = (): number => {
      try {
        const payload = readActivityPayload(localStorage.getItem(storageKey));
        return payload?.at ?? 0;
      } catch {
        return 0;
      }
    };

    const scheduleIdleFrom = (activityAt: number) => {
      clearIdleTimer();
      const remaining = Math.max(0, IDLE_TIMEOUT_MS - (Date.now() - activityAt));
      idleTimer = setTimeout(() => {
        const sharedActivityAt = getSharedLastActivityAt();
        const newestActivityAt = Math.max(activityAt, sharedActivityAt);
        const age = Date.now() - newestActivityAt;

        if (age < IDLE_TIMEOUT_MS) {
          scheduleIdleFrom(newestActivityAt);
          return;
        }

        enqueuePresenceWrite("offline", true);
      }, remaining + 25);
    };

    const acceptSharedActivity = (payload: SharedActivityPayload) => {
      if (disposed || payload.tabId === tabId) return;

      // Cancela qualquer escrita offline que ainda esteja na fila e sincroniza
      // o timeout desta aba com a atividade feita em outra aba.
      desiredState = "online";
      scheduleIdleFrom(payload.at);
    };

    const broadcastActivity = (activityAt: number, force = false) => {
      if (
        !force &&
        activityAt - lastCrossTabBroadcastAt < CROSS_TAB_BROADCAST_THROTTLE_MS
      ) {
        return;
      }

      lastCrossTabBroadcastAt = activityAt;
      const payload: SharedActivityPayload = { at: activityAt, tabId };

      try {
        localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch {
        // O BroadcastChannel ainda funciona quando o storage estiver bloqueado.
      }

      try {
        channel?.postMessage(payload);
      } catch {
        // Ignora navegadores sem suporte completo ao canal.
      }
    };

    const markActive = (forceWrite = false, forceBroadcast = false) => {
      if (disposed) return;

      const now = Date.now();
      scheduleIdleFrom(now);
      broadcastActivity(now, forceBroadcast);

      if (!navigator.onLine) return;

      const wasOffline = desiredState === "offline";
      enqueuePresenceWrite("online", forceWrite || wasOffline);
    };

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastHandledActivityAt < ACTIVITY_HANDLER_THROTTLE_MS) return;
      lastHandledActivityAt = now;
      markActive(false, false);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        markActive(true, true);
      }
      // Ao ocultar a aba não marca offline imediatamente. O timeout compartilhado
      // só derruba a conta se nenhuma outra aba tiver atividade por 30 segundos.
    };

    const handleOnline = () => markActive(true, true);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      const payload = readActivityPayload(event.newValue);
      if (payload) acceptSharedActivity(payload);
    };

    if (channel) {
      channel.onmessage = (event: MessageEvent<SharedActivityPayload>) => {
        const payload = event.data;
        if (
          payload &&
          typeof payload.at === "number" &&
          typeof payload.tabId === "string"
        ) {
          acceptSharedActivity(payload);
        }
      };
    }

    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "pointermove",
      "mousemove",
      "mousedown",
      "click",
      "keydown",
      "input",
      "touchstart",
      "touchmove",
      "scroll",
      "wheel",
      "focus",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("storage", handleStorage);

    // Login concluído: online imediatamente e informa as demais abas.
    markActive(true, true);

    return () => {
      disposed = true;
      clearIdleTimer();

      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("storage", handleStorage);

      if (channel) {
        channel.onmessage = null;
        channel.close();
      }

      // Não grava offline no cleanup: trocar de rota ou fechar apenas uma das
      // abas não pode derrubar a presença das outras abas abertas.
    };
  }, [userId]);
}
