import { dbService } from '../db';
import { AIService } from './AIService';
import { pipelineService } from './PipelineService';
import { SnapshotService } from './SnapshotService';
import { PlanningService } from './PlanningService';
import { TaskService } from './TaskService';
import { ContextAssembler } from './ContextAssembler';
import { LearningService } from './LearningService';
import { PathGuard } from './PathGuard';
import { ASTPatchingService } from './ASTPatchingService';
import { PendingModificationsService } from './PendingModificationsService';
import { VerificationService } from './VerificationService';
import { taxonomyService } from './taxonomy/TaxonomyService';
import { TaxonomyClassifier } from './taxonomy/TaxonomyClassifier';
import type { OperationalContext } from './taxonomy/types';
import * as fs from 'fs';
import console from 'console';
import { BrowserWindow } from 'electron';
import type { PlanStep } from '../../src/helpers/planEditorTypes';

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

const DEFAULT_CONFIG: ExecutionConfig = { maxRetries: 3, baseTemperature: 0.0, escalateModel: true };

export class ExecutionLoopService {
    private static dlqEntries = new Map<number, DlqEntry>();
    private static abortControllers = new Map<number, AbortController>();

    private static get chatSvc() {
        return AIService.getForProvider(pipelineService.getProviderFor('chat'));
    }

    private static get codeCompletionSvc() {
        return AIService.getForProvider(pipelineService.getProviderFor('code_generation'));
    }

