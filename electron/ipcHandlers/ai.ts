import { aiService, ApiTimeoutError, ApiAuthError, ApiRateLimitError, ApiNetworkError } from '../services/AIService';
import { aiBridge } from '../services/AIBridge';
import { CostEstimatorService } from '../services/CostEstimatorService';
import { ExecutionPlanSchema, getZenModelsInfo } from '../services/ai';
import { secureStore } from '../secureStore';
import { dbService } from '../db';
import { EmbeddingService } from '../services/EmbeddingService';
import { LocalModelService } from '../services/LocalModelService';
import * as path from 'path';
import { checkArgs } from '../../src/helpers/invariant';
import * as fs from 'fs';
import { tool } from 'ai';
import { z } from 'zod';
import { executeReadFile, executeWriteFile, executeEditFile, getWorkspacePath, executeListFiles, executeGrep, SearchMatch } from '../services/tools';
import { PathGuard } from '../services/PathGuard';
import { diffLines } from 'diff';
import type { IpcHandlerContext } from './index';

type ToolPermission = 'allow' | 'deny' | 'ask';

interface ToolPermissions {
  read_file: ToolPermission;
  write_file: ToolPermission;
  edit_file: ToolPermission;
  list_files: ToolPermission;
  grep: ToolPermission;
}

const DEFAULT_TOOL_PERMISSIONS: ToolPermissions = {
  read_file: 'allow',
  write_file: 'ask',
  edit_file: 'ask',
  list_files: 'allow',
  grep: 'allow',
};

async function requestToolApproval(
  event: Electron.IpcMainInvokeEvent,
  toolName: string,
  args: Record<string, unknown>,
  description: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const requestId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    event.sender.send('tool:approval-request', {
      id: requestId,
      toolName,
      args,
      description,
    });
    const handleResponse = (_e: Electron.IpcMainEvent, response: { id: string; approved: boolean }) => {
      if (response.id === requestId) {
        ipcMain.removeListener('tool:approval-response', handleResponse);
        resolve(response.approved);
      }
    };
    ipcMain.on('tool:approval-response', handleResponse);
    setTimeout(() => {
      ipcMain.removeListener('tool:approval-response', handleResponse);
      resolve(false);
    }, 120000);
  });
}

function getToolPermissions(): ToolPermissions {
  try {
    const settings = secureStore.getToolPermissions?.();
    return settings ? { ...DEFAULT_TOOL_PERMISSIONS, ...settings } : DEFAULT_TOOL_PERMISSIONS;
  } catch {
    return DEFAULT_TOOL_PERMISSIONS;
  }
}

function createToolWithPermission<T extends Record<string, unknown>>(
  toolName: keyof ToolPermissions,
  description: string,
  schema: z.ZodObject<any>,
  executeFn: (args: T) => Promise<string>,
  event: Electron.IpcMainInvokeEvent
) {
  const permission = getToolPermissions()[toolName] || 'allow';
  if (permission === 'deny') {
    return undefined;
  }
  if (permission === 'ask') {
    return tool({
      description,
      inputSchema: schema,
      execute: async (args: T) => {
        const approved = await requestToolApproval(event, toolName, args as Record<string, unknown>, description);
        if (!approved) {
          return `Tool ${toolName} was denied by user`;
        }
        return executeFn(args);
      },
    });
  }
  return tool({
    description,
    inputSchema: schema,
    execute: executeFn,
  });
}

interface FileDiff {
  filePath: string;
  originalContent: string;
  proposedContent: string;
  addedLines: number;
  removedLines: number;
}

function computeLineStats(original: string, proposed: string): { addedLines: number; removedLines: number } {
  let added = 0;
  let removed = 0;
  for (const part of diffLines(original, proposed)) {
    if (part.added) added += part.count || 0;
    if (part.removed) removed += part.count || 0;
  }
  return { addedLines: added, removedLines: removed };
}

