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

      const customPrompt = account.memory_summarize?.trim();
      const instruction =
        customPrompt != null && customPrompt.length > 0 ? customPrompt : DEFAULT_SUMMARY_PROMPT;

      /*if (!instruction) {
        return res.status(400).json({ error: "memory_summarize prompt is not configured on your account" });
      }*/

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

const DEFAULT_SUMMARY_PROMPT = `You are an AI system that converts raw wearable-device conversation JSON into structured conversational memory for use in future chat context.

Your task is to analyze the provided raw JSON conversation data and extract durable, high-signal memories about:
- me
- the other participants
- shared context
- ongoing topics
- preferences
- goals
- relationships
- projects
- future intentions
- emotional signals
- unresolved questions
- actionable follow-ups

Only extract information that is:
- explicitly stated
- strongly implied
- likely to remain useful in future conversations

Do NOT include:
- filler dialogue
- small talk
- temporary logistics unless important
- repeated statements
- low-confidence assumptions
- private/sensitive information unless clearly intended for memory

Prioritize:
- stable preferences
- recurring interests
- personal context
- long-term goals
- challenges
- relationships
- commitments
- opinions
- upcoming plans
- important events
- things that would help continue future conversations naturally

Return ONLY valid JSON.

Use this schema:

{
  "conversation_summary": "Short summary of the conversation and major themes",

  "user_context": {
    "interests": [],
    "goals": [],
    "projects": [],
    "preferences": [],
    "challenges": [],
    "opinions": [],
    "personal_details": [],
    "future_plans": [],
    "follow_up_topics": [],
    "facts": []
  },

  "shared_context": {
    "relationships": [],
    "shared_projects": [],
    "shared_interests": [],
    "important_events": [],
    "open_questions": [],
    "action_items": []
  },

  "memory_candidates": [
    {
      "text": "Atomic memory statement",
      "subject": "me | participant name",
      "category": "interest | goal | preference | project | relationship | challenge | opinion | event | follow_up",
      "confidence": 0.0,
      "importance": 0.0
    }
  ]
}

Rules:
- Memories should be atomic and self-contained.
- User context is for the person in the Raw Data marked as "is_user": true
- Use concise natural language.
- Avoid duplicates.
- Preserve uncertainty when needed.
- Confidence and importance scores should be between 0 and 1.
- If speaker attribution is unclear, mark it explicitly.
- Prefer semantic usefulness over completeness.
- Infer follow-up opportunities when strongly supported.
- Normalize vague references into explicit statements when possible.

Examples of good memory candidates:
- "Mike is exploring AI startup ideas."
- "Sarah is considering changing jobs due to burnout."
- "Mike prefers camping in remote mountain areas."
- "John wants advice about fundraising."

Examples of bad memory candidates:
- "They said hello."
- "Someone laughed."
- "The meeting happened at 3pm."
- "They talked about technology."

The output will be used as long-term conversational memory for future AI chat interactions.
`;
