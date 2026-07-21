import { useMemo, useState } from "react";
import type { ElementType } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  GraduationCap,
  HeartHandshake,
  KeyRound,
  Landmark,
  Library,
  ListChecks,
  MessageSquareText,
  Plus,
  Receipt,
  Search,
  Settings2,
  ShieldCheck,
  UserCheck,
  Users,
  UsersRound,
  Video,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";

interface WorkspaceItem {
  label: string;
  description: string;
  href: string;
  icon: ElementType;
  count?: number;
}

interface WorkspaceGroup {
  title: string;
  description: string;
  items: WorkspaceItem[];
}

interface SchoolOperationsHomeProps {
  onNavigate?: (section: string, action?: string) => void;
}

function activeUser(user: any) {
  return user?.ativo !== false && user?.ativo !== "false" && user?.status !== "rejeitado" && user?.status !== "excluido";
}

export function SchoolOperationsHome({ onNavigate }: SchoolOperationsHomeProps = {}) {
  const [search, setSearch] = useState("");
  const { data: users = [], isLoading: loadingUsers } = useRealtimeQuery<any>({ collectionName: "usuarios", queryKey: ["/school/home/users"] });
  const { data: classes = [], isLoading: loadingClasses } = useRealtimeQuery<any>({ collectionName: "turmas", queryKey: ["/school/home/classes"] });
  const { data: requests = [], isLoading: loadingRequests } = useRealtimeQuery<any>({ collectionName: "solicitacoes", queryKey: ["/school/home/requests"] });
  const { data: disciplinaryRequests = [] } = useRealtimeQuery<any>({ collectionName: "disciplinaryRequests", queryKey: ["/school/home/disciplinary"] });
  const { data: gradeRequests = [] } = useRealtimeQuery<any>({ collectionName: "solicitacoesEdicaoNota", queryKey: ["/school/home/grade-requests"] });

  const students = users.filter((user) => user.tipo === "aluno" && activeUser(user));
  const teachers = users.filter((user) => user.tipo === "professor" && activeUser(user));
  const pendingApprovals = requests.filter((request) => !request.status || request.status === "pendente");
  const pendingDiscipline = disciplinaryRequests.filter((request) => request.status === "pendente");
  const pendingGrades = gradeRequests.filter((request) => request.status === "pendente");
  const loading = loadingUsers || loadingClasses || loadingRequests;

  const navigateTo = (href: string) => {
    const target = new URL(href, window.location.origin);
    const section = target.searchParams.get("secao");
    const action = target.searchParams.get("acao") || undefined;
    if (onNavigate && target.pathname === "/diretor" && section) {
      onNavigate(section, action);
      return;
    }
    window.location.assign(`${target.pathname}${target.search}${target.hash}`);
  };

  const groups = useMemo<WorkspaceGroup[]>(() => [
    {
      title: "Pessoas e matrículas",
      description: "Cadastros, acesso, vínculos familiares, turmas e movimentações.",
      items: [
        { label: "Alunos", description: "Cadastrar, consultar, editar e transferir alunos", href: "/diretor?secao=usuarios", icon: Users, count: students.length },
        { label: "Professores", description: "Cadastro, disciplinas, turmas e disponibilidade", href: "/diretor?secao=professores", icon: GraduationCap, count: teachers.length },
        { label: "Turmas", description: "Vagas, alunos, período e organização das turmas", href: "/diretor?secao=turmas", icon: UsersRound, count: classes.length },
        { label: "Matrículas e aprovações", description: "Inscrições, análise, lista de espera e rematrícula", href: "/diretor?secao=aprovacoes", icon: UserCheck, count: pendingApprovals.length },
        { label: "Responsáveis e família", description: "Vínculos, guarda, permissões e autorizações", href: "/escola?modulo=responsaveis", icon: HeartHandshake },
        { label: "Usuários e acessos", description: "Contas, senhas, permissões e bloqueios", href: "/diretor?secao=senhas-logins", icon: KeyRound },
      ],
    },
    {
      title: "Acadêmico",
      description: "Rotina letiva do planejamento ao resultado final.",
      items: [
        { label: "Grade horária", description: "Horários de turmas, professores e disciplinas", href: "/diretor?secao=horarios", icon: Clock3 },
        { label: "Calendário", description: "Aulas, provas, recessos e eventos escolares", href: "/diretor?secao=calendario", icon: CalendarDays },
        { label: "Presenças", description: "Chamadas, faltas, justificativas e frequência", href: "/diretor?secao=presencas", icon: ClipboardCheck },
        { label: "Diário e planejamento", description: "Plano de aula, conteúdo ministrado e aprovação", href: "/escola?modulo=diario-planejamento", icon: BookOpen },
        { label: "Atividades", description: "Tarefas, entregas, correções e feedback", href: "/escola?modulo=atividades", icon: ListChecks },
        { label: "Avaliações", description: "Provas, questões, aplicação e resultados", href: "/escola?modulo=avaliacoes", icon: FileCheck2 },
        { label: "Bimestres e notas", description: "Períodos, lançamentos, médias e fechamentos", href: "/diretor?secao=bimestres", icon: BarChart3 },
        { label: "Boletins", description: "Resultados parciais, finais e histórico", href: "/diretor?secao=boletins", icon: FileText },
        { label: "Autorizações de notas", description: "Reaberturas e correções pendentes", href: "/diretor?secao=autorizacoes-notas", icon: CheckCircle2, count: pendingGrades.length },
      ],
    },
    {
      title: "Atendimento e comunicação",
      description: "Relação da escola com estudantes, famílias e equipe.",
      items: [
        { label: "Avisos", description: "Publicar comunicados e acompanhar destinatários", href: "/diretor?secao=avisos", icon: Bell },
        { label: "Disciplina", description: "Advertências, suspensões e histórico", href: "/diretor?secao=disciplinares", icon: AlertTriangle },
        { label: "Pedidos de professores", description: "Analisar solicitações disciplinares", href: "/diretor?secao=pedidos-disciplinares", icon: MessageSquareText, count: pendingDiscipline.length },
        { label: "Documentos escolares", description: "Declarações, históricos, certificados e validação", href: "/diretor?secao=documentacao", icon: FileText },
        { label: "Secretaria", description: "Protocolos, solicitações e prazos de atendimento", href: "/escola?modulo=secretaria", icon: Receipt },
        { label: "Inclusão e apoio", description: "PEI, adaptações e atendimento especializado", href: "/escola?modulo=inclusao", icon: HeartHandshake },
        { label: "Conteúdos", description: "Materiais, módulos, progresso e liberações", href: "/escola?modulo=conteudos", icon: Library },
        { label: "Aulas ao vivo", description: "Agendamento, presença, materiais e gravações", href: "/escola?modulo=aulas-ao-vivo", icon: Video },
      ],
    },
    {
      title: "Administração da escola",
      description: "Financeiro, instituição, relatórios, proteção de dados e continuidade.",
      items: [
        { label: "Financeiro", description: "Faturas, bolsas, pagamentos e inadimplência", href: "/diretor?secao=financeiro", icon: WalletCards },
        { label: "Instituição", description: "Unidades, períodos, turnos e regras escolares", href: "/escola?modulo=instituicao", icon: Landmark },
        { label: "Estrutura acadêmica", description: "Cursos, matrizes, disciplinas e capacidade", href: "/escola?modulo=estrutura-academica", icon: GraduationCap },
        { label: "Relatórios", description: "Indicadores, filtros e exportações", href: "/escola?modulo=relatorios", icon: BarChart3 },
        { label: "Serviços administrativos", description: "Biblioteca, transporte, estoque e patrimônio", href: "/escola?modulo=operacoes", icon: Settings2 },
        { label: "Privacidade e segurança", description: "LGPD, consentimentos, auditoria e incidentes", href: "/escola?modulo=lgpd-seguranca", icon: ShieldCheck },
        { label: "Integrações", description: "Importações, exportações, APIs e conexões", href: "/escola?modulo=integracoes", icon: Settings2 },
        { label: "Backup e continuidade", description: "Backups, restauração e testes de recuperação", href: "/escola?modulo=continuidade", icon: ShieldCheck },
      ],
    },
  ], [students.length, teachers.length, classes.length, pendingApprovals.length, pendingDiscipline.length, pendingGrades.length]);

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filteredGroups = groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => !normalizedSearch || `${item.label} ${item.description} ${group.title}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch)),
  })).filter((group) => group.items.length > 0);

  return (
    <section className="school-operations-home" aria-labelledby="school-home-title">
      <div className="school-home-heading">
        <div>
          <span>PAINEL DA DIRETORIA</span>
          <h1 id="school-home-title">O que você precisa fazer?</h1>
          <p>Escolha um setor para abrir diretamente a tela de trabalho correspondente.</p>
        </div>
        <div className="school-home-search"><Search className="h-4 w-4" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar aluno, presença, boletim, financeiro..." aria-label="Buscar setor" /></div>
      </div>

      <div className="school-home-summary" aria-label="Resumo da escola">
        {loading ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-lg" />) : <>
          <button type="button" onClick={() => navigateTo("/diretor?secao=usuarios")}><Users className="h-5 w-5" /><span><strong>{students.length}</strong><small>alunos ativos</small></span><ChevronRight className="h-4 w-4" /></button>
          <button type="button" onClick={() => navigateTo("/diretor?secao=professores")}><GraduationCap className="h-5 w-5" /><span><strong>{teachers.length}</strong><small>professores</small></span><ChevronRight className="h-4 w-4" /></button>
          <button type="button" onClick={() => navigateTo("/diretor?secao=turmas")}><UsersRound className="h-5 w-5" /><span><strong>{classes.length}</strong><small>turmas</small></span><ChevronRight className="h-4 w-4" /></button>
          <button type="button" onClick={() => navigateTo("/diretor?secao=aprovacoes")} className={pendingApprovals.length ? "is-pending" : ""}><UserCheck className="h-5 w-5" /><span><strong>{pendingApprovals.length}</strong><small>aprovações pendentes</small></span><ChevronRight className="h-4 w-4" /></button>
        </>}
      </div>

      <div className="school-home-quick-actions">
        <span>Ações rápidas</span>
        <Button onClick={() => navigateTo("/diretor?secao=usuarios&acao=novo-aluno")}><Plus className="mr-2 h-4 w-4" />Cadastrar aluno</Button>
        <Button variant="outline" onClick={() => navigateTo("/diretor?secao=professores&acao=novo-professor")}><Plus className="mr-2 h-4 w-4" />Cadastrar professor</Button>
        <Button variant="outline" onClick={() => navigateTo("/diretor?secao=turmas&acao=nova-turma")}><Plus className="mr-2 h-4 w-4" />Criar turma</Button>
        <Button variant="outline" onClick={() => navigateTo("/diretor?secao=presencas")}><ClipboardCheck className="mr-2 h-4 w-4" />Abrir presenças</Button>
      </div>

      <div className="school-home-groups">
        {filteredGroups.map((group) => (
          <section key={group.title} className="school-home-group">
            <div className="school-home-group-title"><div><h2>{group.title}</h2><p>{group.description}</p></div><span>{group.items.length} áreas</span></div>
            <div className="school-home-grid">
              {group.items.map((item) => {
                const Icon = item.icon;
                return <button type="button" key={item.label} className="school-home-item" onClick={() => navigateTo(item.href)}><span className="school-home-item-icon"><Icon className="h-5 w-5" /></span><span className="school-home-item-copy"><strong>{item.label}</strong><small>{item.description}</small></span>{typeof item.count === "number" && item.count > 0 && <b>{item.count}</b>}<ChevronRight className="h-4 w-4" /></button>;
              })}
            </div>
          </section>
        ))}
        {!filteredGroups.length && <div className="school-home-no-results"><Search className="h-8 w-8" /><h2>Nenhum setor encontrado</h2><p>Tente buscar por outro nome.</p></div>}
      </div>
    </section>
  );
}
