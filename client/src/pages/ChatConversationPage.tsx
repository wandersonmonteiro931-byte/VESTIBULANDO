import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ChatConversation } from "@shared/schema";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ChatWindow from "@/components/ChatWindow";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChatConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { userData } = useAuth();
  const [, navigate] = useLocation();
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadConversation = async () => {
      if (!conversationId || !userData?.uid) {
        setError("Conversa não encontrada");
        setIsLoading(false);
        return;
      }

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

        setConversation(conversationData);
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading conversation:", err);
        setError("Erro ao carregar conversa");
        setIsLoading(false);
      }
    };

    loadConversation();
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
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="flex-1 flex flex-col">
        <ChatWindow conversation={conversation} onBack={handleBack} />
      </div>
    </div>
  );
}
