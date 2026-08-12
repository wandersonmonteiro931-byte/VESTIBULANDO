import { useMemo } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BellRing,
  BookOpen,
  CalendarClock,
  CheckCheck,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  Radio,
  RefreshCw,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortalUpdates, type PortalSectionUpdate } from "@/contexts/PortalUpdatesContext";
import { cn } from "@/lib/utils";

type PortalRole = "aluno" | "professor" | "diretor";

interface SummaryDefinition {
  area: "escolar" | "ead";
  sectionId: string;
  label: string;
  helper: string;
  icon: LucideIcon;
}

const SUMMARY_BY_ROLE: Record<PortalRole, SummaryDefinition[]> = {
  aluno: [
    { area: "escolar", sectionId: "pendentes", label: "Tarefas escolares", helper: "atividades da sua turma", icon: ClipboardCheck },
    { area: "ead", sectionId: "plano", label: "Plano de estudos", helper: "itens planejados", icon: CalendarClock },
    { area: "ead", sectionId: "programacao", label: "Aulas programadas", helper: "liberações e encontros", icon: Radio },
    { area: "ead", sectionId: "conteudos", label: "Conteúdos e materiais", helper: "aulas e materiais", icon: BookOpen },
    { area: "ead", sectionId: "simulados", label: "Simulados", helper: "provas disponíveis", icon: GraduationCap },
    { area: "escolar", sectionId: "boletim", label: "Notas e boletim", helper: "resultados publicados", icon: FileText },
  ],
  professor: [
    { area: "escolar", sectionId: "avaliacoes", label: "Atividades escolares", helper: "tarefas e avaliações", icon: ClipboardCheck },
    { area: "escolar", sectionId: "correcoes", label: "Correções escolares", helper: "entregas recebidas", icon: CheckCheck },
    { area: "ead", sectionId: "programacao", label: "Aulas programadas", helper: "turmas e horários", icon: CalendarClock },
    { area: "ead", sectionId: "conteudos", label: "Conteúdos e materiais", helper: "aulas e materiais", icon: BookOpen },
    { area: "ead", sectionId: "correcoes", label: "Redações", helper: "correções pedagógicas", icon: FileText },
    { area: "ead", sectionId: "turmas", label: "Turmas e relatórios", helper: "acompanhamento dos alunos", icon: Users },
    { area: "escolar", sectionId: "modelos-base", label: "Modelos Base", helper: "arquivos oficiais liberados", icon: FolderOpen },
  ],
  diretor: [
    { area: "escolar", sectionId: "aprovacoes", label: "Aprovações", helper: "cadastros e solicitações", icon: CheckCheck },
    { area: "escolar", sectionId: "usuarios", label: "Usuários", helper: "alunos e professores", icon: Users },
    { area: "escolar", sectionId: "turmas", label: "Turmas", helper: "organização acadêmica", icon: GraduationCap },
    { area: "ead", sectionId: "programacao", label: "Programação", helper: "aulas liberadas", icon: CalendarClock },
    { area: "ead", sectionId: "conteudos", label: "Conteúdos e materiais", helper: "materiais publicados", icon: BookOpen },
    { area: "ead", sectionId: "financeiro", label: "Financeiro", helper: "planos e cobranças", icon: CircleDollarSign },
    { area: "escolar", sectionId: "modelos-base", label: "Modelos Base", helper: "publicações institucionais", icon: FolderOpen },
  ],
};

