import { AgentChatsStore } from "./types.js";
import { FirestoreAgentChatsStore } from "./firestore.js";

export function resolveAgentChatsStore(): AgentChatsStore {
  return new FirestoreAgentChatsStore();
}