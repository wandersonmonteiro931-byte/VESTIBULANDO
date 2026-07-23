import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Accessibility,
  ArrowLeft,
  BarChart3,
  BookOpen,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  FilePenLine,
  GraduationCap,
  Headphones,
  HelpCircle,
  Home,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Moon,
  Radio,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRoundCog,
  Users,
  Wifi,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { addDoc, collection, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { eadNow, useEadAccessibility, useEadCollection } from "./store";
import type { EadRole, EadStudyItem } from "./types";

interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  roles: EadRole[];
}

export const EAD_NAVIGATION: NavigationItem[] = [
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

function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  return online;
}

function useErrorMonitor(userId?: string, userName?: string) {
  useEffect(() => {
    if (!userId) return;
    let sent = 0;
    const report = async (message: string, source: string) => {
      if (!message || sent >= 5 || message.includes("permission-denied")) return;
      sent += 1;
      try {
        await addDoc(collection(db, "eadSystemErrors"), {
          userId,
          userName: userName || "Usuário",
          message: message.slice(0, 600),
          source,
          path: window.location.pathname,
          userAgent: navigator.userAgent.slice(0, 350),
          createdAt: new Date().toISOString(),
        });
      } catch {
        // Error monitoring must never interrupt the learning experience.
      }
    };
    const onError = (event: ErrorEvent) => report(event.message, "window.error");
    const onRejection = (event: PromiseRejectionEvent) =>
      report(String(event.reason?.message || event.reason || "Promise rejeitada"), "unhandledrejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [userId, userName]);
}

function useStudyNotifications(userId?: string, role?: EadRole) {
  const studyItems = useEadCollection<EadStudyItem>("eadStudyItems", {
    constraints: userId ? [where("ownerId", "==", userId)] : [],
    enabled: !!userId && role === "aluno",
  });

  useEffect(() => {
    if (
      role !== "aluno" ||
      localStorage.getItem("vestibulando-ead-reminders") !== "enabled" ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) return;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const pendingToday = studyItems.data.filter(
      (item) => item.scheduledDate === today && !item.completed,
    );
    if (!pendingToday.length) return;
    const notificationKey = `vestibulando-reminder-${userId}-${today}`;
    if (localStorage.getItem(notificationKey)) return;
    const notification = new Notification("Seu plano de estudos de hoje", {
      body: `${pendingToday.length} atividade(s) aguardando. Próxima: ${pendingToday[0].title}.`,
      icon: "/favicon.ico",
      tag: notificationKey,
    });
    notification.onclick = () => {
      window.focus();
      window.location.href = "/ead/plano";
    };
    localStorage.setItem(notificationKey, eadNow());
  }, [role, studyItems.data, userId]);
}

export function EadShell({
  section,
  children,
}: {
  section: string;
  children: ReactNode;
}) {
  const auth = useAuth() as any;
  const userData = auth?.userData;
  const role = (userData?.tipo || "aluno") as EadRole;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, navigate] = useLocation();
  const online = useOnlineStatus();
  const { preferences } = useEadAccessibility();
  useErrorMonitor(userData?.uid, userData?.nome);
  useStudyNotifications(userData?.uid, role);

  const navigation = useMemo(
    () => EAD_NAVIGATION.filter((item) => item.roles.includes(role)),
    [role],
  );
  const current = navigation.find((item) => item.id === section) ?? navigation[0];
  const dashboardPath = role === "diretor" ? "/diretor" : role === "professor" ? "/professor" : "/aluno";

  useEffect(() => {
    if (!navigation.some((item) => item.id === section)) {
      navigate(`/ead/${navigation[0]?.id || "inicio"}`, { replace: true });
    }
  }, [navigate, navigation, section]);

  return (
    <div
      className={cn(
        "ead-portal min-h-screen bg-muted/30 text-foreground",
        preferences.lowData && "ead-low-data",
      )}
      style={{ fontSize: `calc(1rem * var(--ead-font-scale, 1))` }}
    >
      <a
        href="#ead-main"
        className="sr-only z-[100] rounded-md bg-background px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Ir para o conteúdo
      </a>

      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu do preparatório"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link href={dashboardPath}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar ao portal escolar</span>
              <span className="sm:hidden">Voltar</span>
            </Button>
          </Link>
          <div className="h-6 w-px bg-border" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">Preparatório Vestibulando</p>
            <p className="truncate text-xs text-muted-foreground">{current?.label}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant={online ? "secondary" : "destructive"} className="hidden gap-1 sm:flex">
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? "Conectado" : "Modo offline"}
            </Badge>
            <Link href="/chat">
              <Button variant="outline" size="sm" className="gap-2" aria-label="Abrir chat">
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Chat</span>
              </Button>
            </Link>
            <ThemeToggle />
            <div className="hidden text-right md:block">
              <p className="max-w-44 truncate text-xs font-semibold">{userData?.nome}</p>
              <p className="text-[11px] capitalize text-muted-foreground">{role}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r bg-background p-4 lg:block">
          <div className="mb-4 rounded-xl border bg-gradient-to-br from-primary/10 to-primary/5 p-4">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <p className="font-semibold">Preparação completa</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Planeje, estude, pratique e acompanhe sua evolução.
            </p>
          </div>
          <nav className="space-y-1" aria-label="Módulos do preparatório">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = item.id === section;
              return (
                <Link key={item.id} href={`/ead/${item.id}`}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      active
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </button>
                </Link>
              );
            })}
          </nav>
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <button
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
            />
            <aside className="relative h-full w-[min(88vw,320px)] overflow-y-auto bg-background p-4 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="font-bold">Preparatório EAD</p>
                  <p className="text-xs text-muted-foreground">Escolha uma página</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <nav className="space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.id} href={`/ead/${item.id}`}>
                      <button
                        type="button"
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm",
                          item.id === section
                            ? "bg-primary font-semibold text-primary-foreground"
                            : "hover:bg-muted",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </button>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        <main id="ead-main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