    private static sendProgress(taskId: number, phase: string, message: string, attempt?: number, totalAttempts?: number, stepIndex?: number): void {
        const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
        if (mainWindow) {
            mainWindow.webContents.send('execution:progress', { taskId, phase, message, attempt, totalAttempts, stepIndex });
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

    private static checkAborted(taskId: number): void {
        const controller = this.abortControllers.get(taskId);
        if (controller && controller.signal.aborted) throw new Error('EXECUTION_STOPPED');
    }

    private static actionToPhase(action: string): string {
        switch (action) {
            case 'read': return 'reading';
            case 'analyze': return 'analysing';
            case 'modify': return 'modifying';
            case 'create': return 'creating';
            case 'delete': return 'removing';
            case 'run_command': return 'executing';
            default: return 'generating';
        }
    }

    private static resolveFilesFromTarget(target: string, action: string): string[] {
        const files: string[] = [];
        if (!target) return files;
        if (action === 'delete' || action === 'modify' || action === 'create' || action === 'read') {
            const parts = target.split(',').map(s => s.trim()).filter(Boolean);
            for (const p of parts) {
                const resolved = PathGuard.resolve(p);
                if (resolved) files.push(p);
            }
        }
        return files;
    }

    static async executeTask(taskId: number, config: ExecutionConfig = DEFAULT_CONFIG): Promise<'passed' | 'failed'> {
        console.assert(typeof taskId === 'number', 'taskId must be a valid number');
        console.log(`[ExecutionLoopService] Initiating step-level execution for task ID ${taskId}...`);

        let planRow = dbService.getTaskPlan(taskId);
        if (!planRow) {
            console.log(`[ExecutionLoopService] No plan found. Generating...`);
            await PlanningService.generatePlan(taskId);
            planRow = dbService.getTaskPlan(taskId);
        }
        console.assert(planRow !== null, 'Plan must be present in DB');
        const plan = JSON.parse(planRow!.plan_json);

        // Pre-Execution Plan Audit
        const workspacePath = dbService.getWorkspacePathForTask(taskId) || process.cwd();
        const auditIssues = PlanningService.auditPlan(plan, workspacePath);
        if (auditIssues.length > 0) {
            throw new Error(`Plan Audit Failed:\n- ${auditIssues.join('\n- ')}`);
        }

        const steps: PlanStep[] = plan.steps || [];

        const activeTask = dbService.getTask(taskId);
        console.assert(activeTask !== null, 'Active task must exist in DB');

        const abortController = new AbortController();
        this.abortControllers.set(taskId, abortController);

        const startTime = Date.now();

        // Investigation phase
        this.sendProgress(taskId, 'investigating', 'Analyzing dependencies and assumptions...');
        let investText = '';
        try {
            investText = await this.performInvestigation(taskId, activeTask, startTime);
        } catch (err: any) {
            if (err.message === 'EXECUTION_STOPPED') {
                this.abortControllers.delete(taskId);
                dbService.updateTaskStatus(taskId, 'stopped');
                return 'failed';
            }
            console.error('[ExecutionLoopService] Investigation failed, continuing without:', err);
        }
        this.checkAborted(taskId);

        // Classify taxonomy for full task (used as baseline)
        let baseTaxonomyResult: any = null;
        try {
            const assembled = await ContextAssembler.assembleContext(taskId, [], undefined, undefined, undefined, investText);
            baseTaxonomyResult = assembled.taxonomyResult || null;
            if (baseTaxonomyResult) {
                taxonomyService.trackResult(taskId, baseTaxonomyResult, 'investigation');
            }
        } catch (e) {
            console.error('[ExecutionLoopService] Taxonomy classification failed:', e);
        }

        // Pre-execution snapshot of all planned files
        const allFiles = plan.filesToModify || [];
        const { snapshotId: _preSnapshotId, skippedFiles } = SnapshotService.captureSnapshot(taskId, allFiles, 'pre_execution');

        if (allFiles.length > 0 && skippedFiles.length === allFiles.length) {
            console.warn(`[ExecutionLoopService] None of ${allFiles.length} planned files exist — creating new files.`);
            this.sendProgress(taskId, 'warning', `Planned files don't exist — creating: ${allFiles.join(', ')}`);
        }

        let allStepsPassed = true;
        let completedCount = 0;

        for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
            const step = steps[stepIdx];
            this.checkAborted(taskId);

            const phase = this.actionToPhase(step.action);
            const stepLabel = `Step ${stepIdx + 1}/${steps.length}: ${step.action} ${step.target}`;
            console.log(`[ExecutionLoopService] ${stepLabel}`);

            // Create child task for this step
            let childTaskId: number;
            try {
                childTaskId = TaskService.createTask(
                    `[Step ${stepIdx + 1}] ${step.action}: ${step.target}`,
                    `Parent task #${taskId}. ${step.rationale || ''}`,
                    taskId,
                    activeTask?.assigned_agent_id || null,
                    'agent',
                    2000,
                    0
                );
            } catch (e) {
                console.error('[ExecutionLoopService] Failed to create child task:', e);
                childTaskId = taskId; // fallback to parent
            }

            // Per-step snapshot
            const stepFiles = this.resolveFilesFromTarget(step.target, step.action);
            const stepSnapshot = SnapshotService.captureSnapshot(childTaskId, stepFiles, `step_${stepIdx}`);

            // Build taxonomy-scoped context for this step
            const stepTaxonomy = this.classifyStep(taskId, step, plan, investText, baseTaxonomyResult);

            // Execute step with retry loop and failure classification
            let stepSuccess = false;
            let stepFeedback = '';
            let stepAttemptHistory: string[] = [];
            let stepFeedbackType: 'execution' | 'verification' = 'execution';

            for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
                this.checkAborted(taskId);
                console.log(`[ExecutionLoopService] Step ${stepIdx + 1}, attempt ${attempt}/${config.maxRetries}`);

                try {
                    this.sendProgress(taskId, phase, `${stepLabel}...`, attempt, config.maxRetries, stepIdx);

                    const result = await this.executeSingleStep(
                        childTaskId, step, taskId, activeTask, investText, stepTaxonomy,
                        config, abortController.signal, attempt, stepIdx
                    );

                    if (result.success) {
                        stepSuccess = true;
                        step.completed = true;
                        break;
                    } else {
                        stepFeedback = result.feedback || 'Step failed';
                        stepFeedbackType = result.feedbackType || 'execution';
                        stepAttemptHistory.push(`Attempt ${attempt}/${config.maxRetries}: ${stepFeedback}`);
                        console.warn(`[ExecutionLoopService] Step ${stepIdx + 1} attempt ${attempt} failed: ${stepFeedback}`);
                    }
                } catch (err: any) {
                    if (err.message === 'EXECUTION_STOPPED') {
                        console.log(`[ExecutionLoopService] Task ${taskId} stopped during step ${stepIdx + 1}.`);
                        dbService.updateTaskStatus(taskId, 'stopped');
                        this.abortControllers.delete(taskId);
                        return 'failed';
                    }
                    stepFeedback = err.message || String(err);
                    stepAttemptHistory.push(`Attempt ${attempt}/${config.maxRetries}: ${stepFeedback}`);
                    console.error(`[ExecutionLoopService] Step ${stepIdx + 1} exception:`, err);
                }

                // Patch-forward on verification issues (keep code on disk for next attempt to fix)
                // Rollback on execution failures (bad parse, exception, etc.)
                const isModifyCreate = step.action === 'modify' || step.action === 'create';
                if (isModifyCreate && attempt < config.maxRetries && stepFeedbackType === 'verification') {
                    console.log(`[ExecutionLoopService] Verification findings — patching forward, no rollback`);
                } else if (isModifyCreate && attempt < config.maxRetries) {
                    try {
                        console.log(`[ExecutionLoopService] Execution failure — rolling back and retrying`);
                        SnapshotService.rollbackToSnapshot(stepSnapshot.snapshotId, stepSnapshot.skippedFiles);
                    } catch (rbErr) {
                        console.error('[ExecutionLoopService] Step rollback failed:', rbErr);
                    }
                }

                if (attempt < config.maxRetries) {
                    this.sendProgress(taskId, phase, `Retrying step ${stepIdx + 1} (${attempt}/${config.maxRetries})...`, attempt, config.maxRetries, stepIdx);
                }
            }

            if (stepSuccess) {
                completedCount++;
                this.sendProgress(taskId, phase, `Step ${stepIdx + 1} completed`, undefined, undefined, stepIdx);
            } else {
                this.sendProgress(taskId, 'failed', `Step ${stepIdx + 1} failed: ${stepFeedback}`, undefined, undefined, stepIdx);

                if (step.action === 'read' || step.action === 'analyze') {
                    // Non-fatal — continue execution
                    console.warn(`[ExecutionLoopService] Non-fatal step ${stepIdx + 1} failed. Continuing...`);
                    step.completed = false;
                    continue;
                }

                // Fatal for modify/create/delete/run_command — DLQ escalation
                allStepsPassed = false;
                return await this.handleStepDlq(taskId, stepIdx, step, stepFeedback, stepAttemptHistory, config);
            }
        }

        // All steps completed
        if (allStepsPassed) {
            dbService.updateTaskStatus(taskId, 'completed');
            await LearningService.captureLearning(taskId).catch(err => {
                console.error('[ExecutionLoopService] LearningService capture failed:', err);
            });
            this.abortControllers.delete(taskId);
            this.sendProgress(taskId, 'completed', `Execution completed (${completedCount}/${steps.length} steps)`);
            return 'passed';
        }

        this.abortControllers.delete(taskId);
        this.sendProgress(taskId, 'failed', 'Execution failed');
        return 'failed';
    }

