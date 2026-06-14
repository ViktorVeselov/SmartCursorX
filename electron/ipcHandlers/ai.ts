import { aiService, ApiTimeoutError, ApiAuthError, ApiRateLimitError, ApiNetworkError } from '../services/AIService';
import { aiBridge } from '../services/AIBridge';
import { CostEstimatorService } from '../services/CostEstimatorService';
import { ExecutionPlanSchema, getZenModelsInfo } from '../services/ai';
import { secureStore } from '../secureStore';
import { dbService } from '../db';
import { EmbeddingService } from '../services/EmbeddingService';
import { checkArgs } from '../../src/helpers/invariant';
import type { IpcHandlerContext } from './index';

export function registerAIHandlers(ipcMain: Electron.IpcMain, context: IpcHandlerContext) {
    ipcMain.on('ai:chat-abort', () => {
        console.log('[IpcManager] Received ai:chat-abort signal, setting activeStreamAborted=true');
        context.activeStreamAborted = true;
    });

    ipcMain.on('ai:chat-start', async (event, { messages, providerId, model, effortLevel, thinking }) => {
        checkArgs(Array.isArray(messages), 'messages must be a valid array');
        console.log('[ChatStream] ai:chat-start received, model:', model, 'provider:', providerId, 'thinking:', thinking);
        context.activeStreamAborted = false;
        const startTime = Date.now();
        try {
            const targetProvider = providerId || secureStore.getActiveProvider();
            const targetModel = model || secureStore.getSelectedModel();

            if (!aiService.isActive() || aiService.providerId !== targetProvider) {
                console.log(`[ChatStream] Dynamic initialization of AIService for provider: ${targetProvider}`);
                aiService.initializeFromStore(targetProvider);
            }

            const result = await aiService.chat(messages, {
                stream: true,
                model: targetModel,
                temperature: 0.7,
                effortLevel: effortLevel as 'low' | 'medium' | 'high' | undefined,
                thinking: thinking as boolean | undefined
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

            const outputTokens = actualOutputTokens ?? Math.max(1, Math.ceil(responseText.length / 4));
            const finalInputTokens = actualInputTokens ?? messages.map((m: any) => m.content || '').join('\n').length / 4;
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
            event.sender.send('ai:chat-end', { inputTokens: finalInputTokens, output: outputTokens, cost: chatCost });

        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error('[ChatStream] ERROR:', errMsg, 'model:', model, 'provider:', providerId);

            let errorType = 'UNKNOWN';
            if (error instanceof ApiTimeoutError) errorType = 'TIMEOUT';
            else if (error instanceof ApiAuthError) errorType = 'AUTH';
            else if (error instanceof ApiRateLimitError) errorType = 'RATE_LIMIT';
            else if (error instanceof ApiNetworkError) errorType = 'NETWORK';

            event.sender.send('ai:chat-chunk', `Error:${errorType}:${errMsg}`);
            console.log('[ChatStream] Sending ai:chat-end after error');
            event.sender.send('ai:chat-end', { error: true, errorType, errorMessage: errMsg });
        }
    });

    ipcMain.on('ai:plan-start', async (event, { messages, providerId, model, effortLevel, thinking }) => {
        checkArgs(Array.isArray(messages), 'messages must be a valid array');
        console.log('[PlanStream] ai:plan-start received, model:', model, 'provider:', providerId, 'thinking:', thinking);
        context.activeStreamAborted = false;
        const startTime = Date.now();
        try {
            const targetProvider = providerId || secureStore.getActiveProvider();
            const targetModel = model || secureStore.getSelectedModel();

            if (!aiService.isActive() || aiService.providerId !== targetProvider) {
                console.log(`[PlanStream] Dynamic initialization of AIService for provider: ${targetProvider}`);
                aiService.initializeFromStore(targetProvider);
            }

            const partialStream = await aiService.streamObject(
                ExecutionPlanSchema,
                messages,
                { model: targetModel, temperature: 0.1, effortLevel, thinking }
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
                        actualInputTokens = streamUsage.inputTokens;
                        actualOutputTokens = streamUsage.outputTokens;
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

            console.log('[PlanStream] Sending ai:plan-end, final plan exists:', !!finalPlan);
            event.sender.send('ai:plan-end', finalPlan);

        } catch (error: unknown) {
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
        if (config.apiKey) {
            const customProviders = dbService.getCustomProviders();
            const isCustom = customProviders.some((p: any) => p.id === config.providerId);
            if (isCustom) {
                secureStore.setCustomProviderKey(config.providerId, config.apiKey);
            } else {
                secureStore.setApiKey(config.providerId, config.apiKey);
            }
        }
        secureStore.setActiveProvider(config.providerId);
        aiService.initializeFromStore(config.providerId);
        return true;
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
}
