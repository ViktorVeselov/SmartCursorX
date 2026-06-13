const getIpc = () => window.ipcRenderer;

import { DollarIcon } from './DollarIcon';

interface SettingsModelRegistrationProps {
    modelProvider: string;
    setModelProvider: (v: string) => void;
    setAvailableModels: (v: string[]) => void;
    customModelsList: Record<string, unknown>[];
    setCustomModelsList: (v: Record<string, unknown>[]) => void;
}

export function SettingsModelRegistration(props: SettingsModelRegistrationProps) {
    const {
        modelProvider,
        setModelProvider,
        setAvailableModels,
        customModelsList,
        setCustomModelsList,
    } = props;

    return (
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="codicon codicon-symbol-method" style={{ color: 'var(--accent-primary)' }} />
                    Custom Model Registration
                </h3>
            </div>

            <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)' }}>Provider</label>
                <select
                    value={modelProvider}
                    onChange={e => setModelProvider(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', outline: 'none', fontSize: 12 }}
                >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google</option>
                    <option value="ollama">Ollama (Local)</option>
                    <option value="zen">OpenCode Zen — Free Models</option>
                    {customModelsList.length > 0 && (
                        <option disabled style={{ color: 'var(--text-secondary)', fontSize: 10 }}>───────────────────</option>
                    )}
                    {customModelsList.map((m: Record<string, unknown>) => {
                        const modelName = m.model_name as string;
                        return (
                            <option key={modelName} value={modelName}>{modelName}</option>
                        );
                    })}
                </select>
            </div>

            {customModelsList.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 95, overflowY: 'auto', padding: 2 }}>
                    {customModelsList.map((m: Record<string, unknown>) => {
                        const modelName = m.model_name as string;
                        return (
                            <div
                                key={modelName}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)',
                                    padding: '4px 10px',
                                    borderRadius: 14,
                                    fontSize: 11
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {modelName}
                                    {(m.has_thinking as number) === 1 && (
                                        <DollarIcon active={true} width={10} height={10} marginRight={2} />
                                    )}
                                </span>
                                <span
                                    onClick={async () => {
                                        await getIpc().invoke('ai:delete-custom-model', modelProvider, modelName);
                                        const list = await getIpc().invoke('ai:get-models', modelProvider);
                                        setAvailableModels(list || []);
                                        const dbModels = await getIpc().invoke('ai:get-custom-models', modelProvider);
                                        setCustomModelsList(dbModels || []);
                                    }}
                                    style={{
                                        cursor: 'pointer',
                                        color: '#ef4444',
                                        fontWeight: 'bold',
                                        marginLeft: 4,
                                        fontSize: 9,
                                        padding: '0 2px'
                                    }}
                                    title="Remove Model"
                                >
                                    ✕
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}