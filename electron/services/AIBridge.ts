import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { LanguageModel, EmbeddingModel, embed } from 'ai';
import { secureStore } from '../secureStore';
import { dbService } from '../db';

class AIBridge {
  private static instance: AIBridge;
  private openrouterContextLengths: Record<string, number> = {};

  private constructor() {}

  public getOpenRouterContextLength(modelId: string): number | undefined {
    return this.openrouterContextLengths[modelId];
  }

  public static getInstance(): AIBridge {
    if (!AIBridge.instance) {
      AIBridge.instance = new AIBridge();
    }
    return AIBridge.instance;
  }

  public getLanguageModel(provider: string, modelId: string): LanguageModel {
    const providerConfig = dbService.getCustomProviders().find((p: any) => p.id === provider);

    switch (provider) {
      case 'openai': {
        const apiKey = secureStore.getApiKey('openai');
        const params = apiKey ? { apiKey } : {};
        return createOpenAI(params).languageModel(modelId) as unknown as LanguageModel;
      }
      case 'anthropic': {
        const apiKey = secureStore.getApiKey('anthropic');
        const params = apiKey ? { apiKey } : {};
        return createAnthropic(params).languageModel(modelId) as unknown as LanguageModel;
      }
      case 'gemini': {
        const apiKey = secureStore.getApiKey('gemini') || '';
        return createOpenAICompatible({
          name: 'gemini',
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
          apiKey: apiKey,
          supportsStructuredOutputs: true,
        }).languageModel(modelId) as unknown as LanguageModel;
      }
      case 'openrouter': {
        const apiKey = secureStore.getApiKey('openrouter') || '';
        return createOpenAICompatible({
          name: 'openrouter',
          baseURL: 'https://openrouter.ai/api/v1',
          apiKey: apiKey,
        }).languageModel(modelId) as unknown as LanguageModel;
      }
      default: {
        if (providerConfig) {
          const apiKey = secureStore.getCustomProviderKey(provider) || '';
          return createOpenAICompatible({
            name: providerConfig.name || provider,
            apiKey: apiKey,
            baseURL: providerConfig.base_url,
          }).languageModel(modelId) as unknown as LanguageModel;
        }
        throw new Error(`Unsupported provider: ${provider}`);
      }
    }
  }

  public async getEmbedding(provider: string, model: string, text: string): Promise<number[]> {
    const providerConfig = dbService.getCustomProviders().find((p: any) => p.id === provider);

    let embeddingModel: EmbeddingModel;

    switch (provider) {
      case 'openai': {
        const apiKey = secureStore.getApiKey('openai');
        const params = apiKey ? { apiKey } : {};
        embeddingModel = createOpenAI(params).embeddingModel(model);
        break;
      }
      case 'gemini': {
        const apiKey = secureStore.getApiKey('gemini') || '';
        embeddingModel = createOpenAICompatible({
          name: 'gemini',
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
          apiKey: apiKey,
        }).embeddingModel(model);
        break;
      }
      // Add other providers here if they have their own embedding models
      default: {
        if (providerConfig) {
          const apiKey = secureStore.getCustomProviderKey(provider) || '';
          embeddingModel = createOpenAICompatible({
            name: providerConfig.name || provider,
            apiKey: apiKey,
            baseURL: providerConfig.base_url,
          }).embeddingModel(model);
        } else {
          throw new Error(`Unsupported provider: ${provider}`);
        }
      }
    }

    const { embedding } = await embed({
      model: embeddingModel,
      value: text,
    });

    if (embedding) {
      if (embedding.length < 1536) {
        const padded = new Array(1536).fill(0);
        for (let i = 0; i < embedding.length; i++) {
          padded[i] = embedding[i];
        }
        return padded;
      } else if (embedding.length > 1536) {
        return embedding.slice(0, 1536);
      }
    }

    return embedding;
  }

