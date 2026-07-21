import { createContext, useContext, useState, useCallback, useEffect, type Context } from "react";

export interface WarningAlertData {
  id: string;
  alunoNome: string;
  comentario?: string;
  dataAplicacao: string;
  aplicadoPorNome: string;
  warningsCount: number;
}

interface WarningAlertContextType {
  showAlert: boolean;
  warningData: WarningAlertData | null;
  triggerWarningAlert: (data: WarningAlertData) => void;
  dismissAlert: () => void;
}

const getAlertContext = (): Context<WarningAlertContextType | undefined> => {
  if (!(globalThis as any).__warningAlertContext) {
    (globalThis as any).__warningAlertContext = createContext<WarningAlertContextType | undefined>(undefined);
  }
  return (globalThis as any).__warningAlertContext as Context<WarningAlertContextType | undefined>;
};

const WarningAlertContext = getAlertContext();

type WarningAlertCallback = (data: WarningAlertData) => void;

interface GlobalWarningAlertState {
  callback: WarningAlertCallback | null;
  pendingData: WarningAlertData | null;
}

const globalState: GlobalWarningAlertState = {
  callback: null,
  pendingData: null,
};

export function registerWarningAlertCallback(callback: WarningAlertCallback | null) {
  globalState.callback = callback;
  
  if (callback && globalState.pendingData) {
    console.log("🔔 Processing pending warning alert");
    callback(globalState.pendingData);
    globalState.pendingData = null;
  }
}

export function triggerGlobalWarningAlert(data: WarningAlertData) {
  if (globalState.callback) {
    globalState.callback(data);
  } else {
    console.log("⏳ Queueing warning alert - callback not yet registered");
    globalState.pendingData = data;
  }
}

export function WarningAlertProvider({ children }: { children: React.ReactNode }) {
  const [showAlert, setShowAlert] = useState(false);
  const [warningData, setWarningData] = useState<WarningAlertData | null>(null);

  const triggerWarningAlert = useCallback((data: WarningAlertData) => {
    console.log("🚨 Triggering warning alert with data:", data);
    setWarningData(data);
    setShowAlert(true);
  }, []);

  const dismissAlert = useCallback(() => {
    console.log("🔓 Dismissing warning alert");
    setShowAlert(false);
    setWarningData(null);
  }, []);

  useEffect(() => {
    registerWarningAlertCallback(triggerWarningAlert);
    return () => {
      registerWarningAlertCallback(null);
    };
  }, [triggerWarningAlert]);

  return (
    <WarningAlertContext.Provider value={{ showAlert, warningData, triggerWarningAlert, dismissAlert }}>
      {children}
    </WarningAlertContext.Provider>
  );
}

export function useWarningAlert() {
  const context = useContext(WarningAlertContext);
  if (context === undefined) {
    throw new Error("useWarningAlert must be used within a WarningAlertProvider");
  }
  return context;
}
