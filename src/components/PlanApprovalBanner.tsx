import type { ExecutionPlan } from '../helpers/planEditorTypes';

interface PlanApprovalBannerProps {
    plan: ExecutionPlan;
    handleApprovePlan: () => Promise<void>;
    handleRevokeApproval: () => void;
    isExecuting?: boolean;
    onStop?: () => void;
    executionMessage?: string;
}

export function PlanApprovalBanner({ plan, handleApprovePlan, handleRevokeApproval, isExecuting, onStop, executionMessage }: PlanApprovalBannerProps) {
    return (
        <div style={{
            padding: '12px 24px',
            background: plan.approved
                ? 'linear-gradient(90deg, rgba(52, 211, 153, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)'
                : 'linear-gradient(90deg, rgba(129, 140, 248, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%)',
            borderBottom: plan.approved
                ? '1px solid rgba(52, 211, 153, 0.2)'
                : '1px solid rgba(129, 140, 248, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
            flexShrink: 0
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
                {isExecuting ? (
                    <span className="codicon codicon-loading codicon-modifier-spin" style={{ color: '#34d399', fontSize: '15px' }} />
                ) : (
                    <span className={`codicon ${plan.approved ? 'codicon-pass-filled' : 'codicon-info'}`} style={{ color: plan.approved ? '#34d399' : '#818cf8', fontSize: '15px' }} />
                )}
                <span>
                    {isExecuting
                        ? (executionMessage || 'Executing roadmap steps...')
                        : plan.approved
                            ? 'Ready to build.'
                            : 'Review Draft Plan: You can modify steps inline or ask AI to refine the details, then approve when ready.'}
                </span>
            </div>
            {isExecuting ? (
                <button
                    onClick={onStop}
                    style={{
                        padding: '4px 12px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: '4px',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s'
                    }}
                >
                    <span className="codicon codicon-stop" /> Stop
                </button>
            ) : plan.approved ? (
                <button
                    onClick={handleRevokeApproval}
                    style={{
                        padding: '4px 12px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '4px',
                        color: '#f87171',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s'
                    }}
                >
                    <span className="codicon codicon-history" /> Revoke Approval
                </button>
            ) : (
                <button
                    onClick={handleApprovePlan}
                    disabled={isExecuting}
                    style={{
                        padding: '6px 14px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                    }}
                >
                    <span className="codicon codicon-play" />
                    Build
                </button>
            )}
        </div>
    );
}
