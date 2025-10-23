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

interface UserSearchDialogProps {
  onClose: () => void;
  onSelectUser: (user: User) => void;
}

export default function UserSearchDialog({ onClose, onSelectUser }: UserSearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const { userData } = useAuth();

  useEffect(() => {
    if (searchTerm.length < 2) {
      setUsers([]);
      return;
    }

    const searchUsers = async () => {
      setLoading(true);
      try {
        const usersRef = collection(db, "users");
        const q = query(
          usersRef,
          where("status", "==", "aprovado"),
          orderBy("nome")
        );
        
        const snapshot = await getDocs(q);
        const results: User[] = [];
        
        snapshot.forEach((doc) => {
          const user = { uid: doc.id, ...doc.data() } as User;
          if (
            user.uid !== userData?.uid &&
            user.nome.toLowerCase().includes(searchTerm.toLowerCase())
          ) {
            results.push(user);
          }
        });
        
        setUsers(results);
      } catch (error) {
        console.error("Erro ao buscar usuários:", error);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, userData?.uid]);

  const getInitials = (nome: string) => {
    const names = nome.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case "aluno": return "Aluno";
      case "professor": return "Professor";
      case "diretor": return "Diretoria";
      default: return tipo;
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60]" onClick={onClose} />
      
      <Card className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-[60] max-h-[80vh] flex flex-col">
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
              placeholder="Digite o nome do usuário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-user"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              Buscando...
            </div>
          ) : searchTerm.length < 2 ? (
            <div className="p-4 text-center text-muted-foreground">
              Digite pelo menos 2 caracteres para buscar
            </div>
          ) : users.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              Nenhum usuário encontrado
            </div>
          ) : (
            <div className="divide-y">
              {users.map((user) => (
                <div
                  key={user.uid}
                  onClick={() => onSelectUser(user)}
                  className="p-3 hover-elevate cursor-pointer"
                  data-testid={`user-${user.uid}`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{getInitials(user.nome)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{user.nome}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {getTipoLabel(user.tipo)}
                        </Badge>
                        {user.turma && (
                          <span className="text-xs text-muted-foreground">
                            Turma: {user.turma}
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
    </>
  );
}
