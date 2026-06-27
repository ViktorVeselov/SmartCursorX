import { pipelineService, PipelineTaskType } from './PipelineService';
import { AIService, LLMMessage } from './AIService';

export type PipelineStep = {
    taskType: PipelineTaskType;
    label: string;
    provider: string;
    model: string;
};

export type PipelineExecutionResult = {
    taskType: PipelineTaskType;
    success: boolean;
    output?: string;
    error?: string;
    provider: string;
    model: string;
    latencyMs: number;
};

const STEP_CONFIG: { taskType: PipelineTaskType; label: string }[] = [
    { taskType: 'chat', label: 'Chat' },
    { taskType: 'investigation', label: 'Investigation' },
    { taskType: 'plan_exploration', label: 'Plan Exploration' },
    { taskType: 'plan_generation', label: 'Plan Generation' },
    { taskType: 'read_analyze', label: 'Read/Analyze' },
    { taskType: 'code_generation', label: 'Code Generation' },
    { taskType: 'verification_judge', label: 'Verification Judge' },
    { taskType: 'verification_fix', label: 'Verification Fix' },
];

class PipelineEngineService {
    private static instance: PipelineEngineService;

    private constructor() {}

    static getInstance(): PipelineEngineService {
        if (!PipelineEngineService.instance) {
            PipelineEngineService.instance = new PipelineEngineService();
        }
        return PipelineEngineService.instance;
    }

    resolveSteps(): PipelineStep[] {
        return STEP_CONFIG.map(({ taskType, label }) => {
            const route = pipelineService.getEffectiveRoute(taskType);
            return { taskType, label, provider: route.provider, model: route.model };
        });
    }

    async executeStep(taskType: PipelineTaskType, prompt: string, systemPrompt?: string): Promise<PipelineExecutionResult> {
        const route = pipelineService.getEffectiveRoute(taskType);
        const start = Date.now();
        try {
            const svc = AIService.getForProvider(route.provider);
            const system = route.systemPrompt || systemPrompt;
            const messages: LLMMessage[] = system
                ? [{ role: 'system', content: system }, { role: 'user', content: prompt }]
                : [{ role: 'user', content: prompt }];
            const result = await svc.chat(messages, { model: route.model });
            const text = typeof result === 'object' && 'text' in result ? (result as any).text : String(result);
            return {
                taskType,
                success: true,
                output: text,
                provider: route.provider,
                model: route.model,
                latencyMs: Date.now() - start,
            };
        } catch (err: any) {
            return {
                taskType,
                success: false,
                error: err.message || String(err),
                provider: route.provider,
                model: route.model,
                latencyMs: Date.now() - start,
            };
        }
    }

    async executeFullPipeline(input: string, systemPrompts?: Partial<Record<PipelineTaskType, string>>): Promise<PipelineExecutionResult[]> {
        const steps = this.resolveSteps();
        const results: PipelineExecutionResult[] = [];
        for (const step of steps) {
            const result = await this.executeStep(step.taskType, input, systemPrompts?.[step.taskType]);
            results.push(result);
        }
        return results;
    }

    getStepForTaskType(taskType: PipelineTaskType): PipelineStep {
        const steps = this.resolveSteps();
        const step = steps.find(s => s.taskType === taskType);
        if (!step) throw new Error(`No pipeline step configured for task type: ${taskType}`);
        return step;
    }
}

export const pipelineEngine = PipelineEngineService.getInstance();
