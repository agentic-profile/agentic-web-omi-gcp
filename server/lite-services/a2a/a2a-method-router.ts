import { handleA2aSendMessage } from './handle-send-message.js';
import { jrpcError } from '@agentic-profile/a2a-mcp-express';
import log from '../../utils/log.ts';
import {
    JsonRpcRequest, 
    JsonRpcRequestContext, 
    JsonRpcResponse
} from '@agentic-profile/a2a-mcp-express';

export async function handleA2aMethod(jrpcRequest: JsonRpcRequest, context: JsonRpcRequestContext): Promise<JsonRpcResponse> {
    const method = jrpcRequest.method;
    if (method === 'SendMessage')
        return await handleA2aSendMessage(jrpcRequest, context);

    log.warn('Invalid A2A method called', JSON.stringify(jrpcRequest, null, 2).slice(0, 1000));
    return jrpcError(jrpcRequest.id, -32600, `Invalid JsonRPC method: ${method}`);
}