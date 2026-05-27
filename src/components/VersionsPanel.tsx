import { useState, useEffect } from 'react';

interface Snapshot {
    id: number;
    name: string;
    created_at: string;
}

export function VersionsPanel({ rootPath }: { rootPath: string }) {
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [newName, setNewName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadSnapshots();
    }, []);

    const loadSnapshots = async () => {
        const list = await window.ipcRenderer.invoke('vc-get-snapshots');
        setSnapshots(list);
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setIsCreating(true);
        try {
            await window.ipcRenderer.invoke('vc-create-snapshot', newName, rootPath);
            setNewName('');
            loadSnapshots();
        } catch (e) {
            console.error(e);
            alert('Failed to create snapshot');
        } finally {
            setIsCreating(false);
        }
    };

    const handleRestore = async (id: number) => {
        if (!confirm('Are you sure you want to restore this version? Current files will be overwritten.')) return;
        try {
            const count = await window.ipcRenderer.invoke('vc-restore-snapshot', id);
            alert(`Restored ${count} files.`);
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert('Failed to restore snapshot');
        }
    };

    return (
        <div className="versions-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
            <div className="panel-header" style={{ padding: '14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <h3 className="panel-title" style={{ margin: '0 0 6px 0', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Workspace Snapshots</h3>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Save current state as a version to roll back safely.
                </div>
            </div>

            <div className="create-snapshot" style={{ padding: '14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    <input
                        type="text"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="Version Name (e.g. 'Before Refactor')"
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
                        onClick={handleCreate}
                        disabled={isCreating || !newName.trim()}
                        style={{
                            background: 'var(--accent-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0 12px',
                            cursor: (isCreating || !newName.trim()) ? 'default' : 'pointer',
                            fontSize: 11,
                            fontWeight: 500,
                            opacity: (isCreating || !newName.trim()) ? 0.5 : 1,
                            transition: 'var(--transition-smooth)'
                        }}
                        onMouseOver={(e) => {
                            if (!isCreating && newName.trim()) {
                                e.currentTarget.style.background = 'var(--accent-hover)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                        }}
                        onMouseOut={(e) => {
                            if (!isCreating && newName.trim()) {
                                e.currentTarget.style.background = 'var(--accent-primary)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }
                        }}
                        onMouseDown={(e) => {
                            if (!isCreating && newName.trim()) e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        {isCreating ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            <div className="snapshots-list" style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
                {snapshots.length === 0 && (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, lineHeight: '1.6' }}>
                        <span className="codicon codicon-history" style={{ fontSize: 24, display: 'block', marginBottom: 8, opacity: 0.5 }} />
                        No snapshots yet. <br /> Create one to verify safety.
                    </div>
                )}
                {snapshots.map(s => (
                    <div key={s.id} className="snapshot-item" style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--border-subtle)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'background-color 0.15s ease'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-primary)' }}>{s.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                                {new Date(s.created_at).toLocaleString()}
                            </div>
                        </div>
                        <button
                            onClick={() => handleRestore(s.id)}
                            style={{
                                background: 'var(--bg-hover)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '4px 10px',
                                cursor: 'pointer',
                                fontSize: 11,
                                fontWeight: 500,
                                transition: 'var(--transition-smooth)'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = 'var(--accent-primary)';
                                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                                e.currentTarget.style.color = 'white';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = 'var(--bg-hover)';
                                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }}
                        >
                            Restore
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
