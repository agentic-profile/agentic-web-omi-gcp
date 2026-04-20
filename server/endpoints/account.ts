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
        const token = req.user;

        const tokenName = typeof token?.name === "string" ? token.name.trim() : "";
        const tokenEmail = typeof token?.email === "string" ? token.email.trim() : "";
        const tokenPictureUrl = typeof token?.picture === "string" ? token.picture.trim() : "";

        const updates: Record<string, unknown> = {};
        if (tokenName && tokenName !== existing.name) updates.name = tokenName;
        if (tokenEmail && tokenEmail !== (existing.email || "")) updates.email = tokenEmail;
        if (tokenPictureUrl && tokenPictureUrl !== (existing.pictureUrl || "")) {
          updates.pictureUrl = tokenPictureUrl;
        }

        if (Object.keys(updates).length > 0) {
          await store.updateAccount(uid, updates as any);
        }

        return res.json({ created: false, uid, updated: Object.keys(updates) });
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
