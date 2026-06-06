import OpenAI from 'openai';
import { dbService } from '../db';
import { secureStore } from '../secureStore';

export interface ChunkResult {
    id: number;
    sourceType: string;
    sourceId: string | null;
    content: string;
    metadata: any;
    tokenCount: number;
    distance: number;
}

export class EmbeddingService {
    private static getActiveProviderConfig(): { id: string; key: string | null; baseUrl?: string } {
        const activeProvider = secureStore.getActiveProvider();
        
        // 1. Check custom providers first (since they are dynamic and can override built-in ones)
        try {
            const customProviders = dbService.getCustomProviders();
            const custom = customProviders.find((p: any) => p.id === activeProvider);
            if (custom) {
                const key = secureStore.getCustomProviderKey(activeProvider) || secureStore.getApiKey(activeProvider) || custom.api_key || null;
                return {
                    id: activeProvider,
                    key,
                    baseUrl: custom.base_url
                };
            }
        } catch (e) {
            console.error('[EmbeddingService] Failed to load custom providers:', e);
        }

        // 2. Check standard built-in providers
        if (activeProvider === 'openai') {
            return {
                id: 'openai',
                key: secureStore.getApiKey('openai') || process.env.OPENAI_API_KEY || null
            };
        }
        if (activeProvider === 'anthropic') {
            return {
                id: 'anthropic',
                key: secureStore.getApiKey('anthropic') || process.env.ANTHROPIC_API_KEY || null
            };
        }

        // Generic fallback to check environment variables or secureStore
        const genericKey = secureStore.getApiKey(activeProvider) || process.env[`${activeProvider.toUpperCase()}_API_KEY`] || null;
        return {
            id: activeProvider,
            key: genericKey
        };
    }

    private static async generateGeminiEmbedding(text: string, apiKey: string): Promise<Float32Array | null> {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'models/gemini-embedding-001',
                    content: {
                        parts: [{ text }]
                    },
                    outputDimensionality: 1536
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error(`[EmbeddingService] Gemini embedding API returned error status ${response.status}:`, errText);
                return null;
            }

