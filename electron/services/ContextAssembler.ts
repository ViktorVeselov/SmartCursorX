import { dbService } from '../db';
import { CodeAnalysisService } from './CodeAnalysisService';
import console from 'console';
import * as fs from 'fs';
import * as path from 'path';

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
                    const absolutePath = this.resolveToAllowedRoot(file);
                    if (!absolutePath || !fs.existsSync(absolutePath)) {
                        console.warn(`[ContextAssembler] AST Pruning: File ${file} not found in whitelisted roots. Skipping.`);
                        continue;
                    }
                    const parsed = CodeAnalysisService.parseFileSymbols(absolutePath);
                    
                    if (parsed.classes.length > 0 || parsed.functions.length > 0 || parsed.interfaces.length > 0) {
                        let fileSummary = `=== AST STRUCTURE OF ${path.basename(absolutePath)} (${file}) ===\n`;
                        
                        if (parsed.classes.length > 0) {
                            fileSummary += `Classes:\n`;
                            for (const c of parsed.classes) {
                                fileSummary += `  class ${c.name} {\n`;
                                if (c.docstring) {
                                    fileSummary += `    /**\n     * ${c.docstring.replace(/\r?\n/g, '\n     * ')}\n     */\n`;
                                }
                                fileSummary += `  }\n`;
                            }
                        }

                        if (parsed.interfaces.length > 0) {
                            fileSummary += `Interfaces:\n`;
                            for (const i of parsed.interfaces) {
                                fileSummary += `  interface ${i.name} {\n`;
                                if (i.docstring) {
                                    fileSummary += `    /**\n     * ${i.docstring.replace(/\r?\n/g, '\n     * ')}\n     */\n`;
                                }
                                fileSummary += `  }\n`;
                            }
                        }

                        if (parsed.functions.length > 0) {
                            fileSummary += `Functions / Methods / Signatures:\n`;
                            for (const fn of parsed.functions) {
                                if (fn.docstring) {
                                    fileSummary += `  /**\n   * ${fn.docstring.replace(/\r?\n/g, '\n   * ')}\n   */\n`;
                                }
                                fileSummary += `  ${fn.signature}\n`;
                            }
                        }

                        if (parsed.functions.length > 0) {
                            const mainFunc = parsed.functions[0].name;
                            const callHierarchy = CodeAnalysisService.getCallHierarchy(mainFunc, path.dirname(absolutePath), 'incoming');
                            if (callHierarchy.length > 0) {
                                fileSummary += `Incoming Callers to ${mainFunc}: ${callHierarchy.map(h => `${h.symbol} (${path.basename(h.filePath)})`).join(', ')}\n`;
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

        // Load Ground-Truth Architecture Blueprint (project-context.md)
        let blueprintBlock = '';
        try {
            const blueprintPath = path.resolve(process.cwd(), '../memory/project-context.md');
            if (fs.existsSync(blueprintPath)) {
                blueprintBlock = `\n=== GROUND-TRUTH SYSTEM ARCHITECTURE BLUEPRINT ===\n${fs.readFileSync(blueprintPath, 'utf-8')}\n=== END BLUEPRINT ===\n`;
            }
        } catch (e) {
            console.warn('[ContextAssembler] Failed to read project-context.md blueprint:', e);
        }

        // Query matched memories vector/keyword logs from SQLite
        let matchedMemoriesBlock = '';
        try {
            const queryText = `${activeTask.title} ${activeTask.description || ''}`;
            const matched = dbService.searchMemories(queryText, 4);
            if (matched.length > 0) {
                matchedMemoriesBlock = `\n=== RETRIEVED ARCHITECTURAL DECISIONS & MEMORIES ===\n` +
                    matched.map((m: any) => `[Type: ${m.type} (Updated: ${m.updated_at})]\nRule: ${m.content}`).join('\n---\n') +
                    `\n=== END MEMORIES ===\n`;
            }
        } catch (e) {
            console.error('[ContextAssembler] Failed to search memories:', e);
        }

        const systemPrompt = `You are Cursor Replacer's high-reliability agentic assistant. Follow strict safety-critical guidelines.
Ensure 100% accurate edits. Verify syntax and types, and do not introduce implicit 'any' values.

${blueprintBlock}
${matchedMemoriesBlock}
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

    private static getWhitelistedRoots(): string[] {
        const workspaceRoot = path.resolve(process.cwd());
        const parentRoot = path.resolve(workspaceRoot, '..');
        return [
            workspaceRoot,
            path.resolve(parentRoot, 'adk-python-community'),
            path.resolve(parentRoot, 'google-sdk')
        ];
    }

    private static normalizePathForCompare(p: string): string {
        let resolved = path.resolve(p);
        if (process.platform === 'win32') {
            resolved = resolved.toLowerCase();
        }
        return resolved;
    }

    private static resolveToAllowedRoot(relativePath: string): string | null {
        const roots = this.getWhitelistedRoots();
        for (const root of roots) {
            const resolvedPath = path.isAbsolute(relativePath)
                ? relativePath
                : path.resolve(root, relativePath);
            const normRoot = this.normalizePathForCompare(root);
            const normResolved = this.normalizePathForCompare(resolvedPath);
            
            const relative = path.relative(normRoot, normResolved);
            const contained = relative === '' || (relative && !relative.startsWith('..') && !path.isAbsolute(relative));
            if (contained) {
                return resolvedPath;
            }
        }
        return null;
    }
}
