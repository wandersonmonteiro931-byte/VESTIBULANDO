import { useState } from "react";
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
  WalletCards,
} from "lucide-react";

export interface MenuItem {
  id: string;
  label: string;
  icon?: React.ElementType;
  pendingCount?: number;
}

export interface MenuCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  items: MenuItem[];
}

interface DashboardSidebarProps {
  role: "diretor" | "professor" | "aluno";
  selectedItem: string;
  onSelectItem: (itemId: string) => void;
  pendingCounts?: Record<string, number>;
  userName?: string;
  userRole?: string;
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
    id: "financeiro",
    label: "Financeiro",
    icon: WalletCards,
    items: [
      { id: "financeiro", label: "Faturas e Bolsas", icon: WalletCards },
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
    id: "financeiro",
    label: "Financeiro",
    icon: WalletCards,
    items: [
      { id: "financeiro", label: "Faturas e Bolsas", icon: WalletCards },
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

interface HomeItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

export function DashboardSidebar({
  role,
  selectedItem,
  onSelectItem,
  pendingCounts = {},
  userName,
  userRole,
}: DashboardSidebarProps) {
  const categories = role === "diretor" 
    ? diretorCategories 
    : role === "professor" 
      ? professorCategories 
      : alunoCategories;

  const showHomeItem = role === "professor" || role === "aluno";

  const [openCategory, setOpenCategory] = useState<string | null>(() => {
    const found = categories.find(cat => 
      cat.items.some(item => item.id === selectedItem)
    );
    return found?.id || null;
  });

  const handleSelectItem = (itemId: string) => {
    const parentCategory = categories.find(cat => 
      cat.items.some(item => item.id === itemId)
    );
    if (parentCategory) {
      setOpenCategory(parentCategory.id);
    }
    onSelectItem(itemId);
  };

  return (
    <Sidebar className="dashboard-sidebar-modern">
      <SidebarHeader className="sidebar-modern-header">
        <div className="sidebar-modern-brand">
          <div className="sidebar-modern-logo" aria-hidden="true">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="sidebar-modern-title">Vestibulando</span>
            <span className="sidebar-modern-role">
              {userRole || role}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="sidebar-modern-content">
        {showHomeItem && (
          <SidebarGroup className="py-0.5">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={selectedItem === "inicio"}
                  onClick={() => onSelectItem("inicio")}
                  data-testid="sidebar-item-inicio"
                  className="dashboard-menu-button dashboard-home-button"
                >
                  <Home className="h-4 w-4" />
                  <span>Início</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        {categories.map((category) => {
          const isOpen = openCategory === category.id;
          const categoryHasPending = category.items.some(
            item => (pendingCounts[item.id] || 0) > 0
          );
          const CategoryIcon = category.icon;

          return (
            <SidebarGroup key={category.id} className="py-0.5">
              <Collapsible
                open={isOpen}
                onOpenChange={(nextOpen) => {
                  setOpenCategory(nextOpen ? category.id : null);
                }}
              >
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="dashboard-category-trigger">
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
                        const isActive = selectedItem === item.id;

                        return (
                          <SidebarMenuItem key={item.id}>
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => handleSelectItem(item.id)}
                              className="dashboard-menu-button dashboard-submenu-button"
                              data-testid={`sidebar-item-${item.id}`}
                            >
                              {ItemIcon && <ItemIcon className="h-3.5 w-3.5" />}
                              <span className="flex-1 text-sm">{item.label}</span>
                              {pendingCount > 0 && (
                                <PendingIndicator size="sm" />
                              )}
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
        <SidebarFooter className="sidebar-modern-footer">
          <div className="sidebar-user-avatar" aria-hidden="true">
            {userName.trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="sidebar-user-name">{userName}</div>
            <div className="sidebar-user-caption">Sessão ativa</div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
