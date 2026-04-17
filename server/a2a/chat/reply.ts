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
import { resolveSender, ensureAgentOwnerInGoodStanding } from './misc.js';
import { computeTokenCost, UsageMetadata } from './cost.js';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const agentChatsStore = resolveAgentChatsStore();
const accountStore = resolveAccountStore();


export interface ReplyParams {
    envelope: AgentMessageEnvelope;
    peerDid: DID;  // source of message, who was authenticated
    inboundMessage?: Message;
}

export interface ChatResolutionPair {
    agentResolution?: ChatResolution | undefined | null;
    peerResolution?: ChatResolution | undefined | null;
}

export interface ReplyResult {
    agentReplyText: string;
    metadata: MessageMetadata;
    chatUpdate: UpdateAgentChatParams;
    prev: ChatResolutionPair;
    messageCount: number;
}

export async function generateReply({ envelope, peerDid, inboundMessage }: ReplyParams): Promise<ReplyResult> {

    const { to: agentDid, rewind } = envelope;
    const chatUpdate: UpdateAgentChatParams = { messages: [] };
    if( rewind )
        chatUpdate.rewind = rewind;
    peerDid = resolveSender( envelope.from, peerDid );

    const chatId: AgentPair = { agentDid, peerDid };  // peer is remote

    // currently only supports/records the first text part found
    const textPart: Part | undefined = inboundMessage?.parts?.find((part: Part) => "text" in part);
    const peerText = textPart?.text?.trim();
    const peerMetadata = inboundMessage?.metadata;

    const { uid, account } = await ensureAgentOwnerInGoodStanding( agentDid );

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
        log.debug('Fetch message history:', a2aMessageHistory);
    }
    let messageCount = a2aMessageHistory.length;

    let agentReplyText;
    if( !a2aMessageHistory.find(m => m.role === "ROLE_AGENT") ) {
        // No message from me/agent, so introduce myself...
        log.info(
            'generateReply() found no message from me/agent, so introducing myself.  Roles:',
            a2aMessageHistory.map(m => m.role).join(', ')
        );
        agentReplyText = `Hello!  A quick summary of what I'm doing...\n\n${account.introduction}`;
    } else {
        //if( peerText )
        //    a2aMessageHistory.push({ role: "ROLE_USER", parts:[{ text:peerText }]});

        // Fallback for when I've already introduced myself and this is a cold start
        const message = peerText ?? "Ask me a question about anything I have shared about myself.";

        const systemInstruction = createSystemPrompt( account );
        const { text, cost } = await chatCompletion( systemInstruction, a2aMessageHistory, message );

        await accountStore.subtractCredit(account.uid, cost);
        agentReplyText = text;
    }

    // any JSON resolution?
    let metadata: MessageMetadata = {
        timestamp: new Date().toISOString()
    }
    const { jsonObjects, textWithoutJson } = extractJson(agentReplyText);
    jsonObjects?.forEach((json: any) => {
        log.debug('Found JSON object in agent response:', json);
        if( json.metadata?.resolution ) {
            metadata = { ...metadata, ...json.metadata };
            chatUpdate.agentResolution = metadata.resolution;
            agentReplyText = textWithoutJson;
        }
    });

    if( peerText )
        chatUpdate.messages!.push({ role: "ROLE_USER", parts: [{ text: peerText }], metadata: peerMetadata } as Message);
    chatUpdate.messages!.push({ role: "ROLE_AGENT", parts: [{ text: agentReplyText }], metadata } as Message);
    messageCount += chatUpdate.messages!.length;

    // Update the chat history with any new resolutions
    updateResolutions( chatUpdate, chatUpdate.messages! );
    await agentChatsStore.update(uid, chatId, chatUpdate);

    return {
        agentReplyText,
        metadata,
        chatUpdate,
        prev: prevResolutions,
        messageCount
    }
}

function updateResolutions( chatUpdate: UpdateAgentChatParams, messages: Message[] ) {
    log.info(`updateResolutions() updating resolutions for ${messages.length} messages from agent:${chatUpdate.agentResolution} peer:${chatUpdate.peerResolution}`);
    for( const { role, metadata } of messages ) {
        if( metadata?.resolution ) {
            log.info(`found new resolution for ${role}: ${prettyJson(metadata.resolution)}`);
            if( role === "ROLE_AGENT" )
                chatUpdate.agentResolution = metadata.resolution;
            else
                chatUpdate.peerResolution = metadata.resolution;
        }
    }

    log.info(`updateResolutions() updated resolutions to agent:${chatUpdate.agentResolution} peer:${chatUpdate.peerResolution}`);
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
