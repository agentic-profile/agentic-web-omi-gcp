import {
    createInMemoryAuthTokenCache,
    a2aFetch,
    createA2aSendMessageRequest,
    AuthContext
} from '@agentic-profile/a2a-mcp-express';
import { UserID, DID, prettyJson } from '@agentic-profile/common';

import { ChatResolutionPair, generateReply } from './reply.js';
import { resolveAgent } from '../../../utils/agent.ts';
import { createProfileResolver } from '../../../utils/auth.ts';
import { truncate } from '../../../utils/misc.ts';
import log from '../../../utils/log.ts';
import { resolveAgentChatsStore } from '../../../stores/agent-chats/index.ts';
import { AgentPair, Message, MessageMetadata } from '../../../types/chat.ts';
import { updateDashboard } from './dashboard-client.js';
import { getChatDetailUrl, textToParts } from './misc.js';
import { UpdateAgentChatParams } from '../../../types/chat.ts';


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

export async function continueChat( params: ContinueChatParams ): Promise<ContinueChatResult> {
    log.info( 'continueChat()', prettyJson(params) );
    const { uid, agentDid, peerDid, envelopeOptions } = params;

    //
    // generate our agent's reply
    // (ok when there is no inbound message, but we can provide an altPrompt to kick off the chat turn)
    //
    const result = await generateReply({
        envelope: {
            to: agentDid, // to me
            from: peerDid,
            ...envelopeOptions
        },
        peerDid,
        altPrompt: "Tell me about another synergy of ours that we haven't discussed yet"
    });

    // We are guaranteed to have a chat reply from the above, so ok to update chat
    return await updateChat({ 
        uid, agentDid, peerDid,
        ...result
    });
}

interface UpdateChatParams {
    uid: UserID;
    agentDid: DID;
    peerDid: DID;

    prevResolutions?: ChatResolutionPair;

    chatUpdate: UpdateAgentChatParams;
    replyText?: string;
    replyMetadata?: MessageMetadata;
    messageCount?: number;

    envelopeOptions?: EnvelopeOptions;
}

export async function updateChat( params: UpdateChatParams ) {
    //log.info( 'updateChat()', prettyJson(params) );
    const {
        uid, agentDid, peerDid,
        chatUpdate, replyText, replyMetadata, messageCount, 
        envelopeOptions = {}, prevResolutions = {}
    } = params;

    // if there are new resolutions, then update the dashboard
    const authContext: AuthContext = {
        agentDid,
        profileResolver: (await createProfileResolver(agentDid)).profileResolver,
        authTokenCache: createInMemoryAuthTokenCache()
    };
    const force = messageCount <= 2; // force update if we're just starting the chat
    const { agentResolution, peerResolution } = chatUpdate;
    const prev = await updateDashboard( prevResolutions, {
        agentDid,
        peerDid,
        messages: chatUpdate.messages,
        agentResolution,
        peerResolution,
        manageUrl: getChatDetailUrl( agentDid, peerDid )
    }, authContext, force );

    // Persist resolution changes to Firestore. (generateReply already writes for continueChat;
    // the like endpoint only passes chatUpdate here, and previously never hit the store.)
    if (agentResolution !== undefined || peerResolution !== undefined) {
        await agentChatsStore.update(uid, { agentDid, peerDid } as AgentPair, {
            ...(agentResolution !== undefined ? { agentResolution } : {}),
            ...(peerResolution !== undefined ? { peerResolution } : {}),
        });
    }

    //
    // send reply to peer
    //
    const { serviceUrl } = await resolveAgent(agentDid);
    const parts = textToParts(replyText);
    const agentMessage = {
        role: "ROLE_USER", // <= temporary, while we send to peer
        parts,
        metadata: {
            ...replyMetadata,
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
    const { message, task, error } = (data as any)?.result ?? {};
    let userMessage: Message | undefined;
    if( message ) {
        log.info( 'updateChat() sent reply, and received message from peer', truncate(prettyJson(message),200));
        userMessage = {
            role: "ROLE_USER",
            parts: message.parts,
            ...(message.metadata !== undefined ? { metadata: message.metadata } : {}),
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
        log.info( `continueChat() for ${agentDid} sent reply, and received task from peer ${peerDid}: ${prettyJson(task)}` );
    } else if( error ) {
        log.info( `continueChat() for ${agentDid} received error from peer ${peerDid}: ${prettyJson(error)}` );
    } else
        log.error( `continueChat() for ${agentDid} received no message, task, or error from peer ${peerDid}: ${prettyJson({ data })}` );

    return {
        messages: [
            { ...agentMessage, role: "ROLE_AGENT" },
            ...(userMessage ? [userMessage] : []),
        ],
    };
}
