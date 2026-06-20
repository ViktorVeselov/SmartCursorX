import { dbService } from '../db';
import { aiService } from './AIService';
import { VerificationService } from './VerificationService';
import { SnapshotService } from './SnapshotService';
import { PlanningService } from './PlanningService';
import { TaskService } from './TaskService';
import { ContextAssembler } from './ContextAssembler';
import { LearningService } from './LearningService';
import { PathGuard } from './PathGuard';
import { ASTPatchingService } from './ASTPatchingService';
import { PendingModificationsService } from './PendingModificationsService';
import { EmbeddingService } from './EmbeddingService';
import { secureStore } from '../secureStore';
import { taxonomyService } from './taxonomy/TaxonomyService';
import * as fs from 'fs';
import * as path from 'path';
import console from 'console';
import { BrowserWindow } from 'electron';

export interface ExecutionConfig {
    maxRetries: number;
    baseTemperature: number;
    escalateModel: boolean;
    userGuidance?: string;
}

interface DlqEntry {
    resolve: (guidance: string | null) => void;
    taskId: number;
    failureFeedback: string;
    attemptHistory: string[];
}

export class ExecutionLoopService {
    private static dlqEntries = new Map<number, DlqEntry>();
    private static abortControllers = new Map<number, AbortController>();

    private static sendProgress(taskId: number, phase: string, message: string, attempt?: number, totalAttempts?: number): void {
        const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
        if (mainWindow) {
            mainWindow.webContents.send('execution:progress', { taskId, phase, message, attempt, totalAttempts });
        }
    }

    static stopExecution(taskId: number): void {
        const controller = this.abortControllers.get(taskId);
        if (controller) {
            controller.abort();
            this.abortControllers.delete(taskId);
        }
        this.sendProgress(taskId, 'stopped', 'Execution stopped by user');
        PendingModificationsService.removePending(taskId);
    }

    static setDlqResolver(taskId: number, resolve: (guidance: string | null) => void, failureFeedback: string, attemptHistory: string[]): void {
        this.dlqEntries.set(taskId, { resolve, taskId, failureFeedback, attemptHistory });
    }

    static resolveDlq(taskId: number, guidance: string | null): void {
        const entry = this.dlqEntries.get(taskId);
        if (entry) {
            this.dlqEntries.delete(taskId);
            entry.resolve(guidance);
        }
    }
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
        let attemptHistory: string[] = [];

        const startTime = Date.now();

        const activeTask = dbService.getTask(taskId);
        console.assert(activeTask !== null, 'Active task must exist in DB');
        const modelUsed = secureStore.getSelectedModel();

        const abortController = new AbortController();
        this.abortControllers.set(taskId, abortController);
        const checkAborted = () => {
            if (abortController.signal.aborted) throw new Error('EXECUTION_STOPPED');
        };

        this.sendProgress(taskId, 'investigating', 'Analyzing dependencies and assumptions...');
        let investText = '';
        investText = await this.performInvestigation(taskId, activeTask, modelUsed, startTime);
        checkAborted();

