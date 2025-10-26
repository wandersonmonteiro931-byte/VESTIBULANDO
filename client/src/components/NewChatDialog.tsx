import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Search, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { collection, query as firestoreQuery, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: string) => void;
}

export default function NewChatDialog({ 
  open, 
  onOpenChange, 
  onConversationCreated 
}: NewChatDialogProps) {
  const { userData } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [turmas, setTurmas] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (open && userData) {
      loadUsers();
      loadTurmas();
    } else {
      setSearchTerm("");
    }
  }, [open, userData]);

  useEffect(() => {
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const filtered = allUsers.filter(user => {
        const displayName = user.tipo === "diretor" ? "Diretoria" : user.nome;
        
        if (user.tipo === "diretor") {
          return (
            "diretoria".includes(term) ||
            "diretor".includes(term) ||
            "dir".includes(term) ||
            displayName.toLowerCase().includes(term)
          );
        }
        
        return (
          displayName.toLowerCase().includes(term) ||
          user.nome.toLowerCase().includes(term) ||
          (user.matricula && user.matricula.includes(term))
        );
      });
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(allUsers);
    }
  }, [searchTerm, allUsers]);

  const loadUsers = async () => {
    if (!userData) return;
    
    setIsLoading(true);
    try {
      const usersRef = collection(db, "usuarios");
      const q = firestoreQuery(
        usersRef,
        where("ativo", "==", true),
        where("status", "==", "aprovado")
      );

      const snapshot = await getDocs(q);
      const users = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as User))
        .filter(user => user.uid !== userData.uid)
        .sort((a, b) => {
          const nameA = a.tipo === "diretor" ? "Diretoria" : a.nome;
          const nameB = b.tipo === "diretor" ? "Diretoria" : b.nome;
          return nameA.localeCompare(nameB);
        });
      
      setAllUsers(users);
      setFilteredUsers(users);
    } catch (error) {
      console.error("❌ Error loading users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTurmas = async () => {
    try {
      const turmasRef = collection(db, "turmas");
      const snapshot = await getDocs(turmasRef);
      const turmasMap: Record<string, string> = {};
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        turmasMap[doc.id] = data.nome || doc.id;
      });
      
      setTurmas(turmasMap);
    } catch (error) {
      console.error("❌ Error loading turmas:", error);
    }
  };

  const handleCreateConversation = async (otherUser: User) => {
    if (!userData || isCreating) return;

    setIsCreating(true);
    try {
      const conversationsRef = collection(db, "chatConversations");
      
      const q1 = firestoreQuery(
        conversationsRef,
        where("participante1Id", "==", userData.uid),
        where("participante2Id", "==", otherUser.uid)
      );
      const q2 = firestoreQuery(
        conversationsRef,
        where("participante1Id", "==", otherUser.uid),
        where("participante2Id", "==", userData.uid)
      );

      const [snapshot1, snapshot2] = await Promise.all([
        getDocs(q1),
        getDocs(q2)
      ]);

      if (!snapshot1.empty) {
        onConversationCreated(snapshot1.docs[0].id);
        onOpenChange(false);
        return;
      }

      if (!snapshot2.empty) {
        onConversationCreated(snapshot2.docs[0].id);
        onOpenChange(false);
        return;
      }

      const now = new Date().toISOString();
      const conversationData = {
        participante1Id: userData.uid,
        participante1Nome: userData.nome,
        participante1Tipo: userData.tipo,
        participante2Id: otherUser.uid,
        participante2Nome: otherUser.nome,
        participante2Tipo: otherUser.tipo,
        mensagensNaoLidas1: 0,
        mensagensNaoLidas2: 0,
        participante1Digitando: false,
        participante2Digitando: false,
        deletadaPorParticipante1: false,
        deletadaPorParticipante2: false,
        dataCriacao: now,
        dataUltimaAtualizacao: now,
      };

      const conversationDoc = await addDoc(conversationsRef, conversationData);
      onConversationCreated(conversationDoc.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating conversation:", error);
    } finally {
      setIsCreating(false);
    }
  };


  const getUserTypeLabel = (tipo: string) => {
    switch (tipo) {
      case "aluno":
        return "Aluno";
      case "professor":
        return "Professor";
      case "diretor":
        return "Diretor";
      default:
        return tipo;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#00a884]" />
            Nova Conversa
          </DialogTitle>
          <DialogDescription>
            Busque por alunos, professores ou diretores para iniciar uma conversa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nome ou matrícula..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-users"
            />
          </div>

          <ScrollArea className="h-[400px] rounded-md border p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-muted-foreground">Carregando...</div>
              </div>
            ) : filteredUsers.length > 0 ? (
              <div className="space-y-2">
                {filteredUsers.map((user) => (
                  <div
                    key={user.uid}
                    className="flex items-center gap-3 p-3 rounded-lg hover-elevate active-elevate-2 cursor-pointer transition-colors"
                    onClick={() => handleCreateConversation(user)}
                    data-testid={`user-item-${user.uid}`}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.fotoUrl || user.fotoBase64 || ""} />
                      <AvatarFallback className="bg-[#00a884] text-white">
                        {user.tipo === "diretor" ? "DIR" : user.nome.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate" data-testid={`text-user-name-${user.uid}`}>
                          {user.tipo === "diretor" ? "Diretoria" : user.nome}
                        </h3>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            user.tipo === "professor" && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                            user.tipo === "diretor" && "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                          )}
                        >
                          {getUserTypeLabel(user.tipo)}
                        </Badge>
                      </div>
                      {user.turma && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {turmas[user.turma] || user.turma}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : searchTerm ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum usuário encontrado</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Tente buscar por outro nome ou matrícula
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Carregando usuários...</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
