import { dbService } from '../db';
import { CodeAnalysisService } from './CodeAnalysisService';
import { EmbeddingService } from './EmbeddingService';
import { taxonomyService } from './taxonomy/TaxonomyService';
import { TaxonomyPromptComposer } from './taxonomy/TaxonomyPromptComposer';
import { PathGuard } from './PathGuard';
import { RuleDiscoveryService } from './RuleDiscoveryService';
import { ContextReconciler } from './ContextReconciler';
import { secureStore } from '../secureStore';
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
    taxonomyResult: any;
}

export class ContextAssembler {
    /**
     * Intelligently selects, scores, and packs workspace elements within a strict budget constraint.
     * Incorporates Phase 3 active context discovery and plan-aware symbol mapping.
     */
    static async assembleContext(
        taskId: number,
        recentMessages: Array<{ role: string; content: string }>,
        budget: ContextBudget = { taskContext: 3000, ragResults: 3000, codeSymbols: 3000, chatHistory: 3000, total: 12000 },
        conversationId?: string,
        passedWorkspacePath?: string,
        investigationResults?: string
    ): Promise<AssembledContext> {
        console.assert(typeof taskId === 'number', 'Task ID is required');
        console.assert(Array.isArray(recentMessages), 'Messages must be a valid array');

        const workspacePath = passedWorkspacePath || dbService.getWorkspacePathForTask(taskId) || undefined;

        // Dynamic Context Window Budgeting
        let finalBudget = { ...budget };
        try {
            const userModel = secureStore.getSelectedModel();
            const maxTokens = this.resolveModelContextWindow(userModel);
            const targetTotal = Math.floor(maxTokens * 0.75); // Leave 25% safety buffer
            
            if (targetTotal < budget.total) {
                const scale = targetTotal / budget.total;
                finalBudget.taskContext = Math.max(500, Math.floor(budget.taskContext * scale));
                finalBudget.ragResults = Math.max(500, Math.floor(budget.ragResults * scale));
                finalBudget.codeSymbols = Math.max(500, Math.floor(budget.codeSymbols * scale));
                finalBudget.chatHistory = Math.max(500, Math.floor(budget.chatHistory * scale));
                finalBudget.total = targetTotal;
                console.log(`[ContextAssembler] Small context window detected (${maxTokens} tokens). scaled context budgets down:`, finalBudget);
            } else if (maxTokens > 16000) {
                // Scale up budget for large models
                finalBudget.taskContext = 8000;
                finalBudget.ragResults = 8000;
                finalBudget.codeSymbols = 8000;
                finalBudget.chatHistory = 8000;
                finalBudget.total = Math.floor(maxTokens * 0.75);
            }
        } catch (e) {
            console.warn('[ContextAssembler] Failed to resolve dynamic context window budget:', e);
        }

        if (conversationId) {
            let hash = 5381;
            for (let i = 0; i < conversationId.length; i++) {
                hash = (hash * 33) ^ conversationId.charCodeAt(i);
            }
            const expectedTaskId = Math.abs(hash) || 1;
            if (taskId !== expectedTaskId) {
                throw new Error(`[ContextAssembler] Plan security violation: Task ID ${taskId} does not match active conversation ${conversationId}`);
            }
        }

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

        let planRow = dbService.getTaskPlan(taskId);
        if (!planRow && activeTask.parent_task_id) {
            planRow = dbService.getTaskPlan(activeTask.parent_task_id);
        }
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
                    const absolutePath = PathGuard.resolve(file);
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
            
            if (this.estimateTokens(symbolContextBlock) > finalBudget.codeSymbols) {
                symbolContextBlock = symbolContextBlock.substring(0, finalBudget.codeSymbols * 4);
            }
            tokenUsage.codeSymbols = this.estimateTokens(symbolContextBlock);
        }

