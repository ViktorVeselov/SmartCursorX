import { useRef, useEffect, useState } from 'react';
import { ChatPlusMenu } from './ChatPlusMenu';
import { ModelDropdown } from './ModelDropdown';
import { DollarIcon } from './DollarIcon';
import { EffortLevelSelector } from './EffortLevelSelector';

export interface ChatInputAreaProps {
    input: string;
    setInput: React.Dispatch<React.SetStateAction<string>>;
    isLoading: boolean;
    isPlanModifying: boolean;
    isPlanModeActive: boolean;
    attachedFile: { name: string; path: string; content: string } | null;
    activeModel: string;
    activeProvider: string;
    customModels: Record<string, unknown>[];
    availableModels: string[];
    showModelDropdown: boolean;
    setShowModelDropdown: React.Dispatch<React.SetStateAction<boolean>>;
    inlineModelInput: string;
    setInlineModelInput: React.Dispatch<React.SetStateAction<string>>;
    onSelectModel: (modelName: string, providerId: string) => void;
    setCustomModels: React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>;
    setAvailableModels: React.Dispatch<React.SetStateAction<string[]>>;
    executionMode: 'fast' | 'think';
    setExecutionMode: React.Dispatch<React.SetStateAction<'fast' | 'think'>>;
    effortLevel: 'default' | 'low' | 'medium' | 'high';
    setEffortLevel: React.Dispatch<React.SetStateAction<'default' | 'low' | 'medium' | 'high'>>;
    showPlusMenu: boolean;
    togglePlusMenu: () => void;
    dbAgents: { id: number; name: string; system_prompt: string }[];
    flows: { id: number; name: string; description: string; steps: unknown; agent_id: number }[];
    showAgentSubmenu: boolean;
    setShowAgentSubmenu: React.Dispatch<React.SetStateAction<boolean>>;
    showWorkflowSubmenu: boolean;
    setShowWorkflowSubmenu: React.Dispatch<React.SetStateAction<boolean>>;
    setActiveAgent: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>;
    setActiveWorkflow: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>;
    setIsPlanModeActive: React.Dispatch<React.SetStateAction<boolean>>;
    handleFileUpload: () => Promise<void>;
    handleSend: (queuedMsg?: Record<string, unknown>) => void;
    handleAbort: () => void;
    currentModelCanThink: boolean;
    tokenDetails: {
        historyTokens: number;
        draftTokens: number;
        fileTokens: number;
        totalTokens: number;
        totalCost: number;
        totalInputTokens: number;
        totalOutputTokens: number;
        breakdown?: {
            inputTokens: number;
            outputTokens: number;
            cost: number;
            duration?: string;
        }[];
    };
    modelLimit: number;
}

