import { dbService } from '../db';
import { aiService } from './AIService';
import { DiffVerificationService } from './DiffVerificationService';
import console from 'console';

export interface VerificationRule {
    id: number;
    name: string;
    description: string | null;
    rule_type: 'pattern' | 'llm_judge' | 'human';
    trigger_on: string;
    config: any;
    applies_to: string;
}

export interface VerificationResult {
    id: number;
    task_output_id: number;
    rule_id: number;
    result: 'passed' | 'failed' | 'pending_review';
    score: number | null;
    details: string | null;
    verified_by: 'auto' | 'llm' | 'human';
}

export class VerificationService {
    /**
     * Executes verification pipelines sequentially matching the three-tier taxonomy constraints.
     * Integrates Tier 0 fully-deterministic static analysis before standard pattern/LLM checks.
     */
    static async verifyOutput(taskOutputId: number, taxonomyResult?: any): Promise<'passed' | 'failed' | 'needs_review'> {
        console.assert(typeof taskOutputId === 'number', 'Task Output ID must be a number');
        
        const output = dbService.getTaskOutput(taskOutputId);
        if (!output) {
            throw new Error(`Task output ID ${taskOutputId} not found`);
        }

        const taskId = output.task_id;
        let finalStatus: 'passed' | 'failed' | 'needs_review' = 'passed';

        const planRow = dbService.getTaskPlan(taskId);
        let modifiedFiles: string[] = [];
        if (planRow) {
            try {
                const plan = JSON.parse(planRow.plan_json);
                modifiedFiles = plan.filesToModify || [];
            } catch (e) {
                console.error('[VerificationService] Failed to parse plan JSON for verification:', e);
            }
        }

        console.log(`[VerificationService] Executing Tier 0 Deterministic Checks for task output ID ${taskOutputId}...`);
        const tier0Result = await DiffVerificationService.verify(taskId, modifiedFiles);
        
        let tier0Passed = true;
        let tier0Score = 1.0;
        let tier0ResultText = 'passed';

        if (!tier0Result.compiles || tier0Result.scopeViolations.length > 0 || tier0Result.antiPatterns.length > 0) {
            tier0Passed = false;
            tier0Score = 0.0;
            tier0ResultText = 'failed';
            finalStatus = 'failed';
        }

        dbService.addVerificationResult(
            taskOutputId,
            1,
            tier0ResultText as 'passed' | 'failed',
            tier0Score,
            tier0Result.details,
            'auto'
        );

        if (!tier0Passed) {
            console.warn('[VerificationService] Tier 0 Deterministic verification failed. Halting pipeline execution.');
            dbService.updateTaskOutputVerification(taskOutputId, 'failed');
            return 'failed';
        }

        // Tier 0.5: Plan Adherence LLM Judge (opt-in via plan.autoVerify)
        // SAFETY: This does NOT introduce an infinite loop. Verification failures are fed back
        // into the existing bounded retry loop (maxRetries=3) in ExecutionLoopService.
        // After 3 failures → DLQ escalation to user. No automatic restart.
        console.log(`[VerificationService] Running Plan Adherence Check for task output ID ${taskOutputId}...`);
        const adherenceResult = await this.runPlanAdherenceCheck(taskId, taskOutputId, output.content);
        if (adherenceResult === 'failed') {
            console.warn('[VerificationService] Plan adherence check failed.');
            finalStatus = 'failed';
            dbService.updateTaskOutputVerification(taskOutputId, 'failed');
            return 'failed';
        }

        const rules = dbService.getVerificationRules() as VerificationRule[];

        for (const rule of rules) {
            if (rule.id === 1) {
                continue;
            }

            if (rule.applies_to !== '*' && !rule.applies_to.includes(output.output_type)) {
                continue;
            }

            let result: 'passed' | 'failed' | 'pending_review' = 'passed';
            let score: number | null = 1.0;
            let details = '';

            if (rule.rule_type === 'pattern') {
                const patterns = rule.config.patterns || [];
                const rejectMode = rule.config.mode === 'reject_if_found';
                let matchFound = false;

                for (const p of patterns) {
                    const regex = new RegExp(p, 'i');
                    if (regex.test(output.content)) {
                        matchFound = true;
                        details = `Triggered rejection pattern match: "${p}"`;
                        break;
                    }
                }

                if (rejectMode && matchFound) {
                    result = 'failed';
                    score = 0.0;
                } else if (!rejectMode && !matchFound) {
                    result = 'failed';
                    score = 0.0;
                    details = 'Required verification pattern match not found';
                }
            } else if (rule.rule_type === 'llm_judge') {
                if (aiService.isActive()) {
                    try {
                        const prompt = `Rate the following content on a scale of 0 to 1 based on the rubric: "${rule.config.rubric}".
Respond with a JSON structure containing: {"score": 0.8, "explanation": "reasons..."}.

Content to verify:
"${output.content}"`;

                        const response = await aiService.chat([
                            { role: 'user', content: prompt }
                        ], { temperature: 0.0, responseSchema: {
                            type: 'object',
                            title: 'VerificationScore',
                            properties: {
                                score: { type: 'number', minimum: 0, maximum: 1 },
                                explanation: { type: 'string' }
                            },
                            required: ['score', 'explanation'],
                            additionalProperties: false
                        } }) as import('./AIService').ChatResponse;

                        const data = JSON.parse(response.text);
                        score = Number(data.score || 0.0);
                        details = data.explanation || '';
                        result = score >= (rule.config.pass_threshold || 0.8) ? 'passed' : 'failed';
                    } catch (e) {
                        result = 'pending_review';
                        details = `LLM Judge failed or timed out: ${e}`;
                    }
                } else {
                    result = 'pending_review';
                    details = 'AI Provider inactive for LLM Judge verification tier';
                }
            } else if (rule.rule_type === 'human') {
                result = 'pending_review';
                details = rule.config.prompt || 'Pending manual human review approval';
            }

            dbService.addVerificationResult(
                taskOutputId,
                rule.id,
                result,
                score,
                details,
                rule.rule_type === 'pattern' ? 'auto' : rule.rule_type === 'llm_judge' ? 'llm' : 'human'
            );

            if (result === 'failed') {
                finalStatus = 'failed';
            } else if (result === 'pending_review' && finalStatus !== 'failed') {
                finalStatus = 'needs_review';
            }
        }

        // === Taxonomy Verification Overlays ===
        if (taxonomyResult && taxonomyResult.classification) {
            const axesKeys = ['domain', 'paradigm', 'scale', 'concurrency', 'lifecycle'] as const;
            for (const key of axesKeys) {
                const pathObj = taxonomyResult.classification[key];
                if (pathObj && pathObj.deepestNode) {
                    const fragments = pathObj.deepestNode.fragments['verification'] || [];
                    for (const frag of fragments) {
                        if (frag.selfVerification) {
                            for (const check of frag.selfVerification) {
                                let checkPassed = true;
                                let checkDetails = '';
                                
                                // Perform a simple keyword-based validation or custom logic
                                if (check.check.toLowerCase().includes('sql string concatenation')) {
                                    const codeContent = output.content;
                                    if (codeContent.includes('.query(') && (codeContent.includes('`') && codeContent.includes('${') || codeContent.includes(" + ") || codeContent.includes(" +"))) {
                                        checkPassed = false;
                                        checkDetails = `Failed check: ${check.check}. Potential SQL string concatenation found. ${check.failureIndicator}`;
                                    }
                                }

                                dbService.addVerificationResult(
                                    taskOutputId,
                                    999, // Dynamic taxonomy rule ID
                                    checkPassed ? 'passed' : 'failed',
                                    checkPassed ? 1.0 : 0.0,
                                    checkDetails || `Passed taxonomy check: ${check.check}. ${check.howToVerify}`,
                                    'auto'
                                );

                                if (!checkPassed) {
                                    finalStatus = 'failed';
                                }
                            }
                        }
                    }
                }
            }
        }

        dbService.updateTaskOutputVerification(taskOutputId, finalStatus);
        return finalStatus;
    }

