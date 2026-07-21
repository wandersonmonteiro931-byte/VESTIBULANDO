import { useMemo, useState } from "react";
import type { ElementType, ReactNode } from "react";
import {
  Accessibility,
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  GraduationCap,
  HeartHandshake,
  KeyRound,
  Landmark,
  Library,
  ListChecks,
  MessageSquareText,
  PackageOpen,
  PlayCircle,
  Search,
  Settings2,
  ShieldCheck,
  UserCheck,
  Users,
  UsersRound,
  Video,
  WalletCards,
} from "lucide-react";
import { AccessControlPanel } from "@/features/school/AccessControlPanel";
import { AdminFinanceTab } from "@/components/AdminFinanceTab";
import { AnnouncementsTab } from "@/components/AnnouncementsTab";
import { AutorizacaoNotasTab } from "@/components/AutorizacaoNotasTab";
import { AvaliacoesTab } from "@/components/AvaliacoesTab";
import { BimestresTab } from "@/components/BimestresTab";
import { BoletimTab } from "@/components/BoletimTab";
import { CalendarioProgramacaoTab } from "@/components/CalendarioProgramacaoTab";
import { ConfiguracaoHorariosTab } from "@/components/ConfiguracaoHorariosTab";
import { DisciplinaryRequestsAdminTab } from "@/components/DisciplinaryRequestsAdminTab";
import { DocumentationTab } from "@/components/DocumentationTab";
import { HorariosTab } from "@/components/HorariosTab";
import { InternalDocumentsTab } from "@/components/InternalDocumentsTab";
import { PresencasTab } from "@/components/PresencasTab";
import { TeacherClassControl } from "@/components/TeacherClassControl";
import { AccessibilityControls } from "@/components/AccessibilityControls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationPreferencesPanel, PrivacyOperationsPanel } from "./GovernancePanels";
import { capabilityBlueprint } from "./schoolCapabilityEngine";
import type { SchoolModuleDefinition, SchoolRole } from "./schoolCatalog";
import type { SchoolActor, SchoolRecord } from "./schoolData";

interface OperationalModuleWorkspaceProps {
  module: SchoolModuleDefinition;
  role: SchoolRole;
  actor: SchoolActor;
  user: any;
  users: any[];
  classes: any[];
  records: SchoolRecord[];
  allRecords: SchoolRecord[];
  canWrite: boolean;
  onCreate: (capability: string) => void;
  onView: (record: SchoolRecord) => void;
}

interface Shortcut {
  label: string;
  description: string;
  href: string;
  icon: ElementType;
}

const OPERATIONAL_MODULE_IDS = new Set([
  "instituicao",
  "acessos",
  "alunos",
  "responsaveis",
  "matriculas",
  "estrutura-academica",
  "calendario-horarios",
  "diario-planejamento",
  "frequencia",
  "atividades",
  "avaliacoes",
  "notas-boletim",
  "acompanhamento",
  "conteudos",
  "aulas-ao-vivo",
  "documentos-escolares",
  "portal-aluno",
  "portal-professor",
  "portal-responsaveis",
  "comunicacao",
  "bem-estar",
  "inclusao",
  "financeiro",
  "secretaria",
  "operacoes",
  "lgpd-seguranca",
  "acessibilidade",
]);

export function hasOperationalModuleWorkspace(moduleId: string) {
  return OPERATIONAL_MODULE_IDS.has(moduleId);
}

const moduleIcons: Record<string, ElementType> = {
  instituicao: Landmark,
  acessos: KeyRound,
  alunos: Users,
  responsaveis: UsersRound,
  matriculas: UserCheck,
  "estrutura-academica": GraduationCap,
  "calendario-horarios": CalendarDays,
  "diario-planejamento": BookOpen,
  frequencia: ClipboardCheck,
  atividades: ListChecks,
  avaliacoes: FileCheck2,
  "notas-boletim": GraduationCap,
  acompanhamento: Activity,
  conteudos: Library,
  "aulas-ao-vivo": Video,
  "documentos-escolares": FileText,
  "portal-aluno": Users,
  "portal-professor": GraduationCap,
  "portal-responsaveis": HeartHandshake,
  comunicacao: MessageSquareText,
  "bem-estar": HeartHandshake,
  inclusao: Accessibility,
  financeiro: WalletCards,
  secretaria: ClipboardCheck,
  operacoes: Settings2,
  "lgpd-seguranca": ShieldCheck,
  acessibilidade: Accessibility,
};

