import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function checkIsBlocked(userId1: string, userId2: string): Promise<boolean> {
  try {
    const blocksRef = collection(db, "userBlocks");
    
    const q1 = query(
      blocksRef,
      where("bloqueadorId", "==", userId1),
      where("bloqueadoId", "==", userId2),
      where("ativo", "==", true)
    );
    
    const q2 = query(
      blocksRef,
      where("bloqueadorId", "==", userId2),
      where("bloqueadoId", "==", userId1),
      where("ativo", "==", true)
    );

    const [snapshot1, snapshot2] = await Promise.all([
      getDocs(q1),
      getDocs(q2)
    ]);

    return !snapshot1.empty || !snapshot2.empty;
  } catch (error) {
    console.error("Error checking block status:", error);
    return false;
  }
}
