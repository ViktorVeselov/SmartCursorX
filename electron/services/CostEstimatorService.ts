export interface ModelPrice {
    inputCostPerM: number;  // Cost per 1,000,000 input tokens in USD
    outputCostPerM: number; // Cost per 1,000,000 output tokens in USD
}

export class CostEstimatorService {
    // Model pricing dictionary
    private static pricing: Record<string, ModelPrice> = {
        // OpenAI Models
        'gpt-4o': { inputCostPerM: 2.50, outputCostPerM: 10.00 },
        'gpt-4o-mini': { inputCostPerM: 0.15, outputCostPerM: 0.60 },
        'gpt-4-turbo': { inputCostPerM: 10.00, outputCostPerM: 30.00 },
        'gpt-4': { inputCostPerM: 30.00, outputCostPerM: 60.00 },
        'gpt-3.5-turbo': { inputCostPerM: 0.50, outputCostPerM: 1.50 },
        'o1': { inputCostPerM: 15.00, outputCostPerM: 60.00 },
        'o1-mini': { inputCostPerM: 3.00, outputCostPerM: 12.00 },
        'o3-mini': { inputCostPerM: 1.10, outputCostPerM: 4.40 },

        // Anthropic Models
        'claude-3-5-sonnet-latest': { inputCostPerM: 3.00, outputCostPerM: 15.00 },
        'claude-3-5-sonnet-20241022': { inputCostPerM: 3.00, outputCostPerM: 15.00 },
        'claude-3-5-haiku-latest': { inputCostPerM: 0.80, outputCostPerM: 4.00 },
        'claude-3-5-haiku-20241022': { inputCostPerM: 0.80, outputCostPerM: 4.00 },
        'claude-3-opus-20240229': { inputCostPerM: 15.00, outputCostPerM: 75.00 },
        'claude-3-sonnet-20240229': { inputCostPerM: 3.00, outputCostPerM: 15.00 },
        'claude-3-haiku-20240307': { inputCostPerM: 0.25, outputCostPerM: 1.25 },

        // Gemini Models
        'gemini-1.5-flash': { inputCostPerM: 0.075, outputCostPerM: 0.30 },
        'gemini-1.5-pro': { inputCostPerM: 1.25, outputCostPerM: 5.00 },
        'gemini-2.5-flash': { inputCostPerM: 0.075, outputCostPerM: 0.30 },
        'gemini-2.5-pro': { inputCostPerM: 1.25, outputCostPerM: 5.00 },
        'gemini-3-flash': { inputCostPerM: 0.50, outputCostPerM: 3.00 },
        'gemini-3.5-flash': { inputCostPerM: 1.50, outputCostPerM: 9.00 },
        'gemini-3.1-pro': { inputCostPerM: 2.00, outputCostPerM: 12.00 },

        // Embedding Models
        'text-embedding-3-small': { inputCostPerM: 0.02, outputCostPerM: 0.00 },
        'gemini-embedding-001': { inputCostPerM: 0.025, outputCostPerM: 0.00 },
        'local-hashing': { inputCostPerM: 0.00, outputCostPerM: 0.00 },

        // DeepSeek Models (via Zen)
        'deepseek-v4-pro': { inputCostPerM: 1.74, outputCostPerM: 3.48 },
        'deepseek-v4-flash': { inputCostPerM: 0.14, outputCostPerM: 0.28 },

        // OpenCode Zen Models (paid)
        'qwen3.7-max': { inputCostPerM: 2.50, outputCostPerM: 7.50 },
        'qwen3.7-plus': { inputCostPerM: 0.40, outputCostPerM: 1.60 },
        'qwen3.6-plus': { inputCostPerM: 0.50, outputCostPerM: 3.00 },
        'qwen3.5-plus': { inputCostPerM: 0.20, outputCostPerM: 1.20 },
        'minimax-m2.7': { inputCostPerM: 0.30, outputCostPerM: 1.20 },
        'minimax-m2.5': { inputCostPerM: 0.30, outputCostPerM: 1.20 },
        'glm-5.1': { inputCostPerM: 1.40, outputCostPerM: 4.40 },
        'glm-5': { inputCostPerM: 1.00, outputCostPerM: 3.20 },
        'kimi-k2.5': { inputCostPerM: 0.60, outputCostPerM: 3.00 },
        'kimi-k2.6': { inputCostPerM: 0.95, outputCostPerM: 4.00 },
        'grok-build-0.1': { inputCostPerM: 1.00, outputCostPerM: 2.00 },


        // New Claude Models (via Zen)
        'claude-haiku-4.5': { inputCostPerM: 1.00, outputCostPerM: 5.00 },
        'claude-sonnet-4': { inputCostPerM: 3.00, outputCostPerM: 15.00 },
        'claude-sonnet-4.5': { inputCostPerM: 3.00, outputCostPerM: 15.00 },
        'claude-sonnet-4.6': { inputCostPerM: 3.00, outputCostPerM: 15.00 },
        'claude-opus-4.1': { inputCostPerM: 15.00, outputCostPerM: 75.00 },
        'claude-opus-4.5': { inputCostPerM: 5.00, outputCostPerM: 25.00 },
        'claude-opus-4.6': { inputCostPerM: 5.00, outputCostPerM: 25.00 },
        'claude-opus-4.7': { inputCostPerM: 5.00, outputCostPerM: 25.00 },
        'claude-opus-4.8': { inputCostPerM: 5.00, outputCostPerM: 25.00 },
        'claude-fable-5': { inputCostPerM: 10.00, outputCostPerM: 50.00 },

        // GPT-5.x Models (via Zen)
        'gpt-5-nano': { inputCostPerM: 0.05, outputCostPerM: 0.40 },
        'gpt-5.1-codex-mini': { inputCostPerM: 0.25, outputCostPerM: 2.00 },
        'gpt-5.1-codex': { inputCostPerM: 1.07, outputCostPerM: 8.50 },
        'gpt-5.1-codex-max': { inputCostPerM: 1.25, outputCostPerM: 10.00 },
        'gpt-5.1': { inputCostPerM: 1.07, outputCostPerM: 8.50 },
        'gpt-5-codex': { inputCostPerM: 1.07, outputCostPerM: 8.50 },
        'gpt-5': { inputCostPerM: 1.07, outputCostPerM: 8.50 },
        'gpt-5.2-codex': { inputCostPerM: 1.75, outputCostPerM: 14.00 },
        'gpt-5.2': { inputCostPerM: 1.75, outputCostPerM: 14.00 },
        'gpt-5.3-codex-spark': { inputCostPerM: 1.75, outputCostPerM: 14.00 },
        'gpt-5.3-codex': { inputCostPerM: 1.75, outputCostPerM: 14.00 },
        'gpt-5.4-nano': { inputCostPerM: 0.20, outputCostPerM: 1.25 },
        'gpt-5.4-mini': { inputCostPerM: 0.75, outputCostPerM: 4.50 },
        'gpt-5.4': { inputCostPerM: 2.50, outputCostPerM: 15.00 },
        'gpt-5.4-pro': { inputCostPerM: 30.00, outputCostPerM: 180.00 },
        'gpt-5.5': { inputCostPerM: 5.00, outputCostPerM: 30.00 },
        'gpt-5.5-pro': { inputCostPerM: 30.00, outputCostPerM: 180.00 },
    };

