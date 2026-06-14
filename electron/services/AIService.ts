import { generateText, streamText, Output, wrapLanguageModel, type AsyncIterableStream } from 'ai';
import type { LanguageModelV3 } from '@ai-sdk/provider';
import { createLanguageModel, resolveZenModel } from './ai/provider';
import type { ProviderConfig } from './ai/provider';
import { getProviderPrompt, composeSystemPrompt, extractSystemMessages } from './ai/prompts';
import { createTransformMiddleware } from './ai/transform';
import console from 'console';
import { aiBridge } from './AIBridge';
import { secureStore } from '../secureStore';
import { dbService } from '../db';

export const API_TIMEOUT = 120_000;

export class ApiTimeoutError extends Error {
  constructor(public providerId: string, public modelId: string, timeoutMs: number) {
    super(`API request to ${providerId}/${modelId} timed out after ${timeoutMs}ms`);
    this.name = 'ApiTimeoutError';
  }
}

export class ApiAuthError extends Error {
  constructor(public providerId: string, message: string) {
    super(`Authentication failed for ${providerId}: ${message}`);
    this.name = 'ApiAuthError';
  }
}

export class ApiNetworkError extends Error {
  constructor(public providerId: string, message: string) {
    super(`Network error for ${providerId}: ${message}`);
    this.name = 'ApiNetworkError';
  }
}

export class ApiRateLimitError extends Error {
  constructor(public providerId: string, public retryAfterMs?: number) {
    super(`Rate limited by ${providerId}${retryAfterMs ? ` (retry after ${retryAfterMs}ms)` : ''}`);
    this.name = 'ApiRateLimitError';
  }
}

export type ApiError = ApiTimeoutError | ApiAuthError | ApiNetworkError | ApiRateLimitError;

export function classifyApiError(error: unknown, providerId: string, modelId?: string): ApiError {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();

  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('abort') || msg.includes('aborted')) {
    return new ApiTimeoutError(providerId, modelId || 'unknown', API_TIMEOUT);
  }

  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('auth') || msg.includes('api key') || msg.includes('forbidden') || msg.includes('403')) {
    return new ApiAuthError(providerId, error instanceof Error ? error.message : String(error));
  }

  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
    const retryAfter = error instanceof Error && error.message ? parseInt(error.message.match(/retry after\s*(\d+)/i)?.[1] || '', 10) : undefined;
    return new ApiRateLimitError(providerId, retryAfter || undefined);
  }

  if (msg.includes('econnrefused') || msg.includes('econnreset') || msg.includes('enotfound') || msg.includes('enetunreach') || msg.includes('fetch failed') || msg.includes('network') || msg.includes('dns') || msg.includes('socket')) {
    return new ApiNetworkError(providerId, error instanceof Error ? error.message : String(error));
  }

  return new ApiNetworkError(providerId, error instanceof Error ? error.message : String(error));
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ChatResponse {
  text: string;
  usage: ChatUsage;
}

export interface ChatStreamResult {
  textStream: AsyncIterable<string>;
  usage: Promise<ChatUsage>;
}

export interface ObjectStreamResult {
  partialOutputStream: AsyncIterableStream<any>;
  usage: Promise<ChatUsage>;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  effortLevel?: 'low' | 'medium' | 'high';
  thinking?: boolean;
  abortSignal?: AbortSignal;
  /** Legacy JSON Schema for structured output (backward compat).
   *  Prefer using the typed generateObject/streamObject methods instead. */
  responseSchema?: Record<string, unknown>;
}

export class AIService {
  private static instance: AIService;
  private config: ProviderConfig | null = null;

  private constructor() {}

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  initialize(config: ProviderConfig) {
    this.config = { ...config };
  }

