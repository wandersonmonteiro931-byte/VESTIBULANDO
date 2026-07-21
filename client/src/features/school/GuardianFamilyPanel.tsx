import { useEffect, useMemo, useState } from "react";
import { where } from "firebase/firestore";
import { AlertTriangle, BookOpenCheck, CalendarCheck, CheckCircle2, Clock3, FileText, Loader2, MessageSquareText, Paperclip, Receipt, ShieldCheck, Upload, UsersRound, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useToast } from "@/hooks/use-toast";
import { saveSchoolRecord, uploadSchoolAttachment, type SchoolActor, type SchoolAttachment, type SchoolRecord } from "./schoolData";
import { SCHOOL_MODULE_BY_ID } from "./schoolCatalog";

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const GUARDIAN_RECORD_PERMISSION: Record<string, string> = {
  responsaveis: "academic.view", matriculas: "academic.view", "calendario-horarios": "academic.view",
  frequencia: "attendance.view", atividades: "academic.view", avaliacoes: "academic.view",
  "notas-boletim": "academic.view", acompanhamento: "academic.view", conteudos: "academic.view",
  "aulas-ao-vivo": "academic.view", "documentos-escolares": "documents.sign", "portal-aluno": "academic.view",
  "portal-responsaveis": "academic.view", comunicacao: "communications.receive", "bem-estar": "discipline.view",
  financeiro: "finance.view", secretaria: "academic.view",
};

