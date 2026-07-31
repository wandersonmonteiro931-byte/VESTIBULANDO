import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  GraduationCap,
  LogOut,
  MessageCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { addDoc, collection, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrasiliaClock } from "@/components/BrasiliaClock";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { eadNow, useEadAccessibility, useEadCollection } from "./store";
import { EAD_NAVIGATION } from "./navigation";
import type { EadRole, EadStudyItem } from "./types";

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
  const signOut = auth?.signOut;
  const role = (userData?.tipo || "aluno") as EadRole;
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
  const roleLabel = role === "diretor" ? "Diretoria" : role === "professor" ? "Professor" : "Aluno";

  useEffect(() => {
    if (!navigation.some((item) => item.id === section)) {
      navigate(`/ead/${navigation[0]?.id || "inicio"}`, { replace: true });
    }
  }, [navigate, navigation, section]);

  return (
    <SidebarProvider style={{ "--sidebar-width": "280px" } as CSSProperties}>
      <div
        className={cn(
          "ead-portal flex min-h-screen w-full bg-muted/30 text-foreground",
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

        <DashboardSidebar
          role={role}
          selectedItem=""
          onSelectItem={() => undefined}
          activeArea="ead"
          eadSection={section}
          userName={userData?.nome}
          userRole={roleLabel}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 shadow-sm backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 sm:flex">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold sm:text-base">Vestibulando</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Portal completo · {current?.label || "Área de estudos"}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={online ? "secondary" : "destructive"} className="hidden gap-1 xl:flex">
                  {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {online ? "Conectado" : "Modo offline"}
                </Badge>
                <div className="hidden text-right lg:block">
                  <p className="max-w-44 truncate text-xs font-semibold">{userData?.nome}</p>
                  <p className="text-[11px] text-muted-foreground">{roleLabel}</p>
                </div>
                <ThemeToggle />
                <div className="hidden md:block">
                  <BrasiliaClock />
                </div>
                <Link href="/chat">
                  <Button variant="outline" size="sm" className="gap-2" aria-label="Abrir chat">
                    <MessageCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Chat</span>
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={signOut}
                  aria-label="Sair da conta"
                  data-testid="button-logout"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </header>

          <main id="ead-main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-[1340px]">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
