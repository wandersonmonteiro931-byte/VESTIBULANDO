import type { Express } from "express";
import { 
  collection, 
  query as firestoreQuery, 
  where, 
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { db } from "../client/src/lib/firebase";

export function registerChatRoutes(app: Express) {
  
  // Get user's conversations
  app.get("/api/chat/conversations", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const conversationsRef = collection(db, "chatConversations");
      const q = firestoreQuery(
        conversationsRef,
        where("participante1Id", "==", userId)
      );
      const q2 = firestoreQuery(
        conversationsRef,
        where("participante2Id", "==", userId)
      );

      const [snapshot1, snapshot2] = await Promise.all([
        getDocs(q),
        getDocs(q2)
      ]);

      const conversations = [
        ...snapshot1.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ...snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      ];

      // Sort by last message timestamp
      conversations.sort((a: any, b: any) => {
        const aTime = a.ultimaMensagemTimestamp || a.dataUltimaAtualizacao || "";
        const bTime = b.ultimaMensagemTimestamp || b.dataUltimaAtualizacao || "";
        return bTime.localeCompare(aTime);
      });

      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get messages for a conversation
  app.get("/api/chat/messages", async (req, res) => {
    try {
      const conversationId = req.query.conversationId as string;
      
      if (!conversationId) {
        return res.status(400).json({ error: "conversationId is required" });
      }

      const messagesRef = collection(db, "chatMessages");
      const q = firestoreQuery(
        messagesRef,
        where("conversationId", "==", conversationId),
        orderBy("timestamp", "asc")
      );

      const snapshot = await getDocs(q);
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Send a message
  app.post("/api/chat/send", async (req, res) => {
    try {
      const { 
        conversationId, 
        destinatarioId,
        destinatarioNome,
        destinatarioTipo,
        conteudo,
        tipo
      } = req.body;

      if (!conversationId || !destinatarioId || !conteudo) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Get sender info from session/auth (você pode adaptar conforme seu sistema de autenticação)
      const remetenteId = req.body.remetenteId || "user-id"; // TODO: Get from auth
      const remetenteNome = req.body.remetenteNome || "User"; // TODO: Get from auth
      const remetenteTipo = req.body.remetenteTipo || "aluno"; // TODO: Get from auth

      const now = new Date().toISOString();

      // Create message
      const messageData = {
        conversationId,
        remetenteId,
        remetenteNome,
        remetenteTipo,
        destinatarioId,
        destinatarioNome,
        destinatarioTipo,
        tipo: tipo || "texto",
        conteudo,
        timestamp: now,
        entregue: true,
        dataEntrega: now,
        lida: false,
        deletadaPorRemetente: false,
        deletadaPorDestinatario: false,
      };

      const messagesRef = collection(db, "chatMessages");
      const messageDoc = await addDoc(messagesRef, messageData);

      // Update conversation
      const conversationRef = doc(db, "chatConversations", conversationId);
      const conversationSnap = await getDoc(conversationRef);
      
      if (conversationSnap.exists()) {
        const conversation = conversationSnap.data();
        const isParticipant1 = conversation.participante1Id === remetenteId;
        
        await updateDoc(conversationRef, {
          ultimaMensagem: conteudo.substring(0, 100),
          ultimaMensagemTimestamp: now,
          ultimaMensagemRemetenteId: remetenteId,
          ultimaMensagemEntregue: true,
          ultimaMensagemLida: false,
          [isParticipant1 ? "mensagensNaoLidas2" : "mensagensNaoLidas1"]: 
            (conversation[isParticipant1 ? "mensagensNaoLidas2" : "mensagensNaoLidas1"] || 0) + 1,
          dataUltimaAtualizacao: now,
        });
      }

      res.json({ 
        success: true, 
        messageId: messageDoc.id,
        message: { id: messageDoc.id, ...messageData }
      });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Mark messages as read
  app.post("/api/chat/mark-read", async (req, res) => {
    try {
      const { conversationId, userId } = req.body;

      if (!conversationId || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Update conversation
      const conversationRef = doc(db, "chatConversations", conversationId);
      const conversationSnap = await getDoc(conversationRef);
      
      if (conversationSnap.exists()) {
        const conversation = conversationSnap.data();
        const isParticipant1 = conversation.participante1Id === userId;
        
        await updateDoc(conversationRef, {
          [isParticipant1 ? "mensagensNaoLidas1" : "mensagensNaoLidas2"]: 0,
          ultimaMensagemLida: true,
        });
      }

      // Update messages
      const messagesRef = collection(db, "chatMessages");
      const q = firestoreQuery(
        messagesRef,
        where("conversationId", "==", conversationId),
        where("destinatarioId", "==", userId),
        where("lida", "==", false)
      );

      const snapshot = await getDocs(q);
      const updatePromises = snapshot.docs.map(messageDoc => 
        updateDoc(doc(db, "chatMessages", messageDoc.id), {
          lida: true,
          dataLeitura: new Date().toISOString()
        })
      );

      await Promise.all(updatePromises);

      res.json({ success: true });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ error: "Failed to mark messages as read" });
    }
  });

  // Create or get conversation
  app.post("/api/chat/conversation/create", async (req, res) => {
    try {
      const { 
        participante1Id,
        participante1Nome,
        participante1Tipo,
        participante2Id,
        participante2Nome,
        participante2Tipo
      } = req.body;

      if (!participante1Id || !participante2Id) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check if conversation already exists
      const conversationsRef = collection(db, "chatConversations");
      const q1 = firestoreQuery(
        conversationsRef,
        where("participante1Id", "==", participante1Id),
        where("participante2Id", "==", participante2Id)
      );
      const q2 = firestoreQuery(
        conversationsRef,
        where("participante1Id", "==", participante2Id),
        where("participante2Id", "==", participante1Id)
      );

      const [snapshot1, snapshot2] = await Promise.all([
        getDocs(q1),
        getDocs(q2)
      ]);

      if (!snapshot1.empty) {
        const existing = snapshot1.docs[0];
        return res.json({ 
          id: existing.id, 
          ...existing.data() 
        });
      }

      if (!snapshot2.empty) {
        const existing = snapshot2.docs[0];
        return res.json({ 
          id: existing.id, 
          ...existing.data() 
        });
      }

      // Create new conversation
      const now = new Date().toISOString();
      const conversationData = {
        participante1Id,
        participante1Nome,
        participante1Tipo,
        participante2Id,
        participante2Nome,
        participante2Tipo,
        mensagensNaoLidas1: 0,
        mensagensNaoLidas2: 0,
        participante1Digitando: false,
        participante2Digitando: false,
        deletadaPorParticipante1: false,
        deletadaPorParticipante2: false,
        dataCriacao: now,
        dataUltimaAtualizacao: now,
      };

      const conversationDoc = await addDoc(conversationsRef, conversationData);

      res.json({ 
        id: conversationDoc.id, 
        ...conversationData 
      });
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });
}
