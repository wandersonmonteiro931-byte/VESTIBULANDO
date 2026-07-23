import { useEffect } from "react";
import { useLocation } from "wouter";
import { LiveClassroom } from "@/components/LiveClassroom";
import { useLiveClass } from "@/contexts/LiveClassContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Radio, ShieldCheck, Sparkles } from "lucide-react";
import logoUrl from "@assets/Blue and White Online School Logo (1)_1761189954480.png";

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
    <div className="liveclass-premium-page min-h-screen bg-background">
      <header className="liveclass-premium-header border-b bg-card">
        <div className="container mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {!isInClass && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setLocation("/aluno")}
                data-testid="button-back-to-dashboard"
                className="liveclass-back-button"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="liveclass-brand-chip">
              <img src={logoUrl} alt="Vestibulando" className="liveclass-brand-logo" />
              <div>
                <div className="liveclass-brand-eyebrow">Ambiente escolar premium</div>
                <h1 className="liveclass-brand-title">Sala de Aula</h1>
              </div>
            </div>
          </div>
          <div className="liveclass-header-pills">
            <div className="liveclass-header-pill"><Radio className="h-4 w-4" /> Aula ao vivo</div>
            <div className="liveclass-header-pill"><ShieldCheck className="h-4 w-4" /> Presença monitorada</div>
          </div>
        </div>
      </header>
      <main className="liveclass-premium-body container mx-auto px-4 py-6">
        <div className="liveclass-hero">
          <div>
            <span className="liveclass-hero-eyebrow"><Sparkles className="h-3.5 w-3.5" /> Presença e aprendizado</span>
            <h2 className="liveclass-hero-title">Acompanhe sua aula com visual premium escolar</h2>
            <p className="liveclass-hero-subtitle">Entre na sala, acompanhe sua presença e use os recursos da aula ao vivo com mais clareza em qualquer tela.</p>
          </div>
        </div>
        <div className="liveclass-premium-shell">
          <LiveClassroom onExit={handleExit} />
        </div>
      </main>
    </div>
  );
}
