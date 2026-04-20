import "dotenv/config";
import express from "express";
console.log("SERVER.TS FILE LOADED");
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createA2ALiteRouter } from '@agentic-profile/a2a-mcp-express';
import { createDidResolver } from '@agentic-profile/common';
import { resolveClientAgentSessionStore } from './server/stores/client-agent-session/index.ts';
import { agentCard } from './server/agent-card.ts';
import { handleA2aMethod } from "./server/a2a/a2a-method-router.js";

// Import refactored endpoints and utilities
import { registerWellKnownEndpoints } from "./server/endpoints/wellKnown.ts";
import { registerChatEndpoints } from "./server/endpoints/apiChat.ts";
import { registerOmiApiKeyEndpoints } from "./server/endpoints/omiApiKey.ts";
import { registerOmiMemoryEndpoints } from "./server/endpoints/omiMemory.ts";
import { registerPublishEndpoints } from "./server/endpoints/publish.ts";
import { registerAccountEndpoints } from "./server/endpoints/account.ts";
import { registerAgentChatsEndpoints } from "./server/endpoints/agentChats.ts";
import { registerAdminEndpoints } from "./server/endpoints/admin.ts";

const didResolver = createDidResolver();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  // A2A endpoint for all agents hosted on this server
  app.use('/a2a', createA2ALiteRouter({
    jrpcRequestHandler: handleA2aMethod,
    cardBuilder: agentCard,
    store: resolveClientAgentSessionStore(),
    didResolver,
    requireAuth: true
  }));

  // Register refactored endpoints
  registerWellKnownEndpoints(app);
  registerAccountEndpoints(app);
  registerChatEndpoints(app, genAI);
  registerOmiApiKeyEndpoints(app);
  registerOmiMemoryEndpoints(app, genAI);
  registerPublishEndpoints(app);
  registerAgentChatsEndpoints(app);
  registerAdminEndpoints(app);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const portNumber = typeof PORT === "string" ? Number(PORT) : PORT;
  app.listen(portNumber, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${portNumber}`);
  });
}

startServer();
