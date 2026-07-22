import { useEffect, useMemo, useState } from "react";
import type { ElementType, KeyboardEvent } from "react";
import { doc, updateDoc, where } from "firebase/firestore";
import {
  Accessibility,
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  ClipboardCheck,
  CloudCog,
  DatabaseBackup,
  FileCheck2,
  FileText,
  GraduationCap,
  HeartHandshake,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquareText,
  Receipt,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  UsersRound,
  Video,
  WalletCards,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccessibilityControls } from "@/components/AccessibilityControls";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrasiliaClock } from "@/components/BrasiliaClock";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { SchoolManagementSuite } from "@/features/school/SchoolManagementSuite";
import {
  SCHOOL_CATEGORIES,
  SCHOOL_MODULES,
  SCHOOL_MODULE_BY_ID,
  SCHOOL_ROLE_LABELS,
  canAccessModule,
  resolveSchoolRole,
  type ModuleCategory,
  type SchoolModuleDefinition,
  type SchoolRole,
} from "@/features/school/schoolCatalog";
import type { SchoolRecord } from "@/features/school/schoolData";

const MODULE_ICONS: Record<string, ElementType> = {
  instituicao: Landmark,
  acessos: KeyRound,
  alunos: Users,
  responsaveis: HeartHandshake,
  matriculas: UserCheck,
  "estrutura-academica": GraduationCap,
  "calendario-horarios": CalendarDays,
  "diario-planejamento": BookOpen,
  frequencia: ClipboardCheck,
  atividades: FileCheck2,
  avaliacoes: FileText,
  "notas-boletim": BarChart3,
  acompanhamento: Activity,
  conteudos: Library,
  "aulas-ao-vivo": Video,
  "documentos-escolares": FileText,
  "portal-aluno": Users,
  "portal-professor": GraduationCap,
  "portal-responsaveis": UsersRound,
  comunicacao: MessageSquareText,
  "bem-estar": HeartHandshake,
  inclusao: Accessibility,
  financeiro: WalletCards,
  secretaria: Receipt,
  relatorios: BarChart3,
  operacoes: Settings2,
  "lgpd-seguranca": ShieldCheck,
  acessibilidade: Accessibility,
  integracoes: CloudCog,
  continuidade: DatabaseBackup,
};

const CATEGORY_ICONS: Record<ModuleCategory, ElementType> = {
  fundacao: Building2,
  academico: GraduationCap,
  portais: LayoutDashboard,
  cuidado: HeartHandshake,
  administracao: BarChart3,
  governanca: ShieldCheck,
};

const CATEGORY_TONES: Record<ModuleCategory, string> = {
  fundacao: "indigo",
  academico: "cyan",
  portais: "violet",
  cuidado: "rose",
  administracao: "amber",
  governanca: "emerald",
};

const MANAGEMENT_ROLES: SchoolRole[] = ["diretor", "administrador"];

