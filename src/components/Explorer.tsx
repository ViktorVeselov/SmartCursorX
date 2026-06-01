import { useState, useEffect, useCallback } from 'react';
import { ContextMenu, MenuItem } from './ContextMenu';

interface FileItem {
    name: string;
    path: string;
    isDirectory: boolean;
    children?: FileItem[];
}

interface ExplorerProps {
    onFileSelect: (content: string, path: string, line?: number) => void;
    onCreateFile?: (path?: string) => void;
    rootPath?: string;
    onOpenFolder?: (path?: string) => void;
    symbolSearchQuery: string;
    setSymbolSearchQuery: (q: string) => void;
}

interface FileNodeProps {
    item: FileItem;
    depth: number;
    expandedFolders: Set<string>;
    onToggleFolder: (path: string) => void;
    onFileClick: (item: FileItem) => void;
    loadChildren: (path: string) => Promise<FileItem[]>;
    onContextMenu: (e: React.MouseEvent, item: FileItem) => void;
}

function FileNode({ item, depth, expandedFolders, onToggleFolder, onFileClick, loadChildren, onContextMenu }: FileNodeProps) {
    const [children, setChildren] = useState<FileItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const isExpanded = expandedFolders.has(item.path);

    useEffect(() => {
        if (item.isDirectory && isExpanded && children.length === 0) {
            setIsLoading(true);
            loadChildren(item.path).then((items) => {
                setChildren(items);
                setIsLoading(false);
            }).catch(() => setIsLoading(false));
        }
    }, [isExpanded, item.path, item.isDirectory, loadChildren]);

    const handleClick = () => {
        if (item.isDirectory) {
            onToggleFolder(item.path);
        } else {
            onFileClick(item);
        }
    };

    const getFileIcon = (name: string, isDir: boolean): { icon: string; color: string; label?: string } => {
        if (isDir) return {
            icon: isExpanded ? 'codicon-folder-opened' : 'codicon-folder',
            color: '#dcb67a'
        };

        const ext = name.split('.').pop()?.toLowerCase();
        const filename = name.toLowerCase();

        // Special filenames
        if (filename === '.gitignore' || filename === '.gitattributes')
            return { icon: 'codicon-git-commit', color: '#f14e32' };
        if (filename === '.env' || filename.endsWith('.env.local'))
            return { icon: 'codicon-settings-gear', color: '#ecd53f' };
        if (filename === 'package.json' || filename === 'package-lock.json')
            return { icon: 'codicon-json', color: '#cb3837' };
        if (filename === 'tsconfig.json')
            return { icon: 'codicon-json', color: '#3178c6' };
        if (filename === 'cargo.toml')
            return { icon: 'codicon-settings-gear', color: '#dea584' };

        switch (ext) {
            // TypeScript - text label "TS"
            case 'ts': return { icon: 'label-ts', color: '#3178c6', label: 'TS' };
            case 'tsx': return { icon: 'label-react', color: '#61dafb', label: '⚛' };
            // JavaScript - text label "JS"
            case 'js': return { icon: 'label-js', color: '#f7df1e', label: 'JS' };
            case 'jsx': return { icon: 'label-react', color: '#61dafb', label: '⚛' };
            case 'mjs':
            case 'cjs': return { icon: 'label-js', color: '#f7df1e', label: 'JS' };
            // Python
            case 'py': return { icon: 'codicon-python', color: '#3776ab' };
            case 'pyw':
            case 'pyx': return { icon: 'codicon-python', color: '#3776ab' };
            // Ruby
            case 'rb': return { icon: 'codicon-ruby', color: '#cc342d' };
            case 'rake':
            case 'gemspec': return { icon: 'codicon-ruby', color: '#cc342d' };
            // Shell
            case 'sh':
            case 'bash': return { icon: 'codicon-terminal-bash', color: '#89e051' };
            case 'zsh': return { icon: 'codicon-terminal-bash', color: '#89e051' };
            case 'ps1':
            case 'psm1': return { icon: 'codicon-terminal-powershell', color: '#5391fe' };
            case 'bat':
            case 'cmd': return { icon: 'codicon-terminal', color: '#c1f12e' };
            // Web
            case 'html':
            case 'htm': return { icon: 'codicon-browser', color: '#e44d26' };
            case 'css': return { icon: 'codicon-symbol-color', color: '#264de4' };
            case 'scss':
            case 'sass': return { icon: 'codicon-symbol-color', color: '#cc6699' };
            case 'less': return { icon: 'codicon-symbol-color', color: '#1d365d' };
            case 'vue': return { icon: 'codicon-file-code', color: '#42b883' };
            case 'svelte': return { icon: 'codicon-file-code', color: '#ff3e00' };
            // Data
            case 'json': return { icon: 'codicon-json', color: '#cbcb41' };
            case 'json5': return { icon: 'codicon-json', color: '#cbcb41' };
            case 'yaml':
            case 'yml': return { icon: 'codicon-file-code', color: '#cb171e' };
            case 'xml': return { icon: 'codicon-file-code', color: '#e37933' };
            case 'toml': return { icon: 'codicon-settings-gear', color: '#9c4121' };
            case 'ini':
            case 'cfg': return { icon: 'codicon-settings-gear', color: '#6d8086' };
            // Docs
            case 'md':
            case 'mdx': return { icon: 'codicon-markdown', color: '#519aba' };
            case 'txt': return { icon: 'codicon-file', color: '#c0c0c0' };
            case 'pdf': return { icon: 'codicon-file-pdf', color: '#ff0000' };
            // Compiled
            case 'rs': return { icon: 'codicon-file-code', color: '#dea584' };
            case 'go': return { icon: 'codicon-file-code', color: '#00add8' };
            case 'java': return { icon: 'codicon-file-code', color: '#b07219' };
            case 'class': return { icon: 'codicon-file-binary', color: '#b07219' };
            case 'c':
            case 'h': return { icon: 'codicon-file-code', color: '#555555' };
            case 'cpp':
            case 'cc':
            case 'cxx':
            case 'hpp': return { icon: 'codicon-file-code', color: '#f34b7d' };
            case 'cs': return { icon: 'codicon-file-code', color: '#178600' };
            case 'php': return { icon: 'codicon-file-code', color: '#4f5d95' };
            case 'swift': return { icon: 'codicon-file-code', color: '#f05138' };
            case 'kt':
            case 'kts': return { icon: 'codicon-file-code', color: '#a97bff' };
            case 'scala': return { icon: 'codicon-file-code', color: '#c22d40' };
            case 'dart': return { icon: 'codicon-file-code', color: '#00b4ab' };
            case 'lua': return { icon: 'codicon-file-code', color: '#000080' };
            case 'r': return { icon: 'codicon-file-code', color: '#276dc3' };
            case 'sql': return { icon: 'codicon-database', color: '#e38c00' };
            // Images
            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'gif':
            case 'bmp':
            case 'webp':
            case 'ico': return { icon: 'codicon-file-media', color: '#a074c4' };
            case 'svg': return { icon: 'codicon-file-media', color: '#ffb13b' };
            // Archives
            case 'zip':
            case 'tar':
            case 'gz':
            case 'rar':
            case '7z': return { icon: 'codicon-file-zip', color: '#e0a000' };
            // Lock files
            case 'lock': return { icon: 'codicon-lock', color: '#f7df1e' };
            // Binaries
            case 'exe':
            case 'dll':
            case 'so':
            case 'dylib': return { icon: 'codicon-file-binary', color: '#6d8086' };
            // Docker
            case 'dockerfile': return { icon: 'codicon-file-code', color: '#2496ed' };
            default: return { icon: 'codicon-file', color: '#c0c0c0' };
        }
    };

    const fileInfo = getFileIcon(item.name, item.isDirectory);

    return (
        <div className="file-node">
            <div
                className={`file-item ${item.isDirectory ? 'folder' : 'file'}`}
                onClick={handleClick}
                onContextMenu={(e) => onContextMenu(e, item)}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
            >
                {item.isDirectory && (
                    <span className="expand-arrow">
                        <span className={`codicon ${isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`} />
                    </span>
                )}
                <span className="icon" style={{ color: fileInfo.color }}>
                    {fileInfo.label ? (
                        <span className="file-label">{fileInfo.label}</span>
                    ) : (
                        <span className={`codicon ${fileInfo.icon}`} />
                    )}
                </span>
                <span className="name">{item.name}</span>
            </div>

            {item.isDirectory && isExpanded && (
                <div className="folder-children">
                    {isLoading ? (
                        <div className="loading-item" style={{ paddingLeft: `${12 + (depth + 1) * 16}px` }}>
                            Loading...
                        </div>
                    ) : (
                        children.map((child) => (
                            <FileNode
                                key={child.path}
                                item={child}
                                depth={depth + 1}
                                expandedFolders={expandedFolders}
                                onToggleFolder={onToggleFolder}
                                onFileClick={onFileClick}
                                loadChildren={loadChildren}
                                onContextMenu={onContextMenu}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export function Explorer({ onFileSelect, onCreateFile, rootPath = '', onOpenFolder, symbolSearchQuery, setSymbolSearchQuery }: ExplorerProps) {
    const [rootItems, setRootItems] = useState<FileItem[]>([]);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    // Symbol Search and Outline State
    const [workspaceOutline, setWorkspaceOutline] = useState<Array<{ filePath: string; outline: any }>>([]);
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
            classes.forEach((c: any) => list.push({ name: c.name, kind: 'class', startLine: c.startLine, filePath: item.filePath }));
            functions.forEach((f: any) => list.push({ name: f.name, kind: f.kind || 'function', startLine: f.startLine, filePath: item.filePath }));
            interfaces.forEach((i: any) => list.push({ name: i.name, kind: 'interface', startLine: i.startLine, filePath: item.filePath }));
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
        } catch (e: any) {
            console.error(e);
            alert(`Clone failed: ${e.message || e}`);
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
        const handler = (_event: any, data: string) => {
            setCloneProgress(prev => [...prev, data.trim()]);
        };
        window.ipcRenderer.on('git-clone-progress', handler);
        return () => {
            window.ipcRenderer.off('git-clone-progress', handler);
        };
    }, []);

    const loadDir = async (path: string): Promise<FileItem[]> => {
        try {
            const files = await window.ipcRenderer.invoke('read-dir', path);
            return files.map((f: any) => ({ ...f, children: undefined }));
        } catch (err) {
            console.error('Failed to load directory:', err);
            return [];
        }
    };

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
                    } catch (err) {
                        console.error('Failed to delete:', err);
                        alert('Failed to delete file/folder');
                    }
                }
                break;
            case 'new-file':
                // Pass format: directory path
                const targetDir = item.isDirectory ? item.path : item.path.substring(0, item.path.lastIndexOf(item.name));
                onCreateFile?.(targetDir);
                break;
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

            {/* Rename Dialog */}
            {renameDialogOpen && (
                <div className="modal-overlay" onClick={() => setRenameDialogOpen(false)}>
                    <div className="new-file-dialog" onClick={e => e.stopPropagation()}>
                        <h3>Rename</h3>
                        <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleRenameConfirm();
                                if (e.key === 'Escape') setRenameDialogOpen(false);
                            }}
                            autoFocus
                            onFocus={e => e.target.select()}
                        />
                        <div className="dialog-actions">
                            <button onClick={() => setRenameDialogOpen(false)}>Cancel</button>
                            <button className="primary" onClick={handleRenameConfirm}>Rename</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Clone GitHub Repo Dialog */}
            {cloneDialogOpen && (
                <div className="modal-overlay" onClick={() => setCloneDialogOpen(false)} style={{
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
                                onChange={e => setCloneRepoUrl(e.target.value)}
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
                                    onChange={e => setCloneDestPath(e.target.value)}
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
                                    onClick={async () => {
                                        const path = await window.ipcRenderer.invoke('dialog-open-folder');
                                        if (path) setCloneDestPath(path);
                                    }}
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
                                onClick={() => setCloneDialogOpen(false)}
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
                                onClick={handleCloneConfirm}
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
            )}
        </div>
    );
}