            const data = await response.json() as any;
            const values = data?.embedding?.values;
            if (Array.isArray(values) && values.length > 0) {
                // Project Gemini vector to 1536-dimension database slot
                const targetDim = 1536;
                const result = new Float32Array(targetDim);
                
                // Copy values (should match targetDim, fallback zero-pads or truncates safely)
                const len = Math.min(values.length, targetDim);
                for (let i = 0; i < len; i++) {
                    result[i] = Number(values[i]);
                }
                
                // L2 Normalize the projected vector to ensure correct cosine similarity math
                let sumSqr = 0;
                for (let i = 0; i < targetDim; i++) {
                    sumSqr += result[i] * result[i];
                }
                const magnitude = Math.sqrt(sumSqr) || 1.0;
                for (let i = 0; i < targetDim; i++) {
                    result[i] /= magnitude;
                }
                
                return result;
            }
        } catch (e) {
            console.error('[EmbeddingService] Failed to call Gemini embeddings REST API:', e);
        }
        return null;
    }

    /**
     * Generates a 1536-dimension float vector embedding using text-embedding-3-small (OpenAI) or gemini-embedding-001 (Gemini).
     * Falls back to a deterministic TF-IDF/frequency vector if no API key is configured.
     */
    static async generateEmbedding(text: string): Promise<Float32Array> {
        console.assert(typeof text === 'string', 'text must be a valid string');
        const defaultDim = 1536;
        const startTime = Date.now();
        const estimatedTokens = Math.ceil(text.length / 4);

        const config = this.getActiveProviderConfig();
        const isGemini = config.id.toLowerCase().includes('gemini') || 
                         config.id.toLowerCase().includes('google') ||
                         (config.baseUrl && config.baseUrl.toLowerCase().includes('google')) ||
                         (config.baseUrl && config.baseUrl.toLowerCase().includes('googleapis.com'));

        if (isGemini) {
            const geminiKey = config.key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
            if (geminiKey) {
                try {
                    const vec = await this.generateGeminiEmbedding(text, geminiKey);
                    if (vec) {
                        try {
                            dbService.addModelPerformance(
                                'gemini-embedding-001',
                                config.id,
                                'embedding',
                                1,
                                1,
                                estimatedTokens,
                                Date.now() - startTime,
                                estimatedTokens,
                                0
                            );
                        } catch (perfErr) {
                            console.error('[EmbeddingService] Failed to log Gemini embedding performance:', perfErr);
                        }
                        return vec;
                    }
                } catch (e) {
                    console.error('[EmbeddingService] Gemini embeddings failed, trying fallback:', e);
                    try {
                        dbService.addModelPerformance(
                            'gemini-embedding-001',
                            config.id,
                            'embedding',
                            0,
                            1,
                            estimatedTokens,
                            Date.now() - startTime,
                            estimatedTokens,
                            0
                        );
                    } catch (perfErr) {
                        console.error('[EmbeddingService] Failed to log Gemini embedding performance failure:', perfErr);
                    }
                }
            }
        }

        // Fallback to OpenAI if configured
        const openaiKey = secureStore.getApiKey('openai') || process.env.OPENAI_API_KEY;
        if (openaiKey) {
            try {
                const openaiClient = new OpenAI({ apiKey: openaiKey });
                const response = await openaiClient.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: text.replace(/\n/g, ' ')
                });
                const vec = response.data[0]?.embedding;
                if (vec && vec.length === defaultDim) {
                    const actualTokens = response.usage?.prompt_tokens || estimatedTokens;
                    try {
                        dbService.addModelPerformance(
                            'text-embedding-3-small',
                            'openai',
                            'embedding',
                            1,
                            1,
                            actualTokens,
                            Date.now() - startTime,
                            actualTokens,
                            0
                        );
                    } catch (perfErr) {
                        console.error('[EmbeddingService] Failed to log OpenAI embedding performance:', perfErr);
                    }
                    return new Float32Array(vec);
                }
            } catch (e) {
                console.error('[EmbeddingService] OpenAI Embeddings fallback call failed:', e);
                try {
                    dbService.addModelPerformance(
                        'text-embedding-3-small',
                        'openai',
                        'embedding',
                        0,
                        1,
                        estimatedTokens,
                        Date.now() - startTime,
                        estimatedTokens,
                        0
                    );
                } catch (perfErr) {
                    console.error('[EmbeddingService] Failed to log OpenAI embedding performance failure:', perfErr);
                }
            }
        }

        // Secondary fallback to custom provider base URL if it's OpenAI-compatible (and not gemini)
        if (!isGemini && config.key && config.baseUrl) {
            try {
                const customClient = new OpenAI({ apiKey: config.key, baseURL: config.baseUrl });
                const response = await customClient.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: text.replace(/\n/g, ' ')
                });
                const vec = response.data[0]?.embedding;
                if (vec && vec.length === defaultDim) {
                    const actualTokens = response.usage?.prompt_tokens || estimatedTokens;
                    try {
                        dbService.addModelPerformance(
                            'text-embedding-3-small',
                            config.id,
                            'embedding',
                            1,
                            1,
                            actualTokens,
                            Date.now() - startTime,
                            actualTokens,
                            0
                        );
                    } catch (perfErr) {
                        console.error('[EmbeddingService] Failed to log custom provider embedding performance:', perfErr);
                    }
                    return new Float32Array(vec);
                }
            } catch (e) {
                console.error('[EmbeddingService] Custom provider embeddings call failed:', e);
                try {
                    dbService.addModelPerformance(
                        'text-embedding-3-small',
                        config.id,
                        'embedding',
                        0,
                        1,
                        estimatedTokens,
                        Date.now() - startTime,
                        estimatedTokens,
                        0
                    );
                } catch (perfErr) {
                    console.error('[EmbeddingService] Failed to log custom provider embedding performance failure:', perfErr);
                }
            }
        }

        console.warn('[EmbeddingService] No compatible API key set or embedding calls failed. Using deterministic word feature-hashing fallback.');
        try {
            dbService.addModelPerformance(
                'local-hashing',
                'local',
                'embedding',
                1,
                1,
                estimatedTokens,
                Date.now() - startTime,
                estimatedTokens,
                0
            );
        } catch (perfErr) {
            console.error('[EmbeddingService] Failed to log local-hashing embedding performance:', perfErr);
        }
        const fallback = new Float32Array(defaultDim);
        const lowerText = text.toLowerCase();

        const words = lowerText.split(/[^a-z0-9]+/i).filter(w => w.length >= 2);

        if (words.length === 0) {
            for (let i = 0; i < lowerText.length; i++) {
                const charCode = lowerText.charCodeAt(i);
                const index = (charCode * 31) % defaultDim;
                fallback[index] += 1.0;
            }
        } else {
            for (const word of words) {
                let hash = 0;
                for (let j = 0; j < word.length; j++) {
                    hash = (hash * 31 + word.charCodeAt(j)) | 0;
                }
                const index = Math.abs(hash) % defaultDim;
                fallback[index] += 1.0;
            }
        }

        for (let i = 0; i < defaultDim; i++) {
            if (fallback[i] > 0) {
                fallback[i] = 1.0 + Math.log(fallback[i]);
            }
        }

        let sumSqr = 0;
        for (let i = 0; i < defaultDim; i++) sumSqr += fallback[i] * fallback[i];
        const magnitude = Math.sqrt(sumSqr) || 1.0;
        for (let i = 0; i < defaultDim; i++) fallback[i] /= magnitude;

        console.assert(fallback.length === defaultDim, `Fallback vector must have exactly ${defaultDim} dimensions`);
        return fallback;
    }

    /**
     * Splits code or markdown documents by logical structures (classes, functions, paragraphs).
     */
    static chunkContent(content: string, maxChunkSize: number = 800): string[] {
        console.assert(typeof content === 'string', 'Content is required');
        const chunks: string[] = [];
        const lines = content.split(/\r?\n/);
        
        let currentChunkLines: string[] = [];
        let currentLength = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            const isCodeSeparator = /^(?:export\s+)?(?:class|function|interface|const)\s+/.test(line.trim());
            const isMarkdownSeparator = line.trim() === '' && currentLength > 300;

            if ((isCodeSeparator || isMarkdownSeparator) && currentChunkLines.length > 0) {
                chunks.push(currentChunkLines.join('\n'));
                currentChunkLines = [];
                currentLength = 0;
            }

            currentChunkLines.push(line);
            currentLength += line.length;

            if (currentLength >= maxChunkSize) {
                chunks.push(currentChunkLines.join('\n'));
                currentChunkLines = [];
                currentLength = 0;
            }
        }

        if (currentChunkLines.length > 0) {
            chunks.push(currentChunkLines.join('\n'));
        }

        return chunks;
    }

    /**
     * Chunk, embed, and index a piece of knowledge into raw database chunks and sqlite-vec KNN virtual index.
     */
    static async indexKnowledge(sourceType: string, sourceId: string | null, content: string, metadata: object): Promise<void> {
        console.assert(sourceType && typeof sourceType === 'string', 'sourceType must be a string');
        console.assert(content && typeof content === 'string', 'content must be a string');

        const chunks = this.chunkContent(content);
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const tokenCount = Math.ceil(chunk.length / 4);
            const embedding = await this.generateEmbedding(chunk);

            dbService.addKnowledgeChunk(
                sourceType,
                sourceId,
                chunk,
                { ...metadata, chunk_index: i, total_chunks: chunks.length },
                tokenCount,
                embedding
            );
        }
    }

    /**
     * Performs vector KNN MATCH query search over the sqlite-vec index.
     */
    static async searchSimilarity(query: string, limit: number = 5): Promise<ChunkResult[]> {
        console.assert(typeof query === 'string' && query.trim().length > 0, 'query is required');
        const embedding = await this.generateEmbedding(query);
        const rawResults = dbService.searchKnowledge(embedding, limit);
        
        return rawResults.map((r: any) => ({
            id: Number(r.id),
            sourceType: r.source_type,
            sourceId: r.source_id,
            content: r.content,
            metadata: r.metadata,
            tokenCount: Number(r.token_count || 0),
            distance: Number(r.distance || 0)
        }));
    }
}
