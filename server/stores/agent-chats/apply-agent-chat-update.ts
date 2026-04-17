import { UserID } from "@agentic-profile/common";
import {
    AgentChat,
    AgentPair,
    Message,
    UpdateAgentChatParams,
} from "./types.js";

/**
 * Merge a persisted document with the lookup pair. Older rows only stored
 * `agentDid` plus a composite `agentPair` key, not `peerDid`.
 */
export function mergeWithAgentPair(
    stored: Partial<AgentChat> | undefined,
    agentPair: AgentPair
): AgentChat | undefined {
    if (!stored || stored.uid === undefined) {
        return undefined;
    }
    return {
        uid: stored.uid,
        agentDid: stored.agentDid ?? agentPair.agentDid,
        peerDid: stored.peerDid ?? agentPair.peerDid,
        messages: Array.isArray(stored.messages) ? stored.messages : [],
        ...(stored.agentResolution !== undefined
            ? { agentResolution: stored.agentResolution }
            : {}),
        ...(stored.peerResolution !== undefined
            ? { peerResolution: stored.peerResolution }
            : {}),
        ...(stored.created !== undefined ? { created: stored.created } : {}),
        ...(stored.updated !== undefined ? { updated: stored.updated } : {}),
    };
}

function truncateMessagesAtRewind(
    messages: Message[],
    rewind: string | Date
): Message[] {
    const asDate =
        rewind instanceof Date
            ? rewind
            : !Number.isNaN(Date.parse(rewind))
              ? new Date(rewind)
              : undefined;
    if (asDate !== undefined) {
        const cutoff = asDate.getTime();
        return messages.filter((m) => {
            const t = m.metadata?.timestamp ?? m.metadata?.createdAt;
            if (t == null) {
                return true;
            }
            return new Date(t).getTime() < cutoff;
        });
    }
    const idx = messages.findIndex(
        (m) =>
            m.metadata?.id === rewind || m.metadata?.messageId === rewind
    );
    return idx >= 0 ? messages.slice(0, idx) : messages;
}

function mergeMessages(
    existing: Message[],
    params: UpdateAgentChatParams
): Message[] {
    const { messages, rewind } = params;

    if (rewind === true) {
        return messages ?? [];
    }

    if (typeof rewind === "string") {
        const truncated = truncateMessagesAtRewind(existing, rewind);
        return messages !== undefined ? [...truncated, ...messages] : truncated;
    }

    if (messages === undefined) {
        return existing;
    }

    return [...existing, ...messages];
}

/**
 * Applies an incremental update to a chat, merging messages (with rewind rules)
 * and optional resolution fields.
 */
export function applyAgentChatUpdate(
    existing: AgentChat | undefined,
    uid: UserID,
    agentPair: AgentPair,
    params: UpdateAgentChatParams
): AgentChat {
    const prev = existing?.messages ?? [];
    const messages = mergeMessages(prev, params);

    const agentResolution =
        params.agentResolution === null
            ? undefined
            : params.agentResolution !== undefined
              ? params.agentResolution
              : existing?.agentResolution;

    const peerResolution =
        params.peerResolution === null
            ? undefined
            : params.peerResolution !== undefined
              ? params.peerResolution
              : existing?.peerResolution;

    const now = new Date().toISOString();
    return {
        uid,
        agentDid: agentPair.agentDid,
        peerDid: agentPair.peerDid,
        messages,
        ...(agentResolution !== undefined ? { agentResolution } : {}),
        ...(peerResolution !== undefined ? { peerResolution } : {}),
        created: existing?.created ?? now,
        updated: now,
    };
}
