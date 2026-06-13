interface SettingsLiteLLMConfigProps {
    enableLiteLLMProxy: boolean;
    setEnableLiteLLMProxy: (v: boolean) => void;
    liteLLMConfigPath: string;
    setLiteLLMConfigPath: (v: string) => void;
    liteLLMModel: string;
    setLiteLLMModel: (v: string) => void;
    liteLLMPort: number;
    setLiteLLMPort: (v: number) => void;
    isProxyRunning: boolean;
}

export function SettingsLiteLLMConfig(props: SettingsLiteLLMConfigProps) {
    const {
        enableLiteLLMProxy, setEnableLiteLLMProxy,
        liteLLMConfigPath, setLiteLLMConfigPath,
        liteLLMModel, setLiteLLMModel,
        liteLLMPort, setLiteLLMPort,
        isProxyRunning,
    } = props;

    return (
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="codicon codicon-server-process" style={{ color: 'var(--accent-primary)' }} />
                    LiteLLM Local Orchestrator
                </h4>
                <span style={{ fontSize: 9, color: isProxyRunning ? '#4ade80' : 'var(--text-secondary)', background: isProxyRunning ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                    {isProxyRunning ? 'Running' : 'Stopped'}
                </span>
            </div>

            <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={enableLiteLLMProxy}
                        onChange={e => setEnableLiteLLMProxy(e.target.checked)}
                    />
                    <span style={{ fontSize: 12, fontWeight: 500 }}>Run local LiteLLM Proxy automatically</span>
                </label>
            </div>

            {enableLiteLLMProxy && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 8 }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 4, fontSize: 9, color: 'var(--text-secondary)' }}>Config File Path</label>
                            <input
                                type="text"
                                value={liteLLMConfigPath}
                                onChange={e => setLiteLLMConfigPath(e.target.value)}
                                placeholder="c:\path\to\config.yaml"
                                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 4, fontSize: 9, color: 'var(--text-secondary)' }}>Fallback Model</label>
                            <input
                                type="text"
                                value={liteLLMModel}
                                onChange={e => setLiteLLMModel(e.target.value)}
                                placeholder="gpt-4o"
                                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                            />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: 9, color: 'var(--text-secondary)' }}>Local Proxy Port</label>
                        <input
                            type="number"
                            value={liteLLMPort}
                            onChange={e => setLiteLLMPort(Number(e.target.value))}
                            placeholder="4000"
                            style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
