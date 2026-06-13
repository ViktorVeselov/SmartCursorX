import { CredentialBadge } from './CredentialBadge';

export interface ChatSettingsPanelProps {
    tempApiKey: string;
    setTempApiKey: (key: string) => void;
    tempGithubToken: string;
    setTempGithubToken: (token: string) => void;
    credentialStatuses: Record<string, { hasKey: boolean; encryptionAvailable: boolean }>;
    fetchCredentialStatuses: () => Promise<void>;
}

export const ChatSettingsPanel = ({
    tempApiKey,
    setTempApiKey,
    tempGithubToken,
    setTempGithubToken,
    credentialStatuses,
    fetchCredentialStatuses,
}: ChatSettingsPanelProps) => {
    return (
        <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>OpenAI API Key</label>
                    <CredentialBadge status={credentialStatuses['openai']} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        type="password"
                        placeholder="sk-..."
                        value={tempApiKey}
                        onChange={e => setTempApiKey(e.target.value)}
                        style={{ flex: 1, padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                    />
                    <button
                        onClick={async () => {
                            try {
                                    await window.ipcRenderer.invoke('set-api-key', tempApiKey);
                                    setTempApiKey('');
                                    await fetchCredentialStatuses();
                                } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
                        }}
                        style={{ padding: '6px 12px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >Save</button>
                </div>
            </div>
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>GitHub Token (PAT)</label>
                    <CredentialBadge status={credentialStatuses['github']} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        type="password"
                        placeholder="ghp_..."
                        value={tempGithubToken}
                        onChange={e => setTempGithubToken(e.target.value)}
                        style={{ flex: 1, padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                    />
                    <button
                        onClick={async () => {
                            try {
                                    await window.ipcRenderer.invoke('set-github-token', tempGithubToken);
                                    setTempGithubToken('');
                                    await fetchCredentialStatuses();
                                } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
                        }}
                        style={{ padding: '6px 12px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >Save</button>
                </div>
            </div>
        </div>
    );
};