        // ==========================================================
        // Modification and Compiler-Audited Self-Healing Loops
        // ==========================================================
        while (attempt <= config.maxRetries) {
            checkAborted();
            console.log(`[ExecutionLoopService] Starting Execution Attempt ${attempt}/${config.maxRetries}...`);
            
            try {
                if (attempt > 1) {
                    console.log(`[ExecutionLoopService] Resetting files to pre-execution state for clean retry attempt.`);
                    SnapshotService.rollbackToSnapshot(preSnapshotId);
                }

                const assembled = await ContextAssembler.assembleContext(taskId, [], undefined, undefined, undefined, investText);
                
                if (assembled.taxonomyResult) {
                    try {
                        taxonomyService.trackResult(taskId, assembled.taxonomyResult, 'modify');
                    } catch (e) {
                        console.error('[ExecutionLoopService] Failed to track modify taxonomy:', e);
                    }
                }

                // Expose ONLY modify instructions and ask for JSON AST Patch!
                let systemInstructions = ASTPatchingService.shapeSystemInstructions('modify', assembled.systemPrompt, undefined, assembled.taxonomyResult);
                
                if (config.userGuidance) {
                    systemInstructions += `\n\n⚠️ USER GUIDANCE\n${config.userGuidance}\nAdjust your approach according to this guidance.`;
                }

                if (attempt > 1 && failureFeedback) {
                    // Inject Compiler-Audited Self-Healing instructions!
                    const fileExt = filesToModify.length > 0 ? path.extname(filesToModify[0]) : '';
                    systemInstructions = ASTPatchingService.shapeSystemInstructions('verify', assembled.systemPrompt, fileExt, assembled.taxonomyResult);
                    systemInstructions += `\n\n⚠️ PREVIOUS ATTEMPT FAILED VERIFICATION!\n` +
                        `Error & Feedback:\n${failureFeedback}\n` +
                        `Analyze the compiler logs and linter errors above, self-correct your mistakes, and write a repaired JSON AST patch.`;
                }

                const tempWithEscalation = config.baseTemperature + (attempt - 1) * 0.1;
                let responseContent = '';

                this.sendProgress(taskId, 'generating', 'Generating code changes...', attempt, config.maxRetries);

                if (aiService.isActive()) {
                    const prompt = `Task Title: ${activeTask.title}
Task Details: ${activeTask.description || ''}

Apply the planned file modifications. Expose only the required file modifications using our strict JSON AST Patch format.
Files to modify: ${filesToModify.join(', ')}

Enforce strict type safety and preserve imports. Return ONLY the strict JSON patch block.`;

                    const response = await aiService.chat([
                        { role: 'system', content: systemInstructions },
                        { role: 'user', content: prompt }
                    ], { temperature: tempWithEscalation, model: modelUsed });

                    const chatResp = response as import('./AIService').ChatResponse;
                    responseContent = chatResp.text;
                } else {
                    throw new Error('AI Service is inactive. Code generation impossible.');
                }
                checkAborted();

                // Generate preview patches (does NOT write to disk)
                const previewPatches = ASTPatchingService.generatePreviewPatches(responseContent);
                let parseSuccess = previewPatches.length > 0;

                if (!parseSuccess) {
                    console.warn(`[ExecutionLoopService] AST JSON Preview Patching failed or returned non-JSON. Falling back to Full-File Markdown Block parser.`);

                    // Fallback: use full-file blocks to build preview patches
                    const fallbackPatches = this.generateFallbackPatches(responseContent);
                    if (fallbackPatches.length > 0) {
                        previewPatches.push(...fallbackPatches);
                        parseSuccess = true;
                    }
                }

                if (!parseSuccess) {
                    throw new Error('Failed parsing target file structures from LLM response (both JSON AST Preview and Full-File fallbacks failed).');
                }

                // Store pending modifications and notify renderer for user review
                const totalAdded = previewPatches.reduce((sum, p) => sum + p.addedLines, 0);
                const totalRemoved = previewPatches.reduce((sum, p) => sum + p.removedLines, 0);
                console.log(`[ExecutionLoopService] Generated ${previewPatches.length} file patches (+${totalAdded}/-${totalRemoved}). Awaiting user review...`);

                PendingModificationsService.setPending(taskId, {
                    taskId,
                    modifications: previewPatches,
                    planSnapshot: plan,
                    createdAt: Date.now(),
                });

                // Send notification to renderer
                const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
                if (mainWindow) {
                    mainWindow.webContents.send('execution:pending-modifications', {
                        taskId,
                        modifications: previewPatches.map(m => ({
                            relativePath: m.relativePath,
                            originalContent: m.originalContent,
                            proposedContent: m.proposedContent,
                            addedLines: m.addedLines,
                            removedLines: m.removedLines,
                        })),
                    });
                }

                checkAborted();

                let userAccepted: boolean;
                if (plan.approved) {
                    // Plan mode: auto-apply changes immediately (plan IS the approval)
                    console.log(`[ExecutionLoopService] Plan is approved. Auto-applying modifications...`);
                    this.sendProgress(taskId, 'applying', 'Applying changes...', attempt, config.maxRetries);
                    const applied = PendingModificationsService.applyModifications(taskId);
                    if (!applied) {
                        throw new Error('Failed to auto-apply modifications to disk.');
                    }
                    userAccepted = true;
                } else {
                    // BLOCK execution until user accepts or rejects
                    userAccepted = await new Promise<boolean>((resolve) => {
                        PendingModificationsService.setResolver(taskId, resolve);
                    });
                }

                if (!userAccepted) {
                    throw new Error('User rejected the proposed modifications.');
                }

                if (!plan.approved) {
                    console.log(`[ExecutionLoopService] User accepted modifications. Applying patches to disk...`);
                    // Now apply the patches to disk (using original method)
                    parseSuccess = ASTPatchingService.applyJSONPatch(responseContent);
                    if (!parseSuccess) {
                        // Fallback: apply full-file blocks
                        parseSuccess = this.applyFileEdits(responseContent);
                        if (!parseSuccess) {
                            throw new Error('Failed to write accepted modifications to disk.');
                        }
                    }
                }

                const outputId = TaskService.completeTask(
                    taskId,
                    responseContent,
                    activeTask.assigned_agent_id,
                    'code',
                    Math.ceil(responseContent.length / 4),
                    modelUsed,
                    aiService.isActive() ? aiService.providerId : 'fallback'
                );

                this.sendProgress(taskId, 'verifying', 'Running verification checks...', attempt, config.maxRetries);
                finalOutputStatus = await VerificationService.verifyOutput(outputId, assembled.taxonomyResult);

                dbService.addExecutionAttempt(
                    taskId,
                    attempt,
                    modelUsed,
                    aiService.isActive() ? aiService.providerId : 'fallback',
                    Number(planRow.id),
                    outputId,
                    finalOutputStatus,
                    finalOutputStatus === 'passed' ? null : 'Failed verification rules'
                );

                if (finalOutputStatus === 'passed') {
                    success = true;
                    console.log(`[ExecutionLoopService] Attempt ${attempt} passed all verification checks!`);
                    
                    const providerId = aiService.isActive() ? aiService.providerId : 'fallback';
                    const outputTokens = Math.max(1, Math.ceil(responseContent.length / 4));
                    const latency = Date.now() - startTime;
                    
                    dbService.addModelPerformance(
                        modelUsed,
                        providerId,
                        'code_edit',
                        1,
                        attempt,
                        outputTokens,
                        latency,
                        Math.round(outputTokens * 0.6),
                        outputTokens
                    );

                    break;
                } else {
                    const verificationLogs = dbService.getVerificationResults(outputId);
                    const failedLogs = verificationLogs.filter((l: any) => l.result === 'failed');
                    const attemptFeedback = failedLogs.map((l: any) => `Rule Check failed: ${l.details || 'No details provided'}`).join('\n');
                    failureFeedback = attemptFeedback;
                    attemptHistory.push(`Attempt ${attempt}/${config.maxRetries}: ${attemptFeedback}`);

                    // Store failure in RAG for future reference
                    try {
                        const ragContent = `Task #${taskId} ("${activeTask.title}"): ${attemptFeedback}`;
                        EmbeddingService.indexKnowledge('execution_failure', `task_${taskId}_attempt_${attempt}`, ragContent, { taskId, attempt }).catch(() => {});
                    } catch {
                        // Non-critical
                    }

                    console.warn(`[ExecutionLoopService] Attempt ${attempt} failed verification. Details:\n${failureFeedback}`);
                    if (attempt < config.maxRetries) {
                        this.sendProgress(taskId, 'generating', `Verification failed, retrying (${attempt}/${config.maxRetries})...`, attempt, config.maxRetries);
                    }
                }

            } catch (err: any) {
                if (err.message === 'EXECUTION_STOPPED') {
                    console.log(`[ExecutionLoopService] Task ${taskId} stopped by user.`);
                    dbService.updateTaskStatus(taskId, 'stopped');
                    success = false;
                    break;
                }

                console.error(`[ExecutionLoopService] Exception on attempt ${attempt}:`, err);
                const attemptFeedback = `Attempt ${attempt}/${config.maxRetries} failed: ${err.message || err}`;
                failureFeedback = attemptFeedback;
                attemptHistory.push(attemptFeedback);
                if (attempt < config.maxRetries) {
                    this.sendProgress(taskId, 'generating', `Attempt ${attempt}/${config.maxRetries} failed, retrying...`, attempt, config.maxRetries);
                }

                // Store failure in RAG for future reference
                try {
                    const ragContent = `Task #${taskId} ("${activeTask.title}"): ${attemptFeedback}`;
                    EmbeddingService.indexKnowledge('execution_failure', `task_${taskId}_attempt_${attempt}`, ragContent, { taskId, attempt }).catch(() => {});
                } catch {
                    // Non-critical
                }

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

            this.abortControllers.delete(taskId);
            this.sendProgress(taskId, 'completed', 'Execution completed successfully', attempt - 1, config.maxRetries);
            return 'passed';
        }

        // === Not stopped by user ===
        const taskStatus = dbService.getTask(taskId);
        if (taskStatus && taskStatus.status === 'stopped') {
            this.abortControllers.delete(taskId);
            this.sendProgress(taskId, 'stopped', 'Execution stopped by user');
            dbService.updateTaskStatus(taskId, 'stopped');
            return 'failed';
        }

        // === DLQ Escalation: All retries exhausted, ask user for guidance ===
        this.abortControllers.delete(taskId);
        this.sendProgress(taskId, 'failed', 'All retries exhausted', config.maxRetries, config.maxRetries);
        console.error(`[ExecutionLoopService] Task ID ${taskId} failed after exhausting ${config.maxRetries} attempts. Escalating to user...`);

        console.log('[ExecutionLoopService] Restoring workspace to pristine pre-execution snapshot.');
        SnapshotService.rollbackToSnapshot(preSnapshotId);

        // Notify renderer
        const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
        if (mainWindow) {
            mainWindow.webContents.send('execution:dlq-notify', {
                taskId,
                taskTitle: activeTask?.title || 'Unknown Task',
                failureFeedback,
                attemptHistory,
                maxRetries: config.maxRetries,
            });
        }

        // Wait for user guidance (or cancel)
        const userGuidance = await new Promise<string | null>((resolve) => {
            ExecutionLoopService.setDlqResolver(taskId, resolve, failureFeedback, attemptHistory);
        });

        if (!userGuidance) {
            // User cancelled — mark failed and throw
            dbService.updateTaskStatus(taskId, 'failed');
            TaskService.failTask(taskId, `User cancelled after ${config.maxRetries} failed attempts. Details: ${failureFeedback}`);

            await LearningService.captureLearning(taskId).catch(err => {
                console.error('[ExecutionLoopService] LearningService capture failed on cancel:', err);
            });

            this.abortControllers.delete(taskId);
            this.sendProgress(taskId, 'failed', 'Execution cancelled by user');
            throw new Error(`[ExecutionLoopService] User cancelled task ${taskId} after ${config.maxRetries} failed attempts.`);
        }

        // Retry with user guidance — reset attempt counter for guided retry
        console.log(`[ExecutionLoopService] User provided guidance. Retrying task ${taskId} with injected guidance...`);
        this.abortControllers.delete(taskId);
        attempt = 1;
        config = { ...config, maxRetries: 3, userGuidance };

        // Re-enter the retry loop
        const guidedResult = await this.executeTask(taskId, config);
        return guidedResult;
    }

