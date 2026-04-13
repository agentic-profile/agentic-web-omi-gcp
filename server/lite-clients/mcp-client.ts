import { JsonFetchResult } from "@agentic-profile/a2a-mcp-express";
import { liteFetch, AuthContext } from "./client.js";

export type McpRequest = {
    id: string | number;
    method: string;
    params?: any;
}

export async function mcpFetch( url: string, mcpRequest: McpRequest, authContext?: AuthContext, requestInit: RequestInit = {} ): Promise<JsonFetchResult> {
    return await liteFetch<McpRequest>( url, mcpRequest, authContext, requestInit );
}

export function createMcpToolsCallRequest( name: string, args: any ): McpRequest {
    return {
        id: Date.now().toString(),
        method: 'tools/call',
        params: {
            name,
            arguments: args
        }
    }
}
