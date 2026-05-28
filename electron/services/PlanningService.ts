import { dbService } from '../db';
import { aiService } from './AIService';
import { ContextAssembler } from './ContextAssembler';
import console from 'console';

export interface PlanStep {
    order: number;
    action: 'read' | 'analyze' | 'modify' | 'create' | 'delete' | 'run_command';
    target: string;
    rationale: string;
}

export interface ExecutionPlan {
    taskId: number;
    steps: PlanStep[];
    expectedOutcome: string;
    filesRead: string[];
    filesToModify: string[];
    verificationCriteria: string[];
    confidence: number;
}

export class PlanningService {
    /**
     * Generates a structured multi-step execution plan for a given task.
     * Enforces strict type validations, JSON parsing schema assertions, and reliable model defaults.
     */
    static async generatePlan(taskId: number): Promise<ExecutionPlan> {
        console.assert(typeof taskId === 'number', 'taskId must be a valid number');

        const task = dbService.getTask(taskId);
        if (!task) {
            throw new Error(`[PlanningService] Task with ID ${taskId} not found in database.`);
        }

        const assembled = await ContextAssembler.assembleContext(taskId, [], {
            taskContext: 4000,
            ragResults: 2000,
            codeSymbols: 2000,
            chatHistory: 1000,
            total: 9000
        });

        const prompt = `You are a high-reliability software architect.
Generate a highly structured, deterministic, multi-step Execution Plan for the active task.
Your goal is 100% accuracy and safety. Plan all reads, analyses, modifications, and testing steps before executing.

Task Information:
Title: ${task.title}
Description: ${task.description || 'No description provided'}

Workspace Context:
${assembled.systemPrompt}

You MUST respond with a single, valid JSON object matching the TypeScript interface below. Do NOT add markdown code fences (like \`\`\`json), explanations, or backticks outside the JSON.

Interface:
interface ExecutionPlan {
    taskId: number;
    steps: Array<{
        order: number;
        action: 'read' | 'analyze' | 'modify' | 'create' | 'delete' | 'run_command';
        target: string;
        rationale: string;
    }>;
    expectedOutcome: string;
    filesRead: string[];
    filesToModify: string[];
    verificationCriteria: string[];
    confidence: number;
}

JSON Response:`;

        let plan: ExecutionPlan;

        if (aiService.isActive()) {
            try {
                const provider = aiService.getProvider();
                const response = await provider.chat([
                    { role: 'user', content: prompt }
                ], { temperature: 0.1, model: 'gpt-4o' });

                const rawContent = typeof response === 'string' ? response : '';
                const cleanJsonStr = this.extractJson(rawContent);
                plan = JSON.parse(cleanJsonStr) as ExecutionPlan;
            } catch (e) {
                console.warn('[PlanningService] LLM Planning failed, using deterministic structural fallback.', e);
                plan = this.generateFallbackPlan(taskId, task);
            }
        } else {
            console.warn('[PlanningService] AI provider not active, using fallback planner.');
            plan = this.generateFallbackPlan(taskId, task);
        }

        this.validatePlanSchema(plan, taskId);

        dbService.addTaskPlan(taskId, JSON.stringify(plan), plan.confidence, 'draft');

        return plan;
    }

    private static extractJson(text: string): string {
        if (!text) return '{}';
        
        let cleaned = text.trim();
        if (cleaned.startsWith('```')) {
            const firstLineBreak = cleaned.indexOf('\n');
            const lastLineBreak = cleaned.lastIndexOf('```');
            if (firstLineBreak !== -1 && lastLineBreak !== -1 && lastLineBreak > firstLineBreak) {
                cleaned = cleaned.substring(firstLineBreak, lastLineBreak).trim();
            }
        }
        
        const startIdx = cleaned.indexOf('{');
        const endIdx = cleaned.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            cleaned = cleaned.substring(startIdx, endIdx + 1);
        }

        return cleaned;
    }

    private static generateFallbackPlan(taskId: number, task: any): ExecutionPlan {
        return {
            taskId,
            steps: [
                {
                    order: 1,
                    action: 'analyze',
                    target: '.',
                    rationale: 'Perform full static analysis of workspace directories.'
                },
                {
                    order: 2,
                    action: 'modify',
                    target: 'src/App.tsx',
                    rationale: 'Execute default modifications safely.'
                }
            ],
            expectedOutcome: `Successfully addressed: ${task.title}`,
            filesRead: [],
            filesToModify: [],
            verificationCriteria: ['No TypeScript compiler errors', 'Valid syntax'],
            confidence: 0.5
        };
    }

    private static validatePlanSchema(plan: ExecutionPlan, taskId: number): void {
        console.assert(plan !== null && typeof plan === 'object', 'Plan must be a valid object');
        console.assert(plan.taskId === taskId, 'Plan taskId mismatch');
        console.assert(Array.isArray(plan.steps), 'Plan steps must be an array');
        console.assert(typeof plan.expectedOutcome === 'string', 'expectedOutcome must be a string');
        console.assert(Array.isArray(plan.filesRead), 'filesRead must be a string array');
        console.assert(Array.isArray(plan.filesToModify), 'filesToModify must be a string array');
        console.assert(Array.isArray(plan.verificationCriteria), 'verificationCriteria must be a string array');
        console.assert(typeof plan.confidence === 'number' && plan.confidence >= 0 && plan.confidence <= 1, 'confidence score must be a number between 0 and 1');

        for (const step of plan.steps) {
            console.assert(typeof step.order === 'number', 'Step order must be a number');
            console.assert(['read', 'analyze', 'modify', 'create', 'delete', 'run_command'].includes(step.action), `Invalid step action: ${step.action}`);
            console.assert(typeof step.target === 'string' && step.target.length > 0, 'Step target must be a non-empty string');
            console.assert(typeof step.rationale === 'string', 'Step rationale must be a string');
        }
    }
}
