interface StatusBarProps {
    vimEnabled: boolean;
    runningLocalModel: string | null;
    executionStatus: {
        taskId: number;
        phase: string;
        message: string;
        attempt?: number;
        totalAttempts?: number;
    } | null;
    onStopExecution: () => void;
}

const PHASE_ORDER = ['investigating', 'generating', 'applying', 'verifying'] as const;
const PHASE_LABELS: Record<string, string> = {
    investigating: 'Analyze',
    generating: 'Generate',
    applying: 'Apply',
    verifying: 'Verify',
};

export function StatusBar({ vimEnabled, runningLocalModel, executionStatus, onStopExecution }: StatusBarProps) {
    const phaseIndex = executionStatus ? PHASE_ORDER.indexOf(executionStatus.phase as typeof PHASE_ORDER[number]) : -1;

    return (
        <footer className="status-bar">
            <span>TypeScript</span>
            <span>UTF-8</span>
            <span>{vimEnabled ? 'VIM' : 'INSERT'}</span>
            {runningLocalModel && (
                <span style={{ color: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#22c55e',
                        boxShadow: '0 0 6px #22c55e',
                        display: 'inline-block'
                    }} />
                    Local LLM Active: {runningLocalModel}
                </span>
            )}
            {executionStatus && (
                <span style={{ color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                    <span className="codicon codicon-loading codicon-modifier-spin" style={{ color: '#fbbf24', fontSize: '13px' }} />
                    <span style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {PHASE_ORDER.map((phase, i) => {
                            const isComplete = i < phaseIndex;
                            const isCurrent = i === phaseIndex;
                            const color = executionStatus.phase === 'completed' ? '#22c55e'
                                : executionStatus.phase === 'failed' ? '#ef4444'
                                : isComplete ? '#22c55e'
                                : isCurrent ? '#fbbf24'
                                : '#555';
                            const symbol = isComplete ? '●' : isCurrent ? '●' : '○';
                            return (
                                <span key={phase} style={{ color, fontWeight: isCurrent ? 700 : 400, transition: 'color 0.3s' }}>
                                    {symbol} {PHASE_LABELS[phase]}
                                </span>
                            );
                        })}
                        <span style={{ marginLeft: '8px' }}>{executionStatus.message}</span>
                        {executionStatus.attempt && executionStatus.totalAttempts
                            ? ` (${executionStatus.attempt}/${executionStatus.totalAttempts})`
                            : ''}
                    </span>
                    <button
                        onClick={onStopExecution}
                        title="Stop execution"
                        style={{
                            padding: '1px 6px',
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: '3px',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            lineHeight: '16px'
                        }}
                    >
                        <span className="codicon codicon-stop" /> Stop
                    </button>
                </span>
            )}
            <span className="status-right">SmartCursorX v0.1.0</span>
        </footer>
    );
}
