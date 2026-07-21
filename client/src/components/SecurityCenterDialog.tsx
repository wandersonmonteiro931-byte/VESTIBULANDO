import { useEffect, useMemo, useState } from "react";
import { multiFactor, sendEmailVerification, TotpMultiFactorGenerator, type TotpSecret } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import QRCode from "qrcode";
import { CheckCircle2, Copy, KeyRound, Loader2, LogOut, MailCheck, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { getSessionId } from "@/lib/sessionSecurity";

interface SecurityCenterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SecurityCenterDialog({ open, onOpenChange }: SecurityCenterDialogProps) {
  const { currentUser, userData, refreshUserData } = useAuth();
  const { toast } = useToast();
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [code, setCode] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const factors = useMemo(() => currentUser ? multiFactor(currentUser).enrolledFactors : [], [currentUser, open, userData?.mfaAtivado]);
  const totpFactor = factors.find((factor) => factor.factorId === TotpMultiFactorGenerator.FACTOR_ID);

  useEffect(() => {
    if (!open) {
      setSecret(null);
      setQrDataUrl("");
      setCode("");
      setError("");
    }
  }, [open]);

  const startEnrollment = async () => {
    if (!currentUser) return;
    if (!currentUser.emailVerified) {
      setError("Confirme seu e-mail antes de ativar a autenticação em duas etapas.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      const session = await multiFactor(currentUser).getSession();
      const generatedSecret = await TotpMultiFactorGenerator.generateSecret(session);
      const url = generatedSecret.generateQrCodeUrl(currentUser.email || userData?.nome || "Vestibulando", "Vestibulando");
      setSecret(generatedSecret);
      setQrDataUrl(await QRCode.toDataURL(url, { width: 240, margin: 2, errorCorrectionLevel: "M" }));
    } catch (authError: any) {
      setError(authError.code === "auth/operation-not-allowed" ? "O TOTP precisa ser ativado no Firebase Authentication/Identity Platform deste projeto." : authError.message);
    } finally {
      setWorking(false);
    }
  };

  const confirmEnrollment = async () => {
    if (!currentUser || !secret || !/^\d{6}$/.test(code)) {
      setError("Informe o código de 6 dígitos gerado pelo aplicativo autenticador.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code);
      await multiFactor(currentUser).enroll(assertion, "Aplicativo autenticador");
      await updateDoc(doc(db, "usuarios", currentUser.uid), { mfaAtivado: true, mfaAtivadoEm: new Date().toISOString() });
      await refreshUserData();
      setSecret(null);
      setQrDataUrl("");
      setCode("");
      toast({ title: "MFA ativado", description: "Os próximos acessos exigirão o código do aplicativo autenticador." });
    } catch (authError: any) {
      setError(authError.code === "auth/invalid-verification-code" ? "Código inválido. Aguarde o próximo código e tente novamente." : authError.message);
    } finally {
      setWorking(false);
    }
  };

  const disableMfa = async () => {
    if (!currentUser || !totpFactor) return;
    setWorking(true);
    try {
      await multiFactor(currentUser).unenroll(totpFactor);
      await updateDoc(doc(db, "usuarios", currentUser.uid), { mfaAtivado: false, mfaDesativadoEm: new Date().toISOString() });
      await refreshUserData();
      toast({ title: "MFA desativado", description: "A conta não exigirá mais o código TOTP." });
    } catch (authError: any) {
      setError(authError.code === "auth/requires-recent-login" ? "Entre novamente na conta antes de desativar o MFA." : authError.message);
    } finally {
      setWorking(false);
    }
  };

  const verifyEmail = async () => {
    if (!currentUser) return;
    setWorking(true);
    try {
      await sendEmailVerification(currentUser);
      toast({ title: "E-mail enviado", description: "Abra sua caixa de entrada e confirme o endereço." });
    } catch (authError: any) {
      setError(authError.message);
    } finally { setWorking(false); }
  };

  const closeOtherSessions = async () => {
    if (!currentUser) return;
    setWorking(true);
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, "usuarios", currentUser.uid), { sessoesRevogadasEm: now, sessaoPreservadaId: getSessionId() });
      await currentUser.getIdToken(true);
      toast({ title: "Outras sessões encerradas", description: "Dispositivos e abas diferentes serão desconectados em tempo real." });
    } catch (authError: any) {
      setError(authError.message);
    } finally { setWorking(false); }
  };

  const copySecret = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret.secretKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Central de segurança</DialogTitle><DialogDescription>Proteja a conta com TOTP e gerencie sessões abertas.</DialogDescription></DialogHeader>
        <div className="security-center-card">
          <div className="security-center-heading"><Smartphone className="h-6 w-6" /><div><h3>Autenticação em duas etapas</h3><p>Códigos temporários compatíveis com Google Authenticator, Microsoft Authenticator, 1Password e similares.</p></div><Badge variant={totpFactor ? "default" : "secondary"}>{totpFactor ? "Ativada" : userData?.mfaObrigatorio ? "Obrigatória" : "Opcional"}</Badge></div>
          {!currentUser?.emailVerified && <div className="security-email-warning"><MailCheck className="h-5 w-5" /><div><strong>E-mail ainda não confirmado</strong><p>A confirmação é necessária para ativar o MFA.</p></div><Button variant="outline" onClick={verifyEmail} disabled={working}>Enviar confirmação</Button></div>}
          {!totpFactor && !secret && <Button onClick={startEnrollment} disabled={working || !currentUser?.emailVerified}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Configurar aplicativo autenticador</Button>}
          {!totpFactor && secret && <div className="security-enrollment"><div className="security-qr">{qrDataUrl && <img src={qrDataUrl} alt="QR Code para configurar o aplicativo autenticador" />}</div><div className="security-secret"><h4>1. Leia o QR Code</h4><p>Se preferir, copie a chave manual:</p><div><code>{secret.secretKey}</code><Button size="icon" variant="outline" onClick={copySecret} aria-label="Copiar chave">{copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button></div><h4>2. Confirme o código</h4><Label htmlFor="security-totp">Código de 6 dígitos</Label><Input id="security-totp" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} placeholder="000000" /><Button onClick={confirmEnrollment} disabled={working || code.length !== 6}>{working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ativar MFA</Button></div></div>}
          {totpFactor && <Button variant="outline" onClick={disableMfa} disabled={working || Boolean(userData?.mfaObrigatorio)}><ShieldOff className="mr-2 h-4 w-4" />Desativar MFA</Button>}
          {userData?.mfaObrigatorio && totpFactor && <p className="security-policy-note">A política do seu perfil exige MFA; somente a direção pode remover essa exigência.</p>}
        </div>
        <div className="security-center-card"><div className="security-center-heading"><LogOut className="h-6 w-6" /><div><h3>Sessões e dispositivos</h3><p>Encerre acessos em outros navegadores sem desconectar esta sessão.</p></div></div><Button variant="outline" onClick={closeOtherSessions} disabled={working}><LogOut className="mr-2 h-4 w-4" />Encerrar outras sessões</Button></div>
        {error && <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
