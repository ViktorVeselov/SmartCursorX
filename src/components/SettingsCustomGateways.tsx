const getIpc = () => window.ipcRenderer;

interface SettingsCustomGatewaysProps {
    showAddCustomProvider: boolean;
    setShowAddCustomProvider: (v: boolean) => void;
    customProviderId: string;
    setCustomProviderId: (v: string) => void;
    customProviderName: string;
    setCustomProviderName: (v: string) => void;
    customProviderBaseUrl: string;
    setCustomProviderBaseUrl: (v: string) => void;
    customProviderApiKey: string;
    setCustomProviderApiKey: (v: string) => void;
    customProviderIsLocal: boolean;
    setCustomProviderIsLocal: (v: boolean) => void;
    customProviders: Record<string, unknown>[];
    setCustomProviders: (v: Record<string, unknown>[]) => void;
    modelProvider: string;
    setModelProvider: (v: string) => void;
}

export function SettingsCustomGateways(props: SettingsCustomGatewaysProps) {
    const {
        showAddCustomProvider, setShowAddCustomProvider,
        customProviderId, setCustomProviderId,
        customProviderName, setCustomProviderName,
        customProviderBaseUrl, setCustomProviderBaseUrl,
        customProviderApiKey, setCustomProviderApiKey,
        customProviderIsLocal, setCustomProviderIsLocal,
        customProviders, setCustomProviders,
        modelProvider, setModelProvider,
    } = props;

    return (
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="codicon codicon-circuit-board" style={{ color: 'var(--accent-primary)' }} />
                    Custom API Gateways
                </h3>
                <button
                    onClick={() => setShowAddCustomProvider(!showAddCustomProvider)}
                    style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: 'var(--radius-md)', fontSize: 10, fontWeight: 500, cursor: 'pointer' }}
                >
                    {showAddCustomProvider ? 'Cancel' : '+ Add Gateway'}
                </button>
            </div>

            {showAddCustomProvider && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 8 }}>
                        <input
                            type="text"
                            value={customProviderId}
                            onChange={e => setCustomProviderId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                            placeholder="e.g. openrouter"
                            style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                        />
                        <input
                            type="text"
                            value={customProviderName}
                            onChange={e => setCustomProviderName(e.target.value)}
                            placeholder="OpenRouter Gateway"
                            style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                        />
                    </div>
                    <input
                        type="text"
                        value={customProviderBaseUrl}
                        onChange={e => setCustomProviderBaseUrl(e.target.value)}
                        placeholder="https://openrouter.ai/api/v1"
                        style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            type="password"
                            value={customProviderApiKey}
                            onChange={e => setCustomProviderApiKey(e.target.value)}
                            placeholder="Bearer Key (Optional)"
                            style={{ flex: 1, padding: '5px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                        />
                        <button
                            onClick={async () => {
                                if (!customProviderId.trim() || !customProviderName.trim() || !customProviderBaseUrl.trim()) {
                                    alert('Please fill in ID, Name, and Base URL.');
                                    return;
                                }
                                await getIpc().invoke('ai:add-custom-provider', customProviderId.trim(), customProviderName.trim(), customProviderBaseUrl.trim(), customProviderApiKey.trim() || undefined, customProviderIsLocal);
                                setCustomProviderId('');
                                setCustomProviderName('');
                                setCustomProviderBaseUrl('');
                                setCustomProviderApiKey('');
                                setCustomProviderIsLocal(false);
                                setShowAddCustomProvider(false);
                                const list = await getIpc().invoke('ai:get-custom-providers');
                                setCustomProviders(list || []);
                                setModelProvider(customProviderId.trim());
                            }}
                            style={{ padding: '5px 12px', background: 'var(--accent-primary)', border: 'none', color: '#fff', borderRadius: 'var(--radius-md)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                        >
                            Save
                        </button>
                    </div>
                </div>
            )}

            {customProviders.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 100, overflowY: 'auto', paddingRight: 4 }}>
                    {customProviders.map((p: Record<string, unknown>) => {
                        const id = p.id as string;
                        const name = p.name as string;
                        return (
                            <div
                                key={id}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '6px 10px',
                                    fontSize: 11
                                }}
                            >
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, paddingRight: 8 }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
                                    <span style={{ fontSize: 9, color: 'var(--text-secondary)', marginLeft: 6 }}>({id})</span>
                                </div>
                                <span
                                    onClick={async () => {
                                        if (confirm(`Delete ${name}?`)) {
                                            await getIpc().invoke('ai:delete-custom-provider', id);
                                            const list = await getIpc().invoke('ai:get-custom-providers');
                                            setCustomProviders(list || []);
                                            if (modelProvider === p.id) {
                                                setModelProvider('openai');
                                            }
                                        }
                                    }}
                                    style={{ color: '#ef4444', fontSize: 11, cursor: 'pointer', fontWeight: 'bold', padding: '2px 4px' }}
                                    title="Delete Gateway"
                                >
                                    ✕
                                </span>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    No custom API gateways configured.
                </div>
            )}
        </div>
    );
}