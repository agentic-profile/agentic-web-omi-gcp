import { generateReply } from './reply.js';
import { resolveAgent } from '../../utils/agent.js';
import { a2aFetch, createA2aSendMessageRequest } from '../../lite-clients/a2a-client.js';
import { AuthContext } from '../../lite-clients/client.js';
import { createProfileResolver } from '../../utils/auth.js';
import { createInMemoryAuthTokenCache } from '@agentic-profile/a2a-mcp-express';
import { UserID, DID, prettyJson } from '@agentic-profile/common';
import { truncate } from '../../utils/misc.js';
import log from '../../utils/log.js';
import { resolveAgentChatsStore } from '../../stores/agent-chats/index.js';
import { AgentPair, Message } from '../../stores/agent-chats/types.js';
import { updateDashboard } from './dashboard-client.js';
import { getManageUrl } from './misc.js';


const agentChatsStore = resolveAgentChatsStore();

export interface EnvelopeOptions {
    rewind?: string | true;
    posthaste?: boolean;
}

export interface ContinueChatParams {
    uid: UserID;
    agentDid: DID;
    peerDid: DID;
    envelopeOptions?: EnvelopeOptions;
}

export interface ContinueChatResult {
    messages: Message[];
}

export async function continueChat( { uid, agentDid, peerDid, envelopeOptions = {} }: ContinueChatParams ): Promise<ContinueChatResult> {
    //
    // generate our agent's reply (when there is no inbound message)
    //
    const { agentReplyText, metadata, chatUpdate, messageCount, ...replyResult } = await generateReply({
        envelope: {
            to: agentDid, // to me
            from: peerDid,
            ...envelopeOptions
        },
        peerDid
    });
    const { agentResolution, peerResolution } = chatUpdate;
    log.debug( 'continueChat() generated reply', prettyJson({
        agentReplyText: truncate(agentReplyText),
        metadata,
        prev: replyResult.prev,
        agentResolution,
        peerResolution,
        messageCount
    }) );

    // if there are new resolutions, then update the dashboard
    const authContext: AuthContext = {
        agentDid,
        profileResolver: (await createProfileResolver(agentDid)).profileResolver,
        authTokenCache: createInMemoryAuthTokenCache()
    };
    const force = messageCount <= 2; // force update if we're just starting the chat
    const prev = await updateDashboard( replyResult.prev, {
        agentDid,
        peerDid,
        messages: chatUpdate.messages,
        agentResolution,
        peerResolution,
        manageUrl: getManageUrl( agentDid, peerDid )
    }, authContext, force );

    //
    // send reply to peer
    //
    const { serviceUrl } = await resolveAgent(agentDid);
    const agentMessage = {
        role: "ROLE_USER", // <= temporary, while we send to peer
        parts: [{ text: agentReplyText }],
        metadata: {
            ...metadata,
            envelope: {
                to: peerDid, // reply to them
                ...envelopeOptions
            }
        }
    };
    const a2aRequest = createA2aSendMessageRequest( agentMessage );
    const { fetchResponse, data } = await a2aFetch( serviceUrl, a2aRequest, authContext );
    if( !fetchResponse.ok )
        throw new Error(`Failed to send reply to ${peerDid}: ${fetchResponse.statusText}`);

    //
    // process agent response
    //
    const { message, task } = (data as any)?.result ?? {};
    let userMessage: Message | undefined;
    if( message ) {
        log.info( 'continueChat() sent reply, and received message from peer', truncate(prettyJson(message),200));
        userMessage = {
            role: "ROLE_USER",
            parts: message.parts,
            metadata: message.metadata
        };
        // save the peer reply to our history
        await agentChatsStore.update(
            uid, 
            { agentDid: agentDid, peerDid: peerDid } as AgentPair, 
            { 
                messages: [ userMessage ],
                peerResolution: message.metadata?.resolution
            }
        );

        // update the dashboard with the new peer resolution if any
        await updateDashboard( prev, { 
            agentDid,
            peerDid,
            messages: [ userMessage ],
            peerResolution: message.metadata?.resolution
        }, authContext );
    } else if( task ) {
        log.info( `continueChat() sent reply, and received task from peer ${peerDid}: ${prettyJson(task)}` );
    } else
        throw new Error(`No message or task returned from ${peerDid}: ${prettyJson({ data })}`);

    return {
        messages: [
            { ...agentMessage, role: "ROLE_AGENT" },
            ...(userMessage ? [userMessage] : []),
        ],
    };
}


