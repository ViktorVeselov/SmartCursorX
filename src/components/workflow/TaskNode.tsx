import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

export const TaskNode = memo(({ data, isConnectable }: NodeProps) => {
    return (
        <div style={{
            padding: '10px',
            borderRadius: '8px',
            background: 'var(--bg-secondary)',
            border: '1px solid #3b82f6', // Blue
            color: 'var(--text-primary)',
            minWidth: '160px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>
            <Handle
                type="target"
                position={Position.Top}
                isConnectable={isConnectable}
                style={{ background: '#555' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                <span className="codicon codicon-tasklist" style={{ marginRight: 8, color: '#3b82f6' }} />
                <strong style={{ fontSize: 12, color: '#3b82f6' }}>Task</strong>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>
                {data.label}
            </div>
            {data.description && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, maxHeight: 40, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {data.description}
                </div>
            )}
            {data.assignee && (
                <div style={{ fontSize: 10, color: 'var(--accent-primary)', marginTop: 4, display: 'flex', alignItems: 'center' }}>
                    <span className="codicon codicon-person" style={{ fontSize: 10, marginRight: 4 }} />
                    {data.assignee}
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
