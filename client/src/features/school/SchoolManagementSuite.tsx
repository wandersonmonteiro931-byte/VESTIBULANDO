import { useMemo, useRef, useState } from "react";
import { where } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Activity,
  Archive,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  DatabaseBackup,
  Download,
  Eye,
  FileDown,
  FileJson,
  FileSpreadsheet,
  Filter,
  FolderCog,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  MoreHorizontal,
  PackageOpen,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserPlus,
  UsersRound,
} from "lucide-react";
import type { ElementType } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  SCHOOL_CATEGORIES,
  SCHOOL_MODULES,
  SCHOOL_MODULE_BY_ID,
  SCHOOL_ROLE_LABELS,
  canAccessModule,
  canWriteModule,
  resolveSchoolRole,
  type ModuleCategory,
  type SchoolModuleDefinition,
  type SchoolRole,
} from "./schoolCatalog";
import {
  createSchoolBackup,
  downloadFile,
  exportRecordsCsv,
  importSchoolBackup,
  restoreSchoolRecord,
  softDeleteSchoolRecord,
  type SchoolActor,
  type SchoolRecord,
} from "./schoolData";
import { SchoolAccountDialog } from "./SchoolAccountDialog";
import { SchoolRecordDetails } from "./SchoolRecordDetails";
import { SchoolRecordDialog } from "./SchoolRecordDialog";
import { IntegrationOperationsPanel } from "./GovernancePanels";
import { CapabilityWorkspace, OperationalModuleWorkspace, hasOperationalModuleWorkspace } from "./OperationalModuleWorkspace";

const categoryIcons: Record<ModuleCategory, ElementType> = {
  fundacao: FolderCog,
  academico: GraduationCap,
  portais: UsersRound,
  cuidado: HeartHandshake,
  administracao: BarChart3,
  governanca: ShieldCheck,
};

const privilegedRoles: SchoolRole[] = ["diretor", "administrador"];
const staffRoles: SchoolRole[] = ["diretor", "administrador", "secretaria", "coordenador", "financeiro", "bibliotecario", "psicologo", "inspetor", "funcionario", "rh", "cantina", "transporte"];

const moduleCreateLabels: Record<string, string> = {
  instituicao: "Nova configuração",
  acessos: "Novo acesso",
  alunos: "Cadastrar aluno",
  responsaveis: "Vincular responsável",
  matriculas: "Nova matrícula",
  "estrutura-academica": "Novo cadastro acadêmico",
  "calendario-horarios": "Novo evento ou horário",
  "diario-planejamento": "Novo planejamento",
  frequencia: "Registrar frequência",
  atividades: "Criar atividade",
  avaliacoes: "Criar avaliação",
  "notas-boletim": "Lançar nota ou resultado",
  acompanhamento: "Novo acompanhamento",
  conteudos: "Adicionar conteúdo",
  "aulas-ao-vivo": "Agendar aula",
  "documentos-escolares": "Emitir documento",
  "portal-aluno": "Nova configuração do aluno",
  "portal-professor": "Nova configuração docente",
  "portal-responsaveis": "Nova configuração familiar",
  comunicacao: "Novo comunicado",
  "bem-estar": "Novo atendimento ou ocorrência",
  inclusao: "Novo atendimento especializado",
  financeiro: "Novo lançamento financeiro",
  secretaria: "Abrir protocolo",
  relatorios: "Criar relatório",
  operacoes: "Novo registro administrativo",
  "lgpd-seguranca": "Novo registro de privacidade",
  acessibilidade: "Nova configuração acessível",
  integracoes: "Nova integração",
  continuidade: "Novo procedimento de backup",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (/aprov|conclu|emitid|pago|valid|saud|regular|ativo|publicad|homolog/.test(normalized)) return "success";
  if (/cancel|recus|reprov|falh|vencid|bloque|indefer|crítico|critico/.test(normalized)) return "danger";
  if (/pend|análise|analise|rascunho|abert|aguard|risco|atras|triagem|revis/.test(normalized)) return "warning";
  return "neutral";
}

function isPendingStatus(status: string) {
  return /pend|análise|analise|rascunho|abert|aguard|risco|atras|triagem|revis|em /.test(status.toLowerCase());
}

function isCompletedStatus(status: string) {
  return /aprov|conclu|emitid|pago|valid|saud|regular|publicad|homolog|encerrad|fechad/.test(status.toLowerCase());
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character] || character));
}

