import { createMcpToolsCallRequest, mcpFetch, AuthContext } from "@agentic-profile/a2a-mcp-express";
import { DID, parseDid, prettyJson } from "@agentic-profile/common";

import log from "../../../utils/log.ts";
import { ChatResolutionPair } from "./reply.js";
import { resolveAgent, resolveAgenticProfile } from "../../../utils/agent.ts";
import { ChatResolution, Message } from "../../../types/chat.ts";
import { truncate } from "../../../utils/misc.ts";


export interface DashboardChatUpdate {
    agentDid: DID;
    peerDid: DID;
    messages?: Message[];
    agentResolution?: ChatResolution | null;
    peerResolution?: ChatResolution | null;
    manageUrl?: string;
}

export interface DashboardNotification {
    title: string;
    subtitle?: string;
    body: string;
    url?: string;
}

/**
 * Payload for matchwise-agent-management dashboard MCP tool `update`
 * (must match `DashboardToolArguments` in `mcp/dashboard/router.ts`).
 */
export interface UpdateDashboardPayload {
    chat?: DashboardChatUpdate;
    notification?: DashboardNotification;
}

export async function updateDashboard( prevResolutions: ChatResolutionPair, chat: DashboardChatUpdate, authContext: AuthContext, force: boolean = true ): Promise<ChatResolutionPair> {    
    //log.info( 'updateDashboard()', prettyJson({prevResolutions, chat, force}) );
    
    // sanity
    if( chat.agentDid !== authContext.agentDid )
        throw new Error( `updateDashboard() agentDid mismatch: ${chat.agentDid} !== ${authContext.agentDid}` );
    
    // any resolution changes?
    let updated = false;
    if( chat.agentResolution !== undefined && prevResolutions.agentResolution !== chat.agentResolution )
        updated = true;
    if( chat.peerResolution !== undefined && prevResolutions.peerResolution !== chat.peerResolution )
        updated = true;

    const agentDid = authContext.agentDid;
    const peerDid = chat.peerDid;
    if( !force &&!updated ) {
        log.info( 'updateDashboard() has no updates', {agentDid, peerDid, agentResolution: chat.agentResolution, peerResolution: chat.peerResolution} );
        return prevResolutions;
    }

    const notification = await buildDashboardNotification( prevResolutions, chat, peerDid );
    //log.info( 'updateDashboard(2)', prettyJson({chat,notification}));

    let serviceUrl;
    let mcpRequest;
    try {
        const dashboardDid = parseDid(agentDid).did + '#dashboard';
        serviceUrl = (await resolveAgent(dashboardDid)).serviceUrl

        const payload: UpdateDashboardPayload = {
            chat,
            notification
        };
        mcpRequest = createMcpToolsCallRequest( 'update', payload );
        const { fetchResponse } = await mcpFetch( serviceUrl, mcpRequest, authContext );
        if( !fetchResponse.ok )
            log.error("Failed to update dashboard", fetchResponse.statusText, serviceUrl, prettyJson(mcpRequest)); // silently fail :/
    } catch( error ) {
        log.error("Failed to update dashboard", error, serviceUrl, prettyJson(mcpRequest));
    }

    return {
        agentResolution: chat.agentResolution,
        peerResolution: chat.peerResolution,
    };
}

//
// Craft a notification message
//

function resolveCurrentResolution(
    prev: ChatResolution | null | undefined,
    update: ChatResolution | null | undefined,
): ChatResolution | null | undefined {
    if( update === undefined )
        return prev;
    return update;
}

function likeValue( resolution: ChatResolution | null | undefined ): boolean {
    return Boolean( resolution && typeof resolution === 'object' && (resolution as any).like === true );
}

/** Human-readable summary for the dashboard MCP `update` tool. */
export async function buildDashboardNotification(
    prev: ChatResolutionPair,
    updates: ChatResolutionPair,
    peerAgentDid: DID,
): Promise<NonNullable<UpdateDashboardPayload['notification']>> {
    const currentAgentResolution = resolveCurrentResolution( prev.agentResolution, updates.agentResolution );
    const currentPeerResolution = resolveCurrentResolution( prev.peerResolution, updates.peerResolution );

    const youLikeThem = likeValue( currentAgentResolution );
    const theyLikeYou = likeValue( currentPeerResolution );

    const peerName = await resolvePeerName( peerAgentDid );

    const title =
        youLikeThem && theyLikeYou
            ? `${peerName} likes you, and you like them too!`
            : youLikeThem
              ? "You like ${peerName}"
              : theyLikeYou
                ? `${peerName} likes you`
                : "Still gossiping with ${peerName} - no likes yet";
    return {
        title,
        body: 'Tap on the chat to view the full conversation'
    };
}

async function resolvePeerName( peerAgentDid: DID ): Promise<string> {
    try {
        const peerEntityDid = parseDid(peerAgentDid).did;
        return (await resolveAgenticProfile(peerEntityDid)).name;
    } catch( error ) {
        log.debug('Failed to resolve peer name from DID doc', { peerAgentDid, error });
    }

    return truncate( peerAgentDid, 56 );  // ugh
}
