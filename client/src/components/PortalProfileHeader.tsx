import type { User } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UserAccountMenu from "@/components/UserAccountMenu";
import {
  CalendarCheck,
  ChevronDown,
  GraduationCap,
  Printer,
} from "lucide-react";

type PortalRole = "aluno" | "professor" | "diretor";

interface PortalProfileHeaderProps {
  user?: User | null;
  role: PortalRole;
  contextLabel?: string;
  documentAction?: {
    label: string;
    onClick: () => void;
  };
}

const roleLabels: Record<PortalRole, string> = {
  aluno: "Aluno",
  professor: "Professor",
  diretor: "Diretoria",
};

const statusLabels: Record<PortalRole, string> = {
  aluno: "Frequência",
  professor: "Vínculo docente",
  diretor: "Situação do sistema",
};

const statusDescriptions: Record<PortalRole, string> = {
  aluno: "Consulte em Minhas presenças",
  professor: "Acesso docente ativo",
  diretor: "Administração ativa",
};

function getInitials(name?: string) {
  if (!name) return "VE";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function PortalProfileHeader({
  user,
  role,
  contextLabel,
  documentAction,
}: PortalProfileHeaderProps) {
  const roleLabel = roleLabels[role];
  const photo = user?.fotoUrl || user?.fotoBase64;
  const registration = role === "aluno"
    ? user?.matricula || "Matrícula não informada"
    : roleLabel;
  const secondaryContext = contextLabel || (role === "aluno" ? "Turma não definida" : "Vestibulando Preparatório");

  const handlePrint = () => window.print();
  const action = documentAction || { label: "IMPRIMIR", onClick: handlePrint };

  return (
    <section className="portal-profile-shell" aria-label="Identificação do usuário">
      <div className="portal-profile-card">
        <div className="portal-profile-identity">
          <Avatar className="portal-profile-avatar">
            {photo && <AvatarImage src={photo} alt={user?.nome || roleLabel} />}
            <AvatarFallback>{getInitials(user?.nome)}</AvatarFallback>
          </Avatar>

          <div className="portal-profile-copy">
            <h1>{user?.nome || roleLabel}</h1>
            <p>{user?.email || "Acesso à plataforma educacional"}</p>
            <div className="portal-profile-meta">
              <span>{roleLabel}</span>
              <span aria-hidden="true">|</span>
              <span>{secondaryContext}</span>
            </div>
          </div>
        </div>

        <div className="portal-profile-actions">
          <UserAccountMenu variant="settings" />
          <button type="button" className="portal-profile-action" onClick={action.onClick}>
            <Printer aria-hidden="true" />
            <span>{action.label}</span>
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="portal-status-grid">
        <div className="portal-status-card portal-status-card-enrollment">
          <div className="portal-status-icon portal-status-icon-blue">
            <GraduationCap aria-hidden="true" />
          </div>
          <div className="portal-status-content">
            <span className="portal-status-label">{role === "aluno" ? "Matrícula" : "Perfil de acesso"}</span>
            <div className="portal-enrollment-field">
              <span className="portal-enrollment-dot" aria-hidden="true" />
              <strong>{registration}</strong>
              <span className="portal-enrollment-separator" aria-hidden="true">•</span>
              <span>{secondaryContext}</span>
              <ChevronDown aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="portal-status-card portal-status-card-attendance">
          <div className="portal-status-icon portal-status-icon-orange">
            <CalendarCheck aria-hidden="true" />
          </div>
          <div className="portal-status-content">
            <span className="portal-status-label">{statusLabels[role]}</span>
            <div className="portal-status-description-row">
              <span>{statusDescriptions[role]}</span>
              <span className="portal-status-percentage">Ativo</span>
            </div>
            <div className="portal-progress" aria-label="Acesso ativo">
              <span />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
