import { AuthTokenCache } from "@agentic-profile/a2a-mcp-express";
import { JsonFetchResult } from "@agentic-profile/a2a-mcp-express";
import { AgenticChallenge } from "@agentic-profile/auth";
import { generateAuthToken } from "@agentic-profile/auth";
import { fetchJsonRpc } from "@agentic-profile/a2a-mcp-express";
import { ProfileResolver } from "../utils/auth.js";
import { prettyJson } from "@agentic-profile/common";
import log from "../utils/log.js";

export interface AuthContext {
    agentDid: string; // client agent DID; may include fragment (e.g. "#presence") OR represent the controlling entity (user, business, or gov agency)
    profileResolver: ProfileResolver;
    authTokenCache: AuthTokenCache;
}

export type RpcBody = string | object;

export async function liteFetch<T extends RpcBody>( url: string, request: T, authContext?: AuthContext, requestInit: RequestInit = {} ): Promise<JsonFetchResult> {

    const authTokenResolver = async ( agenticChallenge: AgenticChallenge ) => {
        if( !authContext )
            throw new Error('Authorization requested, but no auth context provided');

        const { agentDid, profileResolver } = authContext;

        return await generateAuthToken({
            agentDid,
            agenticChallenge,
            profileResolver
        })
    }

    // TODO: (maybe)signal both single JSON RPC response and SSE responses are acceptable
    requestInit.headers = new Headers( requestInit.headers ?? {} );
    requestInit.headers.set('Accept', 'application/json');  // text/event-stream is NOT supported by this client

    //log.info( 'liteFetch()', prettyJson({url, request, requestInit}) );
    const fetchResult = await fetchJsonRpc(
        url,
        request,
        { authTokenResolver, authTokenCache: authContext?.authTokenCache },
        requestInit
    );
    
    const { status, statusText } = fetchResult.fetchResponse ?? {};
    if( !status || status < 200 || status >= 300 )
        throw new Error(`Failed to send request to ${url}: ${status} ${statusText}`);

    return fetchResult;
}
