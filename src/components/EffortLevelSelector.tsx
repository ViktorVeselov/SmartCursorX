import { useState } from 'react';

export interface EffortLevelSelectorProps {
    effortLevel: 'default' | 'low' | 'medium' | 'high';
    onChange: (level: 'default' | 'low' | 'medium' | 'high') => void;
}

export const EffortLevelSelector = ({ effortLevel, onChange }: EffortLevelSelectorProps) => {
    const [showEffortMenu, setShowEffortMenu] = useState(false);

    return (
        <div data-effort-menu style={{ position: 'relative' }}>
            <button
                onClick={() => setShowEffortMenu(!showEffortMenu)}
                style={{
                    padding: '4px 8px',
                    fontSize: 10,
                    fontWeight: 600,
                    background: effortLevel !== 'default' ? 'rgba(167, 139, 250, 0.2)' : 'transparent',
                    border: effortLevel !== 'default' ? '1px solid rgba(167, 139, 250, 0.4)' : '1px solid var(--border-subtle)',
                    borderRadius: 4,
                    color: effortLevel !== 'default' ? '#a78bfa' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                }}
            >
                {effortLevel === 'default' ? 'Default' : effortLevel.charAt(0).toUpperCase() + effortLevel.slice(1)}
                <span style={{ fontSize: 8, opacity: 0.7 }}>▼</span>
            </button>
            {showEffortMenu && (
                <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: 4,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: 4,
                    zIndex: 100,
                    minWidth: 100,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                }}>
                    {(['default', 'low', 'medium', 'high'] as const).map((level) => (
                        <button
                            key={level}
                            onClick={() => {
                                onChange(level);
                                setShowEffortMenu(false);
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                padding: '6px 10px',
                                fontSize: 12,
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 4,
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                textAlign: 'left',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <span>{level === 'default' ? 'Default' : level.charAt(0).toUpperCase() + level.slice(1)}</span>
                            {effortLevel === level && <span style={{ color: '#a78bfa', fontSize: 11 }}>selected</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
