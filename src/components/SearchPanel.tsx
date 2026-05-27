import { useState } from 'react';
import type { SearchMatch } from '../../native';

export function SearchPanel() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchMatch[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async () => {
        if (!query.trim()) return;

        setLoading(true);
        setError('');

        try {
            const rootPath = '.';
            const matches = await window.ipcRenderer.invoke('native-search', {
                pattern: query,
                rootPath,
                ignoreCase: true
            });
            setResults(matches);
        } catch (err) {
            console.error(err);
            setError('Search failed. Is the native module loaded?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="search-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
            <div className="panel-header" style={{ padding: '14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <h3 className="panel-title" style={{ margin: '0 0 6px 0', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Search Workspace</h3>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Search across all project files instantly.
                </div>
            </div>

            <div className="search-box-container" style={{ padding: '14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Search files (Regex supported)..."
                        style={{
                            flex: 1,
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            padding: '6px 10px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 11,
                            outline: 'none',
                            transition: 'var(--transition-smooth)'
                        }}
                        onFocus={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent-primary)';
                            e.currentTarget.style.boxShadow = '0 0 0 1px var(--border-focus)';
                        }}
                        onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-subtle)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    />
                    <button 
                        onClick={handleSearch} 
                        disabled={loading || !query.trim()}
                        style={{
                            background: 'var(--accent-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0 14px',
                            cursor: (loading || !query.trim()) ? 'default' : 'pointer',
                            fontSize: 11,
                            fontWeight: 500,
                            opacity: (loading || !query.trim()) ? 0.5 : 1,
                            transition: 'var(--transition-smooth)'
                        }}
                        onMouseOver={(e) => {
                            if (!loading && query.trim()) {
                                e.currentTarget.style.background = 'var(--accent-hover)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                        }}
                        onMouseOut={(e) => {
                            if (!loading && query.trim()) {
                                e.currentTarget.style.background = 'var(--accent-primary)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }
                        }}
                        onMouseDown={(e) => {
                            if (!loading && query.trim()) e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        {loading ? '...' : 'Search'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="search-error" style={{ padding: '8px 14px', margin: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-sm)', color: '#f87171', fontSize: 11 }}>
                    {error}
                </div>
            )}

            <div className="search-results" style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
                {results.map((match, i) => (
                    <div key={`${match.filePath}-${i}`} className="search-result-item" style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background-color 0.15s ease'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <div className="file-path" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                            <span className="codicon codicon-file" style={{ opacity: 0.7 }} />
                            {match.filePath}
                        </div>
                        <pre className="match-line" style={{ margin: 0, padding: '6px 8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            <span className="line-num" style={{ color: 'var(--accent-primary)', marginRight: 6, fontWeight: 'bold' }}>{match.lineNumber}:</span>
                            {match.lineContent}
                        </pre>
                    </div>
                ))}
                {results.length === 0 && !loading && !error && query && (
                    <div className="no-results" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                        <span className="codicon codicon-search" style={{ fontSize: 24, display: 'block', marginBottom: 8, opacity: 0.5 }} />
                        No results found for "{query}"
                    </div>
                )}
            </div>
        </div>
    );
}
