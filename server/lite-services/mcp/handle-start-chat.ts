import { v4 as uuidv4 } from 'uuid';
import log from '../../utils/log.ts';
import {
    jrpcErrorAuthRequired, 
    jrpcResult, 
    JsonRpcRequest, 
    JsonRpcRequestContext, 
    JsonRpcResponse
} from '@agentic-profile/a2a-mcp-express';
import { parseDid, DID } from '@agentic-profile/common';

import type { StartChatQueueMessage } from "../../queue/types.js";
import { resolveAgentChatsStore } from "../../stores/agent-chats/index.ts";
import { AgentPair } from '../../types/chat.js';
import { ensureAgentOwnerInGoodStanding } from '../a2a/chat/misc.js';
import { continueChat } from '../a2a/chat/continue-chat.ts';
import { manageChatUrl } from '../a2a/chat/misc.js';

const agentChatsStore = resolveAgentChatsStore();

// start a chat between two agents
interface StartChatArguments {
    agentDid: DID;
    peerDid: DID;
    posthaste?: boolean
}

/**
 * Handle an MCP CreateChat (new type) request.  This may do the task immediately, 
 * or it may queue it for later execution.
 * @param jrpcRequest 
 * @param param1 
 * @returns 
 */
export async function handleStartChat(jrpcRequest: JsonRpcRequest, {session, req}: JsonRpcRequestContext): Promise<JsonRpcResponse> {
    if( !session )
        return jrpcErrorAuthRequired( jrpcRequest.id! );

    const { agentDid, peerDid, posthaste } = (jrpcRequest.params?.arguments ?? {}) as StartChatArguments;
    if(!posthaste) 
        log.info('Chat start is posthaste!');

    // Ensure the entity that requested the task (session.agentDid) has authority
    // to start a chat for the given userAgentDid
    //
    // A counter-example is an agent did:web:example.com:1#venture trying to start 
    // a chat for a different agent did:web:example.com:1#dating of the same entity
    // The "naked" entity DID can sign/start a chat for any agent
    if( agentDid !== session.agentDid                    // for when agent signs the token
        && parseDid(agentDid).did !== session.agentDid ) // for when entity owning the agent signs the token
        throw new Error(`User agentDid ${agentDid} does not match session agentDid ${session.agentDid}`);

    const { uid } = await ensureAgentOwnerInGoodStanding(agentDid);

    // Has this chat already concluded on my part?
    const manageUrl = manageChatUrl(req);
    const chatId: AgentPair = { agentDid, peerDid };
    const chat = await agentChatsStore.read(chatId);
    const like = chat?.agentResolution?.like;
    if( like === true || like === false ) {
        log.info(`Chat ${chatId} has already concluded on my part: ${like}`);
        return jrpcResult(jrpcRequest.id!,{
            status: "completed",
            resolution: chat?.agentResolution,
            manageUrl
        });
    }

    // Queue the chat for later execution
    // TODO: maybe do the task immediately?
    const message: StartChatQueueMessage = {
        type: "start-chat",
        uid,
        taskId: uuidv4(),
        agentDid,
        peerDid
    };
    //await messageQueue.queueMessage( message );
    await continueChat( message );  // skip queue!!

    return jrpcResult(jrpcRequest.id!,{
        status: "continued",
        manageUrl
    });
}