    private static async performInvestigation(
        taskId: number,
        activeTask: any,
        modelUsed: string,
        startTime: number
    ): Promise<string> {
        if (!aiService.isActive()) return '';

        console.log(`[ExecutionLoopService] Triggering Taxonomy Steering: Active Investigation Phase...`);
        const investAssembled = await ContextAssembler.assembleContext(taskId, []);
        const investSystemInstructions = ASTPatchingService.shapeSystemInstructions(
            'investigate',
            investAssembled.systemPrompt,
            undefined,
            investAssembled.taxonomyResult
        );

        if (investAssembled.taxonomyResult) {
            try {
                taxonomyService.trackResult(taskId, investAssembled.taxonomyResult, 'investigation');
            } catch (e) {
                console.error('[ExecutionLoopService] Failed to track investigation taxonomy:', e);
            }
        }

        const investPrompt = `Analyze the requirements for Task: "${activeTask.title}" and plan modifications.
1. Trace and check all dependency signatures and database schema constraints.
2. Outline a deterministic "Assumption Matrix" inside a scratchpad block.
3. Validate that you are ready and have no blind spots. Do NOT propose code changes yet.`;

        const investResult = await aiService.chat([
            { role: 'system', content: investSystemInstructions },
            { role: 'user', content: investPrompt }
        ], { temperature: 0.1, model: modelUsed });

        console.log(`[ExecutionLoopService] Active Investigation completed successfully.`);

        const investText = typeof investResult === 'string' ? investResult : 'text' in investResult ? investResult.text : '';
        if (investText) {
            dbService.addModelPerformance(
                modelUsed,
                aiService.providerId,
                'investigation',
                1, 1,
                Math.ceil(investText.length / 4),
                Date.now() - startTime
            );
        }
        return investText;
    }

