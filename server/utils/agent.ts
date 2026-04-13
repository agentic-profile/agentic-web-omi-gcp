import { DID, AgenticProfile, AgentService, parseDid, createDidResolver } from "@agentic-profile/common";
//import { resolveAgenticProfilesStore } from "#common/stores/agentic-profiles/index.js";

const didResolver = createDidResolver();

export async function resolveAgenticProfile( did: DID ): Promise<AgenticProfile> {
    const { didDocument, didResolutionMetadata } = await didResolver.resolve( did );
    if( didDocument )
      return didDocument as AgenticProfile;

    throw new Error(`Failed to resolve ${did}: ${didResolutionMetadata}`);

    /*
    const profileStore = resolveAgenticProfilesStore();
    const profile = await profileStore.read(did);
    if( !profile )
        throw new Error(`Agentic profile not found for ${did}`);
    return profile;
    */
}

export interface ResolveAgentResult {
    agenticProfile: AgenticProfile;
    agent: AgentService
    serviceUrl: string
}

export async function resolveAgent( agentDid: DID ): Promise<ResolveAgentResult> {
    const { did, fragment } = parseDid(agentDid);
    const agenticProfile = await resolveAgenticProfile(did);
    const fragmentId = '#' + fragment;
    const agent = agenticProfile.service?.find((e) => e.id === fragmentId);
    if( !agent )
        throw new Error(`Agent service not found for ${did}`);

    const serviceUrl = Array.isArray(agent.serviceEndpoint) ? agent.serviceEndpoint[0] : agent.serviceEndpoint;
    if( !serviceUrl )
        throw new Error(`No service URL found for ${did}`);
    if( typeof serviceUrl !== 'string' )
        throw new Error(`Service URL is not a string for ${did}`);

    return { agenticProfile, agent: agent as AgentService, serviceUrl };
}
