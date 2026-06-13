import { useState, useEffect, useCallback } from 'react';

interface VerificationResult {
    id: number;
    rule_name: string;
    rule_type: string;
    result: 'passed' | 'failed' | 'pending_review';
    details: string | null;
}

interface ExecutionAttempt {
    id: number;
    attempt_number: number;
    model_used: string;
    provider_used: string;
    verification_status: 'passed' | 'failed' | 'needs_review' | 'unverified';
    failure_reason: string | null;
    created_at: string;
    verification_results?: VerificationResult[];
}

interface PlanData {
    filesRead?: string[];
    filesToModify?: string[];
}

interface ExecutionStepsProps {
    taskId: number;
}

export function ExecutionSteps({ taskId }: ExecutionStepsProps) {
    const [attempts, setAttempts] = useState<ExecutionAttempt[]>([]);
    const [plan, setPlan] = useState<PlanData | null>(null);
    const [expandedAttempts, setExpandedAttempts] = useState<Record<number, boolean>>({});
    const [isExploredExpanded, setIsExploredExpanded] = useState(false);
    const [loading, setLoading] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const details = await window.ipcRenderer.invoke('task:get-execution-details', taskId);
            setAttempts(details);

            const planRow = await window.ipcRenderer.invoke('plan:get', taskId);
            if (planRow && planRow.plan_json) {
                setPlan(JSON.parse(planRow.plan_json));
            } else {
                setPlan(null);
            }
        } catch (err) {
            console.error('Failed to load execution details:', err);
        } finally {
            setLoading(false);
        }
    }, [taskId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const toggleAttempt = (attemptNum: number) => {
        setExpandedAttempts(prev => ({
            ...prev,
            [attemptNum]: !prev[attemptNum]
        }));
    };

    if (loading) {
        return <div className="execution-steps loading">Loading execution trace...</div>;
    }

    if (attempts.length === 0 && !plan) {
        return null;
    }

    const totalFilesRead = plan?.filesRead?.length || 0;

    return (
        <div className="execution-trace" style={{
            margin: '12px 0',
            padding: '12px',
            backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
            border: '1px solid var(--vscode-widget-border, #3c3c3c)',
            borderRadius: '6px',
            fontSize: '13px',
            fontFamily: 'var(--vscode-editor-font-family, monospace)',
            color: 'var(--vscode-editor-foreground, #cccccc)'
        }}>
            {/* Header / Summary */}
            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: 'var(--vscode-textPreformat-foreground, #d7ba7d)', display: 'flex', alignItems: 'center' }}>
                <span className="codicon codicon-history" style={{ marginRight: '6px' }} />
                Execution Step Trace
            </div>

            {/* Explored Files Section */}
            {plan && (
                <div style={{ marginBottom: '10px' }}>
                    <div 
                        onClick={() => setIsExploredExpanded(!isExploredExpanded)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', userSelect: 'none', padding: '2px 0' }}
                    >
                        <span className={`codicon ${isExploredExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`} style={{ marginRight: '6px', fontSize: '12px' }} />
                        <span>Explored {totalFilesRead} files, 0 searches</span>
                    </div>

                    {isExploredExpanded && plan.filesRead && (
                        <div style={{ paddingLeft: '20px', borderLeft: '1px dashed #444', marginLeft: '6px', marginTop: '4px' }}>
                            {plan.filesRead.map((file, i) => (
                                <div key={i} style={{ padding: '2px 0', color: 'var(--vscode-textLink-activeForeground, #3794ff)', display: 'flex', alignItems: 'center' }}>
                                    <span className="codicon codicon-file-code" style={{ marginRight: '6px', fontSize: '12px' }} />
                                    <span>Analyzed {file}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Planned Modifications */}
            {plan && plan.filesToModify && plan.filesToModify.length > 0 && (
                <div style={{ marginBottom: '10px', paddingLeft: '6px' }}>
                    {plan.filesToModify.map((file, i) => (
                        <div key={i} style={{ padding: '2px 0', display: 'flex', alignItems: 'center' }}>
                            <span className="codicon codicon-diff-modified" style={{ marginRight: '6px', color: '#e2c08d', fontSize: '12px' }} />
                            <span>Planned modify on {file}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Attempts / Loops */}
            {attempts.map((attempt) => {
                const isExpanded = !!expandedAttempts[attempt.attempt_number];
                const statusColor = attempt.verification_status === 'passed' ? '#4ec9b0' : '#f44747';
                const statusIcon = attempt.verification_status === 'passed' ? 'codicon-pass' : 'codicon-error';

                return (
                    <div key={attempt.id} style={{ borderTop: '1px solid #333', paddingTop: '8px', marginTop: '8px' }}>
                        <div 
                            onClick={() => toggleAttempt(attempt.attempt_number)}
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0', userSelect: 'none' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span className={`codicon ${isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`} style={{ marginRight: '6px', fontSize: '12px' }} />
                                <span style={{ fontWeight: 'bold' }}>Attempt #{attempt.attempt_number}</span>
                                <span style={{ marginLeft: '8px', opacity: 0.6, fontSize: '11px' }}>({attempt.model_used})</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', color: statusColor }}>
                                <span className={`codicon ${statusIcon}`} style={{ marginRight: '4px', fontSize: '12px' }} />
                                <span>{attempt.verification_status}</span>
                            </div>
                        </div>

                        {isExpanded && (
                            <div style={{ paddingLeft: '20px', borderLeft: '1px dashed #444', marginLeft: '6px', marginTop: '6px' }}>
                                {attempt.failure_reason && (
                                    <div style={{ marginBottom: '6px', padding: '6px', backgroundColor: 'rgba(244, 71, 71, 0.1)', border: '1px solid rgba(244, 71, 71, 0.2)', borderRadius: '4px' }}>
                                        <div style={{ fontWeight: 'bold', color: '#f44747', marginBottom: '2px' }}>Failure Reason:</div>
                                        <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px' }}>{attempt.failure_reason}</div>
                                    </div>
                                )}

                                {/* Verification Rule Checks */}
                                <div style={{ marginTop: '6px' }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '4px', opacity: 0.8 }}>Verification Checks:</div>
                                    {attempt.verification_results && attempt.verification_results.length > 0 ? (
                                        attempt.verification_results.map((res) => (
                                            <div key={res.id} style={{ marginBottom: '4px', padding: '4px 6px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ fontWeight: 500 }}>{res.rule_name}</span>
                                                    <span style={{ color: res.result === 'passed' ? '#4ec9b0' : '#f44747', fontSize: '11px', display: 'flex', alignItems: 'center' }}>
                                                        <span className={`codicon ${res.result === 'passed' ? 'codicon-check' : 'codicon-close'}`} style={{ marginRight: '3px', fontSize: '11px' }} />
                                                        {res.result}
                                                    </span>
                                                </div>
                                                {res.details && (
                                                    <pre style={{ margin: '4px 0 0 0', padding: '4px', backgroundColor: '#111', color: '#ccc', borderRadius: '3px', fontSize: '11px', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                                                        {res.details}
                                                    </pre>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ opacity: 0.5, fontSize: '12px' }}>No compiler or linter rule checks ran for this attempt.</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
