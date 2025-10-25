import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { User } from "@shared/schema";
import { getTipoAlunoGenero } from "@/lib/utils";

interface UserSearchDialogProps {
  onClose: () => void;
  onSelectUser: (user: User) => void;
}

export default function UserSearchDialog({ onClose, onSelectUser }: UserSearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [turmas, setTurmas] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const { userData } = useAuth();

  // Carregar TODOS os usuários aprovados ao abrir
  useEffect(() => {
    const loadAllUsers = async () => {
      setLoading(true);
      try {
        // Carregar turmas para mapear IDs para nomes
        const turmasRef = collection(db, "turmas");
        const turmasSnapshot = await getDocs(turmasRef);
        const turmasMap = new Map<string, string>();
        
        turmasSnapshot.forEach((doc) => {
          const turmaData = doc.data();
          turmasMap.set(doc.id, turmaData.nome);
        });
        setTurmas(turmasMap);

        // Carregar TODOS os usuários aprovados
        const usersRef = collection(db, "usuarios");
        const snapshot = await getDocs(usersRef);
        const results: User[] = [];
        
        snapshot.forEach((doc) => {
          const user = { uid: doc.id, ...doc.data() } as User;
          // Filtrar apenas usuários ativos e excluir o próprio usuário
          const isActive = user.ativo === true || (user.ativo as any) === "true";
          const isApproved = user.status === "aprovado" || (user.status as any) === true;
          
          if (user.uid !== userData?.uid && isActive) {
            // Diretor sempre aparece se ativo, outros apenas se aprovados
            if (user.tipo === "diretor" || isApproved) {
              results.push(user);
            }
          }
        });
        
        // Ordenar alfabeticamente
        results.sort((a, b) => a.nome.localeCompare(b.nome));
        
        setAllUsers(results);
        setFilteredUsers(results);
      } catch (error) {
        console.error("Erro ao buscar usuários:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAllUsers();
  }, [userData?.uid]);

  // Filtrar usuários conforme digitação
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredUsers(allUsers);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = allUsers.filter((user) => {
      const displayName = user.tipo === "diretor" ? "Diretoria" : user.nome;
      
      // Se for diretor, verificar se o termo busca por "dir", "diretor" ou "diretoria"
      if (user.tipo === "diretor") {
        return (
          "diretoria".includes(term) ||
          "diretor".includes(term) ||
          "dir".includes(term) ||
          displayName.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term)
        );
      }
      
      return (
        displayName.toLowerCase().includes(term) ||
        user.nome.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        getTipoLabel(user.tipo, user).toLowerCase().includes(term) ||
        (user.turma && turmas.get(user.turma)?.toLowerCase().includes(term))
      );
    });
    
    setFilteredUsers(filtered);
  }, [searchTerm, allUsers, turmas]);

  const getInitials = (nome: string, tipo?: string) => {
    if (tipo === "diretor" || nome === "Diretoria") return "DIR";
    const names = nome.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  const getDisplayName = (user: User) => {
    return user.tipo === "diretor" ? "Diretoria" : user.nome;
  };

  const getTipoLabel = (tipo: string, user?: User) => {
    switch (tipo) {
      case "aluno": return getTipoAlunoGenero(user?.sexo);
      case "professor": return "Professor(a)";
      case "diretor": return "Diretor(a)";
      default: return tipo;
    }
  };

  const getUserDetails = (user: User) => {
    if (user.tipo === "aluno" && user.turma) {
      const nomeTurma = turmas.get(user.turma) || user.turma;
      return `Turma ${nomeTurma}`;
    }
    if (user.tipo === "professor") {
      return "Professor(a)";
    }
    if (user.tipo === "diretor") {
      return "Diretoria";
    }
    return "";
  };

  const getBadgeVariant = (tipo: string) => {
    switch (tipo) {
      case "aluno": return "default";
      case "professor": return "secondary";
      case "diretor": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      <Card className="relative w-full max-w-md max-h-[80vh] flex flex-col z-10">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Buscar Contato</h3>
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-search">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Digite para filtrar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-user"
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {filteredUsers.length} {filteredUsers.length === 1 ? 'pessoa' : 'pessoas'} disponível(eis)
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
              Carregando usuários...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="mb-2">Nenhum usuário encontrado</p>
              {searchTerm && (
                <p className="text-sm">Tente buscar por outro termo</p>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredUsers.map((user) => (
                <div
                  key={user.uid}
                  onClick={() => onSelectUser(user)}
                  className="p-3 hover-elevate active-elevate-2 cursor-pointer transition-colors"
                  data-testid={`user-${user.uid}`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="text-xs">
                        {getInitials(user.nome, user.tipo)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{getDisplayName(user)}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge 
                          variant={getBadgeVariant(user.tipo) as any} 
                          className="text-xs"
                        >
                          {getTipoLabel(user.tipo, user)}
                        </Badge>
                        {getUserDetails(user) && (
                          <span className="text-xs text-muted-foreground truncate">
                            {getUserDetails(user)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
