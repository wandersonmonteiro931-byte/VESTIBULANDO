import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { User } from "@shared/schema";

function profileSignature(user: User): string {
  return JSON.stringify({
    uid: user.uid,
    nome: user.nome,
    tipo: user.tipo,
    fotoUrl: user.fotoUrl || "",
    fotoBase64: user.fotoBase64 || "",
    fotoPublica: user.fotoPublica === true,
    sexo: user.sexo || "",
    matricula: user.matricula || "",
    turma: user.turma || "",
    turmas: Array.isArray(user.turmas) ? user.turmas : [],
    ativo: user.ativo,
    status: user.status,
    bloqueado: user.bloqueado,
  });
}

/**
 * Observa os dados de perfil usados pelo chat.
 * Atualizações que mudam apenas presença (heartbeat) não recriam o perfil nem
 * recarregam o avatar, evitando a impressão de que a lista está piscando.
 */
export function useUserData(userId: string | null | undefined) {
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const lastSignatureRef = useRef("");

  useEffect(() => {
    lastSignatureRef.current = "";

    if (!userId) {
      setUserData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const userRef = doc(db, "usuarios", userId);

    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const nextUserData = snapshot.data() as User;
          const nextSignature = profileSignature(nextUserData);

          if (nextSignature !== lastSignatureRef.current) {
            lastSignatureRef.current = nextSignature;
            setUserData(nextUserData);
          }
        } else {
          lastSignatureRef.current = "";
          setUserData(null);
        }

        setLoading(false);
      },
      (snapshotError) => {
        console.error("Erro ao buscar dados do usuário:", snapshotError);
        setError(snapshotError as Error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [userId]);

  return { userData, loading, error };
}
