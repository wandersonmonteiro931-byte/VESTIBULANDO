import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  collection,
  onSnapshot,
  query as firestoreQuery,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ChatConversation } from "@shared/schema";

export interface ConversationWithBlockInfo extends ChatConversation {
  isBlocked?: boolean;
  iBlockedOther?: boolean;
  otherBlockedMe?: boolean;
}

function conversationSignature(conversations: ConversationWithBlockInfo[]): string {
  return conversations
    .map((conversation) =>
      [
        conversation.id,
        conversation.ultimaMensagemTimestamp || conversation.dataUltimaAtualizacao || "",
        conversation.ultimaMensagem || "",
        conversation.mensagensNaoLidas1 || 0,
        conversation.mensagensNaoLidas2 || 0,
        conversation.participante1Digitando ? 1 : 0,
        conversation.participante2Digitando ? 1 : 0,
        conversation.isBlocked ? 1 : 0,
        conversation.iBlockedOther ? 1 : 0,
        conversation.otherBlockedMe ? 1 : 0,
      ].join(":"),
    )
    .join("|");
}

export function useChatConversations() {
  const { userData } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithBlockInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const userId = userData?.uid;

    if (!userId) {
      setConversations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const conversationsRef = collection(db, "chatConversations");
    const q1 = firestoreQuery(
      conversationsRef,
      where("participante1Id", "==", userId),
      where("deletadaPorParticipante1", "==", false),
    );
    const q2 = firestoreQuery(
      conversationsRef,
      where("participante2Id", "==", userId),
      where("deletadaPorParticipante2", "==", false),
    );

    let conversationsAsParticipant1: ChatConversation[] = [];
    let conversationsAsParticipant2: ChatConversation[] = [];
    let currentBlocks: { bloqueadorId: string; bloqueadoId: string }[] = [];
    let q1Loaded = false;
    let q2Loaded = false;
    let blocksLoaded = false;
    let lastSignature = "";

    const updateConversations = () => {
      if (!q1Loaded || !q2Loaded || !blocksLoaded) return;

      // Cada consulta possui sua própria lista. A combinação por ID impede
      // duplicações e também remove conversas que deixaram de pertencer à consulta.
      const byId = new Map<string, ChatConversation>();
      [...conversationsAsParticipant1, ...conversationsAsParticipant2].forEach(
        (conversation) => byId.set(conversation.id, conversation),
      );

      const nextConversations: ConversationWithBlockInfo[] = Array.from(byId.values())
        .filter(
          (conversation) =>
            conversation.ultimaMensagem && conversation.ultimaMensagem.trim() !== "",
        )
        .map((conversation) => {
          const otherParticipantId =
            conversation.participante1Id === userId
              ? conversation.participante2Id
              : conversation.participante1Id;

          const iBlockedOther = currentBlocks.some(
            (block) =>
              block.bloqueadorId === userId && block.bloqueadoId === otherParticipantId,
          );
          const otherBlockedMe = currentBlocks.some(
            (block) =>
              block.bloqueadorId === otherParticipantId && block.bloqueadoId === userId,
          );

          return {
            ...conversation,
            isBlocked: iBlockedOther || otherBlockedMe,
            iBlockedOther,
            otherBlockedMe,
          };
        })
        .sort((a, b) => {
          const aTime = a.ultimaMensagemTimestamp || a.dataUltimaAtualizacao || "";
          const bTime = b.ultimaMensagemTimestamp || b.dataUltimaAtualizacao || "";
          return bTime.localeCompare(aTime);
        });

      const nextSignature = conversationSignature(nextConversations);
      if (nextSignature !== lastSignature) {
        lastSignature = nextSignature;
        setConversations(nextConversations);
      }

      setIsLoading(false);
    };

    const blocksRef = collection(db, "userBlocks");
    const blockQuery = firestoreQuery(blocksRef, where("ativo", "==", true));

    const unsubscribeBlocks = onSnapshot(
      blockQuery,
      (snapshot) => {
        currentBlocks = snapshot.docs.map((blockDoc) => ({
          bloqueadorId: blockDoc.data().bloqueadorId,
          bloqueadoId: blockDoc.data().bloqueadoId,
        }));
        blocksLoaded = true;
        updateConversations();
      },
      (snapshotError) => {
        console.error("Erro ao carregar bloqueios do chat:", snapshotError);
        currentBlocks = [];
        blocksLoaded = true;
        updateConversations();
      },
    );

    const unsubscribe1 = onSnapshot(
      q1,
      (snapshot) => {
        conversationsAsParticipant1 = snapshot.docs.map(
          (conversationDoc) =>
            ({ id: conversationDoc.id, ...conversationDoc.data() }) as ChatConversation,
        );
        q1Loaded = true;
        updateConversations();
      },
      (snapshotError) => {
        console.error("Erro ao carregar conversas como participante 1:", snapshotError);
        setError(snapshotError as Error);
        conversationsAsParticipant1 = [];
        q1Loaded = true;
        updateConversations();
      },
    );

    const unsubscribe2 = onSnapshot(
      q2,
      (snapshot) => {
        conversationsAsParticipant2 = snapshot.docs.map(
          (conversationDoc) =>
            ({ id: conversationDoc.id, ...conversationDoc.data() }) as ChatConversation,
        );
        q2Loaded = true;
        updateConversations();
      },
      (snapshotError) => {
        console.error("Erro ao carregar conversas como participante 2:", snapshotError);
        setError(snapshotError as Error);
        conversationsAsParticipant2 = [];
        q2Loaded = true;
        updateConversations();
      },
    );

    return () => {
      unsubscribe1();
      unsubscribe2();
      unsubscribeBlocks();
    };
  }, [userData?.uid]);

  return { conversations, isLoading, error };
}