const shortcutSets: Record<string, Shortcut[]> = {
  instituicao: [
    { label: "Turmas e períodos", description: "Organizar ano, turno, vagas e situação das turmas.", href: "/diretor?secao=turmas", icon: UsersRound },
    { label: "Calendário letivo", description: "Definir eventos, recessos, provas e dias escolares.", href: "/diretor?secao=calendario", icon: CalendarDays },
    { label: "Configuração de horários", description: "Definir dias, aulas, intervalos e duração.", href: "/diretor?secao=config-horarios", icon: Settings2 },
  ],
  acessos: [
    { label: "Alunos e contas", description: "Criar, editar, bloquear e consultar contas de alunos.", href: "/diretor?secao=usuarios", icon: Users },
    { label: "Professores", description: "Gerenciar contas, turmas e disciplinas docentes.", href: "/diretor?secao=professores", icon: GraduationCap },
    { label: "Senhas e logins", description: "Redefinições, primeiro acesso e segurança.", href: "/diretor?secao=senhas-logins", icon: KeyRound },
  ],
  alunos: [
    { label: "Cadastro de alunos", description: "Prontuário, dados pessoais, matrícula, turma e situação.", href: "/diretor?secao=usuarios", icon: Users },
    { label: "Cadastrar aluno", description: "Abrir diretamente o cadastro completo de um novo aluno.", href: "/diretor?secao=usuarios&acao=novo-aluno", icon: UserCheck },
    { label: "Turmas", description: "Consultar a distribuição de alunos e movimentações.", href: "/diretor?secao=turmas", icon: UsersRound },
  ],
  matriculas: [
    { label: "Aprovações", description: "Analisar inscrições, documentos e disponibilidade de vaga.", href: "/diretor?secao=aprovacoes", icon: UserCheck },
    { label: "Lista de espera", description: "Priorizar candidatos e convocar quando surgir vaga.", href: "/diretor?secao=lista-espera", icon: ListChecks },
    { label: "Alunos matriculados", description: "Transferir turma, editar matrícula ou encerrar vínculo.", href: "/diretor?secao=usuarios", icon: Users },
  ],
  "estrutura-academica": [
    { label: "Turmas e cursos", description: "Criar turmas, vagas, séries, turnos e períodos.", href: "/diretor?secao=turmas", icon: UsersRound },
    { label: "Grade horária", description: "Vincular disciplinas e professores sem conflitos.", href: "/diretor?secao=horarios", icon: CalendarDays },
    { label: "Disciplinas e tempos", description: "Configurar matérias, dias letivos, aulas e intervalos.", href: "/diretor?secao=config-horarios", icon: GraduationCap },
  ],
  "aulas-ao-vivo": [
    { label: "Grade horária", description: "Conferir turma, professor, matéria e horário antes da aula.", href: "/diretor?secao=horarios", icon: CalendarDays },
    { label: "Calendário", description: "Programar encontros, reposições e eventos on-line.", href: "/diretor?secao=calendario", icon: Video },
  ],
};

function navigate(href: string) {
  window.location.assign(href);
}

function OperationalTabs({ defaultValue, children, tabs }: { defaultValue: string; children: ReactNode; tabs: Array<{ value: string; label: string; icon: ElementType }> }) {
  return (
    <Tabs defaultValue={defaultValue} className="school-operational-tabs">
      <TabsList className="school-operational-tabs-list">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return <TabsTrigger key={tab.value} value={tab.value}><Icon className="h-4 w-4" />{tab.label}</TabsTrigger>;
        })}
      </TabsList>
      {children}
    </Tabs>
  );
}

