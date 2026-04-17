import { DID, prettyJson } from '@agentic-profile/common';
import { CreateChatParameters, GoogleGenAI } from "@google/genai";
import log from '../../utils/log.js';
import { truncate } from '../../utils/misc.js';
import {
    AgentChat, AgentPair, Part, Message, UpdateAgentChatParams,
    MessageMetadata, ChatResolution
} from '../../stores/agent-chats/types.js';
import { extractJson } from '../../utils/json.js';
import type { AgentMessageEnvelope } from '@agentic-profile/a2a-mcp-express';
import { createSystemPrompt } from '../../a2a/chat/prompt-templates.js';
import { resolveAgentChatsStore } from "../../stores/agent-chats/index.js";
import { resolveAccountStore } from "../../stores/accounts/index.js";
import { resolveSender, ensureAgentOwnerInGoodStanding, textToParts, partsToText } from './misc.js';
import { computeTokenCost, UsageMetadata } from './cost.js';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const agentChatsStore = resolveAgentChatsStore();
const accountStore = resolveAccountStore();


export interface ReplyParams {
    envelope: AgentMessageEnvelope;
    peerDid: DID;  // source of message, who was authenticated
    inboundMessage?: Message;
    altPrompt?: string; // if there's no inbound message but we want to generate a reply, provide this altPrompt for chat completion
}

export interface ChatResolutionPair {
    agentResolution?: ChatResolution | undefined | null;
    peerResolution?: ChatResolution | undefined | null;
}

export interface ReplyResult {
    prevResolutions: ChatResolutionPair;  // prior resolutions as stored in DB

    chatUpdate: UpdateAgentChatParams;

    // easy accessors, mirrors what's in chatUpdate
    replyText: string;                // The reply text we added to chatUpdate.messages
    replyMetadata: MessageMetadata;   // the reply/generated metadata we added to the reply chatUpdate message
    messageCount: number;             // final message count
}

// This also handles several cases:
// - They simply sent a "rewind"
// - They sent a text message I should respond to
// - They sent a metadata.resolution I should update
// - OR I'm asked (via altPrompt) to say something "interesting" to kick off a chat turn
// - Any combination of the above(!)
export async function generateReply({ envelope, peerDid, inboundMessage, altPrompt }: ReplyParams): Promise<ReplyResult> {
    const { to: agentDid, rewind } = envelope;
    const { uid, account } = await ensureAgentOwnerInGoodStanding( agentDid );

    // start tracking the chat updates/changes
    // This is the consolidated answer
    const chatUpdate: UpdateAgentChatParams = { messages: [] };
    if( rewind )
        chatUpdate.rewind = rewind;

    peerDid = resolveSender( envelope.from, peerDid ); // in-case the peer is encoded in the envelope
    const chatId: AgentPair = { agentDid, peerDid };   // agentDid is my agent, peer is remote

    // anything coming in?  These might both be undefined...
    const peerText = partsToText( inboundMessage?.parts );
    const peerMetadata = inboundMessage?.metadata;

    //
    // What was the previous state of the resolutions?
    //
    let a2aMessageHistory: Message[] = [];
    const prevResolutions: ChatResolutionPair = {};
    if( rewind ) {
        log.debug('Rewinding message history to:', rewind);
        chatUpdate.agentResolution = null;
        chatUpdate.peerResolution = null;

        // TODO: support date based rewind
    } else {
        const { messages, agentResolution, peerResolution } = await agentChatsStore.read(chatId) ?? {} as AgentChat;
        a2aMessageHistory = messages ?? [];
        prevResolutions.agentResolution = agentResolution;
        prevResolutions.peerResolution = peerResolution;
    }

    let replyMetadata: MessageMetadata;
    let replyText: string;
    if( !a2aMessageHistory.find(m => m.role === "ROLE_AGENT") ) {
        // No message from me/agent, so introduce myself...
        replyText = `Hello!  A quick summary of what I'm doing...\n\n${account.introduction}`;
        replyMetadata = {
            timestamp: new Date().toISOString()
        };
    } else if( peerText || altPrompt ) {
        // They sent a message and I should respond
        const systemInstruction = createSystemPrompt( account );
        const { text, cost } = await chatCompletion( systemInstruction, a2aMessageHistory, peerText || altPrompt );
        replyText = text;

        // Make sure they pay for inference
        await accountStore.subtractCredit(account.uid, cost);

        // any JSON resolution?
        const { jsonObjects, textWithoutJson } = extractJson(replyText);
        jsonObjects?.forEach((json: any) => {
            if( json.metadata?.resolution ) {
                replyMetadata = {
                    ...json.metadata,
                    timestamp: new Date().toISOString()
                };
                chatUpdate.agentResolution = replyMetadata.resolution;
                replyText = textWithoutJson; // remove the JSON object from the reply text
                log.debug('Found JSON object in agent response with resolution:', prettyJson(json));
            } else {
                log.info('Found JSON object in agent response, but no resolution:', prettyJson(json));
            }
        });
    } else {
        // they did NOT send a text message... maybe they update a metadata.resolution? (handled below...)
    }

    if( peerText || peerMetadata?.resolution )
        chatUpdate.messages.push({ role: "ROLE_USER", parts: textToParts(peerText), metadata: peerMetadata } as Message);
    if( replyText || replyMetadata?.resolution )
        chatUpdate.messages.push({ role: "ROLE_AGENT", parts: textToParts(replyText), metadata: replyMetadata } as Message);

    // Revise the chatUpdate with any new resolutions from the message
    updateResolutions( chatUpdate );
    await agentChatsStore.update(uid, chatId, chatUpdate);

    return {
        replyText,
        replyMetadata,
        chatUpdate,
        prevResolutions,
        messageCount: a2aMessageHistory.length + chatUpdate.messages!.length
    };
}

