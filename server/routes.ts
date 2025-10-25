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

      const apiKey = process.env.VITE_FIREBASE_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ 
          success: false, 
          message: "Configuração do Firebase não encontrada" 
        });
      }

      console.log(`🔧 Alterando senha para UID: ${userId}`);

      // Usar o UID diretamente para atualizar a senha
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
        // Se o erro for USER_NOT_FOUND, tentar criar a conta
        if (updateData.error.message === 'USER_NOT_FOUND') {
          console.log(`🔧 Usuário ${userId} não existe no Authentication. Tentando criar...`);
          
          // Para criar precisamos do email, então vamos retornar erro
          return res.status(400).json({ 
            success: false, 
            message: "Usuário não encontrado no Firebase Authentication. Não é possível criar sem o email." 
          });
        }
        
        console.error(`❌ Erro ao atualizar senha:`, updateData.error);
        return res.status(400).json({ 
          success: false, 
          message: `Erro ao atualizar senha: ${updateData.error.message}` 
        });
      }

      console.log(`✅ Senha atualizada com sucesso para UID: ${userId}`);
      return res.json({ 
        success: true, 
        message: "Senha atualizada com sucesso no Firebase Authentication" 
      });

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
