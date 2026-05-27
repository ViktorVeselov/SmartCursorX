import { useState, useEffect } from 'react';

interface Memory {
    id: number;
    type: string;
    content: string;
    created_at: string;
}

export function MemoryPanel() {
    const [memories, setMemories] = useState<Memory[]>([]);
    const [newContent, setNewContent] = useState('');
    const [activeType, setActiveType] = useState('project_context');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadMemories();
    }, [activeType]);

    const loadMemories = async () => {
        setLoading(true);
        try {
            const data = await window.ipcRenderer.invoke('db-get-memories', activeType);
            setMemories(data);
        } catch (err) {
            console.error('Failed to load memories:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newContent.trim()) return;
        try {
            await window.ipcRenderer.invoke('db-add-memory', activeType, newContent);
            setNewContent('');
            loadMemories();
        } catch (err) {
            console.error('Failed to add memory:', err);
        }
    };

    return (
        <div className="memory-panel">
            <div className="memory-header">
                <h3><span className="codicon codicon-database" style={{ marginRight: 8 }} />Project Memory</h3>
            </div>

            <div className="memory-tabs">
                <button
                    className={`mem-tab ${activeType === 'project_context' ? 'active' : ''}`}
                    onClick={() => setActiveType('project_context')}
                >
                    Context
                </button>
                <button
                    className={`mem-tab ${activeType === 'learning' ? 'active' : ''}`}
                    onClick={() => setActiveType('learning')}
                >
                    Learnings
                </button>
                <button
                    className={`mem-tab ${activeType === 'todo' ? 'active' : ''}`}
                    onClick={() => setActiveType('todo')}
                >
                    Todos
                </button>
            </div>

            <div className="add-memory-box">
                <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder={`Add new ${activeType.replace('_', ' ')}...`}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) handleAdd();
                    }}
                />
                <button onClick={handleAdd} disabled={!newContent.trim()}>
                    Add (Ctrl+Enter)
                </button>
            </div>

            <div className="memory-list">
                {loading ? (
                    <div className="loading">Loading...</div>
                ) : memories.length === 0 ? (
                    <div className="empty-state">No memories found. Start adding some!</div>
                ) : (
                    memories.map((mem) => (
                        <div key={mem.id} className="memory-card" style={{ position: 'relative', paddingRight: 30 }}>
                            <div className="memory-content">{mem.content}</div>
                            <div className="memory-meta">
                                {new Date(mem.created_at).toLocaleString()}
                            </div>
                            <button
                                onClick={() => {
                                    if (confirm('Delete this memory?')) {
                                        window.ipcRenderer.invoke('db-delete-memory', mem.id).then(loadMemories);
                                    }
                                }}
                                className="icon-btn"
                                style={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: 2
                                }}
                                title="Delete Memory"
                            >
                                <span className="codicon codicon-trash" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
