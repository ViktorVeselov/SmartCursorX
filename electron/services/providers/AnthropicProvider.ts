import { IAIProvider, LLMMessage, CompletionOptions } from './types';
import console from 'console';

export class AnthropicProvider implements IAIProvider {
    id = 'anthropic';
    name = 'Anthropic';
    private apiKey: string;
    private baseUrl?: string;

    constructor(apiKey: string, baseUrl?: string) {
        console.assert(typeof apiKey === 'string', 'API key must be a string');
        console.assert(apiKey.length > 0, 'API key cannot be empty');
        this.apiKey = apiKey;
        this.baseUrl = baseUrl || 'https://api.anthropic.com';
    }

    async chat(messages: LLMMessage[], options?: CompletionOptions): Promise<string | AsyncIterable<string>> {
        console.assert(Array.isArray(messages), 'messages must be an array');
        console.assert(messages.length > 0, 'messages list cannot be empty');

        const model = options?.model || 'claude-3-5-sonnet-20241022';
        const stream = options?.stream ?? false;
        
        // Convert LLMMessage structure to Anthropic's expected format (extracting system prompt)
        const systemMessage = messages.find(m => m.role === 'system');
        const systemPrompt = systemMessage ? systemMessage.content : undefined;
        const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
            content: m.content
        }));

        console.assert(chatMessages.length > 0, 'Must have at least one user or assistant message');

        const response = await fetch(`${this.baseUrl}/v1/messages`, {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model,
                messages: chatMessages,
                system: systemPrompt,
                stream,
                max_tokens: options?.maxTokens || 4096,
                temperature: options?.temperature ?? 0.0
            })
        });

        console.assert(response.ok, `Anthropic API request failed with status ${response.status}`);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Anthropic API error: ${errText}`);
        }

        if (stream) {
            console.assert(response.body !== null, 'Response body stream cannot be null');
            const reader = response.body!.getReader();
            const decoder = new TextDecoder('utf-8');

            return (async function* () {
                let buffer = '';
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed) continue;
                            if (trimmed.startsWith('data:')) {
                                try {
                                    const parsed = JSON.parse(trimmed.slice(5).trim());
                                    if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                                        yield parsed.delta.text;
                                    }
                                } catch (e) {
                                    // Ignore incomplete parse line
                                }
                            }
                        }
                    }
                } finally {
                    reader.releaseLock();
                }
            })();
        } else {
            const data = await response.json() as any;
            console.assert(data && data.content && data.content[0], 'Response data must contain content blocks');
            return data.content[0].text || '';
        }
    }

    async validateKey(apiKey: string): Promise<boolean> {
        console.assert(typeof apiKey === 'string', 'API key for validation must be a string');
        try {
            const res = await fetch(`${this.baseUrl}/v1/messages`, {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 1
                })
            });
            return res.status !== 401;
        } catch (e) {
            return false;
        }
    }

    async getModels(): Promise<string[]> {
        return [
            'claude-3-5-sonnet-20241022',
            'claude-3-5-haiku-20241022',
            'claude-3-opus-20240229'
        ];
    }
}
