import { useEffect, useMemo, useState } from "react";
import { where } from "firebase/firestore";
import { ArchiveRestore, Clock3, Download, Edit3, FileText, History, Loader2, MessageSquarePlus, Paperclip, Printer, Send, Trash2, UserRound } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import type { SchoolModuleDefinition } from "./schoolCatalog";
import { capabilityBlueprint } from "./schoolCapabilityEngine";
import { addSchoolRecordComment, changeSchoolRecordStatus, downloadSchoolAttachment, registerAuditEvent, type SchoolActor, type SchoolRecord } from "./schoolData";

interface SchoolRecordDetailsProps {
  open: boolean;
  record: SchoolRecord | null;
  module: SchoolModuleDefinition;
  actor: SchoolActor;
  canWrite: boolean;
  isStaff: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (record: SchoolRecord) => void;
  onDelete: (record: SchoolRecord) => void;
  onRestore: (record: SchoolRecord) => void;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}

function labelForKey(key: string, module: SchoolModuleDefinition, capability?: string) {
  const operationalField = capability ? capabilityBlueprint(module, capability).fields.find((field) => field.key === key) : undefined;
  return module.fields.find((field) => field.key === key)?.label || operationalField?.label || key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function displayValue(value: string | number | boolean) {
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value || "—");
}

