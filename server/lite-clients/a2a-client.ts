import { JsonFetchResult } from "@agentic-profile/a2a-mcp-express";
import { liteFetch } from "./client.js";
import { AuthContext } from "./client.js";

export type A2aRequest = {
    id: string | number;
    method: string;
    params?: any;
}

export async function a2aFetch( url: string, mcpRequest: A2aRequest, authContext?: AuthContext, requestInit: RequestInit = {} ): Promise<JsonFetchResult> {
    return await liteFetch<A2aRequest>( url, mcpRequest, authContext, requestInit );
}

export function createA2aSendMessageRequest( message: any ): A2aRequest {
    return {
        id: Date.now().toString(),
        method: 'SendMessage',
        params: {
            message
        }
    }
}

export function createA2aStartTaskRequest( args: any ): A2aRequest {
    return {
        id: Date.now().toString(),
        method: 'CreateTask',
        params: {
            task: {
                ...args
            }
        }
    }
}
