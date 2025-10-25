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

      console.log(`🔧 Alterando senha para email: ${email}`);

      // Primeiro, tentar atualizar a senha (assumindo que o usuário já existe)
      const lookupResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: [email] })
        }
      );

      const lookupData = await lookupResponse.json();

      if (lookupData.error) {
        console.error(`❌ Erro ao buscar usuário:`, lookupData.error);
        return res.status(400).json({ 
          success: false, 
          message: `Erro ao buscar usuário: ${lookupData.error.message}` 
        });
      }

      // Se o usuário existe
      if (lookupData.users && lookupData.users.length > 0) {
        const userId = lookupData.users[0].localId;
        console.log(`✅ Usuário encontrado no Authentication. UID: ${userId}`);
        
        // Atualizar a senha
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
      } else {
        // Se o usuário não existe, criar a conta
        console.log(`🔧 Usuário ${email} não existe no Authentication. Criando conta...`);
        
        const createResponse = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email,
              password: newPassword,
              returnSecureToken: false
            })
          }
        );

        const createData = await createResponse.json();

        if (createData.error) {
          console.error(`❌ Erro ao criar conta:`, createData.error);
          return res.status(400).json({ 
            success: false, 
            message: `Erro ao criar conta: ${createData.error.message}` 
          });
        }

        console.log(`✅ Conta criada com sucesso no Authentication. UID: ${createData.localId}`);
        return res.json({ 
          success: true, 
          message: "Conta criada e senha definida com sucesso no Firebase Authentication" 
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
