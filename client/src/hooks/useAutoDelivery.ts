import { useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getNowBrasiliaISO } from '@/lib/brasiliaTime';

export function useAutoDelivery(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const markAllMessagesAsDelivered = async () => {
      try {
        // Buscar todas as mensagens não entregues destinadas a este usuário
        const messagesRef = collection(db, 'chat_messages');
        const q = query(
          messagesRef,
          where('destinatarioId', '==', userId),
          where('entregue', '==', false)
        );

        const snapshot = await getDocs(q);
        
        // Marcar todas como entregues
        const updatePromises = snapshot.docs.map(async (messageDoc) => {
          const msgRef = doc(db, 'chat_messages', messageDoc.id);
          return updateDoc(msgRef, {
            entregue: true,
            dataEntrega: getNowBrasiliaISO(),
          });
        });

        await Promise.all(updatePromises);
        
        if (snapshot.docs.length > 0) {
          console.log(`✓ ${snapshot.docs.length} mensagem(ns) marcada(s) como entregue(s)`);
        }
      } catch (error) {
        console.error('Erro ao marcar mensagens como entregues:', error);
      }
    };

    // Marcar como entregue quando o componente monta (usuário fez login)
    markAllMessagesAsDelivered();

    // Verificar periodicamente se há novas mensagens não entregues
    const interval = setInterval(markAllMessagesAsDelivered, 10000); // A cada 10 segundos

    return () => clearInterval(interval);
  }, [userId]);
}
