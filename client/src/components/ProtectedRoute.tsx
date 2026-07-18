import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedTypes?: ("aluno" | "professor" | "diretor")[];
}

function getDashboardPath(tipo?: string): string {
  switch (tipo) {
    case "aluno":
      return "/aluno";
    case "professor":
      return "/professor";
    case "diretor":
      return "/diretor";
    default:
      return "/login";
  }
}

export function ProtectedRoute({ children, allowedTypes }: ProtectedRouteProps) {
  const { currentUser, userData, loading } = useAuth();
  const [location, setLocation] = useLocation();

  const allowedTypesKey = allowedTypes?.join("|") ?? "";
  const redirectTarget = useMemo(() => {
    if (loading) return null;
    if (!currentUser || !userData) return "/login";

    if (allowedTypesKey && !allowedTypesKey.split("|").includes(userData.tipo)) {
      return getDashboardPath(userData.tipo);
    }

    return null;
  }, [loading, currentUser?.uid, userData?.tipo, allowedTypesKey]);

  useEffect(() => {
    if (redirectTarget && location !== redirectTarget) {
      setLocation(redirectTarget, { replace: true });
    }
  }, [redirectTarget, location, setLocation]);

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

  if (redirectTarget) return null;

  return <>{children}</>;
}
