import type { ElementType } from "react";
import { Home, Clock, ClipboardList, FileText, WalletCards, Video, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "aluno" | "professor";

interface BottomNavItem {
  id: string;
  label: string;
  icon: ElementType;
  matchIds: string[];
}

interface MobileBottomNavProps {
  role: Role;
  selectedItem: string;
  onSelectItem: (itemId: string) => void;
}

const navByRole: Record<Role, BottomNavItem[]> = {
  aluno: [
    { id: "inicio", label: "Início", icon: Home, matchIds: ["inicio"] },
    { id: "horarios", label: "Horário", icon: Clock, matchIds: ["horarios", "presencas"] },
    { id: "todas", label: "Tarefas", icon: ClipboardList, matchIds: ["todas", "pendentes", "entregues"] },
    { id: "avaliacoes", label: "Avaliações", icon: FileText, matchIds: ["avaliacoes", "notas", "boletim"] },
    { id: "financeiro", label: "Financeiro", icon: WalletCards, matchIds: ["financeiro", "advertencias"] },
  ],
  professor: [
    { id: "inicio", label: "Início", icon: Home, matchIds: ["inicio"] },
    { id: "horarios", label: "Horários", icon: Clock, matchIds: ["horarios", "presencas"] },
    { id: "aulaAoVivo", label: "Aula", icon: Video, matchIds: ["aulaAoVivo"] },
    { id: "avaliacoes", label: "Avaliações", icon: FileText, matchIds: ["avaliacoes", "bimestres", "boletins"] },
    { id: "correcoes", label: "Correções", icon: CheckSquare, matchIds: ["correcoes", "disciplinar"] },
  ],
};

export function MobileBottomNav({ role, selectedItem, onSelectItem }: MobileBottomNavProps) {
  const items = navByRole[role];

  return (
    <nav className="mobile-bottom-nav md:hidden" aria-label="Navegação rápida">
      <div className="mobile-bottom-nav-inner">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.matchIds.includes(selectedItem);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectItem(item.id)}
              className={cn("mobile-bottom-nav-button", active && "is-active")}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
