import { useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-yaml';

interface MarkdownRendererProps {
    content: string;
    onApplyCode?: (code: string) => void;
    comments?: { id: string; body: string; context: string }[];
    hoveredCommentId?: string | null;
    onHoverComment?: (id: string | null) => void;
    onContentChange?: (newContent: string) => void;
}

export function MarkdownRenderer({ content, onApplyCode, comments, hoveredCommentId, onHoverComment, onContentChange }: MarkdownRendererProps) {
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
    const blocks: Array<{ type: 'thinking' | 'text' | 'code'; content: string; language?: string }> = [];
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    if (thinkingContent) {
        blocks.push({ type: 'thinking', content: thinkingContent });
    }

    if (mainContent) {
        const normalizedMainContent = mainContent
            .replace(/^[ \t]+```/gm, '```')
            .replace(/^[ \t]+```$/gm, '```');

        while ((match = regex.exec(normalizedMainContent)) !== null) {
            const textBefore = normalizedMainContent.substring(lastIndex, match.index);
            const language = match[1] || 'code';
            const code = match[2];

            if (textBefore) {
                blocks.push({ type: 'text', content: textBefore });
            }

            blocks.push({ type: 'code', content: code, language });
            lastIndex = regex.lastIndex;
        }

        const remainingText = normalizedMainContent.substring(lastIndex);
        if (remainingText) {
            blocks.push({ type: 'text', content: remainingText });
        }
    }

    const handleUpdateTextBlock = (blockIndex: number, newTextBlockContent: string) => {
        if (!onContentChange) return;
        const updatedBlocks = [...blocks];
        updatedBlocks[blockIndex] = { ...updatedBlocks[blockIndex], content: newTextBlockContent };

        // Reconstruct full markdown content
        let reconstructed = '';
        for (const block of updatedBlocks) {
            if (block.type === 'thinking') {
                reconstructed += `<think>${block.content}</think>\n`;
            } else if (block.type === 'code') {
                reconstructed += `\`\`\`${block.language}\n${block.content}\`\`\`\n`;
            } else {
                reconstructed += block.content;
            }
        }
        onContentChange(reconstructed);
    };

    const parts: React.ReactNode[] = [];
    let keyCounter = 0;

    blocks.forEach((block, index) => {
        if (block.type === 'thinking') {
            parts.push(<ThinkingBlock key={`think-${keyCounter++}`} content={block.content} />);
        } else if (block.type === 'code') {
            parts.push(<CodeBlock key={`code-${keyCounter++}`} language={block.language || 'code'} code={block.content} comments={comments} hoveredCommentId={hoveredCommentId} onHoverComment={onHoverComment} onApplyCode={onApplyCode} />);
        } else {
            parts.push(
                <TextBlock 
                    key={`text-${keyCounter++}`} 
                    text={block.content} 
                    comments={comments} 
                    hoveredCommentId={hoveredCommentId} 
                    onHoverComment={onHoverComment} 
                    onUpdateText={onContentChange ? (newText) => handleUpdateTextBlock(index, newText) : undefined}
                />
            );
        }
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <style>{`
                .markdown-line-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                    width: 100%;
                }
                .markdown-line-wrapper .line-copy-btn {
                    opacity: 0;
                    transition: opacity 0.2s;
                    margin-left: 8px;
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.4);
                    cursor: pointer;
                    padding: 2px;
                    display: flex;
                    align-items: center;
                    flex-shrink: 0;
                }
                .markdown-line-wrapper:hover .line-copy-btn {
                    opacity: 1;
                }
                .markdown-line-wrapper .line-copy-btn:hover {
                    color: #818cf8;
                }
            `}</style>
            {parts}
        </div>
    );
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

type CommentAnchor = {
    id: string;
    body: string;
    context: string;
    start: number;
    end: number;
};

type PrismTokenLike = {
    type: string;
    content: string | PrismTokenLike[];
};

const PRISM_LANGUAGE_ALIASES: Record<string, string> = {
    code: 'plaintext',
    txt: 'plaintext',
    text: 'plaintext',
    j: 'javascript',
    tscript: 'typescript',
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    css: 'css',
    html: 'markup',
    htm: 'markup',
    bash: 'bash',
    sh: 'bash',
    zsh: 'bash',
    sql: 'sql',
    py: 'python',
    python: 'python',
    yml: 'yaml',
    yaml: 'yaml',
};

function inferLanguageFromCode(code: string): string {
    const text = code.trim();
    if (!text) return 'plaintext';

    const score = (patterns: RegExp[]) => patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0);

    const jsonScore = score([
        /^\s*\{/m,
        /^\s*\[/m,
        /"[^"]+"\s*:\s*/m,
        /:\s*(true|false|null|\d+|".*?")\s*[,}\]]/m
    ]);
    if (jsonScore >= 2) return 'json';

    const tsScore = score([
        /\binterface\s+\w+/m,
        /\btype\s+\w+\s*=/m,
        /\b(?:const|let|var)\s+\w+\s*:\s*[\w<>\[\]\|]+/m,
        /\bas\s+\w+/m,
        /\b(?:readonly\s+)?\w+\s*:\s*[\w<>\[\]\|]+/m,
        /\b(?:public|private|protected)\s+\w+/m
    ]);
    if (tsScore >= 2) return 'ts';

    const jsxScore = score([
        /<[A-Za-z][\w-]*(\s|>)/m,
        /\breturn\s*\(\s*</m,
        /\bprops\b.*</m
    ]);
    if (jsxScore >= 2) return tsScore > 0 ? 'tsx' : 'jsx';

    const jsScore = score([
        /\b(?:const|let|var)\s+\w+/m,
        /\bfunction\s+\w+/m,
        /\bclass\s+\w+/m,
        /\bexport\s+(?:default\s+)?/m,
        /\bimport\s+.+\s+from\s+['"]/m,
        /=>/m,
        /\bconsole\.(log|error|warn)\b/m
    ]);
    if (jsScore >= 2) return 'js';

    const cssScore = score([
        /\b[a-z-]+\s*:\s*[^;{]+;/m,
        /#[0-9a-fA-F]{3,8}\b/m,
        /\b(?:display|position|margin|padding|color|background)\s*:/m
    ]);
    if (cssScore >= 2) return 'css';

    const htmlScore = score([
        /<\/?[a-z][\w:-]*(\s[^>]*)?>/mi,
        /<!doctype html>/mi
    ]);
    if (htmlScore >= 2) return 'markup';

    const bashScore = score([
        /^#!\/(?:bin\/)?(?:ba|z)?sh/m,
        /\b(?:echo|cd|mkdir|rm|cp|mv|npm|npx|yarn|pnpm|git|curl|wget)\b/m,
        /\$\w+|\$\{[^}]+\}/m
    ]);
    if (bashScore >= 2) return 'bash';

    const sqlScore = score([
        /\bSELECT\b.+\bFROM\b/mi,
        /\bINSERT\s+INTO\b/mi,
        /\bCREATE\s+TABLE\b/mi,
        /\bWHERE\b/mi
    ]);
    if (sqlScore >= 2) return 'sql';

    const yamlScore = score([
        /^\s*[\w-]+\s*:\s*.+$/m,
        /^\s*-\s+.+$/m,
        /^\s*version\s*:\s*.+$/m
    ]);
    if (yamlScore >= 2) return 'yaml';

    const pythonScore = score([
        /^\s*def\s+\w+\(/m,
        /^\s*class\s+\w+\s*:/m,
        /\bimport\s+\w+/m,
        /\bfrom\s+\w+\s+import\s+/m,
        /:\s*$/m
    ]);
    if (pythonScore >= 2) return 'python';

    return 'plaintext';
}

const PRISM_TOKEN_STYLES: Record<string, React.CSSProperties> = {
    comment: { color: '#94a3b8', fontStyle: 'italic' },
    keyword: { color: '#c084fc' },
    string: { color: '#86efac' },
    number: { color: '#fbbf24' },
    boolean: { color: '#fbbf24' },
    function: { color: '#7dd3fc' },
    'class-name': { color: '#f9a8d4' },
    property: { color: '#93c5fd' },
    constant: { color: '#fbbf24' },
    operator: { color: '#f472b6' },
    punctuation: { color: '#cbd5e1' },
    tag: { color: '#f87171' },
    'attr-name': { color: '#93c5fd' },
    'attr-value': { color: '#86efac' },
    selector: { color: '#c084fc' },
    url: { color: '#fcd34d' },
    important: { color: '#fb7185', fontWeight: 700 },
    builtin: { color: '#60a5fa' },
    regex: { color: '#f59e0b' },
    deleted: { color: '#fb7185' },
    inserted: { color: '#4ade80' }
};

function normalizeLanguage(language: string) {
    const lower = (language || '').toLowerCase();
    return PRISM_LANGUAGE_ALIASES[lower] || lower || 'plaintext';
}

function getPrismGrammar(language: string, code: string) {
    const normalized = normalizeLanguage(language);
    const effectiveLanguage = normalized === 'plaintext' ? inferLanguageFromCode(code) : normalized;
    return Prism.languages[effectiveLanguage] || Prism.languages.plaintext;
}

function escapeRegex(input: string) {
    return input.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function normalizeWhitespace(input: string) {
    return input.trim().replace(/\s+/g, ' ');
}

function buildCommentAnchorRanges(code: string, comments?: { id: string; body: string; context: string }[]): CommentAnchor[] {
    if (!comments?.length || !code) return [];

    const sorted = [...comments].sort((a, b) => b.context.length - a.context.length);
    const accepted: CommentAnchor[] = [];

    for (const comment of sorted) {
        const normalized = normalizeWhitespace(comment.context);
        if (normalized.length < 3) continue;

        const pattern = normalized
            .split(/\s+/)
            .filter(Boolean)
            .map(escapeRegex)
            .join('[\\s\\S]*?');

        try {
            const regex = new RegExp(pattern, 'i');
            const match = regex.exec(code);
            if (!match || match.index == null) continue;

            const start = match.index;
            const end = start + match[0].length;
            const overlaps = accepted.some(existing => !(end <= existing.start || start >= existing.end));
            if (!overlaps) {
                accepted.push({ id: comment.id, body: comment.body, context: comment.context, start, end });
            }
        } catch (err) {
            console.error('Failed to build comment anchor regex:', err);
        }
    }

    return accepted.sort((a, b) => a.start - b.start || a.end - b.end);
}

function renderHighlightedCodeText(
    text: string,
    cursor: { value: number },
    commentAnchors: CommentAnchor[],
    syntaxStyle: React.CSSProperties,
    hoveredCommentId?: string | null,
    onHoverComment?: (id: string | null) => void
): React.ReactNode[] {
    if (!text) return [];

    const start = cursor.value;
    const end = start + text.length;
    cursor.value = end;

    const overlaps = commentAnchors
        .filter(anchor => anchor.end > start && anchor.start < end)
        .sort((a, b) => a.start - b.start || a.end - b.end);

    if (overlaps.length === 0) {
        return [<span key={`${start}-${end}`} style={syntaxStyle}>{text}</span>];
    }

    const parts: React.ReactNode[] = [];
    let localIndex = 0;
    let partIndex = 0;

    for (const anchor of overlaps) {
        const anchorStart = Math.max(anchor.start, start) - start;
        const anchorEnd = Math.min(anchor.end, end) - start;

        if (anchorStart > localIndex) {
            const plain = text.slice(localIndex, anchorStart);
            parts.push(<span key={`${start}-${partIndex++}`} style={syntaxStyle}>{plain}</span>);
        }

        const segment = text.slice(anchorStart, anchorEnd);
        const isHovered = hoveredCommentId === anchor.id;
        parts.push(
            <span
                key={`${start}-${partIndex++}`}
                id={`comment-target-${anchor.id}`}
                onMouseEnter={() => onHoverComment?.(anchor.id)}
                onMouseLeave={() => onHoverComment?.(null)}
                style={{
                    ...syntaxStyle,
                    background: isHovered ? 'rgba(129, 140, 248, 0.34)' : 'rgba(129, 140, 248, 0.18)',
                    borderBottom: isHovered ? '1.5px solid #818cf8' : '1.5px dashed #818cf8',
                    borderRadius: 2,
                    cursor: 'pointer',
                    padding: '0 2px'
                }}
                title={`Comment: ${anchor.body}`}
            >
                {segment}
            </span>
        );
        localIndex = anchorEnd;
    }

    if (localIndex < text.length) {
        parts.push(<span key={`${start}-${partIndex++}`} style={syntaxStyle}>{text.slice(localIndex)}</span>);
    }

    return parts;
}

function renderPrismTokens(
    tokens: Array<string | PrismTokenLike>,
    cursor: { value: number },
    commentAnchors: CommentAnchor[],
    hoveredCommentId?: string | null,
    onHoverComment?: (id: string | null) => void
): React.ReactNode[] {
    const parts: React.ReactNode[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const key = `${cursor.value}-${i}`;

        if (typeof token === 'string') {
            parts.push(...renderHighlightedCodeText(token, cursor, commentAnchors, { color: '#d4d4d4' }, hoveredCommentId, onHoverComment));
            continue;
        }

        const tokenTypes = [token.type];
        const syntaxStyle = tokenTypes.reduce((acc: React.CSSProperties, type: string) => ({ ...acc, ...PRISM_TOKEN_STYLES[type] }), {} as React.CSSProperties);
        const tokenContent = Array.isArray(token.content) ? token.content : [token.content];
        const inner = renderPrismTokens(tokenContent, cursor, commentAnchors, hoveredCommentId, onHoverComment);

        parts.push(
            <span key={key} style={syntaxStyle}>
                {inner}
            </span>
        );
    }

    return parts;
}

function renderCodeWithPrism(
    code: string,
    language: string,
    comments?: { id: string; body: string; context: string }[],
    hoveredCommentId?: string | null,
    onHoverComment?: (id: string | null) => void
): React.ReactNode[] {
    const grammar = getPrismGrammar(language, code);
    const commentAnchors = buildCommentAnchorRanges(code, comments);
    const cursor = { value: 0 };

    if (!grammar) {
        return [<span key="plain">{code}</span>];
    }

    try {
        const tokenStream = Prism.tokenize(code, grammar) as Array<string | PrismTokenLike>;
        return renderPrismTokens(tokenStream, cursor, commentAnchors, hoveredCommentId, onHoverComment);
    } catch (err) {
        console.error('Failed to render Prism tokens, falling back to plain code:', err);
        return [<span key="plain">{code}</span>];
    }
}

function CodeBlock({ language, code, comments, hoveredCommentId, onHoverComment, onApplyCode }: { language: string; code: string; comments?: { id: string; body: string; context: string }[]; hoveredCommentId?: string | null; onHoverComment?: (id: string | null) => void; onApplyCode?: (code: string) => void }) {
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
        const cleanLine = lineText.replace(/[`*_~#\[\]()]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (!cleanLine) return null;
        return comments.find(c => {
            const cleanCtx = c.context.replace(/[`*_~#\[\]()]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
            return cleanCtx.length > 2 && cleanLine.includes(cleanCtx);
        }) || null;
    };

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
                    e.stopPropagation(); // Stop propagation to prevent editing mode!
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
