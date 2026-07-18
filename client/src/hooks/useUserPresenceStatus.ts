import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { format, isToday, isYesterday } from "date-fns";
import { db } from "@/lib/firebase";
import type { User } from "@shared/schema";

// O emissor renova lastActivity a cada 30 segundos.
// Após 70 segundos sem renovação, o status online é considerado expirado.
const ONLINE_STALE_AFTER_MS = 70_000;
const LOCAL_RECHECK_INTERVAL_MS = 10_000;

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

function calculatePresence(userData: User | null): UserPresenceStatus {
  if (!userData) {
    return {
      isOnline: false,
      statusText: "Offline",
    };
  }

  const lastActivityDate = toValidDate(userData.lastActivity as TimestampLike);
  const declaredOnline = userData.isOnline === true && userData.statusPresenca !== "offline";
  const activityAge = lastActivityDate ? Date.now() - lastActivityDate.getTime() : Number.POSITIVE_INFINITY;
  const activityIsFresh = activityAge >= -30_000 && activityAge <= ONLINE_STALE_AFTER_MS;

  // Nunca confia apenas no booleano isOnline. Uma aba fechada abruptamente pode
  // deixar esse campo preso; lastActivity precisa continuar recente.
  if (declaredOnline && activityIsFresh) {
    return {
      isOnline: true,
      statusText: "Online agora",
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

/**
 * Observa a presença de outro usuário e invalida localmente status online antigo.
 * Assim, mesmo se o navegador fechar antes de gravar isOnline=false, o ponto verde
 * desaparece automaticamente quando o heartbeat lastActivity expira.
 */
export function useUserPresenceStatus(userId: string | null | undefined): UserPresenceStatus {
  const latestUserRef = useRef<User | null>(null);
  const [status, setStatus] = useState<UserPresenceStatus>(() => calculatePresence(null));

  useEffect(() => {
    latestUserRef.current = null;
    setStatus(calculatePresence(null));

    if (!userId) return;

    const refreshLocalStatus = () => {
      setStatus(calculatePresence(latestUserRef.current));
    };

    const unsubscribe = onSnapshot(
      doc(db, "usuarios", userId),
      (snapshot) => {
        latestUserRef.current = snapshot.exists() ? (snapshot.data() as User) : null;
        refreshLocalStatus();
      },
      (error) => {
        console.error("Erro ao observar presença do usuário:", error);
        latestUserRef.current = null;
        refreshLocalStatus();
      },
    );

    // A expiração precisa ser recalculada mesmo quando nenhum novo snapshot chega.
    const recheckInterval = window.setInterval(refreshLocalStatus, LOCAL_RECHECK_INTERVAL_MS);

    return () => {
      unsubscribe();
      window.clearInterval(recheckInterval);
      latestUserRef.current = null;
    };
  }, [userId]);

  return status;
}