    /**
     * Gets the price details for a model. Falls back to a default if unknown.
     */
    static getModelPrice(model: string, provider?: string): ModelPrice {
        if (!model) return { inputCostPerM: 0, outputCostPerM: 0 };

        const normModel = model.toLowerCase();

        // Local models (Ollama) cost nothing
        if (provider === 'ollama' || normModel.includes('llama') || normModel.includes('mistral') || normModel.includes('phi')) {
            return { inputCostPerM: 0, outputCostPerM: 0 };
        }

        // Free models always cost $0 (e.g., Zen free models with "-free" suffix)
        if (normModel.includes('-free')) {
            return { inputCostPerM: 0, outputCostPerM: 0 };
        }

        // Try exact match first
        if (this.pricing[normModel]) {
            return this.pricing[normModel];
        }

        // Strip effort suffix (-high, -low) and retry
        const baseModel = normModel.replace(/-(high|low)$/, '');
        if (baseModel !== normModel && this.pricing[baseModel]) {
            return this.pricing[baseModel];
        }

        // Match by substring prefixes
        for (const [key, value] of Object.entries(this.pricing)) {
            if (normModel.includes(key)) {
                return value;
            }
        }

        // Standard default pricing for generic cloud models ($1.00 / $3.00 per million)
        return { inputCostPerM: 1.00, outputCostPerM: 3.00 };
    }

    /**
     * Estimates cost in USD for a given input & output token count.
     */
    static estimateCost(model: string, inputTokens: number, outputTokens: number, provider?: string): number {
        const price = this.getModelPrice(model, provider);
        const inputCost = (inputTokens / 1_000_000) * price.inputCostPerM;
        const outputCost = (outputTokens / 1_000_000) * price.outputCostPerM;
        return Number((inputCost + outputCost).toFixed(6));
    }
}


