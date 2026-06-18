import { dbService } from '../db';
import { aiService } from './AIService';
import { ContextAssembler } from './ContextAssembler';
import { secureStore } from '../secureStore';
import { ExecutionPlanSchema } from './ai';
import type { ExecutionPlan } from './ai';
import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import console from 'console';

export type { ExecutionPlan, PlanStep, Tradeoff, Consequence } from './ai';

const MAX_PLAN_RETRIES = 3;

export class PlanningService {
    private static getWhitelistedRoots(workspacePath: string): string[] {
        return [path.resolve(workspacePath)];
    }

    private static resolveToAllowedRoot(relativePath: string, workspacePath: string): string | null {
        const roots = this.getWhitelistedRoots(workspacePath);
        for (const root of roots) {
            const resolvedPath = path.isAbsolute(relativePath)
                ? relativePath
                : path.resolve(root, relativePath);
            
            const normRoot = root.toLowerCase();
            const normResolved = resolvedPath.toLowerCase();
            const relative = path.relative(normRoot, normResolved);
            const contained = relative === '' || (relative && !relative.startsWith('..') && !path.isAbsolute(relative));
            if (contained) {
                return resolvedPath;
            }
        }
        return null;
    }

    private static getToolDescription(
        toolId: string,
        defaultDescription: string,
        taxonomyResult: any
    ): string {
        if (!taxonomyResult) return defaultDescription;

        // 1. Check if there are any static overrides from the taxonomy tree first
        const staticOverride = taxonomyResult.toolOverrides?.find((o: any) => o.toolId === toolId);
        if (staticOverride && staticOverride.description) {
            return staticOverride.description;
        }

        // 2. Generate dynamic, domain-specific overrides based on the classified domain path
        const domainPath = taxonomyResult.classification?.domain?.nodeIds || [];
        if (domainPath.length > 0) {
            const leafNode = domainPath[domainPath.length - 1]; // e.g. "backend.database.relational.postgresql" or "frontend.framework.react"
            
            if (leafNode.includes('postgresql')) {
                if (toolId === 'grep_search') {
                    return `${defaultDescription} (Domain Guidance: Scan for database schemas, SQL files, prisma schemas, knex migrations, or DDL script files to verify table definitions, index mappings, and relation constraint names).`;
                }
                if (toolId === 'read_file') {
                    return `${defaultDescription} (Domain Guidance: Inspect migration scripts, configuration files, and schema source files to verify precise SQL syntax, constraint names, or type fields).`;
                }
            } else if (leafNode.includes('react')) {
                if (toolId === 'grep_search') {
                    return `${defaultDescription} (Domain Guidance: Scan for frontend component structures, tsx files, styles, hooks, and React flow layouts to ensure state management and styling guidelines match existing conventions).`;
                }
            } else if (leafNode.includes('api.rest')) {
                if (toolId === 'grep_search') {
                    return `${defaultDescription} (Domain Guidance: Scan for API route mappings, controller files, router setup, and express/fastapi route definitions to verify exact HTTP verb mappings and RESTful semantics).`;
                }
            } else if (leafNode.includes('concurrency')) {
                if (toolId === 'grep_search') {
                    return `${defaultDescription} (Domain Guidance: Scan for mutexes, async/await lock mechanisms, threads, or race-condition prevention code blocks to inspect existing synchronization patterns).`;
                }
            }
        }

        return defaultDescription;
    }

