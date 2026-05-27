import React, { useState } from 'react';
import { ContextMenu } from './ContextMenu';

interface TopBarProps {
    activeSection: string;
    files: any[]; // Ideally strict OpenFile type
    activeFilePath: string;
    setActiveFilePath: (path: string) => void;
    handleCloseFile: (e: React.MouseEvent, path: string) => void;
    handleCreateFile: () => void;
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    chatOpen: boolean;
    setChatOpen: (open: boolean) => void;
    terminalOpen: boolean;
    setTerminalOpen: (open: boolean) => void;
    vimEnabled: boolean;
    setVimEnabled: (enabled: boolean) => void;
    onOpenSettings: () => void;
}

export function TopBar({
    activeSection,
    files,
    activeFilePath,
    setActiveFilePath,
    handleCloseFile,
    handleCreateFile,
    sidebarOpen,
    setSidebarOpen,
    chatOpen,
    setChatOpen,
    terminalOpen,
    setTerminalOpen,
    vimEnabled,
    setVimEnabled,
    onOpenSettings
}: TopBarProps) {
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, file: any } | null>(null);

    const handleContextMenu = (e: React.MouseEvent, file: any) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, file });
    };

    const handleMenuAction = async (action: string) => {
        if (!contextMenu) return;
        const { file } = contextMenu;

        switch (action) {
            case 'copy-path':
                try {
                    const resolved = await window.ipcRenderer.invoke('resolve-path', file.path);
                    await navigator.clipboard.writeText(resolved || file.path);
                } catch (e) {
                    console.error('Failed to copy resolved path', e);
                    await navigator.clipboard.writeText(file.path);
                }
                break;
            case 'close':
                handleCloseFile({ stopPropagation: () => { } } as React.MouseEvent, file.path);
                break;
        }
        setContextMenu(null);
    };

    return (
        <header className="top-bar">
            <div className="tab-bar">
                {activeSection === 'search' ? (
                    <div className="tab active">Search Results</div>
                ) : (
                    files.map(file => (
                        <div
                            key={file.path}
                            className={`tab ${file.path === activeFilePath ? 'active' : ''}`}
                            onClick={() => setActiveFilePath(file.path)}
                            onContextMenu={(e) => handleContextMenu(e, file)}
                        >
                            <span className="codicon codicon-file" style={{ marginRight: 4 }} />
                            {file.name}{file.isDirty ? ' ●' : ''}
                            <span
                                className="tab-close"
                                onClick={(e) => handleCloseFile(e, file.path)}
                            >
                                <span className="codicon codicon-close" />
                            </span>
                        </div>
                    ))
                )}
                <button className="new-file-btn" onClick={handleCreateFile} title="New File">
                    <span className="codicon codicon-add" />
                </button>
            </div>

            <div className="top-bar-actions">
                <button
                    className={`action-btn ${!sidebarOpen ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    title="Toggle Sidebar"
                >
                    <span className={`codicon ${sidebarOpen ? 'codicon-layout-sidebar-left' : 'codicon-layout-sidebar-left-off'}`} />
                </button>
                <button
                    className={`action-btn ${chatOpen ? 'active' : ''}`}
                    onClick={() => setChatOpen(!chatOpen)}
                    title="Toggle AI Chat"
                >
                    <span className="codicon codicon-comment-discussion" />
                </button>
                <button
                    className={`action-btn ${terminalOpen ? 'active' : ''}`}
                    onClick={() => setTerminalOpen(!terminalOpen)}
                    title="Toggle Terminal"
                >
                    <span className="codicon codicon-terminal" />
                </button>
                <label className="vim-toggle">
                    <input
                        type="checkbox"
                        checked={vimEnabled}
                        onChange={(e) => setVimEnabled(e.target.checked)}
                    />
                    <span>Vim</span>
                </label>
                <button
                    className="action-btn"
                    onClick={onOpenSettings}
                    title="Settings"
                >
                    <span className="codicon codicon-settings-gear" />
                </button>
            </div>
            {
                contextMenu && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        items={[
                            { label: 'Copy Path', action: () => handleMenuAction('copy-path') },
                            { label: 'Close', action: () => handleMenuAction('close'), danger: true }
                        ]}
                        onClose={() => setContextMenu(null)}
                    />
                )
            }
        </header >
    );
}

