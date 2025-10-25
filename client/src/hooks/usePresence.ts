import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function usePresence() {
  const { userData } = useAuth();
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!userData?.uid) return;

    const userRef = doc(db, "usuarios", userData.uid);

    const setOnline = async () => {
      try {
        const now = new Date().toISOString();
        await updateDoc(userRef, {
          isOnline: true,
          lastSeen: now,
          lastActivity: now,
          statusPresenca: "online"
        });
        lastUpdateRef.current = Date.now();
      } catch (error) {
        console.error("Error setting user online:", error);
      }
    };

    const setOffline = async () => {
      try {
        const now = new Date().toISOString();
        await updateDoc(userRef, {
          isOnline: false,
          lastSeen: now,
          lastActivity: now,
          statusPresenca: "offline"
        });
      } catch (error) {
        console.error("Error setting user offline:", error);
      }
    };

    const updateActivity = async () => {
      const now = Date.now();
      if (now - lastUpdateRef.current < 30000) {
        return;
      }

      try {
        const timestamp = new Date().toISOString();
        await updateDoc(userRef, {
          isOnline: true,
          lastActivity: timestamp,
          lastSeen: timestamp
        });
        lastUpdateRef.current = now;
      } catch (error) {
        console.error("Error updating activity:", error);
      }
    };

    setOnline();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setOffline();
      } else {
        setOnline();
      }
    };

    const handleActivity = () => {
      updateActivity();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("scroll", handleActivity);

    updateIntervalRef.current = setInterval(() => {
      if (!document.hidden) {
        updateActivity();
      }
    }, 60000);

    window.addEventListener("beforeunload", setOffline);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      window.removeEventListener("beforeunload", setOffline);
      setOffline();
    };
  }, [userData?.uid]);
}
