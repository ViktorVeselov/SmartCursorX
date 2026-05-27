

interface StatusBarProps {
    vimEnabled: boolean;
}

export function StatusBar({ vimEnabled }: StatusBarProps) {
    return (
        <footer className="status-bar">
            <span>TypeScript</span>
            <span>UTF-8</span>
            <span>{vimEnabled ? 'VIM' : 'INSERT'}</span>
            <span className="status-right">SmartCursorX v0.1.0</span>
        </footer>
    );
}
