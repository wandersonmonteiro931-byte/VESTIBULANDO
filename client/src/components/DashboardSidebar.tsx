import { useEffect, useMemo, useState, type ElementType } from "react";
import { useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { PendingIndicator } from "@/components/PendingIndicator";
import { usePortalUpdates } from "@/contexts/PortalUpdatesContext";
import {
  Accessibility,
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Eye,
  FileCheck,
  FilePenLine,
  FileText,
  Flag,
  GraduationCap,
  HelpCircle,
  Home,
  Key,
  LayoutDashboard,
  MessageCircle,
  Radio,
  School,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  Video,
  Wrench,
} from "lucide-react";

export interface MenuItem {
  id: string;
  label: string;
  icon?: ElementType;
  pendingCount?: number;
  area?: "escolar" | "ead";
}

export interface MenuCategory {
  id: string;
  label: string;
  icon: ElementType;
  items: MenuItem[];
}

interface DashboardSidebarProps {
  role: "diretor" | "professor" | "aluno";
  selectedItem: string;
  onSelectItem: (itemId: string) => void;
  pendingCounts?: Record<string, number>;
  userName?: string;
  userRole?: string;
  activeArea?: "escolar" | "ead";
  eadSection?: string;
}

const school = (id: string, label: string, icon: ElementType): MenuItem => ({ id, label, icon, area: "escolar" });
const ead = (id: string, label: string, icon: ElementType): MenuItem => ({ id, label, icon, area: "ead" });

const diretorCategories: MenuCategory[] = [
  {
    id: "visao-geral",
    label: "Visão geral",
    icon: Home,
    items: [school("inicio", "Início", Home)],
  },
  {
    id: "gestao-usuarios",
    label: "Pessoas e turmas",
    icon: Users,
    items: [
      school("aprovacoes", "Aprovações", UserCheck),
      school("lista-espera", "Lista de espera", CalendarClock),
      school("usuarios", "Alunos", Users),
      school("professores", "Professores", School),
      school("senhas-logins", "Senhas e logins", Key),
      school("turmas", "Turmas", BookOpen),
    ],
  },
  {
    id: "academico",
    label: "Acadêmico e programação",
    icon: GraduationCap,
    items: [
      school("horarios", "Grade horária", CalendarClock),
      school("calendario", "Calendário", Calendar),
      school("config-horarios", "Configurar horários", Settings),
      school("presencas", "Registro de presenças", UserCheck),
      school("bimestres", "Bimestres", CalendarDays),
      school("boletins", "Boletins", FileCheck),
      school("autorizacoes-notas", "Autorizações de notas", CheckSquare),
      ead("programacao", "Programação de aulas", CalendarClock),
    ],
  },
  {
    id: "ensino-ead",
    label: "Ensino e conteúdos",
    icon: BookOpen,
    items: [
      ead("conteudos", "Conteúdos e materiais", BookOpen),
      ead("gestao", "Gestão pedagógica", LayoutDashboard),
      ead("comunidade", "Dúvidas e fórum", MessageCircle),
    ],
  },
  {
    id: "financeiro-atendimento",
    label: "Financeiro e atendimento",
    icon: CircleDollarSign,
    items: [
      ead("financeiro", "Planos e cobranças", CircleDollarSign),
      ead("suporte", "Ajuda e suporte", HelpCircle),
      school("avisos", "Avisos", Bell),
    ],
  },
  {
    id: "monitoramento",
    label: "Monitoramento e segurança",
    icon: ShieldCheck,
    items: [
      school("monitoramento", "Frequência e atividade", Eye),
      school("auditoria-chat", "Auditoria do chat", MessageCircle),
      school("disciplinares", "Advertências", AlertTriangle),
      school("pedidos-disciplinares", "Pedidos disciplinares", Flag),
      school("denuncias", "Denúncias", Flag),
      ead("seguranca", "Segurança e LGPD", ShieldCheck),
      ead("acessibilidade", "Acessibilidade", Accessibility),
    ],
  },
  {
    id: "documentos-sistema",
    label: "Documentos e sistema",
    icon: FileText,
    items: [
      school("documentos-internos", "Documentos internos", FileText),
      school("documentacao", "Documentação", FileText),
      school("manutencao", "Manutenção", Wrench),
    ],
  },
];

const professorCategories: MenuCategory[] = [
  {
    id: "visao-geral",
    label: "Visão geral",
    icon: Home,
    items: [school("inicio", "Início", Home)],
  },
  {
    id: "agenda-aulas",
    label: "Agenda e aulas",
    icon: CalendarClock,
    items: [
      school("horarios", "Meus horários", CalendarClock),
      school("presencas", "Registro de presenças", UserCheck),
      school("aulaAoVivo", "Sala ao vivo interna", Video),
      ead("programacao", "Programação de aulas", CalendarClock),
      ead("ao-vivo", "Transmissões e encontros", Radio),
    ],
  },
  {
    id: "conteudo-pedagogico",
    label: "Conteúdo pedagógico",
    icon: BookOpen,
    items: [
      ead("estudio", "Estúdio do professor", Sparkles),
      ead("conteudos", "Conteúdos e materiais", BookOpen),
    ],
  },
  {
    id: "atividades-correcoes",
    label: "Atividades e correções",
    icon: ClipboardList,
    items: [
      school("avaliacoes", "Atividades e avaliações", ClipboardList),
      school("correcoes", "Correções escolares", CheckSquare),
      ead("correcoes", "Correções de redação", FilePenLine),
      school("bimestres", "Notas do bimestre", CalendarDays),
      school("boletins", "Boletins", FileCheck),
    ],
  },
  {
    id: "turmas-comunicacao",
    label: "Turmas e comunicação",
    icon: Users,
    items: [
      ead("turmas", "Turmas e relatórios", BarChart3),
      ead("comunidade", "Dúvidas e fórum", MessageCircle),
      school("disciplinar", "Ações disciplinares", Shield),
    ],
  },
  {
    id: "preferencias-suporte",
    label: "Preferências e suporte",
    icon: Settings,
    items: [
      ead("acessibilidade", "Acessibilidade", Accessibility),
      ead("suporte", "Ajuda e suporte", HelpCircle),
    ],
  },
];

const alunoCategories: MenuCategory[] = [
  {
    id: "visao-geral",
    label: "Visão geral",
    icon: Home,
    items: [school("inicio", "Início", Home)],
  },
  {
    id: "rotina",
    label: "Minha rotina",
    icon: CalendarDays,
    items: [
      school("horarios", "Meu horário", CalendarClock),
      school("presencas", "Minhas presenças", UserCheck),
      ead("plano", "Plano de estudos", CalendarDays),
      ead("programacao", "Programação de aulas", CalendarClock),
    ],
  },
  {
    id: "aulas-conteudos",
    label: "Aulas e conteúdos",
    icon: BookOpen,
    items: [
      school("aulas", "Minhas aulas escolares", Video),
      ead("conteudos", "Conteúdos e materiais", BookOpen),
      ead("ao-vivo", "Transmissões e encontros", Radio),
    ],
  },
  {
    id: "atividades-provas",
    label: "Atividades e provas",
    icon: ClipboardCheck,
    items: [
      school("todas", "Todas as tarefas", ClipboardList),
      school("pendentes", "Tarefas pendentes", CheckSquare),
      school("entregues", "Tarefas entregues", Award),
      school("avaliacoes", "Avaliações escolares", FileText),
      ead("questoes", "Banco de questões", ClipboardCheck),
      ead("simulados", "Simulados", GraduationCap),
      ead("redacao", "Redação", FilePenLine),
    ],
  },
  {
    id: "resultados",
    label: "Resultados e evolução",
    icon: BarChart3,
    items: [
      school("notas", "Minhas notas", Award),
      school("boletim", "Meu boletim", FileCheck),
      ead("desempenho", "Desempenho e evolução", BarChart3),
      school("advertencias", "Advertências", AlertTriangle),
    ],
  },
  {
    id: "comunidade-servicos",
    label: "Comunidade e serviços",
    icon: MessageCircle,
    items: [
      ead("comunidade", "Dúvidas e fórum", MessageCircle),
      ead("financeiro", "Financeiro", CircleDollarSign),
      ead("acessibilidade", "Acessibilidade", Accessibility),
      ead("suporte", "Ajuda e suporte", HelpCircle),
    ],
  },
];

function itemKey(item: MenuItem) {
  return `${item.area || "escolar"}:${item.id}`;
}

function pendingForItem(item: MenuItem, pendingCounts: Record<string, number>) {
  const area = item.area || "escolar";
  return pendingCounts[`${area}:${item.id}`] ?? pendingCounts[item.id] ?? 0;
}

export function DashboardSidebar({
  role,
  selectedItem,
  onSelectItem,
  pendingCounts = {},
  userName,
  userRole,
  activeArea = "escolar",
  eadSection,
}: DashboardSidebarProps) {
  const [, navigate] = useLocation();
  const { hasUpdate, markSeen, newCount } = usePortalUpdates();
  const categories = role === "diretor"
    ? diretorCategories
    : role === "professor"
      ? professorCategories
      : alunoCategories;
  const dashboardPath = role === "diretor" ? "/diretor" : role === "professor" ? "/professor" : "/aluno";

  const activeKey = activeArea === "ead"
    ? `ead:${eadSection || ""}`
    : `escolar:${selectedItem}`;

  const activeCategoryId = useMemo(
    () => categories.find((category) => category.items.some((item) => itemKey(item) === activeKey))?.id || "visao-geral",
    [activeKey, categories],
  );
  const [openCategory, setOpenCategory] = useState<string | null>(activeCategoryId);

  useEffect(() => {
    setOpenCategory(activeCategoryId);
  }, [activeCategoryId]);

  useEffect(() => {
    if (activeArea === "ead" && eadSection) markSeen("ead", eadSection);
    if (activeArea === "escolar" && selectedItem) markSeen("escolar", selectedItem);
  }, [activeArea, eadSection, markSeen, selectedItem]);

  const toggleCategory = (categoryId: string) => {
    setOpenCategory((previous) => previous === categoryId ? null : categoryId);
  };

  const handleItem = (item: MenuItem) => {
    const area = item.area || "escolar";
    markSeen(area, item.id);
    if (area === "ead") {
      navigate(`/ead/${item.id}`);
      return;
    }
    if (activeArea === "ead") {
      const suffix = item.id === "inicio" ? "" : `?secao=${encodeURIComponent(item.id)}`;
      navigate(`${dashboardPath}${suffix}`);
      return;
    }
    onSelectItem(item.id);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-3 group-data-[collapsible=icon]:p-1.5">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-sm font-semibold">Vestibulando</span>
            <span className="block truncate text-xs text-muted-foreground">
              Portal completo · {userRole || role}
            </span>
          </div>
          {newCount > 0 && (
            <Badge className="h-6 min-w-6 justify-center bg-amber-500 px-1.5 text-[10px] text-white group-data-[collapsible=icon]:hidden">
              {newCount > 99 ? "99+" : newCount}
            </Badge>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto overflow-x-hidden py-1">
        <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground group-data-[collapsible=icon]:hidden">
          Navegação unificada
        </div>

        {categories.map((category) => {
          const isOpen = openCategory === category.id;
          const categoryHasPending = category.items.some(
            (item) => pendingForItem(item, pendingCounts) > 0,
          );
          const categoryHasUpdate = category.items.some(
            (item) => hasUpdate(item.area || "escolar", item.id),
          );
          const CategoryIcon = category.icon;

          return (
            <SidebarGroup key={category.id} className="py-0.5">
              <Collapsible open={isOpen} onOpenChange={() => toggleCategory(category.id)}>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-sidebar-accent/50">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <CategoryIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{category.label}</span>
                      {categoryHasPending && <PendingIndicator size="sm" />}
                      {categoryHasUpdate && (
                        <span className="relative flex h-2 w-2 shrink-0" aria-label="Há atualização nova">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                        </span>
                      )}
                    </div>
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform" />
                    )}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent className="py-0.5">
                    <SidebarMenu>
                      {category.items.map((item) => {
                        const ItemIcon = item.icon;
                        const area = item.area || "escolar";
                        const pendingCount = pendingForItem(item, pendingCounts);
                        const isActive = area === "ead"
                          ? activeArea === "ead" && eadSection === item.id
                          : activeArea === "escolar" && selectedItem === item.id;
                        const isUpdated = hasUpdate(area, item.id);

                        return (
                          <SidebarMenuItem key={itemKey(item)}>
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => handleItem(item)}
                              className="min-h-8 py-1 pl-5"
                              data-testid={`sidebar-${area}-item-${item.id}`}
                            >
                              {ItemIcon && <ItemIcon className="h-3.5 w-3.5 shrink-0" />}
                              <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
                              {isUpdated && (
                                <Badge className="h-5 shrink-0 bg-amber-500 px-1.5 text-[9px] font-bold text-white">
                                  Novo
                                </Badge>
                              )}
                              {pendingCount > 0 && <PendingIndicator size="sm" />}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {userName && (
        <SidebarFooter className="border-t border-sidebar-border p-3 group-data-[collapsible=icon]:hidden">
          <div className="truncate text-xs font-medium">{userName}</div>
          <div className="text-[11px] text-muted-foreground">Ambiente acadêmico unificado</div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
