import { dbService } from '../db';
import { EmbeddingService } from './EmbeddingService';
import console from 'console';

export class LearningService {
    /**
     * Records performance metrics in SQLite and indexes successful patterns into RAG.
     */
    static async captureLearning(taskId: number): Promise<void> {
        console.assert(typeof taskId === 'number', 'taskId must be a number');
        
        console.log(`[LearningService] Capturing learning stats for task ID ${taskId}...`);
        
        const task = dbService.getTask(taskId);
        if (!task) {
            console.warn(`[LearningService] Task ID ${taskId} not found. Learning capture aborted.`);
            return;
        }

        const attempts = dbService.getExecutionAttempts(taskId);
        if (attempts.length === 0) {
            console.log('[LearningService] No execution attempts found. Skipping performance logs.');
            return;
        }

        const lastAttempt = attempts[attempts.length - 1];
        const isSuccess = lastAttempt.verification_status === 'passed';
        
        const outputs = dbService.getTaskOutputs(taskId);
        const lastOutput = outputs.length > 0 ? outputs[0] : null;

        try {
            dbService.addModelPerformance(
                lastAttempt.model_used || 'unknown',
                lastAttempt.provider_used || 'unknown',
                'code_edit',
                isSuccess ? 1 : 0,
                attempts.length,
                lastOutput ? Number(lastOutput.token_count || 0) : 0,
                3000
            );
            console.log('[LearningService] Registered model performance metrics successfully.');
        } catch (e) {
            console.error('[LearningService] Failed to save performance metrics:', e);
        }

        if (isSuccess && lastOutput) {
            try {
                const knowledgeText = `[Successful Solution Pattern]\n` +
                    `Task Title: ${task.title}\n` +
                    `Task Description: ${task.description || 'No description'}\n` +
                    `Successful Model: ${lastAttempt.model_used}\n` +
                    `Attempts Taken: ${attempts.length}\n` +
                    `Code Snippet Solution:\n${lastOutput.content}`;

                console.log(`[LearningService] Semantic indexing successful coding solution for similar task retrieval...`);
                
                await EmbeddingService.indexKnowledge(
                    'past_solution',
                    taskId.toString(),
                    knowledgeText,
                    {
                        task_id: taskId,
                        model: lastAttempt.model_used,
                        attempts: attempts.length,
                        captured_at: new Date().toISOString()
                    }
                );
                
                console.log('[LearningService] Semantic solution indexed into RAG memory vector table successfully.');
            } catch (err) {
                console.error('[LearningService] Failed to index learning semantic memory chunk:', err);
            }
        }
    }
}
