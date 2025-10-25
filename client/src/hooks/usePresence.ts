import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function usePresence() {
  const { userData } = useAuth();
  const intervalsRef = useRef<{
    update: NodeJS.Timeout | null;
    heartbeat: NodeJS.Timeout | null;
  }>({ update: null, heartbeat: null });
  const stateRef = useRef<{
    lastActivity: number;
    isOnline: boolean;
  }>({ lastActivity: Date.now(), isOnline: true });

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
        stateRef.current.isOnline = true;
      } catch (error) {
        console.error("Error setting user online:", error);
      }
    };

    const setOffline = async () => {
      if (!stateRef.current.isOnline) return;
      
      try {
        const now = new Date().toISOString();
        await updateDoc(userRef, {
          isOnline: false,
          lastSeen: now,
          lastActivity: now,
          statusPresenca: "offline"
        });
        stateRef.current.isOnline = false;
      } catch (error) {
        console.error("Error setting user offline:", error);
      }
    };

    const setOfflineSync = () => {
      try {
        const now = new Date().toISOString();
        updateDoc(userRef, {
          isOnline: false,
          lastSeen: now,
          lastActivity: now,
          statusPresenca: "offline"
        }).catch(() => {});
        stateRef.current.isOnline = false;
      } catch (error) {
        console.error("Error setting user offline synchronously:", error);
      }
    };

    const updateActivity = async () => {
      stateRef.current.lastActivity = Date.now();
      
      if (!stateRef.current.isOnline) {
        await setOnline();
      }

      try {
        const timestamp = new Date().toISOString();
        await updateDoc(userRef, {
          isOnline: true,
          lastActivity: timestamp,
          lastSeen: timestamp
        });
      } catch (error) {
        console.error("Error updating activity:", error);
      }
    };

    setOnline();
    stateRef.current.lastActivity = Date.now();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setOfflineSync();
      } else {
        stateRef.current.lastActivity = Date.now();
        setOnline();
      }
    };

    const handleActivity = () => {
      stateRef.current.lastActivity = Date.now();
      if (!stateRef.current.isOnline) {
        setOnline();
      }
    };

    const checkHeartbeat = () => {
      if (document.hidden && stateRef.current.isOnline) {
        setOfflineSync();
      } else if (!document.hidden && !stateRef.current.isOnline) {
        setOnline();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleActivity);
    window.addEventListener("blur", setOfflineSync);
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("scroll", handleActivity, { passive: true });
    window.addEventListener("touchstart", handleActivity, { passive: true });
    window.addEventListener("touchmove", handleActivity, { passive: true });
    window.addEventListener("touchend", handleActivity, { passive: true });

    intervalsRef.current.update = setInterval(() => {
      if (!document.hidden) {
        updateActivity();
      }
    }, 10000);

    intervalsRef.current.heartbeat = setInterval(checkHeartbeat, 3000);

    window.addEventListener("beforeunload", setOfflineSync);
    window.addEventListener("pagehide", setOfflineSync);
    window.addEventListener("unload", setOfflineSync);

    return () => {
      if (intervalsRef.current.update) {
        clearInterval(intervalsRef.current.update);
      }
      if (intervalsRef.current.heartbeat) {
        clearInterval(intervalsRef.current.heartbeat);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleActivity);
      window.removeEventListener("blur", setOfflineSync);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      window.removeEventListener("touchmove", handleActivity);
      window.removeEventListener("touchend", handleActivity);
      window.removeEventListener("beforeunload", setOfflineSync);
      window.removeEventListener("pagehide", setOfflineSync);
      window.removeEventListener("unload", setOfflineSync);
      setOffline();
    };
  }, [userData?.uid]);
}
