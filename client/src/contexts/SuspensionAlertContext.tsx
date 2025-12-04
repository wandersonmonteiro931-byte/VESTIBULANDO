import { createContext, useContext, useState, useCallback } from "react";

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

const getAlertContext = () => {
  if (!(globalThis as any).__suspensionAlertContext) {
    (globalThis as any).__suspensionAlertContext = createContext<SuspensionAlertContextType | undefined>(undefined);
  }
  return (globalThis as any).__suspensionAlertContext;
};

const SuspensionAlertContext = getAlertContext();

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
