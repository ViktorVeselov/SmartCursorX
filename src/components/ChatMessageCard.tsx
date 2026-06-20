import { useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ExecutionSteps } from './ExecutionSteps';
import { getNumericTaskId } from '../utils/taskId';
import { parsePlanActionMessage, parseAssistantResponse } from '../helpers/chatParsing';
import { ActivitySteps } from './ChatActivitySteps';
import type { ActivityTimelineItem } from '../helpers/chatParsing';

export interface ChatMessage {
    id?: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    isPlanMode?: boolean;
    isStreaming?: boolean;
    isAgentExecution?: boolean;
    filesRead?: string[];
    planSteps?: unknown[];
    activities?: ActivityTimelineItem[];
}

// eslint-disable-next-line complexity
export function ChatMessageCard({
    msg,
    streamElapsed,
    currentlyReadingFiles,
    onApplyCode,
    onRollback,
    activeConversationId,
    onOpenPlan
}: {
    msg: ChatMessage;
    streamElapsed: number;
    currentlyReadingFiles: { path: string; timestamp: number }[];
    onApplyCode?: (code: string) => void;
    onRollback: (messageId: number) => void;
    activeConversationId: string | null;
    onOpenPlan?: (taskId: number, taskTitle: string) => void;
}) {
    const [isHovered, setIsHovered] = useState(false);
    const [showCopied, setShowCopied] = useState(false);
    const planAction = parsePlanActionMessage(msg.content);
    const planTaskId = planAction?.kind === 'success'
        ? (planAction.taskId || (activeConversationId ? getNumericTaskId(activeConversationId) : undefined))
        : undefined;

    const handleCopy = () => {
        const { cleanContent } = parseAssistantResponse(msg.content, activeConversationId || undefined, msg.isPlanMode, msg.isStreaming);
        navigator.clipboard.writeText(cleanContent);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
    };

    const isUser = msg.role === 'user';
    const isSystem = msg.role === 'system';

    return (
        <div 
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ 
                alignSelf: isUser ? 'flex-end' : (isSystem ? 'center' : 'flex-start'), 
                maxWidth: isUser ? '85%' : (isSystem ? '95%' : '100%'),
                width: isUser ? 'auto' : '100%',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* Hover Actions Toolbar */}
            {isHovered && msg.id && (
                <div style={{
                    position: 'absolute',
                    bottom: '-12px',
                    right: isUser ? 'auto' : '8px',
                    left: isUser ? '8px' : 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '4px',
                    padding: '2px 4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    zIndex: 10
                }}>
                    <button
                        onClick={handleCopy}
                        title={showCopied ? "Copied!" : "Copy Message"}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: showCopied ? '#34d399' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '2px'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseOut={e => e.currentTarget.style.background = 'none'}
                    >
                        <span className={`codicon ${showCopied ? 'codicon-check' : 'codicon-copy'}`} style={{ fontSize: '11px' }} />
                    </button>
                    <button
                        onClick={() => onRollback(msg.id!)}
                        title="Reset conversation from this point"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '2px'
                        }}
                        onMouseOver={e => {
                            e.currentTarget.style.background = 'rgba(244, 63, 94, 0.15)';
                            e.currentTarget.style.color = '#f43f5e';
                        }}
                        onMouseOut={e => {
                            e.currentTarget.style.background = 'none';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                        }}
                    >
                        <span className="codicon codicon-discard" style={{ fontSize: '11.5px' }} />
                    </button>
                </div>
            )}

            <div style={{
                background: isUser ? 'var(--accent-primary)' : 'transparent',
                color: isUser ? 'white' : 'var(--text-primary)',
                padding: isUser ? '8px 12px' : (isSystem ? '0px' : '8px 0'),
                borderRadius: isUser ? 'var(--radius-md)' : '0px',
                fontSize: 'var(--font-base)',
                minWidth: isUser ? '80px' : '100%',
                border: 'none',
                boxShadow: 'none'
            }}>
                {isUser && !planAction ? (
                    /^[🔧⚙✅❌]/u.test(msg.content) || msg.content.includes('**Plan Modification Request**')
                        ? <MarkdownRenderer content={msg.content} onApplyCode={onApplyCode} />
                        : <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                ) : isSystem ? (
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        padding: '6px 12px',
                        borderRadius: '16px',
                        fontSize: '11px',
                        color: 'rgba(255, 255, 255, 0.65)',
                        margin: '4px auto',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        fontFamily: 'JetBrains Mono, SFMono-Regular, Consolas, monospace'
                    }}>
                        <span>{msg.content}</span>
                    </div>
                ) : planAction ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        minWidth: '320px',
                        maxWidth: '100%',
                        padding: '6px 2px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                                className={`codicon ${
                                    planAction.kind === 'request'
                                        ? 'codicon-tools'
                                        : planAction.kind === 'success'
                                            ? 'codicon-check'
                                            : 'codicon-error'
                                }`}
                                style={{
                                    color: planAction.kind === 'failure' ? '#f87171' : planAction.kind === 'success' ? '#34d399' : '#f59e0b',
                                    fontSize: '14px'
                                }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>
                                    {planAction.kind === 'request'
                                        ? 'Plan update requested'
                                        : planAction.kind === 'success'
                                            ? `Plan updated in ${planAction.duration}`
                                            : `Plan update failed in ${planAction.duration}`}
                                </span>
                                <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.48)' }}>
                                    {planAction.kind === 'request'
                                        ? 'Background planning is running.'
                                        : planAction.kind === 'success'
                                            ? 'The interactive plan has been refreshed.'
                                            : 'The planner could not apply the requested changes.'}
                                </span>
                            </div>
                        </div>

                        <div style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            color: 'rgba(255,255,255,0.82)',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.55,
                            fontSize: '12.5px'
                        }}>
                            {planAction.kind === 'request' && planAction.instructions}
                            {planAction.kind === 'success' && planAction.description}
                            {planAction.kind === 'failure' && planAction.errorMessage}
                        </div>

                        {planAction.kind === 'success' && planTaskId && onOpenPlan && (
                            <button
                                onClick={() => onOpenPlan(planTaskId, `Task #${planTaskId}`)}
                                style={{
                                    alignSelf: 'flex-start',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '7px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(99, 102, 241, 0.35)',
                                    background: 'rgba(99, 102, 241, 0.12)',
                                    color: '#c7d2fe',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 600
                                }}
                            >
                                <span className="codicon codicon-link" style={{ fontSize: '11px' }} />
                                Open Interactive Plan
                            </button>
                        )}
                    </div>
                ) : msg.isAgentExecution ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '6px 4px',
                        minWidth: '320px',
                        maxWidth: '100%'
                    }}>
                        <style>{`
                            @keyframes cursor-blink {
                                0%, 49% { opacity: 1; }
                                50%, 100% { opacity: 0; }
                            }
                        `}</style>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span className="codicon codicon-play" style={{ color: '#34d399', fontSize: '14px' }} />
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#34d399', fontFamily: 'JetBrains Mono, monospace' }}>
                                System Agent Executing...
                            </span>
                        </div>
                        <div style={{
                            background: '#0d1117',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '11px',
                            color: 'rgba(255, 255, 255, 0.85)',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.5',
                            textAlign: 'left'
                        }}>
                            {msg.content}
                            <span style={{
                                display: 'inline-block',
                                width: '6px',
                                height: '12px',
                                background: '#34d399',
                                marginLeft: '4px',
                                verticalAlign: 'middle',
                                animation: 'cursor-blink 1s infinite'
                            }} />
                        </div>
                    </div>
                ) : (
                    (() => {
                        const { activity, cleanContent } = parseAssistantResponse(msg.content, activeConversationId || undefined, msg.isPlanMode, msg.isStreaming);
                        let finalActivity = activity;
                        if (finalActivity) {
                            if (!finalActivity.activities && msg.activities) {
                                finalActivity.activities = msg.activities;
                            }
                        } else if (msg.isStreaming || (msg.activities && msg.activities.length > 0)) {
                            finalActivity = {
                                filesRead: msg.filesRead || [],
                                filesEdited: [],
                                thoughts: '',
                                activities: msg.activities || []
                            };
                        }
                        return (
                            <>
                                <style>{`
                                    @keyframes cursor-blink {
                                        0%, 49% { opacity: 1; }
                                        50%, 100% { opacity: 0; }
                                    }
                                `}</style>
                                {finalActivity && (
                                    <ActivitySteps 
                                        activity={finalActivity} 
                                        isStreaming={msg.isStreaming}
                                        msgFilesRead={msg.filesRead} 
                                        currentlyReadingFiles={currentlyReadingFiles}
                                        streamElapsed={streamElapsed}
                                    />
                                )}
                                {activeConversationId && (
                                    <ExecutionSteps taskId={getNumericTaskId(activeConversationId)} />
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                                    <MarkdownRenderer content={cleanContent} onApplyCode={onApplyCode} />
                                    {msg.isStreaming && (
                                        <span style={{
                                            display: 'inline-block',
                                            width: '6px',
                                            height: '12px',
                                            background: '#818cf8',
                                            marginLeft: '4px',
                                            verticalAlign: 'middle',
                                            animation: 'cursor-blink 1s infinite'
                                        }} />
                                    )}
                                </div>
                            </>
                        );
                    })()
                )}
            </div>
        </div>
    );
}

