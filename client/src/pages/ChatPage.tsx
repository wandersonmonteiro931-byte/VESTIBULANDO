import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Link } from "wouter";
import { MessageSquare, Settings, Users, Search, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatConversation, User } from "@shared/schema";
import NewChatDialog from "../components/NewChatDialog";
import { PresenceIndicator } from "../components/PresenceIndicator";
import { cn } from "@/lib/utils";
import { useChatConversations } from "@/hooks/useChatConversations";
import { collection, getDocs, addDoc, query as firestoreQuery, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatBrasiliaTime, getNowBrasiliaISO } from "@/lib/brasiliaTime";

export default function ChatPage() {
  const { userData } = useAuth();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"chats" | "groups" | "settings">("chats");
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const { conversations, isLoading } = useChatConversations();

  useEffect(() => {
    const fetchAllUsers = async () => {
      if (!userData?.uid) return;

      setIsLoadingUsers(true);
      try {
        const usersRef = collection(db, "usuarios");
        const snapshot = await getDocs(usersRef);
        const results: User[] = [];
        
        snapshot.forEach((doc) => {
          const user = { uid: doc.id, ...doc.data() } as User;
          const isActive = user.ativo === true || (user.ativo as any) === "true";
          const isApproved = user.status === "aprovado" || (user.status as any) === true;
          
          if (user.uid !== userData?.uid && isActive) {
            if (user.tipo === "diretor" || isApproved) {
              results.push(user);
            }
          }
        });
        
        results.sort((a, b) => a.nome.localeCompare(b.nome));
        setAllUsers(results);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchAllUsers();
  }, [userData?.uid]);

  const handleConversationCreated = (conversationId: string) => {
    navigate(`/chat/${conversationId}`);
  };

  const filteredUsers = searchTerm.trim()
    ? allUsers.filter((user) => {
        const term = searchTerm.toLowerCase();
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
          (user.matricula && user.matricula.includes(term))
        );
      })
    : [];

  const filteredConversations = !searchTerm.trim()
    ? conversations
    : conversations?.filter((conv) => {
        const otherParticipantName =
          conv.participante1Id === userData?.uid
            ? conv.participante2Nome
            : conv.participante1Nome;
        const otherParticipantTipo =
          conv.participante1Id === userData?.uid
            ? conv.participante2Tipo
            : conv.participante1Tipo;
        const displayName = otherParticipantTipo === "diretor" ? "Diretoria" : otherParticipantName;
        const term = searchTerm.toLowerCase();
        
        // Se for diretor, verificar se o termo busca por "dir", "diretor" ou "diretoria"
        if (otherParticipantTipo === "diretor") {
          return (
            "diretoria".includes(term) ||
            "diretor".includes(term) ||
            "dir".includes(term) ||
            displayName.toLowerCase().includes(term)
          );
        }
        
        return displayName.toLowerCase().includes(term);
      });

  const getOtherParticipant = (conversation: ChatConversation) => {
    if (conversation.participante1Id === userData?.uid) {
      return {
        id: conversation.participante2Id,
        nome: conversation.participante2Nome,
        tipo: conversation.participante2Tipo,
      };
    }
    return {
      id: conversation.participante1Id,
      nome: conversation.participante1Nome,
      tipo: conversation.participante1Tipo,
    };
  };

  const getUnreadCount = (conversation: ChatConversation) => {
    if (conversation.participante1Id === userData?.uid) {
      return conversation.mensagensNaoLidas1;
    }
    return conversation.mensagensNaoLidas2;
  };

  const formatTimestamp = (timestamp: string) => {
    return formatBrasiliaTime(timestamp);
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

  const handleUserClick = async (user: User) => {
    if (!userData) return;

    const existingConversation = conversations.find(
      (conv) =>
        (conv.participante1Id === userData.uid && conv.participante2Id === user.uid) ||
        (conv.participante1Id === user.uid && conv.participante2Id === userData.uid)
    );

    if (existingConversation) {
      navigate(`/chat/${existingConversation.id}`);
      return;
    }

    try {
      const conversationsRef = collection(db, "chatConversations");
      
      const q1 = firestoreQuery(
        conversationsRef,
        where("participante1Id", "==", userData.uid),
        where("participante2Id", "==", user.uid)
      );
      const q2 = firestoreQuery(
        conversationsRef,
        where("participante1Id", "==", user.uid),
        where("participante2Id", "==", userData.uid)
      );

      const [snapshot1, snapshot2] = await Promise.all([
        getDocs(q1),
        getDocs(q2)
      ]);

      if (!snapshot1.empty) {
        navigate(`/chat/${snapshot1.docs[0].id}`);
        return;
      }

      if (!snapshot2.empty) {
        navigate(`/chat/${snapshot2.docs[0].id}`);
        return;
      }

      const now = getNowBrasiliaISO();
      const conversationData = {
        participante1Id: userData.uid,
        participante1Nome: userData.nome,
        participante1Tipo: userData.tipo,
        participante2Id: user.uid,
        participante2Nome: user.nome,
        participante2Tipo: user.tipo,
        mensagensNaoLidas1: 0,
        mensagensNaoLidas2: 0,
        participante1Digitando: false,
        participante2Digitando: false,
        deletadaPorParticipante1: false,
        deletadaPorParticipante2: false,
        dataCriacao: now,
        dataUltimaAtualizacao: now,
      };

      const newConversation = await addDoc(conversationsRef, conversationData);
      navigate(`/chat/${newConversation.id}`);
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  if (!userData) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar - Lista de Conversas */}
      <div className="flex flex-col w-full max-w-[500px] mx-auto border-x border-border bg-background">
        {/* Header */}
        <div className="whatsapp-header flex items-center justify-between p-4">
          <h1 className="text-xl font-semibold text-white" data-testid="text-chat-title">
            EduChat
          </h1>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={() => navigate("/")}
              data-testid="button-back-home"
              title="Voltar para Sala de Aula"
            >
              <Home className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={() => setShowNewChatDialog(true)}
              data-testid="button-new-chat"
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={() => setActiveTab("settings")}
              data-testid="button-settings"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="whatsapp-search p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar pessoas..."
              className="pl-9 bg-white dark:bg-[#2a3942] border-none focus-visible:ring-1"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-conversation"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-background">
          <button
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors",
              activeTab === "chats"
                ? "border-b-2 border-[#00a884] text-[#00a884]"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("chats")}
            data-testid="button-tab-chats"
          >
            Conversas
          </button>
          <button
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors",
              activeTab === "groups"
                ? "border-b-2 border-[#00a884] text-[#00a884]"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("groups")}
            data-testid="button-tab-groups"
          >
            Grupos
          </button>
        </div>

        {/* Conversation List */}
        <ScrollArea className="flex-1 whatsapp-conversation-list">
          {isLoading || isLoadingUsers ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-muted-foreground">Carregando...</div>
            </div>
          ) : searchTerm.trim() && filteredUsers.length > 0 ? (
            <div>
              {filteredUsers.map((user) => (
                <div
                  key={user.uid}
                  className="whatsapp-conversation-item flex items-center gap-3 p-3 cursor-pointer border-b border-border hover-elevate"
                  onClick={() => handleUserClick(user)}
                  data-testid={`user-item-${user.uid}`}
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={user.fotoBase64 || ""} />
                    <AvatarFallback className="bg-[#00a884] text-white">
                      {user.tipo === "diretor" ? "DIR" : user.nome.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate" data-testid={`text-user-name-${user.uid}`}>
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
                    <p className="text-sm text-muted-foreground truncate">
                      {user.email}
                    </p>
                    {user.turma && (
                      <p className="text-xs text-muted-foreground">
                        Turma: {user.turma}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : searchTerm.trim() && filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma pessoa encontrada</p>
              <p className="text-sm text-muted-foreground mt-2">
                Tente buscar por outro nome, email ou matrícula
              </p>
            </div>
          ) : filteredConversations && filteredConversations.length > 0 ? (
            <div>
              {filteredConversations.map((conversation) => {
                const otherParticipant = getOtherParticipant(conversation);
                const unreadCount = getUnreadCount(conversation);

                return (
                  <Link
                    key={conversation.id}
                    href={`/chat/${conversation.id}`}
                    className="whatsapp-conversation-item flex items-center gap-3 p-3 cursor-pointer border-b border-border hover-elevate"
                    data-testid={`conversation-item-${conversation.id}`}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-[#00a884] text-white">
                          {otherParticipant.tipo === "diretor" ? "DIR" : otherParticipant.nome.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute bottom-0 right-0">
                        <PresenceIndicator userId={otherParticipant.id} />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3
                          className="font-semibold text-foreground truncate"
                          data-testid={`text-participant-name-${conversation.id}`}
                        >
                          {otherParticipant.tipo === "diretor" ? "Diretoria" : otherParticipant.nome}
                        </h3>
                        {conversation.ultimaMensagemTimestamp && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTimestamp(conversation.ultimaMensagemTimestamp)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className="text-sm text-muted-foreground truncate">
                          {conversation.ultimaMensagem || "Sem mensagens"}
                        </p>
                        {unreadCount > 0 && (
                          <Badge
                            className="bg-[#25d366] text-white hover:bg-[#25d366] min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5"
                            data-testid={`badge-unread-${conversation.id}`}
                          >
                            {unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma conversa encontrada</p>
              <p className="text-sm text-muted-foreground mt-2">
                Inicie uma nova conversa para começar
              </p>
            </div>
          )}
        </ScrollArea>
      </div>

      <NewChatDialog
        open={showNewChatDialog}
        onOpenChange={setShowNewChatDialog}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
}
