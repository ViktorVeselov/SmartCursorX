import { useState, useEffect, useMemo } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Handle,
    Position,
    Node,
    Edge,
    NodeProps,
    BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const getIpc = () => window.ipcRenderer;

const ALL_PROVIDERS = ['openai', 'anthropic', 'gemini', 'openrouter', 'ollama', 'local', 'zen', 'litellm'];

interface RouteConfig {
    provider: string;
    model: string;
}

interface PipelineConfig {
    chat: RouteConfig;
    investigation: RouteConfig;
    plan_exploration: RouteConfig;
    plan_generation: RouteConfig;
    read_analyze: RouteConfig;
    code_generation: RouteConfig;
    verification_judge: RouteConfig;
    verification_fix: RouteConfig;
}

type TaskKey = keyof PipelineConfig;

const TASK_DESCRIPTIONS: Record<TaskKey, string> = {
    chat: 'Main conversation and code generation',
    investigation: 'Deep-dive analysis and root cause exploration',
    plan_exploration: 'Explore approaches before generating a plan',
    plan_generation: 'Generate structured execution plans',
    read_analyze: 'Read and analyze file contents',
    code_generation: 'Generate new code or modify existing code',
    verification_judge: 'Judge whether output passes verification',
    verification_fix: 'Fix output that failed verification',
};

const DEFAULT_ROUTE: RouteConfig = { provider: 'openai', model: 'gpt-4o' };

const DEFAULT_CONFIG: PipelineConfig = {
    chat: { ...DEFAULT_ROUTE },
    investigation: { ...DEFAULT_ROUTE },
    plan_exploration: { ...DEFAULT_ROUTE },
    plan_generation: { ...DEFAULT_ROUTE },
    read_analyze: { ...DEFAULT_ROUTE },
    code_generation: { ...DEFAULT_ROUTE },
    verification_judge: { ...DEFAULT_ROUTE },
    verification_fix: { ...DEFAULT_ROUTE },
};

const TASK_KEYS: TaskKey[] = [
    'chat', 'investigation', 'plan_exploration', 'plan_generation',
    'read_analyze', 'code_generation', 'verification_judge', 'verification_fix',
];

const TASK_LABELS: Record<TaskKey, string> = {
    chat: 'Chat',
    investigation: 'Investigation',
    plan_exploration: 'Plan Exploration',
    plan_generation: 'Plan Generation',
    read_analyze: 'Read/Analyze',
    code_generation: 'Code Generation',
    verification_judge: 'Verification Judge',
    verification_fix: 'Verification Fix',
};

const COLUMN_WIDTH = 320;
const ROW_HEIGHT = 130;

const NODE_POSITIONS: Record<TaskKey, { x: number; y: number }> = {
    chat: { x: 50, y: 0 },
    investigation: { x: 50, y: ROW_HEIGHT },
    plan_exploration: { x: 50, y: ROW_HEIGHT * 2 },
    plan_generation: { x: 50, y: ROW_HEIGHT * 3 },
    read_analyze: { x: 50 + COLUMN_WIDTH, y: 0 },
    code_generation: { x: 50 + COLUMN_WIDTH, y: ROW_HEIGHT },
    verification_judge: { x: 50 + COLUMN_WIDTH, y: ROW_HEIGHT * 2 },
    verification_fix: { x: 50 + COLUMN_WIDTH, y: ROW_HEIGHT * 3 },
};

const EDGE_DEFS: { id: string; source: TaskKey; target: TaskKey }[] = [
    { id: 'e-chat-investigation', source: 'chat', target: 'investigation' },
    { id: 'e-investigation-plan_exploration', source: 'investigation', target: 'plan_exploration' },
    { id: 'e-plan_exploration-plan_generation', source: 'plan_exploration', target: 'plan_generation' },
    { id: 'e-plan_generation-read_analyze', source: 'plan_generation', target: 'read_analyze' },
    { id: 'e-read_analyze-code_generation', source: 'read_analyze', target: 'code_generation' },
    { id: 'e-code_generation-verification_judge', source: 'code_generation', target: 'verification_judge' },
    { id: 'e-verification_judge-verification_fix', source: 'verification_judge', target: 'verification_fix' },
];

interface Preset {
    id: number;
    name: string;
    config: string;
    created_at: string;
}

function doesConfigMatchDefaults(cfg: PipelineConfig): boolean {
    return TASK_KEYS.every(k =>
        cfg[k].provider === DEFAULT_ROUTE.provider && cfg[k].model === DEFAULT_ROUTE.model
    );
}

