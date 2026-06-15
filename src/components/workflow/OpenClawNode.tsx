import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

export const OpenClawNode = memo(({ data, isConnectable }: NodeProps) => {
    const [message, setMessage] = useState(data.message || 'Ask OpenClaw to...');
    const [thinkingDepth, setThinkingDepth] = useState(data.thinkingDepth || 'medium');

    const handleMessageChange = (val: string) => {
        setMessage(val);
        data.message = val; // Direct mutation persists in ReactFlow node state
    };

    const handleDepthChange = (val: 'low' | 'medium' | 'high') => {
        setThinkingDepth(val);
        data.thinkingDepth = val; // Direct mutation persists in ReactFlow node state
    };

    return (
        <div style={{
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--bg-secondary)',
            border: '1.5px solid #ff5a36', // Premium Coral Red Border
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
                style={{ background: '#ff5a36', width: 8, height: 8 }}
            />
            
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-primary)' }}>OC</span>
                    <strong style={{ fontSize: 11, letterSpacing: '0.05em', color: '#ff5a36', textTransform: 'uppercase' }}>OpenClaw Step</strong>
                </div>
                <span style={{
                    fontSize: 8,
                    background: 'rgba(255, 90, 54, 0.15)',
                    color: '#ff5a36',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontWeight: 600,
                    textTransform: 'uppercase'
                }}>{thinkingDepth} depth</span>
            </div>

            {/* Editable Label */}
            <div style={{ fontSize: 12, fontWeight: 600 }}>
                {data.label || 'OpenClaw Agent'}
            </div>

            {/* Interactive Instructions Textarea */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 500 }}>Task Prompts / Instructions</label>
                <textarea
                    value={message}
                    onChange={e => handleMessageChange(e.target.value)}
                    rows={2}
                    className="nodrag" // Prevents dragging node when selecting/typing inside textarea!
                    style={{
                        width: '100%',
                        padding: '4px 6px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        fontFamily: 'inherit',
                        resize: 'none',
                        outline: 'none',
                        boxSizing: 'border-box'
                    }}
                    placeholder="Task details..."
                />
            </div>

            {/* Interactive Thinking Depth Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 500 }}>Reasoning Depth</label>
                <div style={{ display: 'flex', gap: 4 }} className="nodrag">
                    {(['low', 'medium', 'high'] as const).map(depth => (
                        <button
                            key={depth}
                            onClick={() => handleDepthChange(depth)}
                            style={{
                                flex: 1,
                                padding: '3px 0',
                                border: '1px solid var(--border-subtle)',
                                background: thinkingDepth === depth ? '#ff5a36' : 'transparent',
                                color: thinkingDepth === depth ? '#fff' : 'var(--text-secondary)',
                                fontSize: '9px',
                                textTransform: 'capitalize',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                fontWeight: 600,
                                transition: 'all 0.15s ease'
                            }}
                        >
                            {depth}
                        </button>
                    ))}
                </div>
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable}
                style={{ background: '#ff5a36', width: 8, height: 8 }}
            />
        </div>
    );
});
