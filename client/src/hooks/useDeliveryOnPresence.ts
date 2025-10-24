import { useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getNowBrasiliaISO } from '@/lib/brasiliaTime';

export function useDeliveryOnPresence(currentUserId: string | undefined) {
  useEffect(() => {
    if (!currentUserId) return;

    const unsubscribers: (() => void)[] = [];

    const setupDeliveryListeners = async () => {
      try {
        const messagesRef = collection(db, 'chat_messages');
        const q = query(
          messagesRef,
          where('remetenteId', '==', currentUserId),
          where('entregue', '==', false)
        );

        const snapshot = await getDocs(q);
        const recipientIds = new Set<string>();
        
        snapshot.docs.forEach(doc => {
          const msg = doc.data();
          if (msg.destinatarioId) {
            recipientIds.add(msg.destinatarioId);
          }
        });

        recipientIds.forEach(recipientId => {
          const presenceRef = doc(db, 'user_presence', recipientId);
          
          const unsubscribe = onSnapshot(presenceRef, async (presenceSnap) => {
            if (presenceSnap.exists()) {
              const presenceData = presenceSnap.data();
              
              if (presenceData.isOnline) {
                const messagesQuery = query(
                  messagesRef,
                  where('remetenteId', '==', currentUserId),
                  where('destinatarioId', '==', recipientId),
                  where('entregue', '==', false)
                );

                const undeliveredSnapshot = await getDocs(messagesQuery);
                
                const updatePromises = undeliveredSnapshot.docs.map(async (messageDoc) => {
                  const msgRef = doc(db, 'chat_messages', messageDoc.id);
                  return updateDoc(msgRef, {
                    entregue: true,
                    dataEntrega: getNowBrasiliaISO(),
                  });
                });

                await Promise.all(updatePromises);
              }
            }
          });

          unsubscribers.push(unsubscribe);
        });
      } catch (error) {
        console.error('Erro ao configurar listeners de entrega:', error);
      }
    };

    setupDeliveryListeners();
    const interval = setInterval(setupDeliveryListeners, 30000);

    return () => {
      unsubscribers.forEach(unsub => unsub());
      clearInterval(interval);
    };
  }, [currentUserId]);
}
