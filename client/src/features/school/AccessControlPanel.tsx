import { useEffect, useMemo, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { AlertTriangle, Ban, CheckCircle2, Eraser, KeyRound, Loader2, LockKeyhole, LogOut, Search, ShieldCheck, UserCog, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { auth, db } from "@/lib/firebase";
import { SCHOOL_MODULES, SCHOOL_ROLE_LABELS, resolveSchoolRole } from "./schoolCatalog";
import { registerAuditEvent, type SchoolActor } from "./schoolData";

interface AccessUser {
  uid: string;
  nome: string;
  email: string;
  tipo: string;
  papel?: string;
  papelDetalhado?: string;
  permissoes?: string[];
  ativo?: boolean;
  bloqueado?: boolean;
  status?: string;
  mfaObrigatorio?: boolean;
  mfaAtivado?: boolean;
  acessoTemporarioAte?: string | null;
  isOnline?: boolean;
  lastSeen?: string;
}

export function AccessControlPanel({ users, actor }: { users: AccessUser[]; actor: SchoolActor }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AccessUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [temporaryUntil, setTemporaryUntil] = useState("");
  const [working, setWorking] = useState(false);
  const { data: securityAlerts = [] } = useRealtimeQuery<any>({ collectionName: "securityAlerts", queryKey: ["/school/security-alerts"] });
  const openAlerts = securityAlerts.filter((alert) => alert.status === "open").sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const normalized = search.toLocaleLowerCase("pt-BR");
  const filtered = useMemo(() => users.filter((user) => `${user.nome} ${user.email} ${user.papel || ""} ${user.tipo}`.toLocaleLowerCase("pt-BR").includes(normalized)).sort((a, b) => a.nome.localeCompare(b.nome)), [users, normalized]);

  useEffect(() => {
    setPermissions(selected?.permissoes || []);
    setMfaRequired(Boolean(selected?.mfaObrigatorio));
    setTemporaryUntil(selected?.acessoTemporarioAte ? selected.acessoTemporarioAte.slice(0, 16) : "");
  }, [selected?.uid]);

  const updateAccount = async (user: AccessUser, changes: Record<string, unknown>, action: string, description: string) => {
    if (user.uid === actor.uid && (changes.ativo === false || changes.bloqueado === true)) {
      toast({ title: "Ação não permitida", description: "Você não pode bloquear ou desativar a própria conta.", variant: "destructive" });
      return;
    }
    setWorking(true);
    try {
      await updateDoc(doc(db, "usuarios", user.uid), { ...changes, atualizadoEm: new Date().toISOString(), atualizadoPor: actor.uid });
      await registerAuditEvent(action, "acessos", actor, { userId: user.uid, userName: user.nome, changes });
      toast({ title: "Conta atualizada", description });
    } catch (error: any) {
      toast({ title: "Falha ao atualizar a conta", description: error.message, variant: "destructive" });
    } finally { setWorking(false); }
  };

  const savePermissions = async () => {
    if (!selected) return;
    await updateAccount(selected, { permissoes: permissions, mfaObrigatorio: mfaRequired, acessoTemporarioAte: temporaryUntil || null }, "permissions_update", "Permissões, MFA e validade foram aplicados.");
    setSelected(null);
  };

  const resetPassword = async (user: AccessUser) => {
    setWorking(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      await updateAccount(user, { forcarTrocaSenha: true, primeiroAcesso: true }, "password_reset_request", "O e-mail de redefinição foi enviado e a troca será obrigatória.");
    } catch (error: any) {
      toast({ title: "Não foi possível enviar a redefinição", description: error.message, variant: "destructive" });
      setWorking(false);
    }
  };

  const revokeSessions = async (user: AccessUser) => {
    setWorking(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sessão administrativa expirada.");
      const response = await fetch(`/api/v1/admin/users/${encodeURIComponent(user.uid)}/revoke-sessions`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("API de revogação indisponível");
      toast({ title: "Sessões encerradas", description: "Os tokens de atualização foram revogados no servidor." });
    } catch {
      await updateAccount(user, { sessoesRevogadasEm: new Date().toISOString(), sessaoPreservadaId: null }, "sessions_revoke_realtime", "As sessões conectadas serão encerradas em tempo real. Publique a API para revogar também os refresh tokens.");
    } finally { setWorking(false); }
  };

  const cleanupLegacyPasswords = async () => {
    setWorking(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sessão administrativa expirada.");
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      const previewResponse = await fetch("/api/v1/admin/security/remove-legacy-passwords", { method: "POST", headers, body: JSON.stringify({}) });
      if (!previewResponse.ok) throw new Error("A API segura de migração não está publicada.");
      const preview = await previewResponse.json();
      if (!preview.affected) { toast({ title: "Base já protegida", description: "Nenhum campo legado de senha foi encontrado." }); return; }
      if (!window.confirm(`${preview.affected} conta(s) ainda possuem o campo legado. Remover definitivamente esses campos agora? As senhas válidas no Firebase Authentication não serão alteradas.`)) return;
      const response = await fetch("/api/v1/admin/security/remove-legacy-passwords", { method: "POST", headers, body: JSON.stringify({ confirm: "REMOVER_SENHAS_LEGADAS" }) });
      if (!response.ok) throw new Error("A limpeza não foi concluída.");
      const result = await response.json();
      toast({ title: "Higienização concluída", description: `${result.affected} campo(s) legado(s) foram removidos com auditoria.` });
    } catch (error: any) {
      toast({ title: "Não foi possível executar a higienização", description: error.message, variant: "destructive" });
    } finally { setWorking(false); }
  };

  return (
    <section className="school-access-panel">
      <div className="school-access-heading"><div><h4><ShieldCheck className="h-5 w-5" />Diretório e segurança de contas</h4><p>Permissões individuais, MFA, bloqueio, desativação, senha e encerramento remoto.</p></div><div className="school-access-heading-actions"><Button size="sm" variant="outline" onClick={cleanupLegacyPasswords} disabled={working}><Eraser className="mr-2 h-4 w-4" />Higienizar senhas legadas</Button>{openAlerts.length > 0 && <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />{openAlerts.length} alerta(s)</Badge>}<Badge variant="outline">{users.length} contas</Badge></div></div>
      {openAlerts.length > 0 && <div className="school-security-alerts">{openAlerts.slice(0, 3).map((alert) => <div key={alert.id}><AlertTriangle /><span><strong>Tentativas excessivas detectadas</strong><small>{alert.path} · {new Date(alert.createdAt).toLocaleString("pt-BR")} · identificador {String(alert.ipHash || "").slice(0, 10)}…</small></span></div>)}</div>}
      <div className="school-access-search"><Search className="h-4 w-4" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome, e-mail ou papel..." /></div>
      <div className="school-access-table"><Table><TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Papel</TableHead><TableHead>Segurança</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{filtered.slice(0, 100).map((user) => { const role = resolveSchoolRole(user); return <TableRow key={user.uid}><TableCell><div className="school-access-user"><strong>{user.nome}</strong><span>{user.email}</span></div></TableCell><TableCell>{SCHOOL_ROLE_LABELS[role]}</TableCell><TableCell><div className="school-access-badges"><Badge variant={user.mfaAtivado ? "default" : "secondary"}>{user.mfaAtivado ? "MFA ativo" : user.mfaObrigatorio ? "MFA pendente" : "MFA opcional"}</Badge>{user.isOnline && <Badge variant="outline">on-line</Badge>}</div></TableCell><TableCell><span className={`school-account-state ${user.bloqueado || user.ativo === false ? "is-blocked" : "is-active"}`}>{user.bloqueado ? "Bloqueado" : user.ativo === false ? "Inativo" : "Ativo"}</span></TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => setSelected(user)} aria-label={`Permissões de ${user.nome}`}><UserCog className="h-4 w-4" /></Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><LockKeyhole className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => resetPassword(user)}><KeyRound className="mr-2 h-4 w-4" />Redefinir senha</DropdownMenuItem><DropdownMenuItem onClick={() => revokeSessions(user)}><LogOut className="mr-2 h-4 w-4" />Encerrar sessões</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => updateAccount(user, { bloqueado: !user.bloqueado }, user.bloqueado ? "account_unblock" : "account_block", user.bloqueado ? "Conta desbloqueada." : "Conta bloqueada.")}>{user.bloqueado ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Ban className="mr-2 h-4 w-4" />}{user.bloqueado ? "Desbloquear" : "Bloquear"}</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={() => updateAccount(user, { ativo: user.ativo === false }, user.ativo === false ? "account_activate" : "account_deactivate", user.ativo === false ? "Conta reativada." : "Conta desativada.")}><UserX className="mr-2 h-4 w-4" />{user.ativo === false ? "Reativar" : "Desativar"}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></TableCell></TableRow>; })}</TableBody></Table></div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Permissões de {selected?.nome}</DialogTitle><DialogDescription>Aplique acessos individuais, MFA obrigatório e delegação com prazo.</DialogDescription></DialogHeader><div className="school-access-policy"><label><Checkbox checked={mfaRequired} onCheckedChange={(checked) => setMfaRequired(checked === true)} /><span>Exigir autenticação em duas etapas</span></label><div><Label htmlFor="access-expiration">Acesso/delegação válido até</Label><Input id="access-expiration" type="datetime-local" value={temporaryUntil} onChange={(event) => setTemporaryUntil(event.target.value)} /></div></div><div className="school-permission-grid">{SCHOOL_MODULES.map((module) => { const view = `${module.id}.view`; const manage = `${module.id}.manage`; const all = permissions.includes("*"); const toggle = (value: string) => setPermissions((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current.filter((item) => item !== "*"), value]); return <div key={module.id} className="school-permission-row"><span><b>{String(module.number).padStart(2, "0")}</b>{module.shortTitle}</span><label><Checkbox checked={all || permissions.includes(view)} disabled={all} onCheckedChange={() => toggle(view)} />Ver</label><label><Checkbox checked={all || permissions.includes(manage)} disabled={all} onCheckedChange={() => toggle(manage)} />Gerir</label></div>; })}</div><DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button><Button onClick={savePermissions} disabled={working}>{working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar permissões</Button></DialogFooter></DialogContent></Dialog>
    </section>
  );
}
