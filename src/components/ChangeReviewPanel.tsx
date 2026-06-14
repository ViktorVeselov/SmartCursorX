import { useState, useEffect, useCallback } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { getFileSettings } from '../helpers/appFile';

interface FileModification {
    relativePath: string;
    originalContent: string;
    proposedContent: string;
    addedLines: number;
    removedLines: number;
}

interface ChangeReviewPanelProps {
    taskId: number;
    onComplete: () => void;
}

export function ChangeReviewPanel({ taskId, onComplete }: ChangeReviewPanelProps) {
    const [modifications, setModifications] = useState<FileModification[]>([]);
    const [acceptedFiles, setAcceptedFiles] = useState<Set<string>>(new Set());
    const [rejectedFiles, setRejectedFiles] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadPending = useCallback(async () => {
        setLoading(true);
        try {
            const result = await window.ipcRenderer.invoke('execution:get-pending', taskId);
            if (result && result.modifications) {
                setModifications(result.modifications);
            }
        } catch (err) {
            console.error('Failed to load pending modifications:', err);
            setError('Failed to load pending modifications');
        } finally {
            setLoading(false);
        }
    }, [taskId]);

    useEffect(() => {
        loadPending();
    }, [loadPending]);

    const totalAdded = modifications.reduce((sum, m) => sum + m.addedLines, 0);
    const totalRemoved = modifications.reduce((sum, m) => sum + m.removedLines, 0);
    const handleAcceptSingle = async (relativePath: string) => {
        setAcceptedFiles(prev => new Set(prev).add(relativePath));
        setRejectedFiles(prev => {
            const next = new Set(prev);
            next.delete(relativePath);
            return next;
        });
        try {
            await window.ipcRenderer.invoke('execution:apply-single', taskId, relativePath);
        } catch (err) {
            console.error('Failed to accept single file:', err);
        }
    };

    const handleRejectSingle = async (relativePath: string) => {
        setRejectedFiles(prev => new Set(prev).add(relativePath));
        setAcceptedFiles(prev => {
            const next = new Set(prev);
            next.delete(relativePath);
            return next;
        });
        try {
            await window.ipcRenderer.invoke('execution:reject-single', taskId, relativePath);
        } catch (err) {
            console.error('Failed to reject single file:', err);
        }
    };

    const handleAcceptAll = async () => {
        setApplying(true);
        try {
            for (const mod of modifications) {
                setAcceptedFiles(prev => new Set(prev).add(mod.relativePath));
            }
            await window.ipcRenderer.invoke('execution:apply-pending', taskId);
            onComplete();
        } catch (err) {
            console.error('Failed to accept all:', err);
            setError('Failed to apply modifications');
        } finally {
            setApplying(false);
        }
    };

    const handleRejectAll = async () => {
        setApplying(true);
        try {
            for (const mod of modifications) {
                setRejectedFiles(prev => new Set(prev).add(mod.relativePath));
            }
            await window.ipcRenderer.invoke('execution:reject-pending', taskId);
            onComplete();
        } catch (err) {
            console.error('Failed to reject all:', err);
            setError('Failed to reject modifications');
        } finally {
            setApplying(false);
        }
    };

    const isLargeDiff = (mod: FileModification) => (mod.addedLines + mod.removedLines) > 500;

    if (loading) {
        return (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif' }}>
                <span className="codicon codicon-loading codicon-modifier-spin" style={{ marginRight: 8 }} />
                Loading pending changes...
            </div>
        );
    }

    if (modifications.length === 0) {
        return (
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', padding: 40, fontFamily: 'Inter, sans-serif' }}>
                <div style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                    No pending changes to review
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    This means the execution did not produce any file modifications, or they have already been reviewed.
                </div>
                <button
                    onClick={onComplete}
                    style={{
                        marginTop: 16,
                        padding: '6px 14px',
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: 4,
                        color: '#818cf8',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 500,
                        alignSelf: 'flex-start',
                    }}
                >
                    Close
                </button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d1117', color: 'white', fontFamily: 'Inter, sans-serif' }}>
            <div style={{
                padding: '12px 24px',
                background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
                borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="codicon codicon-diff" style={{ color: '#818cf8', fontSize: 18 }} />
                        <span style={{ fontWeight: 600, fontSize: 15 }}>Review Changes</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Task #{taskId}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {modifications.length} file{modifications.length !== 1 ? 's' : ''}
                            <span style={{ marginLeft: 8 }}>+<span style={{ color: '#34d399' }}>{totalAdded}</span></span>
                            /<span style={{ color: '#f43f5e' }}>-{totalRemoved}</span>
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={handleRejectAll}
                            disabled={applying}
                            style={{
                                padding: '5px 12px',
                                background: 'rgba(244, 63, 94, 0.1)',
                                border: '1px solid rgba(244, 63, 94, 0.2)',
                                borderRadius: 4,
                                color: '#f43f5e',
                                cursor: applying ? 'not-allowed' : 'pointer',
                                fontSize: 11,
                                fontWeight: 600,
                                opacity: applying ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            <span className="codicon codicon-close" style={{ fontSize: 11 }} /> Reject All
                        </button>
                        <button
                            onClick={handleAcceptAll}
                            disabled={applying}
                            style={{
                                padding: '5px 12px',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                border: 'none',
                                borderRadius: 4,
                                color: 'white',
                                cursor: applying ? 'not-allowed' : 'pointer',
                                fontSize: 11,
                                fontWeight: 600,
                                opacity: applying ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            <span className="codicon codicon-check" style={{ fontSize: 11 }} /> Accept All
                        </button>
                    </div>
                </div>
                {error && (
                    <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: 4, color: '#f43f5e', fontSize: 12 }}>
                        {error}
                    </div>
                )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                {modifications.map((mod) => {
                    const status = acceptedFiles.has(mod.relativePath) ? 'accepted' : rejectedFiles.has(mod.relativePath) ? 'rejected' : 'pending';
                    const large = isLargeDiff(mod);
                    const fileName = mod.relativePath.split(/[/\\]/).pop() || mod.relativePath;

                    return (
                        <div
                            key={mod.relativePath}
                            style={{
                                marginBottom: 16,
                                border: `1px solid ${status === 'accepted' ? 'rgba(52, 211, 153, 0.3)' : status === 'rejected' ? 'rgba(244, 63, 94, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: 8,
                                overflow: 'hidden',
                                opacity: status !== 'pending' ? 0.6 : 1,
                                transition: 'opacity 0.2s',
                            }}
                        >
                            <div style={{
                                padding: '8px 16px',
                                background: status === 'accepted' ? 'rgba(52, 211, 153, 0.08)' : status === 'rejected' ? 'rgba(244, 63, 94, 0.08)' : 'rgba(255,255,255,0.03)',
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className="codicon codicon-file-code" style={{ color: '#818cf8', fontSize: 13 }} />
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>{mod.relativePath}</span>
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                        +<span style={{ color: '#34d399' }}>{mod.addedLines}</span>
                                        /<span style={{ color: '#f43f5e' }}>-{mod.removedLines}</span>
                                    </span>
                                    {large && (
                                        <span style={{
                                            fontSize: 10,
                                            padding: '1px 6px',
                                            background: 'rgba(251, 191, 36, 0.15)',
                                            border: '1px solid rgba(251, 191, 36, 0.3)',
                                            borderRadius: 3,
                                            color: '#fbbf24',
                                        }}>
                                            Large diff
                                        </span>
                                    )}
                                    {status === 'accepted' && <span style={{ fontSize: 11, color: '#34d399' }}>Accepted</span>}
                                    {status === 'rejected' && <span style={{ fontSize: 11, color: '#f43f5e' }}>Rejected</span>}
                                </div>
                                {status === 'pending' && (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button
                                            onClick={() => handleRejectSingle(mod.relativePath)}
                                            disabled={applying}
                                            style={{
                                                padding: '3px 8px',
                                                background: 'rgba(244, 63, 94, 0.1)',
                                                border: '1px solid rgba(244, 63, 94, 0.2)',
                                                borderRadius: 3,
                                                color: '#f43f5e',
                                                cursor: 'pointer',
                                                fontSize: 10,
                                                fontWeight: 500,
                                            }}
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => handleAcceptSingle(mod.relativePath)}
                                            disabled={applying}
                                            style={{
                                                padding: '3px 8px',
                                                background: 'rgba(52, 211, 153, 0.15)',
                                                border: '1px solid rgba(52, 211, 153, 0.3)',
                                                borderRadius: 3,
                                                color: '#34d399',
                                                cursor: 'pointer',
                                                fontSize: 10,
                                                fontWeight: 500,
                                            }}
                                        >
                                            Accept
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div style={{ height: 300, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                <DiffEditor
                                    height="100%"
                                    language={getFileSettings(fileName).language}
                                    original={mod.originalContent}
                                    modified={mod.proposedContent}
                                    theme="vs-dark"
                                    options={{
                                        readOnly: true,
                                        fontSize: 12,
                                        renderSideBySide: true,
                                        minimap: { enabled: false },
                                        scrollBeyondLastLine: false,
                                        automaticLayout: true,
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
