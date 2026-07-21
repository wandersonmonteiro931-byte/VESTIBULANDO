import { useEffect, useMemo, useState } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { Check, Copy, KeyRound, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { createUserWithoutSignIn, db } from "@/lib/firebase";
import { ROLE_DEFAULT_MODULES, ROLE_WRITE_MODULES, SCHOOL_MODULE_BY_ID, SCHOOL_ROLE_LABELS, type SchoolRole } from "./schoolCatalog";
import { registerAuditEvent, type SchoolActor } from "./schoolData";

interface SchoolAccountDialogProps {
  open: boolean;
  actor: SchoolActor;
  students?: Array<{ uid: string; nome: string }>;
  onOpenChange: (open: boolean) => void;
}

interface GuardianLinkConfig {
  relationshipType: "pedagogico" | "financeiro" | "pedagogico_financeiro" | "guarda_compartilhada" | "autorizado";
  permissions: string[];
}

const GUARDIAN_PERMISSION_OPTIONS = [
  { id: "academic.view", label: "Notas, boletins e atividades" },
  { id: "attendance.view", label: "Frequência e faltas" },
  { id: "discipline.view", label: "Ocorrências disciplinares" },
  { id: "finance.view", label: "Mensalidades e pagamentos" },
  { id: "documents.sign", label: "Assinar documentos" },
  { id: "absence.justify", label: "Justificar ausências" },
  { id: "activities.authorize", label: "Autorizar passeios e atividades" },
  { id: "communications.receive", label: "Receber comunicados" },
  { id: "communications.acknowledge", label: "Confirmar leitura" },
  { id: "meetings.schedule", label: "Agendar reuniões" },
] as const;

const DEFAULT_GUARDIAN_PERMISSIONS = GUARDIAN_PERMISSION_OPTIONS.map((option) => option.id);

function defaultGuardianLink(): GuardianLinkConfig {
  return { relationshipType: "pedagogico_financeiro", permissions: [...DEFAULT_GUARDIAN_PERMISSIONS] };
}

function randomPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#";
  const alphabet = upper + lower + digits + symbols;
  const pick = (pool: string) => {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return pool[value[0] % pool.length];
  };
  const characters = [pick(upper), pick(lower), pick(digits), pick(symbols), ...Array.from({ length: 10 }, () => pick(alphabet))];
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    const swapIndex = value[0] % (index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join("");
}

function baseTypeForRole(role: SchoolRole): "aluno" | "professor" | "diretor" | "responsavel" | "funcionario" {
  if (role === "diretor") return "diretor";
  if (["professor", "professor_substituto", "monitor"].includes(role)) return "professor";
  if (role === "aluno") return "aluno";
  if (role === "responsavel") return "responsavel";
  return "funcionario";
}

function defaultPermissions(role: SchoolRole) {
  const view = ROLE_DEFAULT_MODULES[role] || [];
  const write = ROLE_WRITE_MODULES[role] || [];
  if (view.includes("*") || write.includes("*")) return ["*"];
  return Array.from(new Set([
    ...view.map((moduleId) => `${moduleId}.view`),
    ...write.map((moduleId) => `${moduleId}.manage`),
  ]));
}

export function SchoolAccountDialog({ open, actor, students = [], onOpenChange }: SchoolAccountDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(randomPassword());
  const [role, setRole] = useState<SchoolRole>("secretaria");
  const [permissions, setPermissions] = useState<string[]>(defaultPermissions("secretaria"));
  const [unitIds, setUnitIds] = useState("");
  const [temporaryUntil, setTemporaryUntil] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [linkedStudentIds, setLinkedStudentIds] = useState<string[]>([]);
  const [guardianLinkConfigs, setGuardianLinkConfigs] = useState<Record<string, GuardianLinkConfig>>({});
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const allowedModules = useMemo(() => Object.keys(SCHOOL_MODULE_BY_ID).sort((a, b) => SCHOOL_MODULE_BY_ID[a].number - SCHOOL_MODULE_BY_ID[b].number), []);

  useEffect(() => {
    setPermissions(defaultPermissions(role));
    setMfaRequired(role === "diretor" || role === "administrador");
    if (role !== "responsavel") {
      setLinkedStudentIds([]);
      setGuardianLinkConfigs({});
    }
  }, [role]);

  useEffect(() => {
    if (!open) return;
    setName("");
    setEmail("");
    setPassword(randomPassword());
    setRole("secretaria");
    setPermissions(defaultPermissions("secretaria"));
    setUnitIds("");
    setTemporaryUntil("");
    setMfaRequired(false);
    setLinkedStudentIds([]);
    setGuardianLinkConfigs({});
    setCopied(false);
  }, [open]);

  const togglePermission = (permission: string) => {
    setPermissions((current) => current.includes(permission) ? current.filter((item) => item !== permission) : [...current.filter((item) => item !== "*"), permission]);
  };

  const toggleLinkedStudent = (studentId: string, checked: boolean) => {
    setLinkedStudentIds((current) => checked ? Array.from(new Set([...current, studentId])) : current.filter((id) => id !== studentId));
    setGuardianLinkConfigs((current) => {
      if (checked) return { ...current, [studentId]: current[studentId] || defaultGuardianLink() };
      const next = { ...current };
      delete next[studentId];
      return next;
    });
  };

  const updateGuardianRelationship = (studentId: string, relationshipType: GuardianLinkConfig["relationshipType"]) => {
    setGuardianLinkConfigs((current) => ({
      ...current,
      [studentId]: { ...(current[studentId] || defaultGuardianLink()), relationshipType },
    }));
  };

  const toggleGuardianPermission = (studentId: string, permission: string) => {
    setGuardianLinkConfigs((current) => {
      const config = current[studentId] || defaultGuardianLink();
      return {
        ...current,
        [studentId]: {
          ...config,
          permissions: config.permissions.includes(permission)
            ? config.permissions.filter((item) => item !== permission)
            : [...config.permissions, permission],
        },
      };
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleCreate = async () => {
    if (!name.trim()) return toast({ title: "Nome obrigatório", variant: "destructive" });
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast({ title: "E-mail inválido", variant: "destructive" });
    if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) return toast({ title: "Senha temporária fraca", description: "Use 10 ou mais caracteres, com letra maiúscula, minúscula e número.", variant: "destructive" });
    if (role === "responsavel" && !linkedStudentIds.length) return toast({ title: "Vincule pelo menos um aluno ao responsável", variant: "destructive" });

    setSaving(true);
    try {
      const credential = await createUserWithoutSignIn(email.trim().toLowerCase(), password);
      const now = new Date().toISOString();
      const linkedStudents = students.filter((entry) => linkedStudentIds.includes(entry.uid));
      const userData = {
        uid: credential.user.uid,
        nome: name.trim(),
        email: email.trim().toLowerCase(),
        tipo: baseTypeForRole(role),
        papel: role,
        papelDetalhado: role,
        permissoes: permissions,
        unidadesIds: unitIds.split(",").map((item) => item.trim()).filter(Boolean),
        filhosIds: linkedStudentIds,
        filhosTurmasIds: Array.from(new Set(linkedStudents.map((student) => String((student as any).turma || "")).filter(Boolean))),
        filhosTurmasAcademicasIds: Array.from(new Set(linkedStudents.filter((student) => (guardianLinkConfigs[student.uid] || defaultGuardianLink()).permissions.includes("academic.view")).map((student) => String((student as any).turma || "")).filter(Boolean))),
        filhosFinanceirosIds: linkedStudentIds.filter((studentId) => ["financeiro", "pedagogico_financeiro"].includes(guardianLinkConfigs[studentId]?.relationshipType || "")),
        filhosPedagogicosIds: linkedStudentIds.filter((studentId) => ["pedagogico", "pedagogico_financeiro", "guarda_compartilhada"].includes(guardianLinkConfigs[studentId]?.relationshipType || "")),
        ativo: true,
        bloqueado: false,
        status: "aprovado",
        primeiroAcesso: true,
        forcarTrocaSenha: true,
        mfaObrigatorio: mfaRequired,
        acessoTemporarioAte: temporaryUntil || null,
        criadoEm: now,
        criadoPor: actor.uid,
        isOnline: false,
        statusPresenca: "offline",
      };
      const batch = writeBatch(db);
      batch.set(doc(db, "usuarios", credential.user.uid), userData);
      for (const studentId of linkedStudentIds) {
        const student = students.find((entry) => entry.uid === studentId);
        const guardianConfig = guardianLinkConfigs[studentId] || defaultGuardianLink();
        batch.set(doc(db, "guardianLinks", `${credential.user.uid}_${studentId}`), {
          guardianId: credential.user.uid,
          guardianName: name.trim(),
          studentId,
          studentName: student?.nome || "Aluno",
          studentClassId: (student as any)?.turma || "",
          relationshipType: guardianConfig.relationshipType,
          permissions: guardianConfig.permissions,
          isFinancialGuardian: ["financeiro", "pedagogico_financeiro"].includes(guardianConfig.relationshipType),
          isPedagogicalGuardian: ["pedagogico", "pedagogico_financeiro", "guarda_compartilhada"].includes(guardianConfig.relationshipType),
          sharedCustody: guardianConfig.relationshipType === "guarda_compartilhada",
          active: true,
          createdAt: now,
          createdBy: actor.uid,
        });
      }
      await batch.commit();
      await registerAuditEvent("account_create", "acessos", actor, { userId: credential.user.uid, role, permissions, mfaRequired, temporaryUntil: temporaryUntil || null, guardianLinks: role === "responsavel" ? guardianLinkConfigs : undefined });
      toast({ title: "Conta criada com segurança", description: `${name} deverá trocar a senha no primeiro acesso.` });
      onOpenChange(false);
    } catch (error: any) {
      const message = error.code === "auth/email-already-in-use" ? "Já existe uma conta com este e-mail." : error.message;
      toast({ title: "Não foi possível criar a conta", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Nova conta institucional</DialogTitle>
          <DialogDescription>A conta é criada no Firebase Authentication com senha temporária, troca obrigatória e permissões por módulo.</DialogDescription>
        </DialogHeader>
        <div className="school-form-grid">
          <div className="school-form-field"><Label htmlFor="account-name">Nome completo *</Label><Input id="account-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
          <div className="school-form-field"><Label htmlFor="account-email">E-mail *</Label><Input id="account-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <div className="school-form-field"><Label htmlFor="account-role">Papel *</Label><Select value={role} onValueChange={(value) => setRole(value as SchoolRole)}><SelectTrigger id="account-role"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(SCHOOL_ROLE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
          <div className="school-form-field"><Label htmlFor="account-units">Unidades (separe por vírgula)</Label><Input id="account-units" value={unitIds} onChange={(event) => setUnitIds(event.target.value)} placeholder="matriz, polo-centro" /></div>
          <div className="school-form-field school-form-field-wide">
            <Label htmlFor="account-password">Senha temporária *</Label>
            <div className="flex gap-2"><Input id="account-password" value={password} onChange={(event) => setPassword(event.target.value)} /><Button type="button" variant="outline" onClick={handleCopy}>{copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}{copied ? "Copiada" : "Copiar"}</Button><Button type="button" variant="ghost" onClick={() => setPassword(randomPassword())}><KeyRound className="mr-2 h-4 w-4" />Gerar</Button></div>
          </div>
          <div className="school-form-field"><Label htmlFor="account-temporary">Acesso temporário até</Label><Input id="account-temporary" type="datetime-local" value={temporaryUntil} onChange={(event) => setTemporaryUntil(event.target.value)} /></div>
          <div className="school-form-checkbox"><Checkbox id="account-mfa" checked={mfaRequired} onCheckedChange={(checked) => setMfaRequired(checked === true)} /><div><Label htmlFor="account-mfa">Exigir autenticação em duas etapas</Label><p>Obrigatória por padrão para direção e administração.</p></div></div>
        </div>

        {role === "responsavel" && (
          <div className="school-account-students">
            <h4>Alunos vinculados e permissões por vínculo *</h4>
            <p>O mesmo responsável pode ter papéis e acessos diferentes para cada filho. Outro responsável pode ser cadastrado separadamente para o mesmo aluno.</p>
            <div className="school-guardian-links">{students.map((student) => {
              const selected = linkedStudentIds.includes(student.uid);
              const guardianConfig = guardianLinkConfigs[student.uid] || defaultGuardianLink();
              return <section key={student.uid} className={`school-guardian-student-card ${selected ? "is-selected" : ""}`}>
                <label className="school-guardian-student-toggle"><Checkbox checked={selected} onCheckedChange={(checked) => toggleLinkedStudent(student.uid, checked === true)} /><span>{student.nome}</span></label>
                {selected && <div className="school-guardian-link-editor">
                  <div><Label htmlFor={`guardian-role-${student.uid}`}>Papel neste vínculo</Label><Select value={guardianConfig.relationshipType} onValueChange={(value) => updateGuardianRelationship(student.uid, value as GuardianLinkConfig["relationshipType"])}><SelectTrigger id={`guardian-role-${student.uid}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pedagogico_financeiro">Pedagógico e financeiro</SelectItem><SelectItem value="pedagogico">Somente pedagógico</SelectItem><SelectItem value="financeiro">Somente financeiro</SelectItem><SelectItem value="guarda_compartilhada">Guarda compartilhada</SelectItem><SelectItem value="autorizado">Pessoa autorizada</SelectItem></SelectContent></Select></div>
                  <div className="school-guardian-permission-grid">{GUARDIAN_PERMISSION_OPTIONS.map((option) => <label key={option.id}><Checkbox checked={guardianConfig.permissions.includes(option.id)} onCheckedChange={() => toggleGuardianPermission(student.uid, option.id)} /><span>{option.label}</span></label>)}</div>
                </div>}
              </section>;
            })}</div>
          </div>
        )}

        <div className="school-permission-editor">
          <div className="school-permission-heading"><div><h4><ShieldCheck className="h-4 w-4" />Permissões efetivas</h4><p>O perfil sugere permissões iniciais; ajuste individualmente pelo princípio do menor privilégio.</p></div><BadgeCount count={permissions.includes("*") ? allowedModules.length * 2 : permissions.length} /></div>
          <div className="school-permission-grid">
            {allowedModules.map((moduleId) => {
              const module = SCHOOL_MODULE_BY_ID[moduleId];
              const viewPermission = `${moduleId}.view`;
              const writePermission = `${moduleId}.manage`;
              const all = permissions.includes("*");
              return <div key={moduleId} className="school-permission-row"><span><b>{String(module.number).padStart(2, "0")}</b>{module.shortTitle}</span><label><Checkbox checked={all || permissions.includes(viewPermission)} disabled={all} onCheckedChange={() => togglePermission(viewPermission)} />Ver</label><label><Checkbox checked={all || permissions.includes(writePermission)} disabled={all} onCheckedChange={() => togglePermission(writePermission)} />Gerir</label></div>;
            })}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={handleCreate} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}Criar conta</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BadgeCount({ count }: { count: number }) {
  return <span className="school-permission-count">{count} permissões</span>;
}
