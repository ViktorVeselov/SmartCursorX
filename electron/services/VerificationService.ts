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
    static async verifyOutput(taskOutputId: number): Promise<'passed' | 'failed' | 'needs_review'> {
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
                        const provider = aiService.getProvider();
                        const prompt = `Rate the following content on a scale of 0 to 1 based on the rubric: "${rule.config.rubric}".
Respond with a JSON structure containing: {"score": 0.8, "explanation": "reasons..."}.

Content to verify:
"${output.content}"`;

                        const response = await provider.chat([
                            { role: 'user', content: prompt }
                        ], { temperature: 0.0 });

                        const data = JSON.parse(typeof response === 'string' ? response : '{"score": 0, "explanation": "error"}');
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

        dbService.updateTaskOutputVerification(taskOutputId, finalStatus);
        return finalStatus;
    }
}
