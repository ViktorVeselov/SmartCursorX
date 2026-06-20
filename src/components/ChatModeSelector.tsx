import { useState } from 'react';

export type ChatMode = 'write' | 'ask' | 'plan';

export interface ChatModeSelectorProps {
    chatMode: ChatMode;
    onChatModeChange: (mode: ChatMode) => void;
}

export const ChatModeSelector = ({
    chatMode,
    onChatModeChange
}: ChatModeSelectorProps) => {
    const [isOpen, setIsOpen] = useState(false);

    const modes: { value: ChatMode; label: string; icon: string; desc: string; color: string }[] = [
        {
            value: 'write',
            label: 'Write',
            icon: 'codicon-edit',
            desc: 'Complete tool access (writes & edits files directly)',
            color: 'var(--text-primary)'
        },
        {
            value: 'ask',
            label: 'Ask',
            icon: 'codicon-question',
            desc: 'Read-only context Q&A (only search/read tools enabled)',
            color: '#06b6d4' // Cyan
        },
        {
            value: 'plan',
            label: 'Plan',
            icon: 'codicon-checklist',
            desc: 'Architectural mode (builds structured execution plan JSON)',
            color: '#a78bfa' // Purple
        }
    ];

    const currentMode = modes.find(m => m.value === chatMode) || modes[0];

    return (
        <div style={{ position: 'relative' }}>
            <div style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '8px',
                background: 'var(--bg-hover)',
                transition: 'var(--transition-smooth)',
                userSelect: 'none'
            }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-active)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onClick={() => setIsOpen(!isOpen)}>
                <span style={{ fontWeight: 600, color: currentMode.color, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className={`codicon ${currentMode.icon}`} style={{ fontSize: 11 }} />
                    <span>{currentMode.label}</span>
                </span>
                <span className="codicon codicon-chevron-down" style={{ fontSize: 10, opacity: 0.8 }} />
            </div>
            {isOpen && (
                <>
                    {/* Invisible backdrop to close dropdown on click outside */}
                    <div 
                        onClick={() => setIsOpen(false)} 
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 1099,
                            background: 'transparent'
                        }}
                    />
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
                        minWidth: 220,
                        display: 'flex',
                        flexDirection: 'column',
                        marginBottom: 6,
                        padding: 4
                    }}>
                        {modes.map(mode => {
                            const isSelected = mode.value === chatMode;
                            return (
                                <div
                                    key={mode.value}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        padding: '6px 8px',
                                        borderRadius: 'var(--radius-sm)',
                                        background: isSelected ? 'var(--bg-active)' : 'transparent',
                                        cursor: 'pointer',
                                        transition: 'var(--transition-smooth)'
                                    }}
                                    onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                    onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                    onClick={() => {
                                        onChatModeChange(mode.value);
                                        setIsOpen(false);
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span className={`codicon ${mode.icon}`} style={{ fontSize: 12, color: mode.color }} />
                                        <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>{mode.label}</span>
                                    </div>
                                    <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: 2, paddingLeft: 18 }}>
                                        {mode.desc}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};
