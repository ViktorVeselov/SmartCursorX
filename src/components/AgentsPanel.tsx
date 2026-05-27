import { useState, useEffect } from 'react';
import { VisualWorkflowEditor } from './VisualWorkflowEditor';

interface Agent {
    id: number;
    name: string;
    system_prompt: string;
    created_at: string;
}

interface Flow {
    id: number;
    name: string;
    description: string;
    steps: any; // Now stores { nodes, edges } or legacy array
    agent_id: number;
    agent_name?: string; // from join
    created_at: string;
}

interface AgentsPanelProps {
    onRunFlow?: (agent: Agent, flow: Flow) => void;
    onOpenFlow?: (flow: Flow) => void;
}

export function AgentsPanel({ onRunFlow, onOpenFlow }: AgentsPanelProps) {
    const [activeTab, setActiveTab] = useState<'agents' | 'flows' | 'openclaw'>('agents');
    const [agents, setAgents] = useState<Agent[]>([]);
    const [flows, setFlows] = useState<Flow[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);

    // UX States
    const [isInlineEditorOpen, setIsInlineEditorOpen] = useState(false); // Collapsible state

    // OpenClaw sidebar states
    const [openClawMessage, setOpenClawMessage] = useState('');
    const [thinkingDepth, setThinkingDepth] = useState<'low' | 'medium' | 'high'>('medium');
    const [agentRunning, setAgentRunning] = useState(false);
    const [agentStreamOutput, setAgentStreamOutput] = useState('');
    const [openClawInstalled, setOpenClawInstalled] = useState(false);
    const [gatewayRunning, setGatewayRunning] = useState(false);

    // Editing states
    const [editMode, setEditMode] = useState(false);
    const [formName, setFormName] = useState('');
    const [formContent, setFormContent] = useState(''); // Prompt or Description
    const [formGraphData, setFormGraphData] = useState<any>(null); // { nodes, edges }
    const [formAgentId, setFormAgentId] = useState<number | undefined>(undefined);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        try {
            if (activeTab === 'openclaw') {
                const installed = await window.ipcRenderer.invoke('openclaw:check-installed');
                setOpenClawInstalled(installed);
                if (installed) {
                    const status = await window.ipcRenderer.invoke('openclaw:get-status');
                    setGatewayRunning(status.isRunning);
                }
                return;
            }

            if (activeTab === 'agents') {
                const data = await window.ipcRenderer.invoke('db-get-agents');
                setAgents(data);
            } else {
                const aData = await window.ipcRenderer.invoke('db-get-agents');
                setAgents(aData); // Need agents for dropdown
                const fData = await window.ipcRenderer.invoke('db-get-flows');
                setFlows(fData);
            }
        } catch (e) {
            console.error('Failed to load data', e);
        }
    };

    const handleRunAgent = async () => {
        if (!openClawMessage.trim() || agentRunning) return;
        
        setAgentRunning(true);
        setAgentStreamOutput('Initializing OpenClaw personal assistant stream...\n\n');

        const handleChunk = (_event: any, chunk: string) => {
            setAgentStreamOutput(prev => prev + chunk);
        };

        const handleComplete = (_event: any, code: number) => {
            setAgentStreamOutput(prev => prev + `\n\n[OpenClaw Assistant Finished - Exit Code ${code}]`);
            setAgentRunning(false);
            window.ipcRenderer.off('openclaw:agent-stream', handleChunk);
            window.ipcRenderer.off('openclaw:agent-complete', handleComplete);
        };

        window.ipcRenderer.on('openclaw:agent-stream', handleChunk);
        window.ipcRenderer.on('openclaw:agent-complete', handleComplete);

        try {
            await window.ipcRenderer.invoke('openclaw:run-agent', openClawMessage, thinkingDepth);
        } catch (e: any) {
            setAgentStreamOutput(prev => prev + `\n\nError executing agent: ${e.message || e}`);
            setAgentRunning(false);
            window.ipcRenderer.off('openclaw:agent-stream', handleChunk);
            window.ipcRenderer.off('openclaw:agent-complete', handleComplete);
        }
    };

    const handleSaveAgent = async () => {
        if (!formName.trim()) return;
        try {
            await window.ipcRenderer.invoke('db-add-agent', formName, formContent);
            setEditMode(false);
            loadData();
        } catch (e) {
            console.error(e);
        }
    };

    const handleSaveFlow = async () => {
        if (!formName.trim()) return;
        try {
            await window.ipcRenderer.invoke('db-add-flow', formName, formContent, formGraphData || { nodes: [], edges: [] }, formAgentId);
            setEditMode(false);
            loadData();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure?')) return;
        try {
            await window.ipcRenderer.invoke(activeTab === 'agents' ? 'db-delete-agent' : 'db-delete-flow', id);
            if (activeTab === 'agents' && selectedAgent?.id === id) setSelectedAgent(null);
            if (activeTab === 'flows' && selectedFlow?.id === id) setSelectedFlow(null);
            loadData();
        } catch (e) {
            console.error(e);
        }
    };

    const startCreate = () => {
        setEditMode(true);
        setSelectedAgent(null);
        setSelectedFlow(null);
        setFormName('');
        setFormContent('');
        setFormGraphData(null);
        setFormAgentId(agents[0]?.id);
    };

    const handleSelectAgent = (agent: Agent) => {
        setEditMode(false);
        setSelectedAgent(agent);
    };

    const handleSelectFlow = (flow: Flow) => {
        setEditMode(false);
        setSelectedFlow(flow);
        setIsInlineEditorOpen(false); // Reset on selection change
    };

    const handleUpdateFlowGraph = async (nodes: any[], edges: any[]) => {
        if (!selectedFlow) return;
        try {
            const steps = { nodes, edges }; // New format
            await window.ipcRenderer.invoke('db-update-flow', selectedFlow.id, steps);
            // Updating local state to match without reload
            setSelectedFlow({ ...selectedFlow, steps });
            setFlows(prev => prev.map(f => f.id === selectedFlow.id ? { ...f, steps } : f));
        } catch (e) {
            console.error('Failed to update flow graph', e);
        }
    };

    const handleRun = () => {
        if (selectedFlow && onRunFlow) {
            const agent = agents.find(a => a.id === selectedFlow.agent_id);
            if (agent) {
                onRunFlow(agent, selectedFlow);
            } else {
                alert('No agent assigned to this flow');
            }
        }
    };

    return (
        <div className="agents-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="ap-header" style={{ display: 'flex', padding: '8px 12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', width: '100%', gap: 4, background: 'rgba(0,0,0,0.2)', padding: 3, borderRadius: 'var(--radius-md)' }}>
                    <button
                        className={`tab-btn ${activeTab === 'agents' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('agents'); setEditMode(false); }}
                        style={{
                            flex: 1,
                            padding: '6px 12px',
                            background: activeTab === 'agents' ? 'var(--bg-active)' : 'transparent',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            color: activeTab === 'agents' ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: activeTab === 'agents' ? 600 : 500,
                            cursor: 'pointer',
                            fontSize: '11px',
                            transition: 'all 0.2s'
                        }}
                    >
                        Agents
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'flows' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('flows'); setEditMode(false); }}
                        style={{
                            flex: 1,
                            padding: '6px 12px',
                            background: activeTab === 'flows' ? 'var(--bg-active)' : 'transparent',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            color: activeTab === 'flows' ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: activeTab === 'flows' ? 600 : 500,
                            cursor: 'pointer',
                            fontSize: '11px',
                            transition: 'all 0.2s'
                        }}
                    >
                        Flows
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'openclaw' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('openclaw'); setEditMode(false); }}
                        style={{
                            flex: 1,
                            padding: '6px 12px',
                            background: activeTab === 'openclaw' ? 'var(--bg-active)' : 'transparent',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            color: activeTab === 'openclaw' ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: activeTab === 'openclaw' ? 600 : 500,
                            cursor: 'pointer',
                            fontSize: '11px',
                            transition: 'all 0.2s'
                        }}
                    >
                        🦞 OpenClaw
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* List Side */}
                {activeTab !== 'openclaw' && (
                    <div style={{ width: '40%', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: 8, borderBottom: '1px solid var(--border-color)' }}>
                        <button
                            onClick={startCreate}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'var(--accent-primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 600,
                                transition: 'all 0.2s ease',
                                boxShadow: '0 2px 8px rgba(0, 122, 204, 0.2)'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.filter = 'brightness(1.1)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 122, 204, 0.35)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.filter = 'none';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 122, 204, 0.2)';
                            }}
                        >
                            + New {activeTab === 'agents' ? 'Agent' : 'Flow'}
                        </button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {activeTab === 'agents'
                            ? agents.map(a => (
                                <div
                                    key={a.id}
                                    onClick={() => handleSelectAgent(a)}
                                    className={`list-item ${selectedAgent?.id === a.id ? 'active' : ''}`}
                                    style={{ padding: '8px 12px', cursor: 'pointer', background: selectedAgent?.id === a.id ? 'var(--bg-tertiary)' : 'transparent', borderBottom: '1px solid var(--border-color)' }}
                                >
                                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                                </div>
                            ))
                            : flows.map(f => (
                                <div
                                    key={f.id}
                                    onClick={() => handleSelectFlow(f)}
                                    className={`list-item ${selectedFlow?.id === f.id ? 'active' : ''}`}
                                    style={{ padding: '8px 12px', cursor: 'pointer', background: selectedFlow?.id === f.id ? 'var(--bg-tertiary)' : 'transparent', borderBottom: '1px solid var(--border-color)' }}
                                >
                                    <div style={{ fontWeight: 600 }}>{f.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{f.agent_name || 'No Agent'}</div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}

                {/* Content Side */}
                <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
                    {activeTab === 'openclaw' ? (
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
                    ) : editMode ? (
                        <div className="editor-form">
                            <h3>Create/Edit {activeTab === 'agents' ? 'Agent' : 'Flow'}</h3>
                            <div style={{ marginBottom: 12 }}>
                                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Name</label>
                                <input
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    style={{ width: '100%', padding: 6, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            {activeTab === 'agents' ? (
                                <div style={{ marginBottom: 12 }}>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>System Prompt / Persona</label>
                                    <textarea
                                        value={formContent}
                                        onChange={e => setFormContent(e.target.value)}
                                        rows={10}
                                        style={{ width: '100%', padding: 6, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                        placeholder="You are an expert coder..."
                                    />
                                    <button
                                        onClick={handleSaveAgent}
                                        style={{
                                            padding: '8px 16px',
                                            background: 'var(--accent-primary)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            transition: 'all 0.2s ease',
                                            marginTop: 8,
                                            boxShadow: '0 2px 8px rgba(0, 122, 204, 0.2)'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                                        onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
                                    >
                                        Save Agent
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ marginBottom: 12 }}>
                                        <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Description</label>
                                        <input
                                            value={formContent}
                                            onChange={e => setFormContent(e.target.value)}
                                            style={{ width: '100%', padding: 6, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: 12 }}>
                                        <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Assigned Agent</label>
                                        <select
                                            value={formAgentId}
                                            onChange={e => setFormAgentId(Number(e.target.value))}
                                            style={{ width: '100%', padding: 6, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                        >
                                            <option value="">Select Agent...</option>
                                            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                    </div>
                                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', margin: '16px 0' }}>
                                        Workflow step editing is available in the main editor after creating the flow.
                                    </p>
                                    <button
                                        onClick={handleSaveFlow}
                                        style={{
                                            padding: '8px 16px',
                                            background: 'var(--accent-primary)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            transition: 'all 0.2s ease',
                                            marginTop: 8,
                                            boxShadow: '0 2px 8px rgba(0, 122, 204, 0.2)'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                                        onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
                                    >
                                        Save Flow
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        // Details View
                        <div>
                            {activeTab === 'agents' && selectedAgent && (
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h2>{selectedAgent.name}</h2>
                                        <button onClick={() => handleDelete(selectedAgent.id)} className="icon-btn" title="Delete"><span className="codicon codicon-trash" /></button>
                                    </div>
                                    <div style={{ marginTop: 20 }}>
                                        <h4>System Prompt:</h4>
                                        <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--bg-tertiary)', padding: 12, borderRadius: 6, fontSize: 13 }}>{selectedAgent.system_prompt}</pre>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'flows' && selectedFlow && (
                                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                        <div>
                                            <h2 style={{ margin: 0 }}>{selectedFlow.name}</h2>
                                            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 12 }}>{selectedFlow.description}</p>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {/* Run Flow Button */}
                                            <button
                                                onClick={handleRun}
                                                style={{
                                                    padding: '8px 16px',
                                                    background: '#2ecc71',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    borderRadius: 'var(--radius-md)',
                                                    cursor: 'pointer',
                                                    fontWeight: 600,
                                                    fontSize: '12px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    transition: 'all 0.2s ease',
                                                    boxShadow: '0 2px 8px rgba(46, 204, 113, 0.2)'
                                                }}
                                                onMouseOver={(e) => {
                                                    e.currentTarget.style.filter = 'brightness(1.05)';
                                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(46, 204, 113, 0.35)';
                                                }}
                                                onMouseOut={(e) => {
                                                    e.currentTarget.style.filter = 'none';
                                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(46, 204, 113, 0.2)';
                                                }}
                                            >
                                                <span className="codicon codicon-play" />
                                                Run Flow
                                            </button>
                                            <button onClick={() => handleDelete(selectedFlow.id)} className="icon-btn" title="Delete"><span className="codicon codicon-trash" /></button>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 24 }}>
                                        {/* Inline Editor Toggle */}
                                        <div style={{ marginBottom: 12, border: '1px solid var(--border-color)', borderRadius: 6, overflow: 'hidden' }}>
                                            <div
                                                onClick={() => setIsInlineEditorOpen(!isInlineEditorOpen)}
                                                style={{ padding: '8px 12px', background: 'var(--bg-secondary)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
                                            >
                                                <span style={{ fontWeight: 600, fontSize: 13 }}>Quick Edit Graph</span>
                                                <span className={`codicon codicon-chevron-${isInlineEditorOpen ? 'down' : 'right'}`} />
                                            </div>
                                            {isInlineEditorOpen && (
                                                <div style={{ height: 400, borderTop: '1px solid var(--border-color)', position: 'relative' }}>
                                                    <VisualWorkflowEditor
                                                        initialNodes={selectedFlow.steps?.nodes || []}
                                                        initialEdges={selectedFlow.steps?.edges || []}
                                                        onSave={handleUpdateFlowGraph}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => onOpenFlow && onOpenFlow(selectedFlow)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 16px',
                                                background: 'var(--bg-secondary)',
                                                border: '1px solid var(--border-subtle)',
                                                color: 'var(--text-primary)',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 8,
                                                fontWeight: 600,
                                                fontSize: '12px',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onMouseOver={(e) => {
                                                e.currentTarget.style.background = 'var(--bg-hover)';
                                                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                                            }}
                                            onMouseOut={(e) => {
                                                e.currentTarget.style.background = 'var(--bg-secondary)';
                                                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                            }}
                                        >
                                            <span className="codicon codicon-layout-panel" style={{ fontSize: 14 }} />
                                            Open Full Editor
                                        </button>
                                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, textAlign: 'center' }}>
                                            Opens the workflow graph in a full-screen tab.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {!selectedAgent && !selectedFlow && (
                                <div style={{ textAlign: 'center', marginTop: 100, color: 'var(--text-secondary)' }}>
                                    Select an item or create new.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
