import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, onSnapshot, collection, query, where } from "firebase/firestore";
import { auth, db, firebaseError } from "@/lib/firebase";
import type { User } from "@shared/schema";
import { useUserPresence } from "@/hooks/useUserPresence";
import { triggerGlobalSuspensionAlert } from "@/contexts/SuspensionAlertContext";

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<boolean>;
  firebaseError: Error | null;
}

// Cache context on globalThis to survive HMR (Hot Module Reload)
// This prevents "useAuth must be used within an AuthProvider" errors during fast refresh
const getAuthContext = () => {
  if (!(globalThis as any).__appAuthContext) {
    (globalThis as any).__appAuthContext = createContext<AuthContextType | undefined>(undefined);
  }
  return (globalThis as any).__appAuthContext;
};

const AuthContext = getAuthContext();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Hook para gerenciar presença do usuário automaticamente
  useUserPresence(currentUser?.uid);

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
        
        // Verificar se usuário está bloqueado ou desativado (exceto diretores)
        if (data.tipo !== "diretor" && (data.bloqueado === true || data.ativo === false)) {
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
          
          // Verificar se usuário foi bloqueado ou desativado (exceto diretores)
          if (data.tipo !== "diretor" && (data.bloqueado === true || data.ativo === false)) {
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

  // Listener em tempo real para suspensões disciplinares (apenas alunos)
  useEffect(() => {
    if (!currentUser || !userData || userData.tipo !== "aluno") return;

    const suspensionsQuery = query(
      collection(db, "disciplinaryActions"),
      where("alunoId", "==", currentUser.uid),
      where("tipo", "==", "suspensao"),
      where("ativo", "==", true)
    );

    const unsubscribe = onSnapshot(
      suspensionsQuery,
      async (snapshot) => {
        if (!snapshot.empty) {
          const activeSuspension = snapshot.docs[0].data();
          const dataTermino = new Date(activeSuspension.dataTerminoSuspensao);
          const dataAplicacao = new Date(activeSuspension.dataAplicacao);
          const agora = new Date();
          
          // Se a suspensão ainda está ativa, mostrar alerta e fazer logout
          if (agora < dataTermino) {
            console.log("🚫 Suspensão ativa detectada enquanto logado - exibindo alerta");
            
            // Calcular duração em dias
            const duracaoDias = Math.ceil((dataTermino.getTime() - dataAplicacao.getTime()) / (1000 * 60 * 60 * 24));
            
            // Mostrar o alerta de suspensão antes de fazer logout
            triggerGlobalSuspensionAlert({
              alunoNome: activeSuspension.alunoNome || userData.nome || "",
              comentario: activeSuspension.comentario,
              dataAplicacao: activeSuspension.dataAplicacao,
              dataTerminoSuspensao: activeSuspension.dataTerminoSuspensao,
              duracaoDias,
              aplicadoPorNome: activeSuspension.aplicadoPorNome || "Diretoria",
            });
            
            // O logout será feito pelo componente SuspensionAlertOverlay quando o usuário clicar em "Entendi"
            // Não fazemos logout aqui para que o usuário possa ver a mensagem antes
          }
        }
      },
      (error) => {
        console.error("Error listening to suspensions:", error);
      }
    );

    return unsubscribe;
  }, [currentUser, userData]);

  const signOut = async () => {
    if (!auth) return;
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
