import { collection, query, where, getDocs, addDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Lista de palavras/termos proibidos
const FORBIDDEN_WORDS = [
  // Palavras ofensivas
  "idiota", "burro", "estúpido", "imbecil", "otário", "babaca",
  "filho da", "fdp", "porra", "caralho", "merda", "cu", "puto",
  // Termos discriminatórios
  "viado", "bicha", "sapatão", "preto", "macaco", "gordo", "baleia",
  // Spam e links suspeitos
  "ganhe dinheiro", "clique aqui", "promoção", "compre agora", 
  "bit.ly", "tinyurl", "whats.link",
];

// Padrões suspeitos (regex)
const SUSPICIOUS_PATTERNS = [
  /\b\d{11}\b/, // CPF
  /\b\d{2,3}\s?\d{4,5}[-\s]?\d{4}\b/, // Telefone
  /(https?:\/\/[^\s]+)/gi, // URLs (exceto domínios permitidos)
];

interface ViolationResult {
  isViolation: boolean;
  reason?: string;
  infractionNumber?: number;
  penaltyMessage?: string;
}

export async function checkMessageForViolations(
  message: string,
  userId: string
): Promise<ViolationResult | null> {
  const messageLower = message.toLowerCase();

  // Verificar palavras proibidas
  for (const word of FORBIDDEN_WORDS) {
    if (messageLower.includes(word.toLowerCase())) {
      const infractions = await getUserInfractions(userId);
      const infractionNumber = infractions.length + 1;
      
      let penaltyMessage = "";
      if (infractionNumber === 1) {
        penaltyMessage = "Você recebeu uma advertência.";
      } else if (infractionNumber === 2) {
        penaltyMessage = "Você foi bloqueado por 24 horas.";
      } else {
        penaltyMessage = "Sua conta será suspensa. Entre em contato com a Diretoria.";
      }

      return {
        isViolation: true,
        reason: "Conteúdo ofensivo ou inapropriado detectado",
        infractionNumber,
        penaltyMessage,
      };
    }
  }

  // Verificar padrões suspeitos
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(message)) {
      const infractions = await getUserInfractions(userId);
      const infractionNumber = infractions.length + 1;
      
      let penaltyMessage = "";
      if (infractionNumber === 1) {
        penaltyMessage = "Você recebeu uma advertência.";
      } else if (infractionNumber === 2) {
        penaltyMessage = "Você foi bloqueado por 24 horas.";
      } else {
        penaltyMessage = "Sua conta será suspensa. Entre em contato com a Diretoria.";
      }

      return {
        isViolation: true,
        reason: "Compartilhamento de informações pessoais ou links não permitidos",
        infractionNumber,
        penaltyMessage,
      };
    }
  }

  return null;
}

async function getUserInfractions(userId: string): Promise<any[]> {
  const penaltiesRef = collection(db, "chat_penalties");
  const q = query(
    penaltiesRef,
    where("usuarioId", "==", userId),
    where("ativa", "==", true)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function applyPenalty(
  userId: string,
  violation: ViolationResult,
  message: string,
  conversationId: string,
  otherUserId: string,
  otherUserName: string
) {
  // Buscar dados do usuário
  const usersRef = collection(db, "users");
  const userQuery = query(usersRef, where("uid", "==", userId));
  const userSnapshot = await getDocs(userQuery);
  
  if (userSnapshot.empty) return;
  
  const userData = userSnapshot.docs[0].data();

  const infractionNumber = violation.infractionNumber || 1;
  let penaltyType: "advertencia" | "bloqueio_24h" | "suspensao_conta" = "advertencia";
  let dataExpiracao: string | undefined;

  if (infractionNumber === 1) {
    penaltyType = "advertencia";
  } else if (infractionNumber === 2) {
    penaltyType = "bloqueio_24h";
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + 24);
    dataExpiracao = expiration.toISOString();
  } else {
    penaltyType = "suspensao_conta";
  }

  const penaltyData = {
    usuarioId: userId,
    usuarioNome: userData.nome,
    usuarioMatricula: userData.matricula || "",
    usuarioTipo: userData.tipo,
    tipo: penaltyType,
    mensagemInfratora: message,
    conversationId,
    destinatarioId: otherUserId,
    destinatarioNome: otherUserName,
    dataInfracao: new Date().toISOString(),
    numeroDaInfracao: infractionNumber,
    ativa: true,
    dataExpiracao,
    revisadoPorDiretor: false,
  };

  await addDoc(collection(db, "chat_penalties"), penaltyData);

  // Se for suspensão, desativar o usuário
  if (penaltyType === "suspensao_conta") {
    const userDocRef = doc(db, "users", userSnapshot.docs[0].id);
    await updateDoc(userDocRef, {
      ativo: false,
    });
  }
}