    private static classifyStep(
        taskId: number,
        step: PlanStep,
        plan: any,
        investText: string,
        baseTaxonomyResult: any
    ): any {
        if (baseTaxonomyResult && !baseTaxonomyResult.skippedReason) {
            return baseTaxonomyResult;
        }
        // Attempt per-step classification for steps that pass the complexity gate
        try {
            const stepPlan = { ...plan, steps: [step], filesToModify: this.resolveFilesFromTarget(step.target, step.action) };
            if (TaxonomyClassifier.shouldActivateTaxonomy({ id: taskId, title: `${step.action}: ${step.target}`, description: step.rationale }, stepPlan)) {
                const context: OperationalContext = 'execution';
                return taxonomyService.classify(
                    { id: taskId, title: `${step.action}: ${step.target}`, description: step.rationale },
                    context,
                    stepPlan,
                    investText
                );
            }
        } catch (e) {
            console.error('[ExecutionLoopService] Per-step taxonomy classification failed:', e);
        }
        return baseTaxonomyResult;
    }

    private static async executeSingleStep(
        childTaskId: number,
        step: PlanStep,
        parentTaskId: number,
        activeTask: any,
        investText: string,
        taxonomyResult: any,
        config: ExecutionConfig,
        _abortSignal: AbortSignal,
        attempt: number,
        stepIdx: number
    ): Promise<{ success: boolean; patches?: any[]; feedback?: string; feedbackType?: 'execution' | 'verification' }> {
        const action = step.action;

        if (action === 'read' || action === 'analyze') {
            return this.executeReadAnalyzeStep(childTaskId, step, activeTask, investText, taxonomyResult, config, attempt, stepIdx);
        }

        if (action === 'modify' || action === 'create') {
            const result = await this.executeModifyCreateStep(childTaskId, step, parentTaskId, activeTask, investText, taxonomyResult, config, attempt);

            // Advisory verification gate (opt-in via plan.autoVerify)
            // Verification findings are advisory: fed back to LLM for fix/explanation.
            // On 'needs_review', returns feedbackType='verification' so the caller
            // patches forward (keeps code on disk) instead of rolling back.
            // After 3 exhausted retries → DLQ escalation to user.
            if (result.success) {
                try {
                    const parentPlanRow = dbService.getTaskPlan(parentTaskId);
                    if (parentPlanRow) {
                        const parentPlan = JSON.parse(parentPlanRow.plan_json);
                        if (parentPlan.autoVerify === true) {
                            const outputs = dbService.getTaskOutputs(childTaskId);
                            if (outputs && outputs.length > 0) {
                                this.sendProgress(parentTaskId, 'verifying', `Verifying step: ${step.target}...`);
                                const verifyStatus = await VerificationService.verifyOutput(
                                    outputs[0].id, taxonomyResult
                                );
                                if (verifyStatus === 'passed') {
                                    this.sendProgress(parentTaskId, 'verifying', 'Verification passed ✓');
                                } else if (verifyStatus === 'needs_review') {
                                    const verifyDetails = dbService.getVerificationResults(outputs[0].id);
                                    const findings = (verifyDetails as any[])
                                        .filter((r: any) => r.result === 'needs_review' || r.result === 'failed')
                                        .map((r: any) => r.details)
                                        .join('; ');
                                    this.sendProgress(parentTaskId, 'verifying',
                                        `Verification flagged issues: ${(findings || 'Review needed').substring(0, 200)}`);
                                    return {
                                        success: false,
                                        feedback: `Verification flagged issues: ${findings}`,
                                        feedbackType: 'verification'
                                    };
                                } else if (verifyStatus === 'failed') {
                                    const verifyDetails = dbService.getVerificationResults(outputs[0].id);
                                    const failedChecks = (verifyDetails as any[])
                                        .filter((r: any) => r.result === 'failed')
                                        .map((r: any) => r.details)
                                        .join('; ');
                                    this.sendProgress(parentTaskId, 'verifying',
                                        `Verification failed: ${(failedChecks || 'Unknown').substring(0, 200)}`);
                                    return {
                                        success: false,
                                        feedback: `Verification failed: ${failedChecks}`,
                                        feedbackType: 'execution'
                                    };
                                }
                            }
                        }
                    }
                } catch (verifyErr) {
                    console.error('[ExecutionLoopService] Verification error (non-blocking):', verifyErr);
                }
            }

            return result;
        }

        if (action === 'delete') {
            return this.executeDeleteStep(childTaskId, step);
        }

        if (action === 'run_command') {
            return this.executeCommandStep(childTaskId, step);
        }

        return { success: false, feedback: `Unknown action: ${action}` };
    }

