import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { format, isToday, isYesterday } from "date-fns";
import { db } from "@/lib/firebase";
import type { User } from "@shared/schema";

const ONLINE_STALE_AFTER_MS = 40_000;

export interface UserPresenceStatus {
  isOnline: boolean;
  statusText: string;
  lastSeenDate?: Date;
}

type TimestampLike =
  | string
  | number
  | Date
  | {
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
    }
  | null
  | undefined;

function toValidDate(value: TimestampLike): Date | null {
  if (value == null) return null;

  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  } else if (typeof value.toDate === "function") {
    date = value.toDate();
  } else if (typeof value.seconds === "number") {
    date = new Date(value.seconds * 1_000);
  } else if (typeof value._seconds === "number") {
    date = new Date(value._seconds * 1_000);
  } else {
    return null;
  }

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLastSeen(lastSeenDate: Date | null): UserPresenceStatus {
  if (!lastSeenDate) {
    return {
      isOnline: false,
      statusText: "Offline",
    };
  }

  const time = format(lastSeenDate, "HH:mm");
  let statusText: string;

  if (isToday(lastSeenDate)) {
    statusText = `Visto por último hoje às ${time}`;
  } else if (isYesterday(lastSeenDate)) {
    statusText = `Visto por último ontem às ${time}`;
  } else {
    statusText = `Visto por último em ${format(lastSeenDate, "dd/MM/yyyy")} às ${time}`;
  }

  return {
    isOnline: false,
    statusText,
    lastSeenDate,
  };
}

function isTruthyOnline(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function calculatePresence(userData: User | null): UserPresenceStatus {
  if (!userData) {
    return {
      isOnline: false,
      statusText: "Offline",
    };
  }

  const lastActivityDate = toValidDate(userData.lastActivity as TimestampLike);
  const activityAge = lastActivityDate
    ? Date.now() - lastActivityDate.getTime()
    : Number.POSITIVE_INFINITY;
  const activityIsFresh =
    activityAge >= -30_000 && activityAge <= ONLINE_STALE_AFTER_MS;

  const statusSaysOnline = userData.statusPresenca === "online";
  const declaredOnline =
    (isTruthyOnline(userData.isOnline) || statusSaysOnline) &&
    userData.statusPresenca !== "offline";

  if (declaredOnline && activityIsFresh) {
    return {
      isOnline: true,
      statusText: "Online",
    };
  }

  const storedLastSeen = toValidDate(userData.lastSeen as TimestampLike);
  const effectiveLastSeen =
    storedLastSeen && lastActivityDate
      ? storedLastSeen.getTime() >= lastActivityDate.getTime()
        ? storedLastSeen
        : lastActivityDate
      : storedLastSeen ?? lastActivityDate;

  return formatLastSeen(effectiveLastSeen);
}

function sameStatus(a: UserPresenceStatus, b: UserPresenceStatus): boolean {
  return (
    a.isOnline === b.isOnline &&
    a.statusText === b.statusText &&
    a.lastSeenDate?.getTime() === b.lastSeenDate?.getTime()
  );
}

/**
 * Observa a presença em tempo real. O próprio usuário grava offline após
 * 30 segundos sem atividade. A expiração local de 40 segundos é apenas um
 * fallback para fechamento abrupto ou perda de conexão. Não usa polling.
 */
export function useUserPresenceStatus(
  userId: string | null | undefined,
): UserPresenceStatus {
  const latestUserRef = useRef<User | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<UserPresenceStatus>(() =>
    calculatePresence(null),
  );

  useEffect(() => {
    latestUserRef.current = null;

    const clearExpiryTimer = () => {
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
    };

    const refreshLocalStatus = () => {
      clearExpiryTimer();

      const nextStatus = calculatePresence(latestUserRef.current);
      setStatus((current) =>
        sameStatus(current, nextStatus) ? current : nextStatus,
      );

      if (nextStatus.isOnline && latestUserRef.current) {
        const lastActivity = toValidDate(
          latestUserRef.current.lastActivity as TimestampLike,
        );

        if (lastActivity) {
          const remaining = Math.max(
            100,
            ONLINE_STALE_AFTER_MS - (Date.now() - lastActivity.getTime()) + 100,
          );
          expiryTimerRef.current = setTimeout(refreshLocalStatus, remaining);
        }
      }
    };

    clearExpiryTimer();
    setStatus((current) => {
      const next = calculatePresence(null);
      return sameStatus(current, next) ? current : next;
    });

    if (!userId) return;

    const unsubscribe = onSnapshot(
      doc(db, "usuarios", userId),
      (snapshot) => {
        latestUserRef.current = snapshot.exists()
          ? (snapshot.data() as User)
          : null;
        refreshLocalStatus();
      },
      (error) => {
        console.error("Erro ao observar presença do usuário:", error);
        latestUserRef.current = null;
        refreshLocalStatus();
      },
    );

    return () => {
      unsubscribe();
      clearExpiryTimer();
      latestUserRef.current = null;
    };
  }, [userId]);

  return status;
}
