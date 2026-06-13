const getIpc = () => window.ipcRenderer;

interface SettingsAvailableModelsProps {
    availableModels: string[];
    modelSearchQuery: string;
    setModelSearchQuery: (v: string) => void;
    modelProvider: string;
    customModelsList: Record<string, unknown>[];
    setCustomModelsList: (v: Record<string, unknown>[]) => void;
    setAvailableModels: (v: string[]) => void;
}

export function SettingsAvailableModels(props: SettingsAvailableModelsProps) {
    const {
        availableModels,
        modelSearchQuery, setModelSearchQuery,
        modelProvider,
        customModelsList, setCustomModelsList,
        setAvailableModels,
    } = props;

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="codicon codicon-list-selection" style={{ color: 'var(--accent-primary)' }} />
                    Available Models ({availableModels.length})
                </h4>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Search discovered models. Enable reasoning switches, check-mark to activate in chat list!
            </div>

            <input
                type="text"
                placeholder="Filter available models..."
                value={modelSearchQuery}
                onChange={e => setModelSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, outline: 'none', boxSizing: 'border-box' }}
            />

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4, maxHeight: 220 }}>
                {availableModels
                    .filter(m => m.toLowerCase().includes(modelSearchQuery.toLowerCase()))
                    .map(m => {
                        const customMatch = customModelsList.find((cm: Record<string, unknown>) => cm.model_name === m);
                        const isActive = !!customMatch;
                        const hasThinking = customMatch ? customMatch.has_thinking === 1 : (m.startsWith('o1-') || m.startsWith('o3-') || m.includes('deepseek-r1') || m.includes('reasoner'));

                        return (
                            <div
                                key={m}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 10px',
                                    background: isActive ? 'var(--bg-active)' : 'rgba(255,255,255,0.01)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: 11,
                                    transition: 'var(--transition-smooth)'
                                }}
                            >
                                <span style={{ fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, paddingRight: 8, textAlign: 'left' }} title={m}>
                                    {m}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {/* Brain / Thinking Toggle Button */}
                                    <button
                                        onClick={async () => {
                                            if (isActive) {
                                                await getIpc().invoke('ai:toggle-model-thinking', modelProvider, m, !hasThinking);
                                            } else {
                                                await getIpc().invoke('ai:add-custom-model', modelProvider, m, !hasThinking);
                                            }
                                            const list = await getIpc().invoke('ai:get-models', modelProvider);
                                            setAvailableModels(list || []);
                                            const dbModels = await getIpc().invoke('ai:get-custom-models', modelProvider);
                                            setCustomModelsList(dbModels || []);
                                        }}
                                        title={hasThinking ? 'Disable Reasoning/Thinking for Model' : 'Enable Reasoning/Thinking for Model'}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '2px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            outline: 'none',
                                            transition: 'var(--transition-smooth)'
                                        }}
                                    >
                                        {/* Miniature Sliding Switch for Model Capability */}
                                        <div style={{
                                            width: 20,
                                            height: 11,
                                            borderRadius: 5.5,
                                            background: hasThinking ? '#a78bfa' : 'rgba(255,255,255,0.15)',
                                            position: 'relative',
                                            transition: 'background 0.2s ease'
                                        }}>
                                            <div style={{
                                                width: 7,
                                                height: 7,
                                                borderRadius: '50%',
                                                background: '#ffffff',
                                                position: 'absolute',
                                                top: 2,
                                                left: hasThinking ? 11 : 2,
                                                transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }} />
                                        </div>
                                    </button>

                                    {/* Active Checkbox / Register Toggle Button */}
                                    <button
                                        onClick={async () => {
                                            if (isActive) {
                                                await getIpc().invoke('ai:delete-custom-model', modelProvider, m);
                                            } else {
                                                await getIpc().invoke('ai:add-custom-model', modelProvider, m, hasThinking);
                                            }
                                            const list = await getIpc().invoke('ai:get-models', modelProvider);
                                            setAvailableModels(list || []);
                                            const dbModels = await getIpc().invoke('ai:get-custom-models', modelProvider);
                                            setCustomModelsList(dbModels || []);
                                        }}
                                        title={isActive ? 'Deactivate Model' : 'Activate Model'}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '2px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            color: isActive ? '#10b981' : 'var(--text-secondary)',
                                            transition: 'var(--transition-smooth)'
                                        }}
                                    >
                                        <span className={`codicon ${isActive ? 'codicon-checkbox-active' : 'codicon-checkbox'}`} style={{ fontSize: 13 }} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
            </div>
        </div>
    );
}
