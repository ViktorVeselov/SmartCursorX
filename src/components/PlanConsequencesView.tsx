import type { ExecutionPlan, ActiveTab } from '../helpers/planEditorTypes';

interface PlanConsequencesViewProps {
    plan: ExecutionPlan;
    savePlan: (plan: ExecutionPlan) => Promise<void>;
    setPlan: (plan: ExecutionPlan) => void;
    activeTab: ActiveTab;
    handleTextareaSelect: () => void;
    handleTextareaMouseUp: () => void;
    getTargetIdForField: (text: string) => string | undefined;
    showPlanningCommentsRoom: boolean;
}

export function PlanConsequencesView({
    plan,
    savePlan,
    setPlan,
    activeTab,
    handleTextareaSelect,
    handleTextareaMouseUp,
    getTargetIdForField,
    showPlanningCommentsRoom,
}: PlanConsequencesViewProps) {
    const isPlanningConsequences = activeTab === 'planning';
    const consequencesList = (isPlanningConsequences ? plan.planningConsequences : (plan.consequences && plan.consequences.length > 0 ? plan.consequences : plan.planningConsequences)) || [];

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="codicon codicon-warning" style={{ color: '#fb923c' }} /> <span style={{ color: '#fb923c' }}>Failure Modes</span> & Consequences
                    </h3>
                    <button
                        onClick={() => {
                            const newConsequence = { failureMode: 'New Failure Mode', consequence: 'Potential system consequence...', harm: 'Harm to system/user...', mitigation: 'Proposed guard/mitigation...' };
                            if (isPlanningConsequences) {
                                savePlan({ ...plan, planningConsequences: [...(plan.planningConsequences || []), newConsequence] });
                            } else {
                                savePlan({ ...plan, consequences: [...(plan.consequences || []), newConsequence] });
                            }
                        }}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                    >
                        <span className="codicon codicon-add" /> Add Risk Analysis
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {consequencesList.map((consequence, i) => {
                        const keyVal = consequence.failureMode || `consequence-${i}`;
                        return (
                            <div key={keyVal} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                position: 'relative',
                                borderBottom: i < consequencesList.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                paddingBottom: i < consequencesList.length - 1 ? '16px' : '0'
                            }}>
                                <div id={getTargetIdForField(consequence.failureMode)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', width: '100%', marginRight: '24px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', flexShrink: 0, marginTop: '3px' }}>Risk:</span>
                                        <textarea
                                            value={consequence.failureMode}
                                            onChange={e => {
                                                const updated = [...consequencesList];
                                                updated[i] = { ...updated[i], failureMode: e.target.value };
                                                if (isPlanningConsequences) {
                                                    setPlan({ ...plan, planningConsequences: updated });
                                                } else {
                                                    setPlan({ ...plan, consequences: updated });
                                                }
                                            }}
                                            onBlur={e => {
                                                const updated = [...consequencesList];
                                                updated[i] = { ...updated[i], failureMode: e.target.value.trim() };
                                                if (isPlanningConsequences) {
                                                    savePlan({ ...plan, planningConsequences: updated });
                                                } else {
                                                    savePlan({ ...plan, consequences: updated });
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
                                            const updated = consequencesList.filter((_, idx) => idx !== i);
                                            if (isPlanningConsequences) {
                                                savePlan({ ...plan, planningConsequences: updated });
                                            } else {
                                                savePlan({ ...plan, consequences: updated });
                                            }
                                        }}
                                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '4px' }}
                                        title="Delete Risk"
                                        onMouseOver={e => e.currentTarget.style.color = '#f87171'}
                                        onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                                    >
                                        <span className="codicon codicon-trash" style={{ fontSize: '13px' }} />
                                    </button>
                                </div>

                                <div id={getTargetIdForField(consequence.consequence)} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 500 }}>Consequence:</span>
                                    <textarea
                                        value={consequence.consequence}
                                        onChange={e => {
                                            const updated = [...consequencesList];
                                            updated[i] = { ...updated[i], consequence: e.target.value };
                                            if (isPlanningConsequences) {
                                                setPlan({ ...plan, planningConsequences: updated });
                                            } else {
                                                setPlan({ ...plan, consequences: updated });
                                            }
                                        }}
                                        onBlur={e => {
                                            const updated = [...consequencesList];
                                            updated[i] = { ...updated[i], consequence: e.target.value.trim() };
                                            if (isPlanningConsequences) {
                                                savePlan({ ...plan, planningConsequences: updated });
                                            } else {
                                                savePlan({ ...plan, consequences: updated });
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

                                <div id={getTargetIdForField(consequence.harm)} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 500 }}>Harm:</span>
                                    <textarea
                                        value={consequence.harm}
                                        onChange={e => {
                                            const updated = [...consequencesList];
                                            updated[i] = { ...updated[i], harm: e.target.value };
                                            if (isPlanningConsequences) {
                                                setPlan({ ...plan, planningConsequences: updated });
                                            } else {
                                                setPlan({ ...plan, consequences: updated });
                                            }
                                        }}
                                        onBlur={e => {
                                            const updated = [...consequencesList];
                                            updated[i] = { ...updated[i], harm: e.target.value.trim() };
                                            if (isPlanningConsequences) {
                                                savePlan({ ...plan, planningConsequences: updated });
                                            } else {
                                                savePlan({ ...plan, consequences: updated });
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

                                <div id={getTargetIdForField(consequence.mitigation)} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 500 }}>Mitigation:</span>
                                    <textarea
                                        value={consequence.mitigation}
                                        onChange={e => {
                                            const updated = [...consequencesList];
                                            updated[i] = { ...updated[i], mitigation: e.target.value };
                                            if (isPlanningConsequences) {
                                                setPlan({ ...plan, planningConsequences: updated });
                                            } else {
                                                setPlan({ ...plan, consequences: updated });
                                            }
                                        }}
                                        onBlur={e => {
                                            const updated = [...consequencesList];
                                            updated[i] = { ...updated[i], mitigation: e.target.value.trim() };
                                            if (isPlanningConsequences) {
                                                savePlan({ ...plan, planningConsequences: updated });
                                            } else {
                                                savePlan({ ...plan, consequences: updated });
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
                    {consequencesList.length === 0 && (
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.35)', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                            <div style={{ marginBottom: 8 }}>No failure mode analysis documented</div>
                            <div style={{ fontSize: 11 }}>Use "Modify Plan with AI" below to generate risk analysis, or click "Add Risk Analysis" to manually add one.</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
