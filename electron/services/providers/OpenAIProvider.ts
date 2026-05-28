import OpenAI from 'openai';
import { IAIProvider, LLMMessage, CompletionOptions } from './types';

export class OpenAIProvider implements IAIProvider {
    id = 'openai';
    name = 'OpenAI';
    private client: OpenAI | null = null;
    private apiKey: string;
    private baseUrl?: string;

    constructor(apiKey: string, baseUrl?: string) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.initializeClient();
    }

    private initializeClient() {
        if (!this.apiKey) return;
        this.client = new OpenAI({
            apiKey: this.apiKey,
            baseURL: this.baseUrl,
        });
    }

    async chat(messages: LLMMessage[], options?: CompletionOptions): Promise<string | AsyncIterable<string>> {
        if (!this.client) throw new Error('OpenAI client not initialized. Check API Key.');

        const model = options?.model || 'gpt-4o';
        const stream = options?.stream ?? false;

        if (stream) {
            const streamResponse = await this.client.chat.completions.create({
                model,
                messages,
                stream: true,
                temperature: options?.temperature ?? 0.0
            });

            return (async function* () {
                for await (const chunk of streamResponse) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    if (content) yield content;
                }
            })();
        } else {
            const response = await this.client.chat.completions.create({
                model,
                messages,
                stream: false,
                temperature: options?.temperature ?? 0.0
            });
            return response.choices[0]?.message?.content || '';
        }
    }

    async validateKey(apiKey: string): Promise<boolean> {
        try {
            const tempClient = new OpenAI({ apiKey });
            await tempClient.models.list();
            return true;
        } catch (e) {
            return false;
        }
    }

    async getModels(): Promise<string[]> {
        if (!this.client) return ['gpt-3.5-turbo', 'gpt-4', 'gpt-4o'];
        try {
            const list = await this.client.models.list();
            return list.data.map(m => m.id).filter(id => id.includes('gpt'));
        } catch (e) {
            console.error('Failed to fetch models', e);
            return ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'];
        }
    }
}
