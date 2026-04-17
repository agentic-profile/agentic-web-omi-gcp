import type {
    ClientAgentSession,
    ClientAgentSessionUpdate
} from "@agentic-profile/auth";
import type { ClientAgentSessionStore } from "@agentic-profile/auth";

export class ClientAgentSessionsMemoryStore implements ClientAgentSessionStore {
    private nextId = 1;
    private rows = new Map<number, ClientAgentSession>();

    async create ( challenge: string ) {
        const id = this.nextId++;
        const row = {
            id,
            created: new Date(),
            challenge
        } as ClientAgentSession;
        this.rows.set( id, row );
        return id;
    }

    async read( id: number ) {
        const r = this.rows.get( id );
        return r ? { ...r } : undefined;
    }

    async update( id: number, updates: ClientAgentSessionUpdate ) {
        const r = this.rows.get( id );
        if( !r )
            return false;
        
        if( updates.agentDid !== undefined )
            r.agentDid = updates.agentDid;
        if( updates.authToken !== undefined )
            r.authToken = updates.authToken;

        return true;
    }

    async delete( id: number ) {
        this.rows.delete( id );
    }
}
