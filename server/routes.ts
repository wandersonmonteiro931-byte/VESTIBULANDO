import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(expressApp: Express): Promise<Server> {
  
  // Health check endpoint
  expressApp.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "ENEM+ Platform API" });
  });

  const httpServer = createServer(expressApp);
  return httpServer;
}
