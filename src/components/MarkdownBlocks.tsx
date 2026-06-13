import { useState } from 'react';
import { renderCodeWithPrism } from '../helpers/markdownHighlight';

function ThinkingBlock({ content }: { content: string }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div style={{
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            marginBottom: '4px',
            border: '1px solid var(--border-subtle)',
            borderLeft: '3px solid #a78bfa',
            boxSizing: 'border-box'
        }}>
            <div 
                onClick={() => setExpanded(!expanded)}
                style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontSize: '11px',
                    color: '#a78bfa',
                    fontWeight: 600
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="codicon codicon-beaker" style={{ fontSize: 12 }} />
                    <span>Thinking Process...</span>
                </div>
                <span className={`codicon ${expanded ? 'codicon-chevron-up' : 'codicon-chevron-down'}`} style={{ fontSize: 10 }} />
            </div>
            {expanded && (
                <div style={{ 
                    marginTop: '8px', 
                    fontSize: '11px', 
                    color: 'var(--text-secondary)', 
                    whiteSpace: 'pre-wrap', 
                    lineHeight: '1.5',
                    fontStyle: 'italic',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    paddingTop: '6px'
                }}>
                    {content}
                </div>
            )}
        </div>
    );
}

function CodeBlock({ language, code, comments, hoveredCommentId, onHoverComment, onApplyCode }: { language: string; code: string; comments?: { id: string; body: string; context: string }[]; hoveredCommentId?: string | null; onHoverComment?: (id: string | null) => void; onApplyCode?: (appliedCode: string) => void }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    return (
        <div style={{
            background: '#1e1e1e',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden',
            margin: '8px 0',
            fontFamily: 'Consolas, Monaco, "Andale Mono", monospace'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 12px',
                background: 'rgba(255,255,255,0.05)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                fontSize: '11px',
                color: 'var(--text-secondary)'
            }}>
                <span style={{ textTransform: 'lowercase' }}>{language || 'code'}</span>
                <div style={{ display: 'flex', gap: 12 }}>
                    {onApplyCode && (
                        <button
                            onClick={() => onApplyCode(code)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--accent-primary)',
                                cursor: 'pointer',
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                            }}
                            title="Apply to Editor"
                        >
                            <span className="codicon codicon-cloud-upload" style={{ fontSize: 12 }} />
                            Apply
                        </button>
                    )}
                    <button
                        onClick={handleCopy}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: copied ? '#4ade80' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                        }}
                    >
                        <span className={`codicon ${copied ? 'codicon-check' : 'codicon-copy'}`} style={{ fontSize: 12 }} />
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                </div>
            </div>
            <pre style={{
                margin: 0,
                padding: '12px',
                overflowX: 'auto',
                fontSize: '12px',
                lineHeight: '1.5',
                color: '#d4d4d4',
                whiteSpace: 'pre',
                tabSize: 2
            }}>
                <code>{renderCodeWithPrism(code, language, comments, hoveredCommentId, onHoverComment)}</code>
            </pre>
        </div>
    );
}