  public async getAvailableModels(provider: string): Promise<string[]> {
    switch (provider) {
      case 'openai':
        return this.fetchOpenAIModels();
      case 'zen':
        return this.fetchZenModels();
      case 'anthropic':
        return [
          'claude-3-5-sonnet-20241022',
          'claude-3-5-haiku-20241022',
          'claude-3-opus-20240229',
        ];
      case 'gemini':
        return [
          'gemini-3.5-flash',
          'gemini-1.5-flash',
          'gemini-1.5-pro',
        ];
      case 'openrouter':
        return this.fetchOpenRouterModels();
      case 'ollama':
        return this.fetchOllamaModels();
      default:
        return ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'];
    }
  }

  private async fetchOpenAIModels(): Promise<string[]> {
    try {
      const apiKey = secureStore.getApiKey('openai');
      if (!apiKey) return ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'];
      const resp = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as any;
      return (data.data || [])
        .map((m: any) => m.id)
        .filter((id: string) => id.includes('gpt'));
    } catch (e) {
      console.error('[AIBridge] Failed to fetch OpenAI models', e);
      return ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'];
    }
  }

  private async fetchZenModels(): Promise<string[]> {
    try {
      const resp = await fetch('https://opencode.ai/zen/v1/models');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as any;
      const baseIds: string[] = (data.data || []).map((m: any) => m.id);
      const expanded: string[] = [];
      for (const id of baseIds) {
        if (id === 'deepseek-v4-flash-free') {
          expanded.push('deepseek-v4-flash-free-low');
          expanded.push('deepseek-v4-flash-free');
          expanded.push('deepseek-v4-flash-free-high');
        } else {
          expanded.push(id);
        }
      }
      return expanded.sort();
    } catch (e) {
      return [
        'deepseek-v4-flash-free',
        'deepseek-v4-flash-free-high',
        'deepseek-v4-flash-free-low',
        'mimo-v2.5-free',
      ];
    }
  }

  private async fetchOllamaModels(): Promise<string[]> {
    const providerConfig = dbService.getCustomProviders().find((p: any) => p.id === 'ollama');
    const baseUrl = providerConfig?.base_url || 'http://localhost:11434';
    try {
      const resp = await fetch(`${baseUrl}/api/tags`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as any;
      if (data.models && Array.isArray(data.models)) {
        return data.models.map((m: any) => m.name);
      }
    } catch (e) {
      console.error('[AIBridge] Failed to fetch Ollama models', e);
    }
    return ['llama3', 'mistral', 'codellama', 'phi3'];
  }

  private async fetchOpenRouterModels(): Promise<string[]> {
    const staticFallback = [
      'openrouter/free',
      'google/gemma-2-9b-it:free',
      'meta-llama/llama-3-8b-instruct:free',
      'mistralai/mistral-7b-instruct:free',
    ];
    try {
      const apiKey = secureStore.getApiKey('openrouter');
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      const resp = await fetch('https://openrouter.ai/api/v1/models', { headers });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as any;
      if (data && Array.isArray(data.data)) {
        for (const m of data.data) {
          if (m.id && typeof m.context_length === 'number') {
            this.openrouterContextLengths[m.id] = m.context_length;
          }
        }
        const freeModels: string[] = data.data
          .filter((m: any) => {
            const isPricingFree = m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0;
            const isSlugFree = m.id && m.id.endsWith(':free');
            return isPricingFree || isSlugFree;
          })
          .map((m: any) => m.id as string);

        // Ensure openrouter/free is at the top of the list
        const sortedFreeModels = Array.from(new Set(freeModels)).sort((a: string, b: string) => {
          if (a === 'openrouter/free') return -1;
          if (b === 'openrouter/free') return 1;
          return a.localeCompare(b);
        });

        return sortedFreeModels.length > 0 ? sortedFreeModels : staticFallback;
      }
      return staticFallback;
    } catch (e) {
      console.error('[AIBridge] Failed to fetch OpenRouter models', e);
      return staticFallback;
    }
  }
}

export const aiBridge = AIBridge.getInstance();
