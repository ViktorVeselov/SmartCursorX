export interface ChatPlusMenuProps {
    showPlusMenu: boolean;
    onTogglePlusMenu: () => void;
    isLoading: boolean;
    dbAgents: { id: number; name: string; system_prompt: string }[];
    flows: { id: number; name: string; description: string; steps: unknown; agent_id: number }[];
    showAgentSubmenu: boolean;
    onSetShowAgentSubmenu: (v: boolean) => void;
    showWorkflowSubmenu: boolean;
    onSetShowWorkflowSubmenu: (v: boolean) => void;
    onSetActiveAgent: (agent: { id: number; name: string; system_prompt: string }) => void;
    onSetActiveWorkflow: (flow: { id: number; name: string; description: string; steps: unknown; agent_id: number }) => void;
    onClose: () => void;
    onAttachFile: () => Promise<void>;
}

export const ChatPlusMenu = ({
    showPlusMenu,
    onTogglePlusMenu,
    isLoading,
    dbAgents,
    flows,
    showAgentSubmenu,
    onSetShowAgentSubmenu,
    showWorkflowSubmenu,
    onSetShowWorkflowSubmenu,
    onSetActiveAgent,
    onSetActiveWorkflow,
    onClose,
    onAttachFile,
}: ChatPlusMenuProps) => {
    return (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button
                onClick={onTogglePlusMenu}
                title="Add content or tools"
                disabled={isLoading}
                style={{
                    padding: '4px',
                    background: showPlusMenu ? 'var(--bg-active)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    transition: 'var(--transition-smooth)'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseOut={(e) => e.currentTarget.style.background = showPlusMenu ? 'var(--bg-active)' : 'transparent'}
            >
                <span className="codicon codicon-plus" style={{ fontSize: 13 }} />
            </button>

            {showPlusMenu && (
                <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    background: 'var(--bg-glass)',
                    backdropFilter: 'var(--glass-blur)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 1100,
                    minWidth: 160,
                    display: 'flex',
                    flexDirection: 'column',
                    marginBottom: 8,
                    padding: 4
                }}>
                    <div
                        onClick={async () => {
                            onClose();
                            await onAttachFile();
                        }}
                        style={{
                            padding: '6px 12px',
                            fontSize: 'var(--font-xs)',
                            cursor: 'pointer',
                            color: 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            borderRadius: 'var(--radius-sm)'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <span className="codicon codicon-file-media" />
                        Attach File
                    </div>

                    <div style={{ position: 'relative' }}>
                        <div
                            onClick={() => {
                                onSetShowAgentSubmenu(!showAgentSubmenu);
                                onSetShowWorkflowSubmenu(false);
                            }}
                            style={{
                                padding: '6px 12px',
                                fontSize: 'var(--font-xs)',
                                cursor: 'pointer',
                                color: 'var(--text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                borderRadius: 'var(--radius-sm)'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <span className="codicon codicon-hubot" />
                            Attach Agent
                            <span className="codicon codicon-chevron-right" style={{ marginLeft: 'auto', fontSize: 10 }} />
                        </div>

                        {showAgentSubmenu && (
                            <div style={{
                                position: 'absolute',
                                left: '100%',
                                bottom: 0,
                                background: 'var(--bg-glass)',
                                backdropFilter: 'var(--glass-blur)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-md)',
                                boxShadow: 'var(--shadow-lg)',
                                zIndex: 1150,
                                minWidth: 140,
                                display: 'flex',
                                flexDirection: 'column',
                                marginLeft: 4,
                                padding: 4
                            }}>
                                {dbAgents.length === 0 ? (
                                    <div style={{ padding: '6px 12px', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                        No custom agents
                                    </div>
                                ) : (
                                    dbAgents.map(agent => (
                                        <div
                                            key={agent.id}
                                            onClick={() => {
                                                onSetActiveAgent(agent);
                                                onClose();
                                                onSetShowAgentSubmenu(false);
                                            }}
                                            style={{
                                                padding: '6px 12px',
                                                fontSize: 'var(--font-xs)',
                                                cursor: 'pointer',
                                                color: 'var(--text-primary)',
                                                borderRadius: 'var(--radius-sm)'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            {agent.name}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    <div style={{ position: 'relative' }}>
                        <div
                            onClick={() => {
                                onSetShowWorkflowSubmenu(!showWorkflowSubmenu);
                                onSetShowAgentSubmenu(false);
                            }}
                            style={{
                                padding: '6px 12px',
                                fontSize: 'var(--font-xs)',
                                cursor: 'pointer',
                                color: 'var(--text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                borderRadius: 'var(--radius-sm)'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <span className="codicon codicon-git-merge" />
                            Attach Workflow
                            <span className="codicon codicon-chevron-right" style={{ marginLeft: 'auto', fontSize: 10 }} />
                        </div>

                        {showWorkflowSubmenu && (
                            <div style={{
                                position: 'absolute',
                                left: '100%',
                                bottom: 0,
                                background: 'var(--bg-glass)',
                                backdropFilter: 'var(--glass-blur)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-md)',
                                boxShadow: 'var(--shadow-lg)',
                                zIndex: 1150,
                                minWidth: 140,
                                display: 'flex',
                                flexDirection: 'column',
                                marginLeft: 4,
                                padding: 4
                            }}>
                                {flows.length === 0 ? (
                                    <div style={{ padding: '6px 12px', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                        No workflows available
                                    </div>
                                ) : (
                                    flows.map(flow => (
                                        <div
                                            key={flow.id}
                                            onClick={() => {
                                                onSetActiveWorkflow(flow);
                                                onClose();
                                                onSetShowWorkflowSubmenu(false);
                                            }}
                                            style={{
                                                padding: '6px 12px',
                                                fontSize: 'var(--font-xs)',
                                                cursor: 'pointer',
                                                color: 'var(--text-primary)',
                                                borderRadius: 'var(--radius-sm)'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            {flow.name}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
