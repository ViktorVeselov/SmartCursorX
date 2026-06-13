import { dbService } from '../db';
import { aiService } from './AIService';
import { ContextAssembler } from './ContextAssembler';
import { secureStore } from '../secureStore';
import { ExecutionPlanSchema } from './ai';
import type { ExecutionPlan } from './ai';
import console from 'console';

export type { ExecutionPlan, PlanStep, Tradeoff, Consequence } from './ai';

const MAX_PLAN_RETRIES = 3;

export class PlanningService {
    /**
     * Generates a structured multi-step execution plan for a given task.
     * Uses Vercel AI SDK's generateObject with Zod schema for robust structured output.
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

=== ZERO-ASSUMPTION PLANNING POLICY ===
1. Evidence-Based: Base your plan steps on facts/code files that you have explicitly verified. No guessing.
2. Assumption Identification: Scrutinize all assumptions (e.g., assuming a file exists, assuming a function signature).
3. Explicit Uncertainty: List files to read first to resolve any uncertainty before planning code modifications.

Task Information:
Title: ${task.title}
Description: ${task.description || 'No description provided'}

Workspace Context:
${assembled.systemPrompt}

For "tradeoffs": You MUST consider at least 3 distinct architectural/design options (preferably 5). These are HIGH-LEVEL design decisions — do NOT descend into code-level implementation details (those belong in the code planning phase). Analyze real design alternatives like:
  - Database technology and schema design choices
  - IPC mechanism and process boundary decisions
  - Security architecture: auth strategy, key management, sandboxing model
  - State management: centralized vs distributed, persistence strategy
  - Third-party dependency selection and integration approach
  - Deployment and configuration architecture
  - Monitoring, logging, and observability strategy
For each, compare pros, cons, complexity, security implications, and maintenance burden, then state the final decision and why it was chosen.

For "consequences": You MUST include at least 3 entries. Think critically about what can actually go wrong at the SYSTEM level (not code-level bugs — those belong in the code planning phase). For each consequence, analyze:
- The specific failure mode (e.g., data breach, service outage, compliance violation)
- The direct consequence (e.g., key exposure, data loss, privilege escalation)
- Security & harm analysis: How this specifically affects the end user AND the organization
- The mitigation or guard that the plan includes to prevent or minimize this risk`;

        const userModel = secureStore.getSelectedModel();

        let lastError: Error | null = null;

        if (!aiService.isActive()) {
            throw new Error('[PlanningService] AI provider not active. Cannot generate plan.');
        }

        for (let attempt = 1; attempt <= MAX_PLAN_RETRIES; attempt++) {
            try {
                const plan = await aiService.generateObject(
                    ExecutionPlanSchema,
                    [{ role: 'user' as const, content: prompt }],
                    {
                        temperature: attempt === 3 ? 0.3 : 0.1,
                        model: userModel,
                    }
                );

                plan.taskId = taskId;
                dbService.addTaskPlan(taskId, JSON.stringify(plan), plan.confidence, 'draft');
                return plan;
            } catch (e) {
                lastError = e instanceof Error ? e : new Error(String(e));
                console.warn(`[PlanningService] Attempt ${attempt}/${MAX_PLAN_RETRIES} failed`, lastError.message);

                if (attempt < MAX_PLAN_RETRIES) {
                    console.log(`[PlanningService] Retrying attempt ${attempt + 1}/${MAX_PLAN_RETRIES}...`);
                }
            }
        }

        throw new Error(
            `[PlanningService] Plan generation failed after ${MAX_PLAN_RETRIES} attempts. ` +
            `Model: ${userModel}, Provider: ${aiService.providerId}. ` +
            `Last error: ${lastError?.message || 'Unknown error'}. ` +
            `Please check that your selected model supports structured JSON output or try a different model.`
        );
    }
}
