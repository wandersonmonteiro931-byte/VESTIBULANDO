import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Search, ArrowLeft, MoreVertical, User as UserIcon } from "lucide-react";
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
import ChatMessageArea from "./ChatMessageArea";
import { ConversationItem } from "./ConversationItem";
import { ChatTermsModal } from "./ChatTermsModal";
import { VideoCallDialog } from "./VideoCallDialog";
import { IncomingCallDialog } from "./IncomingCallDialog";
import EditProfileDialog from "./EditProfileDialog";
import { useIncomingCalls } from "@/hooks/useIncomingCalls";
import { useToast } from "@/hooks/use-toast";
import { useDeliveryOnPresence } from "@/hooks/useDeliveryOnPresence";
import { useConversationStatusSync } from "@/hooks/useConversationStatusSync";
import { useViewportHeight } from "@/hooks/useViewportHeight";

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
  const [termsViewOnly, setTermsViewOnly] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(true);
  const [callRecipient, setCallRecipient] = useState<{ id: string; nome: string } | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const { userData, refreshUserData } = useAuth();
  const { toast } = useToast();

  useViewportHeight();
  useDeliveryOnPresence(userData?.uid);
  useConversationStatusSync(userData?.uid);

  const { incomingCall } = useIncomingCalls(userData?.uid || "");

  const showChatView = selectedConversation || selectedUser;

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
        
        if (!conversationMap.has(conv.id) && conv.ultimaMensagem && !isDeletedByUser) {
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
    if (!hasAcceptedTerms) {
      toast({
        title: "Aceite os termos",
        description: "Você precisa aceitar os termos de uso do chat antes de conversar.",
        variant: "destructive",
      });
      setTermsModalOpen(true);
      return;
    }

    setSelectedUser(user);
    setSelectedConversation(null);
    setSearchQuery("");
  };

  const handleSelectConversation = async (conversation: ChatConversation) => {
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
        nome: conversation.participante2Tipo === "diretor" ? "Diretoria" : conversation.participante2Nome,
        tipo: conversation.participante2Tipo,
      };
    }
    return {
      id: conversation.participante1Id,
      nome: conversation.participante1Tipo === "diretor" ? "Diretoria" : conversation.participante1Nome,
      tipo: conversation.participante1Tipo,
    };
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
    setTermsViewOnly(true);
    setTermsModalOpen(true);
  };

  const handleCloseTerms = () => {
    setTermsModalOpen(false);
    setTermsViewOnly(false);
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
    setSelectedUser(null);
  };

  const handleStartVideoCall = () => {
    const otherParticipantId = selectedConversation 
      ? (selectedConversation.participante1Id === userData?.uid 
          ? selectedConversation.participante2Id 
          : selectedConversation.participante1Id)
      : selectedUser?.uid;

    const otherParticipantNome = selectedConversation
      ? (selectedConversation.participante1Id === userData?.uid
          ? (selectedConversation.participante2Tipo === "diretor" ? "Diretoria" : selectedConversation.participante2Nome)
          : (selectedConversation.participante1Tipo === "diretor" ? "Diretoria" : selectedConversation.participante1Nome))
      : selectedUser?.tipo === "diretor" ? "Diretoria" : selectedUser?.nome;

    if (otherParticipantId && otherParticipantNome) {
      setCallRecipient({ id: otherParticipantId, nome: otherParticipantNome });
      setIsVideoCall(true);
      setCallDialogOpen(true);
    }
  };

  const handleStartAudioCall = () => {
    const otherParticipantId = selectedConversation 
      ? (selectedConversation.participante1Id === userData?.uid 
          ? selectedConversation.participante2Id 
          : selectedConversation.participante1Id)
      : selectedUser?.uid;

    const otherParticipantNome = selectedConversation
      ? (selectedConversation.participante1Id === userData?.uid
          ? (selectedConversation.participante2Tipo === "diretor" ? "Diretoria" : selectedConversation.participante2Nome)
          : (selectedConversation.participante1Tipo === "diretor" ? "Diretoria" : selectedConversation.participante1Nome))
      : selectedUser?.tipo === "diretor" ? "Diretoria" : selectedUser?.nome;

    if (otherParticipantId && otherParticipantNome) {
      setCallRecipient({ id: otherParticipantId, nome: otherParticipantNome });
      setIsVideoCall(false);
      setCallDialogOpen(true);
    }
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
    <div className="fixed inset-0 z-[9998] flex md:items-center md:justify-center bg-black/50 p-0 md:p-4 overflow-hidden chat-modal-wrapper">
      <div className="relative bg-card w-full h-full md:h-[95vh] md:max-w-md md:rounded-lg shadow-2xl flex flex-col overflow-hidden min-h-0 chat-outer-container">
        {/* Lista de conversas */}
        <div className={`${showChatView ? 'hidden' : 'flex'} flex-col w-full h-full whatsapp-conversation-list`}>
          {/* Header da lista */}
          <div className="whatsapp-header p-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white dark:text-foreground" data-testid="text-chat-title">
              WhatsApp
            </h2>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setEditProfileOpen(true)}
                className="text-white dark:text-foreground hover:bg-white/10"
                data-testid="button-edit-profile"
              >
                <UserIcon className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={onClose}
                className="text-white dark:text-foreground hover:bg-white/10"
                data-testid="button-close-chat"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Barra de busca */}
          <div className="p-2 whatsapp-search">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar ou começar uma conversa"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white dark:bg-[#2a3942] border-0"
                data-testid="input-search-users"
              />
            </div>
          </div>

          {/* Lista */}
          <ScrollArea className="flex-1">
            {searchQuery.trim() && filteredUsers.length > 0 ? (
              <div>
                {filteredUsers.map((user) => (
                  <div
                    key={user.uid}
                    onClick={() => handleSelectUser(user)}
                    className="p-3 whatsapp-conversation-item cursor-pointer border-b whatsapp-divider"
                    data-testid={`user-search-${user.uid}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        {user.fotoBase64 && user.fotoPublica ? (
                          <AvatarImage src={user.fotoBase64} alt={getDisplayName(user)} />
                        ) : null}
                        <AvatarFallback className="bg-[#6b7c85] text-white">
                          {getInitials(getDisplayName(user))}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate text-foreground">
                          {getDisplayName(user)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
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
              <div className="p-8 text-center text-muted-foreground">
                <p className="mb-2">Nenhuma conversa ainda</p>
                <p className="text-sm">Use a busca acima para encontrar pessoas</p>
              </div>
            ) : (
              <div>
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
            )}
          </ScrollArea>
        </div>

        {/* Área de chat */}
        <div className={`${showChatView ? 'flex' : 'hidden'} flex-1 min-h-0 flex-col bg-background overflow-hidden chat-window-mobile`}>
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

export default function ChatWindow(props: ChatWindowProps) {
  return createPortal(<ChatWindowContent {...props} />, document.body);
}
