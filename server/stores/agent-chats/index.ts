import { AgentChatsStore } from "../../types/chat.js";
import { FirestoreAgentChatsStore } from "./firestore.js";

export function resolveAgentChatsStore(): AgentChatsStore {
  return new FirestoreAgentChatsStore();
}