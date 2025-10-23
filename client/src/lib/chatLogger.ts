import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ChatLog } from "@shared/schema";

type LogTipo = ChatLog["tipo"];
type NivelSeveridade = ChatLog["nivelSeveridade"];

interface LogParams {
  tipo: LogTipo;
  usuarioId: string;
  usuarioNome: string;
  conversationId?: string;
  messageId?: string;
  detalhes: Record<string, any>;
  nivelSeveridade?: NivelSeveridade;
}

export async function logChatAction(params: LogParams): Promise<void> {
  try {
    const logData = {
      tipo: params.tipo,
      usuarioId: params.usuarioId,
      usuarioNome: params.usuarioNome,
      conversationId: params.conversationId,
      messageId: params.messageId,
      detalhes: JSON.stringify(params.detalhes),
      timestamp: new Date().toISOString(),
      nivelSeveridade: params.nivelSeveridade || "info",
    };

    await addDoc(collection(db, "chatLogs"), logData);
  } catch (error) {
    console.error("Erro ao registrar log do chat:", error);
  }
}

// Funções auxiliares para logs específicos
export const ChatLogger = {
  mensagemEnviada: (usuarioId: string, usuarioNome: string, conversationId: string, messageId: string, tipo: string) => {
    return logChatAction({
      tipo: "mensagem_enviada",
      usuarioId,
      usuarioNome,
      conversationId,
      messageId,
      detalhes: { tipoMensagem: tipo },
      nivelSeveridade: "info",
    });
  },

  mensagemLida: (usuarioId: string, usuarioNome: string, conversationId: string, messageId: string) => {
    return logChatAction({
      tipo: "mensagem_lida",
      usuarioId,
      usuarioNome,
      conversationId,
      messageId,
      detalhes: {},
      nivelSeveridade: "info",
    });
  },

  mensagemDeletada: (usuarioId: string, usuarioNome: string, conversationId: string, messageId: string, papel: "remetente" | "destinatario") => {
    return logChatAction({
      tipo: "mensagem_deletada",
      usuarioId,
      usuarioNome,
      conversationId,
      messageId,
      detalhes: { papel },
      nivelSeveridade: "info",
    });
  },

  arquivoEnviado: (usuarioId: string, usuarioNome: string, conversationId: string, messageId: string, arquivo: { nome: string; tipo: string; tamanho: number }) => {
    return logChatAction({
      tipo: "arquivo_enviado",
      usuarioId,
      usuarioNome,
      conversationId,
      messageId,
      detalhes: arquivo,
      nivelSeveridade: "info",
    });
  },

  erroEnvio: (usuarioId: string, usuarioNome: string, conversationId: string, erro: string) => {
    return logChatAction({
      tipo: "erro_envio",
      usuarioId,
      usuarioNome,
      conversationId,
      detalhes: { erro },
      nivelSeveridade: "error",
    });
  },

  erroUpload: (usuarioId: string, usuarioNome: string, conversationId: string, arquivo: string, erro: string) => {
    return logChatAction({
      tipo: "erro_upload",
      usuarioId,
      usuarioNome,
      conversationId,
      detalhes: { arquivo, erro },
      nivelSeveridade: "error",
    });
  },

  conexaoPerdida: (usuarioId: string, usuarioNome: string) => {
    return logChatAction({
      tipo: "conexao_perdida",
      usuarioId,
      usuarioNome,
      detalhes: { timestamp: new Date().toISOString() },
      nivelSeveridade: "warning",
    });
  },

  conexaoRestaurada: (usuarioId: string, usuarioNome: string) => {
    return logChatAction({
      tipo: "conexao_restaurada",
      usuarioId,
      usuarioNome,
      detalhes: { timestamp: new Date().toISOString() },
      nivelSeveridade: "info",
    });
  },

  violacaoDetectada: (usuarioId: string, usuarioNome: string, conversationId: string, mensagem: string, razao: string) => {
    return logChatAction({
      tipo: "violacao_detectada",
      usuarioId,
      usuarioNome,
      conversationId,
      detalhes: { mensagem, razao },
      nivelSeveridade: "warning",
    });
  },

  penalidadeAplicada: (usuarioId: string, usuarioNome: string, conversationId: string, tipo: string, infracao: number) => {
    return logChatAction({
      tipo: "penalidade_aplicada",
      usuarioId,
      usuarioNome,
      conversationId,
      detalhes: { tipoPenalidade: tipo, numeroInfracao: infracao },
      nivelSeveridade: "critical",
    });
  },
};
