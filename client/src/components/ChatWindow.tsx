import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, onSnapshot, addDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ChatConversation, User } from "@shared/schema";
import ChatConversationList from "./ChatConversationList";
import ChatMessageArea from "./ChatMessageArea";
import UserSearchDialog from "./UserSearchDialog";

interface ChatWindowProps {
  onClose: () => void;
}

function ChatWindowContent({ onClose }: ChatWindowProps) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const { userData } = useAuth();

  const createOrSelectConversation = async (otherUser: User) => {
    if (!userData?.uid) return;

    const conversationsRef = collection(db, "chatConversations");
    
    const q1 = query(
      conversationsRef,
      where("participante1Id", "==", userData.uid),
      where("participante2Id", "==", otherUser.uid)
    );
    
    const q2 = query(
      conversationsRef,
      where("participante1Id", "==", otherUser.uid),
      where("participante2Id", "==", userData.uid)
    );

    const [snapshot1, snapshot2] = await Promise.all([
      getDocs(q1),
      getDocs(q2)
    ]);

    if (!snapshot1.empty) {
      const conv = { id: snapshot1.docs[0].id, ...snapshot1.docs[0].data() } as ChatConversation;
      setSelectedConversation(conv);
      return;
    }

    if (!snapshot2.empty) {
      const conv = { id: snapshot2.docs[0].id, ...snapshot2.docs[0].data() } as ChatConversation;
      setSelectedConversation(conv);
      return;
    }

    const newConversation = {
      participante1Id: userData.uid,
      participante1Nome: userData.nome,
      participante1Tipo: userData.tipo,
      participante2Id: otherUser.uid,
      participante2Nome: otherUser.nome,
      participante2Tipo: otherUser.tipo,
      mensagensNaoLidas1: 0,
      mensagensNaoLidas2: 0,
      dataCriacao: new Date().toISOString(),
      dataUltimaAtualizacao: new Date().toISOString(),
    };

    const docRef = await addDoc(conversationsRef, newConversation);
    setSelectedConversation({
      id: docRef.id,
      ...newConversation,
    } as ChatConversation);
  };

  useEffect(() => {
    if (!userData?.uid) return;

    const conversationsRef = collection(db, "chatConversations");
    
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
        if (!conversationMap.has(conv.id)) {
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
      />
      
      <div 
        className="relative bg-card border rounded-lg shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col"
        style={{
          position: 'relative',
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '8px',
          width: '90%',
          maxWidth: '900px',
          height: '80vh',
          maxHeight: '700px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div 
          className="flex items-center justify-between p-4 border-b"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            borderBottom: '1px solid hsl(var(--border))',
            backgroundColor: 'hsl(var(--card))',
          }}
        >
          <h2 
            className="text-lg font-semibold"
            style={{ fontSize: '18px', fontWeight: 600 }}
            data-testid="text-chat-title"
          >
            Mensagens
          </h2>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            data-testid="button-close-chat"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div
            className="w-80 border-r flex flex-col"
            style={{
              width: '320px',
              borderRight: '1px solid hsl(var(--border))',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'hsl(var(--card))',
            }}
          >
            <div className="p-3 border-b" style={{ padding: '12px', borderBottom: '1px solid hsl(var(--border))' }}>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowSearchDialog(true)}
                data-testid="button-search-users"
              >
                <Search className="h-4 w-4 mr-2" />
                Buscar contato
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto" style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Carregando conversas...
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <p className="mb-2">Nenhuma conversa ainda</p>
                  <p className="text-sm">Use a busca para iniciar uma conversa</p>
                </div>
              ) : (
                <ChatConversationList
                  conversations={conversations}
                  selectedConversation={selectedConversation}
                  onSelectConversation={setSelectedConversation}
                />
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-background" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'hsl(var(--background))' }}>
            {selectedConversation ? (
              <ChatMessageArea
                conversation={selectedConversation}
                onBack={() => setSelectedConversation(null)}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <p>Selecione uma conversa</p>
                  <p className="text-sm mt-1">ou inicie uma nova</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSearchDialog && (
        <UserSearchDialog
          onClose={() => setShowSearchDialog(false)}
          onSelectUser={async (user: User) => {
            setShowSearchDialog(false);
            await createOrSelectConversation(user);
          }}
        />
      )}
    </div>
  );
}

export default function ChatWindow(props: ChatWindowProps) {
  return createPortal(<ChatWindowContent {...props} />, document.body);
}
