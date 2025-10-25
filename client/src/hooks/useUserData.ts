import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User } from '@shared/schema';

/**
 * Hook para buscar dados atualizados de um usuário em tempo real
 * Útil para garantir que mudanças no cadastro (nome, foto, etc.) 
 * sejam refletidas em todo o sistema, incluindo mensagens antigas do chat
 */
export function useUserData(userId: string | null | undefined) {
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setUserData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const userRef = doc(db, 'usuarios', userId);
    
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setUserData(snapshot.data() as User);
        } else {
          setUserData(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao buscar dados do usuário:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { userData, loading, error };
}