    private static async executeReadAnalyzeStep(
        childTaskId: number,
        step: PlanStep,
        activeTask: any,
        investText: string,
        taxonomyResult: any,
        _config: ExecutionConfig,
        attempt: number,
        _stepIdx: number
    ): Promise<{ success: boolean; feedback?: string }> {
        if (!this.chatSvc.isActive()) return { success: true, feedback: 'AI not available' };

        const assembled = await ContextAssembler.assembleContext(childTaskId, [], undefined, undefined, undefined, investText);
        const systemInstructions = ASTPatchingService.shapeSystemInstructions('investigate', assembled.systemPrompt, undefined, taxonomyResult);

        // Resolve target files and check for non-existent ones
        const targetFiles = this.resolveFilesFromTarget(step.target, step.action);
        const nonExistentFiles: string[] = [];
        const fileContentsList: string[] = [];
        for (const file of targetFiles) {
            const absPath = PathGuard.resolve(file);
            if (absPath) {
                if (!fs.existsSync(absPath)) {
                    nonExistentFiles.push(file);
                } else {
                    try {
                        const size = fs.statSync(absPath).size;
                        if (size < 100000) { // Limit to 100KB
                            const content = fs.readFileSync(absPath, 'utf-8');
                            fileContentsList.push(`=== FILE: ${file} ===\n${content}\n=== END FILE ===`);
                        } else {
                            fileContentsList.push(`=== FILE: ${file} (TOO LARGE TO LOAD, SIZE: ${Math.round(size / 1024)}KB) ===`);
                        }
                    } catch (e) {
                        console.warn(`[ExecutionLoopService] Failed to read target file ${file}:`, e);
                    }
                }
            }
        }

        let nonExistentNotice = '';
        if (nonExistentFiles.length > 0) {
            nonExistentNotice = `\n\nNOTE: The following target file(s) do not exist on disk yet: ${nonExistentFiles.join(', ')}. Please analyze how they should be integrated or confirm they do not exist. Since these files are currently missing, you are not expected to cite their contents, but you should explain their role or requirements.`;
        }

        let targetFileContents = '';
        if (fileContentsList.length > 0) {
            targetFileContents = `\n\nHere is the current content of the target file(s) on disk:\n${fileContentsList.join('\n\n')}`;
        }

        const prompt = `You are in READING/ANALYSIS mode for Step ${step.order}.
Target: ${step.target}
Rationale: ${step.rationale || ''}${nonExistentNotice}${targetFileContents}

Read and analyze the target file(s) and codebase. Report your findings, including:
1. Current state of the target code (if the file exists) or that the file does not yet exist
2. Dependencies and patterns
3. Any assumptions that need validation

Do NOT propose or generate code modifications. Return only findings and analysis.

IMPORTANT: Do NOT output any tool/function calls. You do not have access to tools in this step. Return your response purely as plain text in the chat response.`;

        const model = pipelineService.getModelFor('chat');
        const response = await this.chatSvc.chat([
            { role: 'system', content: systemInstructions },
            { role: 'user', content: prompt }
        ], { temperature: Math.min(0.1 + (attempt - 1) * 0.05, 0.3), model });

        const text = typeof response === 'string' ? response : 'text' in response ? response.text : '';
        if (!text) return { success: false, feedback: 'Empty AI response' };

        // Store analysis as task output for subsequent steps
        TaskService.completeTask(
            childTaskId,
            text,
            activeTask.assigned_agent_id,
            'analysis',
            Math.ceil(text.length / 4),
            pipelineService.getModelFor('chat'),
            this.chatSvc.providerId
        );

        return { success: true };
    }

