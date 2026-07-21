import { useMemo } from "react";
import { collection, doc, updateDoc, where } from "firebase/firestore";
import { ArrowLeft, Bell, CheckCheck, LogOut, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BrasiliaClock } from "@/components/BrasiliaClock";
import { PortalBrand } from "@/components/PortalBrand";
import { PortalProfileHeader } from "@/components/PortalProfileHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AccessibilityControls } from "@/components/AccessibilityControls";
import { useAuth } from "@/contexts/AuthContext";
import { SchoolManagementSuite } from "@/features/school/SchoolManagementSuite";
import { GuardianFamilyPanel } from "@/features/school/GuardianFamilyPanel";
import { SCHOOL_ROLE_LABELS, resolveSchoolRole } from "@/features/school/schoolCatalog";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { db } from "@/lib/firebase";

function dashboardPath(tipo?: string) {
  if (tipo === "diretor") return "/diretor";
  if (tipo === "professor") return "/professor";
  if (tipo === "aluno") return "/aluno";
  return "/escola";
}

function portalRole(tipo?: string): "aluno" | "professor" | "diretor" | "responsavel" | "funcionario" {
  if (tipo === "aluno" || tipo === "professor" || tipo === "diretor" || tipo === "responsavel" || tipo === "funcionario") return tipo;
  return "funcionario";
}

export default function SchoolPlatformPage() {
  const { userData, signOut } = useAuth();
  const role = resolveSchoolRole(userData as any);
  const { data: notifications = [] } = useRealtimeQuery<any>({
    collectionName: "schoolNotifications",
    queryKey: ["/school/notifications", userData?.uid],
    constraints: userData?.uid ? [where("userId", "==", userData.uid)] : [],
    enabled: Boolean(userData?.uid),
  });
  const latestNotifications = useMemo(() => [...notifications].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 12), [notifications]);
  const unread = latestNotifications.filter((notification) => !notification.read).length;
  const backPath = dashboardPath(userData?.tipo);

  const markRead = async (id: string) => {
    await updateDoc(doc(db, "schoolNotifications", id), { read: true, readAt: new Date().toISOString() });
  };

  return (
    <div className="dashboard-modern min-h-screen bg-background">
      <header className="dashboard-topbar elegant-topbar">
        <div className="dashboard-topbar-inner elegant-header">
          <div className="dashboard-header-left"><PortalBrand compactLabel="Escola 360" /></div>
          <div className="dashboard-header-right">
            {backPath !== "/escola" && <Link href={backPath}><Button variant="ghost" size="sm" className="header-icon-btn school-back-button"><ArrowLeft className="h-4 w-4" /><span>Meu painel</span></Button></Link>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="header-icon-btn relative" aria-label={`${unread} notificações não lidas`}><Bell className="h-4 w-4" />{unread > 0 && <Badge className="school-notification-count">{unread > 9 ? "9+" : unread}</Badge>}</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="school-notification-menu">
                <DropdownMenuLabel className="flex items-center justify-between"><span>Notificações</span><small>{unread} não lidas</small></DropdownMenuLabel><DropdownMenuSeparator />
                {latestNotifications.map((notification) => <DropdownMenuItem key={notification.id} className="school-notification-item" onSelect={() => markRead(notification.id)}><div><strong>{notification.title}</strong><p>{notification.message}</p><span>{new Date(notification.createdAt).toLocaleString("pt-BR")}</span></div>{!notification.read && <i />}</DropdownMenuItem>)}
                {!latestNotifications.length && <div className="school-notification-empty"><CheckCheck className="h-5 w-5" />Tudo em dia por aqui.</div>}
              </DropdownMenuContent>
            </DropdownMenu>
            <AccessibilityControls />
            <ThemeToggle />
            <BrasiliaClock />
            <Link href="/chat"><Button variant="outline" size="icon" className="header-icon-btn" aria-label="Abrir chat"><MessageCircle className="h-4 w-4" /></Button></Link>
            <Button variant="ghost" size="icon" onClick={signOut} className="header-icon-btn" aria-label="Sair"><LogOut className="h-5 w-5" /></Button>
          </div>
        </div>
      </header>
      <main className="dashboard-main school-platform-main px-3 py-5 sm:px-6 sm:py-7">
        <PortalProfileHeader user={userData} role={portalRole(userData?.tipo)} contextLabel={SCHOOL_ROLE_LABELS[role]} showSuiteAction={false} />
        {role === "responsavel" && <GuardianFamilyPanel />}
        <SchoolManagementSuite />
      </main>
      <footer className="school-platform-footer"><span>Vestibulando · Gestão escolar</span><nav aria-label="Documentos legais"><a href="/privacy.html" target="_blank" rel="noreferrer">Privacidade</a><a href="/terms.html" target="_blank" rel="noreferrer">Termos</a><a href="/cookies.html" target="_blank" rel="noreferrer">Cookies</a><a href="/validar">Validar documento</a></nav></footer>
    </div>
  );
}
