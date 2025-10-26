import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function usePresence() {
  const { userData } = useAuth();
  const intervalsRef = useRef<{
    update: NodeJS.Timeout | null;
    heartbeat: NodeJS.Timeout | null;
    offlineCheck: NodeJS.Timeout | null;
    offlineTimeout: NodeJS.Timeout | null;
  }>({ update: null, heartbeat: null, offlineCheck: null, offlineTimeout: null });
  const stateRef = useRef<{
    lastActivity: number;
    isOnline: boolean;
    offlineAttempts: number;
    pageVisible: boolean;
  }>({ lastActivity: Date.now(), isOnline: true, offlineAttempts: 0, pageVisible: true });

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
        stateRef.current.offlineAttempts = 0;
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
        stateRef.current.offlineAttempts = 0;
      } catch (error) {
        console.error("Error setting user offline:", error);
      }
    };

    // Versão agressiva de marcar offline - tenta múltiplas vezes com garantia de 3 segundos máximo
    const setOfflineImmediate = async () => {
      const now = new Date().toISOString();
      stateRef.current.isOnline = false;
      stateRef.current.pageVisible = false;
      
      // Limpar qualquer timeout pendente de offline
      if (intervalsRef.current.offlineTimeout) {
        clearTimeout(intervalsRef.current.offlineTimeout);
      }
      
      // Primeira tentativa imediata
      try {
        await updateDoc(userRef, {
          isOnline: false,
          lastSeen: now,
          lastActivity: now,
          statusPresenca: "offline"
        });
        stateRef.current.offlineAttempts = 0;
        console.log("✅ Marcado offline imediatamente");
        return;
      } catch (error) {
        console.warn("⚠️ Tentativa 1 de marcar offline falhou:", error);
      }

      // Tentar novamente após 500ms
      setTimeout(async () => {
        if (stateRef.current.pageVisible) return; // Página voltou a estar visível
        try {
          await updateDoc(userRef, {
            isOnline: false,
            lastSeen: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            statusPresenca: "offline"
          });
          stateRef.current.offlineAttempts = 0;
          console.log("✅ Marcado offline na tentativa 2 (500ms)");
        } catch (error) {
          console.warn("⚠️ Tentativa 2 de marcar offline falhou:", error);
        }
      }, 500);

      // Tentar novamente após 1.5 segundos
      setTimeout(async () => {
        if (stateRef.current.pageVisible) return; // Página voltou a estar visível
        try {
          await updateDoc(userRef, {
            isOnline: false,
            lastSeen: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            statusPresenca: "offline"
          });
          stateRef.current.offlineAttempts = 0;
          console.log("✅ Marcado offline na tentativa 3 (1.5s)");
        } catch (error) {
          console.warn("⚠️ Tentativa 3 de marcar offline falhou:", error);
        }
      }, 1500);

      // Última tentativa garantida após 3 segundos (tolerância máxima)
      intervalsRef.current.offlineTimeout = setTimeout(async () => {
        if (stateRef.current.pageVisible) return; // Página voltou a estar visível
        try {
          await updateDoc(userRef, {
            isOnline: false,
            lastSeen: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            statusPresenca: "offline"
          });
          stateRef.current.offlineAttempts = 0;
          console.log("✅ Marcado offline na tentativa final (3s - tolerância máxima)");
        } catch (error) {
          console.error("❌ ERRO CRÍTICO: Falha ao marcar offline após 3 segundos:", error);
        }
      }, 3000);
    };

    const setOfflineSync = () => {
      setOfflineImmediate();
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
        console.log("📱 Página ficou oculta - marcando offline imediatamente");
        stateRef.current.pageVisible = false;
        setOfflineSync();
      } else {
        console.log("📱 Página voltou a ficar visível - marcando online");
        stateRef.current.pageVisible = true;
        stateRef.current.lastActivity = Date.now();
        // Limpar timeout de offline se existir
        if (intervalsRef.current.offlineTimeout) {
          clearTimeout(intervalsRef.current.offlineTimeout);
          intervalsRef.current.offlineTimeout = null;
        }
        setOnline();
      }
    };

    const handleBlur = () => {
      console.log("🔄 Janela perdeu foco - marcando offline");
      stateRef.current.pageVisible = false;
      setOfflineSync();
    };

    const handleFocus = () => {
      console.log("🔄 Janela ganhou foco - marcando online");
      stateRef.current.pageVisible = true;
      stateRef.current.lastActivity = Date.now();
      // Limpar timeout de offline se existir
      if (intervalsRef.current.offlineTimeout) {
        clearTimeout(intervalsRef.current.offlineTimeout);
        intervalsRef.current.offlineTimeout = null;
      }
      if (!stateRef.current.isOnline) {
        setOnline();
      }
    };

    const handleActivity = () => {
      stateRef.current.lastActivity = Date.now();
      if (!stateRef.current.isOnline && !document.hidden) {
        setOnline();
      }
    };

    // Heartbeat verificando a cada 1 segundo para detecção rápida
    const checkHeartbeat = () => {
      if (document.hidden && stateRef.current.isOnline) {
        setOfflineSync();
      } else if (!document.hidden && !stateRef.current.isOnline) {
        setOnline();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("scroll", handleActivity, { passive: true });
    window.addEventListener("touchstart", handleActivity, { passive: true });
    window.addEventListener("touchmove", handleActivity, { passive: true });
    window.addEventListener("touchend", handleActivity, { passive: true });

    // Atualizar atividade a cada 10 segundos quando visível
    intervalsRef.current.update = setInterval(() => {
      if (!document.hidden) {
        updateActivity();
      }
    }, 10000);

    // Heartbeat a cada 1 segundo para detecção rápida de mudança de estado
    intervalsRef.current.heartbeat = setInterval(checkHeartbeat, 1000);

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
      if (intervalsRef.current.offlineCheck) {
        clearInterval(intervalsRef.current.offlineCheck);
      }
      if (intervalsRef.current.offlineTimeout) {
        clearTimeout(intervalsRef.current.offlineTimeout);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
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
