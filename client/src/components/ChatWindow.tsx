import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Search, Plus, MoreVertical, Trash2, Ban, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, onSnapshot, addDoc, getDocs, deleteDoc, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";
import type { ChatConversation, User, UserBlock } from "@shared/schema";
import ChatMessageArea from "./ChatMessageArea";
import UserAccountMenu from "./UserAccountMenu";
import { PresenceIndicator } from "./PresenceIndicator";
import { ConversationItem } from "./ConversationItem";
import { ChatTermsModal } from "./ChatTermsModal";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChatWindowProps {
  onClose: () => void;
}

function ChatWindowContent({ onClose }: ChatWindowProps) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<ChatConversation | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [userToBlock, setUserToBlock] = useState<{ id: string; nome: string } | null>(null);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const { userData } = useAuth();
  const { toast } = useToast();

  // Carregar usuários bloqueados
  useEffect(() => {
    if (!userData?.uid) return;

    const blocksRef = collection(db, "chat_user_blocks");
    const q = query(
      blocksRef,
      where("bloqueadorId", "==", userData.uid),
      where("ativo", "==", true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const blocked = new Set<string>();
      snapshot.forEach((doc) => {
        const block = doc.data();
        blocked.add(block.bloqueadoId);
      });
      setBlockedUsers(blocked);
    });

    return () => unsubscribe();
  }, [userData?.uid]);

  // Carregar todos os usuários ativos
  useEffect(() => {
    const loadUsers = async () => {
      if (!userData?.uid) return;

      try {
        const usersRef = collection(db, "usuarios");
        const snapshot = await getDocs(usersRef);
        const users: User[] = [];
        
        snapshot.forEach((doc) => {
          const user = { uid: doc.id, ...doc.data() } as User;
          if (user.uid !== userData.uid) {
            // Aceitar ativo como string "true" ou boolean true para compatibilidade
            const isActive = user.ativo === true || (user.ativo as any) === "true";
            // Aceitar status como boolean true ou string "aprovado" para compatibilidade
            const isApproved = user.status === "aprovado" || (user.status as any) === true;
            
            if (isActive) {
              // Diretor sempre aparece se ativo, outros apenas se aprovados
              if (user.tipo === "diretor" || isApproved) {
                users.push(user);
              }
            }
          }
        });
        
        users.sort((a, b) => {
          if (a.tipo === "diretor") return -1;
          if (b.tipo === "diretor") return 1;
          return a.nome.localeCompare(b.nome);
        });
        
        setAllUsers(users);
      } catch (error) {
        console.error("Erro ao carregar usuários:", error);
      }
    };

    loadUsers();
  }, [userData?.uid]);

  // Filtrar usuários com base na busca
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers([]);
      return;
    }

    const term = searchQuery.toLowerCase();
    const filtered = allUsers.filter((user) => {
      if (blockedUsers.has(user.uid)) return false;
      
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
        user.email.toLowerCase().includes(term)
      );
    });
    
    setFilteredUsers(filtered);
  }, [searchQuery, allUsers, blockedUsers]);

  // Verificar se usuário aceitou os termos do chat
  useEffect(() => {
    const checkTermsAcceptance = async () => {
      if (!userData?.uid) return;

      try {
        const userRef = doc(db, "usuarios", userData.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const user = userSnap.data();
          const accepted = user.chatTermsAccepted === true;
          setHasAcceptedTerms(accepted);
          
          if (!accepted) {
            setTermsModalOpen(true);
          }
        }
      } catch (error) {
        console.error("Erro ao verificar aceitação dos termos:", error);
      }
    };

    checkTermsAcceptance();
  }, [userData?.uid]);

  // Carregar conversas existentes
  useEffect(() => {
    if (!userData?.uid) return;

    const conversationsRef = collection(db, "chat_conversations");
    
    const q1 = query(
      conversationsRef,
      where("participante1Id", "==", userData.uid)
    );
    
    const q2 = query(
      conversationsRef,
      where("participante2Id", "==", userData.uid)
    );

    let conversations1: ChatConversation[] = [];
    let conversations2: ChatConversation[] = [];

    const unsubscribe1 = onSnapshot(q1, (snapshot) => {
      conversations1 = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as ChatConversation));
      mergeAndUpdateConversations();
    });

    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      conversations2 = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as ChatConversation));
      mergeAndUpdateConversations();
    });

    const mergeAndUpdateConversations = () => {
      const allConversations = [...conversations1, ...conversations2];
      const conversationMap = new Map<string, ChatConversation>();
      
      allConversations.forEach((conv) => {
        if (!conversationMap.has(conv.id) && conv.ultimaMensagem) {
          conversationMap.set(conv.id, conv);
        }
      });
      
      const uniqueConversations = Array.from(conversationMap.values());
      
      uniqueConversations.sort((a, b) => {
        const dateA = new Date(a.dataUltimaAtualizacao || a.dataCriacao).getTime();
        const dateB = new Date(b.dataUltimaAtualizacao || b.dataCriacao).getTime();
        return dateB - dateA;
      });
      
      setConversations(uniqueConversations);
      setLoading(false);
    };

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [userData?.uid]);

  const handleSelectUser = (user: User) => {
    if (blockedUsers.has(user.uid)) {
      toast({
        title: "Usuário bloqueado",
        description: "Você bloqueou este usuário. Desbloqueie-o para conversar.",
        variant: "destructive",
      });
      return;
    }

    setSelectedUser(user);
    setSelectedConversation(null);
    setSearchQuery("");
  };

  const handleSelectConversation = async (conversation: ChatConversation) => {
    const otherId = conversation.participante1Id === userData?.uid 
      ? conversation.participante2Id 
      : conversation.participante1Id;

    if (blockedUsers.has(otherId)) {
      toast({
        title: "Usuário bloqueado",
        description: "Você bloqueou este usuário.",
        variant: "destructive",
      });
      return;
    }

    setSelectedConversation(conversation);
    setSelectedUser(null);

    try {
      const conversationRef = doc(db, "chat_conversations", conversation.id);
      const conversationSnap = await getDoc(conversationRef);
      
      if (conversationSnap.exists()) {
        const isParticipant1 = conversation.participante1Id === userData?.uid;
        const fieldToUpdate = isParticipant1 ? "mensagensNaoLidas1" : "mensagensNaoLidas2";
        
        await updateDoc(conversationRef, {
          [fieldToUpdate]: 0,
        });
      }
    } catch (error) {
      console.error("Erro ao atualizar contador de mensagens não lidas:", error);
    }
  };

  const handleDeleteConversation = async () => {
    if (!conversationToDelete) return;

    try {
      await deleteDoc(doc(db, "chat_conversations", conversationToDelete.id));
      
      toast({
        title: "Conversa excluída",
        description: "A conversa foi removida com sucesso.",
      });
      
      if (selectedConversation?.id === conversationToDelete.id) {
        setSelectedConversation(null);
        setSelectedUser(null);
      }
      
      setDeleteDialogOpen(false);
      setConversationToDelete(null);
    } catch (error) {
      console.error("Erro ao excluir conversa:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a conversa.",
        variant: "destructive",
      });
    }
  };

  const handleBlockUser = async () => {
    if (!userToBlock || !userData?.uid) return;

    try {
      await addDoc(collection(db, "chat_user_blocks"), {
        bloqueadorId: userData.uid,
        bloqueadorNome: userData.nome,
        bloqueadoId: userToBlock.id,
        bloqueadoNome: userToBlock.nome,
        dataBloqueio: getNowBrasiliaISO(),
        ativo: true,
      });

      toast({
        title: "Usuário bloqueado",
        description: `${userToBlock.nome} foi bloqueado com sucesso.`,
      });

      setBlockDialogOpen(false);
      setUserToBlock(null);
      setSelectedConversation(null);
      setSelectedUser(null);
    } catch (error) {
      console.error("Erro ao bloquear usuário:", error);
      toast({
        title: "Erro",
        description: "Não foi possível bloquear o usuário.",
        variant: "destructive",
      });
    }
  };

  const handleUnblockUser = async (userId: string) => {
    try {
      const blocksRef = collection(db, "chat_user_blocks");
      const q = query(
        blocksRef,
        where("bloqueadorId", "==", userData?.uid),
        where("bloqueadoId", "==", userId),
        where("ativo", "==", true)
      );

      const snapshot = await getDocs(q);
      snapshot.forEach(async (docSnap) => {
        await updateDoc(doc(db, "chat_user_blocks", docSnap.id), {
          ativo: false,
        });
      });

      toast({
        title: "Usuário desbloqueado",
        description: "O usuário foi desbloqueado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao desbloquear usuário:", error);
      toast({
        title: "Erro",
        description: "Não foi possível desbloquear o usuário.",
        variant: "destructive",
      });
    }
  };

  const getDisplayName = (user: User) => {
    return user.tipo === "diretor" ? "Diretoria" : user.nome;
  };

  const getOtherParticipant = (conversation: ChatConversation) => {
    if (conversation.participante1Id === userData?.uid) {
      return {
        id: conversation.participante2Id,
        nome: conversation.participante2Nome === "Diretoria" ? "Diretoria" : conversation.participante2Nome,
        tipo: conversation.participante2Tipo,
      };
    }
    return {
      id: conversation.participante1Id,
      nome: conversation.participante1Nome === "Diretoria" ? "Diretoria" : conversation.participante1Nome,
      tipo: conversation.participante1Tipo,
    };
  };

  const getUnreadCount = (conversation: ChatConversation) => {
    if (conversation.participante1Id === userData?.uid) {
      return conversation.mensagensNaoLidas1 || 0;
    }
    return conversation.mensagensNaoLidas2 || 0;
  };

  const getInitials = (nome: string) => {
    if (nome === "Diretoria") return "DIR";
    const names = nome.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    } catch {
      return "";
    }
  };

  const getUserFromId = (userId: string): User | undefined => {
    return allUsers.find(u => u.uid === userId);
  };

  const handleAcceptTerms = async () => {
    if (!userData?.uid) return;

    try {
      const userRef = doc(db, "usuarios", userData.uid);
      await updateDoc(userRef, {
        chatTermsAccepted: true,
        chatTermsAcceptedDate: getNowBrasiliaISO(),
      });

      setHasAcceptedTerms(true);
      setTermsModalOpen(false);

      toast({
        title: "Termos aceitos",
        description: "Você aceitou os termos de uso do chat.",
      });
    } catch (error) {
      console.error("Erro ao aceitar termos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível registrar a aceitação dos termos.",
        variant: "destructive",
      });
    }
  };

  const handleOpenTerms = () => {
    setTermsModalOpen(true);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      <div className="relative bg-card border rounded-lg shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b gap-4">
          <h2 className="text-lg font-semibold" data-testid="text-chat-title">
            Mensagens
          </h2>
          
          <div className="flex items-center gap-2">
            <UserAccountMenu />
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              data-testid="button-close-chat"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-80 border-r flex flex-col">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar pessoas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-users"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              {searchQuery.trim() && filteredUsers.length > 0 ? (
                <div className="p-2">
                  <p className="text-xs font-medium text-muted-foreground px-3 py-2">
                    RESULTADOS DA BUSCA
                  </p>
                  <div className="space-y-1">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.uid}
                        onClick={() => handleSelectUser(user)}
                        className="p-3 rounded-md hover-elevate active-elevate-2 cursor-pointer"
                        data-testid={`user-search-${user.uid}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            {user.fotoBase64 && user.fotoPublica ? (
                              <AvatarImage src={user.fotoBase64} alt={getDisplayName(user)} />
                            ) : null}
                            <AvatarFallback>
                              {getInitials(getDisplayName(user))}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {getDisplayName(user)}
                            </p>
                            <PresenceIndicator
                              isOnline={user.isOnline}
                              lastSeen={user.lastSeen}
                              lastActivity={user.lastActivity}
                              showLabel={true}
                              variant="icon"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : searchQuery.trim() ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhum usuário encontrado
                </div>
              ) : loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Carregando conversas...
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <p className="mb-2">Nenhuma conversa ainda</p>
                  <p className="text-sm">Digite acima para buscar pessoas</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-muted-foreground px-5 py-3">
                    CONVERSAS
                  </p>
                  <div className="divide-y">
                    {conversations.map((conversation) => {
                      const other = getOtherParticipant(conversation);
                      const isSelected = selectedConversation?.id === conversation.id;
                      const otherUser = getUserFromId(other.id);

                      return (
                        <ConversationItem
                          key={conversation.id}
                          conversation={conversation}
                          currentUserId={userData?.uid || ""}
                          otherUser={otherUser}
                          isSelected={isSelected}
                          isBlocked={blockedUsers.has(other.id)}
                          onSelectConversation={handleSelectConversation}
                          onDeleteConversation={(conv) => {
                            setConversationToDelete(conv);
                            setDeleteDialogOpen(true);
                          }}
                          onBlockUser={(userId, userName) => {
                            setUserToBlock({ id: userId, nome: userName });
                            setBlockDialogOpen(true);
                          }}
                          onUnblockUser={handleUnblockUser}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex-1 flex flex-col bg-background">
            {selectedConversation ? (
              <ChatMessageArea
                conversation={selectedConversation}
                onBack={() => setSelectedConversation(null)}
                onOpenTerms={handleOpenTerms}
              />
            ) : selectedUser ? (
              <ChatMessageArea
                selectedUser={selectedUser}
                onBack={() => setSelectedUser(null)}
                onOpenTerms={handleOpenTerms}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <p>Selecione uma conversa</p>
                  <p className="text-sm mt-1">ou busque por uma pessoa</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ChatTermsModal
        open={termsModalOpen}
        onAccept={handleAcceptTerms}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as mensagens desta conversa serão removidas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Você não poderá enviar ou receber mensagens de {userToBlock?.nome}. Você pode desbloquear este usuário a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlockUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ChatWindow(props: ChatWindowProps) {
  return createPortal(<ChatWindowContent {...props} />, document.body);
}
