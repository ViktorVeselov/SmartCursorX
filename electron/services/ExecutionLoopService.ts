import { dbService } from '../db';
import { aiService } from './AIService';
import { VerificationService } from './VerificationService';
import { SnapshotService } from './SnapshotService';
import { PlanningService } from './PlanningService';
import { TaskService } from './TaskService';
import { ContextAssembler } from './ContextAssembler';
import { LearningService } from './LearningService';
import { ASTPatchingService } from './ASTPatchingService';
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
     * Integrates all 5 master framework phases (Pre-flight discovery, Tool masking, JSON AST patching, compiler loops).
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

        const activeTask = dbService.getTask(taskId);
        console.assert(activeTask !== null, 'Active task must exist in DB');
        const modelUsed = activeTask.assigned_agent_id ? 'claude-3-5-sonnet-20241022' : 'gpt-4o';

        // ==========================================================
        // Phase 1 & 2: Pre-Flight Zero-Assumption Investigation Phase
        // ==========================================================
        if (aiService.isActive()) {
            console.log(`[ExecutionLoopService] Triggering Taxonomy Steering: Active Investigation Phase...`);
            const investAssembled = await ContextAssembler.assembleContext(taskId, []);
            const investSystemInstructions = ASTPatchingService.shapeSystemInstructions('investigate', investAssembled.systemPrompt);
            const investPrompt = `Analyze the requirements for Task: "${activeTask.title}" and plan modifications.
1. Trace and check all dependency signatures and database schema constraints.
2. Outline a deterministic "Assumption Matrix" inside a scratchpad block.
3. Validate that you are ready and have no blind spots. Do NOT propose code changes yet.`;

            const provider = aiService.getProvider();
            await provider.chat([
                { role: 'system', content: investSystemInstructions },
                { role: 'user', content: investPrompt }
            ], { temperature: 0.1, model: modelUsed });
            console.log(`[ExecutionLoopService] Active Investigation completed successfully. Zero-Blind-Spots verified.`);
        }

        // ==========================================================
        // Modification and Compiler-Audited Self-Healing Loops
        // ==========================================================
        while (attempt <= config.maxRetries) {
            console.log(`[ExecutionLoopService] Starting Execution Attempt ${attempt}/${config.maxRetries}...`);
            
            try {
                if (attempt > 1) {
                    console.log(`[ExecutionLoopService] Resetting files to pre-execution state for clean retry attempt.`);
                    SnapshotService.rollbackToSnapshot(preSnapshotId);
                }

                const assembled = await ContextAssembler.assembleContext(taskId, []);
                
                // Expose ONLY modify instructions and ask for JSON AST Patch!
                let systemInstructions = ASTPatchingService.shapeSystemInstructions('modify', assembled.systemPrompt);
                
                if (attempt > 1 && failureFeedback) {
                    // Inject Compiler-Audited Self-Healing instructions!
                    const fileExt = filesToModify.length > 0 ? path.extname(filesToModify[0]) : '';
                    systemInstructions = ASTPatchingService.shapeSystemInstructions('verify', assembled.systemPrompt, fileExt);
                    systemInstructions += `\n\n⚠️ PREVIOUS ATTEMPT FAILED VERIFICATION!\n` +
                        `Error & Feedback:\n${failureFeedback}\n` +
                        `Analyze the compiler logs and linter errors above, self-correct your mistakes, and write a repaired JSON AST patch.`;
                }

                const tempWithEscalation = config.baseTemperature + (attempt - 1) * 0.1;
                let responseContent = '';

                if (aiService.isActive()) {
                    const provider = aiService.getProvider();
                    const prompt = `Task Title: ${activeTask.title}
Task Details: ${activeTask.description || ''}

Apply the planned file modifications. Expose only the required file modifications using our strict JSON AST Patch format.
Files to modify: ${filesToModify.join(', ')}

Enforce strict type safety and preserve imports. Return ONLY the strict JSON patch block.`;

                    const response = await provider.chat([
                        { role: 'system', content: systemInstructions },
                        { role: 'user', content: prompt }
                    ], { temperature: tempWithEscalation, model: modelUsed });

                    responseContent = typeof response === 'string' ? response : '';
                } else {
                    throw new Error('AI Service is inactive. Code generation impossible.');
                }

                // Apply JSON AST Patch
                let parseSuccess = ASTPatchingService.applyJSONPatch(responseContent);
                if (!parseSuccess) {
                    console.warn(`[ExecutionLoopService] AST JSON Patching failed or returned non-JSON. Falling back to Full-File Markdown Block parser.`);
                    
                    // Graceful fallback to raw files blocks parser
                    parseSuccess = this.applyFileEdits(responseContent);
                    if (!parseSuccess) {
                        throw new Error('Failed parsing target file structures from LLM response (both JSON AST and Full-File fallbacks failed).');
                    }
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

            const workspaceRoot = path.resolve(process.cwd());
            const parentRoot = path.resolve(workspaceRoot, '..');
            
            // Whitelisted multi-root directories (React workspace + Python ADK plugin)
            const allowedRoots = [
                workspaceRoot,
                path.resolve(parentRoot, 'adk-python-community'),
                path.resolve(parentRoot, 'google-sdk')
            ];

            // Normalize slashes and force lowercase on Windows to prevent drive-letter conflicts
            const normalizePathForCompare = (p: string) => {
                let resolved = path.resolve(p);
                if (process.platform === 'win32') {
                    resolved = resolved.toLowerCase();
                }
                return resolved;
            };

            let absolutePath = '';
            let isContained = false;

            for (const root of allowedRoots) {
                const resolvedPath = path.resolve(root, relativePath);
                const normRoot = normalizePathForCompare(root);
                const normResolved = normalizePathForCompare(resolvedPath);
                
                const relative = path.relative(normRoot, normResolved);
                const contained = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
                if (contained) {
                    absolutePath = resolvedPath;
                    isContained = true;
                    break;
                }
            }

            if (!isContained) {
                console.error(`[ExecutionLoopService] Safety Block: Out-of-bounds file edit rejected: ${relativePath} (Tried roots: ${allowedRoots.join(', ')})`);
                return false;
            }

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