function formatUpdateTime(timestamp: number | null) {
  if (!timestamp) return "Acompanhamento em tempo real";
  const date = new Date(timestamp);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? `Hoje, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function sectionFor(
  sections: PortalSectionUpdate[],
  area: "escolar" | "ead",
  sectionId: string,
) {
  return sections.find((section) => section.area === area && section.sectionId === sectionId);
}

export function UnifiedPortalOverview({
  role,
  firstName,
}: {
  role: PortalRole;
  firstName?: string;
}) {
  const { sections, newCount, loading, markAllSeen } = usePortalUpdates();
  const summaries = SUMMARY_BY_ROLE[role];
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Bom dia" : now.getHours() < 18 ? "Boa tarde" : "Boa noite";

  const recentSections = useMemo(
    () => [...sections]
      .filter((section) => section.sectionId !== "inicio" && section.signature)
      .sort((left, right) => {
        if (left.isNew !== right.isNew) return left.isNew ? -1 : 1;
        return (right.lastUpdatedAt || 0) - (left.lastUpdatedAt || 0);
      })
      .slice(0, 8),
    [sections],
  );

  return (
    <section className="mb-10 space-y-6" aria-labelledby="portal-overview-title">
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_0.7fr] lg:p-8">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <LayoutDashboard className="h-3.5 w-3.5" />
                Portal completo
              </Badge>
              {newCount > 0 && (
                <Badge className="gap-1.5 border-0 bg-amber-500 text-white shadow-sm">
                  <BellRing className="h-3.5 w-3.5" />
                  {newCount} {newCount === 1 ? "seção atualizada" : "seções atualizadas"}
                </Badge>
              )}
            </div>
            <h2 id="portal-overview-title" className="text-3xl font-bold tracking-tight sm:text-4xl">
              {greeting}{firstName ? `, ${firstName}` : ""}!
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Todas as áreas acadêmicas reunidas em uma única visão. Acompanhe aulas, tarefas,
              materiais, resultados, comunicação e pendências sem trocar de sistema.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/ead/programacao">
                <Button className="gap-2">
                  <CalendarClock className="h-4 w-4" />
                  Ver programação
                </Button>
              </Link>
              <Link href="/chat">
                <Button variant="outline" className="gap-2">
                  <BellRing className="h-4 w-4" />
                  Abrir comunicação
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border bg-background/80 p-5 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Resumo de atualizações</p>
                <p className="mt-1 text-xs text-muted-foreground">Destaques aparecem automaticamente no menu.</p>
              </div>
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-5 flex items-end gap-3">
              <span className="text-5xl font-black tracking-tight">{newCount}</span>
              <span className="pb-1 text-sm text-muted-foreground">
                {newCount === 1 ? "novidade não visualizada" : "novidades não visualizadas"}
              </span>
            </div>
            {newCount > 0 ? (
              <Button variant="ghost" size="sm" className="mt-4 gap-2 px-0" onClick={markAllSeen}>
                <CheckCheck className="h-4 w-4" />
                Marcar todas como vistas
              </Button>
            ) : (
              <p className="mt-4 text-xs text-emerald-600 dark:text-emerald-400">Você está em dia com o portal.</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">Resumo de todas as áreas</h3>
            <p className="text-sm text-muted-foreground">Os números são atualizados pelo Firestore em tempo real.</p>
          </div>
          {loading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((definition) => {
            const section = sectionFor(sections, definition.area, definition.sectionId);
            const Icon = definition.icon;
            const content = (
              <Card
                className={cn(
                  "h-full transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                  section?.isNew && "border-amber-400 bg-amber-50/50 shadow-sm dark:bg-amber-950/20",
                )}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-sm font-semibold">{definition.label}</CardTitle>
                    <CardDescription className="mt-1">{definition.helper}</CardDescription>
                  </div>
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  {loading && !section?.signature ? (
                    <Skeleton className="h-9 w-20" />
                  ) : (
                    <div className="flex items-end justify-between gap-3">
                      <span className="text-3xl font-black tracking-tight">{section?.count || 0}</span>
                      <div className="flex items-center gap-2">
                        {section?.isNew && <Badge className="bg-amber-500 text-white">Novo</Badge>}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
            return section?.href ? <Link key={`${definition.area}-${definition.sectionId}`} href={section.href}>{content}</Link> : <div key={`${definition.area}-${definition.sectionId}`}>{content}</div>;
          })}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Atualizações recentes</CardTitle>
            <CardDescription>
              Toda seção alterada recebe destaque no menu e permanece marcada até ser aberta.
            </CardDescription>
          </div>
          <BellRing className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          {loading && !recentSections.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)}
            </div>
          ) : recentSections.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {recentSections.map((section) => (
                <Link key={section.key} href={section.href}>
                  <div
                    className={cn(
                      "flex h-full items-center gap-3 rounded-xl border p-4 transition hover:border-primary/40 hover:bg-muted/30",
                      section.isNew && "border-amber-400 bg-amber-50/60 dark:bg-amber-950/20",
                    )}
                  >
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground",
                      section.isNew && "bg-amber-500 text-white",
                    )}>
                      {section.area === "ead" ? <GraduationCap className="h-5 w-5" /> : <LayoutDashboard className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{section.label}</p>
                        {section.isNew && <Badge className="h-5 bg-amber-500 px-1.5 text-[10px] text-white">Novo</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {section.area === "ead" ? "Ensino e preparação" : "Rotina acadêmica"} · {formatUpdateTime(section.lastUpdatedAt)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <BellRing className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-semibold">Nenhuma atualização encontrada</p>
              <p className="mt-1 text-sm text-muted-foreground">As novidades aparecerão aqui automaticamente.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