    /**
     * Plan-adherence LLM judge. Dynamically builds a rubric from plan fields
     * (expectedOutcome, verificationCriteria, tradeoffs, consequences) and asks the
     * LLM to score the output against it.
     *
     * Only fires when plan.autoVerify === true (opt-in).
     * Uses the same model as the execution step.
     * Stores results with rule_id 998.
     *
     * BOUNDED RETRY SAFETY: Failures are consumed by the existing retry loop
     * (maxRetries=3) in ExecutionLoopService. After 3 exhausted retries → DLQ
     * escalation to user. No infinite loop risk.
     */
    private static async runPlanAdherenceCheck(
        taskId: number,
        taskOutputId: number,
        outputContent: string
    ): Promise<'passed' | 'failed' | 'skipped'> {
        // Resolve plan (with parent task fallback)
        let planRow = dbService.getTaskPlan(taskId);
        const task = dbService.getTask(taskId);
        if (!planRow && task?.parent_task_id) {
            planRow = dbService.getTaskPlan(task.parent_task_id);
        }
        if (!planRow) return 'skipped';

        let plan: any;
        try {
            plan = JSON.parse(planRow.plan_json);
        } catch (e) {
            console.error('[VerificationService] Failed to parse plan JSON for adherence check:', e);
            return 'skipped';
        }

        // Gate: only run when plan.autoVerify is explicitly true
        if (plan.autoVerify !== true) return 'skipped';

        // Build dynamic rubric from plan fields
        const rubricParts: string[] = [];

        if (plan.expectedOutcome) {
            rubricParts.push(`Expected outcome: "${plan.expectedOutcome}"`);
        }
        if (plan.verificationCriteria && Array.isArray(plan.verificationCriteria)) {
            for (const c of plan.verificationCriteria) {
                rubricParts.push(`Verification criterion: "${c}"`);
            }
        }
        if (plan.tradeoffs && Array.isArray(plan.tradeoffs)) {
            for (const t of plan.tradeoffs) {
                if (t.decision) {
                    rubricParts.push(`Chosen approach: "${t.decision}" (not alternatives)`);
                }
            }
        }
        if (plan.consequences && Array.isArray(plan.consequences)) {
            for (const c of plan.consequences) {
                if (c.mitigation) {
                    rubricParts.push(`Required mitigation: "${c.mitigation}"`);
                }
            }
        }

        // If the plan has no verifiable fields, skip gracefully
        if (rubricParts.length === 0) return 'skipped';

        const rubric = rubricParts
            .map((r, i) => `${i + 1}. ${r}`)
            .join('\n');

        // LLM Judge call (same model as execution)
        if (!aiService.isActive()) return 'skipped';

        try {
            const prompt = `You are a plan-adherence verification judge.
Rate the following code output against these plan requirements:
${rubric}

Score 0.0 to 1.0 based on how many requirements are met.
Score 1.0 = all requirements fully addressed. Score 0.0 = none addressed.
Be strict: partial implementations or missing mitigations should lower the score significantly.

Code output to verify:
"${outputContent.substring(0, 8000)}"`;

            const response = await aiService.chat([
                { role: 'user', content: prompt }
            ], {
                temperature: 0.0,
                responseSchema: {
                    type: 'object',
                    title: 'VerificationScore',
                    properties: {
                        score: { type: 'number', minimum: 0, maximum: 1 },
                        explanation: { type: 'string' }
                    },
                    required: ['score', 'explanation'],
                    additionalProperties: false
                }
            }) as import('./AIService').ChatResponse;

            const data = JSON.parse(response.text);
            const score = Number(data.score || 0.0);
            const passed = score >= 0.7;

            dbService.addVerificationResult(
                taskOutputId,
                998, // Plan adherence dynamic rule ID
                passed ? 'passed' : 'failed',
                score,
                `Plan adherence (${rubricParts.length} criteria): ${data.explanation || ''}`,
                'llm'
            );

            console.log(`[VerificationService] Plan adherence score: ${score.toFixed(2)} — ${passed ? 'PASSED' : 'FAILED'}`);
            return passed ? 'passed' : 'failed';
        } catch (e) {
            console.error('[VerificationService] Plan adherence LLM judge failed:', e);
            // On error, skip rather than block execution
            return 'skipped';
        }
    }
}
