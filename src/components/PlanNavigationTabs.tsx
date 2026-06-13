import type { ActiveTab } from '../helpers/planEditorTypes';

interface PlanNavigationTabsProps {
    activeTab: ActiveTab;
    setActiveTab: (v: ActiveTab) => void;
    showPlanningTab: boolean;
    isDetailedPlanningLoading: boolean;
    showPlanningInput: boolean;
    setShowPlanningInput: (v: boolean) => void;
    planningDirectives: string;
    setPlanningDirectives: (v: string) => void;
    handleDetailedPlanning: (directives?: string) => Promise<void>;
}

// eslint-disable-next-line complexity
export function PlanNavigationTabs({
    activeTab, setActiveTab, showPlanningTab,
    isDetailedPlanningLoading, showPlanningInput, setShowPlanningInput,
    planningDirectives, setPlanningDirectives, handleDetailedPlanning
}: PlanNavigationTabsProps) {
    return (
        <div style={{
            display: 'flex',
            background: 'rgba(13, 17, 23, 0.4)',
            backdropFilter: 'blur(12px)',
            padding: '0 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            gap: '8px',
            flexShrink: 0,
            alignItems: 'center',
            position: 'relative',
            zIndex: 50
        }}>
            {/* Sleek Pill Orange Button for Code Planning with popup input directives */}
            <div className="planning-popover-container" style={{ position: 'relative', display: 'flex', alignItems: 'center', marginRight: '8px' }}>
                <button
                    className="planning-trigger-btn"
                    onClick={() => setShowPlanningInput(!showPlanningInput)}
                    disabled={isDetailedPlanningLoading}
                    style={{
                        padding: '6px 12px',
                        borderRadius: '16px',
                        background: isDetailedPlanningLoading
                            ? 'rgba(234, 88, 12, 0.3)'
                            : 'linear-gradient(135deg, #ff8c3a 0%, #ea580c 100%)',
                        border: 'none',
                        color: 'white',
                        cursor: isDetailedPlanningLoading ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 0 8px rgba(234, 88, 12, 0.3)',
                        transition: 'all 0.2s ease',
                        flexShrink: 0,
                        fontSize: '11px',
                        fontWeight: 600
                    }}
                    title="Generate Code Planning: Writes code drafts and design explanations"
                >
                    {isDetailedPlanningLoading ? (
                        <span className="codicon codicon-loading codicon-modifier-spin" style={{ fontSize: '12px' }} />
                    ) : (
                        <span className="codicon codicon-code" style={{ fontSize: '12px' }} />
                    )}
                    <span>Generate Code Planning</span>
                </button>

                {showPlanningInput && (
                    <div style={{
                        position: 'absolute',
                        top: '36px',
                        left: '0',
                        width: '300px',
                        background: 'rgba(15, 23, 42, 0.98)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '12px',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5), 0 0 12px rgba(234, 88, 12, 0.2)',
                        zIndex: 1000,
                        backdropFilter: 'blur(16px)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        animation: 'fadeIn 0.15s ease'
                    }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>
                            Code Planning Directives
                        </div>
                        <textarea
                            value={planningDirectives}
                            onChange={e => setPlanningDirectives(e.target.value)}
                            placeholder="Specify custom constraints, patterns, libraries, or files to prioritize (optional)..."
                            style={{
                                width: '100%',
                                height: '80px',
                                background: 'rgba(0, 0, 0, 0.3)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '4px',
                                color: 'white',
                                padding: '6px',
                                fontSize: '11px',
                                outline: 'none',
                                resize: 'none',
                                fontFamily: 'inherit'
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    handleDetailedPlanning(planningDirectives);
                                    setShowPlanningInput(false);
                                }
                            }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                                onClick={() => setShowPlanningInput(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'rgba(255, 255, 255, 0.5)',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    padding: '4px 8px'
                                }}
                            >Cancel</button>
                            <button
                                onClick={() => {
                                    handleDetailedPlanning(planningDirectives);
                                    setShowPlanningInput(false);
                                }}
                                style={{
                                    background: 'linear-gradient(135deg, #ff8c3a 0%, #ea580c 100%)',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    padding: '4px 10px'
                                }}
                            >Generate</button>
                        </div>
                    </div>
                )}
            </div>

            {showPlanningTab && (
                <button
                    onClick={() => setActiveTab('planning')}
                    style={{
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'planning' ? '2px solid #818cf8' : '2px solid transparent',
                        color: activeTab === 'planning' ? 'white' : 'rgba(255, 255, 255, 0.5)',
                        fontSize: '13px',
                        fontWeight: activeTab === 'planning' ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >Code Planning</button>
            )}
            <button
                onClick={() => setActiveTab('doc')}
                style={{
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'doc' ? '2px solid #818cf8' : '2px solid transparent',
                    color: activeTab === 'doc' ? 'white' : 'rgba(255, 255, 255, 0.5)',
                    fontSize: '13px',
                    fontWeight: activeTab === 'doc' ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                }}
            >Design Doc</button>
            <button
                onClick={() => setActiveTab('tradeoffs')}
                style={{
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'tradeoffs' ? '2px solid #818cf8' : '2px solid transparent',
                    color: activeTab === 'tradeoffs' ? 'white' : 'rgba(255, 255, 255, 0.5)',
                    fontSize: '13px',
                    fontWeight: activeTab === 'tradeoffs' ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                }}
            >Implementation Trade-offs</button>
            <button
                onClick={() => setActiveTab('consequences')}
                style={{
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'consequences' ? '2px solid #818cf8' : '2px solid transparent',
                    color: activeTab === 'consequences' ? 'white' : 'rgba(255, 255, 255, 0.5)',
                    fontSize: '13px',
                    fontWeight: activeTab === 'consequences' ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                }}
            >Failure Modes & Consequences</button>
            <button
                onClick={() => setActiveTab('steps')}
                style={{
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'steps' ? '2px solid #818cf8' : '2px solid transparent',
                    color: activeTab === 'steps' ? 'white' : 'rgba(255, 255, 255, 0.5)',
                    fontSize: '13px',
                    fontWeight: activeTab === 'steps' ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                }}
            >Roadmap Steps</button>
            <button
                onClick={() => setActiveTab('overview')}
                style={{
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'overview' ? '2px solid #818cf8' : '2px solid transparent',
                    color: activeTab === 'overview' ? 'white' : 'rgba(255, 255, 255, 0.5)',
                    fontSize: '13px',
                    fontWeight: activeTab === 'overview' ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                }}
            >Details & Context</button>

            <button
                onClick={() => setActiveTab('flow')}
                style={{
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'flow' ? '2px solid #818cf8' : '2px solid transparent',
                    color: activeTab === 'flow' ? 'white' : 'rgba(255, 255, 255, 0.5)',
                    fontSize: '13px',
                    fontWeight: activeTab === 'flow' ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                }}
            >Visual Flow</button>
        </div>
    );
}
