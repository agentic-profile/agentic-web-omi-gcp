import { Express } from "express";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import { adminDb } from "../firebase";
import { authenticate } from "../middleware";
import { ensureAccountInGoodStanding, ensureAgentOwnerInGoodStanding } from "../lite-services/a2a/chat/misc.js";
import { Account } from "../stores/accounts/types";

export function registerChatEndpoints(app: Express, genAI: GoogleGenAI) {
  app.post("/api/chat", authenticate, async (req: any, res) => {
    console.log("[API] POST /api/chat");
    const { message } = req.body;
    const userId = req.user.uid;
    
    if (!message)
      return res.status(400).json({ error: "Message is required" });

    if (!userId)
      return res.status(400).json({ error: "User ID is required" });

    try {
      const accountSnap = await adminDb.collection("accounts").doc(userId).get();
      if (!accountSnap.exists)
        throw new Error(`Account not found for ${userId}`);

      const account = accountSnap.data() as Account;
      ensureAccountInGoodStanding(account);

      let instruction = account.chat_instruction;
      if (!instruction)
        instruction = fs.readFileSync("./instruction.md", "utf-8");
      if (!instruction)
        throw new Error(`Neither custom nor default chat instruction found for ${userId}`);

      const memoriesSnapshot = await adminDb
        .collection("memories")
        .where("userId", "==", userId)
        .limit(10)
        .get();
      
      const memories = memoriesSnapshot.docs
        .map(doc => {
          const data = doc.data();
          return JSON.stringify(data.summary || data.raw || data.text || "");
        })
        .join("\n---\n");
      

      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `${instruction}\n\n${memories}\n\nUser: ${message}`,
      });

      res.json({ reply: response.text });
    } catch (error) {
      console.error("Chat Error:", error);
      res.status(500).json({ error: "Failed to get AI response" });
    }
  });
}