    private static parseFileBlockResponse(response: string): Array<{ relativePath: string; content: string }> {
        if (!response) return [];
        const fileBlockRegex = /===\s*FILE:\s*([^\s=]+)\s*===([\s\S]*?)===\s*END FILE\s*===/gi;
        let match;
        const blocks: Array<{ relativePath: string; content: string }> = [];
        while ((match = fileBlockRegex.exec(response)) !== null) {
            const relativePath = match[1].trim();
            const rawContent = match[2];
            const cleanContent = rawContent.replace(/^\r?\n/, '').replace(/\r?\n\s*$/, '');
            blocks.push({ relativePath, content: cleanContent });
        }
        return blocks;
    }

    private static generateFallbackPatches(response: string): import('../../src/types/appTypes').PendingFileModification[] {
        const blocks = this.parseFileBlockResponse(response);
        const results: import('../../src/types/appTypes').PendingFileModification[] = [];

        for (const { relativePath, content: cleanContent } of blocks) {
            const absolutePath = PathGuard.resolve(relativePath);
            if (!absolutePath) {
                console.error(`[ExecutionLoopService] Safety Block: Out-of-bounds file edit rejected: ${relativePath}`);
                continue;
            }

            try {
                let originalContent = '';
                if (fs.existsSync(absolutePath)) {
                    originalContent = fs.readFileSync(absolutePath, 'utf-8');
                }

                results.push({
                    relativePath,
                    absolutePath,
                    originalContent,
                    proposedContent: cleanContent,
                    patches: [{ find: '', replace: cleanContent }],
                    addedLines: 0,
                    removedLines: 0,
                });
            } catch (err) {
                console.error(`[ExecutionLoopService] Failed to read file for preview: ${relativePath}`, err);
            }
        }

        return results;
    }

    private static applyFileEdits(response: string): boolean {
        const blocks = this.parseFileBlockResponse(response);
        let parsedAny = false;

        for (const { relativePath, content: cleanContent } of blocks) {
            const absolutePath = PathGuard.resolve(relativePath);
            if (!absolutePath) {
                console.error(`[ExecutionLoopService] Safety Block: Out-of-bounds file edit rejected: ${relativePath}`);
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
