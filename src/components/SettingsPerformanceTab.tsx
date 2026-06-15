import { useState, useEffect, useCallback } from 'react';

interface ModelStats {
    model: string;
    provider: string;
    taskType: string;
    totalRuns: number;
    successfulRuns: number;
    successRate: number;
    avgLatencyMs: number;
    avgInputTokens: number;
    avgOutputTokens: number;
    avgTokens: number;
}

export function SettingsPerformanceTab() {
    const [stats, setStats] = useState<ModelStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterProvider, setFilterProvider] = useState('');
    const [filterTaskType, setFilterTaskType] = useState('');

    const loadStats = useCallback(async () => {
        setLoading(true);
        try {
            const result = await window.ipcRenderer.invoke(
                'ai:get-model-stats',
                filterProvider || undefined,
                undefined,
                filterTaskType || undefined
            );
            setStats(result || []);
        } catch (err) {
            console.error('Failed to load model stats:', err);
        } finally {
            setLoading(false);
        }
    }, [filterProvider, filterTaskType]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const providers = Array.from(new Set(stats.map(s => s.provider).filter(Boolean)));
    const taskTypes = Array.from(new Set(stats.map(s => s.taskType).filter(Boolean)));

    const isRecommended = (stat: ModelStats): boolean => {
        return stat.totalRuns >= 10 && stat.successRate >= 0.85;
    };

    return (
        <div style={{ padding: '16px 0' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                    value={filterProvider}
                    onChange={e => setFilterProvider(e.target.value)}
                    style={selectStyle}
                >
                    <option value="">All Providers</option>
                    {providers.map(p => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
                <select
                    value={filterTaskType}
                    onChange={e => setFilterTaskType(e.target.value)}
                    style={selectStyle}
                >
                    <option value="">All Task Types</option>
                    {taskTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>
                <button
                    onClick={loadStats}
                    style={{
                        padding: '6px 14px', background: 'var(--accent-primary)',
                        border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500
                    }}
                >
                    Refresh
                </button>
            </div>

            {loading ? (
                <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', padding: 24 }}>
                    Loading performance data...
                </div>
            ) : stats.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: 24 }}>
                    No model performance data yet. Data is collected automatically as you run tasks.
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                                <th style={thStyle}>Model</th>
                                <th style={thStyle}>Provider</th>
                                <th style={thStyle}>Task Type</th>
                                <th style={thStyle}>Runs</th>
                                <th style={thStyle}>Success Rate</th>
                                <th style={thStyle}>Avg Latency</th>
                                <th style={thStyle}>Avg Tokens</th>
                                <th style={thStyle}> </th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.map((stat, i) => (
                                <tr
                                    key={`${stat.model}-${stat.provider}-${stat.taskType}-${i}`}
                                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                                >
                                    <td style={tdStyle}>{stat.model}</td>
                                    <td style={tdStyle}>{stat.provider}</td>
                                    <td style={tdStyle}>{stat.taskType || '—'}</td>
                                    <td style={tdStyle}>{stat.totalRuns}</td>
                                    <td style={{
                                        ...tdStyle,
                                        color: stat.successRate >= 0.85 ? '#22c55e' : stat.successRate >= 0.6 ? '#f59e0b' : '#ef4444',
                                        fontWeight: 600
                                    }}>
                                        {(stat.successRate * 100).toFixed(0)}%
                                    </td>
                                    <td style={tdStyle}>{stat.avgLatencyMs}ms</td>
                                    <td style={tdStyle}>{stat.avgTokens}</td>
                                    <td style={tdStyle}>
                                        {isRecommended(stat) && (
                                            <span style={{
                                                background: 'rgba(34, 197, 94, 0.15)',
                                                color: '#22c55e',
                                                padding: '2px 8px',
                                                borderRadius: 4,
                                                fontSize: 10,
                                                fontWeight: 600
                                            }}>
                                                Recommended
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div style={{ marginTop: 16, color: 'var(--text-secondary)', fontSize: 11 }}>
                <span style={{ color: '#22c55e', fontWeight: 600 }}>Recommended</span> = 10+ runs and +85% success rate.
                Data is read-only. Use this to make informed model selections.
            </div>
        </div>
    );
}

const selectStyle: React.CSSProperties = {
    padding: '6px 10px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    fontSize: 12,
    outline: 'none',
    cursor: 'pointer',
};

const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 12px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
    padding: '8px 12px',
    whiteSpace: 'nowrap',
};
