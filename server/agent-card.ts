export type AgentCardProps = {
  url: string
}

export function agentCard({url}: AgentCardProps): any {
    return {
        name: 'Omi + Agentic Web by Matchwise',
        description: 'Service that uses Omi to learn about a person and help them connect with outhers',
        provider: {
            organization: 'Matchwise',
            url: 'https://matchwise.ai'
        },
        version: '0.0.9',
        capabilities: {
            streaming: false, // The new framework supports streaming
            pushNotifications: false, // Assuming not implemented for this agent yet
            //stateTransitionHistory: false, // Agent uses history
        },
        supportedInterfaces: [
            {
                protocolBinding: 'JSONRPC',
                protocolVersion: '2.0',
                url
            }
        ],
        // authentication: null, // Property 'authentication' does not exist on type 'AgentCard'.
        securitySchemes: undefined, // Or define actual security schemes if any
        defaultInputModes: ['text'],
        defaultOutputModes: ['text'], // task-status is a common output mode
        skills: [
            {
                id: 'determine_agent_matching',
                name: 'Determine Agent Matching',
                description: 'Ask questions of the agent to determine if it is a good match for the user',
                tags: ['agent', 'matching'],
                examples: [
                    'Describe your exceptional achievement.',
                ],
                inputModes: ['text'],
                outputModes: ['text']
            },
        ]
    };
}
