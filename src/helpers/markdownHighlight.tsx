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
import type { ReactNode, CSSProperties } from 'react';
import { getPrismGrammar } from './markdownLanguage';

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

const PRISM_TOKEN_STYLES: Record<string, CSSProperties> = {
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

function escapeRegex(input: string) {
    return input.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
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
    syntaxStyle: CSSProperties,
    hoveredCommentId?: string | null,
    onHoverComment?: (id: string | null) => void
): ReactNode[] {
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

    const parts: ReactNode[] = [];
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
): ReactNode[] {
    const parts: ReactNode[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const key = `${cursor.value}-${i}`;

        if (typeof token === 'string') {
            parts.push(...renderHighlightedCodeText(token, cursor, commentAnchors, { color: '#d4d4d4' }, hoveredCommentId, onHoverComment));
            continue;
        }

        const tokenTypes = [token.type];
        const syntaxStyle = tokenTypes.reduce((acc: CSSProperties, type: string) => ({ ...acc, ...PRISM_TOKEN_STYLES[type] }), {} as CSSProperties);
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
): ReactNode[] {
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

export { renderCodeWithPrism };