        let ragBlock = '';
        const relevantChunks: string[] = [];
        try {
            const queryText = `${activeTask.title} ${activeTask.description || ''}`;
            if (queryText.trim().length > 0) {
                const results = await EmbeddingService.searchSimilarity(queryText, 3);
                let currentRagTokens = 0;
                
                for (const r of results) {
                    const chunkText = `[Semantic Memory Source: ${r.sourceType} - Dist: ${r.distance.toFixed(3)}]\n${r.content}\n`;
                    const chunkTokens = Math.ceil(chunkText.length / 4);
                    
                    if (currentRagTokens + chunkTokens > finalBudget.ragResults) {
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
            if (accumulatedTokens + msgTokens > finalBudget.chatHistory) {
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
            if (workspacePath) {
                const blueprintPath = path.resolve(workspacePath, 'memory/project-context.md');
                if (fs.existsSync(blueprintPath)) {
                    blueprintBlock = `\n=== GROUND-TRUTH SYSTEM ARCHITECTURE BLUEPRINT ===\n${fs.readFileSync(blueprintPath, 'utf-8')}\n=== END BLUEPRINT ===\n`;
                }
            }
        } catch (e) {
            console.warn('[ContextAssembler] Failed to read project-context.md blueprint:', e);
        }

        // Load Localized Rules (.replacerrules, .cursorrules, AGENTS.md)
        let localizedRulesBlock = '';
        try {
            if (workspacePath) {
                const startFile = Array.from(filesToParse)[0] || '';
                const startPath = startFile ? path.resolve(workspacePath, startFile) : workspacePath;
                const rules = RuleDiscoveryService.discoverRules(startPath, workspacePath);
                if (rules) {
                    localizedRulesBlock = `\n=== LOCAL WORKSPACE RULES & AGENT DIRECTIVES ===\n${rules}\n=== END LOCAL RULES ===\n`;
                }
            }
        } catch (e) {
            console.warn('[ContextAssembler] Failed to discover local rules:', e);
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

        // Reconcile context blocks to optimize token usage in multi-turn chat sessions
        let reconciledBlueprint = blueprintBlock;
        let reconciledMemories = matchedMemoriesBlock;
        let reconciledSymbols = symbolContextBlock;
        let reconciledRag = ragBlock;

        if (conversationId) {
            const reconciled = ContextReconciler.reconcile(conversationId, {
                blueprint: blueprintBlock,
                memories: matchedMemoriesBlock,
                symbols: symbolContextBlock,
                rag: ragBlock
            });
            reconciledBlueprint = reconciled.blueprint;
            reconciledMemories = reconciled.memories;
            reconciledSymbols = reconciled.symbols;
            reconciledRag = reconciled.rag;
        }

        // Build file contents map for taxonomy scanning
        const fileContentsMap: Record<string, string> = {};
        if (filesToParse.size > 0) {
            for (const file of filesToParse) {
                try {
                    const absolutePath = PathGuard.resolve(file);
                    if (absolutePath && fs.existsSync(absolutePath)) {
                        fileContentsMap[file] = fs.readFileSync(absolutePath, 'utf8');
                    }
                } catch (e) {
                    // ignore
                }
            }
        }

        // Run taxonomy classification
        let taxonomyResult = null;
        try {
            taxonomyResult = taxonomyService.classify(
                activeTask,
                'execution',
                planRow ? planRow.plan_json : undefined,
                investigationResults,
                fileContentsMap
            );
        } catch (e) {
            console.error('[ContextAssembler] Taxonomy classification failed:', e);
        }

        // Resolve parent plan details if available
        let planBlock = '';
        if (planRow) {
            try {
                const plan = JSON.parse(planRow.plan_json);
                planBlock = `\n=== ACTIVE TASK PLAN BLUEPRINT ===\nExpected Outcome: ${plan.expectedOutcome || 'None'}\n\nDesign Document:\n${plan.designDoc || 'None'}\n\nImplementation Trade-offs:\n${plan.tradeoffs ? JSON.stringify(plan.tradeoffs, null, 2) : 'None'}\n\nRisk Mitigation & Consequences:\n${plan.consequences ? JSON.stringify(plan.consequences, null, 2) : 'None'}\n=== END ACTIVE TASK PLAN BLUEPRINT ===\n`;
            } catch (e) {
                console.error('[ContextAssembler] Failed to construct plan block:', e);
            }
        }

        // Fetch completed sibling task outputs
        let siblingOutputsBlock = '';
        if (activeTask.parent_task_id) {
            try {
                const siblings = dbService.getSubtasks(activeTask.parent_task_id);
                const completedSiblings = siblings.filter((s: any) => s.status === 'completed' && s.id !== taskId);
                
                if (completedSiblings.length > 0) {
                    siblingOutputsBlock = '\n=== COMPLETED STEP HISTORY ===\n';
                    for (const sibling of completedSiblings) {
                        const outputs = dbService.getTaskOutputs(sibling.id);
                        if (outputs && outputs.length > 0) {
                            const latestOutput = outputs[0];
                            siblingOutputsBlock += `[Step: ${sibling.title}]\nResult:\n${latestOutput.content}\n---\n`;
                        }
                    }
                    siblingOutputsBlock += '=== END COMPLETED STEP HISTORY ===\n';
                }
            } catch (e) {
                console.error('[ContextAssembler] Failed to query sibling outputs:', e);
            }
        }

        const baseSystemPromptTemplate = `You are Cursor Replacer's high-reliability agentic assistant.
{{slot:safety_guidelines}}
{{slot:meta_instruction}}
{{slot:domain_guidance}}
{{slot:structural_patterns}}
{{slot:scale_awareness}}
{{slot:concurrency_guidance}}
{{slot:lifecycle_context}}

${reconciledBlueprint}
${reconciledMemories}
${localizedRulesBlock}
${taskContextBlock}
${planBlock}
${siblingOutputsBlock}
${reconciledSymbols}
${reconciledRag}

Observe previous conversation history where appropriate:
${chatContextBlock}

{{slot:verification_focus}}
Execute the active task effectively using the predefined plan.`;

        let systemPrompt = baseSystemPromptTemplate;
        if (taxonomyResult && taxonomyResult.resolvedSlots) {
            // Ensure fallback content exists in slots if empty
            if (!taxonomyResult.resolvedSlots.get('safety_guidelines')) {
                taxonomyResult.resolvedSlots.set('safety_guidelines', 'Follow strict safety-critical guidelines. Ensure 100% accurate edits.');
            }
            if (!taxonomyResult.resolvedSlots.get('verification_focus')) {
                const planSelfCheck = planRow
                    ? this.buildPlanAdherenceSelfCheck(JSON.parse(planRow.plan_json))
                    : 'Verify syntax and types, and do not introduce implicit \'any\' values.';
                taxonomyResult.resolvedSlots.set('verification_focus', planSelfCheck);
            }
            systemPrompt = TaxonomyPromptComposer.composePrompt(baseSystemPromptTemplate, taxonomyResult.resolvedSlots);
        } else {
            const fallbackSlots = new Map<string, string>();
            fallbackSlots.set('safety_guidelines', 'Follow strict safety-critical guidelines. Ensure 100% accurate edits.');
            const planSelfCheckFallback = planRow
                ? this.buildPlanAdherenceSelfCheck(JSON.parse(planRow.plan_json))
                : 'Verify syntax and types, and do not introduce implicit \'any\' values.';
            fallbackSlots.set('verification_focus', planSelfCheckFallback);
            systemPrompt = TaxonomyPromptComposer.composePrompt(baseSystemPromptTemplate, fallbackSlots);
        }

        return {
            systemPrompt,
            relevantChunks,
            symbolContext: symbolContextBlock,
            tokenUsage,
            taxonomyResult
        };
    }

    /**
     * Dynamically generates a plan-adherence self-check block from the plan's own fields.
     * This is injected into the verification_focus slot so the LLM self-validates during generation.
     * NOT hardcoded — adapts to any plan because it derives checks from plan JSON fields.
     */
    private static buildPlanAdherenceSelfCheck(plan: any): string {
        const checks: string[] = [];

        if (plan.expectedOutcome) {
            checks.push(`□ Verify your output achieves: "${plan.expectedOutcome}"`);
        }

        if (plan.verificationCriteria && Array.isArray(plan.verificationCriteria)) {
            for (const criterion of plan.verificationCriteria) {
                checks.push(`□ Criterion met: "${criterion}"`);
            }
        }

        if (plan.tradeoffs && Array.isArray(plan.tradeoffs)) {
            for (const t of plan.tradeoffs) {
                if (t.decision) {
                    checks.push(`□ Uses chosen approach: "${t.decision}"`);
                }
            }
        }

        if (plan.consequences && Array.isArray(plan.consequences)) {
            for (const c of plan.consequences) {
                if (c.mitigation) {
                    checks.push(`□ Mitigation applied: "${c.mitigation}"`);
                }
            }
        }

        if (plan.designDoc && typeof plan.designDoc === 'string' && plan.designDoc.length > 0) {
            const excerpt = plan.designDoc.substring(0, 500);
            checks.push(`□ Aligns with design architecture:\n"${excerpt}${plan.designDoc.length > 500 ? '...' : ''}"`);
        }

        return checks.length > 0
            ? `\n=== PLAN ADHERENCE SELF-CHECK ===\nBefore finalizing your output, verify each item:\n${checks.join('\n')}\n=== END SELF-CHECK ===\n`
            : 'Verify syntax and types, and do not introduce implicit \'any\' values.';
    }

    private static estimateTokens(text: string): number {
        if (!text) return 0;
        return Math.ceil(text.length / 4);
    }

    private static resolveModelContextWindow(modelName: string): number {
        const name = modelName.toLowerCase();
        
        // Cloud models
        if (name.includes('gemini-1.5-pro')) return 1000000;
        if (name.includes('gemini-1.5-flash')) return 1000000;
        if (name.includes('gemini')) return 1000000;
        if (name.includes('claude-3-5') || name.includes('claude-3')) return 200000;
        if (name.includes('gpt-4o') || name.includes('gpt-4-turbo')) return 128000;
        if (name.includes('gpt-4')) return 8192;
        if (name.includes('gpt-3.5')) return 16384;
        
        // Check local models from constants
        try {
            const { TOP_CODING_MODELS } = require('../constants/models');
            const matched = TOP_CODING_MODELS.find((m: any) => 
                name.includes(m.id.toLowerCase()) || name.includes(m.name.toLowerCase())
            );
            if (matched) return matched.contextWindow;
        } catch {
            // ignore require errors
        }

        // Generic patterns for local models
        const patterns: [RegExp, number][] = [
            [/smollm2?\d*/i, 2048], [/llama\s*-?\s*3/i, 8192], [/llama\s*-?\s*2/i, 4096],
            [/mistral/i, 32768], [/mixtral/i, 32768], [/gemma/i, 8192],
            [/falcon/i, 2048], [/starcoder/i, 8192], [/dolphin/i, 8192],
            [/nous-?hermes/i, 8192], [/yi/i, 4096], [/phi/i, 4096]
        ];
        for (const [re, ctx] of patterns) {
            if (re.test(name)) return ctx;
        }

        return 4096; // default fallback
    }


}
