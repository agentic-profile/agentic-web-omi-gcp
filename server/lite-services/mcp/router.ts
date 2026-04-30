import {
    jrpcError,
    jrpcErrorAuthRequired,
    JsonRpcRequestContext,
    JsonRpcRequest,
    JsonRpcResponse,
} from "@agentic-profile/a2a-mcp-express";
import log from "../../utils/log.ts";
import { handleStartChat } from "./handle-start-chat.js";
import { handleUpdateResolution } from "./handle-update-resolution.js";


export async function toolsCall(
    req: JsonRpcRequest,
    context: JsonRpcRequestContext
): Promise<JsonRpcResponse> {
    const { name } = req.params || {};

    log.debug("🔍 handleToolsCall", name, context.session);
    const { session } = context;
    if (!session)
        return jrpcErrorAuthRequired(req.id!);

    switch (name) {
        case "start_chat":
            return await handleStartChat(req, context);
        case "update_chat_resolution":
            return await handleUpdateResolution(req, context);
        default:
            return jrpcError(req.id!, -32601, `Tool ${name} not found`);
    }
}
