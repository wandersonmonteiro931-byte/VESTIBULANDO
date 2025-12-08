import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  getDocs,
  orderBy,
} from "firebase/firestore";
import type { 
  SessaoAulaAoVivo, 
  PresencaAulaAoVivo, 
  SolicitacaoSaida,
  User
} from "@shared/schema";

interface LiveClassContextType {
  currentSession: SessaoAulaAoVivo | null;
  studentPresence: PresencaAulaAoVivo | null;
  isInClass: boolean;
  isLoading: boolean;
  pendingLeaveRequests: SolicitacaoSaida[];
  enterClass: (sessionId: string) => Promise<void>;
  exitClass: (reason?: string) => Promise<void>;
  updateActivity: () => Promise<void>;
  requestLeave: (reason?: string) => Promise<string>;
  markAsAbsent: (reason: "ausencia_prolongada" | "inatividade" | "saida_nao_autorizada") => Promise<void>;
  respondToLeaveRequest: (requestId: string, approved: boolean, comment?: string) => Promise<void>;
}

const LiveClassContext = createContext<LiveClassContextType | null>(null);

export function LiveClassProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const userData: User | null = (auth && typeof auth === 'object' && auth !== null && 'userData' in auth) 
    ? (auth.userData as User | null) 
    : null;
  const [currentSession, setCurrentSession] = useState<SessaoAulaAoVivo | null>(null);
  const [studentPresence, setStudentPresence] = useState<PresencaAulaAoVivo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState<SolicitacaoSaida[]>([]);

  const formatBrasiliaTime = () => {
    return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  };

  useEffect(() => {
    if (!userData || userData.tipo !== "aluno" || !userData.turma) return;

    let unsubscribe: (() => void) | null = null;
    let isMounted = true;

    const setupListener = () => {
      try {
        const sessionsRef = collection(db, "sessoesAulaAoVivo");
        const q = query(
          sessionsRef,
          where("turmaId", "==", userData.turma),
          where("status", "==", "em_andamento")
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
          if (!isMounted) return;
          if (!snapshot.empty) {
            const sessionData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as SessaoAulaAoVivo;
            setCurrentSession(sessionData);
          } else {
            setCurrentSession(null);
            setStudentPresence(null);
          }
        }, (error: any) => {
          // Bug do Firebase SDK 12.4.0 - suprimir apenas este erro específico
          if (error?.message?.includes('INTERNAL ASSERTION FAILED')) {
            console.warn("[LiveClassContext] Firebase SDK bug detectado - recarregue a página se persistir");
            return;
          }
          console.error("[LiveClassContext] Erro ao escutar sessões:", error);
        });
      } catch (error: any) {
        if (!error?.message?.includes('INTERNAL ASSERTION FAILED')) {
          console.error("[LiveClassContext] Falha ao configurar listener de sessões:", error);
        }
      }
    };

    setupListener();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [userData]);

  useEffect(() => {
    if (!userData || userData.tipo !== "professor") return;

    let unsubscribe: (() => void) | null = null;
    let isMounted = true;

    const setupListener = async () => {
      try {
        const requestsRef = collection(db, "solicitacoesSaida");
        const q = query(
          requestsRef,
          where("professorId", "==", userData.uid),
          where("status", "==", "pendente")
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
          if (!isMounted) return;
          const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as SolicitacaoSaida[];
          const sortedRequests = requests.sort((a, b) => {
            const dateA = a.dataSolicitacao ? new Date(a.dataSolicitacao).getTime() : 0;
            const dateB = b.dataSolicitacao ? new Date(b.dataSolicitacao).getTime() : 0;
            return dateB - dateA;
          });
          setPendingLeaveRequests(sortedRequests);
        }, (error: any) => {
          // Bug do Firebase SDK 12.4.0 - suprimir apenas este erro específico
          if (error?.message?.includes('INTERNAL ASSERTION FAILED')) {
            console.warn("[LiveClassContext] Firebase SDK bug detectado - recarregue a página se persistir");
            return;
          }
          console.error("[LiveClassContext] Erro ao escutar solicitações de saída:", error);
        });
      } catch (error: any) {
        if (!error?.message?.includes('INTERNAL ASSERTION FAILED')) {
          console.error("[LiveClassContext] Falha ao configurar listener de solicitações:", error);
        }
      }
    };

    setupListener();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [userData]);

  useEffect(() => {
    if (!currentSession || !userData) return;

    let unsubscribe: (() => void) | null = null;
    let isMounted = true;

    const setupListener = () => {
      try {
        const presenceRef = collection(db, "presencasAulaAoVivo");
        const q = query(
          presenceRef,
          where("sessaoId", "==", currentSession.id),
          where("alunoId", "==", userData.uid)
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
          if (!isMounted) return;
          if (!snapshot.empty) {
            const presenceData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as PresencaAulaAoVivo;
            setStudentPresence(presenceData);
          }
        }, (error: any) => {
          // Bug do Firebase SDK 12.4.0 - suprimir apenas este erro específico
          if (error?.message?.includes('INTERNAL ASSERTION FAILED')) {
            console.warn("[LiveClassContext] Firebase SDK bug detectado - recarregue a página se persistir");
            return;
          }
          console.error("[LiveClassContext] Erro ao escutar presença:", error);
        });
      } catch (error: any) {
        if (!error?.message?.includes('INTERNAL ASSERTION FAILED')) {
          console.error("[LiveClassContext] Falha ao configurar listener de presença:", error);
        }
      }
    };

    setupListener();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [currentSession, userData]);

  const enterClass = useCallback(async (sessionId: string) => {
    if (!userData) return;
    setIsLoading(true);

    try {
      const presenceRef = collection(db, "presencasAulaAoVivo");
      const existingQuery = query(
        presenceRef,
        where("sessaoId", "==", sessionId),
        where("alunoId", "==", userData.uid)
      );
      const existingDocs = await getDocs(existingQuery);

      if (!existingDocs.empty) {
        const docRef = doc(db, "presencasAulaAoVivo", existingDocs.docs[0].id);
        await updateDoc(docRef, {
          status: "na_sala",
          dataEntrada: formatBrasiliaTime(),
          ultimaAtividade: formatBrasiliaTime(),
          dataAtualizacao: formatBrasiliaTime(),
        });
      } else {
        await addDoc(presenceRef, {
          sessaoId: sessionId,
          turmaId: userData.turma,
          alunoId: userData.uid,
          alunoNome: userData.nome,
          alunoMatricula: userData.matricula || "",
          status: "na_sala",
          dataEntrada: formatBrasiliaTime(),
          ultimaAtividade: formatBrasiliaTime(),
          tempoTotalAusente: 0,
          historicoAusencias: [],
          confirmacoesSolicitadas: 0,
          confirmacoesRespondidas: 0,
          presencaValidada: false,
          dataCriacao: formatBrasiliaTime(),
        });
      }
    } catch (error) {
      console.error("Error entering class:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [userData]);

  const exitClass = useCallback(async (reason?: string) => {
    if (!studentPresence) return;

    try {
      const docRef = doc(db, "presencasAulaAoVivo", studentPresence.id);
      await updateDoc(docRef, {
        status: "liberado",
        dataSaida: formatBrasiliaTime(),
        dataAtualizacao: formatBrasiliaTime(),
        presencaValidada: true,
      });
      setStudentPresence(null);
    } catch (error) {
      console.error("Error exiting class:", error);
      throw error;
    }
  }, [studentPresence]);

  const updateActivity = useCallback(async () => {
    if (!studentPresence) return;

    try {
      const docRef = doc(db, "presencasAulaAoVivo", studentPresence.id);
      await updateDoc(docRef, {
        ultimaAtividade: formatBrasiliaTime(),
        dataAtualizacao: formatBrasiliaTime(),
      });
    } catch (error) {
      console.error("Error updating activity:", error);
    }
  }, [studentPresence]);

  const requestLeave = useCallback(async (reason?: string): Promise<string> => {
    if (!studentPresence || !currentSession || !userData) {
      throw new Error("Não é possível solicitar saída");
    }

    try {
      // Usar backend para contornar bug do Firebase SDK 12.4.0
      const response = await fetch('/api/leave-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessaoId: currentSession.id,
          presencaId: studentPresence.id,
          alunoId: userData.uid,
          alunoNome: userData.nome,
          alunoMatricula: userData.matricula || "",
          turmaId: currentSession.turmaId,
          turmaNome: currentSession.turmaNome,
          materia: currentSession.materia,
          professorId: currentSession.professorId,
          professorNome: currentSession.professorNome,
          motivoAluno: reason || "",
        }),
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Erro ao enviar solicitação");
      }
      
      return data.requestId;
    } catch (error: any) {
      console.error("Error requesting leave:", error);
      throw new Error(error?.message || "Erro ao enviar solicitação. Tente novamente.");
    }
  }, [studentPresence, currentSession, userData]);

  const markAsAbsent = useCallback(async (reason: "ausencia_prolongada" | "inatividade" | "saida_nao_autorizada") => {
    if (!studentPresence) return;

    try {
      const docRef = doc(db, "presencasAulaAoVivo", studentPresence.id);
      await updateDoc(docRef, {
        status: "removido",
        motivoRemocao: reason,
        dataSaida: formatBrasiliaTime(),
        presencaValidada: false,
        dataAtualizacao: formatBrasiliaTime(),
      });
    } catch (error) {
      console.error("Error marking as absent:", error);
      throw error;
    }
  }, [studentPresence]);

  const respondToLeaveRequest = useCallback(async (requestId: string, approved: boolean, comment?: string) => {
    if (!userData) return;

    try {
      const requestRef = doc(db, "solicitacoesSaida", requestId);
      const requestSnap = await getDocs(query(collection(db, "solicitacoesSaida"), where("__name__", "==", requestId)));
      
      if (requestSnap.empty) return;
      
      const requestData = requestSnap.docs[0].data() as SolicitacaoSaida;

      await updateDoc(requestRef, {
        status: approved ? "aprovada" : "recusada",
        respondidoPor: userData.uid,
        respondidoPorNome: userData.nome,
        dataResposta: formatBrasiliaTime(),
        comentarioResposta: comment || "",
      });

      if (approved) {
        const presenceRef = doc(db, "presencasAulaAoVivo", requestData.presencaId);
        await updateDoc(presenceRef, {
          status: "liberado",
          liberadoPor: userData.uid,
          liberadoPorNome: userData.nome,
          dataLiberacao: formatBrasiliaTime(),
          presencaValidada: true,
          dataAtualizacao: formatBrasiliaTime(),
        });
      }
    } catch (error) {
      console.error("Error responding to leave request:", error);
      throw error;
    }
  }, [userData]);

  const value: LiveClassContextType = {
    currentSession,
    studentPresence,
    isInClass: !!studentPresence && studentPresence.status === "na_sala",
    isLoading,
    pendingLeaveRequests,
    enterClass,
    exitClass,
    updateActivity,
    requestLeave,
    markAsAbsent,
    respondToLeaveRequest,
  };

  return (
    <LiveClassContext.Provider value={value}>
      {children}
    </LiveClassContext.Provider>
  );
}

export function useLiveClass() {
  const context = useContext(LiveClassContext);
  if (!context) {
    throw new Error("useLiveClass must be used within a LiveClassProvider");
  }
  return context;
}
