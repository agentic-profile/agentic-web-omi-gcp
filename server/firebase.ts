import "dotenv/config";
import { initializeApp as initializeClientApp } from "firebase/app";
import { getFirestore as getClientFirestore } from "firebase/firestore";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

let firebaseConfig: any = {};
try {
  if (fs.existsSync("./firebase-applet-config.json")) {
    firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
  } else {
    console.warn("firebase-applet-config.json not found. Firebase features may be limited.");
  }
} catch (e) {
  console.error("Error loading firebase-applet-config.json:", e);
}

// Initialize Firebase Client SDK
let dbInstance: any = null;
if (firebaseConfig.apiKey) {
  try {
    const clientApp = initializeClientApp(firebaseConfig);
    dbInstance = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId);
  } catch (e) {
    console.error("Error initializing Firebase Client SDK:", e);
  }
} else {
  console.warn("Firebase Client SDK not initialized due to missing config.");
}

export const db = dbInstance;

// Initialize Firebase Admin SDK
if (firebaseConfig.projectId) {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log(`[Firebase Admin] Initialized for project: ${firebaseConfig.projectId}`);
  }
} else {
  console.warn("Firebase Admin SDK not initialized due to missing projectId.");
}

export { admin };
const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
console.log(`[Firebase Admin] Using Firestore database: ${databaseId}`);
export const adminDb = getFirestore(databaseId);
adminDb.settings({ ignoreUndefinedProperties: true });

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

export type OperationTypeValues = typeof OperationType[keyof typeof OperationType];

export function handleFirestoreError(error: any, operationType: OperationTypeValues, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
