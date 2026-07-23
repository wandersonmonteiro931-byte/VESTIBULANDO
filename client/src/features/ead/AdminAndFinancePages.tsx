import { useMemo, useState } from "react";
import { Link } from "wouter";
import { addDays, format } from "date-fns";
import { where } from "firebase/firestore";
import {
  AlertTriangle,
  BadgeDollarSign,
  Ban,
  BellRing,
  BookOpen,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  CloudDownload,
  CreditCard,
  DatabaseBackup,
  FileCheck2,
  FileClock,
  FileJson,
  FileText,
  Gift,
  History,
  KeyRound,
  LifeBuoy,
  Loader2,
  LockKeyhole,
  Megaphone,
  MessageSquareWarning,
  PackageCheck,
  Percent,
  Plus,
  QrCode,
  Receipt,
  RefreshCcw,
  Search,
  Send,
  ServerCog,
  ShieldCheck,
  TicketCheck,
  Undo2,
  UserCheck,
  UserCog,
  UserX,
  Users,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_PLANS } from "./catalog";
import {
  createEadRecord,
  eadNow,
  imageFileToDataUrl,
  setEadRecord,
  updateEadRecord,
  useEadCollection,
} from "./store";
import type {
  EadAuditLog,
  EadCharge,
  EadPlan,
  EadSupportTicket,
} from "./types";
import {
  EmptyState,
  Field,
  SectionHeader,
  StatCard,
  StatusBadge,
  formatCurrency,
  formatDate,
} from "./ui";

function actorFromUser(userData: any) {
  return userData
    ? { uid: userData.uid, nome: userData.nome || "Usuário", tipo: userData.tipo || "aluno" }
    : null;
}

