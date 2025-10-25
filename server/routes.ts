import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerChatRoutes } from "./chatRoutes";

export async function registerRoutes(expressApp: Express): Promise<Server> {
  
  // Health check endpoint
  expressApp.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "ENEM+ Platform API" });
  });

  // Register chat routes
  registerChatRoutes(expressApp);

  const httpServer = createServer(expressApp);
  return httpServer;
}
