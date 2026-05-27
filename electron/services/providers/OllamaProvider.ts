import { IAIProvider, LLMMessage, CompletionOptions } from './types';
import console from 'console';

export class OllamaProvider implements IAIProvider {
    id = 'ollama';
    name = 'Ollama';
    private baseUrl: string;

    constructor(_apiKey: string, baseUrl?: string) {
        this.baseUrl = baseUrl || 'http://localhost:11434';
    }

    async chat(messages: LLMMessage[], options?: CompletionOptions): Promise<string | AsyncIterable<string>> {
        console.assert(Array.isArray(messages), 'messages must be an array');
        console.assert(messages.length > 0, 'messages list cannot be empty');

        const model = options?.model || 'llama3';
        const stream = options?.stream ?? false;

        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model,
                messages,
                stream,
                options: {
                    temperature: options?.temperature ?? 0.7
                }
            })
        });

        console.assert(response.ok, `Ollama API request failed with status ${response.status}`);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Ollama API error: ${errText}`);
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
                            try {
                                const parsed = JSON.parse(trimmed);
                                if (parsed.message?.content) {
                                    yield parsed.message.content;
                                }
                            } catch (e) {
                                // Ignore partial lines
                            }
                        }
                    }
                } finally {
                    reader.releaseLock();
                }
            })();
        } else {
            const data = await response.json() as any;
            console.assert(data && data.message, 'Ollama JSON response must contain a message object');
            return data.message?.content || '';
        }
    }

    async validateKey(_apiKey: string): Promise<boolean> {
        try {
            const res = await fetch(`${this.baseUrl}/api/tags`);
            return res.ok;
        } catch (e) {
            return false;
        }
    }

    async getModels(): Promise<string[]> {
        try {
            const res = await fetch(`${this.baseUrl}/api/tags`);
            console.assert(res.ok, 'Tags request must be OK');
            if (res.ok) {
                const data = await res.json() as any;
                if (data.models && Array.isArray(data.models)) {
                    return data.models.map((m: any) => m.name);
                }
            }
        } catch (e) {
            console.error('Failed to query local Ollama models', e);
        }
        return ['llama3', 'mistral', 'codellama', 'phi3']; // Fallback
    }
}
