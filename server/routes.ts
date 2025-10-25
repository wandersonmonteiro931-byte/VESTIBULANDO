import type { Express } from "express";
import { createServer, type Server } from "http";
import * as admin from "firebase-admin";

let firebaseAdmin: admin.app.App | null = null;

function getFirebaseAdmin() {
  if (!firebaseAdmin) {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
    
    if (!projectId) {
      throw new Error("Firebase Project ID não configurado");
    }

    try {
      firebaseAdmin = admin.initializeApp({
        projectId: projectId,
      });
      console.log("✅ Firebase Admin inicializado");
    } catch (error: any) {
      if (error.code === 'app/duplicate-app') {
        firebaseAdmin = admin.app();
      } else {
        throw error;
      }
    }
  }
  return firebaseAdmin;
}

export async function registerRoutes(expressApp: Express): Promise<Server> {
  
  // Health check endpoint
  expressApp.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "ENEM+ Platform API" });
  });

  // Endpoint para atualizar senha no Firebase Authentication
  expressApp.post("/api/update-password", async (req, res) => {
    try {
      const { userId, newPassword } = req.body;

      if (!userId || !newPassword) {
        return res.status(400).json({ 
          success: false, 
          message: "ID do usuário e nova senha são obrigatórios" 
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ 
          success: false, 
          message: "A senha deve ter pelo menos 6 caracteres" 
        });
      }

      console.log(`🔧 Alterando senha para UID: ${userId}`);

      try {
        const app = getFirebaseAdmin();
        const auth = admin.auth(app);
        
        await auth.updateUser(userId, {
          password: newPassword,
        });

        console.log(`✅ Senha atualizada com sucesso para UID: ${userId}`);
        return res.json({ 
          success: true, 
          message: "Senha atualizada com sucesso no Firebase Authentication" 
        });
      } catch (adminError: any) {
        console.error(`❌ Erro ao atualizar senha com Admin SDK:`, adminError.message);
        
        if (adminError.code === 'auth/user-not-found') {
          return res.status(404).json({ 
            success: false, 
            message: "Usuário não encontrado no Firebase Authentication" 
          });
        }
        
        return res.status(400).json({ 
          success: false, 
          message: `Erro ao atualizar senha: ${adminError.message}` 
        });
      }

    } catch (error: any) {
      console.error("❌ Erro ao atualizar senha:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Erro interno ao atualizar senha" 
      });
    }
  });

  const httpServer = createServer(expressApp);
  return httpServer;
}