  initializeFromStore(providerId?: string) {
    const targetProvider = providerId || secureStore.getActiveProvider();
    const customProviders = dbService.getCustomProviders();
    const isCustom = customProviders.some((p: any) => p.id === targetProvider);
    let apiKey = '';
    let baseUrl: string | undefined;
    let isLocal = false;

    if (isCustom) {
      const prov = customProviders.find((p: any) => p.id === targetProvider);
      apiKey = secureStore.getCustomProviderKey(targetProvider) || '';
      baseUrl = prov?.base_url;
      isLocal = !!prov?.is_local;
    } else {
      apiKey = secureStore.getApiKey(targetProvider) || AIService.getEnvKey(targetProvider) || '';
    }

    console.log(`[AIService:initializeFromStore] Initialized for provider: ${targetProvider}, apiKey length: ${apiKey ? apiKey.length : 0}, baseUrl: ${baseUrl || 'default'}`);

    this.initialize({
      providerId: targetProvider,
      apiKey,
      baseUrl,
      isLocal,
    });
  }

  get providerId(): string {
    return this.config?.providerId ?? 'fallback';
  }

  isActive(): boolean {
    return this.config !== null;
  }

  private getModel(modelId?: string) {
    if (!this.config) throw new Error('AI Service not initialized');
    const requiresApiKey = this.config.providerId !== 'ollama' && this.config.providerId !== 'zen';
    if (requiresApiKey && !this.config.apiKey) {
      throw new Error(`API Key for provider "${this.config.providerId}" is not configured. Please set it in Settings > Models.`);
    }
    const model = createLanguageModel(this.config, modelId || 'gpt-4o') as unknown as LanguageModelV3;
    return wrapLanguageModel({
      model,
      middleware: [createTransformMiddleware(modelId || 'gpt-4o')],
    });
  }

  private composeMessages(messages: LLMMessage[], modelId?: string): LLMMessage[] {
    const systemMessages = extractSystemMessages(messages);
    const providerPrompt = getProviderPrompt(modelId || 'default');
    const composedSystem = composeSystemPrompt(providerPrompt, systemMessages);
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');
    return [{ role: 'system', content: composedSystem }, ...nonSystemMessages];
  }

  private getProviderOptions(modelId?: string, effortLevel?: string, thinking?: boolean): Record<string, any> {
    if (!modelId || !this.config) return {};

    const effort = effortLevel || 'low';

    if (this.config.providerId === 'zen') {
      const resolved = resolveZenModel(modelId);
      if (resolved.effort) {
        return { zen: { effort: resolved.effort } };
      }
      return { zen: { effort } };
    }

    if (thinking && this.config.providerId === 'anthropic') {
      return { anthropic: { thinking: { type: 'adaptive', effort } } };
    }

    if (thinking && this.config.providerId === 'openai' && (modelId.startsWith('o1') || modelId.startsWith('o3'))) {
      return { openai: { reasoning_effort: effort } };
    }

    if (modelId.includes('gemini')) {
      const budgetMap: Record<string, number> = { low: 1024, medium: 8192, high: 32768 };
      const budget = budgetMap[effort] || 8192;
      return { google: { thinkingConfig: { thinkingBudget: budget } } };
    }

    return {};
  }

  private getTemperature(_modelId?: string, requestedTemp?: number): number | undefined {
    return requestedTemp ?? 0.0;
  }

