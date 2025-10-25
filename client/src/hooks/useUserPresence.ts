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
    
    const calculateStatus = (userData: any) => {
      const lastActivity = userData.lastActivity || userData.lastSeen;
      
      // Verificar se o usuário está realmente online baseado na última atividade
      if (lastActivity) {
        const lastActivityTime = new Date(lastActivity).getTime();
        const now = Date.now();
        const diffMinutes = (now - lastActivityTime) / 1000 / 60;
        
        // Considera online se a última atividade foi há menos de 2 minutos
        if (diffMinutes < 2) {
          return { isOnline: true, statusText: "Online agora" };
        }
      }
      
      const lastSeen = userData.lastSeen;

      if (!lastSeen) {
        return { isOnline: false, statusText: "Nunca visto" };
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

      return { isOnline: false, statusText };
    };
    
    let latestUserData: any = null;
    
    const unsubscribe = onSnapshot(
      userRef, 
      (snapshot) => {
        if (!snapshot.exists()) {
          setStatus({ isOnline: false, statusText: "Nunca visto" });
          return;
        }

        latestUserData = snapshot.data() as User;
        const newStatus = calculateStatus(latestUserData);
        setStatus(newStatus);
      },
      (error) => {
        setStatus({ isOnline: false, statusText: "Offline" });
      }
    );

    // Recalcular status a cada 30 segundos para detectar quando usuário fica offline
    const interval = setInterval(() => {
      if (latestUserData) {
        const newStatus = calculateStatus(latestUserData);
        setStatus(newStatus);
      }
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [userId]);

  return status;
}
