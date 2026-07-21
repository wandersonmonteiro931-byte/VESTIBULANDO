import { createContext, useContext, useEffect, useState, type Context } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, User as FirebaseUser } from "firebase/auth";
import { addDoc, doc, getDoc, onSnapshot, collection, query, where, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, firebaseError } from "@/lib/firebase";
import type { User } from "@shared/schema";
import { useUserPresence } from "@/hooks/useUserPresence";
import { triggerGlobalSuspensionAlert } from "@/contexts/SuspensionAlertContext";
import { clearSessionId, getSessionId } from "@/lib/sessionSecurity";

async function markUserOfflineBeforeSignOut(uid: string | null | undefined) {
  if (!uid) return;

  try {
    await updateDoc(doc(db, "usuarios", uid), {
      isOnline: false,
      lastSeen: serverTimestamp(),
      lastActivity: serverTimestamp(),
      statusPresenca: "offline",
    });
  } catch (error) {
    // O hook de presença e a expiração por lastActivity continuam como fallback.
    console.warn("Não foi possível registrar o status offline antes de sair:", error);
  }
}

async function recordManualLogout(account: FirebaseUser, profile: User | null) {
  const payload = {
    device: navigator.platform || "web",
    sessionId: getSessionId(),
    reason: "manual",
  };
  try {
    const token = await account.getIdToken();
    const response = await fetch("/api/v1/session/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("API de sessão indisponível");
  } catch {
    // Fallback para hospedagem estática: mantém data, navegador, dispositivo e
    // sessão; a captura de IP depende do backend autenticado.
    await addDoc(collection(db, "loginHistory"), {
      userId: account.uid,
      userNome: profile?.nome || account.displayName || account.email || account.uid,
      userTipo: profile?.tipo || "funcionario",
      action: "logout",
      timestamp: new Date().toISOString(),
      ipAddress: "indisponível no cliente",
      userAgent: navigator.userAgent.slice(0, 500),
      ...payload,
    }).catch((error) => console.warn("Não foi possível registrar a saída:", error));
  }
}

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
const getAuthContext = (): Context<AuthContextType | undefined> => {
  if (!(globalThis as any).__appAuthContext) {
    (globalThis as any).__appAuthContext = createContext<AuthContextType | undefined>(undefined);
  }
  return (globalThis as any).__appAuthContext as Context<AuthContextType | undefined>;
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
          await markUserOfflineBeforeSignOut(uid);
          await firebaseSignOut(auth);
          setUserData(null);
          setCurrentUser(null);
          return false;
        }
        
        // Verificar se usuário está bloqueado ou desativado (exceto diretores)
        if (data.tipo !== "diretor" && (data.bloqueado === true || data.ativo === false)) {
          await markUserOfflineBeforeSignOut(uid);
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
    // Durante o login, o estado React pode ainda não ter recebido o novo usuário.
    // auth.currentUser já aponta para a conta autenticada e evita reutilizar dados
    // da conta anterior ao alternar entre aluno, professor e diretor.
    const uid = auth?.currentUser?.uid ?? currentUser?.uid;
    if (!uid) return false;
    return await fetchUserData(uid);
  };

  useEffect(() => {
    if (firebaseError) {
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setLoading(true);

        if (user) {
          // Atualiza primeiro a identidade autenticada. Assim, qualquer atualização
          // posterior sempre pertence ao mesmo UID e não à conta anterior.
          setCurrentUser(user);
          const isApproved = await fetchUserData(user.uid);
          if (!isApproved) {
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

          // Encerramento remoto: desconecta tokens emitidos antes da revogação,
          // preservando apenas a sessão que solicitou o encerramento quando aplicável.
          if (data.sessoesRevogadasEm && (data as any).sessaoPreservadaId !== getSessionId()) {
            try {
              const token = await currentUser.getIdTokenResult();
              const issuedAt = new Date(token.issuedAtTime).getTime();
              const revokedAt = new Date(data.sessoesRevogadasEm).getTime();
              if (Number.isFinite(revokedAt) && issuedAt < revokedAt) {
                await markUserOfflineBeforeSignOut(currentUser.uid);
                await firebaseSignOut(auth);
                setUserData(null);
                setCurrentUser(null);
                return;
              }
            } catch (sessionError) {
              console.warn("Não foi possível validar a revogação da sessão:", sessionError);
            }
          }

          if (data.acessoTemporarioAte && Date.now() >= new Date(data.acessoTemporarioAte).getTime()) {
            await markUserOfflineBeforeSignOut(currentUser.uid);
            await firebaseSignOut(auth);
            setUserData(null);
            setCurrentUser(null);
            return;
          }
          
          if (data.status === "reprovado" || data.status === "pendente") {
            await markUserOfflineBeforeSignOut(currentUser.uid);
            await firebaseSignOut(auth);
            setUserData(null);
            setCurrentUser(null);
          }
          
          // Verificar se usuário foi bloqueado ou desativado (exceto diretores)
          if (data.tipo !== "diretor" && (data.bloqueado === true || data.ativo === false)) {
            await markUserOfflineBeforeSignOut(currentUser.uid);
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
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser || !userData?.acessoTemporarioAte) return;
    const expiresAt = new Date(userData.acessoTemporarioAte).getTime();
    const remaining = expiresAt - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timeout = window.setTimeout(async () => {
      await markUserOfflineBeforeSignOut(currentUser.uid);
      await firebaseSignOut(auth);
      setUserData(null);
      setCurrentUser(null);
    }, Math.min(remaining, 2_147_000_000));
    return () => window.clearTimeout(timeout);
  }, [currentUser?.uid, userData?.acessoTemporarioAte]);

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
  }, [currentUser?.uid, userData?.tipo, userData?.nome]);

  const signOut = async () => {
    if (!auth) return;
    const account = auth.currentUser ?? currentUser;
    if (account) await recordManualLogout(account, userData);
    await markUserOfflineBeforeSignOut(account?.uid);
    try {
      await firebaseSignOut(auth);
    } finally {
      clearSessionId();
      setUserData(null);
      setCurrentUser(null);
    }
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
