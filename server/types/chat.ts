import { UserID } from "@agentic-profile/common";

// The primary key for chats
export interface AgentPair {
    agentDid: string;
    peerDid: string;
}

export interface AgentChat extends AgentPair {
    uid: UserID; // for quick searches by user
    messages: Message[];
    agentResolution?: ChatResolution;
    peerResolution?: ChatResolution;
    /** ISO timestamp when the chat record was first created */
    created?: string;
    /** ISO timestamp when the chat was last updated */
    updated?: string;
}

export interface UpdateAgentChatParams {
    messages?: Message[];
    rewind?: string | true;  // true = rewind to start
    /**
     * `null` explicitly clears the stored resolution (removes the attribute).
     * `undefined` means "no change".
     */
    agentResolution?: ChatResolution | null;
    /**
     * `null` explicitly clears the stored resolution (removes the attribute).
     * `undefined` means "no change".
     */
    peerResolution?: ChatResolution | null;
}

export interface AgentChatsStore {
    read(agentPair: AgentPair): Promise<AgentChat | undefined>;
    update(uid: UserID, agentPair: AgentPair, params: UpdateAgentChatParams): Promise<void>;
    delete(agentPair: AgentPair): Promise<void>;
    /** Chats owned by this user (local agent is always the user’s agent). */
    listByUser(uid: UserID): Promise<AgentChat[]>;
}

export type ChatResolution = {
    like?: boolean | null;
    [key: string]: any;
}

//
// A2A v1.0
//

type TextPart = {
    text: string;
    mediaType?: 'text/plain';
    metadata?: any;
}

type UrlPart = {
    url: string;
    filename?: string;
    mediaType?: string;
    metadata?: any;
}

type RawPart = {
    raw: string;
    filename?: string;
    mediaType?: string;
    metadata?: any;
}

type DataPart = {
    data: any;
    mediaType?: 'application/json';
    metadata?: any;
}

export type Part = TextPart | UrlPart | RawPart | DataPart;

export type Message = {
    role: string | "ROLE_USER" | "ROLE_AGENT" | number;
    parts: Part[];
    metadata?: MessageMetadata;
}

export interface MessageMetadata {
    timestamp?: string;
    resolution?: ChatResolution;
    [key: string]: any;
}
