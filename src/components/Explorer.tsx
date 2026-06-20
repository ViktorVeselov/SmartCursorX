import { useState, useEffect, useCallback } from 'react';
import { ContextMenu, MenuItem } from './ContextMenu';
import { FileItem, loadDir } from '../helpers/fileTree';
import { FileNode } from './FileTreeNode';
import { RenameDialog, CloneDialog } from './ExplorerDialogs';

interface ExplorerProps {
    onFileSelect: (content: string, path: string, line?: number) => void;
    onCreateFile?: (path?: string) => void;
    rootPath?: string;
    onOpenFolder?: (path?: string) => void;
    symbolSearchQuery: string;
    setSymbolSearchQuery: (q: string) => void;
    onFileDelete?: (path: string) => void;
}

export function Explorer({ onFileSelect, onCreateFile, rootPath = '', onOpenFolder, symbolSearchQuery, setSymbolSearchQuery, onFileDelete }: ExplorerProps) {
    const [rootItems, setRootItems] = useState<FileItem[]>([]);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Symbol Search and Outline State
    const [workspaceOutline, setWorkspaceOutline] = useState<Array<{ filePath: string; outline: Record<string, unknown> }>>([]);
    const [isLoadingOutline, setIsLoadingOutline] = useState(false);

    const loadWorkspaceOutline = useCallback(async () => {
        setIsLoadingOutline(true);
        try {
            const data = await window.ipcRenderer.invoke('code:get-workspace-outline', rootPath);
            setWorkspaceOutline(data || []);
        } catch (e) {
            console.error('Failed to load symbols outline:', e);
        } finally {
            setIsLoadingOutline(false);
        }
    }, [rootPath]);

    useEffect(() => {
        setWorkspaceOutline([]);
    }, [rootPath]);

    useEffect(() => {
        if (symbolSearchQuery.trim().length > 0 && workspaceOutline.length === 0 && !isLoadingOutline) {
            loadWorkspaceOutline();
        }
    }, [symbolSearchQuery, workspaceOutline.length, isLoadingOutline, loadWorkspaceOutline]);

    const getFlattenedSymbols = useCallback((): Array<{ name: string; kind: 'class' | 'function' | 'interface' | 'method'; startLine: number; filePath: string }> => {
        const list: Array<{ name: string; kind: 'class' | 'function' | 'interface' | 'method'; startLine: number; filePath: string }> = [];
        workspaceOutline.forEach(item => {
            const { classes = [], functions = [], interfaces = [] } = item.outline || {};
            (classes as Record<string, unknown>[]).forEach((c) => list.push({ name: c.name as string, kind: 'class' as const, startLine: c.startLine as number, filePath: item.filePath }));
            (functions as Record<string, unknown>[]).forEach((f) => list.push({ name: f.name as string, kind: (f.kind as 'function') || 'function', startLine: f.startLine as number, filePath: item.filePath }));
            (interfaces as Record<string, unknown>[]).forEach((i) => list.push({ name: i.name as string, kind: 'interface' as const, startLine: i.startLine as number, filePath: item.filePath }));
        });
        return list;
    }, [workspaceOutline]);

    const filteredSymbols = getFlattenedSymbols().filter(sym => {
        const nameMatch = sym.name.toLowerCase().includes(symbolSearchQuery.toLowerCase());
        const kindMatch = sym.kind.toLowerCase().includes(symbolSearchQuery.toLowerCase());
        return nameMatch || kindMatch;
    });

    const handleSymbolClick = async (sym: { name: string; filePath: string; startLine: number }) => {
        try {
            const content = await window.ipcRenderer.invoke('read-file', sym.filePath);
            onFileSelect(content, sym.filePath, sym.startLine);
        } catch (err) {
            console.error('Failed to navigate to symbol:', err);
        }
    };

    // Clone Dialog State
    const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
    const [cloneRepoUrl, setCloneRepoUrl] = useState('');
    const [cloneDestPath, setCloneDestPath] = useState('');
    const [isCloning, setIsCloning] = useState(false);
    const [cloneProgress, setCloneProgress] = useState<string[]>([]);

    const handleCloneConfirm = async () => {
        if (!cloneRepoUrl.trim() || !cloneDestPath.trim() || isCloning) return;
        setIsCloning(true);
        setCloneProgress([]);
        try {
            const urlSegs = cloneRepoUrl.trim().split('/');
            const repoName = urlSegs[urlSegs.length - 1].replace('.git', '') || 'cloned-repo';
            let finalDest = cloneDestPath.trim();
            if (!finalDest.endsWith(repoName)) {
                const sep = finalDest.includes('\\') ? '\\' : '/';
                finalDest = finalDest.endsWith(sep) ? finalDest + repoName : finalDest + sep + repoName;
            }

            const success = await window.ipcRenderer.invoke('git-clone', cloneRepoUrl.trim(), finalDest);
            if (success) {
                setCloneDialogOpen(false);
                setCloneRepoUrl('');
                alert(`Repository cloned successfully into:\n${finalDest}`);
                if (onOpenFolder) {
                    if (confirm(`Do you want to open the cloned repository as your active workspace?`)) {
                        onOpenFolder(finalDest);
                    }
                }
            }
        } catch (e: unknown) {
            console.error(e);
            alert(`Clone failed: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsCloning(false);
        }
    };

    // Load root directory on mount or change
    useEffect(() => {
        if (rootPath) {
            loadDir(rootPath).then(setRootItems);
        } else {
            setRootItems([]);
        }
    }, [rootPath]);

    // Listen for git clone progress events
    useEffect(() => {
        const handler = (_event: unknown, data: string) => {
            setCloneProgress(prev => [...prev, data.trim()]);
        };
        window.ipcRenderer.on('git-clone-progress', handler);
        return () => {
            window.ipcRenderer.off('git-clone-progress', handler);
        };
    }, []);

    // Listen for workspace file changes to auto-refresh the file tree
    useEffect(() => {
        if (!rootPath) return;
        const handler = (_event: unknown) => {
            console.log('[Explorer] Workspace files changed, reloading tree...');
            loadDir(rootPath).then(setRootItems);
            setRefreshTrigger(prev => prev + 1);
        };
        window.ipcRenderer.on('workspace:files-changed', handler);
        return () => {
            window.ipcRenderer.off('workspace:files-changed', handler);
        };
    }, [rootPath]);

    const handleToggleFolder = useCallback((path: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    const handleFileClick = useCallback(async (item: FileItem) => {
        try {
            const content = await window.ipcRenderer.invoke('read-file', item.path);
            onFileSelect(content, item.path);
        } catch (err) {
            console.error('Failed to read file:', err);
        }
    }, [onFileSelect]);

    // Rename State
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [itemToRename, setItemToRename] = useState<FileItem | null>(null);
    const [newName, setNewName] = useState('');

    const handleRenameConfirm = async () => {
        if (!itemToRename || !newName.trim() || newName === itemToRename.name) {
            setRenameDialogOpen(false);
            return;
        }

        const parentPath = itemToRename.path.substring(0, itemToRename.path.lastIndexOf(itemToRename.name));
        // Use forward slashes for path joining if needed, or rely on native separator from item.path logic
        // Simple string replacement usually works if we just swap the last segment
        // But safer:
        const oldPath = itemToRename.path;
        const newPath = parentPath + newName.trim();
        try {
            await window.ipcRenderer.invoke('rename-path', oldPath, newPath);
            setRenameDialogOpen(false);
            setItemToRename(null);
            setNewName('');
            // Refresh
            const files = await loadDir(rootPath || '.');
            setRootItems(files);
            setRefreshTrigger(prev => prev + 1);
        } catch (err) {
            console.error('Failed to rename:', err);
            alert('Failed to rename file');
        }
    };


    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FileItem } | null>(null);

    const handleContextMenu = useCallback((e: React.MouseEvent, item: FileItem) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item });
    }, []);

    const handleMenuAction = async (action: string) => {
        if (!contextMenu) return;
        const { item } = contextMenu;

        switch (action) {
            case 'copy-path':
                try {
                    const resolved = await window.ipcRenderer.invoke('resolve-path', item.path);
                    await navigator.clipboard.writeText(resolved || item.path);
                } catch (e) {
                    await navigator.clipboard.writeText(item.path);
                }
                break;
            case 'rename':
                setItemToRename(item);
                setNewName(item.name);
                setRenameDialogOpen(true);
                break;
            case 'delete':
                if (confirm(`Are you sure you want to delete ${item.name}?`)) {
                    try {
                        await window.ipcRenderer.invoke('delete-path', item.path);
                        // Refresh root or just reload the whole tree for now to be safe
                        const files = await loadDir(rootPath || '.');
                        setRootItems(files);
                        onFileDelete?.(item.path);
                        setRefreshTrigger(prev => prev + 1);
                    } catch (err) {
                        console.error('Failed to delete:', err);
                        alert('Failed to delete file/folder');
                    }
                }
                break;
            case 'new-file': {
                // Pass format: directory path
                const targetDir = item.isDirectory ? item.path : item.path.substring(0, item.path.lastIndexOf(item.name));
                onCreateFile?.(targetDir);
                break;
            }
        }
        setContextMenu(null);
    };

    const getMenuItems = (): MenuItem[] => {
        if (!contextMenu) return [];
        const { item } = contextMenu;

        const items: MenuItem[] = [
            { label: 'Copy Path', action: () => handleMenuAction('copy-path') },
            { label: 'Rename', action: () => handleMenuAction('rename'), shortcut: 'F2' },
            { label: 'Delete', action: () => handleMenuAction('delete'), danger: true },
        ];

        if (item.isDirectory) {
            items.unshift(
                { label: 'New File', action: () => handleMenuAction('new-file') },
                { separator: true, label: '', action: () => { } }
            );
        }

        return items;
    };

    return (
        <div className="explorer">
            <div className="explorer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="explorer-title"><span className="codicon codicon-files" style={{ marginRight: 6 }} />Explorer</span>
                {rootPath && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {onOpenFolder && (
                            <button
                                onClick={() => onOpenFolder()}
                                className="icon-btn"
                                title="Open Folder"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 2,
                                    padding: '4px 6px'
                                }}
                            >
                                <span className="codicon codicon-folder-opened" style={{ fontSize: 14 }} />
                                <span style={{ fontSize: 9, fontWeight: 500 }}>OPEN</span>
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setCloneRepoUrl('');
                                setCloneDestPath(rootPath || '');
                                setCloneDialogOpen(true);
                            }}
                            className="icon-btn"
                            title="Clone GitHub Repository"
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 2,
                                padding: '4px 6px'
                            }}
                        >
                            <span className="codicon codicon-cloud-download" style={{ fontSize: 14 }} />
                            <span style={{ fontSize: 9, fontWeight: 500 }}>CLONE</span>
                        </button>
                    </div>
                )}
            </div>

            {!rootPath ? (
                <div className="empty-workspace-panel">
                    <div className="empty-workspace-icon-wrapper">
                        <span className="codicon codicon-folder-opened" style={{ fontSize: 24 }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <h4 className="empty-workspace-title">No Folder Opened</h4>
                        <p className="empty-workspace-desc">
                            Open a folder or clone a repository to start editing files and using AI context.
                        </p>
                    </div>
                    <div className="empty-workspace-ctas">
                        <button
                            className="primary-cta-btn"
                            onClick={() => onOpenFolder?.()}
                        >
                            Open Folder
                        </button>
                        <button
                            className="secondary-cta-btn"
                            onClick={() => {
                                setCloneRepoUrl('');
                                setCloneDestPath('');
                                setCloneDialogOpen(true);
                            }}
                        >
                            Clone Repository
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Quick Symbol Finder */}
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
                                <span className="codicon codicon-search" style={{ position: 'absolute', left: 8, color: 'var(--text-secondary)', fontSize: 12 }} />
                                <input
                                    type="text"
                                    placeholder="Quick symbol search..."
                                    value={symbolSearchQuery}
                                    onChange={e => setSymbolSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '5px 8px 5px 24px',
                                        background: 'var(--bg-input)',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: 'var(--radius-sm)',
                                        color: 'var(--text-primary)',
                                        fontSize: '11px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s ease'
                                    }}
                                />
                                {symbolSearchQuery && (
                                    <button
                                        onClick={() => setSymbolSearchQuery('')}
                                        style={{
                                            position: 'absolute',
                                            right: 6,
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <span className="codicon codicon-close" style={{ fontSize: 10 }} />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={loadWorkspaceOutline}
                                title="Refresh symbols index"
                                style={{
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '6px',
                                    borderRadius: 'var(--radius-sm)',
                                    height: '24px',
                                    width: '24px',
                                    background: 'var(--bg-hover)',
                                    border: '1px solid var(--border-subtle)'
                                }}
                            >
                                <span className={`codicon codicon-refresh ${isLoadingOutline ? 'loading-spin' : ''}`} style={{ fontSize: 11 }} />
                            </button>
                        </div>
                        {isLoadingOutline && (
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontStyle: 'italic', paddingLeft: 4 }}>
                                Scanning symbols index...
                            </span>
                        )}
                    </div>

                    {symbolSearchQuery ? (
                        <div className="symbol-search-results" style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ padding: '4px 10px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Matching Symbols ({filteredSymbols.length})
                            </div>
                            <div style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
                                {filteredSymbols.map((sym, idx) => {
                                    const relativePath = sym.filePath.split(/[/\\]/).slice(-2).join('/');
                                    
                                    let icon = 'codicon-symbol-method';
                                    let iconColor = '#00add8';
                                    if (sym.kind === 'class') {
                                        icon = 'codicon-symbol-class';
                                        iconColor = '#a074c4';
                                    } else if (sym.kind === 'interface') {
                                        icon = 'codicon-symbol-interface';
                                        iconColor = '#42b883';
                                    }

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => handleSymbolClick(sym)}
                                            className="sidebar-item symbol-item"
                                            style={{
                                                padding: '6px 12px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 2,
                                                borderBottom: '1px solid rgba(255,255,255,0.02)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span className={`codicon ${icon}`} style={{ color: iconColor, fontSize: 13 }} />
                                                <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>{sym.name}</span>
                                                <span style={{ fontSize: 9, opacity: 0.6, background: 'var(--bg-active)', padding: '1px 4px', borderRadius: '3px', textTransform: 'uppercase' }}>{sym.kind}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 19 }}>
                                                <span className="codicon codicon-file" style={{ fontSize: 10, color: 'var(--text-secondary)' }} />
                                                <span style={{ fontSize: 10, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {relativePath}:L{sym.startLine}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredSymbols.length === 0 && (
                                    <div className="empty-msg" style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                        No matching symbols found
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="file-list">
                            {rootItems.map((item) => (
                                <FileNode
                                    key={item.path}
                                    item={item}
                                    depth={0}
                                    expandedFolders={expandedFolders}
                                    onToggleFolder={handleToggleFolder}
                                    onFileClick={handleFileClick}
                                    loadChildren={loadDir}
                                    onContextMenu={handleContextMenu}
                                    refreshTrigger={refreshTrigger}
                                />
                            ))}
                            {rootItems.length === 0 && <div className="empty-msg">No files found</div>}
                        </div>
                    )}
                </>
            )}

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={getMenuItems()}
                    onClose={() => setContextMenu(null)}
                />
            )}

            <RenameDialog
                open={renameDialogOpen}
                newName={newName}
                onNewNameChange={setNewName}
                onConfirm={handleRenameConfirm}
                onClose={() => setRenameDialogOpen(false)}
            />

            <CloneDialog
                open={cloneDialogOpen}
                cloneRepoUrl={cloneRepoUrl}
                cloneDestPath={cloneDestPath}
                isCloning={isCloning}
                cloneProgress={cloneProgress}
                onRepoUrlChange={setCloneRepoUrl}
                onDestPathChange={setCloneDestPath}
                onBrowseDest={async () => {
                    const path = await window.ipcRenderer.invoke('dialog-open-folder');
                    if (path) setCloneDestPath(path);
                }}
                onConfirm={handleCloneConfirm}
                onClose={() => setCloneDialogOpen(false)}
            />
        </div>
    );
}
