import { v4 as uuidv4 } from 'uuid';
import log from '../utils/log.js';
import {
    jrpcErrorAuthRequired, 
    jrpcResult, 
    JsonRpcRequest, 
    JsonRpcRequestContext, 
    JsonRpcResponse
} from '@agentic-profile/a2a-mcp-express';

import { prettyJson, parseDid } from '@agentic-profile/common';
//import { resolveMessageQueue } from "@/common/queue/index.js";
import { resolveAgentsStore } from "../stores/agents/index.ts";
import type { StartChatQueueMessage } from "../queue/types.js";
import { resolveAgentChatsStore } from "../stores/agent-chats/index.js";
import { AgentPair } from '../stores/agent-chats/types.js';
import { ensureAgentOwnerInGoodStanding } from './chat/misc.js';
import { continueChat } from './chat/continue-chat.ts';

//const messageQueue = resolveMessageQueue();
const agentStore = resolveAgentsStore();
const agentChatsStore = resolveAgentChatsStore();

/**
 * Handle an A2A CreateTask (new type) request.  This may do the task immediately, 
 * or it may queue it for later execution.
 * @param jrpcRequest 
 * @param param1 
 * @returns 
 */
export async function handleA2aCreateTask(jrpcRequest: JsonRpcRequest, {session}: JsonRpcRequestContext): Promise<JsonRpcResponse> {
    if( !session )
        return jrpcErrorAuthRequired( jrpcRequest.id! );

    const task = jrpcRequest.params?.task as A2aStartChatTask;
    log.info( 'CreateTask params', prettyJson(task) );
    const { agentDid, peerDid } = task;

    // Ensure the entity that requested the task (session.agentDid) has authority
    // to start a chat for the given userAgentDid
    //
    // A counter-example is an agent did:web:example.com:1#venture trying to start 
    // a chat for a different agent did:web:example.com:1#dating of the same entity
    // The "naked" entity DID can sign/start a chat for any agent
    if( agentDid !== session.agentDid                    // for when agent signs the token
        && parseDid(agentDid).did !== session.agentDid ) // for when entity owning the agent signs the token
        throw new Error(`User agentDid ${agentDid} does not match session agentDid ${session.agentDid}`);

    const agent = await agentStore.readByDid( agentDid );
    if( !agent )
        throw new Error( `Agent not found for ${agentDid}` );
    await ensureAgentOwnerInGoodStanding(agent);

    // Has this chat already concluded on my part?
    const chatId: AgentPair = { agentDid, peerDid };
    const chat = await agentChatsStore.read(chatId);
    const like = chat?.agentResolution?.like;
    if( like === true || like === false ) {
        log.info(`Chat ${chatId} has already concluded on my part: ${like}`);
        return jrpcResult(jrpcRequest.id!,{
            task: {
                id: uuidv4(),
                contextId: `${agentDid}^${peerDid}`,
                status: {
                    state: "TASK_STATE_COMPLETED",
                }
            }
        });
    }

    // Queue the chat for later execution
    // TODO: maybe do the task immediately?
    const message: StartChatQueueMessage = {
        type: "start-chat",
        uid: agent.uid,
        taskId: uuidv4(),
        agentDid,
        peerDid
    };
    //await messageQueue.queueMessage( message );
    await continueChat( message );  // skip queue!!

    return jrpcResult(jrpcRequest.id!,{
        task: {
            id: message.taskId,
            contextId: `${agentDid}^${peerDid}`,
        }
    });
}

//
// A2A Task types
//

// start a chat between two agents
interface A2aStartChatTask {
    kind: "start-chat";
    agentDid: string;
    peerDid: string;
}