function renderInline(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
        const plain = text.substring(lastIndex, match.index);
        const matchText = match[1];

        if (plain) {
            parts.push(<span key={key++}>{plain}</span>);
        }

        if (matchText.startsWith('`')) {
            parts.push(
                <code key={key++} style={{
                    background: 'rgba(255,255,255,0.08)',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'Consolas, Monaco, monospace'
                }}>
                    {matchText.slice(1, -1)}
                </code>
            );
        } else if (matchText.startsWith('**')) {
            parts.push(<strong key={key++} style={{ fontWeight: 600 }}>{matchText.slice(2, -2)}</strong>);
        } else if (matchText.startsWith('*')) {
            parts.push(<em key={key++}>{matchText.slice(1, -1)}</em>);
        } else if (matchText.startsWith('[')) {
            const linkMatch = matchText.match(/\[([^\]]+)\]\(([^)]+)\)/);
            if (linkMatch) {
                const label = linkMatch[1];
                const url = linkMatch[2];
                const isLocalFile = url.startsWith('file://') || url.startsWith('plan://') || url.startsWith('/') || url.includes('\\') || url.startsWith('.');

                const handleClick = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (isLocalFile) {
                        e.preventDefault();
                        let filePath = url;
                        if (filePath.startsWith('file:///')) {
                            filePath = filePath.substring(8);
                        } else if (filePath.startsWith('file://')) {
                            filePath = filePath.substring(7);
                        }
                        try {
                            filePath = decodeURIComponent(filePath);
                        } catch (err) {
                            console.error('Failed to decode path:', err);
                        }
                        window.dispatchEvent(new CustomEvent('open-workspace-file', {
                            detail: { path: filePath }
                        }));
                    }
                };

                parts.push(
                    <a
                        key={key++}
                        href={url}
                        onClick={handleClick}
                        style={{
                            color: 'var(--accent-indigo, #818cf8)',
                            textDecoration: 'underline',
                            cursor: 'pointer'
                        }}
                        target={isLocalFile ? undefined : '_blank'}
                        rel={isLocalFile ? undefined : 'noopener noreferrer'}
                    >
                        {label}
                    </a>
                );
            }
        }

        lastIndex = regex.lastIndex;
    }

    const remaining = text.substring(lastIndex);
    if (remaining) {
        parts.push(<span key={key++}>{remaining}</span>);
    }

    return parts;
}

