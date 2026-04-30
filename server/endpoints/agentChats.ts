import type { Express } from "express";
import { prettyJson } from "@agentic-profile/common";
import { authenticate } from "../middleware.ts";
import { ensureAgentOwnerInGoodStanding } from "../lite-services/a2a/chat/misc.js";
import { resolveAgentChatsStore } from "../stores/agent-chats/index.ts";
import { continueChat, updateChat } from "../lite-services/a2a/chat/continue-chat.js";
import log from "../utils/log.ts";

export function registerAgentChatsEndpoints(app: Express) {
  const store = resolveAgentChatsStore();

  app.post("/api/agent-chats/continue", authenticate, async (req: any, res) => {
    const uid = req.user.uid as string;
    const agentDid = String(req.body?.agentDid ?? "");
    const peerDid = String(req.body?.peerDid ?? "");
    const rewind = Boolean(req.body?.rewind ?? false);

    if (!agentDid || !peerDid) {
      return res.status(400).json({ error: "agentDid and peerDid are required" });
    }

    try {
      const owner = await ensureAgentOwnerInGoodStanding(agentDid);
      if (String(owner.uid) !== String(uid)) {
        log.info( `continueChat() for ${agentDid} received request from ${prettyJson(req.user)} but agent owner is ${prettyJson(owner)}` );
        return res.status(403).json({ error: "Forbidden" });
      }

      const result = await continueChat({
        uid,
        agentDid,
        peerDid,
        envelopeOptions: {
          posthaste: true,
          ...(rewind ? { rewind: true } : {}),
        }
      });

      return res.json({ messages: result.messages });
    } catch (e) {
      console.error("[API] POST /api/agent-chats/continue", e);
      return res.status(500).json({ error: "Failed to continue agent chat" });
    }
  });

  app.put("/api/agent-chats/like", authenticate, async (req: any, res) => {
    const uid = req.user.uid as string;
    const agentDid = String(req.body?.agentDid ?? "");
    const peerDid = String(req.body?.peerDid ?? "");
    const like = req.body?.like;
    if( like !== true && like !== false && like !== null ) {
      return res.status(400).json({ error: "like must be true, false, or null" });
    }
    if (!agentDid || !peerDid) {
      return res.status(400).json({ error: "agentDid and peerDid are required" });
    }

    try {
      await updateChat({ 
        uid,
        agentDid,
        peerDid,
        chatUpdate: {
          agentResolution: {
            like,
          },
        },
        replyMetadata: {
          timestamp: new Date().toISOString(),
          resolution: {
            like,
          },
        }
      });

      return res.json({ success: true });
    } catch(error) {
      console.error("[API] PUT /api/agent-chats/like", error);
      return res.status(500).json({ error: "Failed to update agent chat" });
    }
  });
}

