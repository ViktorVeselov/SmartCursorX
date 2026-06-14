import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { ollama } from 'ollama-ai-provider';
import type { LanguageModel } from 'ai';

export interface ProviderConfig {
  providerId: string;
  apiKey: string;
  baseUrl?: string;
  isLocal?: boolean;
}

const ZEN_EFFORT_MODELS: Record<string, { model: string; effort?: string }> = {
  'deepseek-v4-flash-free-high': { model: 'deepseek-v4-flash-free', effort: 'high' },
  'deepseek-v4-flash-free-low':  { model: 'deepseek-v4-flash-free', effort: 'low' },
  'deepseek-v4-flash-free':      { model: 'deepseek-v4-flash-free' },
};

export function resolveZenModel(modelId: string): { model: string; effort?: string } {
  const entry = ZEN_EFFORT_MODELS[modelId];
  if (entry) return entry;
  return { model: modelId };
}

export function createLanguageModel(config: ProviderConfig, modelId: string): LanguageModel {
  switch (config.providerId) {
    case 'openai': {
      const params: Record<string, unknown> = {};
      if (config.apiKey) params.apiKey = config.apiKey;
      if (config.baseUrl) params.baseURL = config.baseUrl;
      return createOpenAI(params).languageModel(modelId) as unknown as LanguageModel;
    }
    case 'anthropic': {
      const params: Record<string, unknown> = {};
      if (config.apiKey) params.apiKey = config.apiKey;
      if (config.baseUrl) params.baseURL = config.baseUrl;
      return createAnthropic(params).languageModel(modelId) as unknown as LanguageModel;
    }
    case 'ollama':
      return ollama(modelId) as unknown as LanguageModel;
    case 'zen': {
      const resolved = resolveZenModel(modelId);
      return createOpenAICompatible({
        name: 'zen',
        baseURL: 'https://opencode.ai/zen/v1',
      }).languageModel(resolved.model) as unknown as LanguageModel;
    }
    case 'litellm':
      return createOpenAICompatible({
        name: 'litellm',
        baseURL: config.baseUrl || 'http://localhost:4000/v1',
        apiKey: config.apiKey,
      }).languageModel(modelId) as unknown as LanguageModel;
    case 'gemini':
      return createOpenAICompatible({
        name: 'gemini',
        baseURL: config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai/',
        apiKey: config.apiKey,
        supportsStructuredOutputs: true,
      }).languageModel(modelId) as unknown as LanguageModel;
    case 'openrouter':
      return createOpenAICompatible({
        name: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: config.apiKey,
      }).languageModel(modelId) as unknown as LanguageModel;
    default:
      return createOpenAICompatible({
        name: config.providerId,
        baseURL: config.baseUrl || 'http://localhost:11434/v1',
        apiKey: config.apiKey,
      }).languageModel(modelId) as unknown as LanguageModel;
  }
}