function TextBlock({ text, comments, hoveredCommentId, onHoverComment, onUpdateText }: { text: string; comments?: { id: string; body: string; context: string }[]; hoveredCommentId?: string | null; onHoverComment?: (id: string | null) => void; onUpdateText?: (newText: string) => void }) {
    // Process paragraphs, lists, headers, bold, inline code inside a text block
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    let inList = false;
    let listItems: React.ReactNode[] = [];

    const flushList = (key: string) => {
        if (listItems.length > 0) {
            elements.push(
                <ul key={key} style={{ margin: '4px 0 8px 20px', paddingLeft: 0, listStyleType: 'disc' }}>
                    {listItems}
                </ul>
            );
            listItems = [];
            inList = false;
        }
    };

    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const handleSaveLine = (idx: number) => {
        if (!onUpdateText) return;
        const newLines = [...lines];
        newLines[idx] = editingValue;
        onUpdateText(newLines.join('\n'));
        setEditingIndex(null);
    };

    const handleCopyLine = async (e: React.MouseEvent, lineText: string, idx: number) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(lineText);
            setCopiedIndex(idx);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch (err) {
            console.error('Failed to copy line:', err);
        }
    };

    const renderLineWithEdit = (element: React.ReactNode, originalLineText: string, idx: number, wrapperTag: 'div' | 'li' = 'div') => {
        if (editingIndex === idx) {
            const innerTextarea = (
                <textarea
                    ref={el => {
                        if (el) {
                            el.style.height = 'auto';
                            el.style.height = el.scrollHeight + 'px';
                        }
                    }}
                    value={editingValue}
                    onChange={e => {
                        setEditingValue(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onBlur={() => handleSaveLine(idx)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            const isHeader = originalLineText.trim().startsWith('#');
                            if (isHeader) {
                                e.preventDefault();
                                handleSaveLine(idx);
                            }
                            if (e.ctrlKey || e.metaKey) {
                                e.preventDefault();
                                handleSaveLine(idx);
                            }
                        } else if (e.key === 'Escape') {
                            setEditingIndex(null);
                        }
                    }}
                    style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: 'inherit',
                        fontSize: 'inherit',
                        fontWeight: 'inherit',
                        fontFamily: 'inherit',
                        lineHeight: 'inherit',
                        padding: 0,
                        margin: 0,
                        outline: 'none',
                        resize: 'none',
                        overflow: 'hidden'
                    }}
                    autoFocus
                />
            );
            if (wrapperTag === 'li') {
                return <li key={idx} style={{ listStyleType: 'none', width: '100%' }}>{innerTextarea}</li>;
            }
            return <div key={idx} style={{ width: '100%' }}>{innerTextarea}</div>;
        }

        const handleLineClick = (e: React.MouseEvent) => {
            if (!onUpdateText) return;
            if (editingIndex !== null) return;

            const selection = window.getSelection();
            if (selection && selection.toString().trim()) {
                return;
            }

            const target = e.target as HTMLElement;
            if (target.tagName === 'A' || target.closest('a') || target.tagName === 'BUTTON' || target.closest('button') || target.tagName === 'TEXTAREA') {
                return;
            }

            setEditingIndex(idx);
            setEditingValue(originalLineText);
        };

        const copyBtn = (
            <button
                className="line-copy-btn"
                onClick={(e) => handleCopyLine(e, originalLineText, idx)}
                title="Copy line"
                style={{
                    color: copiedIndex === idx ? '#4ade80' : undefined,
                    opacity: copiedIndex === idx ? 1 : undefined
                }}
            >
                <span className={`codicon ${copiedIndex === idx ? 'codicon-check' : 'codicon-copy'}`} style={{ fontSize: '12px' }} />
            </button>
        );

        if (wrapperTag === 'li') {
            return (
                <li 
                    key={idx} 
                    className="markdown-line-wrapper" 
                    onClick={handleLineClick}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: onUpdateText ? 'text' : 'inherit' }}
                >
                    <div style={{ flex: 1, minWidth: 0 }}>{element}</div>
                    {copyBtn}
                </li>
            );
        }

        return (
            <div 
                key={idx} 
                className="markdown-line-wrapper" 
                onClick={handleLineClick}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: onUpdateText ? 'text' : 'inherit' }}
            >
                <div style={{ flex: 1, minWidth: 0 }}>{element}</div>
                {copyBtn}
            </div>
        );
    };

    const getMatchedComment = (lineText: string) => {
        if (!comments || comments.length === 0) return null;
        // Clean line and context formatting for a robust comparison
        const cleanLine = lineText.replace(/[\]`*_~#[]()]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (!cleanLine) return null;
        return comments.find(c => {
            const cleanCtx = c.context.replace(/[\]`*_~#[]()]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
            return cleanCtx.length > 2 && cleanLine.includes(cleanCtx);
        }) || null;
    };

    // eslint-disable-next-line complexity
    lines.forEach((line, i) => {
        const trimmed = line.trim();
        const matched = getMatchedComment(line);
        const isHovered = matched && hoveredCommentId === matched.id;

        const commentProps = matched ? {
            id: `comment-target-${matched.id}`,
            onMouseEnter: () => onHoverComment?.(matched.id),
            onMouseLeave: () => onHoverComment?.(null)
        } : {};

        const getCommentStyle = (baseStyle: React.CSSProperties = {}): React.CSSProperties => {
            if (!matched) return baseStyle;
            return {
                ...baseStyle,
                background: isHovered ? 'rgba(129, 140, 248, 0.08)' : 'transparent',
                borderLeft: isHovered ? '3px solid #818cf8' : '3px solid transparent',
                paddingLeft: '8px',
                marginLeft: '-11px',
                borderRadius: '0 4px 4px 0',
                transition: 'all 0.15s ease'
            };
        };

        // 1. Headers
        if (trimmed.startsWith('#')) {
            flushList(`list-header-${i}`);
            const level = (trimmed.match(/^#+/) || ['#'])[0].length;
            const headingText = trimmed.replace(/^#+\s*/, '');
            const style: React.CSSProperties = {
                color: 'var(--text-primary)',
                fontWeight: 600,
                marginTop: '12px',
                marginBottom: '6px'
            };

            if (level === 1) {
                elements.push(renderLineWithEdit(<h1 {...commentProps} style={getCommentStyle({ ...style, fontSize: '1.4rem' })}>{renderInline(headingText)}</h1>, line, i));
            } else if (level === 2) {
                elements.push(renderLineWithEdit(<h2 {...commentProps} style={getCommentStyle({ ...style, fontSize: '1.2rem' })}>{renderInline(headingText)}</h2>, line, i));
            } else {
                elements.push(renderLineWithEdit(<h3 {...commentProps} style={getCommentStyle({ ...style, fontSize: '1.05rem' })}>{renderInline(headingText)}</h3>, line, i));
            }
            return;
        }

        // 2. Unordered lists
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            inList = true;
            const itemText = trimmed.substring(2);
            listItems.push(renderLineWithEdit(<span {...commentProps} style={getCommentStyle()}>{renderInline(itemText)}</span>, line, i, 'li'));
            return;
        }

        // 3. Blockquotes & Comments
        if (trimmed.startsWith('> ')) {
            flushList(`list-quote-${i}`);
            const innerText = trimmed.substring(2).trim();
            const isComment = innerText.startsWith('💬');
            
            let commentBody = innerText;
            let contextText = '';
            
            if (isComment) {
                const commentContent = innerText.substring(1).trim(); // strip 💬
                const onIndex = commentContent.indexOf('— *on: "');
                if (onIndex !== -1) {
                    commentBody = commentContent.substring(0, onIndex).trim();
                    const quoteStart = onIndex + 8;
                    const quoteEnd = commentContent.lastIndexOf('"*');
                    if (quoteEnd !== -1 && quoteEnd > quoteStart) {
                        contextText = commentContent.substring(quoteStart, quoteEnd);
                    } else {
                        contextText = commentContent.substring(quoteStart);
                        if (contextText.endsWith('"*')) contextText = contextText.slice(0, -2);
                    }
                } else {
                    commentBody = commentContent;
                }
            }

            elements.push(
                renderLineWithEdit(
                    <blockquote {...commentProps} style={getCommentStyle({
                        borderLeft: isComment ? '3px solid #818cf8' : '3px solid var(--accent-primary)',
                        padding: isComment ? '10px 14px' : '6px 12px',
                        margin: '10px 0',
                        background: isComment ? 'rgba(129, 140, 248, 0.05)' : 'transparent',
                        borderRadius: isComment ? '6px' : '0px',
                        color: isComment ? 'rgba(255, 255, 255, 0.85)' : 'var(--text-secondary)',
                        fontStyle: isComment ? 'normal' : 'italic',
                        boxShadow: isComment ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                    })}>
                        {isComment ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                    <span className="codicon codicon-comment" style={{ color: '#818cf8', fontSize: '14px', marginTop: '2px', flexShrink: 0 }} />
                                    <div style={{ flex: 1, margin: 0, padding: 0 }}>
                                        {renderInline(commentBody)}
                                    </div>
                                </div>
                                {contextText && (
                                    <div style={{
                                        marginTop: '6px',
                                        padding: '6px 10px',
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        borderLeft: '2px solid rgba(129, 140, 248, 0.4)',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontFamily: 'JetBrains Mono, Consolas, monospace',
                                        color: 'rgba(255, 255, 255, 0.55)',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-all'
                                    }}>
                                        <span className="codicon codicon-code" style={{ marginRight: '6px', fontSize: '11px', verticalAlign: 'middle', color: '#818cf8', opacity: 0.8 }} />
                                        {contextText}
                                    </div>
                                )}
                            </div>
                        ) : (
                            renderInline(innerText)
                        )}
                    </blockquote>,
                    line,
                    i
                )
            );
            return;
        }

        // 4. Empty line
        if (!trimmed) {
            flushList(`list-empty-${i}`);
            elements.push(<div key={i} style={{ height: '6px' }} />);
            return;
        }

        // Standard paragraph line
        if (inList) {
            flushList(`list-p-${i}`);
        }
        elements.push(renderLineWithEdit(<p {...commentProps} style={getCommentStyle({ margin: '4px 0', lineHeight: '1.5' })}>{renderInline(line)}</p>, line, i));
    });

    flushList(`list-final`);
    return <>{elements}</>;
}

export { ThinkingBlock, CodeBlock, TextBlock };
