import log from '../../utils/log.ts';
import {
    jrpcErrorAuthRequired, 
    jrpcResult,
    jrpcError,
    JsonRpcRequest, 
    JsonRpcRequestContext, 
    JsonRpcResponse
} from '@agentic-profile/a2a-mcp-express';
import { parseDid, DID } from '@agentic-profile/common';

import { ChatResolution } from '../../types/chat.js';
import { updateChat } from '../a2a/chat/continue-chat.ts';
import { ensureAgentOwnerInGoodStanding } from '../a2a/chat/misc.ts';


// start a chat between two agents
interface UpdateResolutionArguments {
    agentDid: DID;
    peerDid: DID;
    resolution: ChatResolution;
}

/**
 * Handle an MCP CreateChat (new type) request.  This may do the task immediately, 
 * or it may queue it for later execution.
 * @param jrpcRequest 
 * @param param1 
 * @returns 
 */
export async function handleUpdateResolution(jrpcRequest: JsonRpcRequest, {session, req}: JsonRpcRequestContext): Promise<JsonRpcResponse> {
    if( !session )
        return jrpcErrorAuthRequired( jrpcRequest.id! );

    const { agentDid, peerDid, resolution } = (jrpcRequest.params?.arguments ?? {}) as UpdateResolutionArguments;

    // Ensure the entity that requested the task (session.agentDid) has authority
    // to update the resolution of a chat for the given userAgentDid
    //
    // A counter-example is an agent did:web:example.com:1#venture trying to start 
    // a chat for a different agent did:web:example.com:1#dating of the same entity
    // The "naked" entity DID can sign/start a chat for any agent
    if( agentDid !== session.agentDid                      // for when agent signs the token
        && parseDid(agentDid).did !== session.agentDid ) { // for when entity owning the agent signs the token
        const msg = `handleUpdateResolution() for ${agentDid} was authenticated by the wrong session agent ${session.agentDid}`;
        log.info( msg );
        return jrpcError(jrpcRequest.id!, -32601, msg );
    }

    const { uid } = await ensureAgentOwnerInGoodStanding(agentDid);

    await updateChat({ 
        uid,
        agentDid,
        peerDid,
        chatUpdate: {
            agentResolution: resolution,
        },
        replyMetadata: {
            timestamp: new Date().toISOString(),
            resolution,
        }
    });

    return jrpcResult(jrpcRequest.id!,{
        status: "updated"
    });
}
