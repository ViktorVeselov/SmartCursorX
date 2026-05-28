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
    private static getOpenAIClient(): OpenAI | null {
        const key = secureStore.getApiKey('openai') || process.env.OPENAI_API_KEY;
        if (!key) return null;
        return new OpenAI({ apiKey: key });
    }

    /**
     * Generates a 1536-dimension float vector embedding using text-embedding-3-small.
     * Falls back to a deterministic TF-IDF/frequency vector if no API key is configured.
     */
    static async generateEmbedding(text: string): Promise<Float32Array> {
        console.assert(typeof text === 'string', 'text must be a valid string');
        const defaultDim = 1536;

        const client = this.getOpenAIClient();
        if (client) {
            try {
                const response = await client.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: text.replace(/\n/g, ' ')
                });
                const vec = response.data[0]?.embedding;
                if (vec && vec.length === defaultDim) {
                    return new Float32Array(vec);
                }
            } catch (e) {
                console.error('[EmbeddingService] OpenAI Embeddings call failed, falling back:', e);
            }
        }

        console.warn('[EmbeddingService] OpenAI Key not set or failed. Using deterministic word feature-hashing fallback.');
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
