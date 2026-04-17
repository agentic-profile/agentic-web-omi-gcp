import { DID, parseDid } from '@agentic-profile/common';
import { resolveAccountStore } from "../../stores/accounts/index.ts";
import log from "../../utils/log.js";
import { appUrl } from '../../utils/http.js';
import { Request } from 'express';
import { Part } from '@/server/stores/agent-chats/types.ts';

const accountStore = resolveAccountStore();

/**
 * 
 * @param from Ensure the sender is valid for the given 'from' DID
 * @param from The 'from' DID of the message message envelope - this might be undefined
 * @param peerDid The verified DID who signed the message.  This might be the exact agent with a fragment, or it might be the naked DID of the entity.
 */
export function resolveSender( from: DID | undefined, peerDid: DID ): DID {
    if( !from )
        return peerDid; // Peer did has already been verified
    if( from === peerDid )
        return peerDid; // Peer did is the same as the message envelope 'from'

    if( parseDid(from).did === peerDid )
        return from; // From was fully qualified with a fragment, but the peer was an entity level DID (no fragment)
                     // so the fully qualified from is ok!

    throw new Error(`Message envelope 'from' value ${from} does not match authenticated agentDid: ${peerDid}`);
}

export async function ensureAgentOwnerInGoodStanding( agentDid: DID ) {
    const account = await accountStore.readAccountByAgentDid( agentDid );
    if( !account )
        throw new Error(`Account not found for ${agentDid}`);
    const { uid, name, credits } = account;
    //if( disabled_by )
    //    throw new Error(`Agent owner ${agent.uid} account is disabled`);
    if( credits <= 0 ) {
        log.warn(`Agent owners account has insufficient credit`);
        throw new Error(`Agent ${agentDid} owner ${uid} has insufficient credit`);
    }

    return { uid, name, credits, account };
}

export function getChatDetailUrl( agentDid: DID, peerDid: DID ): string | undefined {
    try {
        const u = new URL( '/agent-chats/detail', process.env.SERVICE_URL || 'https://omi.matchwise.ai' );
        u.searchParams.set( 'agentDid', agentDid );
        u.searchParams.set( 'peerDid', peerDid );
        return u.href;
    } catch( error ) {
        log.error('Failed to generate manage URL', error);
        return undefined;
    } 
}

export function manageChatUrl( req: Request ) {
    return `${appUrl(req).url}/manage/chat`;
}

export function textToParts( text: string ): Part[] {
    text = text?.trim();
    if( !text )
        return [];
    else
       return [{ text }];
}

export function partsToText( parts: Part[] | undefined ): string | undefined{
    const text = parts?.map((part:any) => "text" in part ? part.text : undefined).filter(Boolean).join('\n\n').trim();
    return text || undefined;
}
