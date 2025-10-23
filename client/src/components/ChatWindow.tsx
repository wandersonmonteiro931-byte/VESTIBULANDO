import { useState, useEffect } from "react";
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

export default function ChatWindow({ onClose }: ChatWindowProps) {
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
    <>
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
        }}
        onClick={onClose}
      />
      
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: '900px',
          height: '80vh',
          maxHeight: '700px',
          backgroundColor: 'var(--card)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--card)',
          }}
        >
          <h2 
            style={{ 
              fontSize: '18px', 
              fontWeight: 600,
              color: 'var(--foreground)',
            }}
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

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              width: '300px',
              borderRight: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--card)',
            }}
          >
            <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
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

            <div style={{ flex: 1, overflow: 'auto' }}>
              {loading ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                  Carregando conversas...
                </div>
              ) : conversations.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                  <p style={{ marginBottom: '8px' }}>Nenhuma conversa ainda</p>
                  <p style={{ fontSize: '14px' }}>Use a busca para iniciar uma conversa</p>
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

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--background)' }}>
            {selectedConversation ? (
              <ChatMessageArea
                conversation={selectedConversation}
                onBack={() => setSelectedConversation(null)}
              />
            ) : (
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--muted-foreground)',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <p>Selecione uma conversa</p>
                  <p style={{ fontSize: '14px', marginTop: '4px' }}>ou inicie uma nova</p>
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
    </>
  );
}
