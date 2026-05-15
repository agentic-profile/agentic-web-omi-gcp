import { Express } from "express";
import { GoogleGenAI } from "@google/genai";
import { admin, adminDb, handleFirestoreError, OperationType } from "../firebase.ts";
import { authenticate } from "../middleware.ts";
import { ensureAccountInGoodStanding } from "../lite-services/a2a/chat/misc.js";
import { Account } from "../stores/accounts/types.ts";

export function registerOmiMemoryEndpoints(app: Express, genAI: GoogleGenAI) {
  app.get("/omi/memory/:key/summarize", authenticate, async (req: any, res) => {
    const { key } = req.params;
    const userId = req.user.uid as string;

    if (!key) {
      return res.status(400).json({ error: "Memory key is required" });
    }

    try {
      const accountSnap = await adminDb.collection("accounts").doc(userId).get();
      if (!accountSnap.exists) {
        return res.status(404).json({ error: "Account not found" });
      }

      const account = accountSnap.data() as Account;
      ensureAccountInGoodStanding(account);

      const instruction = account.memory_summarize?.trim();
      if (!instruction) {
        return res.status(400).json({ error: "memory_summarize prompt is not configured on your account" });
      }

      let memorySnap;
      try {
        memorySnap = await adminDb.collection("memories").doc(key).get();
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, "memories");
        return;
      }

      if (!memorySnap.exists) {
        return res.status(404).json({ error: "Memory not found" });
      }

      const memory = memorySnap.data();
      if (memory?.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const raw = memory?.raw;
      if (!raw || (typeof raw === "object" && Object.keys(raw).length === 0)) {
        return res.status(400).json({ error: "Memory has no raw data to summarize" });
      }

      let summary: unknown = {};
      try {
        const response = await genAI.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Raw Data:\n${JSON.stringify(raw)}`,
          config: {
            systemInstruction: instruction,
            responseMimeType: "application/json",
          },
        });

        summary = JSON.parse(response.text || "{}");
      } catch (aiError) {
        console.error("AI Summary generation failed:", aiError);
        summary = {
          error: "AI summarization failed",
          raw_text: typeof raw === "object" && raw !== null && "text" in raw ? (raw as { text?: string }).text : undefined,
        };
      }

      try {
        await adminDb.collection("memories").doc(key).update({
          summary,
          summarized: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, "memories");
        return;
      }

      res.json({summary});
    } catch (error) {
      console.error("Omi memory summarize error:", error);
      res.status(500).json({ error: "Failed to summarize memory" });
    }
  });

  app.post("/omi/memory/:key", async (req, res) => {
    const { key } = req.params;
    console.log(`POST ${req.originalUrl}`, key, JSON.stringify(req.body));
    const raw = req.body;

    if (!key || !raw || Object.keys(raw).length === 0) {
      return res.status(400).json({ error: "Key and raw JSON body are required" });
    }

    try {
      let keysSnapshot;
      try {
        keysSnapshot = await adminDb
          .collection("apiKeys")
          .where("key", "==", key)
          .limit(1)
          .get();
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, "apiKeys");
        return; // handleFirestoreError throws, but for TS completeness
      }

      if (keysSnapshot.empty) {
        console.log("Invalid memory API Key", key );
        return res.status(401).json({ error: "Invalid memory API Key" });
      }

      const userId = keysSnapshot.docs[0].data().userId;

      let summary = {};

      if( userId === -1 ) {
        try {
          const response = await genAI.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Analyze this raw JSON data from an Omi wearable device and create a structured summary JSON object. 
            Focus on key events, people mentioned, and emotional tone.
            
            Raw Data: ${JSON.stringify(raw)}
            
            Return a JSON object with fields like: "main_topic", "key_points" (array), "sentiment", "entities" (array).`,
            config: {
              responseMimeType: "application/json"
            }
          });
          
          summary = JSON.parse(response.text || "{}");
        } catch (aiError) {
          console.error("AI Summary generation failed:", aiError);
          summary = { error: "AI summarization failed", raw_text: raw.text || "No text found" };
        }
      }

      try {
        await adminDb.collection("memories").add({
          raw,
          summary,
          userId,
          created: admin.firestore.FieldValue.serverTimestamp(),
          summarized: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, "memories");
      }

      res.json({ status: "success" });
    } catch (error) {
      console.error("Omi memory webhook error:", error);
      res.status(500).json({ error: "Failed to store omi memory" });
    }
  });
}