// eslint-disable-next-line complexity
export function ChatInputArea(props: ChatInputAreaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [showDetails, setShowDetails] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        const resize = () => {
            ta.style.height = '0';
            ta.style.height = Math.min(ta.scrollHeight, 250) + 'px';
        };
        resize();
    }, [props.input]);

    const totalTokens = props.tokenDetails.totalTokens;
    const effectiveLimit = Math.min(props.modelLimit, 200000);
    const isOverLimit = totalTokens > effectiveLimit;
    const isNearLimit = totalTokens > effectiveLimit * 0.8 && totalTokens <= effectiveLimit;

    const percentage = (totalTokens / props.modelLimit) * 100;
    const strokeColor = isOverLimit ? '#ef4444' : isNearLimit ? '#f59e0b' : 'var(--accent-primary)';
    const circumference = 50.265;
    const strokeOffset = circumference - (Math.min(percentage, 100) / 100) * circumference;

    return (
        <div className="chat-input-area" style={{ padding: '12px 16px 16px 16px', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

            <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '16px',
                padding: '12px 14px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
                onFocusCapture={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(99, 102, 241, 0.15)';
                }}
                onBlurCapture={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.15)';
                }}
            >
                <textarea
                    ref={textareaRef}
                    value={props.input}
                    onChange={(e) => props.setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            props.handleSend();
                            (e.target as HTMLTextAreaElement).style.height = '0';
                        }
                    }}
                    placeholder={props.isLoading ? 'Type a message to queue...' : (props.isPlanModeActive ? 'Describe the feature to plan...' : 'Ask anything... (type / for flows)')}
                    style={{
                        minHeight: 48,
                        maxHeight: '250px',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        width: '100%',
                        padding: 0,
                        margin: '0 0 10px 0',
                        lineHeight: '1.5',
                        flex: 'none'
                    }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ChatPlusMenu
                            showPlusMenu={props.showPlusMenu}
                            onTogglePlusMenu={props.togglePlusMenu}
                            isLoading={props.isLoading}
                            dbAgents={props.dbAgents}
                            flows={props.flows}
                            showAgentSubmenu={props.showAgentSubmenu}
                            onSetShowAgentSubmenu={props.setShowAgentSubmenu}
                            showWorkflowSubmenu={props.showWorkflowSubmenu}
                            onSetShowWorkflowSubmenu={props.setShowWorkflowSubmenu}
                            isPlanModeActive={props.isPlanModeActive}
                            onSetIsPlanModeActive={props.setIsPlanModeActive}
                            onSetActiveAgent={props.setActiveAgent}
                            onSetActiveWorkflow={props.setActiveWorkflow}
                            onClose={() => { props.togglePlusMenu(); }}
                            onAttachFile={props.handleFileUpload}
                        />

                        <ModelDropdown
                            showModelDropdown={props.showModelDropdown}
                            onSetShowModelDropdown={props.setShowModelDropdown}
                            inlineModelInput={props.inlineModelInput}
                            onSetInlineModelInput={props.setInlineModelInput}
                            availableModels={props.availableModels}
                            activeModel={props.activeModel}
                            onSelectModel={props.onSelectModel}
                            customModels={props.customModels}
                            onSetCustomModels={props.setCustomModels}
                            onSetAvailableModels={props.setAvailableModels}
                            activeProvider={props.activeProvider}
                            executionMode={props.executionMode}
                            onSetExecutionMode={props.setExecutionMode}
                        />

                        <div
                            onClick={async () => {
                                if (!props.currentModelCanThink) return;
                                const next = props.executionMode === 'think' ? 'fast' : 'think';
                                props.setExecutionMode(next);
                                if (props.activeModel) {
                                    const customMatch = props.customModels.find((cm: Record<string, unknown>) => cm.model_name === props.activeModel && cm.provider_id === props.activeProvider);
                                    if (customMatch) {
                                        await window.ipcRenderer.invoke('ai:toggle-model-thinking', props.activeProvider, props.activeModel, next === 'think');
                                    } else {
                                        await window.ipcRenderer.invoke('ai:add-custom-model', props.activeProvider, props.activeModel, next === 'think');
                                    }
                                    const dbModels = await window.ipcRenderer.invoke('ai:get-custom-models');
                                    props.setCustomModels(dbModels || []);
                                }
                            }}
                            title={props.currentModelCanThink ? "Toggle AI Thinking / Reasoning Mode" : "This model does not support thinking mode"}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                cursor: props.currentModelCanThink ? 'pointer' : 'default',
                                userSelect: 'none',
                                padding: '4px 6px',
                                borderRadius: '8px',
                                transition: 'background 0.2s ease',
                                opacity: props.currentModelCanThink ? 1 : 0.35,
                            }}
                            onMouseOver={(e) => { if (props.currentModelCanThink) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <DollarIcon active={props.executionMode === 'think'} />
                            <div style={{
                                width: 26,
                                height: 14,
                                borderRadius: 7,
                                background: props.executionMode === 'think' ? '#a78bfa' : 'rgba(255,255,255,0.15)',
                                position: 'relative',
                                transition: 'background 0.25s ease',
                                boxShadow: props.executionMode === 'think' ? '0 0 8px rgba(167, 139, 250, 0.4)' : 'none'
                            }}>
                                <div style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    background: '#ffffff',
                                    position: 'absolute',
                                    top: 2,
                                    left: props.executionMode === 'think' ? 14 : 2,
                                    transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                                }} />
                            </div>
                        </div>

                        <EffortLevelSelector
                            effortLevel={props.effortLevel}
                            onChange={(level) => props.setEffortLevel(level)}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Token / Cost Circular Indicator */}
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <div
                                onClick={() => setShowDetails(!showDetails)}
                                title="Click to view context and cost details"
                                style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    background: showDetails ? 'var(--bg-active)' : 'transparent',
                                    transition: 'background-color 0.2s ease',
                                    position: 'relative'
                                }}
                                onMouseOver={(e) => { if (!showDetails) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                                onMouseOut={(e) => { if (!showDetails) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <svg width="18" height="18" viewBox="0 0 20 20">
                                    <circle
                                        cx="10"
                                        cy="10"
                                        r="8"
                                        fill="none"
                                        stroke="var(--border-subtle)"
                                        strokeWidth="1.5"
                                    />
                                    <circle
                                        cx="10"
                                        cy="10"
                                        r="8"
                                        fill="none"
                                        stroke={strokeColor}
                                        strokeWidth="2"
                                        strokeDasharray="50.265"
                                        strokeDashoffset={strokeOffset}
                                        transform="rotate(-90 10 10)"
                                        style={{
                                            transition: 'stroke-dashoffset 0.3s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease'
                                        }}
                                    />
                                </svg>
                            </div>

                            {/* Details Popover Card */}
                            {showDetails && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '30px',
                                    right: '0',
                                    width: isExpanded ? '380px' : '260px',
                                    background: 'var(--bg-secondary)',
                                    backdropFilter: 'blur(12px)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                                    zIndex: 1000,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    animation: 'fadeInUp 0.15s ease-out',
                                    maxHeight: isExpanded ? '400px' : '300px',
                                    transition: 'width 0.2s, max-height 0.2s'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', marginBottom: '2px' }}>
                                        <span style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-primary)' }}>Chat Token Details</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                                                style={{
                                                    background: 'rgba(255,255,255,0.05)',
                                                    border: '1px solid var(--border-subtle)',
                                                    color: 'var(--text-secondary)',
                                                    cursor: 'pointer',
                                                    fontSize: '9px',
                                                    padding: '1px 5px',
                                                    borderRadius: '3px',
                                                    outline: 'none',
                                                    transition: 'var(--transition-smooth)'
                                                }}
                                                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                            >
                                                {isExpanded ? 'Collapse' : 'Expand'}
                                            </button>
                                            <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Limit: {props.modelLimit.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>History:</span>
                                            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{props.tokenDetails.historyTokens.toLocaleString()} t</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>Draft Message:</span>
                                            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{props.tokenDetails.draftTokens.toLocaleString()} t</span>
                                        </div>
                                        {props.tokenDetails.fileTokens > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>File Attachment:</span>
                                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{props.tokenDetails.fileTokens.toLocaleString()} t</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-subtle)', paddingTop: '4px', marginTop: '2px', fontWeight: 600 }}>
                                            <span style={{ color: isOverLimit ? '#ef4444' : isNearLimit ? '#f59e0b' : 'var(--text-primary)' }}>Total Context:</span>
                                            <span style={{ color: isOverLimit ? '#ef4444' : isNearLimit ? '#f59e0b' : 'var(--text-primary)' }}>
                                                {totalTokens.toLocaleString()} t ({Math.round(Math.min(percentage, 100))}%)
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-subtle)', paddingTop: '4px', marginTop: '2px' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>Total Sent (Input):</span>
                                            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                                {props.tokenDetails.totalInputTokens.toLocaleString()} t
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>Total Received (Output):</span>
                                            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                                {props.tokenDetails.totalOutputTokens.toLocaleString()} t
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px', marginTop: '2px', fontSize: '11px' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Accumulated Cost:</span>
                                        <span style={{ fontWeight: 600, color: '#10b981' }}>
                                            ${props.tokenDetails.totalCost === 0 ? '0.00' : props.tokenDetails.totalCost.toFixed(4)}
                                        </span>
                                    </div>

                                    {isExpanded && props.tokenDetails.breakdown && props.tokenDetails.breakdown.length > 0 && (
                                        <div style={{
                                            borderTop: '1px solid var(--border-subtle)',
                                            paddingTop: '8px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px',
                                            maxHeight: '140px',
                                            overflowY: 'auto'
                                        }}>
                                            <div style={{ fontWeight: 600, fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                Turn Breakdown ({props.tokenDetails.breakdown.length})
                                            </div>
                                            <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse', textAlign: 'left' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                                                        <th style={{ padding: '3px 0' }}>Turn</th>
                                                        <th style={{ padding: '3px 0', textAlign: 'right' }}>Input</th>
                                                        <th style={{ padding: '3px 0', textAlign: 'right' }}>Output</th>
                                                        <th style={{ padding: '3px 0', textAlign: 'right' }}>Cost</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {props.tokenDetails.breakdown.map((item, index) => (
                                                        <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'var(--text-secondary)' }}>
                                                            <td style={{ padding: '4px 0', color: 'var(--text-primary)' }}>
                                                                #{index + 1} {item.duration ? `(${item.duration}s)` : ''}
                                                            </td>
                                                            <td style={{ padding: '4px 0', textAlign: 'right' }}>{item.inputTokens.toLocaleString()}</td>
                                                            <td style={{ padding: '4px 0', textAlign: 'right' }}>{item.outputTokens.toLocaleString()}</td>
                                                            <td style={{ padding: '4px 0', textAlign: 'right', color: '#10b981' }}>
                                                                ${item.cost === 0 ? '0.00' : item.cost.toFixed(4)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {isOverLimit && (
                                        <div style={{ color: '#ef4444', fontSize: '10px', marginTop: '4px', background: 'rgba(239, 68, 68, 0.1)', padding: '6px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)', lineHeight: '1.4' }}>
                                            ⚠️ <strong>High Pollution:</strong> Reasoning quality may degrade. Consider using <strong>Fork Chat</strong> or <strong>Fork Sub-Thread</strong>.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            title="Voice Input"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                                padding: '4px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'var(--transition-smooth)'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                        >
                            <span className="codicon codicon-mic" style={{ fontSize: 14 }} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {(props.isLoading || props.isPlanModifying) && (
                                <button
                                    onClick={props.handleAbort}
                                    style={{
                                        background: '#ef4444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: 28,
                                        height: 28,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'var(--transition-smooth)',
                                        boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)'
                                    }}
                                    title="Stop Generation"
                                >
                                    <span className="codicon codicon-debug-stop" style={{ fontSize: 11 }} />
                                </button>
                            )}

                            <button
                                onClick={() => props.handleSend()}
                                disabled={(!props.input.trim() && !props.attachedFile) || !props.activeModel}
                                style={{
                                    background: (props.input.trim() && props.activeModel) ? (props.isLoading ? '#a78bfa' : '#0070f3') : 'var(--bg-hover)',
                                    color: (props.input.trim() && props.activeModel) ? 'white' : 'var(--text-secondary)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: 28,
                                    height: 28,
                                    cursor: (props.input.trim() && props.activeModel) ? 'pointer' : 'default',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'var(--transition-smooth)',
                                    transform: (props.input.trim() && props.activeModel) ? 'scale(1.05)' : 'scale(1)',
                                    boxShadow: (props.input.trim() && props.activeModel) ? (props.isLoading ? '0 0 8px rgba(167, 139, 250, 0.4)' : '0 0 8px rgba(0, 112, 243, 0.4)') : 'none'
                                }}
                                title={props.isLoading ? "Queue Message" : "Send message"}
                            >
                                <span className={`codicon ${props.isLoading ? 'codicon-history' : 'codicon-arrow-up'}`} style={{ fontSize: 13, fontWeight: 'bold' }} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
