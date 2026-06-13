import type { PlanStep, ExecutionPlan } from '../helpers/planEditorTypes';

interface PlanStepsTabProps {
    plan: ExecutionPlan;
    editingStepIndex: number | null;
    editStepData: PlanStep | null;
    setEditingStepIndex: (v: number | null) => void;
    setEditStepData: (v: PlanStep | null) => void;
    agents: { id: number; name: string }[];
    workflows: { id: number; name: string; description?: string }[];
    activeAgentPopoverIndex: number | null;
    setActiveAgentPopoverIndex: (v: number | null) => void;
    agentSearchQuery: string;
    setAgentSearchQuery: (v: string) => void;
    toggleStepCompleted: (index: number) => void;
    handleStartEdit: (index: number, step: PlanStep) => void;
    handleSaveEdit: (index: number) => void;
    handleSelectAgentOrWorkflow: (index: number, selection: string) => void;
    handleDeleteStep: (index: number) => void;
    handleAddStep: () => void;
    handleMoveStep: (index: number, direction: 'up' | 'down') => void;
}

export function PlanStepsTab({
    plan,
    editingStepIndex,
    editStepData,
    setEditingStepIndex,
    setEditStepData,
    agents,
    workflows,
    activeAgentPopoverIndex,
    setActiveAgentPopoverIndex,
    agentSearchQuery,
    setAgentSearchQuery,
    toggleStepCompleted,
    handleStartEdit,
    handleSaveEdit,
    handleSelectAgentOrWorkflow,
    handleDeleteStep,
    handleAddStep,
    handleMoveStep,
}: PlanStepsTabProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '850px', margin: '0 auto' }}>
            {/* eslint-disable-next-line complexity */}
            {plan.steps.map((step, index) => {
                if (!step.action || !step.target || !step.rationale) {
                    console.warn(`[PlanEditor:steps] Step ${index} missing fields:`, { action: step.action, target: step.target, rationale: step.rationale, order: step.order });
                }
                const isEditing = editingStepIndex === index;
                return (
                    <div
                        key={index}
                        style={{
                            background: step.completed
                                ? 'linear-gradient(135deg, rgba(52, 211, 153, 0.05) 0%, rgba(52, 211, 153, 0.01) 100%)'
                                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
                            border: isEditing
                                ? '1px solid #818cf8'
                                : step.completed
                                    ? '1px solid rgba(52, 211, 153, 0.25)'
                                    : '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '10px',
                            padding: '18px',
                            display: 'flex',
                            gap: '16px',
                            alignItems: 'flex-start',
                            position: 'relative',
                            boxShadow: isEditing
                                ? '0 0 16px rgba(129, 140, 248, 0.15)'
                                : '0 4px 20px rgba(0, 0, 0, 0.15)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                    >
                        {/* Step Number Circle */}
                        <div
                            onClick={() => !isEditing && toggleStepCompleted(index)}
                            style={{
                                width: '28px',
                                height: '28px',
                                minWidth: '28px',
                                borderRadius: '50%',
                                background: step.completed
                                    ? 'linear-gradient(135deg, #34d399 0%, #059669 100%)'
                                    : 'linear-gradient(135deg, rgba(129, 140, 248, 0.15) 0%, rgba(129, 140, 248, 0.05) 100%)',
                                border: step.completed ? 'none' : '1px solid rgba(129, 140, 248, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '11px',
                                color: step.completed ? '#0d1117' : '#818cf8',
                                cursor: isEditing ? 'default' : 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: step.completed ? '0 4px 12px rgba(52, 211, 153, 0.3)' : 'none',
                            }}
                        >
                            {step.completed ? (
                                <span className="codicon codicon-check" style={{ fontSize: '12px' }} />
                            ) : (
                                step.order
                            )}
                        </div>

                        {/* Step Details */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {isEditing ? (
                                <>
                                    {/* Inline Edit Mode */}
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                        <select
                                            value={editStepData?.action || ''}
                                            onChange={e => setEditStepData(editStepData ? { ...editStepData, action: e.target.value as PlanStep['action'] } : null)}
                                            style={{
                                                background: 'rgba(0,0,0,0.4)',
                                                border: '1px solid rgba(255,255,255,0.12)',
                                                color: 'white',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                outline: 'none',
                                            }}
                                        >
                                            <option value="read">Read</option>
                                            <option value="analyze">Analyze</option>
                                            <option value="modify">Modify</option>
                                            <option value="create">Create</option>
                                            <option value="delete">Delete</option>
                                            <option value="run_command">Run Command</option>
                                        </select>
                                        <input
                                            type="text"
                                            value={editStepData?.target || ''}
                                            onChange={e => setEditStepData(editStepData ? { ...editStepData, target: e.target.value } : null)}
                                            placeholder="Target (e.g. src/file.ts)"
                                            style={{
                                                flex: 1, minWidth: '150px',
                                                background: 'rgba(0,0,0,0.4)',
                                                border: '1px solid rgba(255,255,255,0.12)',
                                                color: 'white',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                outline: 'none',
                                            }}
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={editStepData?.rationale || ''}
                                        onChange={e => setEditStepData(editStepData ? { ...editStepData, rationale: e.target.value } : null)}
                                        placeholder="Rationale"
                                        style={{
                                            width: '100%', boxSizing: 'border-box',
                                            background: 'rgba(0,0,0,0.4)',
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            color: 'white',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            outline: 'none',
                                        }}
                                    />
                                    {editStepData && (
                                        <input
                                            type="text"
                                            value={editStepData.notes || ''}
                                            onChange={e => setEditStepData({ ...editStepData, notes: e.target.value })}
                                            placeholder="Notes (optional)"
                                            style={{
                                                width: '100%', boxSizing: 'border-box',
                                                background: 'rgba(0,0,0,0.4)',
                                                border: '1px solid rgba(255,255,255,0.12)',
                                                color: 'white',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                outline: 'none',
                                            }}
                                        />
                                    )}
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                        <button onClick={() => setEditingStepIndex(null)} style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>Cancel</button>
                                        <button onClick={() => handleSaveEdit(index)} disabled={!editStepData?.action || !editStepData?.target || !editStepData?.rationale} style={{ padding: '4px 10px', background: (!editStepData?.action || !editStepData?.target || !editStepData?.rationale) ? 'rgba(129,140,248,0.3)' : '#818cf8', border: 'none', borderRadius: '4px', color: 'white', fontSize: '11px', fontWeight: 600 }}>Save</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Action Badge + Target */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            background: step.action === 'read' ? 'rgba(56, 189, 248, 0.15)'
                                                : step.action === 'analyze' ? 'rgba(168, 85, 247, 0.15)'
                                                    : step.action === 'modify' ? 'rgba(251, 146, 60, 0.15)'
                                                        : step.action === 'create' ? 'rgba(52, 211, 153, 0.15)'
                                                            : step.action === 'delete' ? 'rgba(239, 68, 68, 0.15)'
                                                                : 'rgba(255, 255, 255, 0.1)',
                                            color: step.action === 'read' ? '#38bdf8'
                                                : step.action === 'analyze' ? '#a855f7'
                                                    : step.action === 'modify' ? '#fb923c'
                                                        : step.action === 'create' ? '#34d399'
                                                            : step.action === 'delete' ? '#f87171'
                                                                : 'rgba(255, 255, 255, 0.5)',
                                        }}>{step.action}</span>
                                        <span style={{
                                            fontSize: '12px',
                                            fontWeight: 500,
                                            color: 'rgba(255, 255, 255, 0.8)',
                                            fontFamily: "'JetBrains Mono', monospace",
                                        }}>{step.target}</span>
                                    </div>

                                    {/* Rationale */}
                                    <p style={{ margin: 0, fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.5)', lineHeight: 1.5 }}>{step.rationale}</p>

                                    {/* Agent / Workflow Assignment Status / Selector Trigger */}
                                    <div style={{ position: 'relative', alignSelf: 'flex-start' }} className="agent-popover-container">
                                        <button
                                            onClick={e => {
                                                e.stopPropagation();
                                                setActiveAgentPopoverIndex(activeAgentPopoverIndex === index ? null : index);
                                            }}
                                            style={{
                                                background: step.agent ? 'rgba(129, 140, 248, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                                border: step.agent ? '1px solid rgba(129, 140, 248, 0.25)' : '1px solid rgba(239, 68, 68, 0.15)',
                                                color: step.agent ? 'rgba(255, 255, 255, 0.8)' : 'rgba(248, 113, 113, 0.7)',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '11px',
                                                fontWeight: 500,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                transition: 'all 0.2s',
                                                whiteSpace: 'nowrap',
                                                outline: 'none',
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = step.agent ? 'rgba(129, 140, 248, 0.15)' : 'rgba(239, 68, 68, 0.15)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = step.agent ? 'rgba(129, 140, 248, 0.08)' : 'rgba(239, 68, 68, 0.08)';
                                            }}
                                            title="Click to assign or change agent"
                                        >
                                            <span className={step.agent ? "codicon codicon-hubot" : "codicon codicon-warning"} style={{ fontSize: '11px', color: step.agent ? '#818cf8' : '#f87171' }} />
                                            <span>
                                                {step.agent ? (
                                                    <>
                                                        Assigned to:{' '}
                                                        <strong style={{ color: 'white' }}>
                                                            {step.agent.startsWith('Workflow:') ? step.agent.replace('Workflow:', '').trim() : step.agent}
                                                        </strong>
                                                        {step.agent.startsWith('Workflow:') && (
                                                            <span style={{ color: 'rgba(255, 255, 255, 0.4)', marginLeft: '4px' }}>(Workflow)</span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span style={{ fontWeight: 600 }}>Not Assigned</span>
                                                )}
                                            </span>
                                            <span className="codicon codicon-chevron-down" style={{ fontSize: '10px', opacity: 0.5, marginLeft: '2px' }} />
                                        </button>

                                        {activeAgentPopoverIndex === index && (
                                            <>
                                                <div style={{
                                                    position: 'fixed',
                                                    top: 0, left: 0, right: 0, bottom: 0,
                                                    zIndex: 99,
                                                }} onClick={() => setActiveAgentPopoverIndex(null)} />
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '100%',
                                                    left: 0,
                                                    zIndex: 100,
                                                    marginTop: '4px',
                                                    background: '#1c1c1e',
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                    borderRadius: '8px',
                                                    padding: '8px',
                                                    minWidth: '200px',
                                                    maxHeight: '250px',
                                                    overflowY: 'auto',
                                                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                                }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    {agents.length > 0 && (
                                                        <input
                                                            type="text"
                                                            placeholder="Search agent..."
                                                            value={agentSearchQuery}
                                                            onChange={e => setAgentSearchQuery(e.target.value)}
                                                            style={{
                                                                width: '100%', boxSizing: 'border-box',
                                                                background: 'rgba(0,0,0,0.4)',
                                                                border: '1px solid rgba(255,255,255,0.08)',
                                                                color: 'white',
                                                                padding: '4px 8px',
                                                                borderRadius: '4px',
                                                                fontSize: '11px',
                                                                marginBottom: '6px',
                                                                outline: 'none',
                                                            }}
                                                        />
                                                    )}
                                                    
                                                    {agents.length > 0 ? (
                                                        agents
                                                            .filter(a => !agentSearchQuery || a.name.toLowerCase().includes(agentSearchQuery.toLowerCase()))
                                                            .map(a => (
                                                                <button
                                                                    key={a.id}
                                                                    onClick={() => { handleSelectAgentOrWorkflow(index, a.name); setActiveAgentPopoverIndex(null); setAgentSearchQuery(''); }}
                                                                    style={{
                                                                        background: step.agent === a.name ? 'rgba(129,140,248,0.15)' : 'transparent',
                                                                        border: 'none',
                                                                        color: step.agent === a.name ? '#a5b4fc' : 'rgba(255,255,255,0.7)',
                                                                        padding: '6px 8px',
                                                                        borderRadius: '4px',
                                                                        cursor: 'pointer',
                                                                        textAlign: 'left',
                                                                        fontSize: '11px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '6px',
                                                                    }}
                                                                    onMouseEnter={e => { if (step.agent !== a.name) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                                                                    onMouseLeave={e => { if (step.agent !== a.name) e.currentTarget.style.background = 'transparent'; }}
                                                                >
                                                                    <span className="codicon codicon-hubot" style={{ color: '#818cf8' }} />
                                                                    {a.name}
                                                                </button>
                                                            ))
                                                    ) : (
                                                        <div style={{
                                                            padding: '8px',
                                                            color: 'rgba(255, 255, 255, 0.35)',
                                                            fontSize: '11px',
                                                            fontStyle: 'italic',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            marginBottom: '4px'
                                                        }}>
                                                            <span className="codicon codicon-info" style={{ color: 'rgba(255, 255, 255, 0.3)' }} />
                                                            No custom agents configured.
                                                        </div>
                                                    )}

                                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '4px 0', paddingTop: '4px' }}>
                                                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', paddingLeft: '4px' }}>Workflows</div>
                                                        {workflows.map(flow => (
                                                            <button
                                                                key={flow.id}
                                                                onClick={() => { handleSelectAgentOrWorkflow(index, `Workflow: ${flow.name}`); setActiveAgentPopoverIndex(null); setAgentSearchQuery(''); }}
                                                                style={{
                                                                    background: step.agent === `Workflow: ${flow.name}` ? 'rgba(234, 88, 12, 0.12)' : 'transparent',
                                                                    border: 'none',
                                                                    color: step.agent === `Workflow: ${flow.name}` ? '#ff9d5c' : 'rgba(255,255,255,0.7)',
                                                                    padding: '6px 8px',
                                                                    borderRadius: '4px',
                                                                    cursor: 'pointer',
                                                                    textAlign: 'left',
                                                                    fontSize: '11px',
                                                                    width: '100%',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                }}
                                                                onMouseEnter={e => { if (step.agent !== `Workflow: ${flow.name}`) e.currentTarget.style.background = 'rgba(234, 88, 12, 0.15)'; }}
                                                                onMouseLeave={e => { if (step.agent !== `Workflow: ${flow.name}`) e.currentTarget.style.background = 'transparent'; }}
                                                            >
                                                                <span className="codicon codicon-git-merge" style={{ color: '#f97316' }} />
                                                                {flow.name}
                                                            </button>
                                                        ))}
                                                        {workflows.length === 0 && (
                                                            <div style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontStyle: 'italic' }}>
                                                                No workflows configured
                                                            </div>
                                                        )}
                                                    </div></div>
                                                <button
                                                    onClick={() => { handleSelectAgentOrWorkflow(index, ''); setActiveAgentPopoverIndex(null); setAgentSearchQuery(''); }}
                                                    style={{
                                                        width: '100%', marginTop: '8px',
                                                        background: 'rgba(255,255,255,0.03)',
                                                        border: '1px solid rgba(255,255,255,0.06)',
                                                        color: 'rgba(255,255,255,0.4)',
                                                        padding: '6px 8px',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                            fontSize: '10px',
                                                        }}
                                                    >Clear Assignment</button>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Notes Preview */}
                                    {step.notes && (
                                        <div style={{
                                            fontSize: '11px',
                                            color: 'rgba(255, 255, 255, 0.35)',
                                            fontStyle: 'italic',
                                            background: 'rgba(255, 255, 255, 0.02)',
                                            padding: '6px 10px',
                                            borderRadius: '4px',
                                        }}>
                                            {step.notes}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Action Buttons */}
                        {!isEditing && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                <button
                                    onClick={() => handleStartEdit(index, step)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'rgba(255,255,255,0.3)',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        fontSize: '11px',
                                        transition: 'color 0.2s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.color = 'white'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                                    title="Edit"
                                >
                                    <span className="codicon codicon-edit" />
                                </button>

                                <button
                                    onClick={() => handleMoveStep(index, 'up')}
                                    disabled={index === 0}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: index === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)',
                                        cursor: index === 0 ? 'default' : 'pointer',
                                        padding: '2px',
                                        fontSize: '11px',
                                        transition: 'color 0.2s',
                                    }}
                                    title="Move up"
                                >
                                    <span className="codicon codicon-chevron-up" />
                                </button>

                                <button
                                    onClick={() => handleMoveStep(index, 'down')}
                                    disabled={index === plan.steps.length - 1}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: index === plan.steps.length - 1 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)',
                                        cursor: index === plan.steps.length - 1 ? 'default' : 'pointer',
                                        padding: '2px',
                                        fontSize: '11px',
                                        transition: 'color 0.2s',
                                    }}
                                    title="Move down"
                                >
                                    <span className="codicon codicon-chevron-down" />
                                </button>

                                <button
                                    onClick={() => handleDeleteStep(index)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'rgba(239,68,68,0.4)',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        fontSize: '11px',
                                        transition: 'color 0.2s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(239,68,68,0.4)'}
                                    title="Delete step"
                                >
                                    <span className="codicon codicon-trash" />
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Add Step Button */}
            <button
                onClick={handleAddStep}
                style={{
                    padding: '12px 20px',
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: 'rgba(255, 255, 255, 0.5)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    e.currentTarget.style.borderColor = '#818cf8';
                    e.currentTarget.style.color = 'white';
                }}
                onMouseOut={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
                }}
            >
                <span className="codicon codicon-add" />
                Add Roadmap Step
            </button>
        </div>
    );
}
