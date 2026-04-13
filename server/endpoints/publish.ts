import { Express } from "express";
import { collection, addDoc, serverTimestamp, query, where, limit, getDocs, updateDoc, doc } from "firebase/firestore";
import crypto from "crypto";
import { db, handleFirestoreError, OperationType } from "../firebase.ts";
import { authenticate } from "../middleware.ts";

export function registerPublishEndpoints(app: Express) {
  app.get("/publish/payload", authenticate, async (req: any, res) => {
    console.log("[API] GET /publish/payload");
    const userId = req.user.uid;

    try {
      const otp = crypto.randomBytes(16).toString("base64url");
      
      try {
        await addDoc(collection(db, "otps"), {
          otp,
          userId,
          createdAt: serverTimestamp(),
          used: false
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, "otps");
      }

      const protocol = req.headers["x-forwarded-proto"] || "https";
      let hostHeader = req.headers["x-forwarded-host"] || req.headers.host || "";
      let host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
      
      if (host.includes("ais-dev-")) {
        host = host.replace("ais-dev-", "ais-pre-");
      }
      
      const appUrl = process.env.APP_URL || `${protocol}://${host}`;
      console.log(`[API] Generated payload for ${userId} with callback: ${appUrl}/publish/callback`);

      const payload = {
        type: "agent",
        callback: {
          url: `${appUrl}/publish/callback`,
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
          serviceEndpoint: `${appUrl}/a2a`,
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
      const q = query(
        collection(db, "otps"),
        where("otp", "==", otp),
        limit(1)
      );
      const otpSnapshot = await getDocs(q);

      if (otpSnapshot.empty) {
        console.error(`[WEBHOOK] OTP not found: ${otp}`);
        return res.status(401).json({ error: "Invalid or expired OTP" });
      }

      const otpDoc = otpSnapshot.docs[0];
      const { userId } = otpDoc.data();

      try {
        await updateDoc(doc(db, "accounts", userId), {
          agentDid: agentDid
        });
        console.log(`[WEBHOOK] Updated account ${userId} with agentDid: ${agentDid}`);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `accounts/${userId}`);
      }

      try {
        await updateDoc(otpDoc.ref, {
          used: true,
          usedAt: serverTimestamp()
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
