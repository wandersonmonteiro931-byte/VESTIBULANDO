import { useMemo, useState } from "react";
import { doc, updateDoc, where } from "firebase/firestore";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Copy,
  ExternalLink,
  GraduationCap,
  Landmark,
  ReceiptText,
  WalletCards,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { FinancialInvoice, FinancialSettings, Scholarship } from "@shared/schema";

const money = (value?: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

const dateLabel = (value?: string) => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
};

const isOverdue = (invoice: FinancialInvoice) => {
  if (["pago", "cancelado", "em_analise"].includes(invoice.status)) return false;
  const due = new Date(`${invoice.vencimento}T23:59:59`);
  return due.getTime() < Date.now();
};

const statusInfo = (invoice: FinancialInvoice) => {
  if (invoice.status === "pago") return { label: "Pago", className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  if (invoice.status === "em_analise") return { label: "Pagamento informado", className: "bg-blue-100 text-blue-800 border-blue-200" };
  if (invoice.status === "cancelado") return { label: "Cancelado", className: "bg-slate-100 text-slate-700 border-slate-200" };
  if (isOverdue(invoice)) return { label: "Vencido", className: "bg-red-100 text-red-800 border-red-200" };
  return { label: "Em aberto", className: "bg-amber-100 text-amber-800 border-amber-200" };
};

export function StudentFinanceTab() {
  const { userData } = useAuth();
  const { toast } = useToast();
  const [selectedInvoice, setSelectedInvoice] = useState<FinancialInvoice | null>(null);
  const [informingPayment, setInformingPayment] = useState(false);

  const { data: invoices = [], isLoading } = useRealtimeQuery<FinancialInvoice>({
    collectionName: "financialInvoices",
    queryKey: ["/finance/invoices/student", userData?.uid],
    constraints: userData?.uid ? [where("alunoId", "==", userData.uid)] : [],
    transform: (docs) => docs as FinancialInvoice[],
    enabled: !!userData?.uid,
  });

  const { data: scholarships = [] } = useRealtimeQuery<Scholarship>({
    collectionName: "scholarships",
    queryKey: ["/finance/scholarships/student", userData?.uid],
    constraints: userData?.uid ? [where("alunoId", "==", userData.uid)] : [],
    transform: (docs) => docs as Scholarship[],
    enabled: !!userData?.uid,
  });

  const { data: settingsList = [] } = useRealtimeQuery<FinancialSettings>({
    collectionName: "financialSettings",
    queryKey: ["/finance/settings"],
    transform: (docs) => docs as FinancialSettings[],
  });

  const settings = settingsList.find((item) => item.id === "default") || settingsList[0];

  const sortedInvoices = useMemo(
    () => [...invoices].sort((a, b) => new Date(b.vencimento).getTime() - new Date(a.vencimento).getTime()),
    [invoices],
  );

  const activeScholarship = useMemo(() => {
    const now = new Date();
    return scholarships.find((item) => {
      if (!item.ativa) return false;
      const start = item.dataInicio ? new Date(`${item.dataInicio}T00:00:00`) : null;
      const end = item.dataFim ? new Date(`${item.dataFim}T23:59:59`) : null;
      return (!start || start <= now) && (!end || end >= now);
    });
  }, [scholarships]);

  const totals = useMemo(() => {
    const open = invoices.filter((item) => !["pago", "cancelado"].includes(item.status));
    return {
      openValue: open.reduce((sum, item) => sum + Number(item.valorFinal || 0), 0),
      overdueCount: open.filter(isOverdue).length,
      paidValue: invoices.filter((item) => item.status === "pago").reduce((sum, item) => sum + Number(item.valorFinal || 0), 0),
    };
  }, [invoices]);

  const copyPix = async () => {
    const pix = selectedInvoice?.pixCopiaCola || settings?.pixCopiaCola || settings?.chavePix;
    if (!pix) {
      toast({ title: "PIX indisponível", description: "A diretoria ainda não cadastrou os dados para pagamento.", variant: "destructive" });
      return;
    }
    await navigator.clipboard.writeText(pix);
    toast({ title: "PIX copiado", description: "O código foi copiado para a área de transferência." });
  };

  const informPayment = async () => {
    if (!selectedInvoice || !userData) return;

    try {
      setInformingPayment(true);
      const now = new Date().toISOString();
      await updateDoc(doc(db, "financialInvoices", selectedInvoice.id), {
        pagamentoInformadoEm: now,
        status: "em_analise",
        atualizadoEm: now,
      });
      toast({
        title: "Pagamento informado",
        description: "A diretoria fará a conferência e confirmará a fatura.",
      });
      setSelectedInvoice(null);
    } catch (error) {
      console.error(error);
      toast({
        title: "Não foi possível informar o pagamento",
        description: "Tente novamente ou fale com a diretoria.",
        variant: "destructive",
      });
    } finally {
      setInformingPayment(false);
    }
  };

  const invoiceCard = (invoice: FinancialInvoice) => {
    const status = statusInfo(invoice);
    return (
      <Card key={invoice.id} className="finance-card overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg">{invoice.referencia}</CardTitle>
              <CardDescription className="mt-1">{invoice.descricao || "Mensalidade escolar"}</CardDescription>
            </div>
            <Badge variant="outline" className={status.className}>{status.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-muted/55 p-3">
              <p className="text-xs text-muted-foreground">Vencimento</p>
              <p className="mt-1 font-semibold">{dateLabel(invoice.vencimento)}</p>
            </div>
            <div className="rounded-xl bg-muted/55 p-3">
              <p className="text-xs text-muted-foreground">Valor original</p>
              <p className="mt-1 font-semibold">{money(invoice.valorOriginal)}</p>
            </div>
            <div className="rounded-xl bg-muted/55 p-3">
              <p className="text-xs text-muted-foreground">Descontos</p>
              <p className="mt-1 font-semibold text-emerald-700">- {money(Number(invoice.descontoBolsa || 0) + Number(invoice.descontoManual || 0))}</p>
            </div>
            <div className="rounded-xl bg-primary/8 p-3">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="mt-1 text-lg font-bold text-primary">{money(invoice.valorFinal)}</p>
            </div>
          </div>

          {invoice.bolsaDescricao && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <GraduationCap className="mt-0.5 h-4 w-4 shrink-0" />
              <div><strong>Bolsa aplicada:</strong> {invoice.bolsaDescricao}</div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!["pago", "cancelado"].includes(invoice.status) && (
              <Button onClick={() => setSelectedInvoice(invoice)}>
                <WalletCards className="mr-2 h-4 w-4" /> Pagar / informar pagamento
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 finance-student-premium" data-testid="student-finance-tab">
      <div>
        <span className="dashboard-eyebrow">Área financeira</span>
        <h2 className="dashboard-hero-title">Financeiro</h2>
        <p className="dashboard-hero-subtitle">Consulte suas faturas, pagamentos, descontos e bolsa de estudo.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="flex items-center gap-3 p-5"><div className="rounded-xl bg-amber-100 p-3 text-amber-700"><ReceiptText className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">Em aberto</p><p className="text-xl font-bold">{money(totals.openValue)}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-5"><div className="rounded-xl bg-red-100 p-3 text-red-700"><AlertTriangle className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">Faturas vencidas</p><p className="text-xl font-bold">{totals.overdueCount}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-5"><div className="rounded-xl bg-emerald-100 p-3 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">Total pago</p><p className="text-xl font-bold">{money(totals.paidValue)}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-5"><div className="rounded-xl bg-violet-100 p-3 text-violet-700"><GraduationCap className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">Bolsa atual</p><p className="text-lg font-bold">{activeScholarship ? activeScholarship.nome : "Sem bolsa"}</p></div></CardContent></Card>
      </div>

      {activeScholarship && (
        <Card className="finance-highlight-card border-emerald-200 bg-emerald-50/60">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <GraduationCap className="mt-1 h-6 w-6 text-emerald-700" />
              <div>
                <p className="font-bold text-emerald-950">{activeScholarship.nome}</p>
                <p className="text-sm text-emerald-800">{activeScholarship.tipo === "percentual" ? `${activeScholarship.valor}% de desconto` : activeScholarship.tipo === "integral" ? "100% de desconto" : `${money(activeScholarship.valor)} de desconto`}</p>
                {activeScholarship.motivo && <p className="mt-1 text-xs text-emerald-700">{activeScholarship.motivo}</p>}
              </div>
            </div>
            <div className="text-sm text-emerald-800"><CalendarDays className="mr-1 inline h-4 w-4" /> {dateLabel(activeScholarship.dataInicio)} até {activeScholarship.dataFim ? dateLabel(activeScholarship.dataFim) : "sem prazo final"}</div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="abertas">
        <TabsList className="grid w-full grid-cols-2 sm:w-[420px]">
          <TabsTrigger value="abertas">Faturas em aberto</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="abertas" className="mt-5 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, index) => (
                <Card key={index} className="finance-card overflow-hidden border-border/70 shadow-sm">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-2">
                        <Skeleton className="premium-skeleton h-5 w-32" />
                        <Skeleton className="premium-skeleton h-4 w-48" />
                      </div>
                      <Skeleton className="premium-skeleton h-6 w-20 rounded-full" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[...Array(4)].map((__, sub) => <Skeleton key={sub} className="premium-skeleton h-20 rounded-2xl" />)}
                    </div>
                    <Skeleton className="premium-skeleton h-10 w-56 rounded-xl" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : sortedInvoices.filter((item) => !["pago", "cancelado"].includes(item.status)).length ? sortedInvoices.filter((item) => !["pago", "cancelado"].includes(item.status)).map(invoiceCard) : (
            <Card className="finance-card"><CardContent className="premium-empty-state flex flex-col items-center py-12 text-center"><div className="premium-empty-icon"><CheckCircle2 className="h-7 w-7" /></div><p className="premium-empty-title">Nenhuma fatura em aberto</p><p className="premium-empty-text">Seu financeiro está em dia.</p></CardContent></Card>
          )}
        </TabsContent>
        <TabsContent value="historico" className="mt-5 space-y-4">
          {sortedInvoices.filter((item) => ["pago", "cancelado"].includes(item.status)).length ? sortedInvoices.filter((item) => ["pago", "cancelado"].includes(item.status)).map(invoiceCard) : <Card className="finance-card"><CardContent className="premium-empty-state py-12 text-center"><div className="premium-empty-icon mx-auto"><ReceiptText className="h-7 w-7" /></div><p className="premium-empty-title">Ainda não há histórico financeiro</p><p className="premium-empty-text">Quando houver pagamentos ou registros, eles aparecerão aqui.</p></CardContent></Card>}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedInvoice} onOpenChange={(open) => { if (!open) setSelectedInvoice(null); }}>
        <DialogContent className="finance-dialog sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Pagar fatura</DialogTitle>
            <DialogDescription>{selectedInvoice?.referencia} • Total {money(selectedInvoice?.valorFinal)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/35 p-4">
              <div className="mb-3 flex items-center gap-2 font-semibold"><Landmark className="h-5 w-5 text-primary" /> Pagamento via PIX</div>
              <p className="text-sm text-muted-foreground">{settings?.beneficiario ? `Beneficiário: ${settings.beneficiario}` : "Use o código PIX informado pela instituição."}</p>
              {(selectedInvoice?.pixCopiaCola || settings?.pixCopiaCola || settings?.chavePix) ? (
                <Button variant="outline" className="mt-3 w-full" onClick={copyPix}><Copy className="mr-2 h-4 w-4" /> Copiar código PIX</Button>
              ) : <p className="mt-3 text-sm text-amber-700">A diretoria ainda não cadastrou o PIX.</p>}
              {(selectedInvoice?.linkPagamento || settings?.linkPagamento) && (
                <Button className="mt-2 w-full" asChild><a href={selectedInvoice?.linkPagamento || settings?.linkPagamento} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Abrir página de pagamento</a></Button>
              )}
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              Depois de realizar o pagamento, clique em <strong>Informar pagamento</strong>. A diretoria fará a conferência e confirmará a baixa da fatura.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedInvoice(null)}>Fechar</Button>
            <Button onClick={informPayment} disabled={informingPayment}><CheckCircle2 className="mr-2 h-4 w-4" /> {informingPayment ? "Informando..." : "Informar pagamento"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
