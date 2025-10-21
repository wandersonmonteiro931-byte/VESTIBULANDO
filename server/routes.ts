import type { Express } from "express";
import { createServer, type Server } from "http";

// This project uses Firebase for all backend functionality:
// - Authentication: Firebase Auth
// - Database: Firestore
// - File Storage: Firebase Storage
// All API interactions are handled client-side through Firebase SDK

export async function registerRoutes(app: Express): Promise<Server> {
  // No custom API routes needed - Firebase handles everything
  
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "ENEM+ Platform API" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
