import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { User } from "@shared/schema";
import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface UserProfileDialogProps {
  userId: string;
  onClose: () => void;
}

export default function UserProfileDialog({ userId, onClose }: UserProfileDialogProps) {
  const [user, setUser] = useState<User | null>(null);
  const [turmaName, setTurmaName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userDoc = await getDoc(doc(db, "usuarios", userId));
        if (userDoc.exists()) {
          const userData = { uid: userDoc.id, ...userDoc.data() } as User;
          setUser(userData);

          if (userData.turma) {
            const turmaDoc = await getDoc(doc(db, "turmas", userData.turma));
            if (turmaDoc.exists()) {
              setTurmaName(turmaDoc.data().nome);
            }
          }
        }
      } catch (error) {
        console.error("Erro ao carregar perfil do usuário:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [userId]);

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

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case "aluno": return "Aluno";
      case "professor": return "Professor(a)";
      case "diretor": return "Diretor(a)";
      default: return tipo;
    }
  };

  const getBadgeVariant = (tipo: string) => {
    switch (tipo) {
      case "aluno": return "default";
      case "professor": return "secondary";
      case "diretor": return "destructive";
      default: return "outline";
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <Card className="relative w-full max-w-md z-10">
          <CardContent className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Carregando perfil...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <Card className="relative w-full max-w-md z-10">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Usuário não encontrado</p>
            <Button onClick={onClose} className="mt-4">Fechar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <Card className="relative w-full max-w-md z-10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Perfil do Usuário</CardTitle>
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-profile">
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        
        <Separator />
        
        <CardContent className="pt-6 space-y-6">
          <div className="flex flex-col items-center">
            <Avatar className="h-24 w-24 mb-3">
              {(user.fotoUrl || user.fotoBase64) && user.fotoPublica ? (
                <AvatarImage src={user.fotoUrl || user.fotoBase64} alt={getDisplayName(user)} />
              ) : null}
              <AvatarFallback className="text-2xl">
                {getInitials(user.nome, user.tipo)}
              </AvatarFallback>
            </Avatar>
            
            <h3 className="text-xl font-semibold text-center">{getDisplayName(user)}</h3>
            
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={getBadgeVariant(user.tipo) as any}>
                {getTipoLabel(user.tipo)}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            {user.mensagemStatus && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Recado</p>
                <p className="text-sm mt-1">{user.mensagemStatus}</p>
              </div>
            )}

            {user.tipo === "aluno" && turmaName && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Turma</p>
                <p className="text-sm mt-1">{turmaName}</p>
              </div>
            )}

            {user.tipo === "professor" && user.materias && user.materias.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Professor(a) de</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {user.materias.map((materia) => (
                    <Badge key={materia} variant="secondary" className="text-xs">
                      {materia}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
