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
        'gemini-3.5-flash': { inputCostPerM: 0.075, outputCostPerM: 0.30 },

        // Embedding Models
        'text-embedding-3-small': { inputCostPerM: 0.02, outputCostPerM: 0.00 },
        'gemini-embedding-001': { inputCostPerM: 0.025, outputCostPerM: 0.00 },
        'local-hashing': { inputCostPerM: 0.00, outputCostPerM: 0.00 },
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

        // Try exact match first
        if (this.pricing[normModel]) {
            return this.pricing[normModel];
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
