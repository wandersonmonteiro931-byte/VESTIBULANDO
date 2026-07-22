import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ClipboardList, Loader2, Paperclip, Save, ShieldCheck, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  SCHOOL_ROLE_LABELS,
  type SchoolFieldDefinition,
  type SchoolModuleDefinition,
  makeProtocol,
} from "./schoolCatalog";
import {
  saveSchoolRecord,
  downloadSchoolAttachment,
  uploadSchoolAttachment,
  type SaveSchoolRecordInput,
  type SchoolActor,
  type SchoolAttachment,
  type SchoolRecord,
} from "./schoolData";
import { capabilityBlueprint } from "./schoolCapabilityEngine";

interface DirectoryUser {
  uid: string;
  nome: string;
  tipo?: string;
  papel?: string;
  turma?: string;
}

interface DirectoryClass {
  id: string;
  nome: string;
}

interface SchoolTaskPageProps {
  module: SchoolModuleDefinition;
  record?: SchoolRecord | null;
  initialCapability?: string | null;
  lockedCapability?: boolean;
  actor: SchoolActor;
  users?: DirectoryUser[];
  classes?: DirectoryClass[];
  onBack: () => void;
  onSaved: (record: SchoolRecord) => void;
}

interface FormState {
  capability: string;
  workflow: string;
  title: string;
  code: string;
  status: string;
  description: string;
  studentId: string;
  classId: string;
  unitName: string;
  assigneeId: string;
  audienceRole: string;
  customData: Record<string, string | number | boolean>;
  attachments: SchoolAttachment[];
}

function defaultState(module: SchoolModuleDefinition, record?: SchoolRecord | null, initialCapability?: string | null): FormState {
  if (record) {
    const capability = record.capability || module.capabilities[record.capabilityIndex] || module.capabilities[0];
    return {
      capability,
      workflow: record.workflow,
      title: record.title,
      code: record.code,
      status: record.status,
      description: record.description || "",
      studentId: record.studentId || "none",
      classId: record.classId || "none",
      unitName: record.unitName || "",
      assigneeId: record.assigneeId || "none",
      audienceRole: record.audienceRoles?.[0] || "none",
      customData: record.customData || {},
      attachments: record.attachments || [],
    };
  }
  const capability = initialCapability && module.capabilities.includes(initialCapability) ? initialCapability : module.capabilities[0];
  const blueprint = capabilityBlueprint(module, capability);
  return {
    capability,
    workflow: blueprint.workflow,
    title: capability,
    code: makeProtocol(module.number),
    status: module.statuses[0] || "rascunho",
    description: "",
    studentId: "none",
    classId: "none",
    unitName: "",
    assigneeId: "none",
    audienceRole: "none",
    customData: {},
    attachments: [],
  };
}

function inputValue(value: string | number | boolean | undefined): string | number {
  return typeof value === "boolean" || value === undefined ? "" : value;
}

function formatPageDate(value?: string) {
  if (!value) return "Agora";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function DynamicField({
  definition,
  value,
  onChange,
}: {
  definition: SchoolFieldDefinition;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
}) {
  const id = `school-field-${definition.key}`;
  if (definition.kind === "checkbox") {
    return (
      <div className="school-form-checkbox">
        <Checkbox id={id} checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked === true)} />
        <div>
          <Label htmlFor={id}>{definition.label}</Label>
          {definition.help && <p>{definition.help}</p>}
        </div>
      </div>
    );
  }
  if (definition.kind === "textarea") {
    return (
      <div className="school-form-field school-form-field-wide">
        <Label htmlFor={id}>{definition.label}{definition.required ? " *" : ""}</Label>
        <Textarea id={id} value={String(value || "")} onChange={(event) => onChange(event.target.value)} placeholder={definition.placeholder} rows={3} />
        {definition.help && <p className="school-form-help">{definition.help}</p>}
      </div>
    );
  }
  if (definition.kind === "select") {
    return (
      <div className="school-form-field">
        <Label htmlFor={id}>{definition.label}{definition.required ? " *" : ""}</Label>
        <Select value={String(value || "none")} onValueChange={(next) => onChange(next === "none" ? "" : next)}>
          <SelectTrigger id={id}><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Não informado</SelectItem>
            {(definition.options || []).map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
          </SelectContent>
        </Select>
        {definition.help && <p className="school-form-help">{definition.help}</p>}
      </div>
    );
  }
  return (
    <div className="school-form-field">
      <Label htmlFor={id}>{definition.label}{definition.required ? " *" : ""}</Label>
      <Input
        id={id}
        type={definition.kind === "number" ? "number" : definition.kind}
        step={definition.kind === "number" ? "any" : undefined}
        value={inputValue(value)}
        onChange={(event) => onChange(definition.kind === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value)}
        placeholder={definition.placeholder}
      />
      {definition.help && <p className="school-form-help">{definition.help}</p>}
    </div>
  );
}

