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
import { Badge } from "@/components/ui/badge";
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
}: DashboardSidebarProps) {
  const categories = role === "diretor" 
    ? diretorCategories 
    : role === "professor" 
      ? professorCategories 
      : alunoCategories;

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    categories.forEach(cat => {
      if (cat.items.some(item => item.id === selectedItem)) {
        initial[cat.id] = true;
      }
    });
    return initial;
  });

  const toggleCategory = (categoryId: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Vestibulando</span>
            <span className="text-xs text-muted-foreground capitalize">
              {userRole || role}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {categories.map((category) => {
          const isOpen = openCategories[category.id] || false;
          const categoryHasPending = category.items.some(
            item => (pendingCounts[item.id] || 0) > 0
          );
          const CategoryIcon = category.icon;

          return (
            <SidebarGroup key={category.id}>
              <Collapsible open={isOpen} onOpenChange={() => toggleCategory(category.id)}>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md transition-colors py-2 px-2 flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <CategoryIcon className="h-4 w-4" />
                      <span>{category.label}</span>
                      {categoryHasPending && <PendingIndicator size="sm" />}
                    </div>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 transition-transform" />
                    ) : (
                      <ChevronRight className="h-4 w-4 transition-transform" />
                    )}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {category.items.map((item) => {
                        const ItemIcon = item.icon;
                        const pendingCount = pendingCounts[item.id] || 0;
                        const isActive = selectedItem === item.id;

                        return (
                          <SidebarMenuItem key={item.id}>
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => onSelectItem(item.id)}
                              className="pl-6"
                              data-testid={`sidebar-item-${item.id}`}
                            >
                              {ItemIcon && <ItemIcon className="h-4 w-4" />}
                              <span className="flex-1">{item.label}</span>
                              {pendingCount > 0 && (
                                <div className="flex items-center gap-1">
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                    {pendingCount}
                                  </Badge>
                                  <PendingIndicator size="sm" />
                                </div>
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
        <SidebarFooter className="border-t border-sidebar-border p-4">
          <div className="text-xs text-muted-foreground truncate">
            {userName}
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
