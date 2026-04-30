import { v4 as uuidv4 } from 'uuid';

export function generateTaskComplete( contextId: string, manageUrl?: string ) {
    return {
        task: {
            id: uuidv4(),
            contextId,
            status: {
                state: "TASK_STATE_COMPLETED",
            },
            manageUrl
        }
    };
}