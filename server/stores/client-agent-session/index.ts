import { ClientAgentSessionStore } from "./types.js";
import { FirestoreClientAgentSessionStore } from "./firestore.js";

let store: ClientAgentSessionStore | null = null;

export function resolveClientAgentSessionStore(): ClientAgentSessionStore {
  if (!store) {
    store = new FirestoreClientAgentSessionStore();
  }
  return store;
}
