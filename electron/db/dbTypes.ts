export interface ConversationRow {
    id: string;
    title: string;
    model: string;
    provider: string;
    created_at: string;
    updated_at: string;
}

export interface ChatMessageRow {
    id: number;
    conversation_id: string;
    role: string;
    content: string;
    created_at: string;
}

export interface AgentRow {
    id: number;
    name: string;
    system_prompt: string;
    created_at: string;
}

export interface FlowRow {
    id: number;
    name: string;
    description: string;
    steps: string;
    agent_id: number;
    agent_name?: string;
    created_at: string;
}

export interface CustomProviderRow {
    id: string;
    name: string;
    base_url: string;
    api_key: string | null;
    is_local: number;
    created_at: string;
}

export interface CustomModelRow {
    id: number;
    provider_id: string;
    model_name: string;
    has_thinking: number;
}

export interface AgentRuleRow {
    id: number;
    name: string;
    content: string;
    is_active: number;
    created_at: string;
}

export interface MemoryRow {
    id: number;
    type: string;
    content: string;
    created_at: string;
    updated_at: string;
}

export interface SnapshotRow {
    id: number;
    name: string;
    created_at: string;
}

export interface SnapshotFileRow {
    file_path: string;
    content: string;
}

export interface TaskRow {
    id: number;
    title: string;
    description: string | null;
    status: string;
    priority: number;
    parent_task_id: number | null;
    assigned_agent_id: number | null;
    created_by: string;
    context_budget: number;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
}

export interface TaskOutputRow {
    id: number;
    task_id: number;
    agent_id: number | null;
    output_type: string;
    content: string;
    token_count: number;
    model_used: string | null;
    provider_used: string | null;
    verification_status: string;
    created_at: string;
}

export interface TaskPlanRow {
    id: number;
    task_id: number;
    plan_json: string;
    status: string;
    confidence: number;
    created_at: string;
}

export interface TaskDocRow {
    id: number;
    task_id: number;
    title: string;
    content: string;
    doc_type: string;
    generated_by: string;
    created_at: string;
    updated_at: string;
}

export interface ExecutionAttemptRow {
    id: number;
    task_id: number;
    attempt_number: number;
    model_used: string | null;
    provider_used: string | null;
    plan_id: number | null;
    output_id: number | null;
    verification_status: string;
    failure_reason: string | null;
    created_at: string;
}

export interface VerificationRuleRow {
    id: number;
    name: string;
    description: string;
    rule_type: string;
    trigger_on: string;
    config: object;
    applies_to: string;
    created_at: string;
}

export interface VerificationResultRow {
    id: number;
    task_output_id: number;
    rule_id: number;
    result: string;
    score: number;
    details: string;
    verified_by: string;
    created_at: string;
}

export interface KnowledgeChunkRow {
    id: number;
    source_type: string;
    source_id: string;
    content: string;
    metadata: object;
    token_count: number;
    created_at: string;
}

export interface ModelPerformanceRow {
    id: number;
    model: string;
    provider: string;
    task_type: string;
    success: number;
    attempt_number: number;
    token_count: number;
    latency_ms: number;
    input_tokens: number;
    output_tokens: number;
    created_at: string;
}
