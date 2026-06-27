// Test: Embedding dimension resolution and normalization
// Duplicates static logic from EmbeddingService to avoid Electron/DB deps.

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: ${message}`);
        failed++;
    }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
    const pass = actual === expected;
    if (pass) {
        console.log(`  ✅ PASS: ${message}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        failed++;
    }
}

// --- Duplicated logic under test ---

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

function resolveEmbeddingDimension(modelName: string): number {
    if (KNOWN_EMBEDDING_DIMS[modelName]) return KNOWN_EMBEDDING_DIMS[modelName];
    const baseName = modelName.split(':')[0].split('/').pop() || modelName;
    const lowerBase = baseName.toLowerCase();
    const matched = Object.keys(KNOWN_EMBEDDING_DIMS).find(k => lowerBase.startsWith(k.toLowerCase()));
    return matched ? KNOWN_EMBEDDING_DIMS[matched] : DEFAULT_EMBEDDING_DIM;
}

function normalizeToDim(embedding: number[], targetDim: number): Float32Array {
    if (embedding.length === targetDim) return new Float32Array(embedding);
    const result = new Float32Array(targetDim);
    const copyLen = Math.min(embedding.length, targetDim);
    for (let i = 0; i < copyLen; i++) {
        result[i] = embedding[i];
    }
    return result;
}

// --- Tests ---

async function run() {
    console.log('\n--- 1. resolveEmbeddingDimension: exact matches ---');
    assertEqual(resolveEmbeddingDimension('text-embedding-3-small'), 1536, 'text-embedding-3-small → 1536');
    assertEqual(resolveEmbeddingDimension('text-embedding-3-large'), 3072, 'text-embedding-3-large → 3072');
    assertEqual(resolveEmbeddingDimension('text-embedding-ada-002'), 1536, 'text-embedding-ada-002 → 1536');
    assertEqual(resolveEmbeddingDimension('gemini-embedding-001'), 768, 'gemini-embedding-001 → 768');
    assertEqual(resolveEmbeddingDimension('nomic-embed-text'), 768, 'nomic-embed-text → 768');
    assertEqual(resolveEmbeddingDimension('all-minilm'), 384, 'all-minilm → 384');
    assertEqual(resolveEmbeddingDimension('mxbai-embed-large'), 1024, 'mxbai-embed-large → 1024');
    assertEqual(resolveEmbeddingDimension('bge-m3'), 1024, 'bge-m3 → 1024');
    assertEqual(resolveEmbeddingDimension('snowflake-arctic-embed'), 1024, 'snowflake-arctic-embed → 1024');
    assertEqual(resolveEmbeddingDimension('bert'), 768, 'bert → 768');
    assertEqual(resolveEmbeddingDimension('llama'), 4096, 'llama → 4096');

    console.log('\n--- 2. resolveEmbeddingDimension: HuggingFace paths ---');
    assertEqual(resolveEmbeddingDimension('sentence-transformers/all-MiniLM-L6-v2'), 384, 'all-MiniLM path → 384 (prefix match)');
    assertEqual(resolveEmbeddingDimension('nomic-ai/nomic-embed-text-v1.5'), 768, 'nomic-embed-text path → 768 (prefix match)');

    console.log('\n--- 3. resolveEmbeddingDimension: Ollama tags ---');
    assertEqual(resolveEmbeddingDimension('nomic-embed-text:latest'), 768, 'nomic-embed-text:latest → 768 (tag stripped)');
    assertEqual(resolveEmbeddingDimension('mxbai-embed-large:q4_0'), 1024, 'mxbai-embed-large:q4_0 → 1024 (tag stripped)');

    console.log('\n--- 4. resolveEmbeddingDimension: unknown models fallback ---');
    assertEqual(resolveEmbeddingDimension('unknown-model-xyz'), 1536, 'unknown model → 1536 default');
    assertEqual(resolveEmbeddingDimension(''), 1536, 'empty string → 1536 default');

    console.log('\n--- 5. normalizeToDim: same dimension ---');
    const sameResult = normalizeToDim([0.5, 1.5, 2.5], 3);
    assert(sameResult.length === 3, '3-dim input stays 3-dim');
    assertEqual(sameResult[0], 0.5, 'first value unchanged');
    assertEqual(sameResult[2], 2.5, 'last value unchanged');

    console.log('\n--- 6. normalizeToDim: truncation (larger → smaller) ---');
    const truncated = normalizeToDim([0.5, 1.5, 2.5, 3.5, 4.5], 3);
    assert(truncated.length === 3, 'truncated to 3');
    assertEqual(truncated[0], 0.5, 'first value preserved');
    assertEqual(truncated[2], 2.5, 'third value preserved');

    console.log('\n--- 7. normalizeToDim: padding (smaller → larger) ---');
    const padded = normalizeToDim([0.5, 1.5], 5);
    assert(padded.length === 5, 'padded to 5');
    assertEqual(padded[0], 0.5, 'first value preserved');
    assertEqual(padded[1], 1.5, 'second value preserved');
    assertEqual(padded[2], 0, 'third value zero-padded');
    assertEqual(padded[4], 0, 'fifth value zero-padded');

    console.log('\n--- 8. normalizeToDim: edge cases ---');
    const empty = normalizeToDim([], 4);
    assert(empty.length === 4, 'empty input → 4-dim zero vector');
    assertEqual(empty[0], 0, 'all zeros after padding from empty');

    const bigTrunc = normalizeToDim([1, 2, 3, 4, 5, 6, 7, 8], 1);
    assert(bigTrunc.length === 1, 'truncated to 1');
    assertEqual(bigTrunc[0], 1, 'only first value kept');

    console.log('\n--- 9. normalizeToDim: float array input ---');
    const fromFloat32 = new Float32Array([0.5, 1.5, 2.5]);
    const result = normalizeToDim(Array.from(fromFloat32), 3);
    assert(result instanceof Float32Array, 'result is Float32Array');
    assertEqual(result[1], 1.5, 'values preserved from Float32Array input');

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`);
    if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('Test suite error:', err); process.exit(1); });
