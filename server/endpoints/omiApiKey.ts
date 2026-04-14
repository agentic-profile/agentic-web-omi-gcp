import { Express, Request } from "express";
import { admin, handleFirestoreError, OperationType } from "../firebase.ts";
import { authenticate } from "../middleware.ts";
import { generateBase64UrlKey } from "../utils/misc.ts";
import { appUrl } from "../utils/http.ts";

export function registerOmiApiKeyEndpoints(app: Express) {
  app.get("/omi/api-key", authenticate, async (req: Request, res) => {
    const userId = (req as any).user.uid;

    try {
      let keysSnapshot;
      try {
        keysSnapshot = await admin.firestore()
          .collection("apiKeys")
          .where("userId", "==", userId)
          .limit(1)
          .get();
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, "apiKeys");
        return;
      }

      let apiKey: string;
      if (keysSnapshot.empty) {
        apiKey = generateBase64UrlKey(16);
        try {
          await admin.firestore().collection("apiKeys").add({
            key: apiKey,
            userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, "apiKeys");
        }
      } else {
        apiKey = keysSnapshot.docs[0].data().key;
      }

      const webhookUrl = `${appUrl(req)}/omi/memory/${apiKey}`;
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
