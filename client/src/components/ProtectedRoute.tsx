import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import type { User } from "@shared/schema";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedTypes?: User["tipo"][];
}

function getDashboardPath(tipo?: string): string {
  switch (tipo) {
    case "aluno":
      return "/aluno";
    case "professor":
      return "/professor";
    case "diretor":
      return "/diretor";
    case "responsavel":
    case "funcionario":
      return "/escola";
    default:
      return "/login";
  }
}

function FullPageRedirect({ to }: { to: string }) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || window.location.pathname === to) return;
    startedRef.current = true;
    window.location.replace(to);
  }, [to]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecionando...</p>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children, allowedTypes }: ProtectedRouteProps) {
  const { currentUser, userData, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || !userData) {
    return <FullPageRedirect to="/login" />;
  }

  if (allowedTypes?.length && !allowedTypes.includes(userData.tipo)) {
    return <FullPageRedirect to={getDashboardPath(userData.tipo)} />;
  }

  return <>{children}</>;
}
