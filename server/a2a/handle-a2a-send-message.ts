import { v4 as uuidv4 } from 'uuid';
import log from '../utils/log.js';
import { prettyJson } from '@agentic-profile/common';
import { truncate } from '../utils/misc.js';
import {
    jrpcErrorAuthRequired, 
    jrpcResult, 
    JsonRpcRequest, 
    JsonRpcRequestContext, 
    resolveEnvelope,
    JsonRpcResponse,
    jrpcError
} from '@agentic-profile/a2a-mcp-express';
import { AuthContext } from '../lite-clients/client.js';
import { createProfileResolver } from '../utils/auth.js';
import { createInMemoryAuthTokenCache } from '@agentic-profile/a2a-mcp-express';
import { updateDashboard } from './chat/dashboard-client.js';
import { generateReply } from './chat/reply.js';
import { getChatDetailUrl, partsToText, textToParts } from './chat/misc.js';
import { Message } from '../stores/agent-chats/types.js';
import { generateTaskComplete } from './misc.js';

const JRPC_ERROR_INVALID_PARAMS = -32602;

/**
 * Handle an A2A SendMessage request.  This will process the message and return either
 * return a text response, or a task indicating it will be handled later and a SendMessage will
 * be sent to the 'from' agent.
 * @param jrpcRequest 
 * @param param1 
 * @returns 
 */
export async function handleA2aSendMessage(jrpcRequest: JsonRpcRequest, {session}: JsonRpcRequestContext): Promise<JsonRpcResponse> {
    //log.info( 'handleA2aSendMessage()', prettyJson({jrpcRequest, session}) );
    if( !session )
        return jrpcErrorAuthRequired( jrpcRequest.id! );

    const peerDid = session.agentDid;  // might or might not include fragment...
    const { message: inboundMessage } = jrpcRequest.params;
    const envelope = resolveEnvelope(jrpcRequest);

    // sanity
    if( isEmptyMessage(inboundMessage) )
        return jrpcError( jrpcRequest.id!, JRPC_ERROR_INVALID_PARAMS, 'A2A SendMessage requires message.parts or message.metadata.resolution' );

    // TODO: if we are swamped, then defer the reply to a later time and return a task...
    const replyResult = await generateReply({
        envelope,
        peerDid,
        inboundMessage
    });
    log.info('handleA2aSendMessage() generated reply',prettyJson(replyResult));
    const { replyText, replyMetadata, chatUpdate, prevResolutions } = replyResult;

    // update the dashboard with the new messages
    const { to: agentDid } = envelope;
    const authContext: AuthContext = {
        agentDid,
        profileResolver: (await createProfileResolver(agentDid)).profileResolver,
        authTokenCache: createInMemoryAuthTokenCache()
    };

    await updateDashboard( prevResolutions, {
        agentDid,
        peerDid,
        messages: chatUpdate.messages,
        agentResolution: chatUpdate.agentResolution,
        peerResolution: chatUpdate.peerResolution,
        manageUrl: getChatDetailUrl( agentDid, peerDid )
    }, authContext );

    // if there's no reply message, simply send back a task complete 
    const contextId = `${envelope.to}^${peerDid}`;  
    if( !replyText && !replyMetadata?.resolution )
        return jrpcResult(jrpcRequest.id!, generateTaskComplete( contextId ));

    return jrpcResult(jrpcRequest.id!,{
        message: {
            contextId,
            messageId: uuidv4(),
            role: "ROLE_AGENT",
            parts: textToParts(replyText),
            metadata: replyMetadata
        }
    });
}

function isEmptyMessage( message: Message ): boolean {
    const hasText = partsToText( message.parts );
    const hasResolution = !!message.metadata?.resolution;
    return !hasText && !hasResolution;
}
