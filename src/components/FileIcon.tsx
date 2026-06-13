export function FileIcon({ filePath }: { filePath?: string }) {
    if (!filePath) return null;
    const ext = filePath.split('.').pop()?.toLowerCase();

    if (ext === 'tsx' || ext === 'jsx') {
        return (
            <svg
                width="12" height="12" viewBox="-11.5 -10.23174 23 20.46348"
                fill="none" stroke="#61dafb" strokeWidth="1.2"
                style={{ marginRight: '6px', flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
            >
                <circle cx="0" cy="0" r="2.05" fill="#61dafb"/>
                <g stroke="#61dafb">
                    <ellipse rx="11" ry="4.2"/>
                    <ellipse rx="11" ry="4.2" transform="rotate(60)"/>
                    <ellipse rx="11" ry="4.2" transform="rotate(120)"/>
                </g>
            </svg>
        );
    }

    if (ext === 'ts') {
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: '#3178c6', color: 'white', fontSize: '8px', fontWeight: 'bold',
                width: '12px', height: '12px', borderRadius: '2px', marginRight: '6px',
                lineHeight: '1', fontFamily: 'monospace', flexShrink: 0, verticalAlign: 'middle'
            }}>TS</span>
        );
    }

    if (ext === 'js') {
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: '#f7df1e', color: 'black', fontSize: '8px', fontWeight: 'bold',
                width: '12px', height: '12px', borderRadius: '2px', marginRight: '6px',
                lineHeight: '1', fontFamily: 'monospace', flexShrink: 0, verticalAlign: 'middle'
            }}>JS</span>
        );
    }

    if (ext === 'css') {
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: '#264de4', color: 'white', fontSize: '7.5px', fontWeight: 'bold',
                width: '12px', height: '12px', borderRadius: '2px', marginRight: '6px',
                lineHeight: '1', fontFamily: 'monospace', flexShrink: 0, verticalAlign: 'middle'
            }}>CSS</span>
        );
    }

    if (ext === 'html') {
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: '#e34f26', color: 'white', fontSize: '7.5px', fontWeight: 'bold',
                width: '12px', height: '12px', borderRadius: '2px', marginRight: '6px',
                lineHeight: '1', fontFamily: 'monospace', flexShrink: 0, verticalAlign: 'middle'
            }}>HTML</span>
        );
    }

    if (ext === 'json') {
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: '#fbc02d', color: 'black', fontSize: '7.5px', fontWeight: 'bold',
                width: '12px', height: '12px', borderRadius: '2px', marginRight: '6px',
                lineHeight: '1', fontFamily: 'monospace', flexShrink: 0, verticalAlign: 'middle'
            }}>{}</span>
        );
    }

    return <span className="codicon codicon-file" style={{
        marginRight: '6px', fontSize: '12px',
        color: 'var(--text-secondary, rgba(255,255,255,0.4))',
        flexShrink: 0, verticalAlign: 'middle'
    }} />;
}
