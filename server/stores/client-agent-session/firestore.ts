import { ClientAgentSessionUpdate } from "@agentic-profile/auth";
import { admin, adminDb, handleFirestoreError, OperationType } from "../../firebase.js";
import { ClientAgentSessionStore } from "./types.js";

const COLLECTION = "client_agent_sessions";

export class FirestoreClientAgentSessionStore implements ClientAgentSessionStore {
    private db = adminDb;

    async create(challenge: string): Promise<any> {
        try {
            // Firestore requires a plain object; createChallenge passes the secret string only.
            const docRef = await this.db.collection(COLLECTION).add({
                challenge,
                created: admin.firestore.FieldValue.serverTimestamp(),
            });
            return docRef.id;
        } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, COLLECTION);
            throw error;
        }
    }

    async read(id: string): Promise<any | null> {
        try {
            const doc = await this.db.collection(COLLECTION).doc(id).get();
            if (!doc.exists) return null;
            return { id: doc.id, ...doc.data() } as any;
        } catch (error) {
            handleFirestoreError(error, OperationType.GET, `${COLLECTION}/${id}`);
            throw error;
        }
    }

    async update(id: string, updates: ClientAgentSessionUpdate): Promise<boolean> {
        try {
            const docRef = this.db.collection(COLLECTION).doc(id);
            const snap = await docRef.get();
            if (!snap.exists) return false;

            const payload: Partial<ClientAgentSessionUpdate> = {};
            if (updates.agentDid !== undefined) payload.agentDid = updates.agentDid;
            if (updates.authToken !== undefined) payload.authToken = updates.authToken;

            if (Object.keys(payload).length === 0) return true;

            await docRef.update(payload);
            return true;
        } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION}/${id}`);
            throw error;
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.db.collection(COLLECTION).doc(id).delete();
        } catch (error) {
            handleFirestoreError(error, OperationType.DELETE, `${COLLECTION}/${id}`);
            throw error;
        }
    }
}
