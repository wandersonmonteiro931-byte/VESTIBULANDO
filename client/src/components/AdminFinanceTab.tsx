import { useMemo, useState } from "react";
import { addDoc, collection, doc, setDoc, updateDoc, where } from "firebase/firestore";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Landmark,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  WalletCards,
  XCircle,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { FinancialInvoice, FinancialSettings, Scholarship, User } from "@shared/schema";

const money = (value?: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

const dateLabel = (value?: string) => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
};

const overdue = (invoice: FinancialInvoice) => {
  if (["pago", "cancelado", "em_analise"].includes(invoice.status)) return false;
  return new Date(`${invoice.vencimento}T23:59:59`).getTime() < Date.now();
};

const blankInvoice = {
  alunoId: "",
  referencia: "",
  descricao: "Mensalidade escolar",
  vencimento: "",
  valorOriginal: "",
  descontoManual: "0",
  multa: "0",
  juros: "0",
  pixCopiaCola: "",
  linkPagamento: "",
};

const blankScholarship = {
  alunoId: "",
  nome: "Bolsa de estudo",
  tipo: "percentual" as "percentual" | "valor_fixo" | "integral",
  valor: "",
  motivo: "",
  dataInicio: "",
  dataFim: "",
};

export function AdminFinanceTab() {
  const { userData } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const [scholarshipDialog, setScholarshipDialog] = useState(false);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState(blankInvoice);
  const [scholarshipForm, setScholarshipForm] = useState(blankScholarship);
  const [saving, setSaving] = useState(false);
  const [editingScholarship, setEditingScholarship] = useState<Scholarship | null>(null);
  const [settingsForm, setSettingsForm] = useState({ beneficiario: "", chavePix: "", pixCopiaCola: "", linkPagamento: "", instrucoes: "" });

  const { data: students = [] } = useRealtimeQuery<User>({
    collectionName: "usuarios",
    queryKey: ["/finance/students"],
    constraints: [where("tipo", "==", "aluno")],
    transform: (docs) => docs as User[],
  });
  const { data: invoices = [] } = useRealtimeQuery<FinancialInvoice>({
    collectionName: "financialInvoices",
    queryKey: ["/finance/invoices/admin"],
    transform: (docs) => docs as FinancialInvoice[],
  });
  const { data: scholarships = [] } = useRealtimeQuery<Scholarship>({
    collectionName: "scholarships",
    queryKey: ["/finance/scholarships/admin"],
    transform: (docs) => docs as Scholarship[],
  });
  const { data: settingsList = [] } = useRealtimeQuery<FinancialSettings>({
    collectionName: "financialSettings",
    queryKey: ["/finance/settings/admin"],
    transform: (docs) => docs as FinancialSettings[],
  });

  const settings = settingsList.find((item) => item.id === "default") || settingsList[0];

  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...invoices]
      .filter((item) => !term || `${item.alunoNome} ${item.alunoMatricula || ""} ${item.referencia}`.toLowerCase().includes(term))
      .sort((a, b) => new Date(b.vencimento).getTime() - new Date(a.vencimento).getTime());
  }, [invoices, search]);

  const summary = useMemo(() => ({
    open: invoices.filter((item) => !["pago", "cancelado"].includes(item.status)).reduce((sum, item) => sum + Number(item.valorFinal || 0), 0),
    overdue: invoices.filter(overdue).reduce((sum, item) => sum + Number(item.valorFinal || 0), 0),
    received: invoices.filter((item) => item.status === "pago").reduce((sum, item) => sum + Number(item.valorFinal || 0), 0),
    analysis: invoices.filter((item) => item.status === "em_analise").length,
  }), [invoices]);

  const scholarshipForStudent = (studentId: string, referenceDate = new Date()) => scholarships.find((item) => {
    if (item.alunoId !== studentId || !item.ativa) return false;
    const start = item.dataInicio ? new Date(`${item.dataInicio}T00:00:00`) : null;
    const end = item.dataFim ? new Date(`${item.dataFim}T23:59:59`) : null;
    return (!start || start <= referenceDate) && (!end || end >= referenceDate);
  });

  const scholarshipDiscount = (scholarship: Scholarship | undefined, base: number) => {
    if (!scholarship) return 0;
    if (scholarship.tipo === "integral") return base;
    if (scholarship.tipo === "percentual") return base * (Number(scholarship.valor || 0) / 100);
    return Math.min(base, Number(scholarship.valor || 0));
  };

  const createInvoice = async () => {
    const student = students.find((item) => item.uid === invoiceForm.alunoId);
    if (!student || !invoiceForm.referencia || !invoiceForm.vencimento || !invoiceForm.valorOriginal) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    const original = Number(invoiceForm.valorOriginal);
    const scholarship = scholarshipForStudent(student.uid, new Date(`${invoiceForm.vencimento}T12:00:00`));
    const bolsaDiscount = scholarshipDiscount(scholarship, original);
    const manual = Number(invoiceForm.descontoManual || 0);
    const multa = Number(invoiceForm.multa || 0);
    const juros = Number(invoiceForm.juros || 0);
    const finalValue = Math.max(0, original - bolsaDiscount - manual + multa + juros);
    try {
      setSaving(true);
      const now = new Date().toISOString();
      await addDoc(collection(db, "financialInvoices"), {
        alunoId: student.uid,
        alunoNome: student.nome,
        alunoMatricula: student.matricula || "",
        turma: student.turma || "",
        referencia: invoiceForm.referencia,
        descricao: invoiceForm.descricao,
        vencimento: invoiceForm.vencimento,
        valorOriginal: original,
        descontoBolsa: bolsaDiscount,
        descontoManual: manual,
        multa,
        juros,
        valorFinal: finalValue,
        bolsaId: scholarship?.id || "",
        bolsaDescricao: scholarship ? `${scholarship.nome} (${scholarship.tipo === "percentual" ? `${scholarship.valor}%` : scholarship.tipo === "integral" ? "integral" : money(scholarship.valor)})` : "",
        status: finalValue === 0 ? "pago" : "pendente",
        pixCopiaCola: invoiceForm.pixCopiaCola || settings?.pixCopiaCola || settings?.chavePix || "",
        linkPagamento: invoiceForm.linkPagamento || settings?.linkPagamento || "",
        criadoEm: now,
        atualizadoEm: now,
        criadoPor: userData?.uid || "",
        criadoPorNome: userData?.nome || "Diretoria",
        ...(finalValue === 0 ? { pagoEm: now, observacaoPagamento: "Quitada integralmente por bolsa/desconto." } : {}),
      });
      toast({ title: "Fatura criada", description: `Fatura de ${student.nome} registrada com sucesso.` });
      setInvoiceDialog(false);
      setInvoiceForm(blankInvoice);
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao criar fatura", description: "Confira as regras do Firestore e tente novamente.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const saveScholarship = async () => {
    const student = students.find((item) => item.uid === scholarshipForm.alunoId);
    if (!student || !scholarshipForm.nome || !scholarshipForm.dataInicio || (scholarshipForm.tipo !== "integral" && !scholarshipForm.valor)) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      const now = new Date().toISOString();
      const payload = {
        alunoId: student.uid,
        alunoNome: student.nome,
        alunoMatricula: student.matricula || "",
        nome: scholarshipForm.nome,
        tipo: scholarshipForm.tipo,
        valor: scholarshipForm.tipo === "integral" ? 100 : Number(scholarshipForm.valor || 0),
        motivo: scholarshipForm.motivo,
        dataInicio: scholarshipForm.dataInicio,
        dataFim: scholarshipForm.dataFim,
        ativa: true,
        atualizadoEm: now,
        atualizadoPor: userData?.uid || "",
      };
      if (editingScholarship) {
        await updateDoc(doc(db, "scholarships", editingScholarship.id), payload);
      } else {
        const existing = scholarships.filter((item) => item.alunoId === student.uid && item.ativa);
        await Promise.all(existing.map((item) => updateDoc(doc(db, "scholarships", item.id), { ativa: false, atualizadoEm: now })));
        await addDoc(collection(db, "scholarships"), { ...payload, criadoEm: now, criadoPor: userData?.uid || "", criadoPorNome: userData?.nome || "Diretoria" });
      }
      toast({ title: editingScholarship ? "Bolsa atualizada" : "Bolsa cadastrada" });
      setScholarshipDialog(false);
      setEditingScholarship(null);
      setScholarshipForm(blankScholarship);
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao salvar bolsa", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const openScholarshipEdit = (item: Scholarship) => {
    setEditingScholarship(item);
    setScholarshipForm({ alunoId: item.alunoId, nome: item.nome, tipo: item.tipo, valor: String(item.valor || ""), motivo: item.motivo || "", dataInicio: item.dataInicio || "", dataFim: item.dataFim || "" });
    setScholarshipDialog(true);
  };

  const updateInvoiceStatus = async (invoice: FinancialInvoice, status: FinancialInvoice["status"], extra: Record<string, unknown> = {}) => {
    try {
      await updateDoc(doc(db, "financialInvoices", invoice.id), { status, atualizadoEm: new Date().toISOString(), atualizadoPor: userData?.uid || "", ...extra });
      toast({ title: status === "pago" ? "Pagamento confirmado" : status === "cancelado" ? "Fatura cancelada" : "Fatura atualizada" });
    } catch (error) {
      console.error(error);
      toast({ title: "Não foi possível atualizar", variant: "destructive" });
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await setDoc(doc(db, "financialSettings", "default"), { ...settingsForm, atualizadoEm: new Date().toISOString(), atualizadoPor: userData?.uid || "" }, { merge: true });
      toast({ title: "Configurações financeiras salvas" });
      setSettingsDialog(false);
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const openSettings = () => {
    setSettingsForm({ beneficiario: settings?.beneficiario || "", chavePix: settings?.chavePix || "", pixCopiaCola: settings?.pixCopiaCola || "", linkPagamento: settings?.linkPagamento || "", instrucoes: settings?.instrucoes || "" });
    setSettingsDialog(true);
  };

  return (
    <div className="space-y-6" data-testid="admin-finance-tab">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><span className="dashboard-eyebrow">Gestão financeira</span><h2 className="dashboard-hero-title">Financeiro dos alunos</h2><p className="dashboard-hero-subtitle">Controle faturas, pagamentos, inadimplência e bolsas de estudo.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openSettings}><Settings2 className="mr-2 h-4 w-4" /> Configurar PIX</Button>
          <Button variant="outline" onClick={() => { setEditingScholarship(null); setScholarshipForm(blankScholarship); setScholarshipDialog(true); }}><GraduationCap className="mr-2 h-4 w-4" /> Nova bolsa</Button>
          <Button onClick={() => setInvoiceDialog(true)}><Plus className="mr-2 h-4 w-4" /> Nova fatura</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="flex items-center gap-3 p-5"><div className="rounded-xl bg-amber-100 p-3 text-amber-700"><ReceiptText className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">A receber</p><p className="text-xl font-bold">{money(summary.open)}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-5"><div className="rounded-xl bg-red-100 p-3 text-red-700"><AlertTriangle className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">Vencido</p><p className="text-xl font-bold">{money(summary.overdue)}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-5"><div className="rounded-xl bg-emerald-100 p-3 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">Recebido</p><p className="text-xl font-bold">{money(summary.received)}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-5"><div className="rounded-xl bg-blue-100 p-3 text-blue-700"><WalletCards className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">Em análise</p><p className="text-xl font-bold">{summary.analysis}</p></div></CardContent></Card>
      </div>

      <Tabs defaultValue="faturas">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]"><TabsTrigger value="faturas">Faturas</TabsTrigger><TabsTrigger value="alunos">Por aluno</TabsTrigger><TabsTrigger value="bolsas">Bolsas de estudo</TabsTrigger></TabsList>
        <TabsContent value="faturas" className="mt-5 space-y-4">
          <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar aluno, matrícula ou referência..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Aluno</TableHead><TableHead>Referência</TableHead><TableHead>Vencimento</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>
            {filteredInvoices.map((invoice) => {
              const status = invoice.status === "pago" ? "Pago" : invoice.status === "em_analise" ? "Pagamento informado" : invoice.status === "cancelado" ? "Cancelado" : overdue(invoice) ? "Vencido" : "Em aberto";
              return <TableRow key={invoice.id}><TableCell><div className="font-medium">{invoice.alunoNome}</div><div className="text-xs text-muted-foreground">{invoice.alunoMatricula || "Sem matrícula"}</div></TableCell><TableCell>{invoice.referencia}</TableCell><TableCell>{dateLabel(invoice.vencimento)}</TableCell><TableCell className="font-semibold">{money(invoice.valorFinal)}</TableCell><TableCell><Badge variant="outline">{status}</Badge></TableCell><TableCell><div className="flex justify-end gap-1">
                {invoice.comprovanteUrl && <Button size="icon" variant="ghost" asChild title="Abrir comprovante"><a href={invoice.comprovanteUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>}
                {invoice.status !== "pago" && invoice.status !== "cancelado" && <Button size="sm" variant="outline" onClick={() => updateInvoiceStatus(invoice, "pago", { pagoEm: new Date().toISOString(), confirmadoPor: userData?.uid || "" })}><CheckCircle2 className="mr-1 h-4 w-4" /> Confirmar</Button>}
                {invoice.status === "em_analise" && <Button size="sm" variant="ghost" onClick={() => updateInvoiceStatus(invoice, "pendente", { observacaoPagamento: "Pagamento informado não localizado pela diretoria." })}>Recusar</Button>}
                {invoice.status !== "cancelado" && invoice.status !== "pago" && <Button size="icon" variant="ghost" onClick={() => updateInvoiceStatus(invoice, "cancelado")} title="Cancelar"><XCircle className="h-4 w-4 text-red-600" /></Button>}
              </div></TableCell></TableRow>;
            })}
            {!filteredInvoices.length && <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">Nenhuma fatura encontrada.</TableCell></TableRow>}
          </TableBody></Table></div></CardContent></Card>
        </TabsContent>

        <TabsContent value="alunos" className="mt-5"><Card><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Aluno</TableHead><TableHead>Bolsa</TableHead><TableHead>Em aberto</TableHead><TableHead>Vencido</TableHead><TableHead>Pago</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{students.sort((a,b) => a.nome.localeCompare(b.nome)).map((student) => {
          const studentInvoices = invoices.filter((item) => item.alunoId === student.uid);
          const scholarship = scholarshipForStudent(student.uid);
          const open = studentInvoices.filter((item) => !["pago","cancelado"].includes(item.status)).reduce((s,i)=>s+Number(i.valorFinal||0),0);
          const late = studentInvoices.filter(overdue).reduce((s,i)=>s+Number(i.valorFinal||0),0);
          const paid = studentInvoices.filter((item)=>item.status==="pago").reduce((s,i)=>s+Number(i.valorFinal||0),0);
          return <TableRow key={student.uid}><TableCell><div className="font-medium">{student.nome}</div><div className="text-xs text-muted-foreground">{student.matricula || "Sem matrícula"}</div></TableCell><TableCell>{scholarship ? <Badge className="bg-emerald-100 text-emerald-800">{scholarship.nome}</Badge> : <span className="text-muted-foreground">Sem bolsa</span>}</TableCell><TableCell>{money(open)}</TableCell><TableCell className={late > 0 ? "font-semibold text-red-600" : ""}>{money(late)}</TableCell><TableCell>{money(paid)}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => { setInvoiceForm({ ...blankInvoice, alunoId: student.uid }); setInvoiceDialog(true); }}><Plus className="mr-1 h-4 w-4" /> Fatura</Button></TableCell></TableRow>;
        })}</TableBody></Table></div></CardContent></Card></TabsContent>

        <TabsContent value="bolsas" className="mt-5"><Card><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Aluno</TableHead><TableHead>Bolsa</TableHead><TableHead>Desconto</TableHead><TableHead>Período</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{scholarships.sort((a,b)=>a.alunoNome.localeCompare(b.alunoNome)).map((item) => <TableRow key={item.id}><TableCell><div className="font-medium">{item.alunoNome}</div><div className="text-xs text-muted-foreground">{item.alunoMatricula || "Sem matrícula"}</div></TableCell><TableCell>{item.nome}</TableCell><TableCell>{item.tipo === "percentual" ? `${item.valor}%` : item.tipo === "integral" ? "100%" : money(item.valor)}</TableCell><TableCell>{dateLabel(item.dataInicio)} — {item.dataFim ? dateLabel(item.dataFim) : "sem fim"}</TableCell><TableCell><Badge variant={item.ativa ? "default" : "secondary"}>{item.ativa ? "Ativa" : "Inativa"}</Badge></TableCell><TableCell><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" onClick={() => openScholarshipEdit(item)}><Pencil className="h-4 w-4" /></Button>{item.ativa && <Button size="sm" variant="outline" onClick={() => updateDoc(doc(db,"scholarships",item.id),{ativa:false,atualizadoEm:new Date().toISOString()})}>Encerrar</Button>}</div></TableCell></TableRow>)}{!scholarships.length && <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">Nenhuma bolsa cadastrada.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card></TabsContent>
      </Tabs>

      <Dialog open={invoiceDialog} onOpenChange={setInvoiceDialog}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Nova fatura</DialogTitle><DialogDescription>Crie uma cobrança para um aluno. A bolsa ativa será aplicada automaticamente.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2"><Label>Aluno *</Label><Select value={invoiceForm.alunoId} onValueChange={(value)=>setInvoiceForm({...invoiceForm,alunoId:value})}><SelectTrigger><SelectValue placeholder="Selecione o aluno" /></SelectTrigger><SelectContent>{students.sort((a,b)=>a.nome.localeCompare(b.nome)).map((item)=><SelectItem key={item.uid} value={item.uid}>{item.nome} {item.matricula ? `• ${item.matricula}` : ""}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Referência *</Label><Input placeholder="Ex.: Agosto/2026" value={invoiceForm.referencia} onChange={(e)=>setInvoiceForm({...invoiceForm,referencia:e.target.value})} /></div><div className="space-y-2"><Label>Vencimento *</Label><Input type="date" value={invoiceForm.vencimento} onChange={(e)=>setInvoiceForm({...invoiceForm,vencimento:e.target.value})} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Descrição</Label><Input value={invoiceForm.descricao} onChange={(e)=>setInvoiceForm({...invoiceForm,descricao:e.target.value})} /></div>
        <div className="space-y-2"><Label>Valor original *</Label><Input type="number" min="0" step="0.01" value={invoiceForm.valorOriginal} onChange={(e)=>setInvoiceForm({...invoiceForm,valorOriginal:e.target.value})} /></div><div className="space-y-2"><Label>Desconto adicional</Label><Input type="number" min="0" step="0.01" value={invoiceForm.descontoManual} onChange={(e)=>setInvoiceForm({...invoiceForm,descontoManual:e.target.value})} /></div>
        <div className="space-y-2"><Label>Multa</Label><Input type="number" min="0" step="0.01" value={invoiceForm.multa} onChange={(e)=>setInvoiceForm({...invoiceForm,multa:e.target.value})} /></div><div className="space-y-2"><Label>Juros</Label><Input type="number" min="0" step="0.01" value={invoiceForm.juros} onChange={(e)=>setInvoiceForm({...invoiceForm,juros:e.target.value})} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>PIX específico (opcional)</Label><Textarea placeholder="Deixe vazio para usar o PIX padrão" value={invoiceForm.pixCopiaCola} onChange={(e)=>setInvoiceForm({...invoiceForm,pixCopiaCola:e.target.value})} /></div><div className="space-y-2 sm:col-span-2"><Label>Link de pagamento (opcional)</Label><Input value={invoiceForm.linkPagamento} onChange={(e)=>setInvoiceForm({...invoiceForm,linkPagamento:e.target.value})} /></div>
      </div><DialogFooter><Button variant="outline" onClick={()=>setInvoiceDialog(false)}>Cancelar</Button><Button onClick={createInvoice} disabled={saving}>Criar fatura</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={scholarshipDialog} onOpenChange={(open)=>{setScholarshipDialog(open);if(!open){setEditingScholarship(null);setScholarshipForm(blankScholarship);}}}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editingScholarship ? "Editar bolsa" : "Nova bolsa de estudo"}</DialogTitle><DialogDescription>Defina o desconto e o período de validade da bolsa.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2"><Label>Aluno *</Label><Select disabled={!!editingScholarship} value={scholarshipForm.alunoId} onValueChange={(value)=>setScholarshipForm({...scholarshipForm,alunoId:value})}><SelectTrigger><SelectValue placeholder="Selecione o aluno" /></SelectTrigger><SelectContent>{students.sort((a,b)=>a.nome.localeCompare(b.nome)).map((item)=><SelectItem key={item.uid} value={item.uid}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2 sm:col-span-2"><Label>Nome da bolsa *</Label><Input value={scholarshipForm.nome} onChange={(e)=>setScholarshipForm({...scholarshipForm,nome:e.target.value})} /></div>
        <div className="space-y-2"><Label>Tipo *</Label><Select value={scholarshipForm.tipo} onValueChange={(value:any)=>setScholarshipForm({...scholarshipForm,tipo:value})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentual">Percentual</SelectItem><SelectItem value="valor_fixo">Valor fixo</SelectItem><SelectItem value="integral">Integral (100%)</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>{scholarshipForm.tipo === "percentual" ? "Percentual (%)" : "Valor do desconto"}</Label><Input type="number" disabled={scholarshipForm.tipo === "integral"} value={scholarshipForm.tipo === "integral" ? "100" : scholarshipForm.valor} onChange={(e)=>setScholarshipForm({...scholarshipForm,valor:e.target.value})} /></div>
        <div className="space-y-2"><Label>Início *</Label><Input type="date" value={scholarshipForm.dataInicio} onChange={(e)=>setScholarshipForm({...scholarshipForm,dataInicio:e.target.value})} /></div><div className="space-y-2"><Label>Fim (opcional)</Label><Input type="date" value={scholarshipForm.dataFim} onChange={(e)=>setScholarshipForm({...scholarshipForm,dataFim:e.target.value})} /></div>
        <div className="space-y-2 sm:col-span-2"><Label>Motivo/observação</Label><Textarea value={scholarshipForm.motivo} onChange={(e)=>setScholarshipForm({...scholarshipForm,motivo:e.target.value})} /></div>
      </div><DialogFooter><Button variant="outline" onClick={()=>setScholarshipDialog(false)}>Cancelar</Button><Button onClick={saveScholarship} disabled={saving}>Salvar bolsa</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={settingsDialog} onOpenChange={setSettingsDialog}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Configurações de pagamento</DialogTitle><DialogDescription>Dados padrão exibidos nas faturas dos alunos.</DialogDescription></DialogHeader><div className="space-y-4">
        <div className="space-y-2"><Label>Beneficiário</Label><Input value={settingsForm.beneficiario} onChange={(e)=>setSettingsForm({...settingsForm,beneficiario:e.target.value})} /></div><div className="space-y-2"><Label>Chave PIX</Label><Input value={settingsForm.chavePix} onChange={(e)=>setSettingsForm({...settingsForm,chavePix:e.target.value})} /></div><div className="space-y-2"><Label>PIX copia e cola</Label><Textarea value={settingsForm.pixCopiaCola} onChange={(e)=>setSettingsForm({...settingsForm,pixCopiaCola:e.target.value})} /></div><div className="space-y-2"><Label>Link padrão de pagamento</Label><Input value={settingsForm.linkPagamento} onChange={(e)=>setSettingsForm({...settingsForm,linkPagamento:e.target.value})} /></div><div className="space-y-2"><Label>Instruções</Label><Textarea value={settingsForm.instrucoes} onChange={(e)=>setSettingsForm({...settingsForm,instrucoes:e.target.value})} /></div>
      </div><DialogFooter><Button variant="outline" onClick={()=>setSettingsDialog(false)}>Cancelar</Button><Button onClick={saveSettings} disabled={saving}><Landmark className="mr-2 h-4 w-4" /> Salvar</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
