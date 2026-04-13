import { DID, prettyJson } from '@agentic-profile/common';
import { GoogleGenAI } from "@google/genai";
import log from '../../utils/log.js';

import {
    AgentChat, AgentPair, Part, Message, UpdateAgentChatParams,
    MessageMetadata, ChatResolution
} from '../../stores/agent-chats/types.js';
//import { chatCompletion, ClaudeMessage } from '@/common/inference/claude-bedrock.js';
import { extractJson } from '../../utils/json.js';
import type { AgentMessageEnvelope } from '@agentic-profile/a2a-mcp-express';
import { createSystemPrompt } from '../../a2a/chat/prompt-templates.js';
import { resolveAgentChatsStore } from "../../stores/agent-chats/index.js";
import { resolveAgentsStore } from "../../stores/agents/index.js";
import { resolveAccountStore } from "../../stores/accounts/index.js";
import { resolveSender, ensureAgentOwnerInGoodStanding } from './misc.js';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const agentChatsStore = resolveAgentChatsStore();
//const agentStore = resolveAgentsStore();
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

    //const contextId = `${toAgentDid}^${fromAgentDid}`;  // e.g. did:web:iamagentic.ai:1#venture^did:web:iamagentic.ai:1#venture
    const chatId: AgentPair = { agentDid, peerDid };  // peer is remote

    // currently only supports/records the first text part found
    const textPart: Part | undefined = inboundMessage?.parts?.find((part: Part) => "text" in part);
    const peerText = textPart?.text;
    const peerMetadata = inboundMessage?.metadata;

    /* read my agent (who am I?) = toAgentDid (not the client)
    const agent = await agentStore.readByDid( agentDid );
    if( !agent )
        throw new Error(`Agent profile not found for ${agentDid}`);
    log.debug('Agent profile', agentDid, prettyJson(agent));
    const { uid, account } = await ensureAgentOwnerInGoodStanding(agent);
    */

    const account = await accountStore.readAccountByDid( agentDid );
    if( !account )
        throw new Error(`Account not found for agent DID: ${agentDid}`);

    const { uid } = account;

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

    //
    // Claude...
    //

    let agentReplyText;
    if( !a2aMessageHistory.find(m => m.role === "ROLE_AGENT") ) {
        // No message from me/agent, so introduce myself...
        log.info(
            'generateReply() found no message from me/agent, so introducing myself.  Roles:',
            a2aMessageHistory.map(m => m.role).join(', ')
        );
        agentReplyText = `Hello!  A quick summary of what I'm doing...\n\n${account.introduction}`;
    } else {
        /* convert A2A messages to Claude messages
        const claudeMessages: ClaudeMessage[] = a2aMessageHistory.map(m => ({
            role: m.role === "ROLE_USER" ? "user" : "assistant",
            content: m.parts.map(p => "text" in p ? p.text : "").join("\n\n")
        }));
        if( peerText )
            claudeMessages.push({ role: "user", content: peerText } as ClaudeMessage);

        // continue the conversation
        const options = {
            system: createSystemPrompt({ name: name ?? DEFAULT_NAME }, agent),
            messages: claudeMessages
        };
        const { text, cost } = await chatCompletion(options);
        */

        //=== Gemini ===
        //if( peerText )
        //    a2aMessageHistory.push({ role: "ROLE_USER", parts:[{ text:peerText }]});
        const systemInstruction = createSystemPrompt( account );
        const { text, cost } = await chatCompletion( systemInstruction, a2aMessageHistory, peerText );  

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
    const history = a2aHistory.map(({role,parts})=>{
        role = role === 'ROLE_USER' ? 'user' : 'model';
        const content = parts.map(p => "text" in p ? p.text : "").join("\n\n");
        return { role, content };
    }); 
    const chat = genAI.chats.create({
        model: "gemini-3-flash-preview",
        history,
        config: {
            systemInstruction
        }
    });

    const response = await chat.sendMessage({ message });
    return { text: response.text, cost: 0 };

    /*
    const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this raw JSON data from an Omi wearable device and create a structured summary JSON object. 
        Focus on key events, people mentioned, and emotional tone.
        
        Raw Data: ${JSON.stringify(raw)}
        
        Return a JSON object with fields like: "main_topic", "key_points" (array), "sentiment", "entities" (array).`,
        config: {
            responseMimeType: "application/json"
        }
    });
    
    summary = JSON.parse(response.text || "{}");
    return summary;
    */
}
