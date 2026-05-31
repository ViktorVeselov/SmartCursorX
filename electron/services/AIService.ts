import { IAIProvider } from './providers/types';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { dbService } from '../db';
import console from 'console';

export interface ProviderConfig {
    providerId: string;
    apiKey: string;
    baseUrl?: string;
    /**
     * Marks the provider as a locally‑hosted LLM (e.g., Ollama, custom self‑hosted services).
     * Used to decide whether to show the Local LLMs settings tab.
     */
    isLocal?: boolean;
}

export class AIService {
    private static instance: AIService;
    private activeProvider: IAIProvider | null = null;

    private constructor() { }

    static getInstance(): AIService {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }

    initialize(config: ProviderConfig) {
        console.assert(config !== null && typeof config === 'object', 'Config must be a valid object');
        console.assert(typeof config.providerId === 'string', 'Provider ID must be specified');
        this.activeProvider = this.createProvider(config);
    }

    private createProvider(config: ProviderConfig): IAIProvider {
        console.assert(typeof config.providerId === 'string', 'config.providerId must be a string');
        
        // Check if dynamic custom provider is stored in SQLite
        const customProviders = dbService.getCustomProviders();
        const custom = customProviders.find((p: any) => p.id === config.providerId);
        if (custom) {
            return new OpenAIProvider(config.apiKey || custom.api_key || '', config.baseUrl || custom.base_url);
        }

        switch (config.providerId) {
            case 'openai':
                return new OpenAIProvider(config.apiKey, config.baseUrl);
            case 'litellm':
                return new OpenAIProvider(config.apiKey, config.baseUrl || 'http://localhost:4000/v1');
            case 'anthropic':
                return new AnthropicProvider(config.apiKey, config.baseUrl);
            case 'ollama':
                return new OllamaProvider(config.apiKey, config.baseUrl);
            default:
                throw new Error(`Unknown provider: ${config.providerId}`);
        }
    }

    getProvider(): IAIProvider {
        console.assert(this.activeProvider !== null, 'Active provider must be initialized before retrieval');
        if (!this.activeProvider) {
            throw new Error('AI Provider not initialized');
        }
        return this.activeProvider;
    }

    isActive(): boolean {
        return !!this.activeProvider;
    }

    // Helper for Hybrid Auth (Env fallback)
    static getEnvKey(providerId: string): string | undefined {
        console.assert(typeof providerId === 'string', 'providerId must be a string');
        if (providerId === 'openai') {
            return process.env.OPENAI_API_KEY;
        }
        if (providerId === 'anthropic') {
            return process.env.ANTHROPIC_API_KEY;
        }
        return undefined;
    }
}

export const aiService = AIService.getInstance();
