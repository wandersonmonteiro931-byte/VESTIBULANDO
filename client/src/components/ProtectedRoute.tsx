import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedTypes?: ("aluno" | "professor" | "diretor")[];
}

export function ProtectedRoute({ children, allowedTypes }: ProtectedRouteProps) {
  const { currentUser, userData, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !currentUser) {
      setLocation("/login");
    } else if (!loading && userData && allowedTypes && !allowedTypes.includes(userData.tipo)) {
      switch (userData.tipo) {
        case "aluno":
          setLocation("/aluno");
          break;
        case "professor":
          setLocation("/professor");
          break;
        case "diretor":
          setLocation("/diretor");
          break;
      }
    }
  }, [currentUser, userData, loading, allowedTypes, setLocation]);

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

  if (!currentUser || (allowedTypes && userData && !allowedTypes.includes(userData.tipo))) {
    return null;
  }

  return <>{children}</>;
}
