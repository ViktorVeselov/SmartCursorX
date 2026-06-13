interface SettingsAgentTabProps {
    allowFileRead: boolean;
    setAllowFileRead: (v: boolean) => void;
    autoApproveCommands: boolean;
    setAutoApproveCommands: (v: boolean) => void;
    systemPromptOverride: string;
    setSystemPromptOverride: (v: string) => void;
}

export function SettingsAgentTab({ allowFileRead, setAllowFileRead, autoApproveCommands, setAutoApproveCommands, systemPromptOverride, setSystemPromptOverride }: SettingsAgentTabProps) {
    return (
        <div>
            <h3 style={{ marginTop: 0 }}>Agent Configuration</h3>
            <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={allowFileRead}
                        onChange={e => setAllowFileRead(e.target.checked)}
                    />
                    <span style={{ fontSize: 13 }}>Always allow file read</span>
                </label>
            </div>
            <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={autoApproveCommands}
                        onChange={e => setAutoApproveCommands(e.target.checked)}
                    />
                    <span style={{ fontSize: 13 }}>Auto-approve terminal commands (Dangerous)</span>
                </label>
            </div>
            <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>System Prompt Override</label>
                <textarea
                    rows={6}
                    value={systemPromptOverride}
                    onChange={e => setSystemPromptOverride(e.target.value)}
                    placeholder="You are a helpful coding assistant..."
                    style={{ width: '100%', padding: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', resize: 'vertical' }}
                />
            </div>
        </div>
    );
}
