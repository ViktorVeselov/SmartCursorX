import type { AppAgent, AppFlow } from './ChatPanel';

export interface ActiveBadgesProps {
    attachedFile: { name: string; path: string; content: string } | null;
    onRemoveFile: () => void;
    isPlanModeActive: boolean;
    onTogglePlanMode: () => void;
    activeAgent: AppAgent | null;
    onRemoveAgent: () => void;
    activeWorkflow: AppFlow | null;
    onRemoveWorkflow: () => void;
}

export const ActiveBadges = ({
    attachedFile,
    onRemoveFile,
    isPlanModeActive,
    onTogglePlanMode,
    activeAgent,
    onRemoveAgent,
    activeWorkflow,
    onRemoveWorkflow,
}: ActiveBadgesProps) => {
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '0 16px 8px 16px', alignSelf: 'flex-start' }}>
            {attachedFile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
                    <span className="codicon codicon-file" style={{ fontSize: 12 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{attachedFile.name}</span>
                    <span
                        className="codicon codicon-close"
                        style={{ fontSize: 10, cursor: 'pointer', marginLeft: 4 }}
                        onClick={onRemoveFile}
                    />
                </div>
            )}
            {isPlanModeActive && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'rgba(0, 122, 204, 0.1)', border: '1px solid rgba(0, 122, 204, 0.2)', borderRadius: 4 }}>
                    <span className="codicon codicon-checklist" style={{ fontSize: 12, color: 'var(--accent-primary)' }} />
                    <span style={{ fontSize: 11, color: 'var(--accent-primary)', fontWeight: 600 }}>Plan Mode Active</span>
                    <span
                        className="codicon codicon-close"
                        style={{ fontSize: 10, cursor: 'pointer', marginLeft: 4, color: 'var(--accent-primary)' }}
                        onClick={onTogglePlanMode}
                    />
                </div>
            )}
            {activeAgent && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: 4 }}>
                    <span className="codicon codicon-hubot" style={{ fontSize: 12, color: '#a855f7' }} />
                    <span style={{ fontSize: 11, color: '#a855f7', fontWeight: 600 }}>Agent: {activeAgent.name}</span>
                    <span
                        className="codicon codicon-close"
                        style={{ fontSize: 10, cursor: 'pointer', marginLeft: 4, color: '#a855f7' }}
                        onClick={onRemoveAgent}
                    />
                </div>
            )}
            {activeWorkflow && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: 4 }}>
                    <span className="codicon codicon-git-merge" style={{ fontSize: 12, color: '#eab308' }} />
                    <span style={{ fontSize: 11, color: '#eab308', fontWeight: 600 }}>Workflow: {activeWorkflow.name}</span>
                    <span
                        className="codicon codicon-close"
                        style={{ fontSize: 10, cursor: 'pointer', marginLeft: 4, color: '#eab308' }}
                        onClick={onRemoveWorkflow}
                    />
                </div>
            )}
        </div>
    );
};
