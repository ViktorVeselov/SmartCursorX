import { dbService } from '../db';
import { CodeAnalysisService } from './CodeAnalysisService';

export interface ContextBudget {
    taskContext: number;      // tokens for task description + parent chain
    ragResults: number;       // tokens for RAG-retrieved knowledge
    codeSymbols: number;      // tokens for relevant code structures
    chatHistory: number;      // tokens for recent conversation
    total: number;            // hard cap (sum of above)
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

        // 1. Traverse parent task chain
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

        // 2. Extract references to workspace symbols if mentioned
        let symbolContextBlock = '';
        const symbolList: string[] = [];

        // Check task descriptions or messages for potential files to analyze
        const activeTask = dbService.getTask(taskId);
        const textToScan = `${activeTask ? activeTask.description : ''} ${activeTask ? activeTask.title : ''}`;
        
        // Simple file path regex extraction
        const pathMatches = textToScan.match(/[\w-]+\.(?:ts|tsx|js|jsx|py|rs)/g);
        if (pathMatches) {
            const uniquePaths = Array.from(new Set(pathMatches));
            for (const file of uniquePaths.slice(0, 3)) { // limit path scan counts
                const outline = CodeAnalysisService.getWorkspaceOutline('.');
                const match = outline.find(o => o.filePath.includes(file));
                if (match) {
                    symbolList.push(`File Outline for ${file}:\nClasses: ${match.outline.classes.map((c: any) => c.name).join(', ')}\nFunctions: ${match.outline.functions.map((f: any) => f.name).join(', ')}`);
                }
            }
        }

        if (symbolList.length > 0) {
            symbolContextBlock = `Touched Code Outline Symbols:\n${symbolList.join('\n---\n')}\n`;
            // Bound inside symbol budget limit
            if (this.estimateTokens(symbolContextBlock) > budget.codeSymbols) {
                symbolContextBlock = symbolContextBlock.substring(0, budget.codeSymbols * 4); // safe cut
            }
            tokenUsage.codeSymbols = this.estimateTokens(symbolContextBlock);
        }

        // 3. Dynamic RAG retrieval backplanes
        let ragBlock = '';
        const relevantChunks: string[] = [];
        try {
            const { EmbeddingService } = require('./EmbeddingService');
            const queryText = activeTask ? `${activeTask.title} ${activeTask.description || ''}` : '';
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

        // 3. Simple message chat history inclusion
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

        // 4. Synthesize prompt
        tokenUsage.total = tokenUsage.taskContext + tokenUsage.ragResults + tokenUsage.codeSymbols + tokenUsage.chatHistory;

        const systemPrompt = `You are Cursor Replacer's high-reliability agentic assistant. Follow safety-critical guidelines.
${taskContextBlock}
${symbolContextBlock}
${ragBlock}
Observe previous history where appropriate:
${chatContextBlock}

Complete the active task effectively.`;

        return {
            systemPrompt,
            relevantChunks,
            symbolContext: symbolContextBlock,
            tokenUsage
        };
    }

    private static estimateTokens(text: string): number {
        // Fast static character heuristic conforming to token limit principles
        if (!text) return 0;
        return Math.ceil(text.length / 4);
    }
}
