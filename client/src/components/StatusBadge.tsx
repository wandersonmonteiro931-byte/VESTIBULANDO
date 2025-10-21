import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, AlertCircle, FileCheck } from "lucide-react";

interface StatusBadgeProps {
  status: "pendente" | "entregue" | "avaliado" | "atrasado";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig = {
    pendente: {
      label: "Pendente",
      icon: Clock,
      className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    },
    entregue: {
      label: "Entregue",
      icon: FileCheck,
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    },
    avaliado: {
      label: "Avaliado",
      icon: CheckCircle2,
      className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
    },
    atrasado: {
      label: "Atrasado",
      icon: AlertCircle,
      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={`${config.className} flex items-center gap-1 px-2.5 py-0.5 font-medium`}
      data-testid={`badge-status-${status}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
