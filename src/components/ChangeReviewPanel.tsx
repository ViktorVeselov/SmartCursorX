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

interface ChangeItemMetadata {
    relativePath: string;
    absolutePath: string;
    status: 'pending' | 'accepted' | 'git-modified' | 'git-untracked';
    taskId?: number;
    addedLines: number;
    removedLines: number;
}

interface FileContent {
    originalContent: string;
    proposedContent: string;
}

interface ChangeReviewPanelProps {
    taskId?: number;
    activeChangesTab?: 'all' | 'accepted' | 'pending';
    onComplete: () => void;
}

export function ChangeReviewPanel({ taskId, activeChangesTab, onComplete }: ChangeReviewPanelProps) {
    const isTaskBound = taskId !== undefined;
    const [modifications, setModifications] = useState<FileModification[]>([]);
    const [pendingItems, setPendingItems] = useState<ChangeItemMetadata[]>([]);
    const [expandedPath, setExpandedPath] = useState<string | null>(null);
    const [fileContents, setFileContents] = useState<Record<string, FileContent>>({});
    const [loadingContent, setLoadingContent] = useState<string | null>(null);
    const [acceptedFiles, setAcceptedFiles] = useState<Set<string>>(new Set());
    const [rejectedFiles, setRejectedFiles] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadPending = useCallback(async () => {
        if (!isTaskBound) return;
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
    }, [taskId, isTaskBound]);

    const loadWorkspaceChanges = useCallback(async () => {
        if (!activeChangesTab) return;
        setLoading(true);
        try {
            const rootPath = await window.ipcRenderer.invoke('get-general-settings').then((s: any) => s?.activeWorkspacePath).catch(() => null);
            const items: ChangeItemMetadata[] = await window.ipcRenderer.invoke('changes:get-list', activeChangesTab, rootPath || undefined);
            setPendingItems(items);
        } catch (err) {
            console.error('Failed to load workspace changes:', err);
            setError('Failed to load changes');
        } finally {
            setLoading(false);
        }
    }, [activeChangesTab]);

    useEffect(() => {
        if (isTaskBound) {
            loadPending();
        } else {
            loadWorkspaceChanges();
        }
    }, [isTaskBound, loadPending, loadWorkspaceChanges]);

    useEffect(() => {
        const handleChangesUpdated = () => {
            if (isTaskBound) {
                loadPending();
            } else {
                loadWorkspaceChanges();
            }
        };
        const cleanup = window.ipcRenderer.on('changes:updated', handleChangesUpdated) as unknown as () => void;
        return () => cleanup();
    }, [isTaskBound, loadPending, loadWorkspaceChanges]);

    const loadContent = useCallback(async (relativePath: string, status: string, itemTaskId?: number) => {
        setLoadingContent(relativePath);
        try {
            let content: FileContent;
            if (isTaskBound) {
                const mod = modifications.find(m => m.relativePath === relativePath);
                content = mod
                    ? { originalContent: mod.originalContent, proposedContent: mod.proposedContent }
                    : { originalContent: '', proposedContent: '' };
            } else {
                content = await window.ipcRenderer.invoke('changes:get-file-content', relativePath, status, itemTaskId);
            }
            setFileContents(prev => ({ ...prev, [relativePath]: content }));
        } catch (err) {
            console.error('Failed to load file content:', err);
        } finally {
            setLoadingContent(null);
        }
    }, [isTaskBound, modifications]);

    const handleToggleExpand = (relativePath: string, status: string, itemTaskId?: number) => {
        if (expandedPath === relativePath) {
            setExpandedPath(null);
            return;
        }
        setExpandedPath(relativePath);
        if (!fileContents[relativePath]) {
            loadContent(relativePath, status, itemTaskId);
        }
    };

    const totalAdded = (isTaskBound ? modifications : pendingItems).reduce((sum, m) => sum + m.addedLines, 0);
    const totalRemoved = (isTaskBound ? modifications : pendingItems).reduce((sum, m) => sum + m.removedLines, 0);

    const handleAcceptSingle = async (relativePath: string, status?: string, itemTaskId?: number) => {
        setAcceptedFiles(prev => new Set(prev).add(relativePath));
        setRejectedFiles(prev => {
            const next = new Set(prev);
            next.delete(relativePath);
            return next;
        });
        try {
            if (isTaskBound) {
                await window.ipcRenderer.invoke('execution:apply-single', taskId, relativePath);
                loadPending();
            } else {
                await window.ipcRenderer.invoke('changes:stage-file', relativePath, status || '', itemTaskId);
                loadWorkspaceChanges();
            }
        } catch (err) {
            console.error('Failed to accept file:', err);
        }
    };

    const handleRejectSingle = async (relativePath: string, status?: string, itemTaskId?: number) => {
        setRejectedFiles(prev => new Set(prev).add(relativePath));
        setAcceptedFiles(prev => {
            const next = new Set(prev);
            next.delete(relativePath);
            return next;
        });
        try {
            if (isTaskBound) {
                await window.ipcRenderer.invoke('execution:reject-single', taskId, relativePath);
                loadPending();
            } else {
                await window.ipcRenderer.invoke('changes:discard-file', relativePath, status || '', itemTaskId);
                loadWorkspaceChanges();
            }
        } catch (err) {
            console.error('Failed to reject file:', err);
        }
    };

    const handleAcceptAll = async () => {
        setApplying(true);
        try {
            if (isTaskBound) {
                for (const mod of modifications) {
                    setAcceptedFiles(prev => new Set(prev).add(mod.relativePath));
                }
                await window.ipcRenderer.invoke('execution:apply-pending', taskId);
                onComplete();
            } else {
                for (const item of pendingItems) {
                    setAcceptedFiles(prev => new Set(prev).add(item.relativePath));
                    await window.ipcRenderer.invoke('changes:stage-file', item.relativePath, item.status, item.taskId);
                }
                setPendingItems([]);
                onComplete();
            }
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
            if (isTaskBound) {
                for (const mod of modifications) {
                    setRejectedFiles(prev => new Set(prev).add(mod.relativePath));
                }
                await window.ipcRenderer.invoke('execution:reject-pending', taskId);
                onComplete();
            } else {
                for (const item of pendingItems) {
                    setRejectedFiles(prev => new Set(prev).add(item.relativePath));
                    await window.ipcRenderer.invoke('changes:discard-file', item.relativePath, item.status, item.taskId);
                }
                setPendingItems([]);
                onComplete();
            }
        } catch (err) {
            console.error('Failed to reject all:', err);
            setError('Failed to reject modifications');
        } finally {
            setApplying(false);
        }
    };

    const isLargeDiff = (added: number, removed: number) => (added + removed) > 500;

    const items: ChangeItemMetadata[] = isTaskBound
        ? modifications.map(m => ({ relativePath: m.relativePath, absolutePath: '', status: 'pending' as const, taskId, addedLines: m.addedLines, removedLines: m.removedLines }))
        : pendingItems;

    if (loading) {
        return (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif' }}>
                <span className="codicon codicon-loading codicon-modifier-spin" style={{ marginRight: 8 }} />
                Loading changes...
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', padding: 40, fontFamily: 'Inter, sans-serif' }}>
                <div style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                    No changes to review
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {isTaskBound
                        ? 'This means the execution did not produce any file modifications, or they have already been reviewed.'
                        : `No ${activeChangesTab || ''} changes found in the workspace.`}
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
                        <span style={{ fontWeight: 600, fontSize: 15 }}>
                            {isTaskBound ? `Review Changes - Task #${taskId}` : `${activeChangesTab === 'all' ? 'All' : activeChangesTab === 'accepted' ? 'Accepted' : 'Pending'} Changes`}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {items.length} file{items.length !== 1 ? 's' : ''}
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
                            <span className="codicon codicon-close" style={{ fontSize: 11 }} /> Discard All
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
                {items.map((item) => {
                    const fileName = item.relativePath.split(/[/\\]/).pop() || item.relativePath;
                    const isExpanded = expandedPath === item.relativePath;
                    const status = acceptedFiles.has(item.relativePath) ? 'accepted' : rejectedFiles.has(item.relativePath) ? 'rejected' : 'pending';
                    const isPendingStatus = status === 'pending';
                    const large = isLargeDiff(item.addedLines, item.removedLines);
                    const content = fileContents[item.relativePath];
                    const isLoadingContent = loadingContent === item.relativePath;

                    const statusColor = item.status === 'pending' ? '#818cf8'
                        : item.status === 'accepted' ? '#34d399'
                        : item.status === 'git-modified' ? '#fbbf24'
                        : '#94a3b8';

                    const statusLabel = item.status === 'pending' ? 'AI Pending'
                        : item.status === 'accepted' ? 'Accepted'
                        : item.status === 'git-modified' ? 'Modified'
                        : 'Untracked';

                    return (
                        <div
                            key={item.relativePath}
                            style={{
                                marginBottom: isExpanded ? 16 : 8,
                                border: `1px solid ${isExpanded ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: 8,
                                overflow: 'hidden',
                                transition: 'all 0.2s',
                            }}
                        >
                            <div
                                onClick={() => handleToggleExpand(item.relativePath, item.status, item.taskId)}
                                style={{
                                    padding: '8px 16px',
                                    background: isExpanded ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.03)',
                                    borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                    <span className={`codicon codicon-chevron-${isExpanded ? 'down' : 'right'}`} style={{ color: 'var(--text-secondary)', fontSize: 12, flexShrink: 0 }} />
                                    <span className="codicon codicon-file-code" style={{ color: '#818cf8', fontSize: 13, flexShrink: 0 }} />
                                    <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.relativePath}</span>
                                    <span style={{
                                        fontSize: 10,
                                        padding: '1px 6px',
                                        background: `${statusColor}20`,
                                        border: `1px solid ${statusColor}40`,
                                        borderRadius: 3,
                                        color: statusColor,
                                        flexShrink: 0,
                                    }}>
                                        {statusLabel}
                                    </span>
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>
                                        +<span style={{ color: '#34d399' }}>{item.addedLines}</span>
                                        /<span style={{ color: '#f43f5e' }}>-{item.removedLines}</span>
                                    </span>
                                    {large && (
                                        <span style={{
                                            fontSize: 10,
                                            padding: '1px 6px',
                                            background: 'rgba(251, 191, 36, 0.15)',
                                            border: '1px solid rgba(251, 191, 36, 0.3)',
                                            borderRadius: 3,
                                            color: '#fbbf24',
                                            flexShrink: 0,
                                        }}>
                                            Large diff
                                        </span>
                                    )}
                                </div>
                                {isPendingStatus && (
                                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => handleRejectSingle(item.relativePath, item.status, item.taskId)}
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
                                            Discard
                                        </button>
                                        <button
                                            onClick={() => handleAcceptSingle(item.relativePath, item.status, item.taskId)}
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
                                {!isPendingStatus && (
                                    <span style={{ fontSize: 11, color: status === 'accepted' ? '#34d399' : '#f43f5e', flexShrink: 0 }}>
                                        {status === 'accepted' ? 'Accepted' : 'Rejected'}
                                    </span>
                                )}
                            </div>
                            {isExpanded && (
                                <div style={{ height: 300, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    {isLoadingContent && (
                                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', gap: 8 }}>
                                            <span className="codicon codicon-loading codicon-modifier-spin" />
                                            Loading file content...
                                        </div>
                                    )}
                                    {!isLoadingContent && content && (
                                        <DiffEditor
                                            height="100%"
                                            language={getFileSettings(fileName).language}
                                            original={content.originalContent}
                                            modified={content.proposedContent}
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
                                    )}
                                    {!isLoadingContent && !content && (
                                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)' }}>
                                            No content available
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
