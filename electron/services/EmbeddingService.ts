import { dbService } from '../db';
import { secureStore } from '../secureStore';
import { aiBridge } from './AIBridge';

export interface ChunkResult {
    id: number;
    sourceType: string;
    sourceId: string | null;
    content: string;
    metadata: any;
    tokenCount: number;
    distance: number;
}

const KNOWN_EMBEDDING_DIMS: Record<string, number> = {
    'text-embedding-3-small': 1536,
    'text-embedding-3-large': 3072,
    'text-embedding-ada-002': 1536,
    'gemini-embedding-001': 768,
    'zen-embedding-v1': 768,
    'nomic-embed-text': 768,
    'all-minilm': 384,
    'mxbai-embed-large': 1024,
    'bge-m3': 1024,
    'snowflake-arctic-embed': 1024,
    'llama': 4096,
    'bert': 768,
};

const DEFAULT_EMBEDDING_DIM = 1536;

export class EmbeddingService {
    static resolveEmbeddingDimension(modelName: string): number {
        if (KNOWN_EMBEDDING_DIMS[modelName]) return KNOWN_EMBEDDING_DIMS[modelName];
        const baseName = modelName.split(':')[0].split('/').pop() || modelName;
        const lowerBase = baseName.toLowerCase();
        const matched = Object.keys(KNOWN_EMBEDDING_DIMS).find(k => lowerBase.startsWith(k.toLowerCase()));
        return matched ? KNOWN_EMBEDDING_DIMS[matched] : DEFAULT_EMBEDDING_DIM;
    }

    static getEffectiveDimension(): number {
        const config = secureStore.getEmbeddingConfig();
        const storedDim = secureStore.getEmbeddingDimension();
        if (storedDim > 0) return storedDim;
        const resolved = this.resolveEmbeddingDimension(config.model);
        secureStore.setEmbeddingDimension(resolved);
        return resolved;
    }

    /**
     * Generates a float vector embedding using the configured provider/model.
     * Falls back to a zero vector if no API key is configured.
     */
    static async generateEmbedding(text: string): Promise<Float32Array> {
        console.assert(typeof text === 'string', 'text must be a valid string');
        const dim = this.getEffectiveDimension();
        const startTime = Date.now();
        const estimatedTokens = Math.ceil(text.length / 4);

        const embeddingConfig = secureStore.getEmbeddingConfig();
        const activeProvider = embeddingConfig.provider;
        const activeModel = embeddingConfig.model;

        try {
            const embedding = await aiBridge.getEmbedding(activeProvider, activeModel, text);
            if (embedding && embedding.length > 0) {
                const actualDim = embedding.length;
                if (actualDim !== dim) {
                    console.log(`[EmbeddingService] Detected actual dimension ${actualDim} (configured ${dim}). Updating.`);
                    secureStore.setEmbeddingDimension(actualDim);
                    dbService.syncVecDimension();
                }
                const targetDim = actualDim > 0 ? actualDim : dim;
                const normalized = EmbeddingService.normalizeToDim(embedding, targetDim);
                try {
                    dbService.addModelPerformance(
                        activeModel,
                        activeProvider,
                        'embedding',
                        1,
                        1,
                        estimatedTokens,
                        Date.now() - startTime,
                        estimatedTokens,
                        0
                    );
                } catch (perfErr) {
                    console.error('[EmbeddingService] Failed to log embedding performance:', perfErr);
                }
                return normalized;
            }
        } catch (e) {
            console.error(`[EmbeddingService] ${activeProvider} embeddings call failed:`, e);
            try {
                dbService.addModelPerformance(
                    activeModel,
                    activeProvider,
                    'embedding',
                    0,
                    1,
                    estimatedTokens,
                    Date.now() - startTime,
                    estimatedTokens,
                    0
                );
            } catch (perfErr) {
                console.error(`[EmbeddingService] Failed to log ${activeProvider} embedding performance failure:`, perfErr);
            }
        }

        console.warn('[EmbeddingService] No compatible API key set or embedding calls failed. Returning zero vector (semantic search unavailable).');
        return new Float32Array(dim);
    }

    /**
     * Pads or truncates an embedding array to the target dimension.
     */
    static normalizeToDim(embedding: number[], targetDim: number): Float32Array {
        if (embedding.length === targetDim) return new Float32Array(embedding);
        const result = new Float32Array(targetDim);
        const copyLen = Math.min(embedding.length, targetDim);
        for (let i = 0; i < copyLen; i++) {
            result[i] = embedding[i];
        }
        return result;
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
