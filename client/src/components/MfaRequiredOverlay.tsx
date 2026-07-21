import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { SecurityCenterDialog } from "./SecurityCenterDialog";

export function MfaRequiredOverlay() {
  const { userData } = useAuth();
  const [open, setOpen] = useState(false);
  if (!userData?.mfaObrigatorio || userData.mfaAtivado) return null;
  return (
    <div className="mfa-required-overlay" role="alertdialog" aria-modal="true" aria-labelledby="mfa-required-title">
      <div className="mfa-required-card"><div><ShieldCheck className="h-9 w-9" /></div><h2 id="mfa-required-title">Proteção obrigatória da conta</h2><p>A política do seu perfil exige autenticação em duas etapas. Configure um aplicativo autenticador antes de continuar.</p><Button onClick={() => setOpen(true)}><ShieldCheck className="mr-2 h-4 w-4" />Configurar MFA agora</Button></div>
      <SecurityCenterDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
