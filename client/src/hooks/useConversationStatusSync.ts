import { useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useConversationStatusSync(currentUserId: string | undefined) {
  useEffect(() => {
    if (!currentUserId) return;

    const conversationsRef = collection(db, 'chat_conversations');
    const q = query(
      conversationsRef,
      where('participante1Id', '==', currentUserId)
    );
    
    const q2 = query(
      conversationsRef,
      where('participante2Id', '==', currentUserId)
    );

    const syncConversationStatuses = async () => {
      try {
        const [snapshot1, snapshot2] = await Promise.all([
          getDocs(q),
          getDocs(q2)
        ]);

        const allConversations = [...snapshot1.docs, ...snapshot2.docs];

        const updatePromises = allConversations.map(async (conversationDoc) => {
          const conversation = conversationDoc.data();
          const conversationId = conversationDoc.id;
          
          const lastMessageSenderId = conversation.ultimaMensagemRemetenteId;
          
          if (lastMessageSenderId === currentUserId) {
            const messagesRef = collection(db, 'chat_messages');
            const lastMessageQuery = query(
              messagesRef,
              where('conversationId', '==', conversationId),
              where('remetenteId', '==', currentUserId),
              orderBy('timestamp', 'desc'),
              limit(1)
            );

            const lastMessageSnapshot = await getDocs(lastMessageQuery);
            
            if (!lastMessageSnapshot.empty) {
              const lastMessage = lastMessageSnapshot.docs[0].data();
              
              const conversationRef = doc(db, 'chat_conversations', conversationId);
              await updateDoc(conversationRef, {
                ultimaMensagemEntregue: lastMessage.entregue || false,
                ultimaMensagemLida: lastMessage.lida || false,
              });
            }
          }
        });

        await Promise.all(updatePromises);
      } catch (error) {
        console.error('Erro ao sincronizar status das conversas:', error);
      }
    };

    syncConversationStatuses();

    const messagesRef = collection(db, 'chat_messages');
    const messagesQuery = query(
      messagesRef,
      where('remetenteId', '==', currentUserId)
    );

    const unsubscribe = onSnapshot(messagesQuery, () => {
      syncConversationStatuses();
    });

    return () => unsubscribe();
  }, [currentUserId]);
}
