import { dbService } from '../db';
import { aiService } from './AIService';

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
     */
    static async verifyOutput(taskOutputId: number): Promise<'passed' | 'failed' | 'needs_review'> {
        console.assert(typeof taskOutputId === 'number', 'Task Output ID must be a number');
        
        // Retrieve associated output
        const outputs = dbService.getTaskOutputs(1); // dummy fetch or general lookup helper
        const output = outputs.find((o: any) => o.id === taskOutputId);
        if (!output) {
            throw new Error(`Task output ID ${taskOutputId} not found`);
        }

        const rules = dbService.getVerificationRules() as VerificationRule[];
        let finalStatus: 'passed' | 'failed' | 'needs_review' = 'passed';

        for (const rule of rules) {
            // Apply matching filter
            if (rule.applies_to !== '*' && !rule.applies_to.includes(output.output_type)) {
                continue;
            }

            let result: 'passed' | 'failed' | 'pending_review' = 'passed';
            let score: number | null = 1.0;
            let details = '';

            if (rule.rule_type === 'pattern') {
                // Tier 1: AUTOMATED REGEX/KEYWORD MATCHING
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
                // Tier 2: LLM JUDGE WITH STRUCTURAL RUBRICS
                if (aiService.isActive()) {
                    try {
                        const provider = aiService.getProvider();
                        const prompt = `Rate the following content on a scale of 0 to 1 based on the rubric: "${rule.config.rubric}".
Respond with a JSON structure containing: {"score": 0.8, "explanation": "reasons..."}.

Content to verify:
"${output.content}"`;

                        const response = await provider.chat([
                            { role: 'user', content: prompt }
                        ], { temperature: 0.1 });

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
                // Tier 3: HUMAN REVIEW
                result = 'pending_review';
                details = rule.config.prompt || 'Pending manual human review approval';
            }

            // Save verification result block
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

        // Update task output state
        dbService.updateTaskOutputVerification(taskOutputId, finalStatus === 'needs_review' ? 'needs_review' : finalStatus);
        return finalStatus;
    }
}
