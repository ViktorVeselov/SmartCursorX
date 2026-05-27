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
        // Pull OpenAI key dynamically from secure safeStorage
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
                    input: text.replace(/\n/g, ' ') // OpenAI best-practice sanitization
                });
                const vec = response.data[0]?.embedding;
                if (vec && vec.length === defaultDim) {
                    return new Float32Array(vec);
                }
            } catch (e) {
                console.error('[EmbeddingService] OpenAI Embeddings call failed, falling back:', e);
            }
        }

        // Mathematical TF-IDF deterministic fallback if API Key is not set/available
        const fallback = new Float32Array(defaultDim);
        const lowerText = text.toLowerCase();
        for (let i = 0; i < defaultDim; i++) {
            // Pseudo-random but deterministic projection matrix mapping text characters
            const keywordCode = (i * 31) % 65536;
            const charStr = String.fromCharCode(keywordCode % 256);
            let count = 0;
            let pos = lowerText.indexOf(charStr);
            while (pos !== -1) {
                count++;
                pos = lowerText.indexOf(charStr, pos + 1);
            }
            fallback[i] = count / (lowerText.length || 1);
        }

        // Normalize the fallback vector to length 1.0 (cosine expects normalized inputs)
        let sumSqr = 0;
        for (let i = 0; i < defaultDim; i++) sumSqr += fallback[i] * fallback[i];
        const magnitude = Math.sqrt(sumSqr) || 1.0;
        for (let i = 0; i < defaultDim; i++) fallback[i] /= magnitude;

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
            
            // Heuristic logical chunk boundary cuts: class/function starts or paragraph blank lines
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

            // Insert into the transaction-wrapped database service indexing method
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
