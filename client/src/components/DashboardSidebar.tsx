import { useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import {
  Activity,
  AlertTriangle,
  Award,
  Bell,
  BookOpen,
  Calendar,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Clock,
  Eye,
  FileCheck,
  FileText,
  Flag,
  GraduationCap,
  Home,
  Key,
  MessageSquare,
  School,
  Settings,
  Shield,
  UserCheck,
  Users,
  Video,
  WalletCards,
  Wrench,
} from "lucide-react";
import { PendingIndicator } from "@/components/PendingIndicator";
import { cn } from "@/lib/utils";

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
}

const diretorCategories: MenuCategory[] = [
  {
    id: "gestao-usuarios",
    label: "Usuários",
    icon: Users,
    items: [
      { id: "aprovacoes", label: "Aprovações", icon: UserCheck },
      { id: "lista-espera", label: "Lista de espera", icon: Clock },
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
      { id: "horarios", label: "Grade horária", icon: Clock },
      { id: "calendario", label: "Calendário", icon: Calendar },
      { id: "config-horarios", label: "Configurar horários", icon: Settings },
      { id: "presencas", label: "Registro de presenças", icon: UserCheck },
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
      { id: "pedidos-disciplinares", label: "Pedidos de professores", icon: Flag },
      { id: "denuncias", label: "Denúncias", icon: Flag },
    ],
  },
  {
    id: "documentos",
    label: "Documentos",
    icon: FileText,
    items: [
      { id: "documentos-internos", label: "Documentos internos", icon: FileText },
      { id: "documentacao", label: "Documentação", icon: FileText },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: WalletCards,
    items: [{ id: "financeiro", label: "Faturas e bolsas", icon: WalletCards }],
  },
  {
    id: "avisos",
    label: "Avisos",
    icon: Bell,
    items: [{ id: "avisos", label: "Gerenciar avisos", icon: Bell }],
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: Settings,
    items: [{ id: "manutencao", label: "Manutenção", icon: Wrench }],
  },
];

const professorCategories: MenuCategory[] = [
  {
    id: "academico",
    label: "Acadêmico",
    icon: GraduationCap,
    items: [
      { id: "horarios", label: "Meus horários", icon: Clock },
      { id: "presencas", label: "Registro de presenças", icon: UserCheck },
    ],
  },
  {
    id: "aula-ao-vivo",
    label: "Aulas",
    icon: Video,
    items: [{ id: "aulaAoVivo", label: "Gerenciar aula ao vivo", icon: Video }],
  },
  {
    id: "atividades",
    label: "Atividades",
    icon: ClipboardList,
    items: [
      { id: "avaliacoes", label: "Atividades e avaliações", icon: ClipboardList },
      { id: "correcoes", label: "Correções pendentes", icon: CheckSquare },
    ],
  },
  {
    id: "notas-boletins",
    label: "Notas e boletins",
    icon: GraduationCap,
    items: [
      { id: "bimestres", label: "Notas do bimestre", icon: Calendar },
      { id: "boletins", label: "Boletins", icon: FileCheck },
    ],
  },
  {
    id: "disciplinar",
    label: "Disciplinar",
    icon: Shield,
    items: [{ id: "disciplinar", label: "Ações disciplinares", icon: AlertTriangle }],
  },
];

const alunoCategories: MenuCategory[] = [
  {
    id: "academico",
    label: "Horários",
    icon: GraduationCap,
    items: [
      { id: "horarios", label: "Meu horário", icon: Clock },
      { id: "presencas", label: "Minhas presenças", icon: UserCheck },
    ],
  },
  {
    id: "aulas-ao-vivo",
    label: "Aulas",
    icon: Video,
    items: [{ id: "aulas", label: "Minhas aulas", icon: Video }],
  },
  {
    id: "tarefas",
    label: "Atividades",
    icon: ClipboardList,
    items: [
      { id: "todas", label: "Todas as tarefas", icon: ClipboardList },
      { id: "pendentes", label: "Pendentes", icon: CheckSquare },
      { id: "entregues", label: "Entregues", icon: Award },
    ],
  },
  {
    id: "avaliacoes",
    label: "Avaliações",
    icon: FileText,
    items: [{ id: "avaliacoes", label: "Minhas avaliações", icon: FileText }],
  },
  {
    id: "notas-boletins",
    label: "Desempenho escolar",
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
    items: [{ id: "financeiro", label: "Faturas e bolsas", icon: WalletCards }],
  },
  {
    id: "disciplinar",
    label: "Acompanhamentos",
    icon: Shield,
    items: [{ id: "advertencias", label: "Advertências", icon: AlertTriangle }],
  },
];

const homeCategory: MenuCategory = {
  id: "inicio",
  label: "Conteúdos",
  icon: Home,
  items: [{ id: "inicio", label: "Visão geral", icon: Home }],
};

export function DashboardSidebar({
  role,
  selectedItem,
  onSelectItem,
  pendingCounts = {},
}: DashboardSidebarProps) {
  const categories = useMemo(() => {
    const roleCategories = role === "diretor"
      ? diretorCategories
      : role === "professor"
        ? professorCategories
        : alunoCategories;

    return role === "diretor" ? roleCategories : [homeCategory, ...roleCategories];
  }, [role]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.items.some((item) => item.id === selectedItem)),
    [categories, selectedItem],
  );

  const [openCategoryId, setOpenCategoryId] = useState(
    selectedCategory?.id ?? categories[0]?.id ?? "",
  );

  useEffect(() => {
    if (selectedCategory) setOpenCategoryId(selectedCategory.id);
  }, [selectedCategory]);

  const openCategory = categories.find((category) => category.id === openCategoryId) ?? categories[0];

  const handleCategoryClick = (category: MenuCategory) => {
    setOpenCategoryId(category.id);
    const selectedItemBelongsToCategory = category.items.some((item) => item.id === selectedItem);
    if (!selectedItemBelongsToCategory) onSelectItem(category.items[0].id);
  };

  return (
    <nav className="portal-navigation" aria-label="Módulos do portal">
      <div className="portal-primary-tabs" role="tablist" aria-label="Áreas do portal">
        {categories.map((category) => {
          const isCurrent = category.id === openCategory?.id;
          const hasPending = category.items.some((item) => (pendingCounts[item.id] || 0) > 0);

          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              className={cn("portal-primary-tab", isCurrent && "is-active")}
              onClick={() => handleCategoryClick(category)}
              data-testid={`portal-category-${category.id}`}
            >
              <span>{category.label}</span>
              {hasPending && <PendingIndicator size="sm" />}
              {category.items.length > 1 && <ChevronDown className="portal-tab-chevron" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {openCategory && (
        <div className="portal-secondary-nav" aria-label={`Opções de ${openCategory.label}`}>
          <span className="portal-secondary-label">ACESSAR</span>
          <div className="portal-secondary-items">
            {openCategory.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === selectedItem;
              const pendingCount = pendingCounts[item.id] || 0;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn("portal-secondary-button", isActive && "is-active")}
                  onClick={() => onSelectItem(item.id)}
                  data-testid={item.id === "inicio" ? "sidebar-item-inicio" : `sidebar-item-${item.id}`}
                >
                  {Icon && <Icon className="portal-secondary-icon" aria-hidden="true" />}
                  <span>{item.label}</span>
                  {pendingCount > 0 && <PendingIndicator size="sm" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
