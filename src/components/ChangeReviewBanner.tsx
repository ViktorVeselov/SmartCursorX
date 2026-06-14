interface ChangeReviewBannerProps {
    taskId: number;
    fileCount: number;
    addedLines: number;
    removedLines: number;
    onOpenReview: (taskId: number) => void;
    onAcceptAll: () => void;
    onRejectAll: () => void;
    isApplying: boolean;
}

export function ChangeReviewBanner({
    taskId,
    fileCount,
    addedLines,
    removedLines,
    onOpenReview,
    onAcceptAll,
    onRejectAll,
    isApplying,
}: ChangeReviewBannerProps) {
    if (fileCount === 0) return null;

    return (
        <div style={{
            padding: '10px 16px',
            background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
            borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="codicon codicon-diff" style={{ color: '#818cf8', fontSize: 14 }} />
                <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                    {fileCount} file{fileCount !== 1 ? 's' : ''} modified
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    <span style={{ color: '#34d399' }}>+{addedLines}</span> / <span style={{ color: '#f43f5e' }}>-{removedLines}</span>
                </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
                <button
                    onClick={() => onOpenReview(taskId)}
                    disabled={isApplying}
                    style={{
                        padding: '4px 10px',
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: 4,
                        color: '#818cf8',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                    }}
                >
                    <span className="codicon codicon-eye" style={{ fontSize: 11 }} /> Review
                </button>
                <button
                    onClick={onAcceptAll}
                    disabled={isApplying}
                    style={{
                        padding: '4px 10px',
                        background: 'rgba(52, 211, 153, 0.15)',
                        border: '1px solid rgba(52, 211, 153, 0.3)',
                        borderRadius: 4,
                        color: '#34d399',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                    }}
                >
                    <span className="codicon codicon-check" style={{ fontSize: 11 }} /> Accept All
                </button>
                <button
                    onClick={onRejectAll}
                    disabled={isApplying}
                    style={{
                        padding: '4px 10px',
                        background: 'rgba(244, 63, 94, 0.1)',
                        border: '1px solid rgba(244, 63, 94, 0.2)',
                        borderRadius: 4,
                        color: '#f43f5e',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                    }}
                >
                    <span className="codicon codicon-close" style={{ fontSize: 11 }} /> Reject All
                </button>
            </div>
        </div>
    );
}
