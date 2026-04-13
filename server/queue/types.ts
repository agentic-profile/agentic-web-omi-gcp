import { DID, UserID } from "@agentic-profile/common";


export type QueueMessageResult = {
    result: any;
}

export interface QueueMessageHandler {
    ( message: QueueMessage, event: any ): Promise<void>;
}

export interface MessageQueue {
    queueMessage: ( message: QueueMessage ) => Promise<QueueMessageResult>;
}

export type QueueMessage = StartChatQueueMessage; // | StartNearbyChatsMessage;

export interface StartChatQueueMessage {
    type: 'start-chat';
    taskId: string;
    uid: UserID;
    agentDid: DID;
    peerDid: DID;
}