function exportExcel(records: SchoolRecord[]) {
  const headers = ["Setor", "Tipo de cadastro", "Etapa", "Código", "Nome ou identificação", "Status", "Aluno", "Turma", "Unidade", "Responsável", "Atualizado em"];
  const rows = records.map((record) => [SCHOOL_MODULE_BY_ID[record.moduleId]?.title || record.moduleId, record.capability || record.workflow, record.workflow, record.code, record.title, record.status, record.studentName, record.className, record.unitName, record.assigneeName, record.updatedAt]);
  const table = `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  downloadFile(`vestibulando-registros-${new Date().toISOString().slice(0, 10)}.xls`, `\uFEFF<html><head><meta charset="UTF-8"></head><body>${table}</body></html>`, "application/vnd.ms-excel;charset=utf-8");
}

function exportPdf(records: SchoolRecord[], module?: SchoolModuleDefinition) {
  const pdf = new jsPDF({ orientation: "landscape" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text(module ? `Vestibulando · ${module.title}` : "Vestibulando · Relatório escolar", 14, 16);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Gerado em ${new Date().toLocaleString("pt-BR")} · ${records.length} registro(s)`, 14, 22);
  autoTable(pdf, {
    startY: 28,
    head: [["Setor", "Tipo de cadastro", "Código/título", "Status", "Aluno/turma", "Responsável", "Atualização"]],
    body: records.map((record) => [SCHOOL_MODULE_BY_ID[record.moduleId]?.shortTitle || record.moduleId, record.capability || record.workflow, `${record.code}\n${record.title}`, record.status, [record.studentName, record.className].filter(Boolean).join(" · ") || "—", record.assigneeName || "—", formatDate(record.updatedAt)]),
    styles: { fontSize: 7.5, cellPadding: 2.2 },
    headStyles: { fillColor: [33, 82, 142] },
  });
  pdf.save(`vestibulando-${module?.id || "relatorio"}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

interface ModuleNavigatorProps {
  modules: SchoolModuleDefinition[];
  selectedId: string;
  search: string;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  counts: Record<string, number>;
}

function ModuleNavigator({ modules, selectedId, search, onSearch, onSelect, counts }: ModuleNavigatorProps) {
  return (
    <aside className="school-module-nav" aria-label="Módulos do sistema escolar">
      <div className="school-module-search"><Search className="h-4 w-4" /><Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar módulo ou função..." aria-label="Buscar módulo" /></div>
      <div className="school-module-groups">
        {SCHOOL_CATEGORIES.map((category) => {
          const categoryModules = modules.filter((module) => module.category === category.id);
          if (!categoryModules.length) return null;
          const Icon = categoryIcons[category.id];
          return (
            <section key={category.id} className="school-module-group">
              <div className="school-module-group-heading"><Icon className="h-4 w-4" /><span>{category.label}</span></div>
              {categoryModules.map((module) => (
                <button key={module.id} type="button" className={cn("school-module-link", selectedId === module.id && "is-active")} onClick={() => onSelect(module.id)}>
                  <span className="school-module-number">{String(module.number).padStart(2, "0")}</span>
                  <span className="school-module-link-copy"><strong>{module.shortTitle}</strong><small>Abrir setor</small></span>
                  {counts[module.id] > 0 && <span className="school-module-count">{counts[module.id]}</span>}
                  <ChevronRight className="h-4 w-4" />
                </button>
              ))}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

function AnalyticsPanel({ records }: { records: SchoolRecord[] }) {
  const byModule = useMemo(() => SCHOOL_MODULES.map((module) => ({ module, total: records.filter((record) => record.moduleId === module.id && !record.deletedAt).length })).filter((item) => item.total > 0).sort((a, b) => b.total - a.total).slice(0, 10), [records]);
  const max = Math.max(1, ...byModule.map((item) => item.total));
  const active = records.filter((record) => !record.deletedAt);
  const pending = active.filter((record) => isPendingStatus(record.status)).length;
  const complete = active.filter((record) => isCompletedStatus(record.status)).length;
  const overdue = active.filter((record) => {
    const due = String(record.customData?.prazo || record.customData?.vencimento || "");
    return due && new Date(due).getTime() < Date.now() && !isCompletedStatus(record.status);
  }).length;
  const atRisk = active.filter((record) => Boolean(record.customData?.riscoAutomatico) || (record.moduleId === "frequencia" && Number(record.customData?.percentual) < Number(record.customData?.frequenciaMinima || 75)) || /risco|evasão|evasao/.test(record.status.toLocaleLowerCase("pt-BR"))).length;
  return (
    <div className="school-analytics-panel">
      <div className="school-analytics-cards">
        <div><span>Registros ativos</span><strong>{active.length}</strong><Activity className="h-5 w-5" /></div>
        <div><span>Pendências</span><strong>{pending}</strong><ClipboardCheck className="h-5 w-5" /></div>
        <div><span>Concluídos</span><strong>{complete}</strong><CheckCircle2 className="h-5 w-5" /></div>
        <div><span>Prazos vencidos</span><strong>{overdue}</strong><RefreshCw className="h-5 w-5" /></div>
        <div><span>Alunos em risco</span><strong>{atRisk}</strong><HeartHandshake className="h-5 w-5" /></div>
      </div>
      <div className="school-chart-card"><div className="school-chart-heading"><div><h4>Volume por módulo</h4><p>Dez áreas com maior movimentação no recorte acessível.</p></div><BarChart3 className="h-5 w-5" /></div><div className="school-bars">{byModule.map(({ module, total }) => <div key={module.id} className="school-bar-row"><span>{module.shortTitle}</span><div><i style={{ width: `${Math.max(5, (total / max) * 100)}%` }} /></div><b>{total}</b></div>)}{!byModule.length && <div className="school-empty-inline">Os indicadores aparecerão após os primeiros registros.</div>}</div></div>
    </div>
  );
}

function DataContinuityPanel({ records, auditLogs, backups, backupTests, actor, canRestore }: { records: SchoolRecord[]; auditLogs: any[]; backups: any[]; backupTests: any[]; actor: SchoolActor; canRestore: boolean }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);
  const [progress, setProgress] = useState("");
  const latestBackup = [...backups].sort((a, b) => String(b.exportedAt).localeCompare(String(a.exportedAt)))[0];
  const latestTest = [...backupTests].sort((a, b) => String(b.testedAt).localeCompare(String(a.testedAt)))[0];
  const exportBackup = () => {
    const payload = createSchoolBackup(records, auditLogs);
    downloadFile(`vestibulando-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, JSON.stringify(payload, null, 2), "application/json");
    toast({ title: "Backup exportado", description: `${records.length} registros e ${auditLogs.length} eventos de auditoria.` });
  };
  const restore = async (file?: File) => {
    if (!file) return;
    setRestoring(true);
    try {
      const payload = JSON.parse(await file.text());
      const total = Array.isArray(payload.records) ? payload.records.length : 0;
      const restored = await importSchoolBackup(payload, actor, (current) => setProgress(`${current}/${total}`));
      toast({ title: "Restauração concluída", description: `${restored} registros foram conferidos e restaurados.` });
    } catch (error: any) {
      toast({ title: "Falha na restauração", description: error.message, variant: "destructive" });
    } finally {
      setRestoring(false);
      setProgress("");
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  return (
    <div className="school-continuity-panel">
      <div className="school-continuity-card"><DatabaseBackup className="h-7 w-7" /><div><h4>Exportação completa</h4><p>Gera um pacote JSON versionado com registros, lixeira, anexos referenciados e trilha de auditoria disponível.</p></div><Button onClick={exportBackup}><Download className="mr-2 h-4 w-4" />Exportar backup</Button></div>
      <div className="school-continuity-card"><RotateCcw className="h-7 w-7" /><div><h4>Restauração validada</h4><p>Importa somente o formato oficial, preserva identificadores e registra cada lote na auditoria.</p></div><Button variant="outline" disabled={!canRestore || restoring} onClick={() => inputRef.current?.click()}>{restoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{restoring ? `Restaurando ${progress}` : "Selecionar backup"}</Button><input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={(event) => restore(event.target.files?.[0])} /></div>
      <div className="school-continuity-card"><ShieldCheck className="h-7 w-7" /><div><h4>Backup automático sem Storage</h4><p>{latestBackup ? `Último: ${new Date(latestBackup.exportedAt).toLocaleString("pt-BR")} · ${latestBackup.status} · hash ${String(latestBackup.integrityHash || "").slice(0, 12)}…` : "Ainda não há execução registrada. Agende o endpoint diário com CRON_SECRET."}{latestTest ? ` Teste de recuperação: ${latestTest.valid ? "válido" : "falhou"} em ${new Date(latestTest.testedAt).toLocaleDateString("pt-BR")}.` : ""}</p></div><Badge variant={latestBackup?.status === "completed" ? "default" : "secondary"}>{latestBackup?.status === "completed" ? "Protegido" : "Aguardando"}</Badge></div>
      <div className="school-continuity-note"><LockKeyhole className="h-4 w-4" /><p>O endpoint <code>/api/v1/cron/daily-backup</code> grava o JSON gzip em blocos protegidos no Firestore e calcula SHA-256; <code>/api/v1/cron/verify-latest-backup</code> recompõe os blocos, testa integridade e descompressão. Nenhum bucket é necessário.</p></div>
    </div>
  );
}

export function SchoolManagementSuite({ initialModuleId, focused = false }: { initialModuleId?: string; focused?: boolean } = {}) {
  const { userData } = useAuth();
  const { toast } = useToast();
  const role = resolveSchoolRole(userData as any);
  const explicitPermissions = ((userData as any)?.permissoes || []) as string[];
  const isPrivileged = privilegedRoles.includes(role);
  const isStaff = staffRoles.includes(role);
  const isEducator = ["professor", "professor_substituto", "monitor"].includes(role);
  const canUsePrivateNotes = isStaff || isEducator;
  const actor: SchoolActor = { uid: userData?.uid || "", name: userData?.nome || "Usuário", role };
  const accessibleModules = useMemo(() => SCHOOL_MODULES.filter((module) => canAccessModule(role, module.id, explicitPermissions)), [role, explicitPermissions.join("|")]);
  const [selectedModuleId, setSelectedModuleId] = useState(
    initialModuleId && accessibleModules.some((module) => module.id === initialModuleId)
      ? initialModuleId
      : accessibleModules[0]?.id || "portal-aluno",
  );
  const [moduleSearch, setModuleSearch] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [capabilityFilter, setCapabilityFilter] = useState("all");
  const [showTrash, setShowTrash] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SchoolRecord | null>(null);
  const [initialCapability, setInitialCapability] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<SchoolRecord | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<SchoolRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: allRecords = [], isLoading: loadingAll } = useRealtimeQuery<SchoolRecord>({ collectionName: "schoolRecords", queryKey: ["/school/records/all", role], enabled: isPrivileged });
  const { data: personalRecords = [], isLoading: loadingPersonal } = useRealtimeQuery<SchoolRecord>({ collectionName: "schoolRecords", queryKey: ["/school/records/user", userData?.uid], constraints: userData?.uid ? [where("audienceUserIds", "array-contains", userData.uid)] : [], enabled: Boolean(userData?.uid && !isPrivileged) });
  const { data: roleRecords = [], isLoading: loadingRole } = useRealtimeQuery<SchoolRecord>({ collectionName: "schoolRecords", queryKey: ["/school/records/role", role], constraints: [where("audienceRoles", "array-contains", role)], enabled: !isPrivileged });
  const { data: users = [] } = useRealtimeQuery<any>({ collectionName: "usuarios", queryKey: ["/school/directory/users", role], enabled: isStaff || isEducator });
  const { data: classes = [] } = useRealtimeQuery<any>({ collectionName: "turmas", queryKey: ["/school/directory/classes"] });
  const { data: auditLogs = [] } = useRealtimeQuery<any>({ collectionName: "schoolAuditLogs", queryKey: ["/school/audit/all"], enabled: isPrivileged });
  const { data: backups = [] } = useRealtimeQuery<any>({ collectionName: "schoolBackups", queryKey: ["/school/backups"], enabled: isPrivileged });
  const { data: backupTests = [] } = useRealtimeQuery<any>({ collectionName: "schoolBackupTests", queryKey: ["/school/backup-tests"], enabled: isPrivileged });

  const records = useMemo(() => {
    const source = isPrivileged ? allRecords : [...personalRecords, ...roleRecords];
    const map = new Map<string, SchoolRecord>();
    source.forEach((record) => map.set(record.id, record));
    return Array.from(map.values()).filter((record) => canAccessModule(role, record.moduleId, explicitPermissions));
  }, [isPrivileged, allRecords, personalRecords, roleRecords, role, explicitPermissions.join("|")]);
  const loading = isPrivileged ? loadingAll : loadingPersonal || loadingRole;
  const counts = useMemo(() => records.reduce<Record<string, number>>((result, record) => { if (!record.deletedAt) result[record.moduleId] = (result[record.moduleId] || 0) + 1; return result; }, {}), [records]);
  const normalizedModuleSearch = moduleSearch.trim().toLocaleLowerCase("pt-BR");
  const filteredModules = accessibleModules.filter((module) => !normalizedModuleSearch || `${module.title} ${module.description} ${module.workflows.join(" ")} ${module.capabilities.join(" ")}`.toLocaleLowerCase("pt-BR").includes(normalizedModuleSearch));
  const selectedModule = SCHOOL_MODULE_BY_ID[selectedModuleId] || filteredModules[0] || accessibleModules[0];
  const canWrite = selectedModule ? canWriteModule(role, selectedModule.id, explicitPermissions) : false;
  const writableModules = useMemo(() => accessibleModules.filter((module) => canWriteModule(role, module.id, explicitPermissions)), [accessibleModules, role, explicitPermissions.join("|")]);
  const moduleRecords = useMemo(() => records.filter((record) => record.moduleId === selectedModule?.id), [records, selectedModule?.id]);
  const filteredRecords = useMemo(() => {
    const normalized = recordSearch.trim().toLocaleLowerCase("pt-BR");
    return moduleRecords.filter((record) => {
      const trashMatches = showTrash ? Boolean(record.deletedAt) : !record.deletedAt;
      const statusMatches = statusFilter === "all" || record.status === statusFilter;
      const capabilityMatches = capabilityFilter === "all" || record.capability === capabilityFilter;
      const searchMatches = !normalized || `${record.code} ${record.title} ${record.capability || ""} ${record.workflow} ${record.status} ${record.studentName || ""} ${record.className || ""} ${record.assigneeName || ""}`.toLocaleLowerCase("pt-BR").includes(normalized);
      return trashMatches && statusMatches && capabilityMatches && searchMatches;
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [moduleRecords, recordSearch, showTrash, statusFilter, capabilityFilter, selectedModule]);

  if (!selectedModule) return <div className="school-empty-state"><LockKeyhole className="h-10 w-10" /><h3>Nenhum módulo liberado</h3><p>Solicite à direção uma permissão individual de acesso.</p></div>;

  const openNewRecord = (capability?: string) => { setEditingRecord(null); setInitialCapability(capability || selectedModule.capabilities[0]); setFormOpen(true); };
  const openEdit = (record: SchoolRecord) => { setDetailsOpen(false); setEditingRecord(record); setInitialCapability(record.capability || selectedModule.capabilities[record.capabilityIndex] || selectedModule.capabilities[0]); setFormOpen(true); };
  const openDetails = (record: SchoolRecord) => { setSelectedRecord(record); setDetailsOpen(true); };
  const handleDelete = async () => {
    if (!deleteRecord) return;
    setDeleting(true);
    try {
      await softDeleteSchoolRecord(deleteRecord, actor);
      toast({ title: "Registro movido para a lixeira", description: "Ele poderá ser restaurado durante o prazo de retenção." });
      setDeleteRecord(null);
      setDetailsOpen(false);
    } catch (error: any) {
      toast({ title: "Erro ao arquivar", description: error.message, variant: "destructive" });
    } finally { setDeleting(false); }
  };
  const handleRestore = async (record: SchoolRecord) => {
    try { await restoreSchoolRecord(record, actor); toast({ title: "Registro restaurado", description: `${record.code} voltou à lista ativa.` }); setDetailsOpen(false); }
    catch (error: any) { toast({ title: "Erro ao restaurar", description: error.message, variant: "destructive" }); }
  };
  const downloadCsv = () => downloadFile(`vestibulando-${selectedModule.id}.csv`, exportRecordsCsv(filteredRecords), "text/csv;charset=utf-8");

  const activeModuleRecords = moduleRecords.filter((record) => !record.deletedAt);
  const pendingCount = activeModuleRecords.filter((record) => isPendingStatus(record.status)).length;
  const completedCount = activeModuleRecords.filter((record) => isCompletedStatus(record.status)).length;
  const createLabel = moduleCreateLabels[selectedModule.id] || "Novo cadastro";
  const hasOperationalWorkspace = hasOperationalModuleWorkspace(selectedModule.id);
  const hasSuiteWorkspace = ["relatorios", "continuidade", "integracoes"].includes(selectedModule.id);
  const isDedicatedWorkspace = hasOperationalWorkspace || hasSuiteWorkspace;

  return (
    <div className="school-suite">
      <div className={cn("school-suite-layout", focused && "is-focused")}>
        {!focused && <ModuleNavigator modules={filteredModules} selectedId={selectedModule.id} search={moduleSearch} onSearch={setModuleSearch} onSelect={(id) => { setSelectedModuleId(id); setStatusFilter("all"); setCapabilityFilter("all"); setRecordSearch(""); setShowTrash(false); }} counts={counts} />}

        <main className="school-module-workspace">
          <div className="school-module-hero">
            <div className="school-module-title-row"><span className="school-module-hero-number">{String(selectedModule.number).padStart(2, "0")}</span><div><div className="school-module-label">{SCHOOL_CATEGORIES.find((category) => category.id === selectedModule.category)?.label}</div><h3>{selectedModule.title}</h3><p>{selectedModule.description}</p></div></div>
            <div className="school-module-actions">
              {selectedModule.id === "acessos" && isPrivileged && <Button variant="outline" onClick={() => setAccountOpen(true)}><UserPlus className="mr-2 h-4 w-4" />Criar conta</Button>}
              {canWrite && !isDedicatedWorkspace && <Button onClick={() => openNewRecord()}><Plus className="mr-2 h-4 w-4" />{createLabel}</Button>}
            </div>
          </div>

          {hasOperationalWorkspace && <OperationalModuleWorkspace module={selectedModule} role={role} actor={actor} user={userData} users={users} classes={classes} records={moduleRecords} allRecords={records} canWrite={canWrite} onCreate={openNewRecord} onView={openDetails} />}
          {selectedModule.id === "relatorios" && <AnalyticsPanel records={records} />}
          {selectedModule.id === "continuidade" && <DataContinuityPanel records={records} auditLogs={auditLogs} backups={backups} backupTests={backupTests} actor={actor} canRestore={isPrivileged} />}
          {selectedModule.id === "integracoes" && <IntegrationOperationsPanel modules={writableModules} records={records} actor={actor} canImport={canWrite} />}
          {hasSuiteWorkspace && <CapabilityWorkspace module={selectedModule} records={moduleRecords} canWrite={canWrite} onCreate={openNewRecord} onView={openDetails} compact />}

          {!isDedicatedWorkspace && <><div className="school-module-kpis">
            <div><span>Cadastros ativos</span><strong>{activeModuleRecords.length}</strong><PackageOpen className="h-5 w-5" /></div>
            <div><span>Pendentes/em curso</span><strong>{pendingCount}</strong><Activity className="h-5 w-5" /></div>
            <div><span>Concluídos</span><strong>{completedCount}</strong><CheckCircle2 className="h-5 w-5" /></div>
            <div><span>Arquivados</span><strong>{moduleRecords.filter((record) => record.deletedAt).length}</strong><Archive className="h-5 w-5" /></div>
          </div>

          <Card className="school-records-card">
            <CardContent className="p-0">
              <div className="school-record-toolbar">
                <div className="school-record-search"><Search className="h-4 w-4" /><Input value={recordSearch} onChange={(event) => setRecordSearch(event.target.value)} placeholder="Pesquisar código, título, aluno, turma..." aria-label="Pesquisar registros" /></div>
                <div className="school-record-filters"><Select value={capabilityFilter} onValueChange={setCapabilityFilter}><SelectTrigger className="school-capability-filter" aria-label="Filtrar por tipo"><BookOpenCheck className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger><SelectContent className="max-h-80"><SelectItem value="all">Todos os tipos</SelectItem>{selectedModule.capabilities.map((capability) => <SelectItem key={capability} value={capability}>{capability}</SelectItem>)}</SelectContent></Select><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger aria-label="Filtrar por status"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{selectedModule.statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select><label className="school-trash-toggle"><Switch checked={showTrash} onCheckedChange={setShowTrash} /><span>Arquivados</span></label><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Exportar"><Download className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={downloadCsv}><FileDown className="mr-2 h-4 w-4" />CSV</DropdownMenuItem><DropdownMenuItem onClick={() => exportExcel(filteredRecords)}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</DropdownMenuItem><DropdownMenuItem onClick={() => exportPdf(filteredRecords, selectedModule)}><FileJson className="mr-2 h-4 w-4" />PDF</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
              </div>

              {loading ? <div className="school-record-loading">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div> : filteredRecords.length ? (
                <div className="school-record-table-wrap"><Table><TableHeader><TableRow><TableHead>Cadastro</TableHead><TableHead>Aluno ou turma</TableHead><TableHead>Responsável</TableHead><TableHead>Status</TableHead><TableHead>Atualização</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{filteredRecords.map((record) => <TableRow key={record.id} className="school-record-row" onDoubleClick={() => openDetails(record)}><TableCell><div className="school-record-primary"><span>{record.code}</span><strong>{record.title}</strong><small>{record.capability || record.workflow}</small></div></TableCell><TableCell><div className="school-record-related"><strong>{record.studentName || record.className || "—"}</strong>{record.studentName && record.className && <span>{record.className}</span>}</div></TableCell><TableCell>{record.assigneeName || "Não atribuído"}</TableCell><TableCell><span className={`school-table-status tone-${statusTone(record.status)}`}>{record.deletedAt ? "arquivado" : record.status}</span></TableCell><TableCell><div className="school-record-date"><strong>{formatDate(record.updatedAt)}</strong><span>{record.updatedByName}</span></div></TableCell><TableCell><div className="school-row-actions"><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => openDetails(record)}><Eye className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Ver detalhes e histórico</TooltipContent></Tooltip>{canWrite && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{record.deletedAt ? <DropdownMenuItem onClick={() => handleRestore(record)}><RotateCcw className="mr-2 h-4 w-4" />Restaurar</DropdownMenuItem> : <><DropdownMenuItem onClick={() => openEdit(record)}><Settings2 className="mr-2 h-4 w-4" />Editar</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={() => setDeleteRecord(record)}><Trash2 className="mr-2 h-4 w-4" />Arquivar</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu>}</div></TableCell></TableRow>)}</TableBody></Table></div>
              ) : <div className="school-empty-state"><PackageOpen className="h-10 w-10" /><h3>{showTrash ? "Nenhum item arquivado" : "Nenhum cadastro encontrado"}</h3><p>{recordSearch || statusFilter !== "all" || capabilityFilter !== "all" ? "Ajuste os filtros para ampliar a busca." : canWrite ? `Use o botão “${createLabel}” para começar.` : "Ainda não há dados compartilhados com seu perfil."}</p>{canWrite && !showTrash && !recordSearch && <Button onClick={() => openNewRecord()}><Plus className="mr-2 h-4 w-4" />{createLabel}</Button>}</div>}
            </CardContent>
          </Card></>}
        </main>
      </div>

      <SchoolRecordDialog open={formOpen} module={selectedModule} record={editingRecord} initialCapability={initialCapability} lockedCapability={Boolean(initialCapability) && !editingRecord && isDedicatedWorkspace} actor={actor} users={users} classes={classes} onOpenChange={(open) => { setFormOpen(open); if (!open) setInitialCapability(null); }} onSaved={(record) => { setSelectedRecord(record); setDetailsOpen(true); }} />
      <SchoolRecordDetails open={detailsOpen} record={selectedRecord} module={selectedRecord ? SCHOOL_MODULE_BY_ID[selectedRecord.moduleId] || selectedModule : selectedModule} actor={actor} canWrite={selectedRecord ? canWriteModule(role, selectedRecord.moduleId, explicitPermissions) : canWrite} isStaff={canUsePrivateNotes} onOpenChange={setDetailsOpen} onEdit={openEdit} onDelete={(record) => setDeleteRecord(record)} onRestore={handleRestore} />
      <SchoolAccountDialog open={accountOpen} actor={actor} students={users.filter((user: any) => user.tipo === "aluno")} onOpenChange={setAccountOpen} />
      <AlertDialog open={Boolean(deleteRecord)} onOpenChange={(open) => !open && setDeleteRecord(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Arquivar este cadastro?</AlertDialogTitle><AlertDialogDescription>Ele sairá da lista principal, ficará guardado por 90 dias e poderá ser restaurado.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={handleDelete} disabled={deleting}>{deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Arquivar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
