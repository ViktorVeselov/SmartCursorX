import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

export const ToolNode = memo(({ data, isConnectable }: NodeProps) => {
    return (
        <div style={{
            padding: '10px',
            borderRadius: '8px',
            background: 'var(--bg-secondary)',
            border: '1px solid #dba725',
            color: 'var(--text-primary)',
            minWidth: '150px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}>
            <Handle
                type="target"
                position={Position.Top}
                isConnectable={isConnectable}
                style={{ background: '#555' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                <span className="codicon codicon-tools" style={{ marginRight: 8, color: '#dba725' }} />
                <strong style={{ fontSize: 12 }}>Tool</strong>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>
                {data.label}
            </div>
            {data.description && (
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {data.description}
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
