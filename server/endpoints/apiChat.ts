import { Express } from "express";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import { adminDb } from "../firebase";
import { authenticate } from "../middleware";
import { ensureAccountInGoodStanding } from "../lite-services/a2a/chat/misc.js";
import { Account } from "../stores/accounts/types";

export function registerChatEndpoints(app: Express, genAI: GoogleGenAI) {
  app.post("/api/chat", authenticate, async (req: any, res) => {
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
        .orderBy("created", "desc")
        .limit(100)
        .get();
      
      const memories = memoriesSnapshot.docs
        .map(doc => {
          const summary = doc.data().summary;
          return !summary || Object.keys(summary).length === 0 ? null : summary;
        })
        .filter(summary => summary !== null);

      const contents = `${instruction}\n\nMemories as JSON:\n${JSON.stringify(memories,null,2)}\n\nUser: ${message}`;
      console.log( 'contents:', contents );

      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents
      });

      res.json({ reply: response.text });
    } catch (error) {
      console.error("Chat Error:", error);
      res.status(500).json({ error: "Failed to get AI response" });
    }
  });
}
