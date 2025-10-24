import { useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useConversationStatusSync(currentUserId: string | undefined) {
  useEffect(() => {
    if (!currentUserId) return;

    const conversationsRef = collection(db, 'chat_conversations');
    
    const q1 = query(
      conversationsRef,
      where('participante1Id', '==', currentUserId)
    );
    
    const q2 = query(
      conversationsRef,
      where('participante2Id', '==', currentUserId)
    );

    const updateConversationStatus = async (conversationId: string, senderId: string) => {
      try {
        const messagesRef = collection(db, 'chat_messages');
        const lastMessageQuery = query(
          messagesRef,
          where('conversationId', '==', conversationId),
          where('remetenteId', '==', senderId),
          orderBy('timestamp', 'desc'),
          limit(1)
        );

        const snapshot = await getDocs(lastMessageQuery);
        
        if (!snapshot.empty) {
          const lastMessage = snapshot.docs[0].data();
          
          const conversationRef = doc(db, 'chat_conversations', conversationId);
          await updateDoc(conversationRef, {
            ultimaMensagemEntregue: lastMessage.entregue || false,
            ultimaMensagemLida: lastMessage.lida || false,
          });
          
          console.log('✓ Status atualizado na conversa:', conversationId, {
            entregue: lastMessage.entregue || false,
            lida: lastMessage.lida || false,
          });
        }
      } catch (error) {
        console.error('Erro ao atualizar status da conversa:', error);
      }
    };

    const syncAllConversations = async () => {
      try {
        const [snapshot1, snapshot2] = await Promise.all([
          getDocs(q1),
          getDocs(q2)
        ]);

        const allDocs = [...snapshot1.docs, ...snapshot2.docs];
        
        for (const conversationDoc of allDocs) {
          const conversation = conversationDoc.data();
          if (conversation.ultimaMensagemRemetenteId === currentUserId) {
            await updateConversationStatus(conversationDoc.id, currentUserId);
          }
        }
      } catch (error) {
        console.error('Erro na sincronização inicial:', error);
      }
    };

    syncAllConversations();

    const unsubscribe1 = onSnapshot(q1, (snapshot) => {
      snapshot.docs.forEach((conversationDoc) => {
        const conversation = conversationDoc.data();
        if (conversation.ultimaMensagemRemetenteId === currentUserId) {
          updateConversationStatus(conversationDoc.id, currentUserId);
        }
      });
    });

    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      snapshot.docs.forEach((conversationDoc) => {
        const conversation = conversationDoc.data();
        if (conversation.ultimaMensagemRemetenteId === currentUserId) {
          updateConversationStatus(conversationDoc.id, currentUserId);
        }
      });
    });

    const messagesRef = collection(db, 'chat_messages');
    const myMessagesQuery = query(
      messagesRef,
      where('remetenteId', '==', currentUserId)
    );

    const unsubscribe3 = onSnapshot(myMessagesQuery, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'modified') {
          const message = change.doc.data();
          const conversationId = message.conversationId;
          
          if (conversationId) {
            await updateConversationStatus(conversationId, currentUserId);
          }
        }
      });
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
    };
  }, [currentUserId]);
}