    private static async executeModifyCreateStep(
        childTaskId: number,
        step: PlanStep,
        parentTaskId: number,
        activeTask: any,
        investText: string,
        taxonomyResult: any,
        config: ExecutionConfig,
        attempt: number
    ): Promise<{ success: boolean; patches?: any[]; feedback?: string }> {
        if (!this.codeCompletionSvc.isActive()) return { success: false, feedback: 'AI Service is inactive' };

        const assembled = await ContextAssembler.assembleContext(childTaskId, [], undefined, undefined, undefined, investText);
        let systemInstructions = ASTPatchingService.shapeSystemInstructions('modify', assembled.systemPrompt, undefined, taxonomyResult);

        if (config.userGuidance) {
            systemInstructions += `\n\n⚠️ USER GUIDANCE\n${config.userGuidance}\nAdjust your approach according to this guidance.`;
        }

        const tempWithEscalation = config.baseTemperature + (attempt - 1) * 0.1;
        const targetFiles = this.resolveFilesFromTarget(step.target, step.action);

        // Load contents of target files that exist on disk
        let targetFileContents = '';
        const fileContentsList: string[] = [];
        for (const file of targetFiles) {
            const absPath = PathGuard.resolve(file);
            if (absPath && fs.existsSync(absPath)) {
                try {
                    const size = fs.statSync(absPath).size;
                    if (size < 100000) { // Limit to 100KB
                        const content = fs.readFileSync(absPath, 'utf-8');
                        fileContentsList.push(`=== FILE: ${file} ===\n${content}\n=== END FILE ===`);
                    } else {
                        fileContentsList.push(`=== FILE: ${file} (TOO LARGE TO LOAD, SIZE: ${Math.round(size / 1024)}KB) ===`);
                    }
                } catch (e) {
                    console.warn(`[ExecutionLoopService] Failed to read target file ${file}:`, e);
                }
            }
        }
        if (fileContentsList.length > 0) {
            targetFileContents = `\n\nHere is the current content of the files involved on disk:\n${fileContentsList.join('\n\n')}`;
        }

        let isCreate = step.action === 'create';

        // If it's a modify step, but the target file doesn't exist on disk, treat it as a create step
        if (!isCreate && step.action === 'modify') {
            let allMissing = true;
            for (const file of targetFiles) {
                const absPath = PathGuard.resolve(file);
                if (absPath && fs.existsSync(absPath)) {
                    allMissing = false;
                    break;
                }
            }
            if (allMissing && targetFiles.length > 0) {
                console.log(`[ExecutionLoopService] Target file(s) for modify step do not exist. Falling back modify step to create behavior.`);
                isCreate = true;
            }
        }

        const formatInstruction = isCreate
            ? `Return your changes as a JSON array containing exactly one object:
\`\`\`json
[{
  "file": "${step.target}",
  "patches": [{ "find": "", "replace": "<full file content here>" }]
}]
\`\`\`
For new files, use "find": "" (empty string) to indicate full-file creation.`
            : `Return your changes in JSON AST Patch format:
\`\`\`json
[{
  "file": "relative/path/to/file.ts",
  "patches": [{ "find": "exact code to replace", "replace": "replacement code" }]
}]
\`\`\``;

        // Inject code planning blueprint for this step if available
        let codePlanningBlock = '';
        try {
            const parentPlanRow = dbService.getTaskPlan(parentTaskId);
            if (parentPlanRow) {
                const parentPlan = JSON.parse(parentPlanRow.plan_json);
                const matchedCode = PlanningService.getCodePlanningForStep(parentPlan, step.target);
                if (matchedCode) {
                    codePlanningBlock = `\n\n=== CODE PLANNING BLUEPRINT (for ${step.target}) ===\n${matchedCode}\n=== END CODE PLANNING BLUEPRINT ===`;
                }
            }
        } catch (e) {
            console.warn('[ExecutionLoopService] Failed to extract code planning blueprint:', e);
        }

        const prompt = `Task Title: ${activeTask.title}
Step: ${step.action} — ${step.target}
Rationale: ${step.rationale || ''}

Apply changes ONLY to the target: ${step.target}
Files involved: ${targetFiles.join(', ') || 'to be determined'}${targetFileContents}${codePlanningBlock}

${isCreate ? 'Create the file with full content.' : 'Modify the existing file according to the plan.'}

${formatInstruction}

IMPORTANT: You MUST wrap your response in a JSON array [...], even for a single file.

IMPORTANT: Do NOT output any tool/function calls. You do not have access to tools in this step. Return your response purely as plain text in the chat response.`;

        const model = pipelineService.getModelFor('code_generation');
        const response = await this.codeCompletionSvc.chat([
            { role: 'system', content: systemInstructions },
            { role: 'user', content: prompt }
        ], { temperature: tempWithEscalation, model });

        const chatResp = response as import('./AIService').ChatResponse;
        const responseContent = chatResp.text;

        if (!responseContent) return { success: false, feedback: 'Empty AI response' };

        console.log(`[ExecutionLoopService] AI response (first 500): ${responseContent.substring(0, 500)}`);

        // Parse patches using 4-fallback chain
        let patches = ASTPatchingService.generatePreviewPatches(responseContent, step.target, isCreate);
        let parseSuccess = patches.length > 0;

        if (!parseSuccess) {
            console.warn(`[ExecutionLoopService] JSON AST parse failed. Trying full-file block parser...`);
            const fallbackPatches = this.generateFallbackPatches(responseContent);
            if (fallbackPatches.length > 0) {
                patches.push(...fallbackPatches);
                parseSuccess = true;
            }
        }

        if (!parseSuccess) {
            console.warn(`[ExecutionLoopService] Full-file blocks failed. Trying markdown code blocks...`);
            const markdownPatches = this.generateMarkdownFallbackPatches(responseContent);
            if (markdownPatches.length > 0) {
                patches.push(...markdownPatches);
                parseSuccess = true;
            }
        }

        if (!parseSuccess) {
            console.warn(`[ExecutionLoopService] Markdown blocks failed. Trying raw path+content fallback...`);
            const rawPatches = this.generateRawPathFallbackPatches(responseContent);
            if (rawPatches.length > 0) {
                patches.push(...rawPatches);
                parseSuccess = true;
            }
        }

        if (!parseSuccess) {
            if (!isCreate) {
                console.warn(`[ExecutionLoopService] Modify step — all parsers failed. Returning feedback instead of silent full rewrite.`);
                return { success: false, feedback: 'Could not extract surgical patches from AI response after 4 parsing attempts. The AI may need to produce find/replace pairs instead of full-file content.' };
            }
            console.warn(`[ExecutionLoopService] All structured parsers failed. Using entire AI response as file content for ${step.target}...`);
            const absolutePath = PathGuard.resolve(step.target);
            if (absolutePath) {
                let originalContent = '';
                if (fs.existsSync(absolutePath)) {
                    originalContent = fs.readFileSync(absolutePath, 'utf-8');
                }
                patches.push({
                    relativePath: step.target,
                    absolutePath,
                    originalContent,
                    proposedContent: responseContent.trim(),
                    patches: [{ find: '', replace: responseContent.trim() }],
                    addedLines: 0,
                    removedLines: 0,
                });
                parseSuccess = true;
            } else {
                throw new Error('Failed parsing file patches from AI response (JSON AST, full-file blocks, markdown code blocks, and raw path+content all failed).');
            }
        }

        // For modify steps, validate that patches are surgical (not full-rewrite)
        if (!isCreate && parseSuccess) {
            const hasFullRewrite = patches.some((p: any) =>
                p.patches && p.patches.some((pp: any) => pp.find === '')
            );
            if (hasFullRewrite) {
                return { success: false, feedback: 'Full file rewrite detected on modify step. Retrying with stronger surgical guidance.' };
            }
        }

        // Apply patches via PendingModificationsService
        PendingModificationsService.setPending(childTaskId, {
            taskId: childTaskId,
            modifications: patches,
            planSnapshot: {},
            createdAt: Date.now(),
        });

        const plan = dbService.getTaskPlan(parentTaskId);
        const planJson = plan ? JSON.parse(plan.plan_json) : {};
        const isPlanMode = planJson.approved === true;

        if (isPlanMode) {
            console.log(`[ExecutionLoopService] Plan approved. Auto-applying step patches...`);
            const applied = PendingModificationsService.applyModifications(childTaskId);
            if (!applied) throw new Error('Failed to auto-apply modifications.');
            PendingModificationsService.removePending(childTaskId);
        } else {
            // Store patches and resolve to let the renderer know
            const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
            if (mainWindow) {
                mainWindow.webContents.send('execution:pending-modifications', {
                    taskId: childTaskId,
                    modifications: patches.map((m: any) => ({
                        relativePath: m.relativePath,
                        originalContent: m.originalContent,
                        proposedContent: m.proposedContent,
                        addedLines: m.addedLines,
                        removedLines: m.removedLines,
                    })),
                });
            }
            const userAccepted = await new Promise<boolean>((resolve) => {
                PendingModificationsService.setResolver(childTaskId, resolve);
            });
            if (!userAccepted) {
                PendingModificationsService.removePending(childTaskId);
                throw new Error('User rejected modifications.');
            }
            // Apply the already-parsed stored patches (not re-parsing raw text)
            const applied = PendingModificationsService.applyModifications(childTaskId);
            PendingModificationsService.removePending(childTaskId);
            if (!applied) throw new Error('Failed to apply modifications to disk.');
        }

        // Store output
        TaskService.completeTask(
            childTaskId,
            responseContent,
            activeTask.assigned_agent_id,
            'code',
            Math.ceil(responseContent.length / 4),
            pipelineService.getModelFor('code_generation'),
            this.codeCompletionSvc.isActive() ? this.codeCompletionSvc.providerId : 'fallback'
        );

        return { success: true, patches };
    }

