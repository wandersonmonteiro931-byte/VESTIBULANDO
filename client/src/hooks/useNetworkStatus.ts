import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ChatLogger } from "@/lib/chatLogger";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const { userData } = useAuth();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline && userData) {
        ChatLogger.conexaoRestaurada(userData.uid, userData.nome);
        setWasOffline(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      if (userData) {
        ChatLogger.conexaoPerdida(userData.uid, userData.nome);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [userData, wasOffline]);

  return { isOnline, wasOffline };
}

// Função para retry com backoff exponencial
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