export function SchoolRecordDetails({
  open,
  record,
  module,
  actor,
  canWrite,
  isStaff,
  onOpenChange,
  onEdit,
  onDelete,
  onRestore,
}: SchoolRecordDetailsProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState(record?.status || "");
  const [comment, setComment] = useState("");
  const [privateComment, setPrivateComment] = useState(false);
  const [working, setWorking] = useState(false);

  const { data: privateNotes = [] } = useRealtimeQuery<any>({
    collectionName: "schoolPrivateNotes",
    queryKey: ["/school/private-notes", record?.id, isStaff],
    constraints: record?.id ? [where("recordId", "==", record.id)] : [],
    enabled: Boolean(record?.id && isStaff && open),
  });

  const visibleComments = useMemo(
    () => [
      ...(record?.comments || []).filter((entry) => !entry.private || isStaff || entry.createdBy === actor.uid),
      ...(isStaff ? privateNotes : []),
    ].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
    [record?.comments, isStaff, actor.uid, privateNotes],
  );

  useEffect(() => {
    setStatus(record?.status || "");
  }, [record?.id, record?.status]);

  if (!record) return null;

  const handleStatus = async () => {
    if (status === record.status) return;
    setWorking(true);
    try {
      await changeSchoolRecordStatus(record, status, actor);
      toast({ title: "Status atualizado", description: `${record.code}: ${status}.` });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const handleComment = async () => {
    setWorking(true);
    try {
      await addSchoolRecordComment(record, comment, actor, privateComment && isStaff);
      setComment("");
      setPrivateComment(false);
      toast({ title: "Comentário registrado", description: "A interação entrou no histórico do processo." });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Erro ao comentar", description: error.message, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const exportPdf = async () => {
    setWorking(true);
    try {
      if (module.id === "documentos-escolares" && !/emitid|baixad|arquivad/.test(record.status.toLocaleLowerCase("pt-BR"))) {
        throw new Error("Conclua a assinatura e altere o status para “emitido” antes de gerar o documento autenticável.");
      }
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      pdf.setFillColor(29, 79, 145);
      pdf.rect(0, 0, 210, 25, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text("VESTIBULANDO", 14, 11);
      pdf.setFontSize(9);
      pdf.text(module.title, 14, 18);
      pdf.setTextColor(25, 37, 54);
      pdf.setFontSize(15);
      pdf.text(record.title, 14, 36, { maxWidth: 150 });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(`${record.code} · ${record.workflow} · ${record.status}`, 14, 43);
      autoTable(pdf, {
        startY: 49,
        head: [["Campo", "Informação"]],
        body: [
          ["Aluno", record.studentName || "—"], ["Turma", record.className || "—"], ["Unidade", record.unitName || "—"],
          ["Responsável", record.assigneeName || "—"], ["Descrição", record.description || "—"],
          ["Tipo de cadastro", record.capability || record.workflow],
          ...Object.entries(record.customData || {}).map(([key, value]) => [labelForKey(key, module, record.capability), displayValue(value)]),
        ],
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
        headStyles: { fillColor: [29, 79, 145] },
        columnStyles: { 0: { cellWidth: 48, fontStyle: "bold" }, 1: { cellWidth: 132 } },
      });
      const finalY = (pdf as any).lastAutoTable?.finalY || 90;
      if (module.id === "documentos-escolares") {
        const validationUrl = `${window.location.origin}/validar/${encodeURIComponent(record.code)}`;
        const qr = await QRCode.toDataURL(validationUrl, { width: 220, margin: 1, errorCorrectionLevel: "M" });
        const qrY = Math.min(finalY + 8, 240);
        pdf.addImage(qr, "PNG", 14, qrY, 31, 31);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.text("Validação de autenticidade", 50, qrY + 9);
        pdf.setFont("helvetica", "normal");
        pdf.text(validationUrl, 50, qrY + 15, { maxWidth: 140 });
        pdf.text(`Código: ${record.code}`, 50, qrY + 22);
      }
      const pages = pdf.getNumberOfPages();
      for (let page = 1; page <= pages; page += 1) {
        pdf.setPage(page);
        pdf.setFontSize(7);
        pdf.setTextColor(95, 108, 125);
        pdf.text(`Gerado em ${new Date().toLocaleString("pt-BR")} · página ${page}/${pages}`, 14, 290);
      }
      pdf.save(`${module.id}-${record.code.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`);
      await registerAuditEvent("document_download", module.id, actor, { recordId: record.id, code: record.code, format: "pdf" });
      toast({ title: "PDF gerado", description: module.id === "documentos-escolares" ? "O documento inclui QR Code para validação pública." : "A ficha foi exportada com os dados acessíveis." });
    } catch (error: any) {
      toast({ title: "Não foi possível gerar o PDF", description: error.message, variant: "destructive" });
    } finally { setWorking(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="school-details-dialog max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="school-details-heading">
            <div>
              <DialogTitle>{record.title}</DialogTitle>
              <DialogDescription>{record.code} · {record.workflow}</DialogDescription>
            </div>
            <Badge className="school-status-badge" variant={record.deletedAt ? "destructive" : "secondary"}>{record.deletedAt ? "arquivado" : record.status}</Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList className="school-details-tabs">
            <TabsTrigger value="details"><FileText className="h-4 w-4" /> Dados</TabsTrigger>
            <TabsTrigger value="history"><History className="h-4 w-4" /> Histórico ({(record.versions || []).length + 1})</TabsTrigger>
            <TabsTrigger value="comments"><MessageSquarePlus className="h-4 w-4" /> Interações ({visibleComments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-5">
            <div className="school-detail-grid">
              <div><span>Tipo de cadastro</span><strong>{record.capability || record.workflow}</strong></div>
              <div><span>Etapa</span><strong>{record.workflow}</strong></div>
              <div><span>Status</span><strong>{record.status}</strong></div>
              <div><span>Aluno</span><strong>{record.studentName || "—"}</strong></div>
              <div><span>Turma</span><strong>{record.className || "—"}</strong></div>
              <div><span>Unidade</span><strong>{record.unitName || "—"}</strong></div>
              <div><span>Responsável</span><strong>{record.assigneeName || "—"}</strong></div>
              <div><span>Criado por</span><strong>{record.createdByName}</strong></div>
              <div><span>Atualizado</span><strong>{formatDate(record.updatedAt)}</strong></div>
            </div>
            {record.description && <div className="school-detail-text"><span>Observações</span><p>{record.description}</p></div>}
            {Object.keys(record.customData || {}).length > 0 && (
              <div>
                <h4 className="school-detail-section-title">Informações do cadastro</h4>
                <div className="school-detail-grid">
                  {Object.entries(record.customData).map(([key, value]) => <div key={key}><span>{labelForKey(key, module, record.capability)}</span><strong>{displayValue(value)}</strong></div>)}
                </div>
              </div>
            )}
            <div>
              <h4 className="school-detail-section-title">Anexos</h4>
              <div className="school-detail-attachments">
                {(record.attachments || []).map((attachment) => (
                  <button type="button" key={attachment.storagePath || attachment.url || attachment.name} onClick={() => downloadSchoolAttachment(attachment).catch((error) => toast({ title: "Não foi possível abrir o anexo", description: error.message, variant: "destructive" }))}><Paperclip className="h-4 w-4" /><span>{attachment.name}</span><Download className="h-4 w-4" /></button>
                ))}
                {!record.attachments?.length && <p>Nenhum arquivo anexado.</p>}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-3">
            <div className="school-timeline-item is-current">
              <span className="school-timeline-dot" />
              <div><strong>Versão atual · {record.status}</strong><p>{record.updatedByName} · {formatDate(record.updatedAt)}</p></div>
            </div>
            {[...(record.versions || [])].reverse().map((version, index) => (
              <div key={`${version.at}-${index}`} className="school-timeline-item">
                <span className="school-timeline-dot" />
                <div><strong>{version.action} · {version.previousStatus || "registro"}</strong><p>{version.byName} · {formatDate(version.at)}</p></div>
              </div>
            ))}
            <div className="school-timeline-item">
              <span className="school-timeline-dot" />
              <div><strong>Registro criado</strong><p>{record.createdByName} · {formatDate(record.createdAt)}</p></div>
            </div>
          </TabsContent>

          <TabsContent value="comments" className="space-y-4">
            <div className="school-comment-list">
              {visibleComments.map((entry) => (
                <div key={entry.id} className="school-comment-card">
                  <div><UserRound className="h-4 w-4" /><strong>{entry.createdByName}</strong>{entry.private && <Badge variant="outline">interno</Badge>}<span>{formatDate(entry.createdAt)}</span></div>
                  <p>{entry.text}</p>
                </div>
              ))}
              {!visibleComments.length && <div className="school-empty-inline">Ainda não há interações neste processo.</div>}
            </div>
            <div className="school-comment-composer">
              <Label htmlFor="school-comment">Adicionar interação</Label>
              <Textarea id="school-comment" value={comment} onChange={(event) => setComment(event.target.value)} rows={3} placeholder="Registre um retorno, parecer ou observação..." />
              <div className="school-comment-actions">
                {isStaff && <label><Checkbox checked={privateComment} onCheckedChange={(checked) => setPrivateComment(checked === true)} /><span>Nota interna restrita</span></label>}
                <Button onClick={handleComment} disabled={!comment.trim() || working}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Registrar</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="school-details-footer">
          {canWrite && !record.deletedAt && (
            <div className="school-status-change">
              <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{module.statuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
              <Button variant="outline" onClick={handleStatus} disabled={status === record.status || working}><Clock3 className="mr-2 h-4 w-4" />Atualizar status</Button>
            </div>
          )}
          <div className="school-detail-main-actions">
            <Button variant="outline" onClick={exportPdf} disabled={working}><Printer className="mr-2 h-4 w-4" />{module.id === "documentos-escolares" ? "Gerar documento PDF" : "Exportar ficha"}</Button>
            {record.deletedAt ? (
              canWrite && <Button onClick={() => onRestore(record)}><ArchiveRestore className="mr-2 h-4 w-4" />Restaurar</Button>
            ) : (
              canWrite && <>
                <Button variant="outline" onClick={() => onEdit(record)}><Edit3 className="mr-2 h-4 w-4" />Editar</Button>
                <Button variant="destructive" onClick={() => onDelete(record)}><Trash2 className="mr-2 h-4 w-4" />Arquivar</Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
