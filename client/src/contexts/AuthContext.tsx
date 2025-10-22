import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db, firebaseError } from "@/lib/firebase";
import { usePresence } from "@/hooks/usePresence";
import type { User } from "@shared/schema";

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<boolean>;
  firebaseError: Error | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Rastrear presença online/offline
  const { setUserOffline } = usePresence(currentUser);

  const fetchUserData = async (uid: string): Promise<boolean> => {
    try {
      const userDocRef = doc(db, "usuarios", uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const data = userDoc.data() as User;
        
        if (data.status === "reprovado" || data.status === "pendente") {
          await firebaseSignOut(auth);
          setUserData(null);
          setCurrentUser(null);
          return false;
        }
        
        // Atualizar o documento se o campo uid estiver faltando
        // Isso é feito de forma silenciosa, ignorando erros de permissão
        if (!data.uid) {
          try {
            const { updateDoc } = await import("firebase/firestore");
            await updateDoc(userDocRef, { uid });
            data.uid = uid;
          } catch (updateError: any) {
            // Ignorar erro de permissão - o campo uid será usado do auth diretamente
            if (updateError.code !== "permission-denied") {
              console.error("Error updating uid field:", updateError);
            }
            // Usar uid do auth se não conseguir atualizar
            data.uid = uid;
          }
        }
        
        setUserData(data);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error fetching user data:", error);
      return false;
    }
  };

  const refreshUserData = async () => {
    if (currentUser) {
      return await fetchUserData(currentUser.uid);
    }
    return false;
  };

  useEffect(() => {
    if (firebaseError) {
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          const isApproved = await fetchUserData(user.uid);
          if (isApproved) {
            setCurrentUser(user);
          } else {
            setCurrentUser(null);
            setUserData(null);
          }
        } else {
          setCurrentUser(null);
          setUserData(null);
        }
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error("Auth state change error:", error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = onSnapshot(
      doc(db, "usuarios", currentUser.uid),
      async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as User;
          setUserData(data);
          
          if (data.status === "reprovado" || data.status === "pendente") {
            await firebaseSignOut(auth);
            setUserData(null);
            setCurrentUser(null);
          }
        }
      },
      (error) => {
        console.error("Error listening to user document:", error);
      }
    );

    return unsubscribe;
  }, [currentUser]);

  const signOut = async () => {
    if (!auth) return;
    // Marcar como offline antes de fazer logout
    if (currentUser) {
      await setUserOffline();
    }
    await firebaseSignOut(auth);
    setUserData(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, userData, loading, signOut, refreshUserData, firebaseError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
