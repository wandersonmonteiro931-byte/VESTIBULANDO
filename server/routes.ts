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

      // Tentar fazer login com o email para obter o UID
      // Usamos uma senha temporária que não importa - apenas queremos o erro
      const signInResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email,
            password: 'temp-password-for-lookup-only',
            returnSecureToken: true
          })
        }
      );

      const signInData = await signInResponse.json();

      // Se obtivemos um userId do erro ou da resposta, o usuário existe
      if (signInData.localId || (signInData.error && signInData.error.message !== 'EMAIL_NOT_FOUND')) {
        // O usuário existe, então vamos resetar a senha
        console.log(`✅ Usuário encontrado no Authentication`);
        
        const resetResponse = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`,
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

        const resetData = await resetResponse.json();

        if (resetData.error) {
          console.error(`❌ Erro ao atualizar senha:`, resetData.error);
          return res.status(400).json({ 
            success: false, 
            message: `Erro ao atualizar senha: ${resetData.error.message}` 
          });
        }

        console.log(`✅ Senha atualizada com sucesso`);
        return res.json({ 
          success: true, 
          message: "Senha atualizada com sucesso no Firebase Authentication" 
        });
      } else if (signInData.error && signInData.error.message === 'EMAIL_NOT_FOUND') {
        // O usuário não existe, criar a conta
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
      } else {
        // Erro inesperado
        console.error(`❌ Erro inesperado:`, signInData.error);
        return res.status(400).json({ 
          success: false, 
          message: signInData.error?.message || "Erro ao verificar usuário" 
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