function updateResolutions( chatUpdate: UpdateAgentChatParams ) {
    log.info(`updateResolutions() ${prettyJson({chatUpdate})}`);
    for( const { role, metadata } of chatUpdate.messages ?? [] ) {
        if( metadata?.resolution ) {
            log.info(`found new resolution for ${role}: ${prettyJson(metadata.resolution)}`);
            if( role === "ROLE_AGENT" )
                chatUpdate.agentResolution = metadata.resolution;
            else
                chatUpdate.peerResolution = metadata.resolution;
        }
    }

    const resolutions = {
        agentResolution: chatUpdate.agentResolution,
        peerResolution: chatUpdate.peerResolution
    };
    log.info(`updateResolutions() updated resolutions ${prettyJson({resolutions})}`);
}

async function chatCompletion( systemInstruction: string, a2aHistory: Message[], message: string ) {
    const trimmed = message?.trim();
    if( !trimmed )
        throw new Error("chatCompletion requires a non-empty message");

    const history = a2aHistory.map(({role,parts})=>{
        role = role === 'ROLE_USER' ? 'user' : 'model';
        return { role, parts };
    });
    const model = "gemini-3.1-flash-lite-preview";
    const params = {
        model,
        history,
        config: {
            systemInstruction
        }
    } as CreateChatParameters; 
    const chat = genAI.chats.create(params);

    //log.info(`genAI.chats.create(${prettyJson(params)}) then sendMessage({message:"${trimmed}"})`);

    const response = await chat.sendMessage({ message: trimmed });

    const usage: UsageMetadata | undefined =
        (response as any)?.usageMetadata ??
        (response as any)?.response?.usageMetadata ??
        (response as any)?.response?.usage_metadata;
    const cost = computeTokenCost(model, usage);

    const { text } = response;
    log.info(`chat.sendMessage() cost: ${cost} message: ${truncate(trimmed,50)} reply: ${truncate(text,50)}`);
    return { text, cost };
}
