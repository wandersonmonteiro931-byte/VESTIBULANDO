import { useEffect, useRef, useState } from "react";
import { Activity, CheckCircle2, Download, ExternalLink, FileSpreadsheet, Loader2, PlugZap, RefreshCw, Send, ShieldCheck, Upload, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";
import type { SchoolModuleDefinition } from "./schoolCatalog";
import { downloadFile, exportEducacensoCsv, importSchoolCsv, registerAuditEvent, schoolCsvTemplate, type SchoolActor, type SchoolRecord } from "./schoolData";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

interface IntegrationConnector {
  provider: string;
  configured: boolean;
  transport: string;
  queue: boolean;
}

const CONNECTOR_LABELS: Record<string, string> = {
  email: "E-mail", push: "Push", whatsapp: "WhatsApp", pix: "Pix", bank: "Banco",
  invoice: "Nota fiscal", signature: "Assinatura eletrônica", videoconference: "Videoconferência",
  "google-calendar": "Google Calendar", "microsoft-calendar": "Microsoft Calendar",
};

export function IntegrationOperationsPanel({ modules, records, actor, canImport }: { modules: SchoolModuleDefinition[]; records: SchoolRecord[]; actor: SchoolActor; canImport: boolean }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [moduleId, setModuleId] = useState(modules[0]?.id || "alunos");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [connectors, setConnectors] = useState<IntegrationConnector[]>([]);
  const [connectorLoading, setConnectorLoading] = useState(false);
  const [testingConnector, setTestingConnector] = useState("");
  const [health, setHealth] = useState<{ loading: boolean; api: "unknown" | "healthy" | "unavailable"; firebase: boolean; checkedAt?: string }>({ loading: false, api: "unknown", firebase: navigator.onLine });
  const module = modules.find((item) => item.id === moduleId) || modules[0];

  useEffect(() => {
    const online = () => setHealth((current) => ({ ...current, firebase: navigator.onLine }));
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", online); };
  }, []);

  const checkHealth = async () => {
    setHealth((current) => ({ ...current, loading: true }));
    try {
      const response = await fetch("/api/health", { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error("API indisponível");
      const payload = await response.json();
      setHealth({ loading: false, api: payload.status === "ok" ? "healthy" : "unavailable", firebase: navigator.onLine, checkedAt: new Date().toISOString() });
    } catch {
      setHealth({ loading: false, api: "unavailable", firebase: navigator.onLine, checkedAt: new Date().toISOString() });
    }
  };

  const downloadTemplate = () => {
    if (!module) return;
    downloadFile(`modelo-importacao-${module.id}.csv`, schoolCsvTemplate(module), "text/csv;charset=utf-8");
  };

  const importFile = async (file?: File) => {
    if (!file || !module) return;
    setImporting(true);
    setProgress("");
    try {
      const result = await importSchoolCsv(file, module.id, actor, (current, total) => setProgress(`${current}/${total}`));
      toast({ title: "Importação concluída", description: `${result.imported} importado(s), ${result.failed} rejeitado(s).${result.errors.length ? ` Primeira ocorrência: ${result.errors[0]}` : ""}` });
    } catch (error: any) {
      toast({ title: "Falha na importação", description: error.message, variant: "destructive" });
    } finally {
      setImporting(false);
      setProgress("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const exportEducacenso = () => {
    downloadFile(`educacenso-pre-validacao-${new Date().toISOString().slice(0, 10)}.csv`, exportEducacensoCsv(records), "text/csv;charset=utf-8");
    toast({ title: "Arquivo Educacenso preparado", description: "O CSV reúne vínculos, matrícula, rendimento, movimento e educação especial disponíveis. Faça a conferência oficial antes do envio ao Inep." });
  };

  const connectorToken = async () => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Sessão expirada. Entre novamente para consultar os conectores.");
    return token;
  };

  const loadConnectors = async () => {
    setConnectorLoading(true);
    try {
      const token = await connectorToken();
      const response = await fetch("/api/v1/integrations/catalog", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "API de conectores indisponível.");
      setConnectors(payload.providers || []);
      toast({ title: "Conectores verificados", description: `${(payload.providers || []).filter((item: IntegrationConnector) => item.configured).length}/${(payload.providers || []).length} configurado(s) no servidor.` });
    } catch (error: any) {
      toast({ title: "Não foi possível consultar os conectores", description: error.message, variant: "destructive" });
    } finally { setConnectorLoading(false); }
  };

  const testConnector = async (provider: string) => {
    setTestingConnector(provider);
    try {
      const token = await connectorToken();
      const response = await fetch("/api/v1/integrations/dispatch", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ provider, operation: "health_check", payload: { source: "school-integration-panel", requestedBy: actor.uid, requestedAt: new Date().toISOString() } }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "O teste não pôde ser enfileirado.");
      toast({ title: "Teste enfileirado", description: `${CONNECTOR_LABELS[provider] || provider}: job ${payload.jobId}. A fila fará até 5 tentativas.` });
    } catch (error: any) {
      toast({ title: "Falha no teste do conector", description: error.message, variant: "destructive" });
    } finally { setTestingConnector(""); }
  };

  return (
    <section className="school-governance-panel" aria-labelledby="integration-tools-title">
      <div className="school-governance-heading"><div><h4 id="integration-tools-title"><Activity className="h-5 w-5" />Operação técnica e intercâmbio de dados</h4><p>Importação validada, exportação Educacenso, documentação de API e saúde dos serviços.</p></div><Badge variant="outline">Ambiente {import.meta.env.MODE}</Badge></div>
      <div className="school-governance-grid">
        <article><FileSpreadsheet className="h-6 w-6" /><div><h5>Importar alunos, notas ou qualquer módulo</h5><p>Use CSV com validação linha a linha, limite de 2.000 registros, auditoria e relatório de rejeições.</p><Select value={module?.id} onValueChange={setModuleId}><SelectTrigger aria-label="Módulo de destino"><SelectValue /></SelectTrigger><SelectContent>{modules.map((item) => <SelectItem key={item.id} value={item.id}>{String(item.number).padStart(2, "0")} · {item.shortTitle}</SelectItem>)}</SelectContent></Select></div><div className="school-governance-actions"><Button variant="outline" onClick={downloadTemplate} disabled={!module}><Download className="mr-2 h-4 w-4" />Modelo CSV</Button><Button onClick={() => fileRef.current?.click()} disabled={!canImport || importing}>{importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{importing ? `Importando ${progress}` : "Importar CSV"}</Button><input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => importFile(event.target.files?.[0])} /></div></article>
        <article><ShieldCheck className="h-6 w-6" /><div><h5>Educacenso e exportações externas</h5><p>Gera uma prévia tabular com matrícula, movimentação, rendimento, frequência e educação especial.</p></div><div className="school-governance-actions"><Button variant="outline" onClick={exportEducacenso}><Download className="mr-2 h-4 w-4" />Exportar pré-validação</Button><Button variant="outline" asChild><a href="/openapi.json" target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />OpenAPI</a></Button></div></article>
        <article><span className={`school-health-icon is-${health.api}`}>{health.firebase ? <Wifi className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}</span><div><h5>Painel de saúde</h5><p>Internet/Firebase: <strong>{health.firebase ? "conectado" : "off-line"}</strong> · API de servidor: <strong>{health.api === "healthy" ? "saudável" : health.api === "unavailable" ? "indisponível ou não publicada" : "não verificada"}</strong>.</p>{health.checkedAt && <small>Verificado em {new Date(health.checkedAt).toLocaleString("pt-BR")}</small>}</div><div className="school-governance-actions"><Button variant="outline" onClick={checkHealth} disabled={health.loading}>{health.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Verificar agora</Button></div></article>
        <article className="school-connectors-card"><PlugZap className="h-6 w-6" /><div><div className="school-connectors-heading"><span><h5>Conectores externos com fila e idempotência</h5><p>E-mail, WhatsApp, Pix, banco, nota fiscal, assinatura, vídeo e calendários. Os arquivos usam o Firestore gratuito e não exigem conector.</p></span><Button variant="outline" onClick={loadConnectors} disabled={connectorLoading}>{connectorLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}{connectors.length ? "Atualizar estado" : "Verificar conectores"}</Button></div>{connectors.length > 0 && <div className="school-connectors-grid">{connectors.map((connector) => <div key={connector.provider}><span><i className={connector.configured ? "is-configured" : ""} /><strong>{CONNECTOR_LABELS[connector.provider] || connector.provider}</strong><small>{connector.configured ? "Configurado · HTTPS · fila ativa" : "Aguardando endpoint e token"}</small></span><Button size="sm" variant="ghost" disabled={!connector.configured || Boolean(testingConnector)} onClick={() => testConnector(connector.provider)}>{testingConnector === connector.provider ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}Testar</Button></div>)}</div>}</div></article>
      </div>
    </section>
  );
}

export function PrivacyOperationsPanel({ user, records }: { user: User | null; records: SchoolRecord[] }) {
  const { toast } = useToast();
  const exportMyData = () => {
    if (!user) return;
    const safeProfile = { ...user } as Record<string, unknown>;
    delete safeProfile.senhaAtual;
    const payload = { format: "vestibulando-data-subject-export", version: 1, exportedAt: new Date().toISOString(), profile: safeProfile, records: records.filter((record) => record.audienceUserIds.includes(user.uid)) };
    downloadFile(`meus-dados-vestibulando-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json");
    toast({ title: "Cópia dos dados gerada", description: "O arquivo contém seu perfil e os registros escolares compartilhados com sua conta." });
  };
  return (
    <section className="school-governance-panel" aria-labelledby="privacy-tools-title">
      <div className="school-governance-heading"><div><h4 id="privacy-tools-title"><ShieldCheck className="h-5 w-5" />Central de privacidade</h4><p>Transparência, direitos do titular, consentimentos separados e canal de atendimento ao encarregado.</p></div><Badge variant="outline"><CheckCircle2 className="mr-1 h-3 w-3" />LGPD</Badge></div>
      <div className="school-policy-links"><a href="/privacy.html" target="_blank" rel="noreferrer">Política de privacidade</a><a href="/terms.html" target="_blank" rel="noreferrer">Termos de uso</a><a href="/cookies.html" target="_blank" rel="noreferrer">Política de cookies</a><Button variant="outline" onClick={exportMyData}><Download className="mr-2 h-4 w-4" />Exportar meus dados</Button></div>
      <p className="school-policy-note">Pedidos de acesso, correção, oposição, revisão de consentimento ou descarte devem ser abertos como novo registro neste módulo; o protocolo, prazo, anexos e histórico ficam auditados.</p>
    </section>
  );
}

interface NotificationPreferences {
  inApp: boolean;
  push: boolean;
  email: boolean;
  whatsapp: boolean;
  deadlines: boolean;
  grades: boolean;
  attendance: boolean;
  finance: boolean;
  announcements: boolean;
  quietStart: string;
  quietEnd: string;
}

const defaultNotificationPreferences: NotificationPreferences = {
  inApp: true,
  push: false,
  email: true,
  whatsapp: false,
  deadlines: true,
  grades: true,
  attendance: true,
  finance: true,
  announcements: true,
  quietStart: "22:00",
  quietEnd: "07:00",
};

export function NotificationPreferencesPanel({ user, actor }: { user: User | null; actor: SchoolActor }) {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const stored = (user as any)?.preferenciasNotificacao;
    setPreferences({ ...defaultNotificationPreferences, ...(stored && typeof stored === "object" ? stored : {}) });
  }, [user?.uid, (user as any)?.preferenciasNotificacao]);

  const toggle = (key: keyof NotificationPreferences, checked: boolean) => setPreferences((current) => ({ ...current, [key]: checked }));
  const save = async () => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      if (preferences.push && "Notification" in window && Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") throw new Error("O navegador não autorizou notificações push. Desative Push ou permita nas configurações do navegador.");
      }
      await updateDoc(doc(db, "usuarios", user.uid), { preferenciasNotificacao: preferences });
      await registerAuditEvent("notification_preferences_update", "comunicacao", actor, { channels: { inApp: preferences.inApp, push: preferences.push, email: preferences.email, whatsapp: preferences.whatsapp }, quietHours: `${preferences.quietStart}-${preferences.quietEnd}` });
      toast({ title: "Preferências salvas", description: "Os canais, assuntos e horário silencioso foram atualizados." });
    } catch (error: any) {
      toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <section className="school-notification-preferences" aria-labelledby="notification-preferences-title">
      <div className="school-preferences-heading"><div><h4 id="notification-preferences-title"><Send className="h-5 w-5" />Preferências de notificação</h4><p>Escolha canais, assuntos e um período silencioso. Alertas críticos de segurança continuam disponíveis no aplicativo.</p></div><Button size="sm" onClick={save} disabled={saving || !user?.uid}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar preferências</Button></div>
      <div className="school-preferences-grid">
        <div><span>Canais</span>{([['inApp', 'Aplicativo em tempo real'], ['push', 'Push do navegador'], ['email', 'E-mail'], ['whatsapp', 'WhatsApp']] as Array<[keyof NotificationPreferences, string]>).map(([key, label]) => <label key={key}><Checkbox checked={Boolean(preferences[key])} onCheckedChange={(checked) => toggle(key, checked === true)} /><b>{label}</b></label>)}</div>
        <div><span>Assuntos</span>{([['deadlines', 'Prazos e atividades'], ['grades', 'Notas e boletins'], ['attendance', 'Frequência e faltas'], ['finance', 'Financeiro'], ['announcements', 'Avisos gerais']] as Array<[keyof NotificationPreferences, string]>).map(([key, label]) => <label key={key}><Checkbox checked={Boolean(preferences[key])} onCheckedChange={(checked) => toggle(key, checked === true)} /><b>{label}</b></label>)}</div>
        <div className="school-quiet-hours"><span>Horário silencioso</span><div><Label htmlFor="quiet-start">De</Label><Input id="quiet-start" type="time" value={preferences.quietStart} onChange={(event) => setPreferences((current) => ({ ...current, quietStart: event.target.value }))} /><Label htmlFor="quiet-end">até</Label><Input id="quiet-end" type="time" value={preferences.quietEnd} onChange={(event) => setPreferences((current) => ({ ...current, quietEnd: event.target.value }))} /></div><small>Mensagens comuns aguardam o fim do período; emergências permanecem destacadas.</small></div>
      </div>
    </section>
  );
}
