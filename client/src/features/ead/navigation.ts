import {
  Accessibility,
  BarChart3,
  BookOpen,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  FilePenLine,
  GraduationCap,
  HelpCircle,
  Home,
  LayoutDashboard,
  MessageCircle,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { EadRole } from "./types";

export interface EadNavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  roles: EadRole[];
}

export const EAD_NAVIGATION: EadNavigationItem[] = [
  { id: "inicio", label: "Meu dia", icon: Home, roles: ["aluno"] },
  { id: "plano", label: "Plano de estudos", icon: CalendarDays, roles: ["aluno"] },
  { id: "conteudos", label: "Conteúdos", icon: BookOpen, roles: ["aluno", "professor", "diretor"] },
  { id: "questoes", label: "Banco de questões", icon: ClipboardCheck, roles: ["aluno"] },
  { id: "simulados", label: "Simulados", icon: GraduationCap, roles: ["aluno"] },
  { id: "redacao", label: "Redação", icon: FilePenLine, roles: ["aluno"] },
  { id: "ao-vivo", label: "Aulas ao vivo", icon: Radio, roles: ["aluno", "professor"] },
  { id: "comunidade", label: "Dúvidas e fórum", icon: MessageCircle, roles: ["aluno", "professor", "diretor"] },
  { id: "desempenho", label: "Desempenho", icon: BarChart3, roles: ["aluno"] },
  { id: "estudio", label: "Estúdio do professor", icon: Sparkles, roles: ["professor"] },
  { id: "correcoes", label: "Correções", icon: FilePenLine, roles: ["professor"] },
  { id: "turmas", label: "Turmas e relatórios", icon: Users, roles: ["professor"] },
  { id: "gestao", label: "Gestão EAD", icon: LayoutDashboard, roles: ["diretor"] },
  { id: "financeiro", label: "Financeiro", icon: CircleDollarSign, roles: ["aluno", "diretor"] },
  { id: "seguranca", label: "Segurança e LGPD", icon: ShieldCheck, roles: ["diretor"] },
  { id: "acessibilidade", label: "Acessibilidade", icon: Accessibility, roles: ["aluno", "professor", "diretor"] },
  { id: "suporte", label: "Ajuda e suporte", icon: HelpCircle, roles: ["aluno", "professor", "diretor"] },
];