    private static async executeDeleteStep(
        childTaskId: number,
        step: PlanStep
    ): Promise<{ success: boolean; feedback?: string }> {
        // Require user approval for delete
        const targetFiles = this.resolveFilesFromTarget(step.target, 'delete');

        const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
        if (!mainWindow) return { success: false, feedback: 'No renderer window' };

        const approved = await new Promise<boolean>((resolve) => {
            mainWindow.webContents.send('tool:approval-request', {
                type: 'delete',
                taskId: childTaskId,
                details: `Delete files: ${targetFiles.join(', ') || step.target}`,
                rationale: step.rationale,
            });
            // The renderer sends back via execution:dlq-respond or a resolution mechanism
            // We use an inline approval pattern: store a resolver
            PendingModificationsService.setResolver(childTaskId, resolve);
        });

        if (!approved) return { success: false, feedback: 'Delete rejected by user' };

        // Perform the deletion
        for (const file of targetFiles) {
            const absolutePath = PathGuard.resolve(file);
            if (absolutePath && fs.existsSync(absolutePath)) {
                try {
                    fs.unlinkSync(absolutePath);
                    console.log(`[ExecutionLoopService] Deleted: ${file}`);
                } catch (err) {
                    console.error(`[ExecutionLoopService] Failed to delete ${file}:`, err);
                    return { success: false, feedback: `Failed to delete ${file}` };
                }
            }
        }

        PendingModificationsService.removePending(childTaskId);
        return { success: true };
    }

