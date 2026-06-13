export interface Agent {
    id: number;
    name: string;
    system_prompt: string;
    created_at: string;
}

export interface Flow {
    id: number;
    name: string;
    description: string;
    steps: unknown;
    agent_id: number;
    agent_name?: string;
    created_at: string;
}

export interface AgentsPanelProps {
    onRunFlow?: (agent: Agent, flow: Flow) => void;
    onOpenFlow?: (flow: Flow) => void;
}
