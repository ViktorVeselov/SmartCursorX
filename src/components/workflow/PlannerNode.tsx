import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

export const PlannerNode = memo(({ data, isConnectable }: NodeProps) => {
    return (
        <div style={{
            padding: '10px',
            borderRadius: '8px',
            background: 'var(--bg-secondary)',
            border: '2px solid #a855f7', // Purple
            color: 'var(--text-primary)',
            minWidth: '180px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}>
            <Handle
                type="target"
                position={Position.Top}
                isConnectable={isConnectable}
                style={{ background: '#555' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                <span className="codicon codicon-list-tree" style={{ marginRight: 8, color: '#a855f7' }} />
                <strong style={{ fontSize: 13, color: '#a855f7' }}>Planner</strong>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                {data.label}
            </div>
            {data.goal && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', maxHeight: 40, overflow: 'hidden' }}>
                    "{data.goal}"
                </div>
            )}
            <Handle
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable}
                style={{ background: '#555' }}
            />
        </div>
    );
});
