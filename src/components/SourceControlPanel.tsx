import { useState, useEffect } from 'react';
import { VersionsPanel } from './VersionsPanel';

interface SourceControlPanelProps {
    rootPath: string;
}

interface GitFile {
    code: string;
    file: string;
}

export function SourceControlPanel({ rootPath }: SourceControlPanelProps) {
    const [activeTab, setActiveTab] = useState<'git' | 'local'>('git');
    const [branch, setBranch] = useState('');
    const [changes, setChanges] = useState<GitFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [diffContent, setDiffContent] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (activeTab === 'git') {
            loadGitInfo();
        }
    }, [activeTab, rootPath]);

    const loadGitInfo = async () => {
        setRefreshing(true);
        try {
            const b = await window.ipcRenderer.invoke('git-branch', rootPath);
            setBranch(b || 'Not a git repo');

            const status = await window.ipcRenderer.invoke('git-status', rootPath);
            setChanges(status || []);
        } catch (e) {
            console.error(e);
        } finally {
            setRefreshing(false);
        }
    };

    const handleFileClick = async (file: string) => {
        setSelectedFile(file);
        try {
            // Get diff
            const diff = await window.ipcRenderer.invoke('git-diff', rootPath, file);
            setDiffContent(diff || 'No changes or binary file.');
        } catch (e) {
            setDiffContent('Error loading diff');
        }
    };

    return (
        <div className="source-control-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="sc-header" style={{
                display: 'flex',
                padding: '6px 12px',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-secondary)',
                gap: 6
            }}>
                <button
                    style={{
                        flex: 1,
                        padding: '6px 8px',
                        background: activeTab === 'git' ? 'var(--bg-active)' : 'transparent',
                        color: activeTab === 'git' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'git' ? 600 : 500,
                        fontSize: 11,
                        transition: 'var(--transition-smooth)'
                    }}
                    onMouseOver={(e) => { if(activeTab !== 'git') e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseOut={(e) => { if(activeTab !== 'git') e.currentTarget.style.background = 'transparent'; }}
                    onClick={() => setActiveTab('git')}
                >
                    Git
                </button>
                <button
                    style={{
                        flex: 1,
                        padding: '6px 8px',
                        background: activeTab === 'local' ? 'var(--bg-active)' : 'transparent',
                        color: activeTab === 'local' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'local' ? 600 : 500,
                        fontSize: 11,
                        transition: 'var(--transition-smooth)'
                    }}
                    onMouseOver={(e) => { if(activeTab !== 'local') e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseOut={(e) => { if(activeTab !== 'local') e.currentTarget.style.background = 'transparent'; }}
                    onClick={() => setActiveTab('local')}
                >
                    Local Snapshots
                </button>
            </div>

            <div className="sc-content" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {activeTab === 'local' ? (
                    <VersionsPanel rootPath={rootPath} />
                ) : (
                    <div className="git-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
                        <div className="git-header" style={{ padding: '14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                                    <span className="codicon codicon-git-branch" style={{ color: 'var(--accent-primary)', fontSize: 14 }} />
                                    <span style={{ fontWeight: 600, fontSize: 12, letterSpacing: '0.2px' }}>{branch}</span>
                                </div>
                                <button onClick={loadGitInfo} className="icon-btn" title="Refresh">
                                    <span className={`codicon codicon-refresh ${refreshing ? 'codicon-modifier-spin' : ''}`} style={{ fontSize: 13 }} />
                                </button>
                            </div>

                            {/* Commit input placeholder */}
                            <div style={{ display: 'flex', gap: 6 }}>
                                <input
                                    placeholder="Message (Ctrl+Enter)"
                                    style={{
                                        flex: 1,
                                        padding: '6px 10px',
                                        background: 'var(--bg-input)',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: 'var(--radius-sm)',
                                        color: 'var(--text-primary)',
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
                                <button style={{
                                    padding: '6px 12px',
                                    background: 'var(--accent-primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    fontWeight: 500,
                                    transition: 'var(--transition-smooth)'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background = 'var(--accent-hover)';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background = 'var(--accent-primary)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                                onMouseDown={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >Commit</button>
                            </div>
                        </div>

                        <div className="git-changes" style={{ flex: 1, overflowY: 'auto' }}>
                            <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                Changes ({changes.length})
                            </div>
                            {changes.map(c => (
                                <div
                                    key={c.file}
                                    className={`file-item ${selectedFile === c.file ? 'active' : ''}`}
                                    onClick={() => handleFileClick(c.file)}
                                    style={{
                                        padding: '4px 12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        gap: 6,
                                        alignItems: 'center',
                                        background: selectedFile === c.file ? 'var(--bg-tertiary)' : 'transparent'
                                    }}
                                >
                                    <span
                                        style={{
                                            color: c.code.includes('M') ? '#e2c08d' : c.code.includes('A') ? '#73c991' : c.code.includes('D') ? '#f14c4c' : 'var(--text-secondary)',
                                            fontFamily: 'monospace',
                                            fontSize: 11,
                                            width: 16
                                        }}
                                    >
                                        {c.code}
                                    </span>
                                    <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {c.file}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {selectedFile && (
                            <div className="diff-preview" style={{
                                height: '40%',
                                borderTop: '1px solid var(--border-color)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                <div style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', fontSize: 11, fontWeight: 600 }}>
                                    Diff: {selectedFile}
                                </div>
                                <div style={{ flex: 1, overflow: 'auto', padding: 8, background: '#1e1e1e', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre' }}>
                                    {diffContent}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
