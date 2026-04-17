import { adminDb, handleFirestoreError, OperationType } from "../../firebase.js";
import type { UserID } from "@agentic-profile/common";
import type { AgentChat, AgentChatsStore, AgentPair, UpdateAgentChatParams } from "./types.js";
import { applyAgentChatUpdate, mergeWithAgentPair } from "./apply-agent-chat-update.js";

const COLLECTION = "agent_chats";

function agentPairToKey(agentPair: AgentPair): string {
  return agentPair.agentDid + "^" + agentPair.peerDid;
}

export class FirestoreAgentChatsStore implements AgentChatsStore {
  private db = adminDb;

  async read(agentPair: AgentPair): Promise<AgentChat | undefined> {
    const key = agentPairToKey(agentPair);
    try {
      const doc = await this.db.collection(COLLECTION).doc(key).get();
      if (!doc.exists) return undefined;
      return mergeWithAgentPair(doc.data() as Partial<AgentChat>, agentPair);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${COLLECTION}/${key}`);
      throw error;
    }
  }

  async update(uid: UserID, agentPair: AgentPair, params: UpdateAgentChatParams): Promise<void> {
    const key = agentPairToKey(agentPair);
    try {
      const docRef = this.db.collection(COLLECTION).doc(key);
      const snap = await docRef.get();
      const existing = snap.exists
        ? mergeWithAgentPair(snap.data() as Partial<AgentChat>, agentPair)
        : undefined;

      const next = applyAgentChatUpdate(existing, uid, agentPair, params);

      // Store uid as a string for easy equality queries across numeric/string UserID.
      const toWrite: AgentChat = { ...next, uid: String(next.uid) as any };
      await docRef.set(toWrite, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION}/${key}`);
      throw error;
    }
  }

  async delete(agentPair: AgentPair): Promise<void> {
    const key = agentPairToKey(agentPair);
    try {
      await this.db.collection(COLLECTION).doc(key).delete();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTION}/${key}`);
      throw error;
    }
  }

  async listByUser(uid: UserID): Promise<AgentChat[]> {
    try {
      const uidStr = String(uid);
      const snapshot = await this.db
        .collection(COLLECTION)
        .where("uid", "==", uidStr)
        .get();

      return snapshot.docs
        .map((d) => d.data() as Partial<AgentChat>)
        .map((stored) => {
          const agentDid = stored.agentDid ?? "";
          const peerDid = stored.peerDid ?? "";
          return mergeWithAgentPair(stored, { agentDid, peerDid });
        })
        .filter((c): c is AgentChat => c !== undefined);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, COLLECTION);
      throw error;
    }
  }
}