    /**
     * Generates a structured multi-step execution plan for a given task.
     * Uses a two-step agentic process:
     * 1. Multi-turn tool calling using generateText to explore files, list folders, or grep.
     * 2. Feeds the exploration history to generateObject to output a structured ExecutionPlan.
     */
    static async generatePlan(taskId: number): Promise<ExecutionPlan> {
        console.assert(typeof taskId === 'number', 'taskId must be a valid number');

        const task = dbService.getTask(taskId);
        if (!task) {
            throw new Error(`[PlanningService] Task with ID ${taskId} not found in database.`);
        }

        const workspacePath = dbService.getWorkspacePathForTask(taskId) || process.cwd();

        const assembled = await ContextAssembler.assembleContext(taskId, [], {
            taskContext: 4000,
            ragResults: 2000,
            codeSymbols: 2000,
            chatHistory: 1000,
            total: 9000
        });

        const prompt = `You are a high-reliability software architect.
Generate a highly structured, deterministic, multi-step Execution Plan for the active task.
Your goal is 100% accuracy and safety. Plan all reads, analyses, modifications, and testing steps before executing.

=== ZERO-ASSUMPTION PLANNING POLICY ===
1. Evidence-Based: Base your plan steps on facts/code files that you have explicitly verified. No guessing.
2. Assumption Identification: Scrutinize all assumptions (e.g., assuming a file exists, assuming a function signature).
3. Explicit Uncertainty: If you have ANY uncertainty about imports, database tables, or function names, use your tool actions (read_file, grep_search, list_directory) to explore the workspace and verify them before outputting your final plan.
4. Direct File Operations: When you are certain of the required change, use write_file to create/replace files and edit_file for surgical find/replace patches. These tools respect workspace containment and handle parent directory creation automatically.

Task Information:
Title: ${task.title}
Description: ${task.description || 'No description provided'}

Workspace Context:
${assembled.systemPrompt}

For "tradeoffs": You MUST consider at least 3 distinct architectural/design options (preferably 5). Compare pros, cons, complexity, security implications, and maintenance burden, then state the final decision and why it was chosen.

For "consequences": You MUST include at least 3 entries. Think critically about what can actually go wrong at the SYSTEM level. For each consequence, analyze failure modes, consequences, harm analysis, and mitigations.`;

        const userModel = secureStore.getSelectedModel();
        const model = aiService.getModel(userModel);

        let lastError: Error | null = null;

        if (!aiService.isActive()) {
            throw new Error('[PlanningService] AI provider not active. Cannot generate plan.');
        }

        for (let attempt = 1; attempt <= MAX_PLAN_RETRIES; attempt++) {
            try {
                console.log(`[PlanningService] Step 1: Exploring workspace with tools (attempt ${attempt})...`);
                const toolMessages = [{ role: 'user' as const, content: prompt }];
                const toolResult = await generateText({
                    model,
                    messages: toolMessages,
                    temperature: attempt === 3 ? 0.3 : 0.1,
                    stopWhen: stepCountIs(5),
                    tools: {
                        read_file: tool({
                            description: PlanningService.getToolDescription(
                                'read_file',
                                'Read the contents of a file in the workspace to verify code structures or signatures.',
                                assembled.taxonomyResult
                            ),
                            inputSchema: z.object({ filePath: z.string() }),
                            execute: async ({ filePath }: { filePath: string }) => {
                                const absolutePath = PlanningService.resolveToAllowedRoot(filePath, workspacePath);
                                if (!absolutePath || !fs.existsSync(absolutePath)) {
                                    return `Error: File not found or out of bounds: ${filePath}`;
                                }
                                try {
                                    const content = fs.readFileSync(absolutePath, 'utf-8');
                                    return content.length > 4000 ? content.substring(0, 4000) + '\n... [TRUNCATED] ...' : content;
                                } catch (err: any) {
                                    return `Error reading file: ${err.message}`;
                                }
                            }
                        }),
                        grep_search: tool({
                            description: PlanningService.getToolDescription(
                                'grep_search',
                                'Perform a fast substring/regex search across workspace files.',
                                assembled.taxonomyResult
                            ),
                            inputSchema: z.object({ query: z.string() }),
                            execute: async ({ query }: { query: string }) => {
                                try {
                                    const results: string[] = [];
                                    const roots = PlanningService.getWhitelistedRoots(workspacePath);
                                    
                                    const searchDir = (dir: string) => {
                                        if (results.length >= 30) return;
                                        const files = fs.readdirSync(dir);
                                        for (const file of files) {
                                            const fullPath = path.join(dir, file);
                                            const stat = fs.statSync(fullPath);
                                            if (stat.isDirectory()) {
                                                if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                                                    searchDir(fullPath);
                                                }
                                            } else if (stat.isFile() && /\.(ts|tsx|js|jsx|json|py|rs|md|txt)$/.test(file)) {
                                                const content = fs.readFileSync(fullPath, 'utf-8');
                                                if (content.includes(query)) {
                                                    const lines = content.split('\n');
                                                    lines.forEach((line, idx) => {
                                                        if (line.includes(query) && results.length < 30) {
                                                            results.push(`${path.relative(workspacePath, fullPath)}:L${idx + 1}: ${line.trim().substring(0, 100)}`);
                                                        }
                                                    });
                                                }
                                            }
                                        }
                                    };

                                    for (const root of roots) {
                                        if (fs.existsSync(root)) searchDir(root);
                                    }

                                    return results.length > 0 ? results.join('\n') : 'No matches found.';
                                } catch (err: any) {
                                    return `Error searching: ${err.message}`;
                                }
                            }
                        }),
                        list_directory: tool({
                            description: PlanningService.getToolDescription(
                                'list_directory',
                                'List the files and subfolders in a workspace directory.',
                                assembled.taxonomyResult
                            ),
                            inputSchema: z.object({ dirPath: z.string().optional() }),
                            execute: async ({ dirPath }: { dirPath?: string }) => {
                                const target = dirPath ? PlanningService.resolveToAllowedRoot(dirPath, workspacePath) : workspacePath;
                                if (!target || !fs.existsSync(target)) {
                                    return `Error: Directory not found or out of bounds: ${dirPath || '/'}`;
                                }
                                try {
                                    const files = fs.readdirSync(target);
                                    return files.map(f => {
                                        const stat = fs.statSync(path.join(target, f));
                                        return `${f}${stat.isDirectory() ? '/' : ''}`;
                                    }).join('\n');
                                } catch (err: any) {
                                    return `Error listing directory: ${err.message}`;
                                }
                            }
                        }),
                        write_file: tool({
                            description: PlanningService.getToolDescription(
                                'write_file',
                                'Create or overwrite a workspace file. Creates parent directories if they do not exist. Use this to write new files or replace entire file contents.',
                                assembled.taxonomyResult
                            ),
                            inputSchema: z.object({
                                filePath: z.string().describe('Relative path from workspace root'),
                                content: z.string().describe('Full file content to write')
                            }),
                            execute: async ({ filePath, content }: { filePath: string; content: string }) => {
                                const absolutePath = PlanningService.resolveToAllowedRoot(filePath, workspacePath);
                                if (!absolutePath) {
                                    return `Error: Path out of bounds: ${filePath}`;
                                }
                                try {
                                    const dir = path.dirname(absolutePath);
                                    if (!fs.existsSync(dir)) {
                                        fs.mkdirSync(dir, { recursive: true });
                                    }
                                    fs.writeFileSync(absolutePath, content, 'utf-8');
                                    const lines = content.split('\n').length;
                                    return `Successfully wrote ${filePath} (${lines} lines, ${content.length} bytes)`;
                                } catch (err: any) {
                                    return `Error writing file: ${err.message}`;
                                }
                            }
                        }),
                        edit_file: tool({
                            description: PlanningService.getToolDescription(
                                'edit_file',
                                'Find exact text in a file and replace it. Use for surgical edits without rewriting the whole file. Returns error if the file does not exist or the text is not found.',
                                assembled.taxonomyResult
                            ),
                            inputSchema: z.object({
                                filePath: z.string().describe('Relative path from workspace root'),
                                find: z.string().describe('Exact text to find (case-sensitive)'),
                                replace: z.string().describe('Replacement text')
                            }),
                            execute: async ({ filePath, find, replace }: { filePath: string; find: string; replace: string }) => {
                                const absolutePath = PlanningService.resolveToAllowedRoot(filePath, workspacePath);
                                if (!absolutePath) {
                                    return `Error: Path out of bounds: ${filePath}`;
                                }
                                if (!fs.existsSync(absolutePath)) {
                                    return `Error: File not found: ${filePath}. Use write_file to create it first.`;
                                }
                                try {
                                    const content = fs.readFileSync(absolutePath, 'utf-8');
                                    if (!content.includes(find)) {
                                        return `Error: Could not find exact match "${find.substring(0, 80)}${find.length > 80 ? '...' : ''}" in ${filePath}. The text must match exactly including whitespace.`;
                                    }
                                    const newContent = content.replace(find, replace);
                                    fs.writeFileSync(absolutePath, newContent, 'utf-8');
                                    const diff = content.split('\n').length - newContent.split('\n').length;
                                    const diffStr = diff > 0 ? `removed ${diff} lines` : diff < 0 ? `added ${Math.abs(diff)} lines` : 'no line count change';
                                    return `Successfully edited ${filePath} (${diffStr})`;
                                } catch (err: any) {
                                    return `Error editing file: ${err.message}`;
                                }
                            }
                        })
                    }
                });

                console.log(`[PlanningService] Step 2: Generating final structured plan JSON...`);
                const finalMessages = [...toolMessages, ...toolResult.response.messages];

                const plan = await aiService.generateObject(
                    ExecutionPlanSchema,
                    finalMessages as any,
                    {
                        model: userModel,
                        temperature: attempt === 3 ? 0.3 : 0.1
                    }
                );

                plan.taskId = taskId;
                dbService.addTaskPlan(taskId, JSON.stringify(plan), plan.confidence, 'draft');
                return plan as unknown as ExecutionPlan;
            } catch (e) {
                lastError = e instanceof Error ? e : new Error(String(e));
                console.warn(`[PlanningService] Attempt ${attempt}/${MAX_PLAN_RETRIES} failed`, lastError.message);

                if (attempt < MAX_PLAN_RETRIES) {
                    console.log(`[PlanningService] Retrying attempt ${attempt + 1}/${MAX_PLAN_RETRIES}...`);
                }
            }
        }

        throw new Error(
            `[PlanningService] Plan generation failed after ${MAX_PLAN_RETRIES} attempts. ` +
            `Model: ${userModel}, Provider: ${aiService.providerId}. ` +
            `Last error: ${lastError?.message || 'Unknown error'}. ` +
            `Please check that your selected model supports structured JSON output or try a different model.`
        );
    }
}
