import { Express, Request } from "express";
import crypto from "crypto";
import { admin, handleFirestoreError, OperationType } from "../firebase.ts";
import { authenticate } from "../middleware.ts";
import { appUrl } from "../utils/http.ts";

export function registerPublishEndpoints(app: Express) {
  app.get("/publish/payload", authenticate, async (req: Request, res) => {
    console.log("[API] GET /publish/payload");
    const userId = (req as any).user.uid;

    try {
      const otp = crypto.randomBytes(16).toString("base64url");
      
      try {
        await admin.firestore().collection("otps").add({
          otp,
          userId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          used: false
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, "otps");
      }

      const baseUrl = appUrl(req);
      console.log(`[API] Generated payload for ${userId} with callback: ${baseUrl}/publish/callback`);

      const payload = {
        type: "agent",
        callback: {
          url: `${baseUrl}/publish/callback`,
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: {
            otp
          },
          merge: "body-json:agentDid"
        },
        service: {
          id: "#friends",
          name: "Friendship Agent",
          type: "a2a/lite",
          serviceEndpoint: `${baseUrl}/a2a`,
          capabilityInvocation: [
            "did:web:agents-api.matchwise.ai#system-key"
          ]
        }
      };

      res.json(payload);
    } catch (error) {
      console.error("Publish Payload Error:", error);
      res.status(500).json({ error: "Failed to generate publish payload" });
    }
  });

  app.post("/publish/callback", async (req, res) => {
    const { otp, agentDid } = req.body;
    if (!otp || !agentDid) {
      console.error("[WEBHOOK] Missing otp or agentDid in body", JSON.stringify(req.body));
      return res.status(400).json({ error: "otp and agentDid are required" });
    }

    try {
      const otpSnapshot = await admin.firestore()
        .collection("otps")
        .where("otp", "==", otp)
        .limit(1)
        .get();

      if (otpSnapshot.empty) {
        console.error(`[WEBHOOK] OTP not found: ${otp}`);
        return res.status(401).json({ error: "Invalid or expired OTP" });
      }

      const otpDoc = otpSnapshot.docs[0];
      const { userId } = otpDoc.data();

      try {
        await admin.firestore().collection("accounts").doc(userId).update({
          agentDid: agentDid
        });
        console.log(`[WEBHOOK] Updated account ${userId} with agentDid: ${agentDid}`);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `accounts/${userId}`);
      }

      try {
        await otpDoc.ref.update({
          used: true,
          usedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `otps/${otpDoc.id}`);
      }

      res.status(204).send();
    } catch (error) {
      console.error("Publish Callback Error:", error);
      res.status(500).json({ error: "Failed to process callback" });
    }
  });
}
