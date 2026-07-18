import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Search, MessageSquare } from "lucide-react";
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
import {
  addDoc,
  collection,
  getDocs,
  query as firestoreQuery,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { User } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UserPresenceIndicator } from "@/components/UserPresenceIndicator";

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: string) => void;
}

function uniqueNames(values: string[]): string[] {
  const seen = new Set<string>();

  return values.filter((value) => {
    const normalized = value.trim().toLocaleLowerCase("pt-BR");
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export default function NewChatDialog({
  open,
  onOpenChange,
  onConversationCreated,
}: NewChatDialogProps) {
  const { userData } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [turmas, setTurmas] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Depende apenas do UID estável. Atualizações de presença no documento do
  // usuário não recarregam a lista e, por isso, o modal não fica piscando.
  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      return;
    }

    if (!userData?.uid) return;

    let cancelled = false;

    const loadDialogData = async () => {
      setIsLoading(true);

      try {
        const usersRef = collection(db, "usuarios");
        const usersQuery = firestoreQuery(
          usersRef,
          where("ativo", "==", true),
          where("status", "==", "aprovado"),
        );
        const turmasRef = collection(db, "turmas");

        const [usersSnapshot, turmasSnapshot] = await Promise.all([
          getDocs(usersQuery),
          getDocs(turmasRef),
        ]);

        if (cancelled) return;

        const turmasMap: Record<string, string> = {};
        turmasSnapshot.docs.forEach((turmaDoc) => {
          const data = turmaDoc.data();
          turmasMap[turmaDoc.id] = String(data.nome || turmaDoc.id).trim();
        });

        const users = usersSnapshot.docs
          .map((userDoc) => ({ uid: userDoc.id, ...userDoc.data() }) as User)
          .filter((user) => user.uid !== userData.uid)
          .sort((a, b) => {
            const nameA = a.tipo === "diretor" ? "Diretoria" : a.nome;
            const nameB = b.tipo === "diretor" ? "Diretoria" : b.nome;
            return nameA.localeCompare(nameB, "pt-BR");
          });

        setTurmas(turmasMap);
        setAllUsers(users);
      } catch (error) {
        console.error("Erro ao carregar contatos do chat:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadDialogData();

    return () => {
      cancelled = true;
    };
  }, [open, userData?.uid]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase("pt-BR");
    if (!term) return allUsers;

    return allUsers.filter((user) => {
      const displayName = user.tipo === "diretor" ? "Diretoria" : user.nome;

      if (user.tipo === "diretor") {
        return (
          "diretoria".includes(term) ||
          "diretor".includes(term) ||
          "dir".includes(term) ||
          displayName.toLocaleLowerCase("pt-BR").includes(term)
        );
      }

      return (
        displayName.toLocaleLowerCase("pt-BR").includes(term) ||
        user.nome.toLocaleLowerCase("pt-BR").includes(term) ||
        Boolean(user.matricula?.toLocaleLowerCase("pt-BR").includes(term))
      );
    });
  }, [allUsers, searchTerm]);

  const getTeacherClassNames = (user: User): string[] => {
    if (!Array.isArray(user.turmas)) return [];

    const names = user.turmas
      .map((turmaId) => String(turmas[turmaId] || turmaId).trim())
      .filter((name) => name && !/^[a-zA-Z0-9]{20,}$/.test(name));

    return uniqueNames(names);
  };

  const handleCreateConversation = async (otherUser: User) => {
    if (!userData || isCreating) return;

    setIsCreating(true);
    try {
      const conversationsRef = collection(db, "chatConversations");

      const q1 = firestoreQuery(
        conversationsRef,
        where("participante1Id", "==", userData.uid),
        where("participante2Id", "==", otherUser.uid),
      );
      const q2 = firestoreQuery(
        conversationsRef,
        where("participante1Id", "==", otherUser.uid),
        where("participante2Id", "==", userData.uid),
      );

      const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);

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
      console.error("Erro ao criar conversa:", error);
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
              onChange={(event) => setSearchTerm(event.target.value)}
              data-testid="input-search-users"
            />
          </div>

          <ScrollArea className="h-[400px] rounded-md border p-4">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-muted-foreground">Carregando...</div>
              </div>
            ) : filteredUsers.length > 0 ? (
              <div className="space-y-2">
                {filteredUsers.map((user) => {
                  const teacherClasses =
                    user.tipo === "professor" ? getTeacherClassNames(user) : [];

                  return (
                    <div
                      key={user.uid}
                      className={cn(
                        "flex items-center gap-3 rounded-lg p-3 transition-colors",
                        isCreating
                          ? "cursor-wait opacity-70"
                          : "cursor-pointer hover-elevate active-elevate-2",
                      )}
                      onClick={() => void handleCreateConversation(user)}
                      data-testid={`user-item-${user.uid}`}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={user.fotoUrl || user.fotoBase64 || ""} />
                          <AvatarFallback className="bg-[#00a884] text-white">
                            {user.tipo === "diretor"
                              ? "DIR"
                              : user.nome.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <UserPresenceIndicator
                          userId={user.uid}
                          showText={false}
                          className="absolute bottom-0 right-0"
                          dotClassName="h-3 w-3 border-2 border-background"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            className="truncate font-semibold"
                            data-testid={`text-user-name-${user.uid}`}
                          >
                            {user.tipo === "diretor" ? "Diretoria" : user.nome}
                          </h3>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-xs",
                              user.tipo === "professor" &&
                                "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                              user.tipo === "diretor" &&
                                "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
                            )}
                          >
                            {getUserTypeLabel(user.tipo)}
                          </Badge>
                        </div>

                        {user.tipo === "aluno" && user.turma && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {turmas[user.turma] || user.turma}
                          </p>
                        )}

                        {user.tipo === "professor" && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {teacherClasses.length > 0
                              ? teacherClasses.join(", ")
                              : "Sem turmas"}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : searchTerm ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Search className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum usuário encontrado</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Tente buscar por outro nome ou matrícula
                </p>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum contato disponível</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
