import { Express } from "express";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import { admin, handleFirestoreError, OperationType } from "../firebase";
import { authenticate } from "../middleware";

export function registerChatEndpoints(app: Express, genAI: GoogleGenAI) {
  app.post("/api/chat", authenticate, async (req: any, res) => {
    console.log("[API] POST /api/chat");
    const { message } = req.body;
    const userId = req.user.uid;
    
    if (!message) return res.status(400).json({ error: "Message is required" });

    try {
      let instruction = "";
      try {
        instruction = fs.readFileSync("./instruction.md", "utf-8");
      } catch (e) {
        console.warn("instruction.md not found, using fallback");
      }
      
      if (userId) {
        try {
          const accountSnap = await admin.firestore().collection("accounts").doc(userId).get();
          if (accountSnap.exists) {
            const accountData = accountSnap.data();
            if (accountData?.chat_instruction) {
              instruction = accountData.chat_instruction;
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `accounts/${userId}`);
        }
      }
      
      let context = "";
      if (userId) {
        try {
          const memoriesSnapshot = await admin.firestore()
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
          
          if (memories) {
            context = `\n\nRecent conversation context (JSON format):\n${memories}`;
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, "memories");
        }
      }

      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `${instruction}${context}\n\nUser: ${message}`,
      });

      res.json({ reply: response.text });
    } catch (error) {
      console.error("Chat Error:", error);
      res.status(500).json({ error: "Failed to get AI response" });
    }
  });
}
