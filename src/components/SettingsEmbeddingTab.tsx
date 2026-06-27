import { useState, useEffect, useCallback } from 'react';

const getIpc = () => window.ipcRenderer;

const EMBEDDING_PROVIDERS = ['openai', 'gemini', 'ollama', 'local', 'zen', 'openrouter'] as const;

const EMBEDDING_MODELS_BY_PROVIDER: Record<string, string[]> = {
    openai: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
    gemini: ['gemini-embedding-001'],
    ollama: ['nomic-embed-text', 'all-minilm', 'mxbai-embed-large', 'bge-m3', 'snowflake-arctic-embed'],
    local: ['llama', 'bert', 'nomic-embed-text'],
    zen: ['zen-embedding-v1'],
    openrouter: ['openai/text-embedding-3-small', 'openai/text-embedding-3-large'],
};

interface SettingsEmbeddingTabProps {
    embeddingProvider: string;
    setEmbeddingProvider: (v: string) => void;
    embeddingModel: string;
    setEmbeddingModel: (v: string) => void;
    embeddingBaseUrl: string;
    setEmbeddingBaseUrl: (v: string) => void;
    embeddingDimension: number;
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

function resolveDim(model: string): number {
    return KNOWN_EMBEDDING_DIMS[model] || 1536;
}

export function SettingsEmbeddingTab({
    embeddingProvider, setEmbeddingProvider,
    embeddingModel, setEmbeddingModel,
    embeddingBaseUrl, setEmbeddingBaseUrl,
    embeddingDimension,
}: SettingsEmbeddingTabProps) {
    const [testResult, setTestResult] = useState<string | null>(null);
    const [testLoading, setTestLoading] = useState(false);
    const [customModel, setCustomModel] = useState('');

    useEffect(() => {
        setCustomModel('');
        if (!EMBEDDING_MODELS_BY_PROVIDER[embeddingProvider]?.includes(embeddingModel)) {
            setEmbeddingModel(EMBEDDING_MODELS_BY_PROVIDER[embeddingProvider]?.[0] || '');
        }
    }, [embeddingProvider]);

    const handleTest = useCallback(async () => {
        setTestLoading(true);
        setTestResult(null);
        try {
            await getIpc().invoke('embedding:set-config', {
                provider: embeddingProvider,
                model: embeddingModel,
                baseUrl: embeddingBaseUrl,
            });
            setTestResult('Config saved successfully');
        } catch (e: any) {
            setTestResult(`Error: ${e.message || e}`);
        } finally {
            setTestLoading(false);
        }
    }, [embeddingProvider, embeddingModel, embeddingBaseUrl]);

    const currentModels = EMBEDDING_MODELS_BY_PROVIDER[embeddingProvider] || [];

    return (
        <div>
            <h3 style={{ marginBottom: 20, fontSize: 'var(--font-lg)', color: 'var(--text-primary)' }}>
                Embedding Model
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Embeddings power semantic search and knowledge retrieval.
                You can use a different model/provider than your chat model.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480 }}>
                <div>
                    <label style={labelStyle}>Provider</label>
                    <select
                        value={embeddingProvider}
                        onChange={e => setEmbeddingProvider(e.target.value)}
                        style={selectStyle}
                    >
                        {EMBEDDING_PROVIDERS.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={labelStyle}>Model</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <select
                            value={currentModels.includes(embeddingModel) ? embeddingModel : '__custom__'}
                            onChange={e => {
                                if (e.target.value === '__custom__') {
                                    setEmbeddingModel(customModel || 'custom-model');
                                } else {
                                    setEmbeddingModel(e.target.value);
                                }
                            }}
                            style={{ ...selectStyle, flex: 1 }}
                        >
                            {currentModels.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                            <option value="__custom__">Custom model...</option>
                        </select>
                        {!currentModels.includes(embeddingModel) && (
                            <input
                                type="text"
                                value={customModel || embeddingModel}
                                onChange={e => {
                                    setCustomModel(e.target.value);
                                    setEmbeddingModel(e.target.value);
                                }}
                                placeholder="Enter model name"
                                style={inputStyle}
                            />
                        )}
                    </div>
                </div>

                {(embeddingProvider === 'local' || embeddingProvider === 'ollama' || embeddingBaseUrl) && (
                    <div>
                        <label style={labelStyle}>Base URL (optional)</label>
                        <input
                            type="text"
                            value={embeddingBaseUrl}
                            onChange={e => setEmbeddingBaseUrl(e.target.value)}
                            placeholder={
                                embeddingProvider === 'local' ? 'http://localhost:8080' :
                                embeddingProvider === 'ollama' ? 'http://localhost:11434' :
                                'https://your-endpoint.com/v1'
                            }
                            style={inputStyle}
                        />
                    </div>
                )}

                <div>
                    <button
                        onClick={handleTest}
                        disabled={testLoading}
                        style={{
                            padding: '6px 16px',
                            background: 'var(--accent-primary)',
                            border: 'none',
                            color: '#fff',
                            borderRadius: 'var(--radius-sm)',
                            cursor: testLoading ? 'not-allowed' : 'pointer',
                            opacity: testLoading ? 0.7 : 1,
                        }}
                    >
                        {testLoading ? 'Saving...' : 'Save Embedding Config'}
                    </button>
                </div>

                {testResult && (
                    <div style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        background: testResult.startsWith('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                        color: testResult.startsWith('Error') ? '#ef4444' : '#22c55e',
                        fontSize: 13,
                    }}>
                        {testResult}
                    </div>
                )}

                <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    Vector dimension: <strong>{embeddingDimension || resolveDim(embeddingModel)}</strong>
                    {embeddingDimension > 0 && embeddingDimension !== resolveDim(embeddingModel) && (
                        <span style={{ marginLeft: 8, color: '#f59e0b' }}>
                            (detected: {resolveDim(embeddingModel)} from model name)
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: 6,
};

const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 13,
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 13,
};
