import { useState, useEffect, useCallback } from 'react';

interface SymbolInfo {
    name: string;
    kind: 'class' | 'function' | 'interface' | 'method';
    startLine: number;
    endLine: number;
    signature: string;
    params: string[];
    docstring: string;
}

interface ReferenceInfo {
    filePath: string;
    line: number;
    column: number;
    lineContent: string;
    context: string;
}

interface CallNode {
    symbol: string;
    filePath: string;
    line: number;
    calls: string[];
}

interface CodeNavigatorPanelProps {
    rootPath?: string;
    onNavigate?: (filePath: string, line: number) => void;
}

// eslint-disable-next-line complexity
export function CodeNavigatorPanel({ rootPath = '.', onNavigate }: CodeNavigatorPanelProps) {
    const [workspaceOutline, setWorkspaceOutline] = useState<Array<{ filePath: string; outline: Record<string, unknown> }>>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    
    const [symbolSymbols, setSymbolSymbols] = useState<{ classes: SymbolInfo[]; functions: SymbolInfo[]; interfaces: SymbolInfo[] }>({ classes: [], functions: [], interfaces: [] });
    const [references, setReferences] = useState<ReferenceInfo[]>([]);
    const [incomingCalls, setIncomingCalls] = useState<CallNode[]>([]);
    const [outgoingCalls, setOutgoingCalls] = useState<CallNode[]>([]);
    
    const [activeTab, setActiveTab] = useState<'symbols' | 'references' | 'calls'>('symbols');
    const [isLoading, setIsLoading] = useState(false);

    const loadWorkspaceOutline = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await window.ipcRenderer.invoke('code:get-workspace-outline', rootPath);
            setWorkspaceOutline(data || []);
        } catch (e) {
            console.error('Failed to load outline:', e);
        } finally {
            setIsLoading(false);
        }
    }, [rootPath]);

    useEffect(() => {
        loadWorkspaceOutline();
    }, [loadWorkspaceOutline]);

    const handleFileSelect = async (filePath: string) => {
        setSelectedFile(filePath);
        setIsLoading(true);
        try {
            const symbols = await window.ipcRenderer.invoke('code:get-symbols', filePath);
            setSymbolSymbols(symbols || { classes: [], functions: [], interfaces: [] });
            setActiveTab('symbols');
        } catch (e) {
            console.error('Failed to get symbols:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSymbolInspect = async (symbolName: string) => {
        setSelectedSymbol(symbolName);
        setIsLoading(true);
        try {
            const refs = await window.ipcRenderer.invoke('code:find-references', symbolName, rootPath);
            setReferences(refs || []);

            const inc = await window.ipcRenderer.invoke('code:get-call-hierarchy', symbolName, rootPath, 'incoming');
            setIncomingCalls(inc || []);

            const out = await window.ipcRenderer.invoke('code:get-call-hierarchy', symbolName, rootPath, 'outgoing');
            setOutgoingCalls(out || []);
        } catch (e) {
            console.error('Failed to inspect symbol:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const getRelativePath = (fullPath: string) => {
        const parts = fullPath.split(/[\\/]/);
        return parts.slice(-2).join('/');
    };

    const filteredOutline = workspaceOutline.filter(item => {
        const filename = item.filePath.toLowerCase();
        return filename.includes(searchQuery.toLowerCase());
    });

    return (
        <div className="code-navigator-panel" style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            color: 'var(--text-primary)',
            background: 'var(--bg-secondary)',
            fontSize: '12px'
        }}>
            <div style={{ padding: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="codicon codicon-symbol-structure" style={{ color: 'var(--accent-primary)' }} />
                    Code Symbol Navigator
                </div>
                <input
                    type="text"
                    placeholder="Search files or symbols..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '6px 8px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        outline: 'none'
                    }}
                />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {isLoading && (
                    <div style={{ padding: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        Loading intelligence metadata...
                    </div>
                )}

                {/* Workspace file outline list */}
                {!selectedFile && !isLoading && (
                    <div style={{ padding: '8px 0' }}>
                        <div style={{ padding: '4px 10px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '10px' }}>
                            WORKSPACE STRUCTURAL OUTLINE
                        </div>
                        {filteredOutline.map(item => (
                            <div
                                key={item.filePath}
                                onClick={() => handleFileSelect(item.filePath)}
                                style={{
                                    padding: '6px 12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                                className="sidebar-item"
                            >
                                <span className="codicon codicon-file-code" style={{ color: '#dea584' }} />
                                <span>{getRelativePath(item.filePath)}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Selected File Details */}
                {selectedFile && (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div style={{ 
                            padding: '8px 10px', 
                            background: 'var(--bg-tertiary)', 
                            borderBottom: '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {getRelativePath(selectedFile)}
                            </span>
                            <button 
                                onClick={() => { setSelectedFile(null); setSelectedSymbol(null); }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <span className="codicon codicon-arrow-left" />
                            </button>
                        </div>

                        {/* Top inspector tabs */}
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                            <button 
                                onClick={() => setActiveTab('symbols')}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    background: activeTab === 'symbols' ? 'var(--bg-active)' : 'transparent',
                                    border: 'none',
                                    color: activeTab === 'symbols' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontWeight: activeTab === 'symbols' ? 600 : 400
                                }}
                            >Symbols</button>
                            <button 
                                onClick={() => setActiveTab('references')}
                                disabled={!selectedSymbol}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    background: activeTab === 'references' ? 'var(--bg-active)' : 'transparent',
                                    border: 'none',
                                    color: activeTab === 'references' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    opacity: selectedSymbol ? 1 : 0.4,
                                    fontWeight: activeTab === 'references' ? 600 : 400
                                }}
                            >Refs</button>
                            <button 
                                onClick={() => setActiveTab('calls')}
                                disabled={!selectedSymbol}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    background: activeTab === 'calls' ? 'var(--bg-active)' : 'transparent',
                                    border: 'none',
                                    color: activeTab === 'calls' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    opacity: selectedSymbol ? 1 : 0.4,
                                    fontWeight: activeTab === 'calls' ? 600 : 400
                                }}
                            >Hierarchy</button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                            {activeTab === 'symbols' && (
                                <div>
                                    {symbolSymbols.classes.map(sym => (
                                        <div key={sym.name} style={{ marginBottom: '8px' }}>
                                            <div 
                                                onClick={() => { handleSymbolInspect(sym.name); if(onNavigate) onNavigate(selectedFile, sym.startLine); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: selectedSymbol === sym.name ? 600 : 400 }}
                                            >
                                                <span className="codicon codicon-symbol-class" style={{ color: '#a074c4' }} />
                                                <span>{sym.name}</span>
                                            </div>
                                        </div>
                                    ))}

                                    {symbolSymbols.functions.map(sym => (
                                        <div key={sym.name} style={{ marginBottom: '8px' }}>
                                            <div 
                                                onClick={() => { handleSymbolInspect(sym.name); if(onNavigate) onNavigate(selectedFile, sym.startLine); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: selectedSymbol === sym.name ? 600 : 400 }}
                                            >
                                                <span className="codicon codicon-symbol-method" style={{ color: '#00add8' }} />
                                                <span>{sym.name}</span>
                                            </div>
                                        </div>
                                    ))}

                                    {symbolSymbols.interfaces.map(sym => (
                                        <div key={sym.name} style={{ marginBottom: '8px' }}>
                                            <div 
                                                onClick={() => { handleSymbolInspect(sym.name); if(onNavigate) onNavigate(selectedFile, sym.startLine); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: selectedSymbol === sym.name ? 600 : 400 }}
                                            >
                                                <span className="codicon codicon-symbol-interface" style={{ color: '#42b883' }} />
                                                <span>{sym.name}</span>
                                            </div>
                                        </div>
                                    ))}

                                    {symbolSymbols.classes.length === 0 && symbolSymbols.functions.length === 0 && symbolSymbols.interfaces.length === 0 && (
                                        <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No symbols found in this file</div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'references' && selectedSymbol && (
                                <div>
                                    <div style={{ fontWeight: 600, marginBottom: '10px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                        REFERENCES FOR: {selectedSymbol}
                                    </div>
                                    {references.map((ref, idx) => (
                                        <div 
                                            key={idx} 
                                            onClick={() => { if(onNavigate) onNavigate(ref.filePath, ref.line); }}
                                            style={{
                                                padding: '6px',
                                                border: '1px solid var(--border-subtle)',
                                                borderRadius: 'var(--radius-sm)',
                                                marginBottom: '8px',
                                                cursor: 'pointer',
                                                background: 'var(--bg-tertiary)'
                                            }}
                                        >
                                            <div style={{ fontWeight: 500, fontSize: '10px', color: 'var(--accent-primary)', marginBottom: '4px' }}>
                                                {getRelativePath(ref.filePath)}:L{ref.line}
                                            </div>
                                            <div style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {ref.lineContent}
                                            </div>
                                        </div>
                                    ))}
                                    {references.length === 0 && (
                                        <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No references found</div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'calls' && selectedSymbol && (
                                <div>
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                            INCOMING CALLS (Called by)
                                        </div>
                                        {incomingCalls.map((c, idx) => (
                                            <div 
                                                key={idx}
                                                onClick={() => { if(onNavigate) onNavigate(c.filePath, c.line); }}
                                                style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                                            >
                                                <span className="codicon codicon-arrow-left" style={{ color: '#ff3e00' }} />
                                                <span>{c.symbol} ({getRelativePath(c.filePath)})</span>
                                            </div>
                                        ))}
                                        {incomingCalls.length === 0 && (
                                            <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '11px' }}>No incoming callers detected</div>
                                        )}
                                    </div>

                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                            OUTGOING CALLS (Calls these)
                                        </div>
                                        {outgoingCalls.map((c, idx) => (
                                            <div key={idx}>
                                                {c.calls.map(childName => (
                                                    <div 
                                                        key={childName}
                                                        onClick={() => handleSymbolInspect(childName)}
                                                        style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                                                    >
                                                        <span className="codicon codicon-arrow-right" style={{ color: '#42b883' }} />
                                                        <span>{childName}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                        {outgoingCalls.length === 0 || outgoingCalls.every(c => c.calls.length === 0) ? (
                                            <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '11px' }}>No outgoing calls detected</div>
                                        ) : null}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
