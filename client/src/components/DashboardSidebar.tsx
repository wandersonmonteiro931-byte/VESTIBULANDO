import { useState, type ElementType } from "react";
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
import { PendingIndicator } from "@/components/PendingIndicator";
import { EAD_NAVIGATION } from "@/features/ead/navigation";
import {
  Users,
  GraduationCap,
  Activity,
  Shield,
  FileText,
  Bell,
  Settings,
  ClipboardList,
  BookOpen,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  UserCheck,
  School,
  Key,
  AlertTriangle,
  MessageSquare,
  Eye,
  Flag,
  Wrench,
  Calendar,
  FileCheck,
  Award,
  Home,
  Clock,
  Video,
  Layers3,
} from "lucide-react";

export interface MenuItem {
  id: string;
  label: string;
  icon?: ElementType;
  pendingCount?: number;
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

const diretorCategories: MenuCategory[] = [
  {
    id: "gestao-usuarios",
    label: "Gestão de Usuários",
    icon: Users,
    items: [
      { id: "aprovacoes", label: "Aprovações", icon: UserCheck },
      { id: "lista-espera", label: "Lista de Espera", icon: Clock },
      { id: "usuarios", label: "Alunos", icon: Users },
      { id: "professores", label: "Professores", icon: School },
      { id: "senhas-logins", label: "Senhas", icon: Key },
      { id: "turmas", label: "Turmas", icon: BookOpen },
    ],
  },
  {
    id: "academico",
    label: "Acadêmico",
    icon: GraduationCap,
    items: [
      { id: "horarios", label: "Grade Horária", icon: Clock },
      { id: "calendario", label: "Calendário", icon: Calendar },
      { id: "config-horarios", label: "Configurar Horários", icon: Settings },
      { id: "presencas", label: "Registro de Presenças", icon: UserCheck },
      { id: "bimestres", label: "Bimestres", icon: Calendar },
      { id: "boletins", label: "Boletins", icon: FileCheck },
      { id: "autorizacoes-notas", label: "Autorizações", icon: CheckSquare },
    ],
  },
  {
    id: "monitoramento",
    label: "Monitoramento",
    icon: Activity,
    items: [
      { id: "monitoramento", label: "Frequência", icon: Eye },
      { id: "auditoria-chat", label: "Auditoria", icon: MessageSquare },
    ],
  },
  {
    id: "disciplinar",
    label: "Disciplinar",
    icon: Shield,
    items: [
      { id: "disciplinares", label: "Advertências", icon: AlertTriangle },
      { id: "pedidos-disciplinares", label: "Pedidos Professores", icon: Flag },
      { id: "denuncias", label: "Denúncias", icon: Flag },
    ],
  },
  {
    id: "documentos",
    label: "Documentos",
    icon: FileText,
    items: [
      { id: "documentos-internos", label: "Docs Internos", icon: FileText },
      { id: "documentacao", label: "Documentação", icon: FileText },
    ],
  },
  {
    id: "avisos",
    label: "Avisos",
    icon: Bell,
    items: [
      { id: "avisos", label: "Gerenciar Avisos", icon: Bell },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: Settings,
    items: [
      { id: "manutencao", label: "Manutenção", icon: Wrench },
    ],
  },
];

const professorCategories: MenuCategory[] = [
  {
    id: "academico",
    label: "Acadêmico",
    icon: GraduationCap,
    items: [
      { id: "horarios", label: "Meus Horários", icon: Clock },
      { id: "presencas", label: "Registro de Presenças", icon: UserCheck },
    ],
  },
  {
    id: "aula-ao-vivo",
    label: "Aula ao Vivo",
    icon: Video,
    items: [
      { id: "aulaAoVivo", label: "Gerenciar Aula", icon: Video },
    ],
  },
  {
    id: "atividades",
    label: "Atividades",
    icon: ClipboardList,
    items: [
      { id: "avaliacoes", label: "Atividades e Avaliações", icon: ClipboardList },
      { id: "correcoes", label: "Correções Pendentes", icon: CheckSquare },
    ],
  },
  {
    id: "notas-boletins",
    label: "Notas e Boletins",
    icon: GraduationCap,
    items: [
      { id: "bimestres", label: "Notas Bimestre", icon: Calendar },
      { id: "boletins", label: "Boletins", icon: FileCheck },
    ],
  },
  {
    id: "disciplinar",
    label: "Disciplinar",
    icon: Shield,
    items: [
      { id: "disciplinar", label: "Ações Disciplinares", icon: AlertTriangle },
    ],
  },
];

const alunoCategories: MenuCategory[] = [
  {
    id: "academico",
    label: "Acadêmico",
    icon: GraduationCap,
    items: [
      { id: "horarios", label: "Meu Horário", icon: Clock },
      { id: "presencas", label: "Minhas Presenças", icon: UserCheck },
    ],
  },
  {
    id: "aulas-ao-vivo",
    label: "Aulas ao Vivo",
    icon: Video,
    items: [
      { id: "aulas", label: "Minhas Aulas", icon: Video },
    ],
  },
  {
    id: "tarefas",
    label: "Tarefas",
    icon: ClipboardList,
    items: [
      { id: "todas", label: "Todas as Tarefas", icon: ClipboardList },
      { id: "pendentes", label: "Pendentes", icon: CheckSquare },
      { id: "entregues", label: "Entregues", icon: Award },
    ],
  },
  {
    id: "avaliacoes",
    label: "Avaliações",
    icon: FileText,
    items: [
      { id: "avaliacoes", label: "Minhas Avaliações", icon: FileText },
    ],
  },
  {
    id: "notas-boletins",
    label: "Notas e Boletins",
    icon: GraduationCap,
    items: [
      { id: "notas", label: "Notas", icon: Award },
      { id: "boletim", label: "Boletim", icon: FileCheck },
    ],
  },
  {
    id: "disciplinar",
    label: "Disciplinar",
    icon: Shield,
    items: [
      { id: "advertencias", label: "Advertências", icon: AlertTriangle },
    ],
  },
];

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
  const categories = role === "diretor"
    ? diretorCategories
    : role === "professor"
      ? professorCategories
      : alunoCategories;

  const showHomeItem = role === "professor" || role === "aluno";
  const dashboardPath = role === "diretor" ? "/diretor" : role === "professor" ? "/professor" : "/aluno";
  const eadItems = EAD_NAVIGATION.filter((item) => item.roles.includes(role));

  const [openCategory, setOpenCategory] = useState<string | null>(() => {
    if (activeArea === "ead") return "preparatorio-ead";
    const found = categories.find((category) =>
      category.items.some((item) => item.id === selectedItem),
    );
    return found?.id || null;
  });

  const toggleCategory = (categoryId: string) => {
    setOpenCategory((previous) => previous === categoryId ? null : categoryId);
  };

  const handleSchoolItem = (itemId: string) => {
    const parentCategory = categories.find((category) =>
      category.items.some((item) => item.id === itemId),
    );
    if (parentCategory) setOpenCategory(parentCategory.id);

    if (activeArea === "ead") {
      navigate(`${dashboardPath}?secao=${encodeURIComponent(itemId)}`);
      return;
    }
    onSelectItem(itemId);
  };

  const handleSchoolHome = () => {
    if (activeArea === "ead") {
      navigate(`${dashboardPath}?secao=inicio`);
      return;
    }
    onSelectItem("inicio");
  };

  const handleEadItem = (itemId: string) => {
    setOpenCategory("preparatorio-ead");
    navigate(`/ead/${itemId}`);
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">Vestibulando</span>
            <span className="block truncate text-xs text-muted-foreground">
              Portal unificado · {userRole || role}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-1">
        <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Portal escolar
        </div>

        {showHomeItem && (
          <SidebarGroup className="py-0.5">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeArea === "escolar" && selectedItem === "inicio"}
                  onClick={handleSchoolHome}
                  data-testid="sidebar-item-inicio"
                  className="py-1.5"
                >
                  <Home className="h-4 w-4" />
                  <span>Início escolar</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        {categories.map((category) => {
          const isOpen = openCategory === category.id;
          const categoryHasPending = category.items.some(
            (item) => (pendingCounts[item.id] || 0) > 0,
          );
          const CategoryIcon = category.icon;

          return (
            <SidebarGroup key={category.id} className="py-0.5">
              <Collapsible open={isOpen} onOpenChange={() => toggleCategory(category.id)}>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-sidebar-accent/50">
                    <div className="flex items-center gap-1.5">
                      <CategoryIcon className="h-3.5 w-3.5" />
                      <span>{category.label}</span>
                      {categoryHasPending && <PendingIndicator size="sm" />}
                    </div>
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 transition-transform" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 transition-transform" />
                    )}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent className="py-0.5">
                    <SidebarMenu>
                      {category.items.map((item) => {
                        const ItemIcon = item.icon;
                        const pendingCount = pendingCounts[item.id] || 0;
                        const isActive = activeArea === "escolar" && selectedItem === item.id;

                        return (
                          <SidebarMenuItem key={item.id}>
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => handleSchoolItem(item.id)}
                              className="py-1 pl-5"
                              data-testid={`sidebar-item-${item.id}`}
                            >
                              {ItemIcon && <ItemIcon className="h-3.5 w-3.5" />}
                              <span className="flex-1 text-sm">{item.label}</span>
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

        <div className="mx-3 my-2 h-px bg-sidebar-border" />
        <div className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Preparatório EAD
        </div>

        <SidebarGroup className="py-0.5">
          <Collapsible
            open={openCategory === "preparatorio-ead"}
            onOpenChange={() => toggleCategory("preparatorio-ead")}
          >
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-sidebar-accent/50">
                <div className="flex items-center gap-1.5">
                  <Layers3 className="h-3.5 w-3.5" />
                  <span>Módulos EAD</span>
                </div>
                {openCategory === "preparatorio-ead" ? (
                  <ChevronDown className="h-3.5 w-3.5 transition-transform" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 transition-transform" />
                )}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent className="py-0.5">
                <SidebarMenu>
                  {eadItems.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = activeArea === "ead" && eadSection === item.id;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => handleEadItem(item.id)}
                          className="py-1 pl-5"
                          data-testid={`sidebar-ead-item-${item.id}`}
                        >
                          <ItemIcon className="h-3.5 w-3.5" />
                          <span className="flex-1 text-sm">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </SidebarContent>

      {userName && (
        <SidebarFooter className="border-t border-sidebar-border p-3">
          <div className="truncate text-xs font-medium">{userName}</div>
          <div className="text-[11px] text-muted-foreground">Portal escolar + EAD</div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
