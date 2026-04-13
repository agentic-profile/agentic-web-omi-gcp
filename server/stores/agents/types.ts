import { UserID } from "@agentic-profile/common";

export interface Agent {
    uid: UserID;
    kind: string;
    agentDid?: string;  // must be unique to uid:kind, or undefined
    instruction?: string;
    instructionId?: string; // selected variation
    summary?: string;
    paused?: boolean
}

export interface AgentKey {
    uid: UserID;
    kind: string;
}

export interface AgentUpdates {
    agentDid?: string;
    instruction?: string | null;
    instructionId?: string | null; // when set, instruction will be null/undefined
    summary?: string | null;
    paused?: boolean;
}

export interface AgentsStore {
    upsert(agentKey: AgentKey, updates: AgentUpdates): Promise<Agent>;
    read(agentKey: AgentKey): Promise<Agent | undefined>;
    readByDid(agentDid: string): Promise<Agent | undefined>;
    list(uid: UserID): Promise<Agent[]>;
    delete(agentKey: AgentKey): Promise<void>;
}
