import { Express } from "express";
import { query, collection, where, limit, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase.ts";
import { authenticate } from "../middleware.ts";
import { generateBase64UrlKey } from "../utils/misc.ts";

export function registerOmiApiKeyEndpoints(app: Express) {
  app.get("/omi/api-key", authenticate, async (req: any, res) => {
    console.log("[API] GET /omi/api-key");
    const userId = req.user.uid;

    try {
      let keysSnapshot;
      try {
        const q = query(
          collection(db, "apiKeys"),
          where("userId", "==", userId),
          limit(1)
        );
        keysSnapshot = await getDocs(q);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, "apiKeys");
      }

      let apiKey: string;
      if (keysSnapshot.empty) {
        apiKey = generateBase64UrlKey(16);
        try {
          await addDoc(collection(db, "apiKeys"), {
            key: apiKey,
            userId,
            createdAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, "apiKeys");
        }
      } else {
        apiKey = keysSnapshot.docs[0].data().key;
      }

      const protocol = req.headers["x-forwarded-proto"] || "http";
      const host = req.headers.host;
      const appUrl = process.env.APP_URL || `${protocol}://${host}`;
      const webhookUrl = `${appUrl}/omi/memory/${apiKey}`;

      res.json({ apiKey, webhookUrl });
    } catch (error: any) {
      console.error("Firestore Error in /omi/api-key:", error);
      res.status(500).json({ 
        error: "Failed to manage API key", 
        details: error?.message || String(error) 
      });
    }
  });
}
