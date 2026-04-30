/**
 * MCP tool schema for the dashboard service — aligned with
 * `matchwise-foundation-agents` `dashboard-client.ts` (`UpdateDashboardPayload`).
 */
export const MCP_TOOLS = [
    {
        name: "update",
        description: "Push chat state and/or a user-visible notification to the dashboard",
        inputSchema: {
            type: "object",
            properties: {
                chat: {
                    type: "object",
                    description:
                        "Identifies the chat (AgentPair) and optional incremental fields for the agent-chats store",
                    properties: {
                        agentDid: {
                            type: "string",
                            description: "DID of the user’s agent for this chat (must match the authenticated session)",
                        },
                        peerDid: {
                            type: "string",
                            description: "DID of the peer agent in this chat",
                        },
                        messages: {
                            type: "array",
                            description:
                                "Optional message append list (same semantics as agent-chats UpdateAgentChatParams.messages)",
                        },
                        agentResolution: {
                            description:
                                "Optional resolution for the local agent; null clears stored value",
                        },
                        peerResolution: {
                            description:
                                "Optional resolution for the peer; null clears stored value",
                        },
                        manageUrl: {
                            type: "string",
                            description:
                                "Optional URL for the user to open/manage this chat in the app; null clears stored value",
                        },
                    },
                    required: ["agentDid", "peerDid"],
                },
                notification: {
                    type: "object",
                    description: "Optional in-app notification for the user",
                    properties: {
                        title: { type: "string" },
                        subtitle: { type: "string" },
                        body: { type: "string" },
                        url: { type: "string" },
                    },
                    required: ["title", "body"],
                },
            },
        },
    },
];
