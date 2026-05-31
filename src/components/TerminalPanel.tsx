import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';

interface TerminalInstance {
    id: string;
    name: string;
    terminal: Terminal;
    fitAddon: FitAddon;
    shellType?: string;
    baseName: string;
}

interface TerminalPanelProps {
    isOpen: boolean;
    height?: number | string;
}

export function TerminalPanel({ isOpen }: TerminalPanelProps) {
    const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
    const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
    const [showShellDropdown, setShowShellDropdown] = useState(false);
    
    // Detect operating system from userAgent to render native choices
    const isWindows = window.navigator.userAgent.toLowerCase().includes('win');

    // Persist the default shell type (initially PowerShell on Windows, Zsh/Bash on macOS/Linux)
    const [defaultShell, setDefaultShell] = useState<{ key?: string; name: string }>(() => {
        try {
            const saved = localStorage.getItem('terminal:defaultShell');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Error loading default terminal shell configuration', e);
        }
        return isWindows
            ? { key: 'powershell', name: 'PowerShell' }
            : { key: 'zsh', name: 'Zsh' };
    });

    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const terminalCounter = useRef(0);

    // Click outside handler for dropdown
    useEffect(() => {
        if (!showShellDropdown) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowShellDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showShellDropdown]);

    // Create a new terminal
    const createTerminal = useCallback((shellType?: string, displayName?: string) => {
        if (!containerRef.current) return;

        const id = `term-${Date.now()}-${terminalCounter.current++}`;
        
        // Resolve active shell type and name (use default if not explicitly provided)
        const activeShellType = shellType !== undefined ? shellType : defaultShell.key;
        const baseName = displayName !== undefined ? displayName : defaultShell.name;

        // If a new shell profile was explicitly chosen, save it as the new default
        if (shellType !== undefined) {
            const newDefault = { key: shellType, name: displayName || 'Terminal' };
            setDefaultShell(newDefault);
            localStorage.setItem('terminal:defaultShell', JSON.stringify(newDefault));
        }

        const terminal = new Terminal({
            theme: {
                background: '#0d1117',
                foreground: '#e6edf3',
                cursor: '#58a6ff',
                cursorAccent: '#0d1117',
                selectionBackground: '#264f78',
            },
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            fontSize: 13,
            cursorBlink: true,
        });

        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);

        const newTerminal: TerminalInstance = { 
            id, 
            name: '', // Will be dynamically computed by reindexTerminalNames
            terminal, 
            fitAddon, 
            shellType: activeShellType, 
            baseName 
        };

        setTerminals(prev => {
            const updated = [...prev, newTerminal];
            return reindexTerminalNames(updated);
        });
        setActiveTerminalId(id);

        // Initialize PTY with ID and target shell type
        window.ipcRenderer.invoke('term-init', id, activeShellType).catch(console.error);

        // Handle Input
        terminal.onData((data) => {
            window.ipcRenderer.invoke('term-input', id, data);
        });

        return newTerminal;
    }, [terminals.length, defaultShell]);

    // Close a terminal
    const closeTerminal = useCallback((id: string) => {
        const terminalInstance = terminals.find(t => t.id === id);
        if (terminalInstance) {
            terminalInstance.terminal.dispose();
            window.ipcRenderer.invoke('term-close', id).catch(console.error);
        }

        setTerminals(prev => {
            const remaining = prev.filter(t => t.id !== id);
            const reindexed = reindexTerminalNames(remaining);
            if (activeTerminalId === id && reindexed.length > 0) {
                setActiveTerminalId(reindexed[reindexed.length - 1].id);
            } else if (reindexed.length === 0) {
                setActiveTerminalId(null);
            }
            return reindexed;
        });
    }, [terminals, activeTerminalId]);

    // Handle incoming data from PTY
    useEffect(() => {
        const listener = (_event: any, terminalId: string, data: string) => {
            const terminalInstance = terminals.find(t => t.id === terminalId);
            if (terminalInstance) {
                terminalInstance.terminal.write(data);
            }
        };

        window.ipcRenderer.on('terminal-incoming', listener);
        return () => {
            window.ipcRenderer.off('terminal-incoming', listener);
        };
    }, [terminals]);

    // Create first terminal on mount
    useEffect(() => {
        if (isOpen && terminals.length === 0) {
            createTerminal();
        }
    }, [isOpen, terminals.length, createTerminal]);

    // Attach active terminal to DOM
    useEffect(() => {
        if (!containerRef.current || !activeTerminalId) return;

        const activeTerminal = terminals.find(t => t.id === activeTerminalId);
        if (!activeTerminal) return;

        // Clear container and attach
        containerRef.current.innerHTML = '';
        activeTerminal.terminal.open(containerRef.current);
        activeTerminal.fitAddon.fit();

        // Resize observer
        const resizeObserver = new ResizeObserver(() => {
            activeTerminal.fitAddon.fit();
            const { cols, rows } = activeTerminal.terminal;
            if (cols > 0 && rows > 0) {
                window.ipcRenderer.invoke('term-resize', activeTerminalId, cols, rows);
            }
        });
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
        };
    }, [activeTerminalId, terminals]);

    if (!isOpen) return null;

    const shellOptions = isWindows
        ? [
            { key: 'powershell', name: 'PowerShell', info: 'Windows PowerShell' },
            { key: 'cmd', name: 'Command Prompt', info: 'cmd.exe' },
            { key: 'bash', name: 'Git Bash', info: 'Git Bash' }
          ]
        : [
            { key: 'zsh', name: 'Zsh', info: 'zsh' },
            { key: 'bash', name: 'Bash', info: 'bash' },
            { key: 'sh', name: 'Sh', info: 'sh' }
          ];

    return (
        <div className="terminal-panel">
            <div className="terminal-tabs">
                {terminals.map((t) => (
                    <div
                        key={t.id}
                        className={`terminal-tab ${t.id === activeTerminalId ? 'active' : ''}`}
                        onClick={() => setActiveTerminalId(t.id)}
                    >
                        <span className="terminal-tab-name">{t.name}</span>
                        <button
                            className="terminal-tab-close"
                            onClick={(e) => {
                                e.stopPropagation();
                                closeTerminal(t.id);
                            }}
                        >
                            ×
                        </button>
                    </div>
                ))}
                
                <div className="terminal-actions-container" ref={dropdownRef}>
                    <button 
                        className="terminal-add-btn" 
                        onClick={() => createTerminal()}
                        title={`New Terminal (${defaultShell.name})`}
                    >
                        +
                    </button>
                    <button 
                        className="terminal-dropdown-trigger-btn" 
                        onClick={() => setShowShellDropdown(prev => !prev)}
                        title="Select Default Profile"
                    >
                        <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
                            <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
                        </svg>
                    </button>
                    
                    {showShellDropdown && (
                        <div className="terminal-shell-dropdown">
                            {shellOptions.map((opt) => (
                                <button
                                    key={opt.key}
                                    className="terminal-shell-item"
                                    onClick={() => {
                                        createTerminal(opt.key, opt.name);
                                        setShowShellDropdown(false);
                                    }}
                                >
                                    <span className="terminal-shell-icon-wrapper" style={{ color: getShellIconColor(opt.key) }}>
                                        {getShellIcon(opt.key)}
                                    </span>
                                    <div className="terminal-shell-info">
                                        <div className="terminal-shell-name">{opt.name}</div>
                                        <div className="terminal-shell-desc">{opt.info}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="terminal-container" ref={containerRef} />
        </div>
    );
}

function reindexTerminalNames(list: TerminalInstance[]): TerminalInstance[] {
    const counts: Record<string, number> = {};
    return list.map(t => {
        const base = t.baseName || 'Terminal';
        counts[base] = (counts[base] || 0) + 1;
        const index = counts[base];
        return {
            ...t,
            name: `${base} ${index}`
        };
    });
}

function getShellIcon(key: string) {
    switch (key) {
        case 'powershell':
            return (
                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                    <path d="M5.854 4.854a.5.5 0 1 0-.708-.708l-3.5 3.5a.5.5 0 0 0 0 .708l3.5 3.5a.5.5 0 0 0 .708-.708L2.707 8l3.147-3.146zm4.292 6.292a.5.5 0 0 0 .708.708l3.5-3.5a.5.5 0 0 0 0-.708l-3.5-3.5a.5.5 0 0 0-.708.708L13.293 8l-3.147 3.146z" />
                </svg>
            );
        case 'cmd':
            return (
                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                    <path d="M10.478 1.647a.5.5 0 1 0-.956-.294l-4 13a.5.5 0 0 0 .956.294l4-13zM4.854 4.146a.5.5 0 1 0-.708-.708l-3.5 3.5a.5.5 0 0 0 0 .708l3.5 3.5a.5.5 0 0 0 .708-.708L1.707 7.5l3.147-3.354z" />
                </svg>
            );
        case 'bash':
        case 'zsh':
        case 'sh':
        default:
            return (
                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                    <path d="M2 3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2zm3.354 2.854L7.5 8l-2.146 2.146a.5.5 0 0 1-.708-.708L6.293 8 4.646 6.354a.5.5 0 1 1 .708-.708zM9 9.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5z" />
                </svg>
            );
    }
}

function getShellIconColor(key: string) {
    switch (key) {
        case 'powershell':
            return '#38bdf8'; // Sky blue
        case 'cmd':
            return '#4ade80'; // Emerald green
        case 'bash':
            return '#f97316'; // Git orange
        case 'zsh':
            return '#a855f7'; // Purple
        case 'sh':
            return '#94a3b8'; // Slate
        default:
            return '#f8fafc';
    }
}
