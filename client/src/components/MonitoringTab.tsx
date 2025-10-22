import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { Search, Users, GraduationCap, BookOpen, Clock } from "lucide-react";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import type { User, LoginHistory } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export function MonitoringTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"todos" | "aluno" | "professor">("todos");

  const { data: users, isLoading } = useRealtimeQuery<User>({
    collectionName: "usuarios",
    queryKey: ["/api/usuarios/monitoring"],
  });

  const { data: loginHistoryData } = useRealtimeQuery<LoginHistory>({
    collectionName: "loginHistory",
    queryKey: ["/api/loginHistory"],
  });

  // Função para converter para horário de Brasília
  const formatBrasiliaTime = (isoString: string | undefined) => {
    if (!isoString) return "Nunca";
    
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(date);
    } catch {
      return "Data inválida";
    }
  };

  // Obter último logout do histórico
  const getLastLogout = (userId: string): string | undefined => {
    if (!loginHistoryData) return undefined;
    
    const userHistory = loginHistoryData
      .filter(h => h.userId === userId && h.action === "logout")
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return userHistory[0]?.timestamp;
  };

  // Filtrar e ordenar usuários
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    
    let filtered = users.filter(user => 
      user.status === "aprovado" && 
      user.tipo !== "diretor" // Não mostrar diretores
    );

    // Filtro por tipo
    if (activeFilter !== "todos") {
      filtered = filtered.filter(user => user.tipo === activeFilter);
    }

    // Filtro por pesquisa
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user =>
        user.nome.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.matricula && user.matricula.includes(query))
      );
    }

    // Ordenar alfabeticamente
    return filtered.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [users, activeFilter, searchQuery]);

  // Separar por online/offline
  const onlineUsers = filteredUsers.filter(u => u.isOnline);
  const offlineUsers = filteredUsers.filter(u => !u.isOnline);

  // Agrupar por tipo
  const groupByTipo = (userList: User[]) => {
    const alunos = userList.filter(u => u.tipo === "aluno");
    const professores = userList.filter(u => u.tipo === "professor");
    return { alunos, professores };
  };

  const onlineGroups = groupByTipo(onlineUsers);
  const offlineGroups = groupByTipo(offlineUsers);

  const UserTable = ({ users, showLastSeen = false }: { users: User[], showLastSeen?: boolean }) => (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Matrícula</TableHead>
            {showLastSeen && <TableHead>Último Logout</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showLastSeen ? 6 : 5} className="text-center text-muted-foreground py-8">
                Nenhum usuário encontrado
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => {
              const lastLogout = showLastSeen ? getLastLogout(user.uid) : undefined;
              
              return (
                <TableRow key={user.uid} data-testid={`row-user-${user.uid}`}>
                  <TableCell>
                    <PresenceIndicator isOnline={user.isOnline} />
                  </TableCell>
                  <TableCell className="font-medium" data-testid={`text-username-${user.uid}`}>
                    {user.nome}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={user.tipo === "aluno" ? "default" : "secondary"}
                      className="no-default-hover-elevate no-default-active-elevate"
                      data-testid={`badge-tipo-${user.uid}`}
                    >
                      {user.tipo === "aluno" ? (
                        <>
                          <GraduationCap className="h-3 w-3 mr-1" />
                          Aluno
                        </>
                      ) : (
                        <>
                          <BookOpen className="h-3 w-3 mr-1" />
                          Professor
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {user.matricula || "-"}
                    </code>
                  </TableCell>
                  {showLastSeen && (
                    <TableCell data-testid={`text-last-logout-${user.uid}`}>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{formatBrasiliaTime(lastLogout || user.lastSeen)}</span>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com pesquisa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Monitoramento de Presença
          </CardTitle>
          <CardDescription>
            Acompanhe quem está online ou offline no momento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, email ou matrícula..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-users"
            />
          </div>

          {/* Filtros */}
          <div className="flex gap-2">
            <Badge
              variant={activeFilter === "todos" ? "default" : "outline"}
              className="cursor-pointer hover-elevate active-elevate-2"
              onClick={() => setActiveFilter("todos")}
              data-testid="badge-filter-todos"
            >
              Todos ({filteredUsers.length})
            </Badge>
            <Badge
              variant={activeFilter === "aluno" ? "default" : "outline"}
              className="cursor-pointer hover-elevate active-elevate-2"
              onClick={() => setActiveFilter("aluno")}
              data-testid="badge-filter-aluno"
            >
              <GraduationCap className="h-3 w-3 mr-1" />
              Alunos ({filteredUsers.filter(u => u.tipo === "aluno").length})
            </Badge>
            <Badge
              variant={activeFilter === "professor" ? "default" : "outline"}
              className="cursor-pointer hover-elevate active-elevate-2"
              onClick={() => setActiveFilter("professor")}
              data-testid="badge-filter-professor"
            >
              <BookOpen className="h-3 w-3 mr-1" />
              Professores ({filteredUsers.filter(u => u.tipo === "professor").length})
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Online/Offline */}
      <Tabs defaultValue="online" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="online" data-testid="tab-online">
            Online ({onlineUsers.length})
          </TabsTrigger>
          <TabsTrigger value="offline" data-testid="tab-offline">
            Offline ({offlineUsers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="online" className="space-y-6">
          {/* Alunos Online */}
          {(activeFilter === "todos" || activeFilter === "aluno") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Alunos Online ({onlineGroups.alunos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UserTable users={onlineGroups.alunos} />
              </CardContent>
            </Card>
          )}

          {/* Professores Online */}
          {(activeFilter === "todos" || activeFilter === "professor") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Professores Online ({onlineGroups.professores.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UserTable users={onlineGroups.professores} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="offline" className="space-y-6">
          {/* Alunos Offline */}
          {(activeFilter === "todos" || activeFilter === "aluno") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Alunos Offline ({offlineGroups.alunos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UserTable users={offlineGroups.alunos} showLastSeen />
              </CardContent>
            </Card>
          )}

          {/* Professores Offline */}
          {(activeFilter === "todos" || activeFilter === "professor") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Professores Offline ({offlineGroups.professores.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UserTable users={offlineGroups.professores} showLastSeen />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