export function GuardianFamilyPanel() {
  const { userData } = useAuth();
  const { toast } = useToast();
  const actor: SchoolActor = { uid: userData?.uid || "", name: userData?.nome || "Responsável", role: "responsavel" };
  const { data: links = [], isLoading: loadingLinks } = useRealtimeQuery<any>({ collectionName: "guardianLinks", queryKey: ["/guardian/links", userData?.uid], constraints: userData?.uid ? [where("guardianId", "==", userData.uid), where("active", "==", true)] : [], enabled: Boolean(userData?.uid) });
  const { data: sharedRecords = [] } = useRealtimeQuery<SchoolRecord>({ collectionName: "schoolRecords", queryKey: ["/guardian/school-records", userData?.uid], constraints: userData?.uid ? [where("audienceUserIds", "array-contains", userData.uid)] : [], enabled: Boolean(userData?.uid) });
  const [studentId, setStudentId] = useState("");
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [absenceDate, setAbsenceDate] = useState("");
  const [absenceReason, setAbsenceReason] = useState("");
  const [absenceAttachment, setAbsenceAttachment] = useState<SchoolAttachment | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!studentId && links[0]?.studentId) setStudentId(links[0].studentId); }, [links, studentId]);
  const selectedLink = links.find((link) => link.studentId === studentId);
  const linkPermissions: string[] = Array.isArray(selectedLink?.permissions) ? selectedLink.permissions : [];
  const can = (permission: string) => linkPermissions.includes("*") || linkPermissions.includes(permission);
  const canViewAcademic = can("academic.view");
  const canViewAttendance = can("attendance.view");
  const canViewFinance = can("finance.view");
  const canViewDiscipline = can("discipline.view");
  const canonicalRecords = useMemo(() => sharedRecords.filter((record) => {
    if (record.deletedAt || record.studentId !== studentId) return false;
    const requiredPermission = GUARDIAN_RECORD_PERMISSION[record.moduleId];
    return Boolean(requiredPermission && can(requiredPermission));
  }).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))), [sharedRecords, studentId, linkPermissions.join("|")]);
  const { data: students = [] } = useRealtimeQuery<any>({ collectionName: "usuarios", queryKey: ["/guardian/student", studentId], constraints: studentId ? [where("uid", "==", studentId)] : [], enabled: Boolean(studentId) });
  const student = students[0];
  const { data: attendance = [] } = useRealtimeQuery<any>({ collectionName: "registrosPresencaChamada", queryKey: ["/guardian/attendance", studentId], constraints: studentId ? [where("alunoId", "==", studentId)] : [], enabled: Boolean(studentId && canViewAttendance) });
  const { data: reportCards = [] } = useRealtimeQuery<any>({ collectionName: "boletins", queryKey: ["/guardian/report-cards", studentId], constraints: studentId ? [where("alunoId", "==", studentId)] : [], enabled: Boolean(studentId && canViewAcademic) });
  const { data: invoices = [] } = useRealtimeQuery<any>({ collectionName: "financialInvoices", queryKey: ["/guardian/invoices", studentId], constraints: studentId ? [where("alunoId", "==", studentId)] : [], enabled: Boolean(studentId && canViewFinance) });
  const { data: occurrences = [] } = useRealtimeQuery<any>({ collectionName: "disciplinaryActions", queryKey: ["/guardian/occurrences", studentId], constraints: studentId ? [where("alunoId", "==", studentId)] : [], enabled: Boolean(studentId && canViewDiscipline) });
  const { data: tasks = [] } = useRealtimeQuery<any>({ collectionName: "tarefas", queryKey: ["/guardian/tasks", student?.turma], constraints: student?.turma ? [where("turma", "==", student.turma)] : [], enabled: Boolean(student?.turma && canViewAcademic) });
  const { data: submissions = [] } = useRealtimeQuery<any>({ collectionName: "entregas", queryKey: ["/guardian/submissions", studentId], constraints: studentId ? [where("alunoId", "==", studentId)] : [], enabled: Boolean(studentId && canViewAcademic) });

  const stats = useMemo(() => {
    const present = attendance.filter((item) => item.status === "presente" || item.status === "justificado").length;
    const absent = attendance.filter((item) => item.status === "ausente").length;
    const final = present + absent;
    const latestFrequency = canonicalRecords.find((record) => record.moduleId === "frequencia" && Number.isFinite(Number(record.customData?.percentual)));
    const frequency = final ? Math.round((present / final) * 100) : Math.round(Number(latestFrequency?.customData?.percentual || 0));
    const submittedIds = new Set(submissions.map((entry) => entry.tarefaId));
    const canonicalPendingTasks = canonicalRecords.filter((record) => record.moduleId === "atividades" && !/entregue|avaliad|fechad|conclu|cancel/i.test(record.status)).length;
    const pendingTasks = Math.max(tasks.filter((task) => !submittedIds.has(task.id)).length, canonicalPendingTasks);
    const openInvoices = invoices.filter((invoice) => invoice.status === "pendente" || invoice.status === "em_analise");
    const canonicalOpenInvoices = canonicalRecords.filter((record) => record.moduleId === "financeiro" && !/pago|quitado|cancel|estorn|conciliad/i.test(record.status));
    const openAmount = openInvoices.reduce((total, invoice) => total + Number(invoice.valorFinal || 0), 0);
    const canonicalOpenAmount = canonicalOpenInvoices.reduce((total, record) => total + Number(record.customData?.saldoAberto ?? record.customData?.valorCalculado ?? record.customData?.valor ?? 0), 0);
    return { present, absent, frequency, pendingTasks, openInvoices: Math.max(openInvoices.length, canonicalOpenInvoices.length), openAmount: Math.max(openAmount, canonicalOpenAmount) };
  }, [attendance, tasks, submissions, invoices, canonicalRecords]);

  const resetAbsenceForm = () => {
    setAbsenceDate("");
    setAbsenceReason("");
    setAbsenceAttachment(null);
  };

  const handleAbsenceOpenChange = (open: boolean) => {
    setAbsenceOpen(open);
    if (!open && !saving && !uploadingAttachment) resetAbsenceForm();
  };

  const handleAbsenceAttachment = async (file?: File) => {
    if (!file) return;
    setUploadingAttachment(true);
    try {
      const attachment = await uploadSchoolAttachment(file, "frequencia", actor, {
        audienceUserIds: [studentId, userData?.uid || ""],
        audienceRoles: ["secretaria", "coordenador"],
        studentIds: studentId ? [studentId] : [],
        sensitive: true,
      });
      setAbsenceAttachment(attachment);
      toast({ title: "Atestado anexado", description: file.name });
    } catch (error: any) {
      toast({ title: "Não foi possível anexar", description: error.message, variant: "destructive" });
    } finally {
      setUploadingAttachment(false);
    }
  };

  const submitAbsence = async () => {
    if (!absenceDate || !absenceReason.trim() || !selectedLink || !can("absence.justify")) return;
    setSaving(true);
    try {
      await saveSchoolRecord({ moduleId: "frequencia", capability: "Justificativa com anexo de atestado", workflow: "Justificativa/atestado", title: `Justificativa de ausência · ${selectedLink.studentName}`, status: "aberta", description: absenceReason, studentId, studentName: selectedLink.studentName, audienceUserIds: [studentId, userData?.uid || ""], audienceRoles: ["secretaria", "coordenador"], customData: { dataReferencia: absenceDate, justificativa: absenceReason, situacao: "Aguardando análise", possuiAtestado: Boolean(absenceAttachment), prioridade: "Normal" }, attachments: absenceAttachment ? [absenceAttachment] : [] }, actor);
      toast({ title: "Justificativa protocolada", description: "A escola foi notificada e poderá aprovar ou recusar o pedido." });
      setAbsenceOpen(false);
      resetAbsenceForm();
    } catch (error: any) { toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  if (loadingLinks) return <div className="guardian-panel-loading"><Loader2 className="h-6 w-6 animate-spin" />Carregando vínculos familiares...</div>;
  if (!links.length) return <div className="guardian-no-links"><UsersRound className="h-8 w-8" /><div><h3>Nenhum aluno vinculado</h3><p>Peça à secretaria para ativar o vínculo familiar e as permissões de acompanhamento.</p></div></div>;

  return (
    <section className="guardian-family-panel">
      <div className="guardian-family-heading"><div><span>Portal da família</span><h2>Acompanhamento dos filhos</h2><p>Frequência, desempenho, pendências, ocorrências e financeiro em tempo real.</p>{selectedLink && <small className="guardian-link-profile"><ShieldCheck className="h-3.5 w-3.5" />Vínculo {String(selectedLink.relationshipType || "personalizado").replaceAll("_", " ")} · {linkPermissions.length} permissão(ões)</small>}</div><div className="guardian-child-selector"><Label htmlFor="guardian-child">Aluno</Label><Select value={studentId} onValueChange={setStudentId}><SelectTrigger id="guardian-child"><SelectValue /></SelectTrigger><SelectContent>{links.map((link) => <SelectItem key={link.studentId} value={link.studentId}>{link.studentName}</SelectItem>)}</SelectContent></Select></div></div>
      <div className="guardian-kpis">{canViewAttendance && <div><CalendarCheck /><span>Frequência</span><strong>{stats.frequency}%</strong><small>{stats.absent} falta(s)</small></div>}{canViewAcademic && <div><BookOpenCheck /><span>Atividades pendentes</span><strong>{stats.pendingTasks}</strong><small>{tasks.length} publicada(s)</small></div>}{canViewFinance && <div><Receipt /><span>Financeiro em aberto</span><strong>{stats.openInvoices}</strong><small>{money(stats.openAmount)}</small></div>}{canViewDiscipline && <div><AlertTriangle /><span>Ocorrências ativas</span><strong>{occurrences.filter((item) => item.ativo !== false).length}</strong><small>acompanhamento escolar</small></div>}</div>
      <div className="guardian-family-grid">
        {canViewAcademic && <div className="guardian-summary-card"><div className="guardian-card-heading"><h3><FileText className="h-4 w-4" />Boletins liberados</h3><Badge variant="outline">{reportCards.filter((card) => card.liberado).length}</Badge></div>{reportCards.filter((card) => card.liberado).sort((a, b) => Number(b.bimestreNumero) - Number(a.bimestreNumero)).slice(0, 4).map((card) => <div key={card.id} className="guardian-list-row"><span><strong>{card.bimestreNumero}º período · {card.anoLetivo}</strong><small>Média geral {card.mediaGeral ?? "—"} · frequência {card.percentualPresenca ?? "—"}%</small></span><Badge variant={card.situacao === "reprovado" ? "destructive" : "secondary"}>{card.situacao}</Badge></div>)}{!reportCards.some((card) => card.liberado) && <p className="guardian-empty">Nenhum boletim foi liberado ainda.</p>}</div>}
        {canViewAttendance && <div className="guardian-summary-card"><div className="guardian-card-heading"><h3><Clock3 className="h-4 w-4" />Presenças recentes</h3>{can("absence.justify") && <Button size="sm" variant="outline" onClick={() => setAbsenceOpen(true)}>Justificar falta</Button>}</div>{[...attendance].sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 5).map((entry) => <div key={entry.id} className="guardian-list-row"><span><strong>{entry.data}</strong><small>{entry.status === "justificado" ? entry.justificativa || "Justificada" : "Registro da chamada"}</small></span>{entry.status === "presente" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : entry.status === "ausente" ? <XCircle className="h-4 w-4 text-red-600" /> : <Badge variant="outline">{entry.status}</Badge>}</div>)}{!attendance.length && <p className="guardian-empty">Nenhuma chamada registrada.</p>}</div>}
        {canViewDiscipline && <div className="guardian-summary-card"><div className="guardian-card-heading"><h3><MessageSquareText className="h-4 w-4" />Ocorrências e ciência</h3><Badge variant="outline">restrito</Badge></div>{occurrences.slice(0, 5).map((entry) => <div key={entry.id} className="guardian-list-row"><span><strong>{entry.tipo}</strong><small>{entry.comentario || "Registro escolar"}</small></span><Badge variant={entry.ativo === false ? "secondary" : "destructive"}>{entry.ativo === false ? "encerrada" : "ativa"}</Badge></div>)}{!occurrences.length && <p className="guardian-empty">Nenhuma ocorrência compartilhada.</p>}</div>}
        {canonicalRecords.length > 0 && <div className="guardian-summary-card guardian-operations-card"><div className="guardian-card-heading"><h3><ShieldCheck className="h-4 w-4" />Atualizações da Gestão 360</h3><Badge variant="outline">{canonicalRecords.length}</Badge></div>{canonicalRecords.slice(0, 6).map((record) => <div key={record.id} className="guardian-list-row"><span><strong>{record.title}</strong><small>{record.capabilityId || SCHOOL_MODULE_BY_ID[record.moduleId]?.shortTitle} · {record.capability || record.workflow}</small></span><Badge variant={/cancel|recus|reprov|vencid/i.test(record.status) ? "destructive" : "secondary"}>{record.status}</Badge></div>)}</div>}
        {!canViewAcademic && !canViewAttendance && !canViewDiscipline && <div className="guardian-permission-empty"><ShieldCheck /><div><strong>Acesso personalizado</strong><p>Este vínculo não possui permissão pedagógica. A secretaria pode ajustar os acessos sem alterar os demais responsáveis.</p></div></div>}
      </div>
      <Dialog open={absenceOpen} onOpenChange={handleAbsenceOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Justificar ausência</DialogTitle><DialogDescription>O pedido será protocolado, analisado pela escola e registrado no histórico de {selectedLink?.studentName}.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label htmlFor="absence-date">Data da ausência *</Label><Input id="absence-date" type="date" value={absenceDate} onChange={(event) => setAbsenceDate(event.target.value)} /></div><div><Label htmlFor="absence-reason">Justificativa *</Label><Textarea id="absence-reason" rows={4} value={absenceReason} onChange={(event) => setAbsenceReason(event.target.value)} /></div><div><Label htmlFor="absence-attachment">Atestado ou comprovante</Label><Input id="absence-attachment" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => handleAbsenceAttachment(event.target.files?.[0])} disabled={uploadingAttachment || saving} /><div className="guardian-attachment-row"><Button type="button" variant="outline" onClick={() => document.getElementById("absence-attachment")?.click()} disabled={uploadingAttachment || saving}>{uploadingAttachment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{uploadingAttachment ? "Enviando..." : "Anexar arquivo"}</Button>{absenceAttachment && <span><Paperclip className="h-3.5 w-3.5" />{absenceAttachment.name}</span>}</div><p className="guardian-file-hint">PDF, JPG, PNG ou WebP, até 8 MB. O arquivo ficará protegido no protocolo.</p></div></div><DialogFooter><Button variant="outline" onClick={() => handleAbsenceOpenChange(false)} disabled={saving || uploadingAttachment}>Cancelar</Button><Button onClick={submitAbsence} disabled={saving || uploadingAttachment || !absenceDate || !absenceReason.trim()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar justificativa</Button></DialogFooter></DialogContent></Dialog>
    </section>
  );
}
