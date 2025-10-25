import type { Express } from "express";
import { createServer, type Server } from "http";
import admin from "firebase-admin";

let firebaseAdmin: admin.app.App | null = null;

function initializeFirebaseAdmin(): admin.app.App | null {
  if (firebaseAdmin) {
    return firebaseAdmin;
  }

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountJson) {
      console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT não configurado - funcionalidades de admin desabilitadas");
      return null;
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    
    if (admin.apps.length === 0) {
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("✅ Firebase Admin SDK inicializado com sucesso");
    } else {
      firebaseAdmin = admin.app();
    }
    
    return firebaseAdmin;
  } catch (error: any) {
    console.error("❌ Erro ao inicializar Firebase Admin SDK:", error.message);
    return null;
  }
}

export async function registerRoutes(expressApp: Express): Promise<Server> {
  
  initializeFirebaseAdmin();
  
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

      if (!firebaseAdmin) {
        return res.status(503).json({ 
          success: false, 
          message: "Firebase Admin SDK não está configurado. Configure FIREBASE_SERVICE_ACCOUNT nos Secrets do Replit com as credenciais da conta de serviço." 
        });
      }

      console.log(`🔧 Alterando senha para UID: ${userId}`);

      try {
        await admin.auth().updateUser(userId, {
          password: newPassword,
        });

        console.log(`✅ Senha atualizada com sucesso para UID: ${userId}`);
        return res.json({ 
          success: true, 
          message: "Senha atualizada com sucesso" 
        });
      } catch (adminError: any) {
        console.error(`❌ Erro ao atualizar senha:`, adminError.message);
        
        if (adminError.code === 'auth/user-not-found') {
          return res.status(404).json({ 
            success: false, 
            message: "Usuário não encontrado" 
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
