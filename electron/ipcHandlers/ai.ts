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
import type { IpcHandlerContext } from './index';

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

    ipcMain.on('ai:chat-start', async (event, { messages, providerId, model, effortLevel, thinking }) => {
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

            const result = await aiService.chat(messages, {
                stream: true,
                model: targetModel,
                temperature: 0.7,
                effortLevel: effortLevel as 'low' | 'medium' | 'high' | undefined,
                thinking: thinking as boolean | undefined,
                abortSignal: context.activeAbortController.signal
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

            if (typeof result === 'string') {
                responseText = result;
                event.sender.send('ai:chat-chunk', result);
            } else if ('text' in result) {
                responseText = result.text;
                actualInputTokens = result.usage.inputTokens;
                actualOutputTokens = result.usage.outputTokens;
                event.sender.send('ai:chat-chunk', result.text);
            } else if ('textStream' in result) {
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
                const streamUsage = context.activeStreamAborted ? undefined : await result.usage;
                if (streamUsage) {
                    actualInputTokens = streamUsage.inputTokens;
                    actualOutputTokens = streamUsage.outputTokens;
                }
            }

            const latency = Date.now() - startTime;

            const outputTokens = actualOutputTokens || Math.max(1, Math.ceil(responseText.length / 4));
            const finalInputTokens = actualInputTokens || messages.map((m: any) => m.content || '').join('\n').length / 4;
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

            console.log('[ChatStream] Sending ai:chat-end, response length:', responseText.length, 'tokens:', { input: finalInputTokens, output: outputTokens, cost: chatCost });
            event.sender.send('ai:chat-end', { inputTokens: finalInputTokens, output: outputTokens, outputTokens: outputTokens, cost: chatCost });

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

        switch (providerId) {
            case 'openai': {
                const id = modelId.toLowerCase();
                if (id.includes('gpt-4o-mini')) return 128000;
                if (id.includes('gpt-4o')) return 128000;
                if (id.includes('gpt-4-turbo')) return 128000;
                if (id.includes('o1-mini')) return 128000;
                if (id.includes('o1')) return 200000;
                if (id.includes('gpt-4')) return 8192;
                if (id.includes('gpt-3.5-turbo')) return 16385;
                return 128000;
            }
            case 'anthropic': {
                return 200000;
            }
            case 'gemini': {
                const id = modelId.toLowerCase();
                if (id.includes('pro')) return 2000000;
                return 1000000;
            }
            case 'zen': {
                return 128000;
            }
            case 'openrouter': {
                const cached = aiBridge.getOpenRouterContextLength(modelId);
                return cached || 128000;
            }
            default: {
                return 128000;
            }
        }
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

    ipcMain.handle('local:start-server', async (_event, modelPath: string) => {
        checkArgs(typeof modelPath === 'string', 'modelPath must be a string');
        const port = await LocalModelService.getInstance().startServer(modelPath);
        const modelName = path.basename(modelPath);
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
}
