export interface ChatHistorySidebarProps {
    conversations: Record<string, unknown>[];
    activeConversationId: string | null;
    editingConvId: string | null;
    editingTitle: string;
    onSelectConversation: (convId: string) => void;
    onStartRename: (e: React.MouseEvent, conv: Record<string, unknown>) => void;
    onSaveRename: (convId: string) => void;
    onDeleteConversation: (e: React.MouseEvent, convId: string) => void;
    onContextMenu: (e: React.MouseEvent, conv: Record<string, unknown>) => void;
    onNewChat: () => void;
    onSetEditingConvId: (id: string | null) => void;
    onSetEditingTitle: (title: string) => void;
}

export const ChatHistorySidebar = ({
    conversations,
    activeConversationId,
    editingConvId,
    editingTitle,
    onSelectConversation,
    onStartRename,
    onSaveRename,
    onDeleteConversation,
    onContextMenu,
    onNewChat,
    onSetEditingConvId,
    onSetEditingTitle,
}: ChatHistorySidebarProps) => {
    return (
        <div className="chat-history-sidebar" style={{
            width: 240,
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-secondary)',
            height: '100%',
            flexShrink: 0
        }}>
            <div style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                height: 40,
                boxSizing: 'border-box'
            }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Chat History</span>
                <button
                    onClick={onNewChat}
                    title="New Chat"
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        borderRadius: '4px'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                    <span className="codicon codicon-add" style={{ fontSize: 14 }} />
                </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {conversations.length === 0 ? (
                    <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 11, fontStyle: 'italic' }}>
                        No past conversations
                    </div>
                ) : (
                    conversations.map(raw => {
                        const conv = raw as { id: string; title?: string; model?: string; provider?: string };
                        const isEditing = editingConvId === conv.id;
                        const isActive = activeConversationId === conv.id;
                        return (
                            <div
                                key={conv.id}
                                onClick={() => !isEditing && onSelectConversation(conv.id)}
                                onContextMenu={(e) => !isEditing && onContextMenu(e, conv)}
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: 6,
                                    background: isActive ? 'var(--bg-active)' : 'transparent',
                                    cursor: isEditing ? 'default' : 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 2,
                                    position: 'relative',
                                    transition: 'background 0.2s'
                                }}
                                onMouseOver={e => { if (!isActive && !isEditing) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                onMouseOut={e => { if (!isActive && !isEditing) e.currentTarget.style.background = 'transparent'; }}
                            >
                                {isEditing ? (
                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            value={editingTitle}
                                            onChange={e => onSetEditingTitle(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') onSaveRename(conv.id);
                                                else if (e.key === 'Escape') onSetEditingConvId(null);
                                            }}
                                            autoFocus
                                            style={{
                                                flex: 1,
                                                background: 'var(--bg-input)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 4,
                                                color: 'var(--text-primary)',
                                                padding: '2px 6px',
                                                fontSize: 11,
                                                outline: 'none'
                                            }}
                                        />
                                        <button
                                            onClick={() => onSaveRename(conv.id)}
                                            style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', padding: 2 }}
                                        >
                                            <span className="codicon codicon-check" style={{ fontSize: 12 }} />
                                        </button>
                                        <button
                                            onClick={() => onSetEditingConvId(null)}
                                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2 }}
                                        >
                                            <span className="codicon codicon-close" style={{ fontSize: 12 }} />
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{
                                            fontSize: 12,
                                            fontWeight: isActive ? 600 : 500,
                                            color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            flex: 1,
                                            marginRight: 6
                                        }}>
                                            {(conv.title as string) || 'Untitled Conversation'}
                                        </span>
                                        <div style={{ display: 'flex', gap: 2 }}>
                                            <button
                                                onClick={e => onStartRename(e, conv)}
                                                title="Rename"
                                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
                                                onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                                onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                            >
                                                <span className="codicon codicon-edit" style={{ fontSize: 10 }} />
                                            </button>
                                            <button
                                                onClick={e => onDeleteConversation(e, conv.id)}
                                                title="Delete"
                                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
                                                onMouseOver={e => e.currentTarget.style.color = '#ff6b6b'}
                                                onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                            >
                                                <span className="codicon codicon-trash" style={{ fontSize: 10 }} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <span style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', opacity: 0.7 }}>
                                    {(conv.model as string)} ({(conv.provider as string)})
                                </span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
