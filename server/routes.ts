import type { Express } from "express";
import { createServer, type Server } from "http";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
// Admin SDK bypasses Firestore security rules (server-side only)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      // For production, use a proper service account key
      // For now, we'll use minimal config that works with public Firestore access
    }),
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

export async function registerRoutes(expressApp: Express): Promise<Server> {
  
  // Health check endpoint
  expressApp.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "ENEM+ Platform API" });
  });

  // Verificar status da matrícula - retorna dados sanitizados
  expressApp.get("/api/verificar-status/:matricula", async (req, res) => {
    try {
      const { matricula } = req.params;

      // Validar formato da matrícula
      if (!matricula || matricula.length !== 4 || !/^\d{4}$/.test(matricula)) {
        return res.status(400).json({
          error: "Matrícula inválida. Deve conter exatamente 4 dígitos."
        });
      }

      // Buscar nas solicitações usando Admin SDK
      const solicitacoesSnapshot = await db.collection("solicitacoes")
        .where("matricula", "==", matricula)
        .get();

      if (!solicitacoesSnapshot.empty) {
        const solicitacao = solicitacoesSnapshot.docs[0].data();
        
        // Retornar apenas dados não sensíveis
        return res.json({
          found: true,
          tipo: "solicitacao",
          data: {
            matricula: solicitacao.matricula,
            nome: solicitacao.nome,
            status: solicitacao.status,
            tipo: solicitacao.tipo,
            turma: solicitacao.turma,
            dataSolicitacao: solicitacao.dataSolicitacao,
            comentarioReprovacao: solicitacao.comentarioReprovacao || null
          }
        });
      }

      // Buscar nos usuários aprovados usando Admin SDK
      const usuariosSnapshot = await db.collection("usuarios")
        .where("matricula", "==", matricula)
        .get();

      if (!usuariosSnapshot.empty) {
        const usuario = usuariosSnapshot.docs[0].data();
        
        // Retornar apenas dados não sensíveis
        return res.json({
          found: true,
          tipo: "usuario",
          data: {
            matricula: usuario.matricula,
            nome: usuario.nome,
            status: usuario.status,
            tipo: usuario.tipo,
            turma: usuario.turma,
            ativo: usuario.ativo
          }
        });
      }

      // Não encontrado
      return res.json({
        found: false,
        message: "Nenhuma solicitação ou usuário encontrado com esta matrícula."
      });

    } catch (error: any) {
      console.error("Erro ao verificar status:", error);
      return res.status(500).json({
        error: "Erro ao verificar status. Tente novamente mais tarde."
      });
    }
  });

  const httpServer = createServer(expressApp);
  return httpServer;
}