function parseCodeBlocks(text: string): { filePath: string; content: string }[] {
  const blocks: { filePath: string; content: string }[] = [];
  // Match ```lang:path or ```path followed by content then ```
  const regex = /```(\S*?)(?::(\S+))?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const lang = match[1] || '';
    const pathAfterColon = match[2];
    const content = match[3].trimEnd();
    let filePath = pathAfterColon || '';
    // If no path after colon, try the language itself if it looks like a file path
    if (!filePath && (lang.includes('/') || lang.includes('\\') || lang.endsWith('.ts') || lang.endsWith('.js') || lang.endsWith('.py') || lang.endsWith('.rs') || lang.endsWith('.json') || lang.endsWith('.md') || lang.endsWith('.css') || lang.endsWith('.html') || lang.endsWith('.tsx') || lang.endsWith('.jsx'))) {
      filePath = lang;
    }
    if (filePath && content) {
      blocks.push({ filePath, content });
    }
  }
  return blocks;
}

export function registerAIHandlers(ipcMain: Electron.IpcMain, context: IpcHandlerContext) {
    ipcMain.on('ai:chat-abort', () => {
        console.log('[IpcManager] Received ai:chat-abort signal, setting activeStreamAborted=true');
        context.activeStreamAborted = true;
        if (context.activeAbortController) {
            console.log('[IpcManager] Aborting active AI abort controller');
            context.activeAbortController.abort();
            context.activeAbortController = null;
        }
    });

    ipcMain.on('tool:approval-response', (_event, response: { id: string; approved: boolean }) => {
        console.log('[AI] Tool approval response received:', response);
    });

    ipcMain.on('ai:chat-start', async (event, { messages, providerId, model, effortLevel, thinking, rootPath }) => {
        checkArgs(Array.isArray(messages), 'messages must be a valid array');
        console.log('[ChatStream] ai:chat-start received, model:', model, 'provider:', providerId, 'thinking:', thinking);
        if (context.activeAbortController) {
            context.activeAbortController.abort();
        }
        context.activeAbortController = new AbortController();
        context.activeStreamAborted = false;
        const startTime = Date.now();
        try {
            const targetProvider = providerId || secureStore.getActiveProvider();
            const targetModel = model || secureStore.getSelectedModel();

            if (targetProvider === 'local') {
                const localService = LocalModelService.getInstance();
                if (!localService.isServerRunning() || localService.getRunningModel() !== targetModel) {
                    const modelPath = path.join(localService.getModelsDir(), targetModel);
                    if (fs.existsSync(modelPath)) {
                        console.log(`[ChatStream] Auto-starting local server for model: ${targetModel}`);
                        await localService.startServer(modelPath);
                        try {
                            dbService.addCustomModel('local', targetModel, 0);
                        } catch (dbErr) {
                            console.error('Failed to auto-register local model in database:', dbErr);
                        }
                    } else {
                        throw new Error(`Local GGUF model file not found at: ${modelPath}`);
                    }
                }
            }

            if (!aiService.isActive() || aiService.providerId !== targetProvider) {
                console.log(`[ChatStream] Dynamic initialization of AIService for provider: ${targetProvider}`);
                aiService.initializeFromStore(targetProvider);
            }

            const workspacePath = rootPath || getWorkspacePath();
            if (rootPath) {
                PathGuard.setWorkspacePath(rootPath);
            }
            const chatFileDiffs: FileDiff[] = [];

            const chatTools: Record<string, any> | undefined = workspacePath && fs.existsSync(workspacePath) ? {
                read_file: createToolWithPermission('read_file', 
                  'Read the contents of a file in the workspace to verify code structures or signatures (truncated to 8000 chars).',
                  z.object({ filePath: z.string() }),
                  async ({ filePath }: { filePath: string }) => executeReadFile(filePath, workspacePath),
                  event
                ),
                write_file: createToolWithPermission('write_file',
                  'Create or overwrite a workspace file. Creates parent directories if they do not exist. Use this to write new files or replace entire file contents.',
                  z.object({
                    filePath: z.string().describe('Relative path from workspace root'),
                    content: z.string().describe('Full file content to write'),
                  }),
                  async ({ filePath, content }: { filePath: string; content: string }) => {
                    const absPath = (() => {
                      const root = path.resolve(workspacePath);
                      const rp = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
                      const normRoot = root.toLowerCase();
                      const normResolved = rp.toLowerCase();
                      const rel = path.relative(normRoot, normResolved);
                      return (rel === '' || (rel && !rel.startsWith('..') && !path.isAbsolute(rel))) ? rp : null;
                    })();
                    const originalContent = absPath && fs.existsSync(absPath) ? fs.readFileSync(absPath, 'utf-8') : '';
                    const result = executeWriteFile(filePath, content, workspacePath);
                    if (result.startsWith('Successfully')) {
                      const proposedContent = content;
                      const { addedLines, removedLines } = computeLineStats(originalContent, proposedContent);
                      chatFileDiffs.push({ filePath, originalContent, proposedContent, addedLines, removedLines });
                    }
                    return result;
                  },
                  event
                ),
                edit_file: createToolWithPermission('edit_file',
                  'Find exact text in a file and replace it. Use for surgical edits without rewriting the whole file. Returns error if the file does not exist or the text is not found.',
                  z.object({
                    filePath: z.string().describe('Relative path from workspace root'),
                    find: z.string().describe('Exact text to find (case-sensitive)'),
                    replace: z.string().describe('Replacement text'),
                  }),
                  async ({ filePath, find, replace }: { filePath: string; find: string; replace: string }) => {
                    const absPath = (() => {
                      const root = path.resolve(workspacePath);
                      const rp = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
                      const normRoot = root.toLowerCase();
                      const normResolved = rp.toLowerCase();
                            const rel = path.relative(normRoot, normResolved);
                            return (rel === '' || (rel && !rel.startsWith('..') && !path.isAbsolute(rel))) ? rp : null;
                        })();
                        const originalContent = absPath && fs.existsSync(absPath) ? fs.readFileSync(absPath, 'utf-8') : '';
                        const result = executeEditFile(filePath, find, replace, workspacePath);
                        if (result.startsWith('Successfully')) {
                            const proposedContent = absPath && fs.existsSync(absPath) ? fs.readFileSync(absPath, 'utf-8') : '';
                            const { addedLines, removedLines } = computeLineStats(originalContent, proposedContent);
                            chatFileDiffs.push({ filePath, originalContent, proposedContent, addedLines, removedLines });
                        }
                        return result;
                    },
                    event
                ),
                list_files: createToolWithPermission('list_files',
                    'List files in the workspace matching a glob pattern (e.g., "**/*.ts", "src/**"). Returns relative paths.',
                    z.object({ pattern: z.string().default('**/*') }),
                    async ({ pattern }: { pattern: string }) => {
                        const files = await executeListFiles(workspacePath, pattern);
                        return files.join('\n');
                    },
                    event
                ),
                grep: createToolWithPermission('grep',
                    'Search file contents using regex across the workspace. Returns matches with file path, line number, and context.',
                    z.object({
                        pattern: z.string(),
                        include_extensions: z.array(z.string()).optional(),
                    }),
                    async ({ pattern, include_extensions }: { pattern: string; include_extensions?: string[] }) => {
                        const matches = await executeGrep(workspacePath, pattern, include_extensions);
                        if (matches.length === 0 || (matches.length === 1 && matches[0].filePath === '')) {
                            return matches[0]?.lineContent || 'No matches found';
                        }
                        return matches.map((m: SearchMatch) => `${m.filePath}:${m.lineNumber}:${m.column} - ${m.lineContent.trim()}`).join('\n');
                    }
                ),
            } : undefined;

            const chatMessages = chatTools
                ? [
                    { role: 'system', content: 'The workspace is open and you have `read_file`, `write_file`, `edit_file`, `list_files`, and `grep` tools available. You MUST use them for EVERY code change and file query — never output code blocks or guess file contents. If you output a code block instead of calling a tool, you have failed at your task.' },
                    ...messages,
                  ]
                : messages;

            const result = await aiService.chat(chatMessages, {
                stream: true,
                model: targetModel,
                temperature: 0.7,
                effortLevel: effortLevel as 'low' | 'medium' | 'high' | undefined,
                thinking: thinking as boolean | undefined,
                abortSignal: context.activeAbortController.signal,
                tools: chatTools,
            });
            console.log('[ChatStream] aiService.chat() returned, type:', typeof result, 'has text:', 'text' in result);

            if (context.activeStreamAborted) {
                console.log('[ChatStream] Stream request cancelled before start, sending ai:chat-end');
                event.sender.send('ai:chat-end');
                return;
            }

            let responseText = '';
            let actualInputTokens: number | undefined;
            let actualOutputTokens: number | undefined;
            let contextUsage: { estimatedInput?: number; contextLength?: number } = {};

            if (typeof result === 'string') {
                responseText = result;
                event.sender.send('ai:chat-chunk', result);
            } else if ('text' in result) {
                responseText = result.text;
                actualInputTokens = result.usage.inputTokens;
                actualOutputTokens = result.usage.outputTokens;
                contextUsage = { estimatedInput: (result as any).estimatedInput, contextLength: (result as any).contextLength };
                event.sender.send('ai:chat-chunk', result.text);
            } else if ('textStream' in result) {
                contextUsage = { estimatedInput: (result as any).estimatedInput, contextLength: (result as any).contextLength };
                console.log('[ChatStream] Starting for-await loop for text stream');
                let chunkCount = 0;
                for await (const chunk of result.textStream) {
                    if (context.activeStreamAborted) {
                        console.log('[ChatStream] Stream iteration aborted by user at chunk', chunkCount);
                        break;
                    }
                    chunkCount++;
                    responseText += chunk;
                    event.sender.send('ai:chat-chunk', chunk);
                }
                console.log('[ChatStream] for-await loop finished, total chunks:', chunkCount);

                if (chunkCount === 0 && chatTools && !context.activeStreamAborted) {
                    console.log('[ChatStream] Empty response with tools (model likely does not support tool calling), retrying with workspace context');
                    let fileListContext = '';
                    try {
                        const files = await executeListFiles(workspacePath, '**/*');
                        fileListContext = `Workspace files (${files.length} total):\n${files.slice(0, 300).join('\n')}\n${files.length > 300 ? `... (${files.length - 300} more)` : ''}`;
                    } catch (e) {
                        fileListContext = 'Could not load workspace file list.';
                    }
                    const fallbackMessages = [
                        { role: 'system', content: `You are a coding assistant with access to a workspace. Here is the current file structure:\n\n${fileListContext}\n\nAnswer questions about the workspace using this context. You cannot use tools in this mode.` },
                        ...messages,
                    ];
                    const fallbackResult = await aiService.chat(fallbackMessages, {
                        stream: true,
                        model: targetModel,
                        temperature: 0.7,
                        effortLevel: effortLevel as 'low' | 'medium' | 'high' | undefined,
                        thinking: thinking as boolean | undefined,
                        abortSignal: context.activeAbortController?.signal,
                    });
                    if ('textStream' in fallbackResult) {
                        for await (const chunk of fallbackResult.textStream) {
                            if (context.activeStreamAborted) break;
                            chunkCount++;
                            responseText += chunk;
                            event.sender.send('ai:chat-chunk', chunk);
                        }
                        try {
                            const fallbackUsage = context.activeStreamAborted ? undefined : await fallbackResult.usage;
                            if (fallbackUsage) {
                                actualInputTokens = fallbackUsage.inputTokens;
                                actualOutputTokens = fallbackUsage.outputTokens;
                            }
                        } catch (usageErr) {
                            console.warn('[ChatStream] Failed to get fallback stream usage:', usageErr);
                        }
                    }
                    console.log('[ChatStream] Fallback without tools completed, total chunks:', chunkCount);
                } else if (!context.activeStreamAborted) {
                    try {
                        const streamUsage = await result.usage;
                        if (streamUsage) {
                            actualInputTokens = streamUsage.inputTokens;
                            actualOutputTokens = streamUsage.outputTokens;
                        }
                    } catch (usageErr) {
                        console.warn('[ChatStream] Failed to get stream usage:', usageErr);
                    }
                }

                if (chunkCount === 0 && !context.activeStreamAborted) {
                    let errMsg = `⚠️ **${targetModel} returned an empty response.** `;
                    if (chatTools) {
                        errMsg += `This model may not support tool calling. Try a different model or disable file operations.`;
                    } else {
                        errMsg += `The prompt or request may exceed the model's capabilities. Try shortening the conversation or using a different model.`;
                    }
                    responseText = errMsg;
                    event.sender.send('ai:chat-chunk', errMsg);
                }
            }

            // Post-process: if no tool diffs captured but response has code blocks, extract and write them
            if (chatFileDiffs.length === 0 && chatTools) {
                const codeBlocks = parseCodeBlocks(responseText);
                for (const block of codeBlocks) {
                    const absPath = (() => {
                        const root = path.resolve(workspacePath || '');
                        const rp = path.isAbsolute(block.filePath) ? block.filePath : path.resolve(root, block.filePath);
                        const normRoot = root.toLowerCase();
                        const normResolved = rp.toLowerCase();
                        const rel = path.relative(normRoot, normResolved);
                        return (rel === '' || (rel && !rel.startsWith('..') && !path.isAbsolute(rel))) ? rp : null;
                    })();
                    if (!absPath) continue;
                    const originalContent = fs.existsSync(absPath) ? fs.readFileSync(absPath, 'utf-8') : '';
                    const dir = path.dirname(absPath);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(absPath, block.content, 'utf-8');
                    const { addedLines, removedLines } = computeLineStats(originalContent, block.content);
                    chatFileDiffs.push({ filePath: block.filePath, originalContent, proposedContent: block.content, addedLines, removedLines });
                    console.log(`[ChatStream] Applied code block to ${block.filePath} (+${addedLines}/-${removedLines})`);
                }
            }

            const latency = Date.now() - startTime;

            const outputTokens = actualOutputTokens || Math.max(1, Math.ceil(responseText.length / 4));
            const finalInputTokens = actualInputTokens || chatMessages.map((m: any) => m.content || '').join('\n').length / 4;
            const totalTokens = finalInputTokens + outputTokens;

            try {
                dbService.addModelPerformance(
                    targetModel,
                    targetProvider,
                    'chat',
                    1,
                    1,
                    totalTokens,
                    latency,
                    finalInputTokens,
                    outputTokens
                );
            } catch (dbErr) {
                console.error('Failed to save chat performance metrics to DB:', dbErr);
            }

            const chatCost = CostEstimatorService.estimateCost(targetModel, finalInputTokens, outputTokens, targetProvider);

            console.log('[ChatStream] Sending ai:chat-end, response length:', responseText.length, 'tokens:', { input: finalInputTokens, output: outputTokens, cost: chatCost, fileChanges: chatFileDiffs.length });
            event.sender.send('ai:chat-end', { inputTokens: finalInputTokens, output: outputTokens, outputTokens: outputTokens, cost: chatCost, ...contextUsage, fileDiffs: chatFileDiffs });

        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            // Don't report abort as a failure error to the user interface
            if (context.activeStreamAborted || (error instanceof Error && error.name === 'AbortError')) {
                console.log('[ChatStream] Request aborted cleanly');
                event.sender.send('ai:chat-end', { error: false, aborted: true });
                return;
            }
            console.error('[ChatStream] ERROR:', errMsg, 'model:', model, 'provider:', providerId);

            let errorType = 'UNKNOWN';
            if (error instanceof ApiTimeoutError) errorType = 'TIMEOUT';
            else if (error instanceof ApiAuthError) errorType = 'AUTH';
            else if (error instanceof ApiRateLimitError) errorType = 'RATE_LIMIT';
            else if (error instanceof ApiNetworkError) errorType = 'NETWORK';

            event.sender.send('ai:chat-chunk', `Error:${errorType}:${errMsg}`);
            console.log('[ChatStream] Sending ai:chat-end after error');
            event.sender.send('ai:chat-end', { error: true, errorType, errorMessage: errMsg });
        } finally {
            context.activeAbortController = null;
        }
    });

    ipcMain.on('ai:plan-start', async (event, { messages, providerId, model, effortLevel, thinking }) => {
        checkArgs(Array.isArray(messages), 'messages must be a valid array');
        console.log('[PlanStream] ai:plan-start received, model:', model, 'provider:', providerId, 'thinking:', thinking);
        if (context.activeAbortController) {
            context.activeAbortController.abort();
        }
        context.activeAbortController = new AbortController();
        context.activeStreamAborted = false;
        const startTime = Date.now();
        try {
            const targetProvider = providerId || secureStore.getActiveProvider();
            const targetModel = model || secureStore.getSelectedModel();

            if (targetProvider === 'local') {
                const localService = LocalModelService.getInstance();
                if (!localService.isServerRunning() || localService.getRunningModel() !== targetModel) {
                    const modelPath = path.join(localService.getModelsDir(), targetModel);
                    if (fs.existsSync(modelPath)) {
                        console.log(`[PlanStream] Auto-starting local server for model: ${targetModel}`);
                        await localService.startServer(modelPath);
                        try {
                            dbService.addCustomModel('local', targetModel, 0);
                        } catch (dbErr) {
                            console.error('Failed to auto-register local model in database:', dbErr);
                        }
                    } else {
                        throw new Error(`Local GGUF model file not found at: ${modelPath}`);
                    }
                }
            }

            if (!aiService.isActive() || aiService.providerId !== targetProvider) {
                console.log(`[PlanStream] Dynamic initialization of AIService for provider: ${targetProvider}`);
                aiService.initializeFromStore(targetProvider);
            }

            const partialStream = await aiService.streamObject(
                ExecutionPlanSchema,
                messages,
                { model: targetModel, temperature: 0.1, effortLevel, thinking, abortSignal: context.activeAbortController.signal }
            );
            console.log('[PlanStream] streamObject returned, type:', typeof partialStream);

            if (context.activeStreamAborted) {
                console.log('[PlanStream] Plan stream request cancelled before start, sending ai:plan-end');
                event.sender.send('ai:plan-end');
                return;
            }

            let chunkCount = 0;
            let finalPlan: any = null;
            console.log('[PlanStream] Starting for-await loop for plan stream');
            for await (const partial of partialStream.partialOutputStream) {
                chunkCount++;
                if (context.activeStreamAborted) {
                    console.log('[PlanStream] Plan stream iteration aborted by user at chunk', chunkCount);
                    break;
                }
                finalPlan = partial;
                const chunkJson = JSON.stringify(partial);
                console.log('[PlanStream] Chunk', chunkCount, 'received, length:', chunkJson?.length, 'preview:', chunkJson?.substring(0, 150));
                event.sender.send('ai:plan-chunk', chunkJson);
            }
            console.log('[PlanStream] for-await loop finished, total chunks:', chunkCount, 'finalPlan exists:', !!finalPlan);

            const latency = Date.now() - startTime;

            let actualInputTokens = messages.map((m: any) => m.content || '').join('\n').length / 4;
            let actualOutputTokens = 0;
            if (!context.activeStreamAborted) {
                try {
                    const streamUsage = await partialStream.usage;
                    if (streamUsage) {
                        actualInputTokens = streamUsage.inputTokens || actualInputTokens;
                        actualOutputTokens = streamUsage.outputTokens || actualOutputTokens;
                    }
                } catch (usageErr) {
                    console.warn('[PlanStream] Failed to get stream usage:', usageErr);
                }
            }
            if (actualOutputTokens === 0) {
                actualOutputTokens = Math.max(1, Math.ceil(JSON.stringify(finalPlan || {}).length / 4));
            }
            const totalTokens = actualInputTokens + actualOutputTokens;

            try {
                dbService.addModelPerformance(
                    targetModel,
                    targetProvider,
                    'plan',
                    1,
                    1,
                    totalTokens,
                    latency,
                    actualInputTokens,
                    actualOutputTokens
                );
            } catch (dbErr) {
                console.error('Failed to save plan performance metrics to DB:', dbErr);
            }

            const planCost = CostEstimatorService.estimateCost(targetModel, actualInputTokens, actualOutputTokens, targetProvider);
            console.log('[PlanStream] Sending ai:plan-end, final plan exists:', !!finalPlan, 'tokens:', { input: actualInputTokens, output: actualOutputTokens, cost: planCost });
            event.sender.send('ai:plan-end', finalPlan, { inputTokens: actualInputTokens, outputTokens: actualOutputTokens, cost: planCost });

        } catch (error: unknown) {
            if (context.activeStreamAborted || (error instanceof Error && error.name === 'AbortError')) {
                console.log('[PlanStream] Request aborted cleanly');
                event.sender.send('ai:plan-end', null, { aborted: true });
                return;
            }
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error('[PlanStream] ERROR:', errMsg, 'model:', model, 'provider:', providerId);
            let errorType = 'UNKNOWN';
            if (error instanceof ApiTimeoutError) errorType = 'TIMEOUT';
            else if (error instanceof ApiAuthError) errorType = 'AUTH';
            else if (error instanceof ApiRateLimitError) errorType = 'RATE_LIMIT';
            else if (error instanceof ApiNetworkError) errorType = 'NETWORK';
            event.sender.send('ai:plan-chunk', { error: errMsg, errorType });
            console.log('[PlanStream] Sending ai:plan-end after error');
            event.sender.send('ai:plan-end');
        } finally {
            context.activeAbortController = null;
        }
    });

    ipcMain.handle('ai:test-connection', async (_event, baseUrl: string) => {
        checkArgs(typeof baseUrl === 'string' && baseUrl.trim().length > 0, 'baseUrl must be a non-empty string');
        const trimmedUrl = baseUrl.replace(/\\+$/, '');
        try {
            const res = await fetch(`${trimmedUrl}/api/tags`);
            if (res.ok) return true;
        } catch (e) {
        }
        try {
            const head = await fetch(trimmedUrl, { method: 'HEAD' });
            return head.ok;
        } catch (e) {
            return false;
        }
    });

    ipcMain.handle('ai:save-config', async (_, config) => {
        checkArgs(config && typeof config.providerId === 'string', 'config.providerId must be a valid string');
        if (config.apiKey !== undefined) {
            const customProviders = dbService.getCustomProviders();
            const isCustom = customProviders.some((p: any) => p.id === config.providerId);
            if (config.apiKey === '') {
                if (isCustom) {
                    secureStore.deleteCustomProviderKey(config.providerId);
                } else {
                    secureStore.deleteApiKey(config.providerId);
                }
            } else {
                if (isCustom) {
                    secureStore.setCustomProviderKey(config.providerId, config.apiKey);
                } else {
                    secureStore.setApiKey(config.providerId, config.apiKey);
                }
            }
        }
        secureStore.setActiveProvider(config.providerId);
        aiService.initializeFromStore(config.providerId);
        return true;
    });

    ipcMain.handle('ai:save-provider-key', async (_, { providerId, apiKey }) => {
        checkArgs(typeof providerId === 'string', 'providerId must be a valid string');
        checkArgs(typeof apiKey === 'string', 'apiKey must be a string');
        if (providerId === 'openrouter' && apiKey !== '' && !apiKey.startsWith('sk-or-v1-')) {
            return { success: false, error: 'OpenRouter API key must start with "sk-or-v1-"' };
        }
        const customProviders = dbService.getCustomProviders();
        const isCustom = customProviders.some((p: any) => p.id === providerId);
        if (apiKey === '') {
            if (isCustom) {
                secureStore.deleteCustomProviderKey(providerId);
            } else {
                secureStore.deleteApiKey(providerId);
            }
        } else {
            if (isCustom) {
                secureStore.setCustomProviderKey(providerId, apiKey);
            } else {
                secureStore.setApiKey(providerId, apiKey);
            }
        }
        return { success: true };
    });

    ipcMain.handle('ai:get-config', async (_, providerId) => {
        checkArgs(typeof providerId === 'string', 'providerId must be a string');
        const key = secureStore.getApiKey(providerId);
        return {
            providerId,
            hasKey: !!key
        };
    });

    ipcMain.handle('ai:get-models', async (_, providerId) => {
        checkArgs(typeof providerId === 'string', 'providerId must be a string');
        const customModels = dbService.getCustomModels(providerId).map((m: any) => m.model_name);
        try {
            const fetchedModels = await aiBridge.getAvailableModels(providerId);
            const combined = Array.from(new Set([...customModels, ...fetchedModels]));
            return combined.length > 0 ? combined : customModels;
        } catch (e) {
            console.error(`Failed to list models for provider ${providerId}`, e);
            // Fallback logic...
        }
    });

    ipcMain.handle('ai:get-zen-models-info', async () => {
        try {
            return await getZenModelsInfo();
        } catch (e) {
            console.error('Failed to fetch Zen model info', e);
            return [];
        }
    });

    ipcMain.handle('ai:get-model-context-length', async (_event, { providerId, modelId }) => {
        checkArgs(typeof providerId === 'string', 'providerId must be a string');
        checkArgs(typeof modelId === 'string', 'modelId must be a string');

        const modelKey = `${providerId}:${modelId}`;
        const cached = dbService.getCachedContext(modelKey);
        if (cached !== null) return cached;

        let contextLength = 128000;

        switch (providerId) {
            case 'openai': {
                const id = modelId.toLowerCase();
                if (id.includes('gpt-4o-mini')) contextLength = 128000;
                else if (id.includes('gpt-4o')) contextLength = 128000;
                else if (id.includes('gpt-4-turbo')) contextLength = 128000;
                else if (id.includes('o1-mini')) contextLength = 128000;
                else if (id.includes('o1')) contextLength = 200000;
                else if (id.includes('gpt-4')) contextLength = 8192;
                else if (id.includes('gpt-3.5-turbo')) contextLength = 16385;
                else contextLength = 128000;
                break;
            }
            case 'anthropic': {
                contextLength = 200000;
                break;
            }
            case 'gemini': {
                const id = modelId.toLowerCase();
                contextLength = id.includes('pro') ? 2000000 : 1000000;
                break;
            }
            case 'zen': {
                contextLength = 128000;
                break;
            }
            case 'openrouter': {
                const cached = aiBridge.getOpenRouterContextLength(modelId);
                contextLength = cached || 128000;
                break;
            }
            case 'local': {
                contextLength = LocalModelService.getInstance().getContextSize();
                break;
            }
            case 'finetuned': {
                try {
                    const ftModel = dbService.getFineTunedModel(modelId);
                    if (ftModel && ftModel.base_model_id) {
                        const { TOP_CODING_MODELS } = require('../constants/models');
                        const match = TOP_CODING_MODELS.find((m: any) => m.id === ftModel.base_model_id);
                        if (match && match.contextWindow) {
                            contextLength = match.contextWindow;
                        }
                    }
                } catch {
                    contextLength = 4096;
                }
                break;
            }
            case 'ollama': {
                try {
                    const res = await fetch(`http://localhost:11434/api/show`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: modelId }),
                    });
                    if (res.ok) {
                        const data = await res.json() as any;
                        contextLength = data?.model_info?.llama?.context_length
                            || data?.model_info?.general?.context_length
                            || 4096;
                    }
                } catch {
                    contextLength = 4096;
                }
                break;
            }
            default: {
                contextLength = 128000;
                break;
            }
        }

        dbService.setCachedContext(modelKey, contextLength);
        return contextLength;
    });

    ipcMain.handle('rag:search', async (_event, query: string, limit?: number) => {
        checkArgs(typeof query === 'string' && query.trim().length > 0, 'Query must be a non-empty string');
        return EmbeddingService.searchSimilarity(query, limit || 5);
    });

    ipcMain.handle('rag:index-content', async (_event, sourceType: string, sourceId: string | null, content: string, metadata: object) => {
        checkArgs(typeof sourceType === 'string', 'sourceType must be a string');
        checkArgs(typeof content === 'string', 'content must be a string');
        await EmbeddingService.indexKnowledge(sourceType, sourceId, content, metadata);
        return true;
    });

    ipcMain.handle('local:list', async () => {
        return LocalModelService.getInstance().listModels();
    });

    ipcMain.handle('local:search-hf', async (_event, query: string) => {
        checkArgs(typeof query === 'string' && query.trim().length > 0, 'Query must be a non-empty string');
        return LocalModelService.getInstance().searchHuggingFace(query);
    });

    ipcMain.handle('local:hf-files', async (_event, repo: string) => {
        checkArgs(typeof repo === 'string', 'repo must be a string');
        return LocalModelService.getInstance().getModelFiles(repo);
    });

    ipcMain.handle('local:download', async (event, repo: string, filename: string) => {
        checkArgs(typeof repo === 'string', 'repo must be a string');
        checkArgs(typeof filename === 'string', 'filename must be a string');
        const service = LocalModelService.getInstance();
        const token = secureStore.getHuggingFaceToken();
        const result = await service.downloadModel(repo, filename, (progress) => {
            event.sender.send('local:download-progress', progress);
        }, token);
        return result;
    });

    ipcMain.handle('local:delete', async (_event, name: string) => {
        checkArgs(typeof name === 'string', 'name must be a string');
        return LocalModelService.getInstance().deleteModel(name);
    });

    ipcMain.handle('local:start-server', async (_event, modelPath: string, contextSize?: number) => {
        checkArgs(typeof modelPath === 'string', 'modelPath must be a string');
        const port = await LocalModelService.getInstance().startServer(modelPath, contextSize);
        const modelName = path.basename(modelPath);
        const actualCtx = LocalModelService.getInstance().getContextSize();
        dbService.setCachedContext('local:' + modelName, actualCtx);
        try {
            dbService.addCustomModel('local', modelName, 0);
        } catch (dbErr) {
            console.error('Failed to auto-register local model in database:', dbErr);
        }
        return port;
    });

    ipcMain.handle('local:stop-server', async () => {
        LocalModelService.getInstance().stopServer();
        return true;
    });

    ipcMain.handle('local:server-status', async () => {
        const instance = LocalModelService.getInstance();
        return {
            running: instance.isServerRunning(),
            model: instance.getRunningModel()
        };
    });

    ipcMain.handle('local:redownload-llama', async () => {
        const { spawn } = await import('child_process');
        const scriptPath = path.join(__dirname, '..', 'scripts', 'download-llama-server.ps1');
        if (!fs.existsSync(scriptPath)) {
            throw new Error(`Re-download script not found at "${scriptPath}". Run "npm run fetch:llama" from the project directory.`);
        }
        await new Promise<void>((resolve, reject) => {
            const proc = spawn('powershell', ['-File', scriptPath, '-Force'], {
                timeout: 120000,
                stdio: 'pipe',
            });
            let stderr = '';
            proc.stderr?.on('data', (chunk) => {
                stderr += chunk.toString();
            });
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(stderr.trim() || `Re-download failed with exit code ${code}`));
            });
            proc.on('error', reject);
        });
        return true;
    });

    ipcMain.handle('local:get-model-settings', async (_event, providerId: string, modelName: string) => {
        checkArgs(typeof providerId === 'string', 'providerId must be a string');
        checkArgs(typeof modelName === 'string', 'modelName must be a string');
        const models = dbService.getCustomModels(providerId);
        const match = models.find((m: any) => m.model_name === modelName);
        return match ? { context_size: match.context_size ?? null } : null;
    });

    ipcMain.handle('local:set-context-size', async (_event, modelName: string, contextSize: number) => {
        checkArgs(typeof modelName === 'string', 'modelName must be a string');
        checkArgs(typeof contextSize === 'number' && contextSize >= 512, 'contextSize must be >= 512');
        dbService.updateCustomModelContextSize('local', modelName, contextSize);
        dbService.setCachedContext('local:' + modelName, contextSize);
        const instance = LocalModelService.getInstance();
        if (instance.isServerRunning() && instance.getRunningModel() === modelName) {
            await instance.restartServer(contextSize);
        }
        return true;
    });
}
