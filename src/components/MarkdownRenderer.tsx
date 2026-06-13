import { ThinkingBlock, CodeBlock, TextBlock } from './MarkdownBlocks';

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

    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    let thinkingContent = '';
    let mainContent = normalizedContent;

    const thinkStartIdx = normalizedContent.indexOf('<think>');
    if (thinkStartIdx !== -1) {
        const thinkEndIdx = normalizedContent.indexOf('</think>', thinkStartIdx);
        if (thinkEndIdx !== -1) {
            thinkingContent = normalizedContent.substring(thinkStartIdx + 7, thinkEndIdx);
            mainContent = normalizedContent.substring(thinkEndIdx + 8);
        } else {
            thinkingContent = normalizedContent.substring(thinkStartIdx + 7);
            mainContent = '';
        }
    }

    // A robust, lightweight custom parser for markdown elements
    // Split the content into blocks (code blocks vs text blocks)
    const blocks: Array<{ type: 'thinking' | 'text' | 'code'; content: string; language?: string }> = [];
    const regex = /```(\w*)[\r\n]+([\s\S]*?)```/g;
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
