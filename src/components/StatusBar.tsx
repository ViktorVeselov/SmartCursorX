

interface StatusBarProps {
    vimEnabled: boolean;
    runningLocalModel: string | null;
}

export function StatusBar({ vimEnabled, runningLocalModel }: StatusBarProps) {
    return (
        <footer className="status-bar">
            <span>TypeScript</span>
            <span>UTF-8</span>
            <span>{vimEnabled ? 'VIM' : 'INSERT'}</span>
            {runningLocalModel && (
                <span style={{ color: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#22c55e',
                        boxShadow: '0 0 6px #22c55e',
                        display: 'inline-block'
                    }} />
                    Local LLM Active: {runningLocalModel}
                </span>
            )}
            <span className="status-right">SmartCursorX v0.1.0</span>
        </footer>
    );
}
