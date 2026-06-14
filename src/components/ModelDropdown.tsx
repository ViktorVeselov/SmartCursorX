const canModelThink = (modelName: string) =>
    modelName.startsWith('o1-') || modelName.startsWith('o3-') ||
    modelName.includes('deepseek-r1') || modelName.includes('reasoner') ||
    modelName.includes('gemini') || modelName.includes('claude');

const ProviderBadge = ({ providerId }: { providerId: string }) => {
    if (!providerId) return null;
    return (
        <span style={{
            fontSize: '9px',
            fontWeight: 400,
            color: 'var(--text-secondary)',
            opacity: 0.6,
            background: 'var(--bg-hover)',
            padding: '1px 4px',
            borderRadius: '3px',
            border: '1px solid var(--border-subtle)',
            textTransform: 'uppercase'
        }}>
            {providerId}
        </span>
    );
};

export interface ModelDropdownProps {
    showModelDropdown: boolean;
    onSetShowModelDropdown: (v: boolean) => void;
    inlineModelInput: string;
    onSetInlineModelInput: (v: string) => void;
    availableModels: string[];
    activeModel: string;
    onSelectModel: (modelName: string, providerId: string) => void;
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
    activeModel,
    onSelectModel,
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
                <span style={{ fontWeight: 600, color: activeModel ? 'var(--text-primary)' : '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {activeModel ? (
                        <>
                            <span>{activeModel}</span>
                            <ProviderBadge providerId={activeProvider} />
                        </>
                    ) : 'NO MODEL ACTIVE'}
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

                                    const dbModels = await window.ipcRenderer.invoke('ai:get-custom-models');
                                    onSetCustomModels(dbModels || []);
                                    const chosenNames = (dbModels as Record<string, unknown>[]).map((cm: Record<string, unknown>) => cm.model_name as string);
                                    if (chosenNames.length > 0) {
                                        onSetAvailableModels(chosenNames);
                                    }
                                    onSelectModel(name, activeProvider);
                                    onSetShowModelDropdown(false);
                                }
                            }}
                        />
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 180 }}>
                        {customModels.length === 0 ? (
                            <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                <span className="codicon codicon-warning" style={{ fontSize: 16, color: '#f59e0b' }} />
                                <span>No active models added.</span>
                                <span style={{ fontSize: '9px', opacity: 0.8 }}>Use the register input below or settings to add one!</span>
                            </div>
                        ) : (
                            customModels
                                .filter(cm => (cm.model_name as string).toLowerCase().includes(inlineModelInput.toLowerCase()))
                                .map(cm => {
                                    const m = cm.model_name as string;
                                    const providerId = cm.provider_id as string;
                                    const isSelected = activeModel === m && activeProvider === providerId;

                                    return (
                                        <div
                                            key={`${providerId}:${m}`}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '5px 8px',
                                                borderRadius: 'var(--radius-sm)',
                                                background: isSelected ? 'var(--bg-active)' : 'transparent',
                                                cursor: 'pointer',
                                                transition: 'var(--transition-smooth)'
                                            }}
                                            onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                            onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <div
                                                onClick={() => {
                                                    onSelectModel(m, providerId);
                                                    onSetShowModelDropdown(false);
                                                }}
                                                style={{
                                                    flex: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    overflow: 'hidden',
                                                    textAlign: 'left'
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: 'var(--font-xs)',
                                                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    {m}
                                                </span>
                                                <ProviderBadge providerId={providerId} />
                                            </div>

                                            {canModelThink(m) && (
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        const newEnabled = isSelected ? executionMode !== 'think' : !((cm as Record<string, unknown>).has_thinking === 1);
                                                        await window.ipcRenderer.invoke('ai:toggle-model-thinking', providerId, m, newEnabled);
                                                        
                                                        const dbModels = (await window.ipcRenderer.invoke('ai:get-custom-models')) as Record<string, unknown>[];
                                                        onSetCustomModels(dbModels || []);
                                                        if (isSelected) {
                                                            onSetExecutionMode(newEnabled ? 'think' : 'fast');
                                                        }
                                                    }}
                                                    title={isSelected ? (executionMode === 'think' ? 'Disable Reasoning/Thinking' : 'Enable Reasoning/Thinking') : 'Toggle Reasoning/Thinking'}
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
                                                        background: (isSelected ? executionMode === 'think' : (cm.has_thinking === 1)) ? '#a78bfa' : 'rgba(255,255,255,0.15)',
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
                                                            left: (isSelected ? executionMode === 'think' : (cm.has_thinking === 1)) ? 11 : 2,
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
