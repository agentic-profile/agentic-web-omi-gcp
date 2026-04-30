import { AgentChat, AgentChatsStore, AgentPair, UpdateAgentChatParams } from "../../types/chat.js";
import type { UserID } from "@agentic-profile/common";
import { applyAgentChatUpdate } from "./apply-agent-chat-update.js";

const agentChats: Map<string, AgentChat> = new Map();

export const agentChatsMemoryStore: AgentChatsStore = {
    read(agentPair: AgentPair): Promise<AgentChat | undefined> {
        return Promise.resolve(agentChats.get(agentPairToKey(agentPair)));
    },
    update(
        uid: UserID,
        agentPair: AgentPair,
        params: UpdateAgentChatParams
    ): Promise<void> {
        const key = agentPairToKey(agentPair);
        const existing = agentChats.get(key);
        agentChats.set(key, applyAgentChatUpdate(existing, uid, agentPair, params));
        return Promise.resolve();
    },
    delete(agentPair: AgentPair): Promise<void> {
        agentChats.delete(agentPairToKey(agentPair));
        return Promise.resolve();
    },
    listByUser(uid: UserID): Promise<AgentChat[]> {
        const uidStr = String(uid);
        const out: AgentChat[] = [];
        for (const chat of agentChats.values()) {
            if (String(chat.uid) === uidStr) out.push(chat);
        }
        return Promise.resolve(out);
    },
};

function agentPairToKey(agentPair: AgentPair): string {
    return agentPair.agentDid + "^" + agentPair.peerDid;
}
