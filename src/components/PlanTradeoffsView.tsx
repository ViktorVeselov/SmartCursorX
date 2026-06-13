import type { ExecutionPlan, ActiveTab } from '../helpers/planEditorTypes';

interface PlanTradeoffsViewProps {
    plan: ExecutionPlan;
    savePlan: (plan: ExecutionPlan) => Promise<void>;
    setPlan: (plan: ExecutionPlan) => void;
    activeTab: ActiveTab;
    handleTextareaSelect: () => void;
    handleTextareaMouseUp: () => void;
    getTargetIdForField: (text: string) => string | undefined;
    showPlanningCommentsRoom: boolean;
}

export function PlanTradeoffsView({
    plan,
    savePlan,
    setPlan,
    activeTab,
    handleTextareaSelect,
    handleTextareaMouseUp,
    getTargetIdForField,
    showPlanningCommentsRoom,
}: PlanTradeoffsViewProps) {
    const isPlanningTradeoffs = activeTab === 'planning';
    const tradeoffsList = (isPlanningTradeoffs ? plan.planningTradeoffs : plan.tradeoffs) || [];

    return (
        <div style={{
            marginRight: showPlanningCommentsRoom ? '320px' : '0',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
            transition: 'margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }} className="tradeoffs-container">
            <div style={{
                background: 'transparent',
                border: 'none',
                padding: 0
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="codicon codicon-law" style={{ color: '#38bdf8' }} /> <span style={{ color: '#38bdf8' }}>Trade-offs</span> & Design Options
                    </h3>
                    <button
                        onClick={() => {
                            const newTradeoff = { task: 'New Option / Choice', considerations: 'Pros and cons considerations...', decision: 'Chosen option and rationale...' };
                            if (isPlanningTradeoffs) {
                                savePlan({ ...plan, planningTradeoffs: [...(plan.planningTradeoffs || []), newTradeoff] });
                            } else {
                                savePlan({ ...plan, tradeoffs: [...(plan.tradeoffs || []), newTradeoff] });
                            }
                        }}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                    >
                        <span className="codicon codicon-add" /> Add Option
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {tradeoffsList.map((tradeoff, i) => {
                        const keyVal = tradeoff.task || `tradeoff-${i}`;
                        return (
                            <div key={keyVal} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                position: 'relative',
                                borderBottom: i < tradeoffsList.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                paddingBottom: i < tradeoffsList.length - 1 ? '16px' : '0'
                            }}>
                                <div id={getTargetIdForField(tradeoff.task)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', width: '100%', marginRight: '24px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', flexShrink: 0, marginTop: '3px' }}>Option:</span>
                                        <textarea
                                            value={tradeoff.task}
                                            onChange={e => {
                                                const updated = [...tradeoffsList];
                                                updated[i] = { ...updated[i], task: e.target.value };
                                                if (isPlanningTradeoffs) {
                                                    setPlan({ ...plan, planningTradeoffs: updated });
                                                } else {
                                                    setPlan({ ...plan, tradeoffs: updated });
                                                }
                                            }}
                                            onBlur={e => {
                                                const updated = [...tradeoffsList];
                                                updated[i] = { ...updated[i], task: e.target.value.trim() };
                                                if (isPlanningTradeoffs) {
                                                    savePlan({ ...plan, planningTradeoffs: updated });
                                                } else {
                                                    savePlan({ ...plan, tradeoffs: updated });
                                                }
                                                e.currentTarget.style.borderBottom = '1px solid transparent';
                                            }}
                                            onSelect={handleTextareaSelect}
                                            onMouseUp={handleTextareaMouseUp}
                                            ref={el => {
                                                if (el) {
                                                    el.style.height = 'auto';
                                                    el.style.height = el.scrollHeight + 'px';
                                                }
                                            }}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                borderBottom: '1px solid transparent',
                                                color: 'white',
                                                fontSize: '13.5px',
                                                fontWeight: 600,
                                                outline: 'none',
                                                width: '100%',
                                                resize: 'none',
                                                padding: '2px 0',
                                                fontFamily: 'inherit',
                                                transition: 'border-bottom-color 0.2s'
                                            }}
                                            onFocus={e => e.currentTarget.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)'}
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            const updated = tradeoffsList.filter((_, idx) => idx !== i);
                                            if (isPlanningTradeoffs) {
                                                savePlan({ ...plan, planningTradeoffs: updated });
                                            } else {
                                                savePlan({ ...plan, tradeoffs: updated });
                                            }
                                        }}
                                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '4px' }}
                                        title="Delete Option"
                                        onMouseOver={e => e.currentTarget.style.color = '#f87171'}
                                        onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                                    >
                                        <span className="codicon codicon-trash" style={{ fontSize: '13px' }} />
                                    </button>
                                </div>

                                <div id={getTargetIdForField(tradeoff.considerations)} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 500 }}>Considerations:</span>
                                    <textarea
                                        value={tradeoff.considerations}
                                        onChange={e => {
                                            const updated = [...tradeoffsList];
                                            updated[i] = { ...updated[i], considerations: e.target.value };
                                            if (isPlanningTradeoffs) {
                                                setPlan({ ...plan, planningTradeoffs: updated });
                                            } else {
                                                setPlan({ ...plan, tradeoffs: updated });
                                            }
                                        }}
                                        onBlur={e => {
                                            const updated = [...tradeoffsList];
                                            updated[i] = { ...updated[i], considerations: e.target.value.trim() };
                                            if (isPlanningTradeoffs) {
                                                savePlan({ ...plan, planningTradeoffs: updated });
                                            } else {
                                                savePlan({ ...plan, tradeoffs: updated });
                                            }
                                            e.currentTarget.style.borderBottom = '1px solid transparent';
                                        }}
                                        onSelect={handleTextareaSelect}
                                        onMouseUp={handleTextareaMouseUp}
                                        ref={el => {
                                            if (el) {
                                                el.style.height = 'auto';
                                                el.style.height = el.scrollHeight + 'px';
                                            }
                                        }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            borderBottom: '1px solid transparent',
                                            color: '#e2e8f0',
                                            fontSize: '13px',
                                            lineHeight: '1.5',
                                            outline: 'none',
                                            width: '100%',
                                            resize: 'none',
                                            padding: '2px 0',
                                            fontFamily: 'inherit',
                                            transition: 'border-bottom-color 0.2s'
                                        }}
                                        onFocus={e => e.currentTarget.style.borderBottom = '1px solid rgba(255,255,255,0.1)'}
                                    />
                                </div>

                                <div id={getTargetIdForField(tradeoff.decision)} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 500 }}>Decision:</span>
                                    <textarea
                                        value={tradeoff.decision}
                                        onChange={e => {
                                            const updated = [...tradeoffsList];
                                            updated[i] = { ...updated[i], decision: e.target.value };
                                            if (isPlanningTradeoffs) {
                                                setPlan({ ...plan, planningTradeoffs: updated });
                                            } else {
                                                setPlan({ ...plan, tradeoffs: updated });
                                            }
                                        }}
                                        onBlur={e => {
                                            const updated = [...tradeoffsList];
                                            updated[i] = { ...updated[i], decision: e.target.value.trim() };
                                            if (isPlanningTradeoffs) {
                                                savePlan({ ...plan, planningTradeoffs: updated });
                                            } else {
                                                savePlan({ ...plan, tradeoffs: updated });
                                            }
                                            e.currentTarget.style.borderBottom = '1px solid transparent';
                                        }}
                                        onSelect={handleTextareaSelect}
                                        onMouseUp={handleTextareaMouseUp}
                                        ref={el => {
                                            if (el) {
                                                el.style.height = 'auto';
                                                el.style.height = el.scrollHeight + 'px';
                                            }
                                        }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            borderBottom: '1px solid transparent',
                                            color: '#e2e8f0',
                                            fontSize: '13px',
                                            lineHeight: '1.5',
                                            outline: 'none',
                                            width: '100%',
                                            resize: 'none',
                                            padding: '2px 0',
                                            fontFamily: 'inherit',
                                            transition: 'border-bottom-color 0.2s'
                                        }}
                                        onFocus={e => e.currentTarget.style.borderBottom = '1px solid rgba(255,255,255,0.1)'}
                                    />
                                </div>
                            </div>
                        );
                    })}
                    {tradeoffsList.length === 0 && (
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.35)', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                            <div style={{ marginBottom: 8 }}>No design tradeoffs documented</div>
                            <div style={{ fontSize: 11 }}>Use "Modify Plan with AI" below to generate trade-off analysis, or click "Add Option" to manually add one.</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