    private static async executeCommandStep(
        childTaskId: number,
        step: PlanStep
    ): Promise<{ success: boolean; feedback?: string }> {
        const approved = await new Promise<boolean>((resolve) => {
            const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
            if (!mainWindow) return resolve(false);

            mainWindow.webContents.send('tool:approval-request', {
                type: 'run_command',
                taskId: childTaskId,
                details: `Run command: ${step.target}`,
                rationale: step.rationale,
            });
            PendingModificationsService.setResolver(childTaskId, resolve);
        });

        if (!approved) return { success: false, feedback: 'Command rejected by user' };

        PendingModificationsService.removePending(childTaskId);
        return { success: false, feedback: 'run_command steps are no longer supported. Use "read" or "analyze" steps instead.' };
    }

    private static async handleStepDlq(
        taskId: number,
        stepIdx: number,
        _step: PlanStep,
        failureFeedback: string,
        attemptHistory: string[],
        config: ExecutionConfig
    ): Promise<'passed' | 'failed'> {
        const activeTask = dbService.getTask(taskId);
        this.sendProgress(taskId, 'failed', `Step ${stepIdx + 1} exhausted all retries`);
        console.error(`[ExecutionLoopService] Step ${stepIdx + 1} failed after ${config.maxRetries} attempts. Escalating to user...`);

        const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
        if (mainWindow) {
            mainWindow.webContents.send('execution:dlq-notify', {
                taskId,
                taskTitle: activeTask?.title || 'Unknown',
                failureFeedback,
                attemptHistory,
                maxRetries: config.maxRetries,
            });
        }

        const userGuidance = await new Promise<string | null>((resolve) => {
            ExecutionLoopService.setDlqResolver(taskId, resolve, failureFeedback, attemptHistory);
        });

        if (!userGuidance) {
            dbService.updateTaskStatus(taskId, 'failed');
            TaskService.failTask(taskId, `User cancelled after step ${stepIdx + 1} failed. ${failureFeedback}`);
            await LearningService.captureLearning(taskId).catch(() => {});
            this.abortControllers.delete(taskId);
            this.sendProgress(taskId, 'failed', 'Execution cancelled by user');
            throw new Error(`[ExecutionLoopService] User cancelled task ${taskId} at step ${stepIdx + 1}.`);
        }

        this.abortControllers.delete(taskId);
        const guidedConfig: ExecutionConfig = { ...config, userGuidance };
        return await this.executeTask(taskId, guidedConfig);
    }

