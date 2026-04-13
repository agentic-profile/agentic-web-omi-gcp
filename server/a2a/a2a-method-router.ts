import { handleA2aSendMessage } from './handle-a2a-send-message.js';
import { jrpcError } from '@agentic-profile/a2a-mcp-express';
import log from '../utils/log.js';
import {
    JsonRpcRequest, 
    JsonRpcRequestContext, 
    JsonRpcResponse
} from '@agentic-profile/a2a-mcp-express';
import { handleA2aCreateTask } from './handle-a2a-create-task.ts';

export async function handleA2aMethod(jrpcRequest: JsonRpcRequest, context: JsonRpcRequestContext): Promise<JsonRpcResponse> {
    try {
        if (jrpcRequest.method === 'SendMessage')
            return await handleA2aSendMessage(jrpcRequest, context);
        if (jrpcRequest.method === 'CreateTask')
            return await handleA2aCreateTask(jrpcRequest, context);

        log.warn('Invalid A2A method called', JSON.stringify(jrpcRequest, null, 2).slice(0, 1000));
        return jrpcError(jrpcRequest.id, -32600, 'Invalid method');
    } catch (err) {
        log.error('A2A handler threw:', err);
        throw err;
    }
}