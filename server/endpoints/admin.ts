import { Express, NextFunction, Request, Response } from "express";
import { authenticate, requireAdmin } from "../middleware.ts";
import { resolveAccountStore } from "../stores/accounts/index.ts";

const FIXUP_EMAIL = "mike@example.com";


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
