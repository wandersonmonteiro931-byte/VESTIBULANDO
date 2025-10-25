import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User } from "@shared/schema";

interface UserPresenceStatus {
  isOnline: boolean;
  statusText: string;
}

export function useUserPresence(userId: string): UserPresenceStatus {
  const [status, setStatus] = useState<UserPresenceStatus>({
    isOnline: false,
    statusText: "Offline"
  });

  useEffect(() => {
    if (!userId) {
      setStatus({ isOnline: false, statusText: "Offline" });
      return;
    }

    const userRef = doc(db, "usuarios", userId);
    
    const unsubscribe = onSnapshot(
      userRef, 
      (snapshot) => {
        if (!snapshot.exists()) {
          setStatus({ isOnline: false, statusText: "Nunca visto" });
          return;
        }

      const userData = snapshot.data() as User;
      const isOnline = userData.isOnline || false;
      const lastSeen = userData.lastSeen;

      if (isOnline) {
        const lastActivity = userData.lastActivity || userData.lastSeen;
        if (lastActivity) {
          const lastActivityTime = new Date(lastActivity).getTime();
          const now = Date.now();
          const diffMinutes = (now - lastActivityTime) / 1000 / 60;
          
          if (diffMinutes < 5) {
            setStatus({ isOnline: true, statusText: "Online agora" });
            return;
          }
        }
      }

      if (!lastSeen) {
        setStatus({ isOnline: false, statusText: "Nunca visto" });
        return;
      }

      const lastSeenDate = new Date(lastSeen);
      const now = new Date();
      
      const isToday = lastSeenDate.toDateString() === now.toDateString();
      
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = lastSeenDate.toDateString() === yesterday.toDateString();

      const timeStr = lastSeenDate.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      });

      let statusText: string;
      if (isToday) {
        statusText = `Visto por último hoje às ${timeStr}`;
      } else if (isYesterday) {
        statusText = `Visto por último ontem às ${timeStr}`;
      } else {
        const dateStr = lastSeenDate.toLocaleDateString("pt-BR");
        statusText = `Visto por último em ${dateStr} às ${timeStr}`;
      }

      setStatus({ isOnline: false, statusText });
      },
      (error) => {
        setStatus({ isOnline: false, statusText: "Offline" });
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return status;
}
