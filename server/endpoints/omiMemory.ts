import { Express } from "express";
import { GoogleGenAI } from "@google/genai";
import { query, collection, where, limit, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase.ts";

export function registerOmiMemoryEndpoints(app: Express, genAI: GoogleGenAI) {
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
        const q = query(
          collection(db, "apiKeys"),
          where("key", "==", key),
          limit(1)
        );
        keysSnapshot = await getDocs(q);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, "apiKeys");
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
        await addDoc(collection(db, "memories"), {
          raw,
          summary,
          userId,
          created: serverTimestamp(),
          summarized: serverTimestamp(),
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
