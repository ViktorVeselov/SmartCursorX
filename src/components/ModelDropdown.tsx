const canModelThink = (modelName: string) =>
    modelName.startsWith('o1-') || modelName.startsWith('o3-') ||
    modelName.includes('deepseek-r1') || modelName.includes('reasoner') ||
    modelName.includes('gemini') || modelName.includes('claude');

export interface ModelDropdownProps {
    showModelDropdown: boolean;
    onSetShowModelDropdown: (v: boolean) => void;
    inlineModelInput: string;
    onSetInlineModelInput: (v: string) => void;
    availableModels: string[];
    activeModel: string;
    onSetActiveModel: (v: string) => void;
    customModels: Record<string, unknown>[];
    onSetCustomModels: (v: Record<string, unknown>[]) => void;
    onSetAvailableModels: (v: string[]) => void;
    activeProvider: string;
    executionMode: 'fast' | 'think';
    onSetExecutionMode: (v: 'fast' | 'think') => void;
}

export const ModelDropdown = ({
    showModelDropdown,
    onSetShowModelDropdown,
    inlineModelInput,
    onSetInlineModelInput,
    availableModels,
    activeModel,
    onSetActiveModel,
    customModels,
    onSetCustomModels,
    onSetAvailableModels,
    activeProvider,
    executionMode,
    onSetExecutionMode,
}: ModelDropdownProps) => {
    return (
        <div style={{ position: 'relative' }}>
            <div style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '8px',
                background: 'var(--bg-hover)',
                transition: 'var(--transition-smooth)',
                userSelect: 'none'
            }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-active)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onClick={() => onSetShowModelDropdown(!showModelDropdown)}>
                <span style={{ fontWeight: 600, color: activeModel ? 'var(--text-primary)' : '#f59e0b' }}>
                    {activeModel || 'NO MODEL ACTIVE'}
                </span>
                <span className="codicon codicon-chevron-down" style={{ fontSize: 10, opacity: 0.8 }} />
            </div>
            {showModelDropdown && (
                <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    background: 'var(--bg-glass)',
                    backdropFilter: 'var(--glass-blur)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 1100,
                    minWidth: 200,
                    maxHeight: 280,
                    display: 'flex',
                    flexDirection: 'column',
                    marginBottom: 6,
                    padding: 4
                }}>
                    <div style={{ padding: '4px 6px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
                        <input
                            type="text"
                            placeholder="Search or add model..."
                            value={inlineModelInput}
                            onChange={e => onSetInlineModelInput(e.target.value)}
                            style={{ width: '100%', background: 'var(--bg-input)', border: 'none', color: 'var(--text-primary)', padding: '5px 8px', borderRadius: '4px', fontSize: '10px', outline: 'none', boxSizing: 'border-box' }}
                            onKeyDown={async (e) => {
                                if (e.key === 'Enter' && inlineModelInput.trim()) {
                                    e.preventDefault();
                                    const name = inlineModelInput.trim();
                                    const hasTh = name.startsWith('o1') || name.startsWith('o3') || name.includes('r1') || name.includes('reasoner');
                                    await window.ipcRenderer.invoke('ai:add-custom-model', activeProvider, name, hasTh);
                                    onSetInlineModelInput('');

                                    const dbModels = await window.ipcRenderer.invoke('ai:get-custom-models', activeProvider);
                                    onSetCustomModels(dbModels || []);
                                    const chosenNames = dbModels.map((cm: Record<string, unknown>) => cm.model_name as string);
                                    if (chosenNames.length > 0) {
                                        onSetAvailableModels(chosenNames);
                                    }
                                    onSetActiveModel(name);
                                    onSetShowModelDropdown(false);
                                }
                            }}
                        />
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 180 }}>
                        {availableModels.length === 0 ? (
                            <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                <span className="codicon codicon-warning" style={{ fontSize: 16, color: '#f59e0b' }} />
                                <span>No active models added.</span>
                                <span style={{ fontSize: '9px', opacity: 0.8 }}>Use the register input below or settings to add one!</span>
                            </div>
                        ) : (
                            availableModels
                                .filter(m => m.toLowerCase().includes(inlineModelInput.toLowerCase()))
                                .map(m => {
                                    const customMatch = customModels.find(cm => (cm as Record<string, unknown>).model_name === m);

                                    return (
                                        <div
                                            key={m}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '5px 8px',
                                                borderRadius: 'var(--radius-sm)',
                                                background: activeModel === m ? 'var(--bg-active)' : 'transparent',
                                                cursor: 'pointer',
                                                transition: 'var(--transition-smooth)'
                                            }}
                                            onMouseOver={(e) => { if (activeModel !== m) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                            onMouseOut={(e) => { if (activeModel !== m) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <span
                                                onClick={() => {
                                                    onSetActiveModel(m);
                                                    onSetShowModelDropdown(false);
                                                }}
                                                style={{
                                                    flex: 1,
                                                    fontSize: 'var(--font-xs)',
                                                    color: activeModel === m ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                    textAlign: 'left',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {m}
                                            </span>

                                            {canModelThink(m) && (
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                    const matchingModel = customModels.find(cm => (cm as Record<string, unknown>).model_name === m);
                                                    const newEnabled = m === activeModel ? executionMode !== 'think' : !((matchingModel as Record<string, unknown>)?.has_thinking === 1);
                                                        if (customMatch) {
                                                            await window.ipcRenderer.invoke('ai:toggle-model-thinking', activeProvider, m, newEnabled);
                                                        } else {
                                                            await window.ipcRenderer.invoke('ai:add-custom-model', activeProvider, m, newEnabled);
                                                        }
                                                        const dbModels = (await window.ipcRenderer.invoke('ai:get-custom-models', activeProvider)) as Record<string, unknown>[];
                                                        onSetCustomModels(dbModels || []);
                                                        if (m === activeModel) {
                                                            onSetExecutionMode(newEnabled ? 'think' : 'fast');
                                                        }
                                                    }}
                                                    title={m === activeModel ? (executionMode === 'think' ? 'Disable Reasoning/Thinking' : 'Enable Reasoning/Thinking') : 'Toggle Reasoning/Thinking'}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        padding: '2px',
                                                        outline: 'none',
                                                        transition: 'var(--transition-smooth)'
                                                    }}
                                                >
                                                    <div style={{
                                                        width: 20,
                                                        height: 11,
                                                        borderRadius: 5.5,
                                                        background: (m === activeModel ? executionMode === 'think' : (customMatch?.has_thinking === 1)) ? '#a78bfa' : 'rgba(255,255,255,0.15)',
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
                                                            left: (m === activeModel ? executionMode === 'think' : (customMatch?.has_thinking === 1)) ? 11 : 2,
                                                            transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                                        }} />
                                                    </div>
                                                </button>
                                            )}
                                        </div>
                                    );
                                }))}
                    </div>
                </div>
            )}
        </div>
    );
};
