import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createDidResolver } from '@agentic-profile/common';
import { describeServerError, isServerError, resolveServerErrorHttpStatus } from "@agentic-profile/a2a-mcp-express";

import { resolveClientAgentSessionStore } from './server/stores/client-agent-session/index.ts';
import { agentCard } from './server/agent-card.ts';
import { handleA2aMethod } from "./server/lite-services/a2a/a2a-method-router.js";
import { toolsCall } from "./server/lite-services/mcp/router.ts";

// Import refactored endpoints and utilities
import { registerWellKnownEndpoints } from "./server/endpoints/wellKnown.ts";
import { registerChatEndpoints } from "./server/endpoints/apiChat.ts";
import { registerOmiApiKeyEndpoints } from "./server/endpoints/omiApiKey.ts";
import { registerOmiMemoryEndpoints } from "./server/endpoints/omiMemory.ts";
import { registerPublishEndpoints } from "./server/endpoints/publish.ts";
import { registerAccountEndpoints } from "./server/endpoints/account.ts";
import { registerAgentChatsEndpoints } from "./server/endpoints/agentChats.ts";
import { registerAdminEndpoints } from "./server/endpoints/admin.ts";
import { MCP_TOOLS } from "./server/lite-services/mcp/tools.ts";
import { createA2aMcpLiteRouter } from "./server/lite-services/router.ts";


const didResolver = createDidResolver();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Create Lite A2A+MCP router
  const clientAgentSessionsStore = resolveClientAgentSessionStore();
  app.use(createA2aMcpLiteRouter({
    store: clientAgentSessionsStore, 
    didResolver, 
    a2aConfig: {
      jrpcRequestHandler: handleA2aMethod,
      cardBuilder: agentCard,
    }, 
    mcpConfig: {
      toolsCall: toolsCall,
      tools: MCP_TOOLS,
    },
    requireAuth: true
  }));

  // Register client API endpoints
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
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
    app.get(/.*/, (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Central error handler
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      if (isServerError(err))
        res.status(resolveServerErrorHttpStatus(err)).json(describeServerError(err));
      else
        res.status(500).json({ error: `Internal Server Error: ${err}` });
    }
  );

  const portNumber = typeof PORT === "string" ? Number(PORT) : PORT;
  app.listen(portNumber, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${portNumber}`);
  });
}

startServer();
