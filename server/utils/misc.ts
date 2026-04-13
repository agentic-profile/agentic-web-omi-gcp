import crypto from "crypto";
import { prettyJson } from "@agentic-profile/common";

/**
 * Generates a cryptographically secure random key encoded as base64url.
 * @param length The number of random bytes to generate.
 * @returns A base64url encoded string.
 */
export function generateBase64UrlKey(length: number = 32): string {
  return crypto.randomBytes(length)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function truncate( text: string | undefined, length: number = 100) {
    if( !text )
        return '';
    if( text.length <= length )
        return text;
    return text.substring(0, length) + '...';
}

export function abbreviate( body: any ) {
    if( typeof body !== 'object' )
        return body;
    if( body.method === 'SendMessage' && body.params?.message?.parts ) {
        const parts = body.params.message.parts.map((p: any) => p.text ? { ...p, text: truncate(p.text, 40) } : p);
        return prettyJson({
            ...body,
            params: { 
                ...body.params, 
                message: {
                    ...body.params.message, parts
                } 
            }
        });
    }

    // one liner...
    return truncate(JSON.stringify(body), 160);
}
