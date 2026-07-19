import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ChatConversation } from "@shared/schema";
import { doc, getDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ChatWindow from "@/components/ChatWindow";
import { Skeleton } from "@/components/ui/skeleton";
import type { ConversationWithBlockInfo } from "@/hooks/useChatConversations";

export default function ChatConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { userData } = useAuth();
  const [, navigate] = useLocation();
  const [conversation, setConversation] = useState<ConversationWithBlockInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId || !userData?.uid) {
      setError("Conversa não encontrada");
      setIsLoading(false);
      return;
    }

    let unsubscribeBlocks: (() => void) | null = null;

    const loadConversation = async () => {
      try {
        const conversationRef = doc(db, "chatConversations", conversationId);
        const conversationSnap = await getDoc(conversationRef);

        if (!conversationSnap.exists()) {
          setError("Conversa não encontrada");
          setIsLoading(false);
          return;
        }

        const conversationData = {
          id: conversationSnap.id,
          ...conversationSnap.data()
        } as ChatConversation;

        const isParticipant =
          conversationData.participante1Id === userData.uid ||
          conversationData.participante2Id === userData.uid;

        if (!isParticipant) {
          setError("Você não tem permissão para ver esta conversa");
          setIsLoading(false);
          return;
        }

        const otherParticipantId = 
          conversationData.participante1Id === userData.uid 
            ? conversationData.participante2Id 
            : conversationData.participante1Id;

        const blocksRef = collection(db, "userBlocks");
        const blockQuery = query(
          blocksRef,
          where("ativo", "==", true)
        );

        unsubscribeBlocks = onSnapshot(
          blockQuery,
          (snapshot) => {
            const blocks = snapshot.docs.map(d => ({
              bloqueadorId: d.data().bloqueadorId,
              bloqueadoId: d.data().bloqueadoId,
            }));

            const iBlockedOther = blocks.some(
              block => block.bloqueadorId === userData.uid && block.bloqueadoId === otherParticipantId
            );
            
            const otherBlockedMe = blocks.some(
              block => block.bloqueadorId === otherParticipantId && block.bloqueadoId === userData.uid
            );

            setConversation({
              ...conversationData,
              isBlocked: iBlockedOther || otherBlockedMe,
              iBlockedOther,
              otherBlockedMe,
            });
            setIsLoading(false);
          },
          (err) => {
            console.error("Error loading blocks:", err);
            setConversation({
              ...conversationData,
              isBlocked: false,
              iBlockedOther: false,
              otherBlockedMe: false,
            });
            setIsLoading(false);
          }
        );
      } catch (err) {
        console.error("Error loading conversation:", err);
        setError("Erro ao carregar conversa");
        setIsLoading(false);
      }
    };

    loadConversation();

    return () => {
      if (unsubscribeBlocks) {
        unsubscribeBlocks();
      }
    };
  }, [conversationId, userData?.uid]);

  const handleBack = () => {
    navigate("/chat");
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-2xl p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">{error || "Conversa não encontrada"}</p>
          <button
            onClick={handleBack}
            className="text-primary hover:underline"
            data-testid="button-back-to-chat"
          >
            Voltar para o chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full overflow-hidden bg-background md:relative md:h-screen">
      <ChatWindow conversation={conversation} onBack={handleBack} />
    </div>
  );
}
