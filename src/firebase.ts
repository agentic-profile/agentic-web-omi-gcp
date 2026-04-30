import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";
import { usingEmulators } from "./auth/mode";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

/**
 * Firebase emulators are opt-in. Otherwise, running the web app on localhost
 * will try to refresh tokens against `localhost:9099/securetoken.googleapis.com/...`
 * and break auth when emulators aren't running.
 */
if (typeof window !== "undefined" && usingEmulators()) {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
}
