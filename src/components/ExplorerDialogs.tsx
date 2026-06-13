interface RenameDialogProps {
    open: boolean;
    newName: string;
    onNewNameChange: (name: string) => void;
    onConfirm: () => void;
    onClose: () => void;
}

export function RenameDialog({ open, newName, onNewNameChange, onConfirm, onClose }: RenameDialogProps) {
    if (!open) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="new-file-dialog" onClick={e => e.stopPropagation()}>
                <h3>Rename</h3>
                <input
                    type="text"
                    value={newName}
                    onChange={e => onNewNameChange(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') onConfirm();
                        if (e.key === 'Escape') onClose();
                    }}
                    autoFocus
                    onFocus={e => e.target.select()}
                />
                <div className="dialog-actions">
                    <button onClick={onClose}>Cancel</button>
                    <button className="primary" onClick={onConfirm}>Rename</button>
                </div>
            </div>
        </div>
    );
}

interface CloneDialogProps {
    open: boolean;
    cloneRepoUrl: string;
    cloneDestPath: string;
    isCloning: boolean;
    cloneProgress: string[];
    onRepoUrlChange: (url: string) => void;
    onDestPathChange: (path: string) => void;
    onBrowseDest: () => void;
    onConfirm: () => void;
    onClose: () => void;
}

export function CloneDialog({ open, cloneRepoUrl, cloneDestPath, isCloning, cloneProgress, onRepoUrlChange, onDestPathChange, onBrowseDest, onConfirm, onClose }: CloneDialogProps) {
    if (!open) return null;

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
        }}>
            <div className="new-file-dialog" onClick={e => e.stopPropagation()} style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
                width: '360px',
                boxShadow: 'var(--shadow-lg)'
            }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                    <span className="codicon codicon-cloud-download" style={{ color: 'var(--accent-primary)' }} />
                    Clone GitHub Repository
                </h3>
                
                <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Repository URL / Path</label>
                    <input
                        type="text"
                        placeholder="e.g. facebook/react or https://github.com/..."
                        value={cloneRepoUrl}
                        onChange={e => onRepoUrlChange(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px 10px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-primary)',
                            fontSize: 12,
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                        autoFocus
                    />
                </div>

                <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Destination Folder</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            type="text"
                            placeholder="Clone path..."
                            value={cloneDestPath}
                            onChange={e => onDestPathChange(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '8px 10px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-primary)',
                                fontSize: 12,
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                        <button
                            onClick={onBrowseDest}
                            style={{
                                padding: '0 10px',
                                background: 'var(--bg-active)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-primary)',
                                cursor: 'pointer'
                            }}
                            title="Choose folder"
                        >
                            <span className="codicon codicon-folder-opened" />
                        </button>
                    </div>
                </div>

                <div className="dialog-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button 
                        onClick={onClose}
                        style={{
                            padding: '6px 12px',
                            background: 'transparent',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: 12
                        }}
                    >Cancel</button>
                    <button 
                        className="primary" 
                        onClick={onConfirm}
                        disabled={isCloning || !cloneRepoUrl.trim() || !cloneDestPath.trim()}
                        style={{
                            padding: '6px 12px',
                            background: isCloning ? 'var(--bg-active)' : 'var(--accent-primary)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            color: 'white',
                            cursor: isCloning ? 'default' : 'pointer',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12
                        }}
                    >
                        {isCloning ? 'Cloning...' : 'Clone'}
                    </button>
                </div>
                {isCloning && cloneProgress.length > 0 && (
                    <div style={{ 
                        marginTop: 12, 
                        maxHeight: '150px', 
                        overflowY: 'auto', 
                        background: 'var(--bg-tertiary)', 
                        padding: '8px', 
                        borderRadius: 'var(--radius-sm)', 
                        fontSize: 11, 
                        color: 'var(--text-primary)', 
                        fontFamily: 'monospace',
                        border: '1px solid var(--border-subtle)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                    }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{cloneProgress.join('\n')}</pre>
                    </div>
                )}
            </div>
        </div>
    );
}
