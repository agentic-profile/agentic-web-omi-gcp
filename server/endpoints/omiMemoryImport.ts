import { Express } from "express";
import { authenticate } from "../middleware.ts";
import { admin, adminDb, handleFirestoreError, OperationType } from "../firebase.ts";

type ImportedMemory = {
  id?: string;
  raw?: unknown;
  summary?: unknown;
  text?: string;
  created?: unknown;
  summarized?: unknown;
  timestamp?: unknown;
  userId?: string;
};

function parseTimestamp(value: unknown): admin.firestore.Timestamp {
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return admin.firestore.Timestamp.fromDate(d);
    }
  }
  if (value && typeof value === "object") {
    const v = value as { _seconds?: number; seconds?: number; _nanoseconds?: number; nanoseconds?: number };
    const seconds = v._seconds ?? v.seconds;
    if (typeof seconds === "number") {
      const nanos = v._nanoseconds ?? v.nanoseconds ?? 0;
      return new admin.firestore.Timestamp(seconds, nanos);
    }
  }
  return admin.firestore.Timestamp.now();
}

function normalizeMemories(body: unknown): ImportedMemory[] {
  if (Array.isArray(body)) return body as ImportedMemory[];
  if (body && typeof body === "object" && Array.isArray((body as { memories?: unknown }).memories)) {
    return (body as { memories: ImportedMemory[] }).memories;
  }
  return [];
}

export function registerOmiMemoryImportEndpoints(app: Express) {
  app.post("/api/memories/import", authenticate, async (req: any, res) => {
    const uid = req.user.uid as string;
    const items = normalizeMemories(req.body);

    if (items.length === 0) {
      return res.status(400).json({ error: "Expected a JSON object with a memories array" });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    const BATCH_SIZE = 400;

    try {
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const chunk = items.slice(i, i + BATCH_SIZE);
        const batch = adminDb.batch();

        for (const item of chunk) {
          const id = typeof item.id === "string" ? item.id.trim() : "";
          if (!id) {
            skipped++;
            errors.push("Skipped a memory with no id");
            continue;
          }

          const ref = adminDb.collection("memories").doc(id);
          const existing = await ref.get();
          if (existing.exists && existing.data()?.userId !== uid) {
            skipped++;
            errors.push(`Skipped memory ${id}: belongs to another user`);
            continue;
          }

          const payload = {
            raw: item.raw ?? (item.text != null ? { text: item.text } : {}),
            summary: item.summary ?? {},
            userId: uid,
            created: parseTimestamp(item.created ?? item.timestamp),
            summarized: parseTimestamp(item.summarized ?? item.created ?? item.timestamp),
          };

          batch.set(ref, payload, { merge: true });
          if (existing.exists) updated++;
          else created++;
        }

        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, "memories");
        }
      }

      res.json({ created, updated, skipped, total: items.length, errors: errors.slice(0, 20) });
    } catch (error) {
      console.error("Memory import error:", error);
      res.status(500).json({ error: "Failed to import memories" });
    }
  });
}
