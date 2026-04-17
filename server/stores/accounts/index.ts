import { FirestoreAccountStore } from "./firestore.js";
import { AccountStore } from "./types.js";

let store: AccountStore | null = null;

export function resolveAccountStore(): AccountStore {
  if (!store) {
    store = new FirestoreAccountStore();
  }
  return store;
}
