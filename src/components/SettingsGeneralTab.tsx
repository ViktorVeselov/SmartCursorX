interface SettingsGeneralTabProps {
    theme: 'light' | 'dark';
    setTheme: (v: 'light' | 'dark') => void;
    fontSize: number;
    setFontSize: (v: number) => void;
}

export function SettingsGeneralTab({ theme, setTheme, fontSize, setFontSize }: SettingsGeneralTabProps) {
    return (
        <div>
            <h3 style={{ marginTop: 0 }}>General</h3>
            <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>Theme</label>
                <select
                    value={theme}
                    onChange={e => setTheme(e.target.value as 'light' | 'dark')}
                    style={{ width: '100%', padding: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                </select>
            </div>
            <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>Font Size</label>
                <input
                    type="number"
                    value={fontSize}
                    onChange={e => setFontSize(Number(e.target.value))}
                    style={{ width: '100%', padding: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                />
            </div>
        </div>
    );
}
