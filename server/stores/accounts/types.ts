import { UserID, DID } from "@agentic-profile/common";

/*
    from Firebase:
        "name": { "type": "string" },
        "pictureUrl": { "type": "string" },
        "role": { "type": "string" },
        "chat_instruction": { "type": "string" },
        "memory_summarize": { "type": "string" },
        "credits": { "type": "number" },
        "did": { "type": "string", "description": "Decentralized ID" }
*/

// All fields.  User and Login are derived from this
export interface Account {
    uid: UserID;
    name: string;
    pictureUrl?: string;
    credits: number;
    role?: string;
    chat_instruction?: string;
    introduction?: string;
    memory_summarize?: string;
    agentDid?: DID;
}

/*
export interface WrappedHash {
    hash: string,
    salt: string,
    options: any
}*/

export interface CreateAccountFields {
    uid: UserID;
    name: string;
    pictureUrl?: string;
    credits: number;
    role?: string;
    chat_instruction?: string;
    introduction?: string;
    memory_summarize?: string;
    agentDid?: DID;
}

export interface UpdateAccountFields {
    name?: string;
    pictureUrl?: string;
    credits?: number;
    role?: string;
    chat_instruction?: string;
    introduction?: string;
    memory_summarize?: string;
    agentDid?: DID;
}

export interface AccountStore {
    createAccount( account: CreateAccountFields ): Promise<Account>;
    readAccountByAgentDid( did: DID ): Promise<Account | null>;
    readAccountByEmail( email: string ): Promise<Account | null>;
    readAccount( uid: UserID, fields?: string ): Promise<Account | null>;
    listAccounts(): Promise<Account[]>;
    updateAccount( uid: UserID, updates: UpdateAccountFields ): Promise<void>;
    deleteAccount( uid: UserID ): Promise<void>;
    subtractCredit( uid: UserID, amount: number ): Promise<void>;
}
