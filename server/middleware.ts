import { Response, NextFunction } from "express";
import admin from "firebase-admin";
import { resolveAccountStore } from "./stores/accounts/index.ts";

export async function authenticate(req: any, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(401).json({ error: "Unauthorized" });
  }
}

/** Requires `authenticate` first; account must have `role === "admin"`. */
export async function requireAdmin(req: any, res: Response, next: NextFunction) {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const store = resolveAccountStore();
    const account = await store.readAccount(uid);
    if (!account || account.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  } catch (error) {
    console.error("requireAdmin error:", error);
    res.status(500).json({ error: "Authorization check failed" });
  }
}
