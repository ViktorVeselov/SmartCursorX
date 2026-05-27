import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

export const VerifyNode = memo(({ data, isConnectable }: NodeProps) => {
    const [ruleId, setRuleId] = useState(data.ruleId || 1);

    const handleRuleChange = (val: number) => {
        setRuleId(val);
        data.ruleId = val;
    };

    return (
        <div style={{
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--bg-secondary)',
            border: '1.5px solid #f59e0b', // Amber Border
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
                style={{ background: '#f59e0b', width: 8, height: 8 }}
            />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="codicon codicon-shield" style={{ color: '#f59e0b', fontSize: '12px' }} />
                    <strong style={{ fontSize: 11, letterSpacing: '0.05em', color: '#f59e0b', textTransform: 'uppercase' }}>Verification Gate</strong>
                </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 600 }}>
                {data.label || 'Run Security Gate'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 500 }}>Active Verification Rule ID</label>
                <input
                    type="number"
                    value={ruleId}
                    onChange={e => handleRuleChange(Number(e.target.value))}
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

            <Handle
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable}
                style={{ background: '#f59e0b', width: 8, height: 8 }}
            />
        </div>
    );
});
VerifyNode.displayName = 'VerifyNode';
