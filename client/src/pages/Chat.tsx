import { useState, useEffect } from "react";
import { ArrowLeft, Search, MoreVertical, User as UserIcon } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import type { ChatConversation, User, UserBlock, CallSignal } from "@shared/schema";
import ChatMessageArea from "@/components/ChatMessageArea";
import { ConversationItem } from "@/components/ConversationItem";
import { ChatTermsModal } from "@/components/ChatTermsModal";
import { VideoCallDialog } from "@/components/VideoCallDialog";
import { IncomingCallDialog } from "@/components/IncomingCallDialog";
import EditProfileDialog from "@/components/EditProfileDialog";
import { useIncomingCalls } from "@/hooks/useIncomingCalls";
import { useToast } from "@/hooks/use-toast";
import { useDeliveryOnPresence } from "@/hooks/useDeliveryOnPresence";
import { useConversationStatusSync } from "@/hooks/useConversationStatusSync";

export default function Chat() {
  const [, setLocation] = useLocation();
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
  const [termsViewOnly, setTermsViewOnly] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(true);
  const [callRecipient, setCallRecipient] = useState<{ id: string; nome: string } | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const { userData, refreshUserData } = useAuth();
  const { toast } = useToast();

  useDeliveryOnPresence(userData?.uid);
  useConversationStatusSync(userData?.uid);

  const { incomingCall } = useIncomingCalls(userData?.uid || "");

  const showChatView = selectedConversation || selectedUser;

  const handleBackToDashboard = () => {
    if (!userData) return;
    
    switch (userData.tipo) {
      case "aluno":
        setLocation("/aluno");
        break;
      case "professor":
        setLocation("/professor");
        break;
      case "diretor":
        setLocation("/diretor");
        break;
      default:
        setLocation("/");
    }
  };

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
            const isActive = user.ativo === true || (user.ativo as any) === "true";
            const isApproved = user.status === "aprovado" || (user.status as any) === true;
            
            if (isActive) {
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

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers([]);
      return;
    }

    const term = searchQuery.toLowerCase();
    const filtered = allUsers.filter((user) => {
      if (blockedUsers.has(user.uid)) return false;
      
      const displayName = user.tipo === "diretor" ? "Diretoria" : user.nome;
      
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
        const isParticipant1 = conv.participante1Id === userData.uid;
        const isDeletedByUser = isParticipant1 
          ? conv.deletadaPorParticipante1 === true
          : conv.deletadaPorParticipante2 === true;

        if (!isDeletedByUser && !conversationMap.has(conv.id)) {
          conversationMap.set(conv.id, conv);
        }
      });

      const filteredConversations = Array.from(conversationMap.values());
      
      filteredConversations.sort((a, b) => {
        const dateA = a.ultimaMensagemTimestamp ? new Date(a.ultimaMensagemTimestamp).getTime() : 0;
        const dateB = b.ultimaMensagemTimestamp ? new Date(b.ultimaMensagemTimestamp).getTime() : 0;
        return dateB - dateA;
      });

      setConversations(filteredConversations);
      setLoading(false);
    };

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [userData?.uid]);

  const handleSelectUser = async (user: User) => {
    if (!userData?.uid) return;

    const existingConversation = conversations.find((conv) => {
      const otherUserId = conv.participante1Id === userData.uid 
        ? conv.participante2Id 
        : conv.participante1Id;
      return otherUserId === user.uid;
    });

    if (existingConversation) {
      setSelectedConversation(existingConversation);
      setSelectedUser(null);
    } else {
      setSelectedUser(user);
      setSelectedConversation(null);
    }
    
    setSearchQuery("");
  };

  const handleSelectConversation = (conversation: ChatConversation) => {
    setSelectedConversation(conversation);
    setSelectedUser(null);
    setSearchQuery("");
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
    setSelectedUser(null);
  };

  const handleDeleteClick = (conversation: ChatConversation) => {
    setConversationToDelete(conversation);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConversation = async () => {
    if (!conversationToDelete || !userData?.uid) return;

    try {
      const isParticipant1 = conversationToDelete.participante1Id === userData.uid;
      const conversationRef = doc(db, "chat_conversations", conversationToDelete.id);
      
      await updateDoc(conversationRef, {
        [isParticipant1 ? "deletadaPorParticipante1" : "deletadaPorParticipante2"]: true,
        [isParticipant1 ? "dataDelecaoParticipante1" : "dataDelecaoParticipante2"]: getNowBrasiliaISO(),
      });

      if (selectedConversation?.id === conversationToDelete.id) {
        handleBackToList();
      }

      toast({
        title: "Conversa excluída",
        description: "A conversa foi removida com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao excluir conversa:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a conversa.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setConversationToDelete(null);
    }
  };

  const handleBlockClick = (userId: string, userName: string) => {
    setUserToBlock({ id: userId, nome: userName });
    setBlockDialogOpen(true);
  };

  const handleBlockUser = async () => {
    if (!userToBlock || !userData?.uid) return;

    try {
      const blocksRef = collection(db, "chat_user_blocks");
      await addDoc(blocksRef, {
        bloqueadorId: userData.uid,
        bloqueadoId: userToBlock.id,
        ativo: true,
        criadoEm: getNowBrasiliaISO(),
      });

      if (selectedConversation) {
        const otherUserId = selectedConversation.participante1Id === userData.uid
          ? selectedConversation.participante2Id
          : selectedConversation.participante1Id;
        
        if (otherUserId === userToBlock.id) {
          handleBackToList();
        }
      }

      toast({
        title: "Usuário bloqueado",
        description: `${userToBlock.nome} foi bloqueado com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao bloquear usuário:", error);
      toast({
        title: "Erro",
        description: "Não foi possível bloquear o usuário.",
        variant: "destructive",
      });
    } finally {
      setBlockDialogOpen(false);
      setUserToBlock(null);
    }
  };

  const handleUnblockUser = async (userId: string) => {
    if (!userData?.uid) return;

    try {
      const blocksRef = collection(db, "chat_user_blocks");
      const q = query(
        blocksRef,
        where("bloqueadorId", "==", userData.uid),
        where("bloqueadoId", "==", userId),
        where("ativo", "==", true)
      );

      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

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

  const handleAcceptTerms = async () => {
    if (!userData?.uid) return;

    try {
      const userRef = doc(db, "usuarios", userData.uid);
      await updateDoc(userRef, {
        chatTermsAccepted: true,
        chatTermsAcceptedAt: getNowBrasiliaISO(),
      });

      setHasAcceptedTerms(true);
      setTermsModalOpen(false);

      toast({
        title: "Termos aceitos",
        description: "Você pode usar o chat agora!",
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
    setTermsViewOnly(true);
    setTermsModalOpen(true);
  };

  const handleCloseTerms = () => {
    setTermsModalOpen(false);
    setTermsViewOnly(false);
  };

  const handleStartVideoCall = () => {
    if (!selectedConversation || !userData?.uid) return;

    const otherUserId = selectedConversation.participante1Id === userData.uid
      ? selectedConversation.participante2Id
      : selectedConversation.participante1Id;
    
    const otherUserName = selectedConversation.participante1Id === userData.uid
      ? selectedConversation.participante2Nome
      : selectedConversation.participante1Nome;

    setCallRecipient({ id: otherUserId, nome: otherUserName });
    setIsVideoCall(true);
    setCallDialogOpen(true);
  };

  const handleStartAudioCall = () => {
    if (!selectedConversation || !userData?.uid) return;

    const otherUserId = selectedConversation.participante1Id === userData.uid
      ? selectedConversation.participante2Id
      : selectedConversation.participante1Id;
    
    const otherUserName = selectedConversation.participante1Id === userData.uid
      ? selectedConversation.participante2Nome
      : selectedConversation.participante1Nome;

    setCallRecipient({ id: otherUserId, nome: otherUserName });
    setIsVideoCall(false);
    setCallDialogOpen(true);
  };

  const getInitials = (nome: string) => {
    if (nome === "Diretoria") return "DIR";
    const names = nome.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="flex items-center gap-4 border-b px-4 py-3 bg-card">
        <Button
          size="icon"
          variant="ghost"
          onClick={handleBackToDashboard}
          data-testid="button-back-to-dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Voltar para Sala de Aula</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className={`${showChatView ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96 border-r bg-card`}>
          <div className="p-4 border-b bg-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" data-testid="text-chat-title">Chat Vestibulando</h2>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditProfileOpen(true)}
                  data-testid="button-edit-profile"
                >
                  <Avatar className="h-8 w-8">
                    {userData?.fotoPublica && userData?.fotoBase64 ? (
                      <AvatarImage src={userData.fotoBase64} alt={userData.nome} />
                    ) : null}
                    <AvatarFallback>
                      {userData?.nome ? getInitials(userData.nome) : <UserIcon className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setTermsViewOnly(true);
                    setTermsModalOpen(true);
                  }}
                  data-testid="button-view-terms"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar usuário..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-users"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {searchQuery.trim() && (
              <div className="p-2">
                <div className="text-sm text-muted-foreground mb-2 px-2">Resultados da busca</div>
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <button
                      key={user.uid}
                      onClick={() => handleSelectUser(user)}
                      className="w-full flex items-center gap-3 p-3 hover-elevate active-elevate-2 rounded-lg"
                      data-testid={`button-select-user-${user.uid}`}
                    >
                      <Avatar>
                        {user.fotoPublica && user.fotoBase64 ? (
                          <AvatarImage src={user.fotoBase64} alt={user.nome} />
                        ) : null}
                        <AvatarFallback>
                          {getInitials(user.tipo === "diretor" ? "Diretoria" : user.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left">
                        <div className="font-medium">
                          {user.tipo === "diretor" ? "Diretoria" : user.nome}
                        </div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {!searchQuery.trim() && (
              <div className="p-2">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma conversa ainda. Use a busca para iniciar uma conversa.
                  </div>
                ) : (
                  conversations.map((conversation) => {
                    const otherUser = allUsers.find((u) => {
                      const otherUserId = conversation.participante1Id === userData?.uid
                        ? conversation.participante2Id
                        : conversation.participante1Id;
                      return u.uid === otherUserId;
                    });

                    return (
                      <ConversationItem
                        key={conversation.id}
                        conversation={conversation}
                        currentUserId={userData?.uid || ""}
                        otherUser={otherUser}
                        isSelected={selectedConversation?.id === conversation.id}
                        isBlocked={blockedUsers.has(
                          conversation.participante1Id === userData?.uid
                            ? conversation.participante2Id
                            : conversation.participante1Id
                        )}
                        onSelectConversation={handleSelectConversation}
                        onDeleteConversation={handleDeleteClick}
                        onBlockUser={handleBlockClick}
                        onUnblockUser={handleUnblockUser}
                      />
                    );
                  })
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className={`${showChatView ? 'flex' : 'hidden md:flex'} flex-col flex-1`}>
          {selectedConversation ? (
            <ChatMessageArea
              conversation={selectedConversation}
              onBack={handleBackToList}
              onOpenTerms={handleOpenTerms}
              onStartVideoCall={handleStartVideoCall}
              onStartAudioCall={handleStartAudioCall}
            />
          ) : selectedUser ? (
            <ChatMessageArea
              selectedUser={selectedUser}
              onBack={handleBackToList}
              onOpenTerms={handleOpenTerms}
              onStartVideoCall={handleStartVideoCall}
              onStartAudioCall={handleStartAudioCall}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground whatsapp-bg">
              <div className="text-center p-8">
                <div className="mb-4 text-6xl">💬</div>
                <h3 className="text-xl font-semibold mb-2">WhatsApp Web</h3>
                <p className="text-sm">Selecione uma conversa para começar</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <ChatTermsModal
        open={termsModalOpen}
        onAccept={handleAcceptTerms}
        viewOnly={termsViewOnly}
        onClose={handleCloseTerms}
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

      {callRecipient && (
        <VideoCallDialog
          open={callDialogOpen}
          onOpenChange={setCallDialogOpen}
          recipientName={callRecipient.nome}
          recipientId={callRecipient.id}
          isVideoCall={isVideoCall}
        />
      )}

      {incomingCall && (
        <IncomingCallDialog
          open={!!incomingCall}
          callSignal={incomingCall.signal}
          onAccept={incomingCall.onAccept}
          onReject={incomingCall.onReject}
        />
      )}

      {editProfileOpen && userData && (
        <EditProfileDialog
          user={userData}
          onClose={() => setEditProfileOpen(false)}
          onUpdate={() => refreshUserData()}
        />
      )}
    </div>
  );
}
