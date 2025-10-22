import type { Express } from "express";
import { createServer, type Server } from "http";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

// Initialize Firebase on server (uses same config as client)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig, 'server-instance');
const db = getFirestore(app);

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

      // Buscar nas solicitações
      const solicitacoesSnapshot = await getDocs(
        query(collection(db, "solicitacoes"), where("matricula", "==", matricula))
      );

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

      // Buscar nos usuários aprovados
      const usuariosSnapshot = await getDocs(
        query(collection(db, "usuarios"), where("matricula", "==", matricula))
      );

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
