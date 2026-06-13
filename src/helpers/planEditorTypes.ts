export interface PlanStep {
    order: number;
    action: 'read' | 'analyze' | 'modify' | 'create' | 'delete' | 'run_command';
    target: string;
    rationale: string;
    completed?: boolean;
    agent?: string;
    notes?: string;
}

export interface ExecutionPlan {
    taskId: number;
    steps: PlanStep[];
    expectedOutcome: string;
    filesRead: string[];
    filesToModify: string[];
    verificationCriteria: string[];
    confidence: number;
    designDoc?: string;
    codePlanning?: string;
    approved?: boolean;
    classDependencies?: {
        name: string;
        type: string;
        dependsOn: string[];
        description: string;
    }[];
    tradeoffs?: {
        task: string;
        considerations: string;
        decision: string;
    }[];
    consequences?: {
        failureMode: string;
        consequence: string;
        harm: string;
        mitigation: string;
    }[];
    planningTradeoffs?: {
        task: string;
        considerations: string;
        decision: string;
    }[];
    planningConsequences?: {
        failureMode: string;
        consequence: string;
        harm: string;
        mitigation: string;
    }[];
}

export interface InteractivePlanEditorProps {
    taskId: number;
}

export type ActiveTab = 'overview' | 'steps' | 'flow' | 'doc' | 'planning' | 'tradeoffs' | 'consequences';
export type PlanningSubTab = 'blueprints' | 'tradeoffs' | 'consequences';

export interface ParsedComment {
    id: string;
    body: string;
    context: string;
    rawBlock: string;
}

export interface SelectedTextInfo {
    text: string;
    start: number;
    end: number;
    isTextarea: boolean;
    x: number;
    y: number;
}
