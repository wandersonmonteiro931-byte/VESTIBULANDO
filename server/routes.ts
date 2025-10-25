import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(expressApp: Express): Promise<Server> {
  
  // Health check endpoint
  expressApp.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "ENEM+ Platform API" });
  });

  // Endpoint para atualizar senha no Firebase Authentication
  expressApp.post("/api/update-password", async (req, res) => {
    try {
      const { email, newPassword } = req.body;

      if (!email || !newPassword) {
        return res.status(400).json({ 
          success: false, 
          message: "Email e nova senha são obrigatórios" 
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ 
          success: false, 
          message: "A senha deve ter pelo menos 6 caracteres" 
        });
      }

      const apiKey = process.env.VITE_FIREBASE_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ 
          success: false, 
          message: "Configuração do Firebase não encontrada" 
        });
      }

      // Primeiro, obter o UID do usuário pelo email usando a API do Firebase
      const lookupResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: [email] })
        }
      );

      const lookupData = await lookupResponse.json();

      if (!lookupData.users || lookupData.users.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: "Usuário não encontrado no Firebase Authentication" 
        });
      }

      const userId = lookupData.users[0].localId;

      // Atualizar a senha usando a API REST do Firebase
      const updateResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            localId: userId,
            password: newPassword,
            returnSecureToken: false
          })
        }
      );

      const updateData = await updateResponse.json();

      if (updateData.error) {
        return res.status(400).json({ 
          success: false, 
          message: updateData.error.message || "Erro ao atualizar senha" 
        });
      }

      res.json({ 
        success: true, 
        message: "Senha atualizada com sucesso no Firebase Authentication" 
      });

    } catch (error: any) {
      console.error("Erro ao atualizar senha:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Erro interno ao atualizar senha" 
      });
    }
  });

  const httpServer = createServer(expressApp);
  return httpServer;
}
