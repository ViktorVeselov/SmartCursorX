import { dbService } from '../db';
import { CodeAnalysisService } from './CodeAnalysisService';
import console from 'console';

export interface ContextBudget {
    taskContext: number;
    ragResults: number;
    codeSymbols: number;
    chatHistory: number;
    total: number;
}

export interface AssembledContext {
    systemPrompt: string;
    relevantChunks: string[];
    symbolContext: string;
    tokenUsage: Record<string, number>;
}

export class ContextAssembler {
    /**
     * Intelligently selects, scores, and packs workspace elements within a strict budget constraint.
     * Incorporates Phase 3 active context discovery and plan-aware symbol mapping.
     */
    static async assembleContext(
        taskId: number,
        recentMessages: Array<{ role: string; content: string }>,
        budget: ContextBudget = { taskContext: 3000, ragResults: 3000, codeSymbols: 3000, chatHistory: 3000, total: 12000 }
    ): Promise<AssembledContext> {
        console.assert(typeof taskId === 'number', 'Task ID is required');
        console.assert(Array.isArray(recentMessages), 'Messages must be a valid array');

        const tokenUsage: Record<string, number> = {
            taskContext: 0,
            ragResults: 0,
            codeSymbols: 0,
            chatHistory: 0,
            total: 0
        };

        const activeTask = dbService.getTask(taskId);
        if (!activeTask) {
            throw new Error(`[ContextAssembler] Task with ID ${taskId} not found in database.`);
        }

        let taskContextBlock = '';
        let currentId: number | null = taskId;
        const taskChain: string[] = [];

        while (currentId !== null) {
            const task = dbService.getTask(currentId);
            if (!task) break;
            taskChain.unshift(`[Task ID ${task.id}]: ${task.title}\nDescription: ${task.description || 'None'}\nStatus: ${task.status}`);
            currentId = task.parent_task_id;
        }

        taskContextBlock = `Active hierarchical task context tree:\n${taskChain.join('\n└── ')}\n`;
        tokenUsage.taskContext = this.estimateTokens(taskContextBlock);

        let symbolContextBlock = '';
        const symbolList: string[] = [];
        const filesToParse = new Set<string>();

        const planRow = dbService.getTaskPlan(taskId);
        if (planRow) {
            try {
                const plan = JSON.parse(planRow.plan_json);
                const reads = plan.filesRead || [];
                const writes = plan.filesToModify || [];
                
                for (const f of [...reads, ...writes]) {
                    if (typeof f === 'string' && f.trim().length > 0) {
                        filesToParse.add(f.trim());
                    }
                }
            } catch (e) {
                console.error('[ContextAssembler] Failed to parse plan JSON for active context discovery:', e);
            }
        }

        if (filesToParse.size === 0) {
            const textToScan = `${activeTask.description || ''} ${activeTask.title}`;
            const pathMatches = textToScan.match(/[\w-]+\.(?:ts|tsx|js|jsx|py|rs)/g);
            if (pathMatches) {
                for (const f of pathMatches) {
                    filesToParse.add(f);
                }
            }
        }

        if (filesToParse.size > 0) {
            const uniquePaths = Array.from(filesToParse).slice(0, 5);
            
            for (const file of uniquePaths) {
                try {
                    const parsed = CodeAnalysisService.parseFileSymbols(file);
                    
                    if (parsed.classes.length > 0 || parsed.functions.length > 0 || parsed.interfaces.length > 0) {
                        const classNames = parsed.classes.map(c => c.name).join(', ');
                        const funcNames = parsed.functions.map(f => f.name).join(', ');
                        const interfaceNames = parsed.interfaces.map(i => i.name).join(', ');

                        let fileSummary = `File outline for ${file}:\n`;
                        if (classNames) fileSummary += `  Classes: ${classNames}\n`;
                        if (funcNames) fileSummary += `  Functions: ${funcNames}\n`;
                        if (interfaceNames) fileSummary += `  Interfaces: ${interfaceNames}\n`;

                        if (parsed.functions.length > 0) {
                            const mainFunc = parsed.functions[0].name;
                            const callHierarchy = CodeAnalysisService.getCallHierarchy(mainFunc, '.', 'incoming');
                            if (callHierarchy.length > 0) {
                                fileSummary += `  Incoming Callers to ${mainFunc}: ${callHierarchy.map(h => `${h.symbol} (${h.filePath})`).join(', ')}\n`;
                            }
                        }

                        symbolList.push(fileSummary);
                    }
                } catch (err) {
                    console.warn(`[ContextAssembler] Failed parsing outline for file ${file}:`, err);
                }
            }
        }

        if (symbolList.length > 0) {
            symbolContextBlock = `Workspace Code Outline Symbols:\n${symbolList.join('\n---\n')}\n`;
            
            if (this.estimateTokens(symbolContextBlock) > budget.codeSymbols) {
                symbolContextBlock = symbolContextBlock.substring(0, budget.codeSymbols * 4);
            }
            tokenUsage.codeSymbols = this.estimateTokens(symbolContextBlock);
        }

        let ragBlock = '';
        const relevantChunks: string[] = [];
        try {
            const { EmbeddingService } = require('./EmbeddingService');
            const queryText = `${activeTask.title} ${activeTask.description || ''}`;
            if (queryText.trim().length > 0) {
                const results = await EmbeddingService.searchSimilarity(queryText, 3);
                let currentRagTokens = 0;
                
                for (const r of results) {
                    const chunkText = `[Semantic Memory Source: ${r.sourceType} - Dist: ${r.distance.toFixed(3)}]\n${r.content}\n`;
                    const chunkTokens = Math.ceil(chunkText.length / 4);
                    
                    if (currentRagTokens + chunkTokens > budget.ragResults) {
                        break;
                    }
                    relevantChunks.push(chunkText);
                    currentRagTokens += chunkTokens;
                }
                
                if (relevantChunks.length > 0) {
                    ragBlock = `Relevant Shared Semantic Memory:\n${relevantChunks.join('\n---\n')}\n`;
                    tokenUsage.ragResults = currentRagTokens;
                }
            }
        } catch (e) {
            console.error('[ContextAssembler] RAG retrieval failed:', e);
        }

        let chatContextBlock = '';
        const selectedMessages: Array<{ role: string; content: string }> = [];
        let accumulatedTokens = 0;

        for (let i = recentMessages.length - 1; i >= 0; i--) {
            const msg = recentMessages[i];
            const msgTokens = this.estimateTokens(msg.content);
            if (accumulatedTokens + msgTokens > budget.chatHistory) {
                break;
            }
            selectedMessages.unshift(msg);
            accumulatedTokens += msgTokens;
        }

        chatContextBlock = selectedMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
        tokenUsage.chatHistory = accumulatedTokens;

        tokenUsage.total = tokenUsage.taskContext + tokenUsage.ragResults + tokenUsage.codeSymbols + tokenUsage.chatHistory;

        const systemPrompt = `You are Cursor Replacer's high-reliability agentic assistant. Follow strict safety-critical guidelines.
Ensure 100% accurate edits. Verify syntax and types, and do not introduce implicit 'any' values.

${taskContextBlock}
${symbolContextBlock}
${ragBlock}

Observe previous conversation history where appropriate:
${chatContextBlock}

Execute the active task effectively using the predefined plan.`;

        return {
            systemPrompt,
            relevantChunks,
            symbolContext: symbolContextBlock,
            tokenUsage
        };
    }

    private static estimateTokens(text: string): number {
        if (!text) return 0;
        return Math.ceil(text.length / 4);
    }
}
