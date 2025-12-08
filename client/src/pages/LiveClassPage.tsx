import { useEffect } from "react";
import { useLocation } from "wouter";
import { LiveClassroom } from "@/components/LiveClassroom";
import { useLiveClass } from "@/contexts/LiveClassContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function LiveClassPage() {
  const [, setLocation] = useLocation();
  const { isInClass } = useLiveClass();

  useEffect(() => {
    if (!isInClass) return;

    const handlePopState = (e: PopStateEvent) => {
      window.history.pushState(null, "", window.location.href);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Você está em uma aula ao vivo. Sair resultará em falta.";
      return e.returnValue;
    };

    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isInClass]);

  const handleExit = () => {
    setLocation("/aluno");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          {!isInClass && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setLocation("/aluno")}
              data-testid="button-back-to-dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-lg font-semibold">Sala de Aula</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <LiveClassroom onExit={handleExit} />
      </main>
    </div>
  );
}
