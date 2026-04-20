import { Express, NextFunction, Request, Response } from "express";
import { authenticate, requireAdmin } from "../middleware.ts";
import { resolveAccountStore } from "../stores/accounts/index.ts";
import { admin, adminDb } from "../firebase.ts";

const FIXUP_EMAIL = "mike@mobido.com";

async function deleteQueryInBatches(query: FirebaseFirestore.Query): Promise<number> {
  let deleted = 0;
  while (true) {
    const snap = await query.limit(500).get();
    if (snap.empty) return deleted;
    const batch = adminDb.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    deleted += snap.size;
  }
}


export function registerAdminEndpoints(app: Express) {
  const store = resolveAccountStore();

  app.get("/api/admin/accounts", authenticate, requireAdmin, async (_req, res) => {
    try {
      const accounts = await store.listAccounts();
      res.json({ accounts });
    } catch (e) {
      console.error("[API] GET /api/admin/accounts", e);
      res.status(500).json({ error: "Failed to list accounts" });
    }
  });

  app.post(
    "/api/admin/accounts/:uid/credits",
    authenticate,
    requireAdmin,
    async (req, res) => {
      const { uid } = req.params;
      const amount = Number(req.body?.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res
          .status(400)
          .json({ error: "Body must include amount: a positive number" });
      }
      try {
        const existing = await store.readAccount(uid);
        if (!existing) {
          return res.status(404).json({ error: "Account not found" });
        }
        const current = Number(existing.credits);
        const base = Number.isFinite(current) ? current : 0;
        const newCredits = base + amount;
        await store.updateAccount(uid, { credits: newCredits });
        res.json({ ok: true, uid, credits: newCredits });
      } catch (e) {
        console.error("[API] POST /api/admin/accounts/:uid/credits", e);
        res.status(500).json({ error: "Failed to add credits" });
      }
    }
  );

  app.post(
    "/api/admin/accounts/:uid/role",
    authenticate,
    requireAdmin,
    async (req, res) => {
      const { uid } = req.params;
      const role = req.body?.role;
      if (role !== "admin" && role !== "user") {
        return res.status(400).json({ error: 'Body must include role: "admin" | "user"' });
      }
      try {
        const existing = await store.readAccount(uid);
        if (!existing) {
          return res.status(404).json({ error: "Account not found" });
        }
        await store.updateAccount(uid, { role });
        res.json({ ok: true, uid, role });
      } catch (e) {
        console.error("[API] POST /api/admin/accounts/:uid/role", e);
        res.status(500).json({ error: "Failed to update role" });
      }
    }
  );

  app.post(
    "/api/admin/accounts/:uid/disabled",
    authenticate,
    requireAdmin,
    async (req, res) => {
      const { uid } = req.params;
      const disabled = req.body?.disabled;
      if (typeof disabled !== "boolean") {
        return res
          .status(400)
          .json({ error: "Body must include disabled: boolean" });
      }
      try {
        const existing = await store.readAccount(uid);
        if (!existing) {
          return res.status(404).json({ error: "Account not found" });
        }
        await store.updateAccount(uid, { disabled });
        res.json({ ok: true, uid, disabled });
      } catch (e) {
        console.error("[API] POST /api/admin/accounts/:uid/disabled", e);
        res.status(500).json({ error: "Failed to update disabled flag" });
      }
    }
  );

  app.delete(
    "/api/admin/accounts/:uid",
    authenticate,
    requireAdmin,
    async (req: Request, res: Response, _next: NextFunction) => {
      const { uid } = req.params;
      if (!uid || typeof uid !== "string") {
        return res.status(400).json({ error: "Missing uid" });
      }

      try {
        const existing = await store.readAccount(uid as any);
        if (!existing) {
          return res.status(404).json({ error: "Account not found" });
        }

        const [memoriesDeleted, apiKeysDeleted, otpsDeleted] = await Promise.all([
          deleteQueryInBatches(adminDb.collection("memories").where("userId", "==", uid)),
          deleteQueryInBatches(adminDb.collection("apiKeys").where("userId", "==", uid)),
          deleteQueryInBatches(adminDb.collection("otps").where("userId", "==", uid)),
        ]);

        await store.deleteAccount(uid as any);

        let authDeleted = false;
        try {
          await admin.auth().deleteUser(uid);
          authDeleted = true;
        } catch (e: any) {
          if (e?.code !== "auth/user-not-found") throw e;
        }

        return res.json({
          ok: true,
          uid,
          deleted: {
            memories: memoriesDeleted,
            apiKeys: apiKeysDeleted,
            otps: otpsDeleted,
            accountDoc: 1,
            authUser: authDeleted ? 1 : 0,
          },
        });
      } catch (e) {
        console.error("[API] DELETE /api/admin/accounts/:uid", e);
        return res.status(500).json({ error: "Failed to delete account" });
      }
    }
  );

  app.get("/api/admin/fixup", async (_req, res) => {
    try {
      const account = await store.readAccountByEmail(FIXUP_EMAIL);
      if (!account) {
        return res.status(404).json({
          error: `No account with email ${FIXUP_EMAIL}`,
        });
      }
      await store.updateAccount(account.uid, { role: "admin" });
      res.json({
        ok: true,
        email: FIXUP_EMAIL,
        role: "admin",
      });
    } catch (e) {
      console.error("[API] POST /api/admin/fixup", e);
      res.status(500).json({ error: "Failed to apply fixup" });
    }
  });
}
