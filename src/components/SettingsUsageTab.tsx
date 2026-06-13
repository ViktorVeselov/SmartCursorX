const getIpc = () => window.ipcRenderer;

interface SettingsUsageTabProps {
    usageStats: {
        totalTokens: number;
        totalInputTokens: number;
        totalOutputTokens: number;
        totalCost: number;
        breakdowns: Record<string, unknown>[];
    };
    setUsageStats: React.Dispatch<React.SetStateAction<{
        totalTokens: number;
        totalInputTokens: number;
        totalOutputTokens: number;
        totalCost: number;
        breakdowns: Record<string, unknown>[];
    }>>;
}

export function SettingsUsageTab({ usageStats, setUsageStats }: SettingsUsageTabProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ marginTop: 0, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>📊</span> Usage & Costs
                </h3>
                <button
                    onClick={async () => {
                        if (confirm('Are you sure you want to reset all token usage logs? This cannot be undone.')) {
                            await getIpc().invoke('ai:clear-usage-stats');
                            setUsageStats({ totalTokens: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, breakdowns: [] });
                        }
                    }}
                    style={{
                        padding: '4px 10px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 500
                    }}
                >
                    Reset Usage Logs
                </button>
            </div>

            {/* Summary Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div style={{ padding: 16, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>Total Estimated Cost</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>${usageStats.totalCost.toFixed(4)}</div>
                </div>
                <div style={{ padding: 16, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>Total Tokens Consumed</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{usageStats.totalTokens.toLocaleString()}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 4 }}>In: {usageStats.totalInputTokens?.toLocaleString() || 0} | Out: {usageStats.totalOutputTokens?.toLocaleString() || 0}</div>
                </div>
                <div style={{ padding: 16, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>Most Active Model</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 6 }} title={
                        ((usageStats.breakdowns as Record<string, unknown>[]).reduce((max: Record<string, unknown>, curr: Record<string, unknown>) => (curr.tokens as number) > (max.tokens as number) ? curr : max, { model: 'None', tokens: 0 }).model as string)
                    }>
                        {((usageStats.breakdowns as Record<string, unknown>[]).reduce((max: Record<string, unknown>, curr: Record<string, unknown>) => (curr.tokens as number) > (max.tokens as number) ? curr : max, { model: 'None', tokens: 0 }).model as string)}
                    </div>
                </div>
            </div>

            {/* Breakdown List */}
            <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="codicon codicon-graph" />
                    <span>Model Breakdowns</span>
                </div>

                {usageStats.breakdowns.length === 0 ? (
                    <div style={{
                        padding: 30,
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-lg)',
                        textAlign: 'center',
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        fontStyle: 'italic'
                    }}>
                        No usage stats logged yet. Chat with models or run tasks to generate metrics!
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                        {(usageStats.breakdowns as Record<string, unknown>[]).map((item: Record<string, unknown>, idx: number) => {
                            const pct = usageStats.totalTokens > 0 ? (item.tokens as number) / usageStats.totalTokens * 100 : 0;
                            return (
                                <div key={idx} style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: 12,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 8
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                                        <div>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{(item.model as string)}</span>
                                            <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 8, textTransform: 'uppercase' }}>({(item.provider as string)})</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 16 }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>{(item.tokens as number).toLocaleString()} tokens <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>(In: {(item.inputTokens as number)?.toLocaleString() || 0} | Out: {(item.outputTokens as number)?.toLocaleString() || 0})</span></span>
                                            <span style={{ fontWeight: 600, color: '#10b981' }}>${(item.cost as number).toFixed(4)}</span>
                                        </div>
                                    </div>
                                    {/* Progress bar */}
                                    <div style={{ width: '100%', height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: 3 }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