function ShortcutGrid({ shortcuts }: { shortcuts: Shortcut[] }) {
  if (!shortcuts.length) return null;
  return (
    <section className="school-real-shortcuts" aria-label="Telas operacionais">
      <div className="school-real-section-heading"><div><span>ACESSO DIRETO</span><h4>Telas que já trabalham com os dados reais</h4></div></div>
      <div className="school-real-shortcut-grid">
        {shortcuts.map((shortcut) => {
          const Icon = shortcut.icon;
          return (
            <button type="button" key={shortcut.href} onClick={() => navigate(shortcut.href)}>
              <i><Icon className="h-5 w-5" /></i>
              <span><strong>{shortcut.label}</strong><small>{shortcut.description}</small></span>
              <ArrowRight className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function capabilityStatusTone(status: string) {
  if (/conclu|aprov|public|emit|pago|valid|fech|homolog/i.test(status)) return "is-complete";
  if (/cancel|recus|reprov|falh|bloque|venc/i.test(status)) return "is-blocked";
  return "is-open";
}

export function CapabilityWorkspace({
  module,
  records,
  canWrite,
  onCreate,
  onView,
  title,
  description,
  compact = false,
}: {
  module: SchoolModuleDefinition;
  records: SchoolRecord[];
  canWrite: boolean;
  onCreate: (capability: string) => void;
  onView: (record: SchoolRecord) => void;
  title?: string;
  description?: string;
  compact?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [workflow, setWorkflow] = useState("all");
  const Icon = moduleIcons[module.id] || Settings2;
  const activeRecords = records.filter((record) => !record.deletedAt);
  const normalized = search.trim().toLocaleLowerCase("pt-BR");
  const blueprints = useMemo(() => module.capabilities.map((capability) => capabilityBlueprint(module, capability)), [module]);
  const workflows = Array.from(new Set(blueprints.map((blueprint) => blueprint.workflow)));
  const visibleBlueprints = blueprints.filter((blueprint) => {
    if (workflow !== "all" && blueprint.workflow !== workflow) return false;
    return !normalized || `${blueprint.title} ${blueprint.workflow} ${blueprint.automations.join(" ")}`.toLocaleLowerCase("pt-BR").includes(normalized);
  });

  return (
    <section className={`school-capability-workspace${compact ? " is-compact" : ""}`}>
      <div className="school-capability-heading">
        <div className="school-capability-heading-icon"><Icon className="h-6 w-6" /></div>
        <div><span>CENTRAL OPERACIONAL</span><h4>{title || `Operações de ${module.shortTitle.toLocaleLowerCase("pt-BR")}`}</h4><p>{description || "Escolha a tarefa que deseja executar. Cada opção abre somente os campos e validações necessários para essa tarefa."}</p></div>
        <div className="school-capability-summary"><strong>{activeRecords.length}</strong><small>em acompanhamento</small></div>
      </div>

      <div className="school-capability-toolbar">
        <div><Search className="h-4 w-4" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar uma tarefa deste setor..." /></div>
        <Select value={workflow} onValueChange={setWorkflow}><SelectTrigger aria-label="Filtrar etapa"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as etapas</SelectItem>{workflows.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
      </div>

      <div className="school-capability-grid">
        {visibleBlueprints.map((blueprint) => {
          const related = activeRecords.filter((record) => record.capability === blueprint.title);
          return (
            <article key={blueprint.id} className="school-capability-card">
              <div className="school-capability-card-top"><span>{blueprint.workflow}</span>{related.length > 0 && <Badge variant="outline">{related.length} registro(s)</Badge>}</div>
              <h5>{blueprint.title}</h5>
              <p>{blueprint.automations[0] || "Processo com histórico, responsável, prazo e situação."}</p>
              <div className="school-capability-card-actions">
                {canWrite ? <Button size="sm" onClick={() => onCreate(blueprint.title)}><PlayCircle className="mr-2 h-4 w-4" />Executar</Button> : <span className="school-capability-readonly"><ShieldCheck className="h-3.5 w-3.5" />Somente consulta</span>}
                {related[0] && <Button size="sm" variant="ghost" onClick={() => onView(related[0])}>Ver último</Button>}
              </div>
            </article>
          );
        })}
      </div>

      {!visibleBlueprints.length && <div className="school-capability-empty"><Search className="h-8 w-8" /><h5>Nenhuma tarefa encontrada</h5><p>Altere a busca ou selecione outra etapa.</p></div>}

      {activeRecords.length > 0 && (
        <div className="school-operation-recent">
          <div className="school-real-section-heading"><div><span>ACOMPANHAMENTO</span><h4>Trabalhos recentes deste setor</h4></div></div>
          <div className="school-operation-recent-list">
            {[...activeRecords].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8).map((record) => (
              <button type="button" key={record.id} onClick={() => onView(record)}>
                <span className={`school-operation-state ${capabilityStatusTone(record.status)}`}><CheckCircle2 className="h-4 w-4" /></span>
                <span><strong>{record.title}</strong><small>{record.capability} · {record.studentName || record.className || record.assigneeName || "geral"}</small></span>
                <Badge variant="outline">{record.status}</Badge>
                <ArrowRight className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function RouteAndCapabilityWorkspace(props: OperationalModuleWorkspaceProps) {
  const shortcuts = shortcutSets[props.module.id] || [];
  return <div className="school-real-workspace"><ShortcutGrid shortcuts={shortcuts} /><CapabilityWorkspace module={props.module} records={props.records} canWrite={props.canWrite} onCreate={props.onCreate} onView={props.onView} compact={shortcuts.length > 0} /></div>;
}

function AccessibilityWorkspace(props: OperationalModuleWorkspaceProps) {
  return (
    <div className="school-real-workspace">
      <section className="school-accessibility-live-panel">
        <div><span><Accessibility className="h-6 w-6" /></span><div><h4>Teste as preferências acessíveis agora</h4><p>Aumente o texto, ative alto contraste, reduza movimentos ou aplique a fonte de alta legibilidade. A alteração é imediata neste dispositivo.</p></div></div>
        <AccessibilityControls />
      </section>
      <div className="school-accessibility-checks">
        {["Navegação completa por teclado", "Rótulos para leitores de tela", "Contraste e foco visível", "Redução de movimento", "Texto ampliável sem perda de conteúdo", "Registro de barreiras e adaptações"].map((item) => <div key={item}><CheckCircle2 className="h-4 w-4" /><span>{item}</span></div>)}
      </div>
      <CapabilityWorkspace module={props.module} records={props.records} canWrite={props.canWrite} onCreate={props.onCreate} onView={props.onView} title="Auditorias, barreiras e adaptações" compact />
    </div>
  );
}

export function OperationalModuleWorkspace(props: OperationalModuleWorkspaceProps) {
  const { module, role, actor, user, users, classes, records, allRecords, canWrite, onCreate, onView } = props;
  const managementRole = role === "diretor" || role === "administrador";
  const educatorRole = role === "professor" || role === "professor_substituto";
  const professors = users.filter((entry) => entry.tipo === "professor");

  switch (module.id) {
    case "acessos":
      return <div className="school-real-workspace"><ShortcutGrid shortcuts={managementRole ? shortcutSets.acessos : []} />{managementRole ? <AccessControlPanel users={users} actor={actor} /> : <CapabilityWorkspace module={module} records={records} canWrite={canWrite} onCreate={onCreate} onView={onView} />}</div>;
    case "calendario-horarios":
      return (
        <OperationalTabs defaultValue="calendario" tabs={[{ value: "calendario", label: "Calendário", icon: CalendarDays }, { value: "grades", label: "Grades horárias", icon: GraduationCap }, { value: "configuracao", label: "Tempos e disciplinas", icon: Settings2 }]}> 
          <TabsContent value="calendario"><CalendarioProgramacaoTab turmas={classes} /></TabsContent>
          <TabsContent value="grades"><HorariosTab turmas={classes} professores={professors} /></TabsContent>
          <TabsContent value="configuracao"><ConfiguracaoHorariosTab /></TabsContent>
        </OperationalTabs>
      );
    case "frequencia":
      return <PresencasTab userType={educatorRole ? "professor" : "diretor"} professorId={educatorRole ? user?.uid : undefined} />;
    case "atividades":
    case "avaliacoes":
      return <AvaliacoesTab userType={educatorRole ? "professor" : "diretor"} scope={module.id === "atividades" ? "atividades" : "avaliacoes"} />;
    case "notas-boletim":
      return (
        <OperationalTabs defaultValue="periodos" tabs={[{ value: "periodos", label: "Bimestres e notas", icon: GraduationCap }, { value: "boletins", label: "Boletins", icon: FileText }, { value: "autorizacoes", label: "Reaberturas", icon: FileCheck2 }]}> 
          <TabsContent value="periodos"><BimestresTab userType={educatorRole ? "professor" : "diretor"} /></TabsContent>
          <TabsContent value="boletins"><BoletimTab /></TabsContent>
          <TabsContent value="autorizacoes"><AutorizacaoNotasTab /></TabsContent>
        </OperationalTabs>
      );
    case "aulas-ao-vivo":
      return educatorRole ? <TeacherClassControl /> : <RouteAndCapabilityWorkspace {...props} />;
    case "documentos-escolares":
      return (
        <OperationalTabs defaultValue="emitir" tabs={[{ value: "emitir", label: "Emitir documentos", icon: FileText }, { value: "aceites", label: "Aceites e termos", icon: ShieldCheck }]}> 
          <TabsContent value="emitir"><DocumentationTab /></TabsContent>
          <TabsContent value="aceites"><InternalDocumentsTab /></TabsContent>
        </OperationalTabs>
      );
    case "comunicacao":
      return (
        <OperationalTabs defaultValue="avisos" tabs={[{ value: "avisos", label: "Avisos", icon: MessageSquareText }, { value: "preferencias", label: "Canais e notificações", icon: Settings2 }, { value: "outros", label: "Outras comunicações", icon: PlayCircle }]}> 
          <TabsContent value="avisos"><AnnouncementsTab /></TabsContent>
          <TabsContent value="preferencias"><NotificationPreferencesPanel user={user} actor={actor} /></TabsContent>
          <TabsContent value="outros"><div className="school-chat-callout"><MessageSquareText className="h-6 w-6" /><div><h4>Conversas individuais e em tempo real</h4><p>O chat permanece separado e preservado, com moderação, bloqueios e histórico próprios.</p></div><Button onClick={() => navigate("/chat")}>Abrir chat<ArrowRight className="ml-2 h-4 w-4" /></Button></div><CapabilityWorkspace module={module} records={records} canWrite={canWrite} onCreate={onCreate} onView={onView} compact /></TabsContent>
        </OperationalTabs>
      );
    case "bem-estar":
      return (
        <OperationalTabs defaultValue="pedidos" tabs={[{ value: "pedidos", label: "Pedidos disciplinares", icon: ClipboardCheck }, { value: "atendimentos", label: "Atendimentos e ocorrências", icon: HeartHandshake }]}> 
          <TabsContent value="pedidos"><DisciplinaryRequestsAdminTab /></TabsContent>
          <TabsContent value="atendimentos"><CapabilityWorkspace module={module} records={records} canWrite={canWrite} onCreate={onCreate} onView={onView} /></TabsContent>
        </OperationalTabs>
      );
    case "financeiro":
      return <AdminFinanceTab />;
    case "portal-aluno":
    case "portal-professor":
    case "portal-responsaveis":
      return <div className="school-real-workspace"><NotificationPreferencesPanel user={user} actor={actor} /><CapabilityWorkspace module={module} records={records} canWrite={canWrite} onCreate={onCreate} onView={onView} title={`Configuração do ${module.shortTitle.toLocaleLowerCase("pt-BR")}`} compact /></div>;
    case "acessibilidade":
      return <AccessibilityWorkspace {...props} />;
    case "lgpd-seguranca":
      return <div className="school-real-workspace"><PrivacyOperationsPanel user={user} records={allRecords} /><CapabilityWorkspace module={module} records={records} canWrite={canWrite} onCreate={onCreate} onView={onView} title="Solicitações, consentimentos e incidentes de privacidade" compact /></div>;
    case "instituicao":
    case "alunos":
    case "matriculas":
    case "estrutura-academica":
      return managementRole ? <RouteAndCapabilityWorkspace {...props} /> : <CapabilityWorkspace module={module} records={records} canWrite={canWrite} onCreate={onCreate} onView={onView} />;
    case "responsaveis":
    case "diario-planejamento":
    case "acompanhamento":
    case "conteudos":
    case "inclusao":
    case "secretaria":
    case "operacoes":
      return <CapabilityWorkspace module={module} records={records} canWrite={canWrite} onCreate={onCreate} onView={onView} />;
    default:
      return <div className="school-capability-empty"><PackageOpen className="h-8 w-8" /><h5>Área operacional indisponível</h5><p>Volte ao painel e escolha outro setor.</p></div>;
  }
}
