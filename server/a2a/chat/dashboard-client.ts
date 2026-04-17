import log from "../../utils/log.js";
import { DID, parseDid, prettyJson } from "@agentic-profile/common";
import { ChatResolutionPair } from "./reply.js";
import { resolveAgent } from "../../utils/agent.js";
import { createMcpToolsCallRequest } from "../../lite-clients/mcp-client.ts";
import { AuthContext } from "../../lite-clients/client.js";
import { mcpFetch } from "../../lite-clients/mcp-client.ts";
import { ChatResolution, Message } from "../../stores/agent-chats/types.js";
import { truncate } from "../../utils/misc.js";


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

    const notification = buildDashboardNotification( prevResolutions, chat, peerDid );
    log.info( 'updateDashboard(2)', prettyJson({chat,notification}));

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

function formatResolutionValue( value: unknown ): string {
    if( value === true ) return 'yes';
    if( value === false ) return 'no';
    if( value === null || value === undefined ) return 'none';
    if( typeof value === 'object' )
        return truncate( prettyJson( value ), 120 );
    return String( value );
}

function summarizeResolutionDelta(
    before: ChatResolution | null | undefined,
    after: ChatResolution | null | undefined,
): string {
    if( after === undefined )
        return 'unchanged';
    if( after === null )
        return before == null ? 'resolution cleared' : `resolution cleared (was ${formatResolutionSnapshot( before )})`;
    if( before == null )
        return `resolution set to ${formatResolutionSnapshot( after )}`;

    const beforeRec = before as Record<string, unknown>;
    const afterRec = after as Record<string, unknown>;
    const keys = new Set( [ ...Object.keys( beforeRec ), ...Object.keys( afterRec ) ] );
    const changes: string[] = [];
    for( const key of keys ) {
        const b = beforeRec[key];
        const a = afterRec[key];
        if( prettyJson( b ) !== prettyJson( a ) )
            changes.push( `${key}: ${formatResolutionValue( b )} → ${formatResolutionValue( a )}` );
    }
    return changes.length ? changes.join( '; ' ) : 'unchanged';
}

function formatResolutionSnapshot( res: ChatResolution | null | undefined ): string {
    if( res === null || res === undefined )
        return 'none';
    const entries = Object.entries( res ).filter( ( [, v] ) => v !== undefined );
    if( !entries.length )
        return '{}';
    return entries.map( ( [ k, v ] ) => `${k}=${formatResolutionValue( v )}` ).join( ', ' );
}

/** Human-readable summary for the dashboard MCP `update` tool. */
export function buildDashboardNotification(
    prev: ChatResolutionPair,
    updates: ChatResolutionPair,
    peerAgentDid: DID,
): NonNullable<UpdateDashboardPayload['notification']> {
    const lines: string[] = [];
    if( updates.agentResolution !== undefined )
        lines.push( `Your agent: ${summarizeResolutionDelta( prev.agentResolution, updates.agentResolution )}.` );
    if( updates.peerResolution !== undefined )
        lines.push( `Peer agent: ${summarizeResolutionDelta( prev.peerResolution, updates.peerResolution )}.` );

    const body = lines.join( ' ' );
    const title = lines.length > 1 ? 'Chat resolutions updated' : 'Chat resolution updated';
    return {
        title,
        subtitle: truncate( peerAgentDid, 56 ),
        body,
    };
}
