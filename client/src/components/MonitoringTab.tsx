import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Users, GraduationCap, BookOpen } from "lucide-react";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import type { User } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export function MonitoringTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"todos" | "aluno" | "professor">("todos");

  const { data: users, isLoading } = useRealtimeQuery<User>({
    collectionName: "usuarios",
    queryKey: ["/api/usuarios/monitoring"],
  });

  // Filtrar e ordenar usuários
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    
    let filtered = users.filter(user => 
      user.status === "aprovado" && 
      user.tipo !== "diretor"
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

  // Agrupar por tipo
  const alunosList = filteredUsers.filter(u => u.tipo === "aluno");
  const professoresList = filteredUsers.filter(u => u.tipo === "professor");

  const UserTable = ({ users }: { users: User[] }) => (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Matrícula</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                Nenhum usuário encontrado
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.uid} data-testid={`row-user-${user.uid}`}>
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
              </TableRow>
            ))
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuários Cadastrados
          </CardTitle>
          <CardDescription>
            Visualize todos os usuários aprovados no sistema
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
              Alunos ({alunosList.length})
            </Badge>
            <Badge
              variant={activeFilter === "professor" ? "default" : "outline"}
              className="cursor-pointer hover-elevate active-elevate-2"
              onClick={() => setActiveFilter("professor")}
              data-testid="badge-filter-professor"
            >
              <BookOpen className="h-3 w-3 mr-1" />
              Professores ({professoresList.length})
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {(activeFilter === "todos" || activeFilter === "aluno") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Alunos ({alunosList.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UserTable users={alunosList} />
            </CardContent>
          </Card>
        )}

        {(activeFilter === "todos" || activeFilter === "professor") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Professores ({professoresList.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UserTable users={professoresList} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
