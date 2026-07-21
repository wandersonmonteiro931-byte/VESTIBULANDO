import { createContext, useContext, useState, useCallback, useEffect, type Context } from "react";

export interface SuspensionAlertData {
  alunoNome: string;
  comentario?: string;
  dataAplicacao: string;
  dataTerminoSuspensao: string;
  duracaoDias: number;
  aplicadoPorNome: string;
}

interface SuspensionAlertContextType {
  showAlert: boolean;
  suspensionData: SuspensionAlertData | null;
  triggerSuspensionAlert: (data: SuspensionAlertData) => void;
  dismissAlert: () => void;
}

const getAlertContext = (): Context<SuspensionAlertContextType | undefined> => {
  if (!(globalThis as any).__suspensionAlertContext) {
    (globalThis as any).__suspensionAlertContext = createContext<SuspensionAlertContextType | undefined>(undefined);
  }
  return (globalThis as any).__suspensionAlertContext as Context<SuspensionAlertContextType | undefined>;
};

const SuspensionAlertContext = getAlertContext();

type SuspensionAlertCallback = (data: SuspensionAlertData) => void;

interface GlobalSuspensionAlertState {
  callback: SuspensionAlertCallback | null;
  pendingData: SuspensionAlertData | null;
}

const globalState: GlobalSuspensionAlertState = {
  callback: null,
  pendingData: null,
};

export function registerSuspensionAlertCallback(callback: SuspensionAlertCallback | null) {
  globalState.callback = callback;
  
  if (callback && globalState.pendingData) {
    console.log("🔔 Processing pending suspension alert");
    callback(globalState.pendingData);
    globalState.pendingData = null;
  }
}

export function triggerGlobalSuspensionAlert(data: SuspensionAlertData) {
  if (globalState.callback) {
    globalState.callback(data);
  } else {
    console.log("⏳ Queueing suspension alert - callback not yet registered");
    globalState.pendingData = data;
  }
}

export function SuspensionAlertProvider({ children }: { children: React.ReactNode }) {
  const [showAlert, setShowAlert] = useState(false);
  const [suspensionData, setSuspensionData] = useState<SuspensionAlertData | null>(null);

  const triggerSuspensionAlert = useCallback((data: SuspensionAlertData) => {
    console.log("🚨 Triggering suspension alert with data:", data);
    setSuspensionData(data);
    setShowAlert(true);
  }, []);

  const dismissAlert = useCallback(() => {
    console.log("🔓 Dismissing suspension alert");
    setShowAlert(false);
    setSuspensionData(null);
  }, []);

  useEffect(() => {
    registerSuspensionAlertCallback(triggerSuspensionAlert);
    return () => {
      registerSuspensionAlertCallback(null);
    };
  }, [triggerSuspensionAlert]);

  return (
    <SuspensionAlertContext.Provider value={{ showAlert, suspensionData, triggerSuspensionAlert, dismissAlert }}>
      {children}
    </SuspensionAlertContext.Provider>
  );
}

export function useSuspensionAlert() {
  const context = useContext(SuspensionAlertContext);
  if (context === undefined) {
    throw new Error("useSuspensionAlert must be used within a SuspensionAlertProvider");
  }
  return context;
}
