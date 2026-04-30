import type { Express } from "express";
import { authenticate } from "../middleware.ts";
import { ensureAgentOwnerInGoodStanding } from "../lite-services/a2a/chat/misc.js";
import { resolveAgentChatsStore } from "../stores/agent-chats/index.ts";
import { continueChat, updateChat } from "../lite-services/a2a/chat/continue-chat.js";

export function registerAgentChatsEndpoints(app: Express) {
  const store = resolveAgentChatsStore();

  /*
  app.get("/api/agent-chats", authenticate, async (req: any, res) => {
    const uid = req.user.uid as string;
    const store = resolveAgentChatsStore();
    try {
      const chats = await store.listByUser(uid);
      chats.sort((a, b) => (b.updated ?? b.created ?? "").localeCompare(a.updated ?? a.created ?? ""));
      res.json({ chats });
    } catch (e) {
      console.error("[API] GET /api/agent-chats", e);
      res.status(500).json({ error: "Failed to list agent chats" });
    }
  });

  app.get("/api/agent-chats/detail", authenticate, async (req: any, res) => {
    const uid = req.user.uid as string;
    const agentDid = String(req.query.agentDid ?? "");
    const peerDid = String(req.query.peerDid ?? "");
    if (!agentDid || !peerDid) {
      return res.status(400).json({ error: "agentDid and peerDid are required" });
    }
    const store = resolveAgentChatsStore();
    try {
      const chat = await store.read({ agentDid, peerDid });
      if (!chat) return res.json({ chat: null });
      if (String((chat as any).uid) !== String(uid)) return res.json({ chat: null });
      return res.json({ chat });
    } catch (e) {
      console.error("[API] GET /api/agent-chats/detail", e);
      res.status(500).json({ error: "Failed to load agent chat" });
    }
  });

  /*
  app.delete("/api/agent-chats", authenticate, async (req: any, res) => {
    const uid = req.user.uid as string;
    const agentDid = String(req.query.agentDid ?? "");
    const peerDid = String(req.query.peerDid ?? "");
    if (!agentDid || !peerDid) {
      return res.status(400).json({ error: "agentDid and peerDid are required" });
    }
    const store = resolveAgentChatsStore();
    try {
      const chat = await store.read({ agentDid, peerDid });
      if (!chat) return res.json({ ok: true });
      if (String((chat as any).uid) !== String(uid)) return res.status(403).json({ error: "Forbidden" });
      await store.delete({ agentDid, peerDid });
      return res.json({ ok: true });
    } catch (e) {
      console.error("[API] DELETE /api/agent-chats", e);
      res.status(500).json({ error: "Failed to delete agent chat" });
    }
  });
  */

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

