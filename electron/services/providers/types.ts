
export interface LLMMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface CompletionOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
}

export interface IAIProvider {
    id: string; // 'openai', 'anthropic', etc.
    name: string;

    // Core capabilities
    chat(messages: LLMMessage[], options?: CompletionOptions): Promise<string | AsyncIterable<string>>;
    validateKey(apiKey: string): Promise<boolean>;

    // Model Discovery
    getModels(): Promise<string[]>;
}