  async chat(
    messages: LLMMessage[],
    options?: CompletionOptions
  ): Promise<ChatResponse | ChatStreamResult> {
    const modelId = options?.model || 'unknown';
    const providerId = this.config?.providerId || 'unknown';
    const model = this.getModel(modelId);
    const temperature = this.getTemperature(modelId, options?.temperature);
    const providerOptions = this.getProviderOptions(modelId, options?.effortLevel, options?.thinking);
    const composedMessages = this.composeMessages(messages, modelId);

    try {
      if (options?.stream) {
        let resolveUsage!: (usage: ChatUsage) => void;
        const usagePromise = new Promise<ChatUsage>((resolve) => { resolveUsage = resolve; });

        console.log('[AIService:chat] Calling streamText for model:', modelId, 'provider:', providerId);
        const result = await streamText({
          model,
          messages: composedMessages as any,
          temperature,
          providerOptions,
          abortSignal: options?.abortSignal,
          timeout: API_TIMEOUT,
          onFinish: (event) => {
            resolveUsage({
              inputTokens: event.totalUsage.inputTokens ?? 0,
              outputTokens: event.totalUsage.outputTokens ?? 0,
            });
          },
        });
        console.log('[AIService:chat] streamText returned, textStream type:', typeof result.textStream);
        return { textStream: result.textStream, usage: usagePromise };
      }

      if (options?.responseSchema) {
        const result = await generateText({
          model,
          messages: composedMessages as any,
          temperature,
          providerOptions,
          abortSignal: options?.abortSignal,
          timeout: API_TIMEOUT,
          output: Output.json(),
        });
        return {
          text: result.text,
          usage: {
            inputTokens: result.usage?.inputTokens ?? 0,
            outputTokens: result.usage?.outputTokens ?? 0,
          },
        };
      }

      const result = await generateText({
        model,
        messages: composedMessages as any,
        temperature,
        providerOptions,
        abortSignal: options?.abortSignal,
        timeout: API_TIMEOUT,
      });

      return {
        text: result.text,
        usage: {
          inputTokens: result.usage?.inputTokens ?? 0,
          outputTokens: result.usage?.outputTokens ?? 0,
        },
      };
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
        throw new ApiTimeoutError(providerId, modelId, API_TIMEOUT);
      }
      throw classifyApiError(err, providerId, modelId);
    }
  }

  async generateObject<T>(
    schema: import('zod').ZodSchema<T>,
    messages: LLMMessage[],
    options?: { model?: string; temperature?: number; effortLevel?: string; thinking?: boolean }
  ): Promise<T> {
    const model = this.getModel(options?.model);
    const providerOptions = this.getProviderOptions(options?.model, options?.effortLevel, options?.thinking);
    const composedMessages = this.composeMessages(messages, options?.model);

    const result = await generateText({
      model,
      messages: composedMessages as any,
      temperature: options?.temperature ?? 0.0,
      providerOptions,
      output: Output.object({ schema }),
    });

    return result.output;
  }

  async streamObject<T>(
    schema: import('zod').ZodSchema<T>,
    messages: LLMMessage[],
    options?: { model?: string; temperature?: number; effortLevel?: string; thinking?: boolean; abortSignal?: AbortSignal }
  ): Promise<ObjectStreamResult> {
    const modelId = options?.model || 'default';
    const providerId = this.config?.providerId || 'unknown';
    const model = this.getModel(modelId);
    const temperature = this.getTemperature(options?.model, options?.temperature);
    const providerOptions = this.getProviderOptions(options?.model, options?.effortLevel, options?.thinking);
    const composedMessages = this.composeMessages(messages, options?.model);

    console.log('[AIService:streamObject] modelId:', modelId, 'providerId:', providerId, 'temperature:', temperature, 'thinking:', options?.thinking, 'effortLevel:', options?.effortLevel, 'providerOptions:', JSON.stringify(providerOptions));

    let resolveUsage!: (usage: ChatUsage) => void;
    const usagePromise = new Promise<ChatUsage>((resolve) => { resolveUsage = resolve; });

    let result;
    try {
      result = await streamText({
        model,
        messages: composedMessages as any,
        temperature,
        providerOptions,
        abortSignal: options?.abortSignal,
        timeout: API_TIMEOUT,
        output: Output.object({ schema }),
        onFinish: (event) => {
          resolveUsage({
            inputTokens: event.totalUsage.inputTokens ?? 0,
            outputTokens: event.totalUsage.outputTokens ?? 0,
          });
        },
      });
      console.log('[AIService:streamObject] streamText returned successfully, partialOutputStream type:', typeof result.partialOutputStream);
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
        throw new ApiTimeoutError(providerId, modelId, API_TIMEOUT);
      }
      throw classifyApiError(err, providerId, modelId);
    }

    return { partialOutputStream: result.partialOutputStream, usage: usagePromise };
  }

  async getModels(): Promise<string[]> {
    if (!this.config) return ['gpt-4o'];
    return aiBridge.getAvailableModels(this.config.providerId);
  }

  static getEnvKey(providerId: string): string | undefined {
    if (providerId === 'openai') return process.env.OPENAI_API_KEY;
    if (providerId === 'anthropic') return process.env.ANTHROPIC_API_KEY;
    if (providerId === 'gemini') return process.env.GEMINI_API_KEY;
    return undefined;
  }
}

export const aiService = AIService.getInstance();