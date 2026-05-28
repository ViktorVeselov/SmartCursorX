import { dbService } from '../db';
import { aiService } from './AIService';
import { VerificationService } from './VerificationService';
import { SnapshotService } from './SnapshotService';
import { PlanningService } from './PlanningService';
import { TaskService } from './TaskService';
import { ContextAssembler } from './ContextAssembler';
import { LearningService } from './LearningService';
import * as fs from 'fs';
import * as path from 'path';
import console from 'console';

export interface ExecutionConfig {
    maxRetries: number;
    baseTemperature: number;
    escalateModel: boolean;
}

export class ExecutionLoopService {
    /**
     * Executes a task through the complete planned plan-execute-verify self-healing loop.
     */
    static async executeTask(taskId: number, config: ExecutionConfig = { maxRetries: 3, baseTemperature: 0.0, escalateModel: true }): Promise<'passed' | 'failed'> {
        console.assert(typeof taskId === 'number', 'taskId must be a valid number');
        console.assert(config.maxRetries > 0, 'maxRetries must be positive');

        console.log(`[ExecutionLoopService] Initiating execution loop for task ID ${taskId}...`);
        
        let planRow = dbService.getTaskPlan(taskId);
        if (!planRow) {
            console.log(`[ExecutionLoopService] No plan found for task ID ${taskId}. Generating plan...`);
            await PlanningService.generatePlan(taskId);
            planRow = dbService.getTaskPlan(taskId);
        }
        
        console.assert(planRow !== null, 'Plan must be successfully generated and present in DB');
        const plan = JSON.parse(planRow!.plan_json);
        const filesToModify = plan.filesToModify || [];

        const preSnapshotId = SnapshotService.captureSnapshot(taskId, filesToModify, 'pre_execution');

        let attempt = 1;
        let success = false;
        let finalOutputStatus: 'passed' | 'failed' | 'needs_review' = 'failed';
        let failureFeedback = '';

        const startTime = Date.now();

        while (attempt <= config.maxRetries) {
            console.log(`[ExecutionLoopService] Starting Execution Attempt ${attempt}/${config.maxRetries}...`);
            
            try {
                if (attempt > 1) {
                    console.log(`[ExecutionLoopService] Resetting files to pre-execution state for clean retry attempt.`);
                    SnapshotService.rollbackToSnapshot(preSnapshotId);
                }

                const assembled = await ContextAssembler.assembleContext(taskId, []);
                
                let systemInstructions = assembled.systemPrompt;
                if (attempt > 1 && failureFeedback) {
                    systemInstructions += `\n\n⚠️ PREVIOUS ATTEMPT FAILED VERIFICATION!\n` +
                        `Error & Feedback:\n${failureFeedback}\n` +
                        `Analyze the compiler logs and linter errors above, self-correct your mistakes, and rewrite the changes accurately.`;
                }

                const activeTask = dbService.getTask(taskId);
                console.assert(activeTask !== null, 'Active task must exist in DB');

                const temp = config.baseTemperature + (attempt - 1) * 0.1;
                const modelUsed = activeTask.assigned_agent_id ? 'claude-3-5-sonnet-20241022' : 'gpt-4o';

                let responseContent = '';

                if (aiService.isActive()) {
                    const provider = aiService.getProvider();
                    const prompt = `Task Title: ${activeTask.title}
Task Details: ${activeTask.description || ''}

Apply the planned file modifications directly. For each file in the plan list (${filesToModify.join(', ')}), specify the changes clearly.
Write the complete file content for each modified file so we can update the workspace deterministically.

Return your response inside a structured block like:
=== FILE: filepath ===
[entire file content]
=== END FILE ===

Make sure to preserve imports, type definitions, and enforce strict type safety without banned implicit 'any' types.`;

                    const response = await provider.chat([
                        { role: 'system', content: systemInstructions },
                        { role: 'user', content: prompt }
                    ], { temperature: temp, model: modelUsed });

                    responseContent = typeof response === 'string' ? response : '';
                } else {
                    throw new Error('AI Service is inactive. Code generation impossible.');
                }

                const parseSuccess = this.applyFileEdits(responseContent);
                if (!parseSuccess) {
                    throw new Error('Failed parsing target file structures from LLM response.');
                }

                const outputId = TaskService.completeTask(
                    taskId,
                    responseContent,
                    activeTask.assigned_agent_id,
                    'code',
                    Math.ceil(responseContent.length / 4),
                    modelUsed,
                    aiService.isActive() ? aiService.getProvider().id : 'fallback'
                );

                finalOutputStatus = await VerificationService.verifyOutput(outputId);

                dbService.addExecutionAttempt(
                    taskId,
                    attempt,
                    modelUsed,
                    aiService.isActive() ? aiService.getProvider().id : 'fallback',
                    Number(planRow.id),
                    outputId,
                    finalOutputStatus,
                    finalOutputStatus === 'passed' ? null : 'Failed verification rules'
                );

                if (finalOutputStatus === 'passed') {
                    success = true;
                    console.log(`[ExecutionLoopService] Attempt ${attempt} passed all verification checks!`);
                    
                    dbService.addModelPerformance(
                        modelUsed,
                        aiService.isActive() ? aiService.getProvider().id : 'fallback',
                        'code_edit',
                        1,
                        attempt,
                        Math.ceil(responseContent.length / 4),
                        Date.now() - startTime
                    );

                    break;
                } else {
                    const verificationLogs = dbService.getVerificationResults(outputId);
                    const failedLogs = verificationLogs.filter((l: any) => l.result === 'failed');
                    failureFeedback = failedLogs.map((l: any) => `Rule Check failed: ${l.details || 'No details provided'}`).join('\n');
                    console.warn(`[ExecutionLoopService] Attempt ${attempt} failed verification. Details:\n${failureFeedback}`);
                }

            } catch (err: any) {
                console.error(`[ExecutionLoopService] Exception on attempt ${attempt}:`, err);
                failureFeedback = `Execution Exception occurred: ${err.message || err}`;
                
                dbService.addExecutionAttempt(
                    taskId,
                    attempt,
                    'none',
                    'none',
                    Number(planRow.id),
                    null,
                    'failed',
                    failureFeedback
                );
            }

            attempt++;
        }

        if (success) {
            dbService.updateTaskStatus(taskId, 'completed');
            dbService.addTaskDoc(taskId, 'Completion Report', `Task successfully completed and verified on attempt ${attempt - 1}.`, 'completion');
            
            await LearningService.captureLearning(taskId).catch(err => {
                console.error('[ExecutionLoopService] LearningService capture failed:', err);
            });

            return 'passed';
        } else {
            console.error(`[ExecutionLoopService] Task ID ${taskId} failed after exhausting ${config.maxRetries} attempts.`);
            
            console.log('[ExecutionLoopService] Restoring workspace to pristine pre-execution snapshot.');
            SnapshotService.rollbackToSnapshot(preSnapshotId);

            dbService.updateTaskStatus(taskId, 'failed');
            TaskService.failTask(taskId, `Failed all self-healing verification checks up to ${config.maxRetries} attempts. Details: ${failureFeedback}`);
            
            await LearningService.captureLearning(taskId).catch(err => {
                console.error('[ExecutionLoopService] LearningService capture failed on failure block:', err);
            });

            throw new Error(`[ExecutionLoopService] Safety threshold reached: task ${taskId} could not compile or pass validation. Rollback triggered.`);
        }
    }

    private static applyFileEdits(response: string): boolean {
        if (!response) return false;

        const fileBlockRegex = /===\s*FILE:\s*([^\s=]+)\s*===([\s\S]*?)===\s*END FILE\s*===/gi;
        let match;
        let parsedAny = false;

        while ((match = fileBlockRegex.exec(response)) !== null) {
            const relativePath = match[1].trim();
            const rawContent = match[2];
            const cleanContent = rawContent.replace(/^\r?\n/, '').replace(/\r?\n\s*$/, '');

            const absolutePath = path.resolve(relativePath);
            try {
                const parentDir = path.dirname(absolutePath);
                if (!fs.existsSync(parentDir)) {
                    fs.mkdirSync(parentDir, { recursive: true });
                }

                fs.writeFileSync(absolutePath, cleanContent, 'utf-8');
                console.log(`[ExecutionLoopService] Successfully applied file update: ${relativePath}`);
                parsedAny = true;
            } catch (err) {
                console.error(`[ExecutionLoopService] Failed writing file edits to disk: ${relativePath}`, err);
                return false;
            }
        }

        return parsedAny;
    }
}