function mergeById<T extends { id: string }>(defaults: T[], remote: T[]) {
  const records = new Map<string, T>();
  defaults.forEach((item) => records.set(item.id, item));
  remote.forEach((item) => records.set(item.id, item));
  return Array.from(records.values());
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function createReference(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function FinancePage() {
  const { userData } = useAuth() as any;
  const { toast } = useToast();
  const uid = userData?.uid || "";
  const role = userData?.tipo || "aluno";
  const actor = actorFromUser(userData);
  const [checkout, setCheckout] = useState<EadPlan | null>(null);
  const [method, setMethod] = useState<EadCharge["method"]>("pix");
  const [couponCode, setCouponCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [planForm, setPlanForm] = useState({
    name: "",
    price: 49.9,
    period: "mensal",
    description: "",
    features: "",
  });
  const [couponForm, setCouponForm] = useState({ code: "", percent: 10, expiresAt: "" });

  const remotePlans = useEadCollection<EadPlan>("eadPlans", {});
  const charges = useEadCollection<EadCharge>("eadCharges", {
    constraints: role === "aluno" && uid ? [where("ownerId", "==", uid)] : [],
    enabled: !!uid,
    sort: (a, b) => b.createdAt.localeCompare(a.createdAt),
  });
  const coupons = useEadCollection<any>("eadCoupons", {
    filter: (coupon) => coupon.active !== false,
  });
  const plans = useMemo(
    () => mergeById(DEFAULT_PLANS, remotePlans.data).filter((plan) => plan.active),
    [remotePlans.data],
  );

  const pendingTotal = charges.data
    .filter((charge) => charge.status === "pendente" || charge.status === "vencido")
    .reduce((sum, charge) => sum + charge.amount, 0);
  const paidTotal = charges.data
    .filter((charge) => charge.status === "pago")
    .reduce((sum, charge) => sum + charge.amount, 0);
  const activeCoupon = coupons.data.find(
    (coupon) =>
      String(coupon.code).toUpperCase() === couponCode.trim().toUpperCase() &&
      (!coupon.expiresAt || new Date(coupon.expiresAt) >= new Date()),
  );
  const discount = checkout && activeCoupon
    ? Math.round(checkout.price * (Math.min(100, Number(activeCoupon.percent) || 0) / 100) * 100) / 100
    : 0;

  const createCharge = async () => {
    if (!checkout || !uid) return;
    setSaving(true);
    try {
      const reference = createReference(method.toUpperCase());
      const chargeId = await createEadRecord(
        "eadCharges",
        {
          ownerId: uid,
          ownerName: userData?.nome || "Aluno",
          planId: checkout.id,
          planName: checkout.name,
          amount: Math.max(0, checkout.price - discount),
          originalAmount: checkout.price,
          dueDate: format(addDays(new Date(), 5), "yyyy-MM-dd"),
          method,
          status: "pendente",
          paymentReference: reference,
          pixCode: method === "pix" ? reference : undefined,
          barcode: method === "boleto" ? reference.replace(/\D/g, "").padEnd(44, "0").slice(0, 44) : undefined,
          couponCode: activeCoupon?.code,
          discount,
          createdAt: eadNow(),
          updatedAt: eadNow(),
        },
        actor,
        `${checkout.name} — ${method}`,
      );
      setCheckout(null);
      setCouponCode("");
      toast({
        title: "Cobrança preparada",
        description: "A referência foi criada. O acesso é liberado automaticamente quando a direção ou o provedor confirmar o pagamento.",
      });
    } catch (error: any) {
      toast({ title: "Erro ao preparar cobrança", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateChargeStatus = async (
    charge: EadCharge,
    status: EadCharge["status"],
  ) => {
    if (role !== "diretor") return;
    setSaving(true);
    try {
      await updateEadRecord(
        "eadCharges",
        charge.id,
        {
          status,
          paidAt: status === "pago" ? eadNow() : charge.paidAt,
          refundedAt: status === "reembolsado" ? eadNow() : undefined,
        },
        actor,
        `${charge.ownerName} — ${charge.planName}`,
      );
      if (status === "pago") {
        await updateEadRecord(
          "usuarios",
          charge.ownerId,
          {
            eadSubscriptionActive: true,
            eadPlanId: charge.planId,
            eadPlanName: charge.planName,
            eadAccessReleasedAt: eadNow(),
          },
          actor,
          `Liberação automática: ${charge.ownerName}`,
        );
      }
      if (status === "cancelado" || status === "reembolsado") {
        await updateEadRecord(
          "usuarios",
          charge.ownerId,
          { eadSubscriptionActive: false },
          actor,
          `Acesso financeiro revogado: ${charge.ownerName}`,
        );
      }
      toast({ title: "Situação financeira atualizada" });
    } catch (error: any) {
      toast({ title: "Erro ao atualizar cobrança", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const uploadReceipt = async (charge: EadCharge, file?: File) => {
    if (!file) return;
    try {
      const receiptDataUrl = await imageFileToDataUrl(file, 1200, 0.7);
      await updateEadRecord(
        "eadCharges",
        charge.id,
        { receiptDataUrl },
        actor,
        `Comprovante: ${charge.planName}`,
      );
      toast({ title: "Comprovante anexado", description: "A imagem foi comprimida e salva sem Firebase Storage." });
    } catch (error: any) {
      toast({ title: "Erro no comprovante", description: error.message, variant: "destructive" });
    }
  };

  const savePlan = async () => {
    if (role !== "diretor" || !planForm.name.trim() || planForm.price < 0) return;
    setSaving(true);
    try {
      await createEadRecord(
        "eadPlans",
        {
          name: planForm.name.trim(),
          price: Number(planForm.price),
          period: planForm.period,
          description: planForm.description.trim(),
          features: planForm.features.split("\n").map((item) => item.trim()).filter(Boolean),
          active: true,
        },
        actor,
        planForm.name,
      );
      setPlanForm({ name: "", price: 49.9, period: "mensal", description: "", features: "" });
      toast({ title: "Plano financeiro criado" });
    } catch (error: any) {
      toast({ title: "Erro ao criar plano", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveCoupon = async () => {
    if (role !== "diretor" || !couponForm.code.trim()) return;
    setSaving(true);
    try {
      await createEadRecord(
        "eadCoupons",
        {
          code: couponForm.code.trim().toUpperCase(),
          percent: Math.max(0, Math.min(100, Number(couponForm.percent))),
          expiresAt: couponForm.expiresAt || undefined,
          active: true,
        },
        actor,
        couponForm.code,
      );
      setCouponForm({ code: "", percent: 10, expiresAt: "" });
      toast({ title: "Cupom criado" });
    } catch (error: any) {
      toast({ title: "Erro ao criar cupom", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Financeiro"
        title={role === "diretor" ? "Mensalidades e liberações" : "Planos e pagamentos"}
        description={
          role === "diretor"
            ? "Gerencie planos, descontos, cobranças, comprovantes, inadimplência, cancelamentos, reembolsos e acesso após pagamento."
            : "Escolha ou renove seu plano, gere a cobrança e acompanhe vencimentos, comprovantes e histórico."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cobranças" value={charges.data.length} icon={Receipt} />
        <StatCard label="A receber" value={formatCurrency(pendingTotal)} icon={FileClock} tone="warning" />
        <StatCard label="Recebido" value={formatCurrency(paidTotal)} icon={CheckCircle2} tone="success" />
        <StatCard label="Inadimplentes" value={charges.data.filter((charge) => charge.status === "vencido" || (charge.status === "pendente" && new Date(charge.dueDate) < new Date())).length} icon={AlertTriangle} tone="danger" />
      </div>

      <Tabs defaultValue={role === "diretor" ? "cobrancas" : "planos"}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="planos">{role === "diretor" ? "Planos" : "Contratar / renovar"}</TabsTrigger>
          <TabsTrigger value="cobrancas">{role === "diretor" ? "Cobranças" : "Minhas cobranças"}</TabsTrigger>
          {role === "diretor" && <TabsTrigger value="descontos">Descontos e cupons</TabsTrigger>}
          <TabsTrigger value="orientacoes">Como funciona</TabsTrigger>
        </TabsList>

        <TabsContent value="planos" className="mt-5 space-y-6">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.id} className="flex flex-col">
                <CardHeader className="flex-1">
                  <Badge className="mb-2 w-fit" variant="secondary">{plan.period}</Badge>
                  <CardTitle>{plan.name}</CardTitle>
                  <div className="pt-2 text-3xl font-bold">{formatCurrency(plan.price)}<span className="text-sm font-normal text-muted-foreground"> / {plan.period}</span></div>
                  <CardDescription className="pt-2">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="mb-5 space-y-2 text-sm">
                    {plan.features.map((feature) => <li key={feature} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{feature}</li>)}
                  </ul>
                  {role === "aluno" && <Button className="w-full" onClick={() => setCheckout(plan)}><WalletCards className="mr-2 h-4 w-4" />Selecionar plano</Button>}
                </CardContent>
              </Card>
            ))}
          </div>
          {role === "diretor" && (
            <Card>
              <CardHeader><CardTitle>Criar novo plano</CardTitle><CardDescription>Cadastre preço, período e benefícios.</CardDescription></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="Nome" htmlFor="plan-name"><Input id="plan-name" value={planForm.name} onChange={(event) => setPlanForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                <Field label="Preço" htmlFor="plan-price"><Input id="plan-price" type="number" min={0} step={0.01} value={planForm.price} onChange={(event) => setPlanForm((current) => ({ ...current, price: Number(event.target.value) }))} /></Field>
                <Field label="Período" htmlFor="plan-period"><Select value={planForm.period} onValueChange={(value) => setPlanForm((current) => ({ ...current, period: value }))}><SelectTrigger id="plan-period"><SelectValue /></SelectTrigger><SelectContent>{["mensal", "trimestral", "semestral", "anual"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Descrição" htmlFor="plan-description"><Input id="plan-description" value={planForm.description} onChange={(event) => setPlanForm((current) => ({ ...current, description: event.target.value }))} /></Field>
                <div className="md:col-span-2"><Field label="Benefícios (um por linha)" htmlFor="plan-features"><Textarea id="plan-features" value={planForm.features} onChange={(event) => setPlanForm((current) => ({ ...current, features: event.target.value }))} /></Field></div>
                <div className="md:col-span-2 flex justify-end"><Button onClick={savePlan} disabled={saving}><Plus className="mr-2 h-4 w-4" />Criar plano</Button></div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cobrancas" className="mt-5">
          {charges.data.length ? (
            <div className="space-y-3">
              {charges.data.map((charge) => {
                const displayStatus =
                  charge.status === "pendente" && new Date(`${charge.dueDate}T23:59:59`) < new Date()
                    ? "vencido"
                    : charge.status;
                return (
                  <Card key={charge.id}>
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                        <div className="rounded-xl bg-primary/10 p-3 text-primary">{charge.method === "pix" ? <QrCode className="h-5 w-5" /> : charge.method === "cartao" ? <CreditCard className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}</div>
                        <div className="min-w-0 flex-1"><p className="font-semibold">{charge.planName}</p><p className="mt-1 text-sm text-muted-foreground">{role === "diretor" && `${charge.ownerName} · `}{charge.method.toUpperCase()} · vence {formatDate(charge.dueDate)}</p>{(charge as any).paymentReference && <p className="mt-1 break-all font-mono text-xs text-muted-foreground">Ref.: {(charge as any).paymentReference}</p>}</div>
                        <div className="text-left lg:text-right"><p className="text-lg font-bold">{formatCurrency(charge.amount)}</p>{charge.discount > 0 && <p className="text-xs text-emerald-600">desconto {formatCurrency(charge.discount)}</p>}</div>
                        <StatusBadge status={displayStatus} />
                        <div className="flex flex-wrap gap-2">
                          {role === "aluno" && charge.status === "pendente" && (
                            <>
                              {charge.paymentLink && <a href={charge.paymentLink} target="_blank" rel="noreferrer"><Button size="sm">Pagar no provedor</Button></a>}
                              <Label htmlFor={`receipt-${charge.id}`} className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted"><Receipt className="mr-2 h-3.5 w-3.5" />Anexar comprovante</Label>
                              <Input id={`receipt-${charge.id}`} type="file" accept="image/*" className="sr-only" onChange={(event) => uploadReceipt(charge, event.target.files?.[0])} />
                            </>
                          )}
                          {role === "diretor" && charge.status !== "pago" && <Button size="sm" onClick={() => updateChargeStatus(charge, "pago")} disabled={saving}><UserCheck className="mr-2 h-4 w-4" />Confirmar pagamento</Button>}
                          {role === "diretor" && charge.status === "pendente" && <Button size="sm" variant="outline" onClick={() => updateChargeStatus(charge, "cancelado")}><Ban className="mr-2 h-4 w-4" />Cancelar</Button>}
                          {role === "diretor" && charge.status === "pago" && <Button size="sm" variant="outline" onClick={() => updateChargeStatus(charge, "reembolsado")}><Undo2 className="mr-2 h-4 w-4" />Reembolsar</Button>}
                          {charge.receiptDataUrl && <a href={charge.receiptDataUrl} download={`comprovante-${charge.id}.jpg`}><Button size="sm" variant="outline">Ver comprovante</Button></a>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : <EmptyState title="Nenhuma cobrança registrada" description={role === "aluno" ? "Escolha um plano para gerar sua primeira cobrança." : "As matrículas e renovações aparecerão aqui."} icon={Receipt} />}
        </TabsContent>

        {role === "diretor" && (
          <TabsContent value="descontos" className="mt-5">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <Card>
                <CardHeader><Gift className="mb-2 h-6 w-6 text-primary" /><CardTitle>Novo cupom</CardTitle><CardDescription>Crie desconto percentual com validade opcional.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <Field label="Código" htmlFor="coupon-code"><Input id="coupon-code" value={couponForm.code} onChange={(event) => setCouponForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} /></Field>
                  <Field label="Desconto (%)" htmlFor="coupon-percent"><Input id="coupon-percent" type="number" min={0} max={100} value={couponForm.percent} onChange={(event) => setCouponForm((current) => ({ ...current, percent: Number(event.target.value) }))} /></Field>
                  <Field label="Validade" htmlFor="coupon-expiry"><Input id="coupon-expiry" type="date" value={couponForm.expiresAt} onChange={(event) => setCouponForm((current) => ({ ...current, expiresAt: event.target.value }))} /></Field>
                  <Button onClick={saveCoupon} disabled={saving} className="w-full"><Percent className="mr-2 h-4 w-4" />Criar cupom</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Cupons ativos</CardTitle><CardDescription>Códigos disponíveis no checkout.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {coupons.data.map((coupon: any) => <div key={coupon.id} className="flex items-center gap-3 rounded-xl border p-4"><div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600"><Gift className="h-4 w-4" /></div><div className="flex-1"><p className="font-mono font-bold">{coupon.code}</p><p className="text-xs text-muted-foreground">{coupon.percent}% · {coupon.expiresAt ? `até ${formatDate(coupon.expiresAt)}` : "sem vencimento"}</p></div><StatusBadge status={coupon.active === false ? "inativo" : "ativo"} /></div>)}
                  {!coupons.data.length && <EmptyState title="Nenhum cupom" description="Crie o primeiro código de desconto." icon={Gift} />}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        <TabsContent value="orientacoes" className="mt-5">
          <Card>
            <CardHeader><ShieldCheck className="mb-2 h-6 w-6 text-primary" /><CardTitle>Fluxo financeiro seguro</CardTitle><CardDescription>O sistema não guarda número de cartão nem credenciais bancárias.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {[
                ["1. Cobrança", "Aluno escolhe plano, método e cupom; o sistema cria referência e vencimento."],
                ["2. Pagamento", "Um link de provedor pode ser associado pela direção. Pix, boleto e cartão reais exigem contrato e credenciais do provedor."],
                ["3. Liberação", "Quando o pagamento é confirmado, o sistema ativa o plano do aluno automaticamente."],
              ].map(([title, description]) => <div key={title} className="rounded-xl border p-4"><p className="font-semibold">{title}</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!checkout} onOpenChange={(open) => !open && setCheckout(null)}>
        <DialogContent>
          {checkout && (
            <>
              <DialogHeader><DialogTitle>Contratar {checkout.name}</DialogTitle><DialogDescription>Escolha o método e aplique um cupom, se tiver.</DialogDescription></DialogHeader>
              <div className="space-y-4">
                <Field label="Forma de pagamento" htmlFor="checkout-method"><Select value={method} onValueChange={(value: EadCharge["method"]) => setMethod(value)}><SelectTrigger id="checkout-method"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pix">Pix</SelectItem><SelectItem value="boleto">Boleto</SelectItem><SelectItem value="cartao">Cartão pelo provedor</SelectItem></SelectContent></Select></Field>
                <Field label="Cupom de desconto" htmlFor="checkout-coupon"><Input id="checkout-coupon" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="Digite o código" /></Field>
                {couponCode && <p className={`text-sm ${activeCoupon ? "text-emerald-600" : "text-destructive"}`}>{activeCoupon ? `Cupom aplicado: ${activeCoupon.percent}% de desconto.` : "Cupom inválido ou vencido."}</p>}
                <div className="rounded-xl bg-muted p-4">
                  <div className="flex justify-between text-sm"><span>Plano</span><span>{formatCurrency(checkout.price)}</span></div>
                  <div className="mt-2 flex justify-between text-sm text-emerald-600"><span>Desconto</span><span>− {formatCurrency(discount)}</span></div>
                  <div className="mt-3 flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>{formatCurrency(Math.max(0, checkout.price - discount))}</span></div>
                </div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setCheckout(null)}>Cancelar</Button><Button onClick={createCharge} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Gerar cobrança</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdminManagementPage() {
  const { userData } = useAuth() as any;
  const { toast } = useToast();
  const actor = actorFromUser(userData);
  const [search, setSearch] = useState("");
  const [announcement, setAnnouncement] = useState({ title: "", message: "" });
  const [saving, setSaving] = useState(false);

  const users = useEadCollection<any>("usuarios", {});
  const lessons = useEadCollection<any>("eadLessons", {});
  const questions = useEadCollection<any>("eadQuestions", {});
  const exams = useEadCollection<any>("eadExams", {});
  const themes = useEadCollection<any>("eadEssayThemes", {});
  const live = useEadCollection<any>("eadLiveClasses", {});
  const topics = useEadCollection<any>("eadForumTopics", {});
  const tickets = useEadCollection<EadSupportTicket>("eadSupportTickets", {
    sort: (a, b) => b.createdAt.localeCompare(a.createdAt),
  });

  const filteredUsers = users.data.filter((user) => {
    const term = search.toLowerCase().trim();
    return !term || `${user.nome} ${user.email} ${user.tipo} ${user.turma || ""}`.toLowerCase().includes(term);
  });

  const toggleUser = async (user: any) => {
    if (user.tipo === "diretor") return;
    try {
      const active = !(user.ativo !== false && user.bloqueado !== true);
      await updateEadRecord(
        "usuarios",
        user.id,
        { ativo: active, bloqueado: !active },
        actor,
        `${active ? "Suspender" : "Reativar"} ${user.nome}`,
      );
      toast({ title: active ? "Usuário suspenso" : "Usuário reativado" });
    } catch (error: any) {
      toast({ title: "Erro ao alterar acesso", description: error.message, variant: "destructive" });
    }
  };

  const togglePublished = async (collectionName: string, item: any) => {
    try {
      await updateEadRecord(collectionName, item.id, { published: !item.published }, actor, item.title || item.statement);
      toast({ title: item.published ? "Publicação ocultada" : "Conteúdo publicado" });
    } catch (error: any) {
      toast({ title: "Erro ao atualizar publicação", description: error.message, variant: "destructive" });
    }
  };

  const publishAnnouncement = async () => {
    if (!announcement.title.trim() || !announcement.message.trim()) return;
    setSaving(true);
    try {
      await createEadRecord(
        "announcements",
        {
          titulo: announcement.title.trim(),
          conteudo: announcement.message.trim(),
          ativo: true,
          criadoPor: userData?.uid,
          criadoPorNome: userData?.nome,
          dataCriacao: eadNow(),
        },
        actor,
        announcement.title,
      );
      setAnnouncement({ title: "", message: "" });
      toast({ title: "Comunicado publicado" });
    } catch (error: any) {
      toast({ title: "Erro ao publicar comunicado", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Gestão administrativa"
        title="Central do preparatório EAD"
        description="Gerencie acessos, publicações, alunos, professores, conteúdos, avisos, moderação e atendimento sem substituir a gestão escolar já existente."
        action={<Link href="/diretor"><Button variant="outline"><UserCog className="mr-2 h-4 w-4" />Abrir gestão escolar original</Button></Link>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Usuários" value={users.data.length} icon={Users} />
        <StatCard label="Conteúdos" value={lessons.data.length} icon={BookOpen} />
        <StatCard label="Questões" value={questions.data.length} icon={ClipboardList} />
        <StatCard label="Avaliações" value={exams.data.length + themes.data.length} icon={FileCheck2} />
        <StatCard label="Atendimentos" value={tickets.data.filter((ticket) => ticket.status !== "resolvido").length} icon={LifeBuoy} tone="warning" />
      </div>

      <Tabs defaultValue="usuarios">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="usuarios">Usuários e acessos</TabsTrigger>
          <TabsTrigger value="publicacoes">Publicações</TabsTrigger>
          <TabsTrigger value="avisos">Avisos</TabsTrigger>
          <TabsTrigger value="moderacao">Moderação</TabsTrigger>
          <TabsTrigger value="estrutura">Estrutura escolar</TabsTrigger>
        </TabsList>
        <TabsContent value="usuarios" className="mt-5 space-y-4">
          <div className="relative max-w-xl"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome, e-mail, perfil ou turma..." className="pl-9" /></div>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[780px] text-sm">
                <thead><tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground"><th className="p-4">Usuário</th><th className="p-4">Perfil</th><th className="p-4">Turma</th><th className="p-4">Cadastro</th><th className="p-4">Acesso</th><th className="p-4 text-right">Ação</th></tr></thead>
                <tbody>{filteredUsers.map((user) => {
                  const active = user.ativo !== false && user.bloqueado !== true;
                  return <tr key={user.id} className="border-b"><td className="p-4"><p className="font-medium">{user.nome}</p><p className="text-xs text-muted-foreground">{user.email}</p></td><td className="p-4"><Badge variant="outline">{user.tipo}</Badge></td><td className="p-4">{user.turma || "—"}</td><td className="p-4"><StatusBadge status={user.status || "aprovado"} /></td><td className="p-4"><StatusBadge status={active ? "ativo" : "suspenso"} /></td><td className="p-4 text-right">{user.tipo !== "diretor" && <Button size="sm" variant={active ? "destructive" : "outline"} onClick={() => toggleUser(user)}>{active ? <UserX className="mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />}{active ? "Suspender" : "Reativar"}</Button>}</td></tr>;
                })}</tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="publicacoes" className="mt-5">
          <div className="grid gap-6 xl:grid-cols-2">
            {[
              ["Aulas e materiais", "eadLessons", lessons.data],
              ["Questões", "eadQuestions", questions.data],
              ["Simulados", "eadExams", exams.data],
              ["Temas de redação", "eadEssayThemes", themes.data],
              ["Aulas ao vivo", "eadLiveClasses", live.data],
            ].map(([title, collectionName, records]: any) => (
              <Card key={title}>
                <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{records.length} registro(s)</CardDescription></CardHeader>
                <CardContent className="max-h-96 space-y-2 overflow-y-auto">
                  {records.map((item: any) => <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title || item.statement}</p><p className="text-xs text-muted-foreground">{item.discipline || item.subject || "Conteúdo geral"}</p></div><StatusBadge status={item.published ? "publicado" : "oculto"} /><Switch checked={item.published === true} onCheckedChange={() => togglePublished(collectionName, item)} aria-label={`Alterar publicação de ${item.title || "item"}`} /></div>)}
                  {!records.length && <EmptyState title="Nenhum registro" description="O professor poderá publicar pelo estúdio." />}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="avisos" className="mt-5">
          <Card className="max-w-3xl">
            <CardHeader><Megaphone className="mb-2 h-6 w-6 text-primary" /><CardTitle>Novo comunicado geral</CardTitle><CardDescription>O aviso aparecerá na comunidade e nos painéis que já exibem comunicados.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Título" htmlFor="announcement-title"><Input id="announcement-title" value={announcement.title} onChange={(event) => setAnnouncement((current) => ({ ...current, title: event.target.value }))} /></Field>
              <Field label="Mensagem" htmlFor="announcement-message"><Textarea id="announcement-message" value={announcement.message} onChange={(event) => setAnnouncement((current) => ({ ...current, message: event.target.value }))} className="min-h-40" /></Field>
              <Button onClick={publishAnnouncement} disabled={saving}><Send className="mr-2 h-4 w-4" />Publicar comunicado</Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="moderacao" className="mt-5">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Fórum</CardTitle><CardDescription>Feche ou reabra tópicos inadequados ou concluídos.</CardDescription></CardHeader>
              <CardContent className="max-h-[500px] space-y-3 overflow-y-auto">
                {topics.data.map((topic: any) => <div key={topic.id} className="rounded-xl border p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="font-semibold">{topic.title}</p><p className="mt-1 text-xs text-muted-foreground">{topic.authorName} · {topic.discipline}</p></div><StatusBadge status={topic.status} /></div><Button className="mt-3" size="sm" variant="outline" onClick={() => updateEadRecord("eadForumTopics", topic.id, { status: topic.status === "fechado" ? "aberto" : "fechado", moderated: true }, actor, topic.title)}>{topic.status === "fechado" ? "Reabrir" : "Fechar"}</Button></div>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Atendimentos</CardTitle><CardDescription>Solicitações técnicas, pedagógicas, financeiras, reclamações e LGPD.</CardDescription></CardHeader>
              <CardContent className="max-h-[500px] space-y-3 overflow-y-auto">
                {tickets.data.map((ticket) => <AdminTicketCard key={ticket.id} ticket={ticket} actor={actor} />)}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="estrutura" className="mt-5">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Alunos e responsáveis", "Cadastros, aprovação, matrícula e dados familiares.", "Usuários"],
              ["Cursos, turmas e matrículas", "Estrutura acadêmica, vagas, enturmação e situação.", "Acadêmico"],
              ["Disciplinas e módulos", "Componentes, professores, horários e calendário.", "Acadêmico"],
              ["Permissões e auditoria", "Perfis, acessos, documentos e histórico de alterações.", "Sistema"],
            ].map(([title, description, area]) => <Card key={title}><CardHeader><CardTitle className="text-lg">{title}</CardTitle><CardDescription className="leading-relaxed">{description}</CardDescription></CardHeader><CardContent><Badge variant="secondary">Área original: {area}</Badge><Link href="/diretor"><Button variant="outline" className="mt-4 w-full">Abrir gestão</Button></Link></CardContent></Card>)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AdminTicketCard({
  ticket,
  actor,
}: {
  ticket: EadSupportTicket;
  actor: any;
}) {
  const { toast } = useToast();
  const [response, setResponse] = useState(ticket.response || "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!response.trim()) return;
    setSaving(true);
    try {
      await updateEadRecord("eadSupportTickets", ticket.id, { response: response.trim(), status: "resolvido", assignedTo: actor?.nome }, actor, ticket.subject);
      toast({ title: "Resposta enviada" });
    } catch (error: any) {
      toast({ title: "Erro ao responder", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  return <div className="rounded-xl border p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="font-semibold">{ticket.subject}</p><p className="mt-1 text-xs text-muted-foreground">{ticket.ownerName} · {ticket.category} · {formatDate(ticket.createdAt, true)}</p></div><StatusBadge status={ticket.status} /></div><p className="mt-3 text-sm text-muted-foreground">{ticket.message}</p><Textarea value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Resposta da direção..." className="mt-3" /><Button size="sm" className="mt-2" onClick={save} disabled={saving || !response.trim()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Responder e resolver</Button></div>;
}

export function SecurityPage() {
  const { userData } = useAuth() as any;
  const { toast } = useToast();
  const audits = useEadCollection<EadAuditLog>("eadAuditLogs", {
    sort: (a, b) => b.createdAt.localeCompare(a.createdAt),
  });
  const logins = useEadCollection<any>("loginHistory", {});
  const errors = useEadCollection<any>("eadSystemErrors", {
    sort: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
  });
  const users = useEadCollection<any>("usuarios", {});
  const tickets = useEadCollection<any>("eadSupportTickets", {});
  const charges = useEadCollection<any>("eadCharges", {});
  const [filter, setFilter] = useState("");

  const filteredAudits = audits.data.filter((audit) => {
    const term = filter.trim().toLowerCase();
    return !term || `${audit.userName} ${audit.action} ${audit.entity} ${audit.details || ""}`.toLowerCase().includes(term);
  });

  const backup = () => {
    downloadJson(`backup-ead-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`, {
      metadata: {
        generatedAt: eadNow(),
        generatedBy: userData?.nome,
        warning: "Backup administrativo exportado pelo navegador. Guarde em local protegido.",
      },
      users: users.data,
      supportTickets: tickets.data,
      charges: charges.data,
      auditLogs: audits.data,
      loginHistory: logins.data,
      systemErrors: errors.data,
    });
    toast({ title: "Backup JSON gerado", description: "O arquivo foi baixado para este aparelho." });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Segurança, LGPD e continuidade"
        title="Auditoria e monitoramento"
        description="Acompanhe acessos, alterações, erros e solicitações de privacidade e exporte um backup administrativo dos registros."
        action={<Button onClick={backup} className="gap-2"><DatabaseBackup className="h-4 w-4" />Gerar backup</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Usuários ativos" value={users.data.filter((user) => user.ativo !== false && user.bloqueado !== true).length} icon={UserCheck} tone="success" />
        <StatCard label="Acessos registrados" value={logins.data.length} icon={KeyRound} />
        <StatCard label="Alterações auditadas" value={audits.data.length} icon={History} />
        <StatCard label="Erros monitorados" value={errors.data.length} icon={ServerCog} tone={errors.data.length ? "warning" : "success"} />
        <StatCard label="Pedidos LGPD" value={tickets.data.filter((ticket) => ticket.category === "lgpd").length} icon={ShieldCheck} />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {[
          [LockKeyhole, "Perfis separados", "Aluno, professor e direção possuem menus e permissões distintas no banco de dados."],
          [FileText, "Termos e privacidade", "A central de ajuda apresenta uso, retenção, direitos e canal LGPD."],
          [CloudDownload, "Continuidade", "Cache local, exportação administrativa e histórico reduzem perda de informações."],
        ].map(([Icon, title, description]: any) => <Card key={title}><CardHeader><Icon className="h-6 w-6 text-primary" /><CardTitle className="text-lg">{title}</CardTitle><CardDescription className="leading-relaxed">{description}</CardDescription></CardHeader></Card>)}
      </div>

      <Tabs defaultValue="auditoria">
        <TabsList>
          <TabsTrigger value="auditoria">Alterações</TabsTrigger>
          <TabsTrigger value="acessos">Acessos</TabsTrigger>
          <TabsTrigger value="erros">Erros</TabsTrigger>
          <TabsTrigger value="politicas">Políticas</TabsTrigger>
        </TabsList>
        <TabsContent value="auditoria" className="mt-5 space-y-4">
          <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filtrar usuário, ação ou entidade..." className="max-w-xl" />
          <Card><CardContent className="max-h-[600px] overflow-auto p-0"><table className="w-full min-w-[760px] text-sm"><thead><tr className="sticky top-0 border-b bg-background text-left text-xs uppercase text-muted-foreground"><th className="p-4">Data</th><th className="p-4">Usuário</th><th className="p-4">Ação</th><th className="p-4">Entidade</th><th className="p-4">Detalhes</th></tr></thead><tbody>{filteredAudits.map((audit) => <tr key={audit.id} className="border-b"><td className="p-4">{formatDate(audit.createdAt, true)}</td><td className="p-4">{audit.userName}<span className="block text-xs text-muted-foreground">{audit.userRole}</span></td><td className="p-4"><Badge variant="outline">{audit.action}</Badge></td><td className="p-4">{audit.entity}</td><td className="p-4 text-muted-foreground">{audit.details || audit.entityId || "—"}</td></tr>)}</tbody></table></CardContent></Card>
        </TabsContent>
        <TabsContent value="acessos" className="mt-5">
          <Card><CardContent className="max-h-[600px] overflow-auto p-0"><table className="w-full min-w-[700px] text-sm"><thead><tr className="sticky top-0 border-b bg-background text-left text-xs uppercase text-muted-foreground"><th className="p-4">Data</th><th className="p-4">Usuário</th><th className="p-4">Perfil</th><th className="p-4">Evento</th><th className="p-4">Navegador</th></tr></thead><tbody>{[...logins.data].reverse().map((login) => <tr key={login.id} className="border-b"><td className="p-4">{login.timestamp}</td><td className="p-4">{login.userNome}</td><td className="p-4">{login.userTipo}</td><td className="p-4"><StatusBadge status={login.action} /></td><td className="max-w-80 truncate p-4 text-xs text-muted-foreground">{login.userAgent}</td></tr>)}</tbody></table></CardContent></Card>
        </TabsContent>
        <TabsContent value="erros" className="mt-5">
          {errors.data.length ? <div className="space-y-3">{errors.data.map((error) => <Card key={error.id}><CardContent className="flex gap-4 p-5"><div className="rounded-xl bg-destructive/10 p-3 text-destructive"><MessageSquareWarning className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-semibold">{error.source || "Erro da aplicação"}</p><p className="mt-1 break-words text-sm text-muted-foreground">{error.message}</p><p className="mt-2 text-xs text-muted-foreground">{error.userName} · {error.path} · {formatDate(error.createdAt, true)}</p></div></CardContent></Card>)}</div> : <EmptyState title="Nenhum erro registrado" description="O monitoramento do preparatório está ativo." icon={PackageCheck} />}
        </TabsContent>
        <TabsContent value="politicas" className="mt-5">
          <div className="grid gap-5 md:grid-cols-2">
            {[
              ["Controle de acesso", "Cada registro é protegido por autenticação e regras por proprietário ou perfil administrativo."],
              ["Minimização", "Somente dados necessários ao estudo, atendimento e financeiro são solicitados."],
              ["Retenção", "Histórico pedagógico e financeiro deve seguir o prazo definido pela instituição e a legislação aplicável."],
              ["Incidentes", "Erros são monitorados; suspeitas de acesso indevido devem ser registradas imediatamente pelo canal técnico."],
              ["Backup", "A direção pode exportar registros administrativos; arquivos devem ser criptografados e mantidos em local restrito."],
              ["Direitos do titular", "Acesso, correção, portabilidade, informação e exclusão são analisados pelo canal LGPD."],
            ].map(([title, description]) => <Card key={title}><CardHeader><CardTitle className="text-lg">{title}</CardTitle><CardDescription className="leading-relaxed">{description}</CardDescription></CardHeader></Card>)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
