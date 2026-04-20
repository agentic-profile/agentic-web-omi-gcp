import { Express } from "express";
import { authenticate } from "../middleware.ts";
import { resolveAccountStore } from "../stores/accounts/index.ts";

function initialCredits(): number {
  const raw = process.env.INITIAL_ACCOUNT_CREDITS;
  if (raw === undefined || raw === "") return 1;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

/** Creates the Firestore account row on first login; Admin SDK — authoritative credits and role. */
export function registerAccountEndpoints(app: Express) {
  app.post("/api/account/ensure", authenticate, async (req: any, res) => {
    console.log("registerAccountEndpoints", req.user);
    const uid = req.user.uid as string;
    const store = resolveAccountStore();
    try {
      const existing = await store.readAccount(uid);
      if (existing) {
        return res.json({ created: false, uid });
      }
      const token = req.user;
      await store.createAccount({
        uid,
        name: (token.name as string) || "User",
        pictureUrl: (token.picture as string) || "",
        ...(typeof token.email === "string" && token.email
          ? { email: token.email }
          : {}),
        role: "user",
        credits: initialCredits()
      });
      return res.json({ created: true, uid });
    } catch (e) {
      console.error("[API] POST /api/account/ensure", e);
      res.status(500).json({ error: "Failed to provision account" });
    }
  });
}
