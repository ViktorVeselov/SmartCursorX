import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';

interface TerminalInstance {
    id: string;
    name: string;
    terminal: Terminal;
    fitAddon: FitAddon;
}

interface TerminalPanelProps {
    isOpen: boolean;
    height?: number | string;
}

export function TerminalPanel({ isOpen }: TerminalPanelProps) {
    const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
    const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalCounter = useRef(0);

    // Create a new terminal
    const createTerminal = useCallback(() => {
        if (!containerRef.current) return;

        const id = `term-${Date.now()}-${terminalCounter.current++}`;
        const name = `Terminal ${terminals.length + 1}`;

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

        const newTerminal: TerminalInstance = { id, name, terminal, fitAddon };
        setTerminals(prev => [...prev, newTerminal]);
        setActiveTerminalId(id);

        // Initialize PTY with ID
        window.ipcRenderer.invoke('term-init', id).catch(console.error);

        // Handle Input
        terminal.onData((data) => {
            window.ipcRenderer.invoke('term-input', id, data);
        });

        return newTerminal;
    }, [terminals.length]);

    // Close a terminal
    const closeTerminal = useCallback((id: string) => {
        const terminalInstance = terminals.find(t => t.id === id);
        if (terminalInstance) {
            terminalInstance.terminal.dispose();
            window.ipcRenderer.invoke('term-close', id).catch(console.error);
        }

        setTerminals(prev => {
            const newTerminals = prev.filter(t => t.id !== id);
            if (activeTerminalId === id && newTerminals.length > 0) {
                setActiveTerminalId(newTerminals[newTerminals.length - 1].id);
            } else if (newTerminals.length === 0) {
                setActiveTerminalId(null);
            }
            return newTerminals;
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
                <button className="terminal-add-btn" onClick={createTerminal}>
                    +
                </button>
            </div>
            <div className="terminal-container" ref={containerRef} />
        </div>
    );
}
