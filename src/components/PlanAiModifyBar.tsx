interface PlanAiModifyBarProps {
    aiInstructions: string;
    setAiInstructions: (v: string) => void;
    isAiLoading: boolean;
    handleModifyWithAI: () => Promise<void>;
    inlineAiError: string | null;
    show: boolean;
}

export function PlanAiModifyBar({ aiInstructions, setAiInstructions, isAiLoading, handleModifyWithAI, inlineAiError, show }: PlanAiModifyBarProps) {
    if (!show) return null;

    return (
        <>
            {inlineAiError && (
                <div style={{
                    margin: '0 24px 8px',
                    padding: '8px 14px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '6px',
                    color: '#f87171',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexShrink: 0
                }}>
                    <span className="codicon codicon-error" />
                    {inlineAiError}
                </div>
            )}
            <div style={{
                padding: '18px 24px',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                background: 'rgba(13, 17, 23, 0.8)',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="codicon codicon-sparkle" style={{ color: '#818cf8', fontSize: '13px' }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'white', letterSpacing: '-0.01em' }}>Modify Plan with AI</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        placeholder="e.g., Add a test step, change target database to PostgreSQL, assign DevOpsAgent..."
                        value={aiInstructions}
                        onChange={e => setAiInstructions(e.target.value)}
                        disabled={isAiLoading}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleModifyWithAI();
                        }}
                        style={{
                            flex: 1,
                            background: 'rgba(0, 0, 0, 0.45)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: 'white',
                            padding: '8px 14px',
                            borderRadius: '8px',
                            outline: 'none',
                            fontSize: '13px',
                            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                            transition: 'border-color 0.2s'
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.6)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
                    />
                    <button
                        onClick={handleModifyWithAI}
                        disabled={isAiLoading || !aiInstructions.trim()}
                        style={{
                            padding: '8px 18px',
                            background: isAiLoading || !aiInstructions.trim() ? 'rgba(255, 255, 255, 0.05)' : 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
                            border: 'none',
                            borderRadius: '8px',
                            color: isAiLoading || !aiInstructions.trim() ? 'rgba(255, 255, 255, 0.3)' : 'white',
                            cursor: isAiLoading || !aiInstructions.trim() ? 'default' : 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: isAiLoading || !aiInstructions.trim() ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.3)',
                            transition: 'all 0.2s'
                        }}
                    >
                        {isAiLoading ? (
                            <>
                                <span className="codicon codicon-loading codicon-modifier-spin" />
                                Modifying...
                            </>
                        ) : (
                            <>
                                <span className="codicon codicon-sparkle" />
                                Apply
                            </>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
}
