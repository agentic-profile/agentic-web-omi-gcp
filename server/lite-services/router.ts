import { Router } from "express";
import { Resolver } from "did-resolver";
import { ClientAgentSessionStore } from "@agentic-profile/auth";
import {
    createA2ALiteRouter, 
    createMcpServiceRouter,
    JsonRpcRequest, JsonRpcRequestContext, JsonRpcResponse
} from "@agentic-profile/a2a-mcp-express";

export interface A2aConfig {
    jrpcRequestHandler: (jrpcRequest: JsonRpcRequest, context: JsonRpcRequestContext) => Promise<JsonRpcResponse>;
    cardBuilder: (props: { url: string}) => any;
}

export interface McpConfig {
    toolsCall: (req: JsonRpcRequest, context: JsonRpcRequestContext) => Promise<JsonRpcResponse>;
    tools: any[];
}

export interface A2aMcpLiteRouterConfig {
    store: ClientAgentSessionStore;
    didResolver: Resolver;
    a2aConfig: A2aConfig;
    mcpConfig: McpConfig;
    requireAuth: boolean;
}

export function createA2aMcpLiteRouter(
    { store, didResolver, a2aConfig, mcpConfig, requireAuth }: A2aMcpLiteRouterConfig
): Router {
    const router: Router = Router();

    router.use('/a2a', createA2ALiteRouter({
        jrpcRequestHandler: a2aConfig.jrpcRequestHandler,
        cardBuilder: a2aConfig.cardBuilder,
        store,
        didResolver,
        requireAuth
    }));

    router.use('/mcp', createMcpServiceRouter({
        handlers: {
            toolsCall: mcpConfig.toolsCall,
        },
        lists: {
            tools: mcpConfig.tools,
        },
        store,
        didResolver,
        routerOptions: { mergeParams: true } // ensure mount-path params (e.g. `/mcp/dashboard/:uid`) are available in handlers.
    }));

    return router;
}
