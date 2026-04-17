import { admin, adminDb, handleFirestoreError, OperationType } from "../../firebase.js";
import { Account, AccountStore, CreateAccountFields, UpdateAccountFields } from "./types.js";
import { UserID, DID } from "@agentic-profile/common";

const COLLECTION = "accounts";

export class FirestoreAccountStore implements AccountStore {
    private db = adminDb;

    async createAccount(account: CreateAccountFields): Promise<Account> {
        try {
            // We use the provided uid as the document ID
            await this.db.collection(COLLECTION).doc(String(account.uid)).set(account);
            return account as Account;
        } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, `${COLLECTION}/${account.uid}`);
            throw error;
        }
    }

    async readAccountByAgentDid(did: DID): Promise<Account | null> {
        try {
            const snapshot = await this.db.collection(COLLECTION).where("agentDid", "==", did).limit(1).get();
            if (snapshot.empty) return null;
            const doc = snapshot.docs[0];
            return { uid: doc.id as any, ...doc.data() } as Account;
        } catch (error) {
            handleFirestoreError(error, OperationType.GET, COLLECTION);
            throw error;
        }
    }

    async readAccountByEmail(email: string): Promise<Account | null> {
        try {
            const snapshot = await this.db.collection(COLLECTION).where("email", "==", email).limit(1).get();
            if (snapshot.empty) return null;
            const doc = snapshot.docs[0];
            return { uid: doc.id as any, ...doc.data() } as Account;
        } catch (error) {
            handleFirestoreError(error, OperationType.GET, COLLECTION);
            throw error;
        }
    }

    async readAccount(uid: UserID, _fields?: string): Promise<Account | null> {
        try {
            const doc = await this.db.collection(COLLECTION).doc(String(uid)).get();
            if (!doc.exists) return null;
            return { uid: doc.id as any, ...doc.data() } as Account;
        } catch (error) {
            handleFirestoreError(error, OperationType.GET, `${COLLECTION}/${uid}`);
            throw error;
        }
    }

    async listAccounts(): Promise<Account[]> {
        try {
            const snapshot = await this.db.collection(COLLECTION).get();
            return snapshot.docs.map(doc => ({ uid: doc.id as any, ...doc.data() } as Account));
        } catch (error) {
            handleFirestoreError(error, OperationType.LIST, COLLECTION);
            throw error;
        }
    }

    async updateAccount(uid: UserID, updates: UpdateAccountFields): Promise<void> {
        try {
            await this.db.collection(COLLECTION).doc(String(uid)).update(updates as any);
        } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION}/${uid}`);
            throw error;
        }
    }

    async deleteAccount(uid: UserID): Promise<void> {
        try {
            await this.db.collection(COLLECTION).doc(String(uid)).delete();
        } catch (error) {
            handleFirestoreError(error, OperationType.DELETE, `${COLLECTION}/${uid}`);
            throw error;
        }
    }

    async subtractCredit(uid: any, amount: number): Promise<void> {
        try {
            await this.db.collection(COLLECTION).doc(String(uid)).update({
                credits: admin.firestore.FieldValue.increment(-amount)
            });
        } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION}/${uid}`);
            throw error;
        }
    }
}
