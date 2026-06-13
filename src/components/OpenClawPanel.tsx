import { useState, useEffect } from 'react';

export function OpenClawPanel() {
    const [openClawMessage, setOpenClawMessage] = useState('');
    const [thinkingDepth, setThinkingDepth] = useState<'low' | 'medium' | 'high'>('medium');
    const [agentRunning, setAgentRunning] = useState(false);
    const [agentStreamOutput, setAgentStreamOutput] = useState('');
    const [openClawInstalled, setOpenClawInstalled] = useState(false);
    const [gatewayRunning, setGatewayRunning] = useState(false);

    useEffect(() => {
        const init = async () => {
            const installed = await window.ipcRenderer.invoke('openclaw:check-installed');
            setOpenClawInstalled(installed);
            if (installed) {
                const status = await window.ipcRenderer.invoke('openclaw:get-status');
                setGatewayRunning(status.isRunning);
            }
        };
        init();
    }, []);

    const handleRunAgent = async () => {
        if (!openClawMessage.trim() || agentRunning) return;

        setAgentRunning(true);
        setAgentStreamOutput('Initializing OpenClaw personal assistant stream...\n\n');

        const handleChunk = (_event: unknown, chunk: string) => {
            setAgentStreamOutput(prev => prev + chunk);
        };

        const handleComplete = (_event: unknown, code: number) => {
            setAgentStreamOutput(prev => prev + `\n\n[OpenClaw Assistant Finished - Exit Code ${code}]`);
            setAgentRunning(false);
            window.ipcRenderer.off('openclaw:agent-stream', handleChunk);
            window.ipcRenderer.off('openclaw:agent-complete', handleComplete);
        };

        window.ipcRenderer.on('openclaw:agent-stream', handleChunk);
        window.ipcRenderer.on('openclaw:agent-complete', handleComplete);

        try {
            await window.ipcRenderer.invoke('openclaw:run-agent', openClawMessage, thinkingDepth);
        } catch (e: unknown) {
            setAgentStreamOutput(prev => prev + `\n\nError executing agent: ${e instanceof Error ? e.message : String(e)}`);
            setAgentRunning(false);
            window.ipcRenderer.off('openclaw:agent-stream', handleChunk);
            window.ipcRenderer.off('openclaw:agent-complete', handleComplete);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🦞</span>
                    <span>OpenClaw Gateway Assistant</span>
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: gatewayRunning ? '#10b981' : '#6b7280',
                        boxShadow: gatewayRunning ? '0 0 6px #10b981' : 'none'
                    }} />
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                        {gatewayRunning ? 'Gateway Active' : 'Gateway Offline'}
                    </span>
                </div>
            </div>

            {!openClawInstalled ? (
                <div style={{
                    padding: 16,
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    lineHeight: 1.5
                }}>
                    <span className="codicon codicon-warning" style={{ marginRight: 6, color: '#ef4444' }} />
                    <strong>OpenClaw is not fully configured.</strong> Please open settings modal and navigate to the
                    <strong> OpenClaw</strong> tab to check system configuration requirements and startup diagnostics.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>

                    {/* Task message input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Task Message</label>
                        <textarea
                            value={openClawMessage}
                            onChange={e => setOpenClawMessage(e.target.value)}
                            placeholder="Ask OpenClaw assistant to perform a multi-agent task (e.g., 'Summarize today's alerts' or 'Build package checklist')..."
                            rows={4}
                            style={{
                                width: '100%',
                                padding: 10,
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 12,
                                resize: 'vertical',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    {/* Thinking options */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Reasoning Depth:</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {(['low', 'medium', 'high'] as const).map(depth => (
                                    <button
                                        key={depth}
                                        onClick={() => setThinkingDepth(depth)}
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: 10,
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            border: '1px solid var(--border-subtle)',
                                            textTransform: 'capitalize',
                                            background: thinkingDepth === depth ? 'var(--bg-active)' : 'transparent',
                                            color: thinkingDepth === depth ? 'var(--text-primary)' : 'var(--text-secondary)'
                                        }}
                                    >
                                        {depth}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleRunAgent}
                            disabled={agentRunning || !openClawMessage.trim()}
                            style={{
                                padding: '8px 16px',
                                background: 'var(--accent-primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                cursor: openClawMessage.trim() ? 'pointer' : 'not-allowed',
                                fontSize: 11,
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                opacity: openClawMessage.trim() && !agentRunning ? 1 : 0.5,
                                transition: 'all 0.2s'
                            }}
                        >
                            {agentRunning ? (
                                <span className="codicon codicon-loading codicon-modifier-spin" />
                            ) : (
                                <span className="codicon codicon-play" />
                            )}
                            <span>Run Agent</span>
                        </button>
                    </div>

                    {/* Monospace Output Screen */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 180 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Streaming Output</label>
                        <div style={{
                            flex: 1,
                            background: '#0a0b0e',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 12,
                            fontFamily: 'monospace',
                            fontSize: 11,
                            color: '#c0caf5',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.4
                        }}>
                            {agentStreamOutput || (
                                <span style={{ color: '#565f89', fontStyle: 'italic' }}>
                                    Interactive assistant output will stream here.
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