function PipelineTaskNode({ data, selected }: NodeProps) {
    const taskKey = data.taskKey as TaskKey;
    const route = data.route as RouteConfig;
    const onConfigChange = data.onConfigChange as (taskKey: TaskKey, route: RouteConfig) => void;
    const disabled = data.disabled as boolean;

    const [editing, setEditing] = useState(false);
    const [localProvider, setLocalProvider] = useState(route.provider);
    const [localModel, setLocalModel] = useState(route.model);

    useEffect(() => {
        setLocalProvider(route.provider);
        setLocalModel(route.model);
    }, [route.provider, route.model]);

    const handleSave = () => {
        onConfigChange(taskKey, { provider: localProvider, model: localModel });
        setEditing(false);
    };

    const handleCancel = () => {
        setLocalProvider(route.provider);
        setLocalModel(route.model);
        setEditing(false);
    };

    const opacity = disabled ? 0.5 : 1;

    return (
        <div style={{
            background: 'var(--bg-secondary)',
            border: selected ? '2px solid var(--accent-primary)' : disabled ? '1px dashed var(--border-color)' : '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 0,
            width: 280,
            boxShadow: selected ? '0 0 12px rgba(99,102,241,0.3)' : 'var(--shadow-sm)',
            overflow: 'hidden',
            opacity,
        }}>
            <Handle type="target" position={Position.Left} style={{ background: 'var(--accent-primary)', width: 10, height: 10 }} />
            <div style={{
                padding: '8px 12px',
                background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{data.label as string}</span>
                <span style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                }}>{route.provider}</span>
            </div>
            <div style={{ padding: '8px 12px' }}>
                {editing && !disabled ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <select
                            value={localProvider}
                            onChange={e => setLocalProvider(e.target.value)}
                            style={{
                                padding: '4px 6px',
                                background: 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 12,
                            }}
                        >
                            {ALL_PROVIDERS.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            value={localModel}
                            onChange={e => setLocalModel(e.target.value)}
                            placeholder="e.g., gpt-4o"
                            style={{
                                padding: '4px 6px',
                                background: 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 12,
                            }}
                        />
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button onClick={handleSave} style={{ padding: '2px 10px', background: 'var(--accent-primary)', border: 'none', color: '#fff', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 11 }}>Save</button>
                            <button onClick={handleCancel} style={{ padding: '2px 10px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 11 }}>Cancel</button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            Model: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{route.model || '(not set)'}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                            {TASK_DESCRIPTIONS[taskKey]}
                        </div>
                        {!disabled && (
                            <button
                                onClick={() => setEditing(true)}
                                style={{
                                    marginTop: 4,
                                    padding: '2px 8px',
                                    background: 'transparent',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-secondary)',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    alignSelf: 'flex-start',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                            >
                                Configure
                            </button>
                        )}
                    </div>
                )}
            </div>
            <Handle type="source" position={Position.Right} style={{ background: 'var(--accent-primary)', width: 10, height: 10 }} />
        </div>
    );
}

const nodeTypes = { pipelineTask: PipelineTaskNode };

export function PipelineBuilder() {
    const [config, setConfig] = useState<PipelineConfig>({ ...DEFAULT_CONFIG, chat: { ...DEFAULT_ROUTE }, investigation: { ...DEFAULT_ROUTE }, plan_exploration: { ...DEFAULT_ROUTE }, plan_generation: { ...DEFAULT_ROUTE }, read_analyze: { ...DEFAULT_ROUTE }, code_generation: { ...DEFAULT_ROUTE }, verification_judge: { ...DEFAULT_ROUTE }, verification_fix: { ...DEFAULT_ROUTE } });
    const [pipelineEnabled, setPipelineEnabled] = useState(false);
    const [presets, setPresets] = useState<Preset[]>([]);
    const [presetName, setPresetName] = useState('');
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [engineSteps, setEngineSteps] = useState<any[]>([]);

    useEffect(() => {
        (async () => {
            try {
                const [cfg, presetsList, generalSettings] = await Promise.all([
                    getIpc().invoke('pipeline:get-config'),
                    getIpc().invoke('pipeline:get-presets'),
                    getIpc().invoke('get-general-settings'),
                ]);

                const activeProvider = generalSettings?.activeProvider || 'openai';
                const activeModel = generalSettings?.selectedModel || 'gpt-4o';

                const allDefaults = cfg ? doesConfigMatchDefaults(cfg) : true;

                const merged: PipelineConfig = {} as PipelineConfig;
                for (const k of TASK_KEYS) {
                    merged[k] = allDefaults
                        ? { provider: activeProvider, model: activeModel }
                        : (cfg?.[k] || { ...DEFAULT_ROUTE });
                }

                setConfig(merged);
                setPipelineEnabled(!!generalSettings?.pipelineEnabled);
                setPresets(presetsList || []);
            } catch (e) {
                console.error('Failed to load pipeline:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const initialNodes: Node[] = useMemo(() =>
        TASK_KEYS.map(k => ({
            id: k,
            type: 'pipelineTask' as const,
            position: NODE_POSITIONS[k],
            data: {
                label: TASK_LABELS[k],
                taskKey: k,
                route: config[k],
                onConfigChange: handleConfigChange,
                disabled: !pipelineEnabled,
            },
        })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        TASK_KEYS.map(k => `${config[k].provider}:${config[k].model}`).concat(String(pipelineEnabled))
    );

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    useEffect(() => { setNodes(initialNodes); }, [initialNodes]);

    const initialEdges: Edge[] = useMemo(() =>
        EDGE_DEFS.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            animated: pipelineEnabled,
            style: { stroke: 'var(--accent-primary)', strokeWidth: 2, opacity: pipelineEnabled ? 1 : 0.3 },
        })),
        [pipelineEnabled]
    );

    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    useEffect(() => { setEdges(initialEdges); }, [initialEdges]);

    function handleConfigChange(taskKey: TaskKey, route: RouteConfig) {
        setConfig(prev => ({ ...prev, [taskKey]: route }));
    }

    const handleTogglePipeline = async () => {
        const newVal = !pipelineEnabled;
        setPipelineEnabled(newVal);
        try {
            await getIpc().invoke('pipeline:set-enabled', newVal);
        } catch (e) {
            console.error('Failed to toggle pipeline:', e);
            setPipelineEnabled(!newVal);
        }
    };

    const handleSave = async () => {
        try {
            await getIpc().invoke('pipeline:set-config', config);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            console.error('Failed to save pipeline:', e);
        }
    };

    const handleReset = async () => {
        const defaults: PipelineConfig = { ...DEFAULT_CONFIG };
        for (const k of TASK_KEYS) {
            defaults[k] = { ...DEFAULT_ROUTE };
        }
        setConfig(defaults);
        await getIpc().invoke('pipeline:set-config', defaults);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleSavePreset = async () => {
        if (!presetName.trim()) return;
        try {
            await getIpc().invoke('pipeline:save-preset', presetName.trim(), config);
            setPresetName('');
            const list = await getIpc().invoke('pipeline:get-presets');
            setPresets(list || []);
        } catch (e) {
            console.error('Failed to save preset:', e);
        }
    };

    const handleLoadPreset = async (id: number) => {
        try {
            const preset = await getIpc().invoke('pipeline:load-preset', id);
            if (preset?.config) {
                const cfg = preset.config;
                const merged: PipelineConfig = {} as PipelineConfig;
                for (const k of TASK_KEYS) {
                    merged[k] = cfg[k] || { ...DEFAULT_ROUTE };
                }
                setConfig(merged);
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        } catch (e) {
            console.error('Failed to load preset:', e);
        }
    };

    const handleDeletePreset = async (id: number) => {
        try {
            await getIpc().invoke('pipeline:delete-preset', id);
            const list = await getIpc().invoke('pipeline:get-presets');
            setPresets(list || []);
        } catch (e) {
            console.error('Failed to delete preset:', e);
        }
    };

    const handleShowEngineSteps = async () => {
        try {
            const steps = await getIpc().invoke('pipeline:engine-steps');
            setEngineSteps(steps || []);
        } catch (e) {
            console.error('Failed to get engine steps:', e);
        }
    };

    if (loading) {
        return <div style={{ color: 'var(--text-secondary)' }}>Loading pipeline builder...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 'var(--font-lg)', color: 'var(--text-primary)' }}>
                        Pipeline Builder
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                        Route different task types to different models/providers.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 12px', borderRadius: 'var(--radius-sm)',
                        background: pipelineEnabled ? 'rgba(99,102,241,0.15)' : 'transparent',
                        border: '1px solid var(--border-color)',
                    }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                            Pipeline Mode
                        </span>
                        <button
                            onClick={handleTogglePipeline}
                            style={{
                                width: 36, height: 20, borderRadius: 10,
                                border: 'none', cursor: 'pointer', position: 'relative',
                                background: pipelineEnabled ? '#6366f1' : 'var(--border-color)',
                                transition: 'background 0.2s',
                            }}
                        >
                            <div style={{
                                width: 16, height: 16, borderRadius: '50%',
                                background: '#fff', position: 'absolute', top: 2,
                                left: pipelineEnabled ? 18 : 2, transition: 'left 0.2s',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                            }} />
                        </button>
                    </div>
                    <button onClick={handleSave} style={primaryBtnStyle}>
                        {saved ? 'Saved \u2713' : 'Save Routes'}
                    </button>
                    <button onClick={handleReset} style={secondaryBtnStyle}>Reset</button>
                </div>
            </div>

            {!pipelineEnabled && (
                <div style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(234,179,8,0.1)',
                    border: '1px solid rgba(234,179,8,0.3)',
                    color: '#eab308',
                    fontSize: 13,
                }}>
                    Pipeline mode is OFF. All task types use the single model selected in Settings {'>'} Models. Toggle "Pipeline Mode" above to route each task type independently.
                </div>
            )}

            <div style={{ flex: 1, minHeight: 520, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.3 }}
                    minZoom={0.5}
                    maxZoom={2}
                    style={{ background: 'var(--bg-primary)' }}
                    defaultEdgeOptions={{ style: { stroke: 'var(--accent-primary)', strokeWidth: 2 }, type: 'smoothstep' }}
                >
                    <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--border-subtle)" />
                    <Controls />
                    <MiniMap
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
                        nodeColor="var(--accent-primary)"
                        maskColor="rgba(0,0,0,0.3)"
                    />
                </ReactFlow>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>
                        Pipeline Presets
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <input
                            type="text"
                            value={presetName}
                            onChange={e => setPresetName(e.target.value)}
                            placeholder="Preset name..."
                            style={{
                                flex: 1,
                                padding: '4px 8px',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 12,
                            }}
                            onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(); }}
                        />
                        <button onClick={handleSavePreset} style={primaryBtnStyleSmall}>Save</button>
                    </div>
                    {presets.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No saved presets.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 100, overflowY: 'auto' }}>
                            {presets.map(p => (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }}
                                        onClick={() => handleLoadPreset(p.id)}
                                        title="Click to load"
                                    >
                                        {p.name}
                                    </span>
                                    <button
                                        onClick={() => handleDeletePreset(p.id)}
                                        style={{
                                            padding: '1px 6px',
                                            background: 'transparent',
                                            border: '1px solid rgba(239,68,68,0.3)',
                                            color: '#ef4444',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer',
                                            fontSize: 10,
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ flex: 1, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                            {pipelineEnabled ? 'Engine Routes (resolved)' : 'Active Model (pipeline OFF)'}
                        </span>
                        <button onClick={handleShowEngineSteps} style={secondaryBtnStyleSmall}>Refresh</button>
                    </div>
                    {engineSteps.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Click Refresh to see resolved routes.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {engineSteps.map((step: any, idx: number) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '4px 8px',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: 12,
                                    opacity: pipelineEnabled ? 1 : 0.6,
                                }}>
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{step.label}</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>
                                        {step.provider} / {step.model || '(not set)'}
                                    </span>
                                </div>
                            ))}
                            {!pipelineEnabled && (
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', padding: '4px 0' }}>
                                    All routes resolved from active provider/model (pipeline OFF)
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {saved && (
                <div style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(34,197,94,0.1)',
                    color: '#22c55e',
                    fontSize: 13,
                    textAlign: 'center',
                }}>
                    Pipeline configuration saved.
                </div>
            )}
        </div>
    );
}

const primaryBtnStyle: React.CSSProperties = {
    padding: '6px 16px',
    background: 'var(--accent-primary)',
    border: 'none',
    color: '#fff',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 13,
};

const secondaryBtnStyle: React.CSSProperties = {
    padding: '6px 16px',
    background: 'transparent',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 13,
};

const primaryBtnStyleSmall: React.CSSProperties = {
    padding: '4px 12px',
    background: 'var(--accent-primary)',
    border: 'none',
    color: '#fff',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 12,
};

const secondaryBtnStyleSmall: React.CSSProperties = {
    padding: '3px 10px',
    background: 'transparent',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 11,
};