export function SchoolTaskPage({
  module,
  record,
  initialCapability,
  lockedCapability = false,
  actor,
  users = [],
  classes = [],
  onBack,
  onSaved,
}: SchoolTaskPageProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(() => defaultState(module, record, initialCapability));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const draftCapability = initialCapability && module.capabilities.includes(initialCapability) ? initialCapability : module.capabilities[0];
  const draftKey = `vestibulando:draft:${actor.uid}:${module.id}:${draftCapability}`;

  const students = useMemo(() => users.filter((user) => user.tipo === "aluno").sort((a, b) => a.nome.localeCompare(b.nome)), [users]);
  const assignees = useMemo(() => users.filter((user) => user.tipo !== "aluno").sort((a, b) => a.nome.localeCompare(b.nome)), [users]);
  const selectedStudent = students.find((user) => user.uid === form.studentId);
  const selectedClass = classes.find((item) => item.id === form.classId);
  const selectedAssignee = assignees.find((user) => user.uid === form.assigneeId);
  const blueprint = useMemo(() => capabilityBlueprint(module, form.capability || module.capabilities[0]), [module, form.capability]);
  const moduleFieldKeys = useMemo(() => new Set(module.fields.map((item) => item.key)), [module]);
  const capabilityFields = useMemo(() => blueprint.fields.filter((item) => !moduleFieldKeys.has(item.key)), [blueprint, moduleFieldKeys]);

  useEffect(() => {
    const initial = defaultState(module, record, initialCapability);
    if (!record) {
      try {
        const stored = localStorage.getItem(draftKey);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<FormState>;
          const restored = { ...initial, ...parsed, attachments: [] };
          if (initialCapability && module.capabilities.includes(initialCapability)) {
            const selectedBlueprint = capabilityBlueprint(module, initialCapability);
            restored.capability = initialCapability;
            restored.workflow = selectedBlueprint.workflow;
            restored.title = initialCapability;
          }
          setForm(restored);
          return;
        }
      } catch {
        localStorage.removeItem(draftKey);
      }
    }
    setForm(initial);
  }, [module.id, record?.id, initialCapability]);

  useEffect(() => {
    if (record) return;
    const timeout = window.setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({ ...form, attachments: [] }));
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [record?.id, form, draftKey]);

  const setCustomValue = (key: string, value: string | number | boolean) => {
    setForm((current) => ({ ...current, customData: { ...current.customData, [key]: value } }));
  };

  const handleAttachment = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const attachment = await uploadSchoolAttachment(file, module.id, actor, {
        audienceUserIds: [form.studentId, form.assigneeId].filter((value) => value && value !== "none"),
        audienceRoles: form.audienceRole && form.audienceRole !== "none" ? [form.audienceRole] : [],
        studentIds: form.studentId && form.studentId !== "none" ? [form.studentId] : [],
        classIds: form.classId && form.classId !== "none" ? [form.classId] : [],
        sensitive: module.restricted,
      });
      setForm((current) => ({ ...current, attachments: [...current.attachments, attachment] }));
      toast({ title: "Anexo enviado", description: file.name });
    } catch (error: any) {
      toast({ title: "Não foi possível anexar", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: SaveSchoolRecordInput = {
        id: record?.id,
        moduleId: module.id,
        capability: form.capability,
        workflow: form.workflow,
        title: form.title,
        code: form.code,
        status: form.status,
        description: form.description,
        studentId: form.studentId === "none" ? undefined : form.studentId,
        studentName: selectedStudent?.nome,
        classId: form.classId === "none" ? undefined : form.classId,
        className: selectedClass?.nome,
        unitName: form.unitName,
        assigneeId: form.assigneeId === "none" ? undefined : form.assigneeId,
        assigneeName: selectedAssignee?.nome,
        audienceUserIds: [selectedStudent?.uid, selectedAssignee?.uid].filter(Boolean) as string[],
        audienceRoles: form.audienceRole === "none" ? [] : [form.audienceRole],
        customData: form.customData,
        attachments: form.attachments,
      };
      const saved = await saveSchoolRecord(payload, actor);
      localStorage.removeItem(draftKey);
      onSaved(saved);
      toast({ title: record ? "Ação atualizada" : "Ação registrada", description: "Os dados foram salvos com sucesso." });
    } catch (error: any) {
      toast({ title: "Revise os dados", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="school-task-page" data-school-module={module.id} data-task-id={blueprint.id}>
      <button type="button" className="school-task-page-back" onClick={onBack}><ArrowLeft className="h-4 w-4" />Voltar para {module.shortTitle}</button>

      <header className="school-task-page-header">
        <div className="school-task-page-heading">
          <div className="school-task-page-id"><span>{String(module.number).padStart(2, "0")}</span><div><small>{module.shortTitle}</small><strong>{blueprint.id}</strong></div></div>
          <div><span className="school-task-page-eyebrow"><ClipboardList className="h-4 w-4" />{blueprint.workflow}</span><h1>{record ? `Editar: ${blueprint.title}` : blueprint.title}</h1><p>Esta é a página exclusiva desta ação. Preencha os dados abaixo; regras, protocolo, histórico e auditoria serão aplicados ao salvar.</p></div>
        </div>
        <div className="school-task-page-header-status"><span>{record ? "Registro existente" : "Nova ação"}</span><strong>{form.status}</strong></div>
      </header>

      <div className="school-task-page-layout">
        <main className="school-task-page-form">

        <div className="school-os-form-steps" aria-label="Etapas do preenchimento"><span className="is-active"><b>1</b>Identificação</span><i /><span><b>2</b>Dados da tarefa</span><i /><span><b>3</b>Anexos e conclusão</span></div>

        {lockedCapability && <div className="school-operation-dialog-context"><div><CheckCircle2 className="h-5 w-5" /><span><strong>Validações desta tarefa</strong><small>Aplicadas ao salvar</small></span></div><ul>{blueprint.automations.slice(0, 4).map((automation) => <li key={automation}>{automation}</li>)}</ul></div>}

        <div className="school-form-section-title">Informações principais</div>
        <div className="school-form-grid">
          {!lockedCapability && <div className="school-form-field">
            <Label htmlFor="school-capability">O que deseja registrar? *</Label>
            <Select value={form.capability} onValueChange={(capability) => setForm((current) => {
              const selectedBlueprint = capabilityBlueprint(module, capability);
              const replaceTitle = !current.title.trim() || current.title === current.workflow || current.title === current.capability;
              const acceptedFields = new Set([...module.fields, ...selectedBlueprint.fields].map((field) => field.key));
              const customData = Object.fromEntries(Object.entries(current.customData).filter(([key]) => acceptedFields.has(key)));
              return { ...current, workflow: selectedBlueprint.workflow, capability, title: replaceTitle ? capability : current.title, customData };
            })}>
              <SelectTrigger id="school-capability"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-80">{module.capabilities.map((capability) => <SelectItem key={capability} value={capability}>{capability}</SelectItem>)}</SelectContent>
            </Select>
            <p className="school-form-help">Etapa: {form.workflow}</p>
          </div>}
          <div className="school-form-field">
            <Label htmlFor="school-status">Status *</Label>
            <Select value={form.status} onValueChange={(status) => setForm((current) => ({ ...current, status }))}>
              <SelectTrigger id="school-status"><SelectValue /></SelectTrigger>
              <SelectContent>{module.statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="school-form-field school-form-field-wide">
            <Label htmlFor="school-title">Nome ou identificação *</Label>
            <Input id="school-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder={`Ex.: ${form.capability}`} autoFocus />
          </div>
          <div className="school-form-field">
            <Label htmlFor="school-code">Código/protocolo</Label>
            <Input id="school-code" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} />
          </div>
          <div className="school-form-field">
            <Label htmlFor="school-unit">Unidade</Label>
            <Input id="school-unit" value={form.unitName} onChange={(event) => setForm((current) => ({ ...current, unitName: event.target.value }))} placeholder="Matriz, polo ou campus" />
          </div>
          {students.length > 0 && (
            <div className="school-form-field">
              <Label htmlFor="school-student">Aluno relacionado</Label>
              <Select value={form.studentId} onValueChange={(studentId) => setForm((current) => ({ ...current, studentId }))}>
                <SelectTrigger id="school-student"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent><SelectItem value="none">Nenhum</SelectItem>{students.map((student) => <SelectItem key={student.uid} value={student.uid}>{student.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {classes.length > 0 && (
            <div className="school-form-field">
              <Label htmlFor="school-class">Turma relacionada</Label>
              <Select value={form.classId} onValueChange={(classId) => setForm((current) => ({ ...current, classId }))}>
                <SelectTrigger id="school-class"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent><SelectItem value="none">Nenhuma</SelectItem>{classes.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {assignees.length > 0 && (
            <div className="school-form-field">
              <Label htmlFor="school-assignee">Responsável pelo processo</Label>
              <Select value={form.assigneeId} onValueChange={(assigneeId) => setForm((current) => ({ ...current, assigneeId }))}>
                <SelectTrigger id="school-assignee"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent><SelectItem value="none">Não atribuído</SelectItem>{assignees.map((user) => <SelectItem key={user.uid} value={user.uid}>{user.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="school-form-field">
            <Label htmlFor="school-audience-role">Quem poderá acompanhar</Label>
            <Select value={form.audienceRole} onValueChange={(audienceRole) => setForm((current) => ({ ...current, audienceRole }))}>
              <SelectTrigger id="school-audience-role"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Somente envolvidos</SelectItem>{Object.entries(SCHOOL_ROLE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="school-form-field school-form-field-wide">
            <Label htmlFor="school-description">Observações</Label>
            <Textarea id="school-description" rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </div>
        </div>

        <div className="school-form-section-title">Dados do cadastro</div>
        <div className="school-form-grid">
          {module.fields.map((definition) => (
            <DynamicField key={definition.key} definition={definition} value={form.customData[definition.key]} onChange={(value) => setCustomValue(definition.key, value)} />
          ))}
        </div>

        {capabilityFields.length > 0 && <><div className="school-form-section-title">Informações complementares</div><div className="school-form-grid">{capabilityFields.map((definition) => <DynamicField key={definition.key} definition={definition} value={form.customData[definition.key]} onChange={(value) => setCustomValue(definition.key, value)} />)}</div></>}

        <div className="school-form-section-title">Anexos</div>
        <div className="school-attachment-zone">
          <label className="school-upload-button">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>{uploading ? "Enviando..." : "Adicionar arquivo (até 8 MB)"}</span>
            <input type="file" disabled={uploading} onChange={(event) => handleAttachment(event.target.files?.[0])} />
          </label>
          <div className="school-attachment-list">
            {form.attachments.map((attachment, index) => (
              <div key={`${attachment.url}-${index}`} className="school-attachment-item">
                <Paperclip className="h-4 w-4" />
                <button type="button" className="school-attachment-link" onClick={() => downloadSchoolAttachment(attachment).catch((error) => toast({ title: "Não foi possível abrir o anexo", description: error.message, variant: "destructive" }))}>{attachment.name}</button>
                <span>{Math.max(1, Math.round(attachment.size / 1024))} KB</span>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${attachment.name}`} onClick={() => setForm((current) => ({ ...current, attachments: current.attachments.filter((_, attachmentIndex) => attachmentIndex !== index) }))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {!form.attachments.length && <p>Nenhum anexo adicionado.</p>}
          </div>
        </div>

        </main>

        <aside className="school-task-page-aside">
          <div className="school-task-page-aside-card">
            <span className="school-task-page-aside-icon"><ShieldCheck className="h-5 w-5" /></span>
            <h2>O sistema cuidará disso</h2>
            <ul>{blueprint.automations.slice(0, 6).map((automation) => <li key={automation}><CheckCircle2 className="h-4 w-4" />{automation}</li>)}</ul>
          </div>
          <div className="school-task-page-summary">
            <div><span>Campos desta página</span><strong>{module.fields.length + capabilityFields.length}</strong></div>
            <div><span>Código/protocolo</span><strong>{form.code}</strong></div>
            <div><span>Anexos</span><strong>{form.attachments.length}</strong></div>
          </div>
          {record && <div className="school-task-page-history"><h2>Histórico do registro</h2><div className="school-task-page-history-current"><span>Atualizado por {record.updatedByName}</span><strong>{formatPageDate(record.updatedAt)}</strong></div>{[...(record.versions || [])].reverse().slice(0, 4).map((version, index) => <div key={`${version.at}-${index}`}><span>{version.action || "Alteração registrada"}</span><small>{version.byName} · {formatPageDate(version.at)}</small></div>)}</div>}
          <div className="school-task-page-actions">
            <Button onClick={handleSave} disabled={saving || uploading || !form.title.trim() || !form.capability}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {record ? "Salvar alterações" : "Salvar ação"}
            </Button>
            <Button variant="outline" onClick={onBack}>Voltar sem salvar</Button>
          </div>
        </aside>
      </div>
    </section>
  );
}
