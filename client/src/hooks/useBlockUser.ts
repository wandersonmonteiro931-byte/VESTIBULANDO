import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, addDoc, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";

interface BlockUserParams {
  blockedUserId: string;
  blockedUserName: string;
}

export function useBlockUser() {
  const { userData } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const blockUser = async (params: BlockUserParams) => {
    if (!userData) {
      throw new Error("User not authenticated");
    }

    setIsLoading(true);
    setError(null);

    try {
      const now = getNowBrasiliaISO();

      const blockData = {
        bloqueadorId: userData.uid,
        bloqueadorNome: userData.nome,
        bloqueadoId: params.blockedUserId,
        bloqueadoNome: params.blockedUserName,
        dataBloqueio: now,
        ativo: true,
      };

      await addDoc(collection(db, "userBlocks"), blockData);

      setIsLoading(false);
      return { success: true };
    } catch (err) {
      console.error("Error blocking user:", err);
      setError(err as Error);
      setIsLoading(false);
      throw err;
    }
  };

  const unblockUser = async (blockedUserId: string) => {
    if (!userData) {
      throw new Error("User not authenticated");
    }

    setIsLoading(true);
    setError(null);

    try {
      const blocksRef = collection(db, "userBlocks");
      const q = query(
        blocksRef,
        where("bloqueadorId", "==", userData.uid),
        where("bloqueadoId", "==", blockedUserId),
        where("ativo", "==", true)
      );

      const snapshot = await getDocs(q);
      
      for (const blockDoc of snapshot.docs) {
        await updateDoc(doc(db, "userBlocks", blockDoc.id), {
          ativo: false,
        });
      }

      setIsLoading(false);
      return { success: true };
    } catch (err) {
      console.error("Error unblocking user:", err);
      setError(err as Error);
      setIsLoading(false);
      throw err;
    }
  };

  return { blockUser, unblockUser, isLoading, error };
}
