import { useState } from 'react';

interface MarkdownRendererProps {
    content: string;
    onApplyCode?: (code: string) => void;
}

export function MarkdownRenderer({ content, onApplyCode }: MarkdownRendererProps) {
    if (!content) return null;

    let thinkingContent = '';
    let mainContent = content;

    const thinkStartIdx = content.indexOf('<think>');
    if (thinkStartIdx !== -1) {
        const thinkEndIdx = content.indexOf('</think>', thinkStartIdx);
        if (thinkEndIdx !== -1) {
            thinkingContent = content.substring(thinkStartIdx + 7, thinkEndIdx);
            mainContent = content.substring(thinkEndIdx + 8);
        } else {
            thinkingContent = content.substring(thinkStartIdx + 7);
            mainContent = '';
        }
    }

    // A robust, lightweight custom parser for markdown elements
    // Split the content into blocks (code blocks vs text blocks)
    const parts: React.ReactNode[] = [];
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    let keyCounter = 0;

    if (thinkingContent) {
        parts.push(<ThinkingBlock key={`think-${keyCounter++}`} content={thinkingContent} />);
    }

    if (mainContent) {
        while ((match = regex.exec(mainContent)) !== null) {
            const textBefore = mainContent.substring(lastIndex, match.index);
            const language = match[1] || 'code';
            const code = match[2];

            if (textBefore) {
                parts.push(<TextBlock key={`text-${keyCounter++}`} text={textBefore} />);
            }

            parts.push(<CodeBlock key={`code-${keyCounter++}`} language={language} code={code} onApplyCode={onApplyCode} />);
            lastIndex = regex.lastIndex;
        }

        const remainingText = mainContent.substring(lastIndex);
        if (remainingText) {
            parts.push(<TextBlock key={`text-${keyCounter++}`} text={remainingText} />);
        }
    }

    return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{parts}</div>;
}

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

function CodeBlock({ language, code, onApplyCode }: { language: string; code: string; onApplyCode?: (code: string) => void }) {
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
                whiteSpace: 'pre'
            }}>
                <code>{code}</code>
            </pre>
        </div>
    );
}

function TextBlock({ text }: { text: string }) {
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

    lines.forEach((line, i) => {
        const trimmed = line.trim();

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
                elements.push(<h1 key={i} style={{ ...style, fontSize: '1.4rem' }}>{renderInline(headingText)}</h1>);
            } else if (level === 2) {
                elements.push(<h2 key={i} style={{ ...style, fontSize: '1.2rem' }}>{renderInline(headingText)}</h2>);
            } else {
                elements.push(<h3 key={i} style={{ ...style, fontSize: '1.05rem' }}>{renderInline(headingText)}</h3>);
            }
            return;
        }

        // 2. Unordered lists
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            inList = true;
            const itemText = trimmed.substring(2);
            listItems.push(<li key={`li-${i}`} style={{ marginBottom: 4 }}>{renderInline(itemText)}</li>);
            return;
        }

        // 3. Blockquotes
        if (trimmed.startsWith('> ')) {
            flushList(`list-quote-${i}`);
            elements.push(
                <blockquote key={i} style={{
                    borderLeft: '3px solid var(--accent-primary)',
                    paddingLeft: '12px',
                    margin: '6px 0',
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic'
                }}>
                    {renderInline(trimmed.substring(2))}
                </blockquote>
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
        elements.push(<p key={i} style={{ margin: '4px 0', lineHeight: '1.5' }}>{renderInline(line)}</p>);
    });

    flushList(`list-final`);
    return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
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
        }

        lastIndex = regex.lastIndex;
    }

    const remaining = text.substring(lastIndex);
    if (remaining) {
        parts.push(<span key={key++}>{remaining}</span>);
    }

    return parts;
}
