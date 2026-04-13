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
    JsonRpcResponse
} from '@agentic-profile/a2a-mcp-express';

import { generateReply } from './chat/reply.js';

/**
 * Handle an A2A SendMessage request.  This will process the message and return either
 * return a text response, or a task indicating it will be handled later and a SendMessage will
 * be sent to the 'from' agent.
 * @param jrpcRequest 
 * @param param1 
 * @returns 
 */
export async function handleA2aSendMessage(jrpcRequest: JsonRpcRequest, {session}: JsonRpcRequestContext): Promise<JsonRpcResponse> {
    if( !session )
        return jrpcErrorAuthRequired( jrpcRequest.id! );

    const peerDid = session.agentDid;  // might or might not include fragment...
    const { message: inboundMessage } = jrpcRequest.params;
    const envelope = resolveEnvelope(jrpcRequest);

    // TODO: if we are swamped, then defer the reply to a later time and return a task...
    const { agentReplyText, metadata } = await generateReply({
        envelope,
        peerDid,
        inboundMessage
    });
    log.info(
        'handleA2aSendMessage() generated reply',
        prettyJson({ envelope, agentReplyText: truncate(agentReplyText), metadata })
    );

    return jrpcResult(jrpcRequest.id!,{
        message: {
            contextId: `${envelope.to}^${peerDid}`,
            messageId: uuidv4(),
            role: "ROLE_AGENT",
            parts: [
                {
                    text: agentReplyText,
                    mediaType: "text/plain"
                }
            ],
            metadata
        }
    });
}
