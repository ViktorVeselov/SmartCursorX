export interface ChatHeaderProps {
    showHistoryDrawer: boolean;
    onToggleHistoryDrawer: () => void;
    activeConversationId: string | null;
    isLoading: boolean;
    onForkChat: () => void;
    onForkSubThread: () => void;
    onToggleSettings: () => void;
    onClose: () => void;
}

export function ChatHeader({
    showHistoryDrawer,
    onToggleHistoryDrawer,
    activeConversationId,
    isLoading,
    onForkChat,
    onForkSubThread,
    onToggleSettings,
    onClose,
}: ChatHeaderProps) {
    return (
        <div className="chat-header">
            <h3><span className="codicon codicon-hubot" style={{ marginRight: 8 }} />AI Assistant</h3>
            <div className="chat-actions">
                <button
                    onClick={onToggleHistoryDrawer}
                    title="Chat History"
                    style={{
                        background: showHistoryDrawer ? 'var(--bg-active)' : 'none',
                        border: 'none',
                        color: showHistoryDrawer ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        marginRight: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <span className="codicon codicon-history" />
                </button>
                {activeConversationId && (
                    <button
                        onClick={onForkChat}
                        title="Fork Chat (Copy history to new conversation)"
                        disabled={isLoading}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            marginRight: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: isLoading ? 0.5 : 1
                        }}
                        onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                        <span className="codicon codicon-repo-forked" />
                    </button>
                )}
                <button
                    onClick={onForkSubThread}
                    title="Fork Sub-Thread"
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginRight: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <span className="codicon codicon-git-fork-private" />
                </button>
                <button onClick={onToggleSettings} title="API Keys">
                    <span className="codicon codicon-key" />
                </button>
                <button onClick={onClose} title="Close Chat Panel">
                    <span className="codicon codicon-close" />
                </button>
            </div>
        </div>
    );
}
