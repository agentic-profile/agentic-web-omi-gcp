import { admin, adminDb, handleFirestoreError, OperationType } from "../../firebase.js";
import { ClientAgentSessionStore } from "./types.js";

const COLLECTION = "client_agent_sessions";

export class FirestoreClientAgentSessionStore implements ClientAgentSessionStore {
    private db = adminDb;

    async create(session: any): Promise<any> {
        try {
            const docRef = await this.db.collection(COLLECTION).add(session);
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

    async update(id: string, session: any): Promise<boolean> {
        try {
            await this.db.collection(COLLECTION).doc(id).update(session);
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