    private static async performInvestigation(
        taskId: number,
        activeTask: any,
        startTime: number
    ): Promise<string> {
        if (!this.chatSvc.isActive()) return '';

        console.log(`[ExecutionLoopService] Investigation phase...`);
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
                console.error('[ExecutionLoopService] Failed to track taxonomy:', e);
            }
        }

        const investPrompt = `Analyze the requirements for Task: "${activeTask.title}" and plan modifications.
1. Trace and check all dependency signatures and database schema constraints.
2. Outline a deterministic "Assumption Matrix" inside a scratchpad block.
3. Validate that you are ready and have no blind spots. Do NOT propose code changes yet.`;

        const model = pipelineService.getModelFor('chat');
        const investResult = await this.chatSvc.chat([
            { role: 'system', content: investSystemInstructions },
            { role: 'user', content: investPrompt }
        ], { temperature: 0.1, model });

        console.log(`[ExecutionLoopService] Investigation completed.`);

        const investText = typeof investResult === 'string' ? investResult : 'text' in investResult ? investResult.text : '';
        if (investText) {
            dbService.addModelPerformance(
                model,
                this.chatSvc.providerId,
                'investigation',
                1, 1,
                Math.ceil(investText.length / 4),
                Date.now() - startTime
            );
        }
        return investText;
    }

    // === Patch parsing helpers (unchanged from original) ===

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

    private static parseMarkdownCodeBlocks(response: string): Array<{ relativePath: string; content: string }> {
        if (!response) return [];
        const blockRegex = /```(\S+)?\s*\n([\s\S]*?)```/g;
        const blocks: Array<{ relativePath: string; content: string }> = [];
        let match;

        while ((match = blockRegex.exec(response)) !== null) {
            const info = (match[1] || '').trim();
            const rawContent = match[2];
            const cleanContent = rawContent.replace(/^\r?\n/, '').replace(/\r?\n\s*$/, '');
            if (!cleanContent) continue;

            let relativePath = '';
            const colonIdx = info.indexOf(':');
            const spaceIdx = info.indexOf(' ');
            if (colonIdx !== -1) {
                relativePath = info.substring(colonIdx + 1).trim();
            } else if (spaceIdx !== -1) {
                relativePath = info.substring(spaceIdx + 1).trim();
            } else if (/\.\w+$/.test(info)) {
                relativePath = info;
            }

            if (!relativePath) {
                const firstLine = cleanContent.split('\n')[0]?.trim() || '';
                const commentMatch = firstLine.match(/^\/\/\s*(\S+\.\w+)/);
                if (commentMatch) {
                    relativePath = commentMatch[1];
                }
            }

            if (relativePath && relativePath.includes('.') && !relativePath.includes(' ')) {
                blocks.push({ relativePath, content: cleanContent });
            }
        }

        return blocks;
    }

    private static generateMarkdownFallbackPatches(response: string): import('../../src/types/appTypes').PendingFileModification[] {
        const blocks = this.parseMarkdownCodeBlocks(response);
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

    private static generateRawPathFallbackPatches(response: string): import('../../src/types/appTypes').PendingFileModification[] {
        const lines = response.split('\n');
        const results: import('../../src/types/appTypes').PendingFileModification[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Detect a line that looks like a file path: starts with . or / or letter: contains a dot, no spaces
            if (line && !line.includes(' ') && line.includes('.') &&
                (line.startsWith('.') || line.startsWith('/') || /^[a-zA-Z]:/.test(line) || line.includes('/'))) {
                const contentLines = lines.slice(i + 1).filter(l => l.trim().length > 0);
                if (contentLines.length === 0) continue;

                const relativePath = line;
                const content = lines.slice(i + 1).join('\n').trim();

                // Skip if content looks like JSON (starts with { or [)
                if (content.startsWith('{') || content.startsWith('[')) continue;

                const absolutePath = PathGuard.resolve(relativePath);
                if (!absolutePath) continue;

                try {
                let originalContent = '';
                try {
                    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
                        originalContent = fs.readFileSync(absolutePath, 'utf-8');
                    }
                } catch {
                    // EISDIR or permission error — treat as empty (new file)
                }
                    results.push({
                        relativePath,
                        absolutePath,
                        originalContent,
                        proposedContent: content,
                        patches: [{ find: '', replace: content }],
                        addedLines: 0,
                        removedLines: 0,
                    });
                } catch (err) {
                    console.error(`[ExecutionLoopService] Raw path fallback failed for: ${relativePath}`, err);
                }
                break;
            }
        }
        return results;
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

    /* private static applyFileEdits(response: string): boolean {
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
                console.log(`[ExecutionLoopService] Applied file update: ${relativePath}`);
                parsedAny = true;
            } catch (err) {
                console.error(`[ExecutionLoopService] Failed writing file edits: ${relativePath}`, err);
                return false;
            }
        }

        return parsedAny;
    } */

}
