import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useConversationStatusSync(currentUserId: string | undefined) {
  const processingRef = useRef<Set<string>>(new Set());

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
      const key = `${conversationId}-${senderId}`;
      
      if (processingRef.current.has(key)) {
        return;
      }

      processingRef.current.add(key);

      try {
        const messagesRef = collection(db, 'chat_messages');
        const lastMessageQuery = query(
          messagesRef,
          where('conversationId', '==', conversationId),
          where('remetenteId', '==', senderId)
        );

        const snapshot = await getDocs(lastMessageQuery);
        
        if (!snapshot.empty) {
          const messages = snapshot.docs.map(doc => doc.data());
          messages.sort((a, b) => {
            const dateA = new Date(a.timestamp).getTime();
            const dateB = new Date(b.timestamp).getTime();
            return dateB - dateA;
          });
          
          const lastMessage = messages[0];
          
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
      } finally {
        setTimeout(() => {
          processingRef.current.delete(key);
        }, 1000);
      }
    };

    const syncAllConversations = async () => {
      try {
        console.log('🔄 Iniciando sincronização de todas as conversas...');
        const [snapshot1, snapshot2] = await Promise.all([
          getDocs(q1),
          getDocs(q2)
        ]);

        const allDocs = [...snapshot1.docs, ...snapshot2.docs];
        console.log(`📊 Total de conversas encontradas: ${allDocs.length}`);
        
        for (const conversationDoc of allDocs) {
          const conversation = conversationDoc.data();
          if (conversation.ultimaMensagemRemetenteId === currentUserId) {
            console.log(`🔄 Sincronizando conversa: ${conversationDoc.id}`);
            await updateConversationStatus(conversationDoc.id, currentUserId);
          }
        }
        console.log('✅ Sincronização inicial concluída');
      } catch (error) {
        console.error('Erro na sincronização inicial:', error);
      }
    };

    syncAllConversations();

    const messagesRef = collection(db, 'chat_messages');
    const myMessagesQuery = query(
      messagesRef,
      where('remetenteId', '==', currentUserId)
    );

    const unsubscribe1 = onSnapshot(myMessagesQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const message = change.doc.data();
        
        console.log('🔔 Mudança detectada em mensagem:', {
          type: change.type,
          conversationId: message.conversationId,
          entregue: message.entregue,
          lida: message.lida,
        });
        
        if (change.type === 'modified' || change.type === 'added') {
          const conversationId = message.conversationId;
          
          if (conversationId) {
            console.log('🔄 Atualizando status da conversa:', conversationId);
            updateConversationStatus(conversationId, currentUserId);
          }
        }
      });
    });

    const unsubscribe2 = onSnapshot(q1, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const conversation = change.doc.data();
          if (conversation.ultimaMensagemRemetenteId === currentUserId) {
            console.log('🔄 Conversa modificada, re-sincronizando:', change.doc.id);
            updateConversationStatus(change.doc.id, currentUserId);
          }
        }
      });
    });

    const unsubscribe3 = onSnapshot(q2, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const conversation = change.doc.data();
          if (conversation.ultimaMensagemRemetenteId === currentUserId) {
            console.log('🔄 Conversa modificada, re-sincronizando:', change.doc.id);
            updateConversationStatus(change.doc.id, currentUserId);
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
