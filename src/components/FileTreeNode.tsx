import { useState, useEffect, useRef } from 'react';
import { FileItem } from '../helpers/fileTree';

interface FileNodeProps {
    item: FileItem;
    depth: number;
    expandedFolders: Set<string>;
    onToggleFolder: (path: string) => void;
    onFileClick: (item: FileItem) => void;
    loadChildren: (path: string) => Promise<FileItem[]>;
    onContextMenu: (e: React.MouseEvent, item: FileItem) => void;
    refreshTrigger?: number;
}

// eslint-disable-next-line complexity
function getFileIcon(name: string, isDir: boolean, isExpanded: boolean): { icon: string; color: string; label?: string } {
    if (isDir) return {
        icon: isExpanded ? 'codicon-folder-opened' : 'codicon-folder',
        color: '#dcb67a'
    };

    const ext = name.split('.').pop()?.toLowerCase();
    const filename = name.toLowerCase();

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
        case 'ts': return { icon: 'label-ts', color: '#3178c6', label: 'TS' };
        case 'tsx': return { icon: 'label-react', color: '#61dafb', label: '\u269B' };
        case 'js': return { icon: 'label-js', color: '#f7df1e', label: 'JS' };
        case 'jsx': return { icon: 'label-react', color: '#61dafb', label: '\u269B' };
        case 'mjs':
        case 'cjs': return { icon: 'label-js', color: '#f7df1e', label: 'JS' };
        case 'py': return { icon: 'codicon-python', color: '#3776ab' };
        case 'pyw':
        case 'pyx': return { icon: 'codicon-python', color: '#3776ab' };
        case 'rb': return { icon: 'codicon-ruby', color: '#cc342d' };
        case 'rake':
        case 'gemspec': return { icon: 'codicon-ruby', color: '#cc342d' };
        case 'sh':
        case 'bash': return { icon: 'codicon-terminal-bash', color: '#89e051' };
        case 'zsh': return { icon: 'codicon-terminal-bash', color: '#89e051' };
        case 'ps1':
        case 'psm1': return { icon: 'codicon-terminal-powershell', color: '#5391fe' };
        case 'bat':
        case 'cmd': return { icon: 'codicon-terminal', color: '#c1f12e' };
        case 'html':
        case 'htm': return { icon: 'codicon-browser', color: '#e44d26' };
        case 'css': return { icon: 'codicon-symbol-color', color: '#264de4' };
        case 'scss':
        case 'sass': return { icon: 'codicon-symbol-color', color: '#cc6699' };
        case 'less': return { icon: 'codicon-symbol-color', color: '#1d365d' };
        case 'vue': return { icon: 'codicon-file-code', color: '#42b883' };
        case 'svelte': return { icon: 'codicon-file-code', color: '#ff3e00' };
        case 'json': return { icon: 'codicon-json', color: '#cbcb41' };
        case 'json5': return { icon: 'codicon-json', color: '#cbcb41' };
        case 'yaml':
        case 'yml': return { icon: 'codicon-file-code', color: '#cb171e' };
        case 'xml': return { icon: 'codicon-file-code', color: '#e37933' };
        case 'toml': return { icon: 'codicon-settings-gear', color: '#9c4121' };
        case 'ini':
        case 'cfg': return { icon: 'codicon-settings-gear', color: '#6d8086' };
        case 'md':
        case 'mdx': return { icon: 'codicon-markdown', color: '#519aba' };
        case 'txt': return { icon: 'codicon-file', color: '#c0c0c0' };
        case 'pdf': return { icon: 'codicon-file-pdf', color: '#ff0000' };
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
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'bmp':
        case 'webp':
        case 'ico': return { icon: 'codicon-file-media', color: '#a074c4' };
        case 'svg': return { icon: 'codicon-file-media', color: '#ffb13b' };
        case 'zip':
        case 'tar':
        case 'gz':
        case 'rar':
        case '7z': return { icon: 'codicon-file-zip', color: '#e0a000' };
        case 'lock': return { icon: 'codicon-lock', color: '#f7df1e' };
        case 'exe':
        case 'dll':
        case 'so':
        case 'dylib': return { icon: 'codicon-file-binary', color: '#6d8086' };
        case 'dockerfile': return { icon: 'codicon-file-code', color: '#2496ed' };
        default: return { icon: 'codicon-file', color: '#c0c0c0' };
    }
}

export function FileNode({ item, depth, expandedFolders, onToggleFolder, onFileClick, loadChildren, onContextMenu, refreshTrigger = 0 }: FileNodeProps) {
    const [children, setChildren] = useState<FileItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const isExpanded = expandedFolders.has(item.path);
    const lastRefreshTriggerRef = useRef(refreshTrigger);

    useEffect(() => {
        const triggerChanged = lastRefreshTriggerRef.current !== refreshTrigger;
        lastRefreshTriggerRef.current = refreshTrigger;

        if (item.isDirectory && isExpanded && (children.length === 0 || triggerChanged)) {
            setIsLoading(true);
            loadChildren(item.path).then((items) => {
                setChildren(items);
                setIsLoading(false);
            }).catch(() => setIsLoading(false));
        }
    }, [isExpanded, item.path, item.isDirectory, loadChildren, children.length, refreshTrigger]);

    const handleClick = () => {
        if (item.isDirectory) {
            onToggleFolder(item.path);
        } else {
            onFileClick(item);
        }
    };

    const fileInfo = getFileIcon(item.name, item.isDirectory, isExpanded);

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
                                refreshTrigger={refreshTrigger}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