function initials(name?: string) {
  const parts = String(name || "Vestibulando").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function isActiveUser(user: any) {
  return user?.ativo !== false && user?.ativo !== "false" && user?.status !== "rejeitado" && user?.status !== "excluido";
}

function isPending(value?: string) {
  return /pend|aguard|abert|an[aá]lise|rascunho|risco|atras/i.test(String(value || ""));
}

function formatRelativeDate(value?: string) {
  if (!value) return "agora";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recentemente";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

interface SchoolHomeProps {
  modules: SchoolModuleDefinition[];
  records: SchoolRecord[];
  users: any[];
  classes: any[];
  requests: any[];
  search: string;
  onSearch: (value: string) => void;
  onOpenModule: (id: string) => void;
  role: SchoolRole;
  userName?: string;
}

function SchoolOSHome({ modules, records, users, classes, requests, search, onSearch, onOpenModule, role, userName }: SchoolHomeProps) {
  const students = users.filter((user) => user.tipo === "aluno" && isActiveUser(user));
  const teachers = users.filter((user) => user.tipo === "professor" && isActiveUser(user));
  const pendingRequests = requests.filter((request) => !request.status || isPending(request.status));
  const activeRecords = records.filter((record) => !record.deletedAt);
  const pendingRecords = activeRecords.filter((record) => isPending(record.status));
  const normalized = search.trim().toLocaleLowerCase("pt-BR");
  const filteredModules = modules.filter((module) => !normalized || `${module.title} ${module.shortTitle} ${module.description} ${module.workflows.join(" ")} ${module.capabilities.join(" ")}`.toLocaleLowerCase("pt-BR").includes(normalized));
  const firstName = String(userName || "").split(" ")[0] || "bem-vindo";

  const quickModules = ["matriculas", "frequencia", "diario-planejamento", "financeiro"]
    .map((id) => modules.find((module) => module.id === id))
    .filter(Boolean) as SchoolModuleDefinition[];
  const recent = [...activeRecords].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 6);

  return (
    <div className="school-os-home" data-release="R11-NOVO-APP">
      <section className="school-os-welcome">
        <div className="school-os-welcome-copy">
          <span className="school-os-eyebrow"><Sparkles className="h-4 w-4" /> Central da escola</span>
          <h1>Olá, {firstName}. Sua escola em um só lugar.</h1>
          <p>Encontre uma área, acompanhe o que está pendente ou inicie uma tarefa sem navegar por menus escondidos.</p>
          <div className="school-os-home-search">
            <Search className="h-5 w-5" />
            <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="O que você precisa fazer hoje?" aria-label="Buscar seção ou tarefa" />
            {search && <button type="button" onClick={() => onSearch("")} aria-label="Limpar busca"><X className="h-4 w-4" /></button>}
          </div>
        </div>
        <div className="school-os-completeness" aria-label={`${modules.length} seções disponíveis`}>
          <div className="school-os-completeness-ring"><strong>{modules.length}</strong><span>/30</span></div>
          <div><strong>seções disponíveis</strong><span>{modules.length === 30 ? "Sistema completo e organizado" : `Visíveis para o perfil ${SCHOOL_ROLE_LABELS[role]}`}</span></div>
        </div>
      </section>

      {MANAGEMENT_ROLES.includes(role) && (
        <section className="school-os-metrics" aria-label="Resumo da escola">
          <button type="button" onClick={() => onOpenModule("alunos")}><span className="tone-indigo"><Users /></span><div><strong>{students.length}</strong><small>Alunos ativos</small></div><ArrowRight /></button>
          <button type="button" onClick={() => onOpenModule("portal-professor")}><span className="tone-cyan"><GraduationCap /></span><div><strong>{teachers.length}</strong><small>Professores</small></div><ArrowRight /></button>
          <button type="button" onClick={() => onOpenModule("estrutura-academica")}><span className="tone-violet"><UsersRound /></span><div><strong>{classes.length}</strong><small>Turmas</small></div><ArrowRight /></button>
          <button type="button" onClick={() => onOpenModule("matriculas")} className={cn((pendingRequests.length + pendingRecords.length) > 0 && "has-alert")}><span className="tone-rose"><Activity /></span><div><strong>{pendingRequests.length + pendingRecords.length}</strong><small>Pendências</small></div><ArrowRight /></button>
        </section>
      )}

      {!normalized && quickModules.length > 0 && (
        <section className="school-os-block school-os-quick-start">
          <div className="school-os-section-title"><div><span>Comece por aqui</span><h2>Ações frequentes</h2></div><p>Atalhos para a rotina de hoje</p></div>
          <div className="school-os-quick-grid">
            {quickModules.map((module) => {
              const Icon = MODULE_ICONS[module.id] || Settings2;
              return <button key={module.id} type="button" onClick={() => onOpenModule(module.id)}><span className={`tone-${CATEGORY_TONES[module.category]}`}><Icon /></span><div><strong>{module.shortTitle}</strong><small>{module.workflows[0]}</small></div><ChevronRight /></button>;
            })}
          </div>
        </section>
      )}

      <section className="school-os-block school-os-map" aria-labelledby="school-os-sections-title">
        <div className="school-os-section-title"><div><span>Mapa do sistema</span><h2 id="school-os-sections-title">Todas as seções</h2></div><Badge variant="secondary">{filteredModules.length} exibidas</Badge></div>
        {SCHOOL_CATEGORIES.map((category) => {
          const categoryModules = filteredModules.filter((module) => module.category === category.id);
          if (!categoryModules.length) return null;
          const CategoryIcon = CATEGORY_ICONS[category.id];
          return (
            <section key={category.id} className={`school-os-category tone-${CATEGORY_TONES[category.id]}`}>
              <div className="school-os-category-heading"><span><CategoryIcon /></span><div><h3>{category.label}</h3><p>{category.description}</p></div><b>{categoryModules.length}</b></div>
              <div className="school-os-module-grid">
                {categoryModules.map((module) => {
                  const Icon = MODULE_ICONS[module.id] || Settings2;
                  const moduleRecords = activeRecords.filter((record) => record.moduleId === module.id);
                  const pending = moduleRecords.filter((record) => isPending(record.status)).length;
                  return (
                    <button type="button" key={module.id} className="school-os-module-card" onClick={() => onOpenModule(module.id)}>
                      <div className="school-os-module-card-top"><span className="school-os-module-icon"><Icon /></span><span className="school-os-module-index">{String(module.number).padStart(2, "0")}</span></div>
                      <strong>{module.shortTitle}</strong>
                      <p>{module.description}</p>
                      <div><span>{module.workflows.length} fluxos</span>{pending > 0 ? <b>{pending} pendente{pending > 1 ? "s" : ""}</b> : <small>Abrir seção <ArrowRight /></small>}</div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        {!filteredModules.length && <div className="school-os-no-results"><Search /><h3>Nenhuma seção encontrada</h3><p>Tente buscar por outro nome, como “presença”, “aluno” ou “financeiro”.</p><Button variant="outline" onClick={() => onSearch("")}>Limpar busca</Button></div>}
      </section>

      {!normalized && recent.length > 0 && (
        <section className="school-os-block school-os-recent">
          <div className="school-os-section-title"><div><span>Acompanhamento</span><h2>Atualizações recentes</h2></div></div>
          <div className="school-os-recent-list">
            {recent.map((record) => {
              const module = SCHOOL_MODULE_BY_ID[record.moduleId];
              const Icon = MODULE_ICONS[record.moduleId] || FileText;
              return <button type="button" key={record.id} onClick={() => onOpenModule(record.moduleId)}><span><Icon /></span><div><strong>{record.title}</strong><small>{module?.shortTitle || record.moduleId} · {record.status}</small></div><time>{formatRelativeDate(record.updatedAt)}</time><ChevronRight /></button>;
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export function SchoolOS() {
  const { userData, signOut } = useAuth();
  const role = resolveSchoolRole(userData as any);
  const permissions = (((userData as any)?.permissoes || []) as string[]);
  const isManagement = MANAGEMENT_ROLES.includes(role);
  const accessibleModules = useMemo(() => SCHOOL_MODULES.filter((module) => canAccessModule(role, module.id, permissions)), [role, permissions.join("|")]);
  const initialModule = new URLSearchParams(window.location.search).get("modulo");
  const [activeModuleId, setActiveModuleId] = useState(() => initialModule && accessibleModules.some((module) => module.id === initialModule) ? initialModule : "");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: users = [] } = useRealtimeQuery<any>({ collectionName: "usuarios", queryKey: ["/school-os/users", role], enabled: isManagement });
  const { data: classes = [] } = useRealtimeQuery<any>({ collectionName: "turmas", queryKey: ["/school-os/classes", role], enabled: isManagement || role === "professor" });
  const { data: requests = [] } = useRealtimeQuery<any>({ collectionName: "solicitacoes", queryKey: ["/school-os/requests", role], enabled: isManagement });
  const { data: allRecords = [] } = useRealtimeQuery<SchoolRecord>({ collectionName: "schoolRecords", queryKey: ["/school-os/records/all", role], enabled: isManagement });
  const { data: personalRecords = [] } = useRealtimeQuery<SchoolRecord>({ collectionName: "schoolRecords", queryKey: ["/school-os/records/personal", userData?.uid], constraints: userData?.uid ? [where("audienceUserIds", "array-contains", userData.uid)] : [], enabled: Boolean(userData?.uid && !isManagement) });
  const records = isManagement ? allRecords : personalRecords;
  const { data: notifications = [] } = useRealtimeQuery<any>({ collectionName: "schoolNotifications", queryKey: ["/school-os/notifications", userData?.uid], constraints: userData?.uid ? [where("userId", "==", userData.uid)] : [], enabled: Boolean(userData?.uid) });

  const latestNotifications = useMemo(() => [...notifications].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 12), [notifications]);
  const unread = latestNotifications.filter((notification) => !notification.read).length;
  const normalized = search.trim().toLocaleLowerCase("pt-BR");
  const visibleModules = accessibleModules.filter((module) => !normalized || `${module.title} ${module.shortTitle} ${module.description} ${module.workflows.join(" ")} ${module.capabilities.join(" ")}`.toLocaleLowerCase("pt-BR").includes(normalized));
  const activeModule = activeModuleId ? SCHOOL_MODULE_BY_ID[activeModuleId] : undefined;

  useEffect(() => {
    const onPopState = () => {
      const moduleId = new URLSearchParams(window.location.search).get("modulo") || "";
      setActiveModuleId(accessibleModules.some((module) => module.id === moduleId) ? moduleId : "");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [accessibleModules]);

  useEffect(() => {
    document.body.classList.add("school-os-active");
    return () => document.body.classList.remove("school-os-active");
  }, []);

  const navigate = (moduleId?: string) => {
    const url = new URL(window.location.href);
    if (moduleId) url.searchParams.set("modulo", moduleId);
    else url.searchParams.delete("modulo");
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setActiveModuleId(moduleId || "");
    setSearch("");
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && visibleModules[0]) navigate(visibleModules[0].id);
  };

  const markRead = async (id: string) => updateDoc(doc(db, "schoolNotifications", id), { read: true, readAt: new Date().toISOString() });
  const photo = userData?.fotoUrl || userData?.fotoBase64;

  return (
    <div className="school-os">
      <aside className={cn("school-os-sidebar", sidebarOpen && "is-open")} aria-label="Navegação principal">
        <div className="school-os-brand"><div className="school-os-brand-mark"><span>V</span></div><div><strong>Vestibulando</strong><small>Escola digital</small></div><button type="button" className="school-os-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu"><X /></button></div>
        <button type="button" className={cn("school-os-home-link", !activeModuleId && "is-active")} onClick={() => navigate()}><LayoutDashboard /><span><strong>Visão geral</strong><small>Todas as 30 seções</small></span></button>
        <div className="school-os-sidebar-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={handleSearchKey} placeholder="Buscar seção..." aria-label="Buscar seção" /></div>
        <nav className="school-os-sidebar-nav">
          {SCHOOL_CATEGORIES.map((category) => {
            const categoryModules = visibleModules.filter((module) => module.category === category.id);
            if (!categoryModules.length) return null;
            return <section key={category.id}><h2><span className={`tone-${CATEGORY_TONES[category.id]}`} />{category.label}<b>{categoryModules.length}</b></h2>{categoryModules.map((module) => { const Icon = MODULE_ICONS[module.id] || Settings2; return <button key={module.id} type="button" className={cn(activeModuleId === module.id && "is-active")} onClick={() => navigate(module.id)}><span className="school-os-nav-number">{String(module.number).padStart(2, "0")}</span><Icon /><strong>{module.shortTitle}</strong>{activeModuleId === module.id && <i />}</button>; })}</section>;
          })}
          {!visibleModules.length && <div className="school-os-sidebar-empty">Nenhuma seção encontrada.</div>}
        </nav>
        <div className="school-os-sidebar-status"><span /><div><strong>Sistema conectado</strong><small>Dados sincronizados em tempo real</small></div></div>
      </aside>

      {sidebarOpen && <button type="button" className="school-os-sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Fechar navegação" />}

      <div className="school-os-content">
        <header className="school-os-topbar">
          <div className="school-os-topbar-left"><button type="button" className="school-os-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu"><Menu /></button><div className="school-os-breadcrumb"><button type="button" onClick={() => navigate()}>Escola</button>{activeModule && <><ChevronRight /><span>{activeModule.shortTitle}</span></>}</div></div>
          <div className="school-os-command-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={handleSearchKey} placeholder="Buscar seção ou tarefa..." aria-label="Busca global" /><kbd>Enter</kbd></div>
          <div className="school-os-topbar-actions">
            <div className="school-os-clock"><BrasiliaClock /></div>
            <AccessibilityControls />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="school-os-icon-button" aria-label={`${unread} notificações não lidas`}><Bell />{unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="school-os-notification-menu"><DropdownMenuLabel><div><strong>Notificações</strong><small>{unread} não lidas</small></div></DropdownMenuLabel><DropdownMenuSeparator />{latestNotifications.map((notification) => <DropdownMenuItem key={notification.id} onSelect={() => markRead(notification.id)} className="school-os-notification"><span className={cn(!notification.read && "is-unread")} /><div><strong>{notification.title}</strong><p>{notification.message}</p><small>{formatRelativeDate(notification.createdAt)}</small></div></DropdownMenuItem>)}{!latestNotifications.length && <div className="school-os-notification-empty"><CheckCheck />Tudo em dia por aqui.</div>}</DropdownMenuContent>
            </DropdownMenu>
            <Link href="/chat"><Button variant="ghost" className="school-os-chat-button"><MessageCircle /><span>Chat</span></Button></Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><button type="button" className="school-os-user-button"><Avatar><AvatarImage src={photo} alt={userData?.nome || "Usuário"} /><AvatarFallback>{initials(userData?.nome)}</AvatarFallback></Avatar><span><strong>{userData?.nome || "Usuário"}</strong><small>{SCHOOL_ROLE_LABELS[role]}</small></span></button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56"><DropdownMenuLabel>Minha conta</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => window.print()}><FileText className="mr-2 h-4 w-4" />Imprimir tela</DropdownMenuItem><DropdownMenuItem onSelect={signOut} className="text-destructive"><LogOut className="mr-2 h-4 w-4" />Sair</DropdownMenuItem></DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="school-os-main">
          {!activeModule ? (
            <SchoolOSHome modules={accessibleModules} records={records} users={users} classes={classes} requests={requests} search={search} onSearch={setSearch} onOpenModule={navigate} role={role} userName={userData?.nome} />
          ) : (
            <div className="school-os-module-view">
              <button type="button" className="school-os-back" onClick={() => navigate()}><ArrowLeft />Todas as seções</button>
              <SchoolManagementSuite key={activeModule.id} initialModuleId={activeModule.id} focused />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
