import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

export const CodeSearchNode = memo(({ data, isConnectable }: NodeProps) => {
    const [query, setQuery] = useState(data.query || 'find functions');
    const [searchType, setSearchType] = useState(data.searchType || 'symbols');

    const handleQueryChange = (val: string) => {
        setQuery(val);
        data.query = val;
    };

    const handleTypeChange = (val: 'symbols' | 'refs' | 'hierarchy') => {
        setSearchType(val);
        data.searchType = val;
    };

    return (
        <div style={{
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--bg-secondary)',
            border: '1.5px solid #06b6d4', // Teal Border
            color: 'var(--text-primary)',
            minWidth: '220px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            boxSizing: 'border-box'
        }}>
            <Handle
                type="target"
                position={Position.Top}
                isConnectable={isConnectable}
                style={{ background: '#06b6d4', width: 8, height: 8 }}
            />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="codicon codicon-symbol-structure" style={{ color: '#06b6d4', fontSize: '12px' }} />
                    <strong style={{ fontSize: 11, letterSpacing: '0.05em', color: '#06b6d4', textTransform: 'uppercase' }}>Code Search</strong>
                </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 600 }}>
                {data.label || 'Search Workspace'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 500 }}>Search Query</label>
                <input
                    type="text"
                    value={query}
                    onChange={e => handleQueryChange(e.target.value)}
                    className="nodrag"
                    style={{
                        width: '100%',
                        padding: '4px 6px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        outline: 'none',
                        boxSizing: 'border-box'
                    }}
                />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 500 }}>Target Scope</label>
                <div style={{ display: 'flex', gap: 4 }} className="nodrag">
                    {(['symbols', 'refs', 'hierarchy'] as const).map(type => (
                        <button
                            key={type}
                            onClick={() => handleTypeChange(type)}
                            style={{
                                flex: 1,
                                padding: '3px 0',
                                border: '1px solid var(--border-subtle)',
                                background: searchType === type ? '#06b6d4' : 'transparent',
                                color: searchType === type ? '#fff' : 'var(--text-secondary)',
                                fontSize: '9px',
                                textTransform: 'capitalize',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                fontWeight: 600
                            }}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable}
                style={{ background: '#06b6d4', width: 8, height: 8 }}
            />
        </div>
    );
});
CodeSearchNode.displayName = 'CodeSearchNode';
