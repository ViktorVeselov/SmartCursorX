import { useState, type ReactElement } from 'react';
import { type ActivityTimelineItem } from '../helpers/chatParsing';
import { FileIcon } from './FileIcon';

function renderCodeWithLineNumbers(content: string, lineRange?: string): ReactElement[] {
    const lines = content.split('\n');
    let startLine = 1;
    let endLine = lines.length;

    if (lineRange) {
        const match = lineRange.match(/#L(\d+)(?:-(\d+))?/);
        if (match) {
            startLine = parseInt(match[1], 10);
            endLine = match[2] ? parseInt(match[2], 10) : startLine;
        }
    }

    const displayLines = lines.slice(startLine - 1, endLine);

    return displayLines.map((line, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 8, fontFamily: 'Consolas, Monaco, monospace', fontSize: 11 }}>
            <span style={{ color: 'var(--text-secondary, rgba(255,255,255,0.4))', minWidth: 30, textAlign: 'right', userSelect: 'none', opacity: 0.6 }}>
                {startLine + idx}
            </span>
            <span style={{ color: 'var(--text-primary, rgba(255,255,255,0.85))', whiteSpace: 'pre' }}>{line || ' '}</span>
        </div>
    ));
}

export function TimelineAnalyzeStep({
    step,
    isActive,
    onFileClick
}: {
    step: ActivityTimelineItem;
    isActive: boolean;
    onFileClick: (filePath?: string, line?: number) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [fileContent, setFileContent] = useState<string | undefined>(undefined);

    const getFilename = (fp: string) => fp.split(/[/\\]/).pop() || fp;

    const expandAndFetch = () => {
        if (!step.filePath) return;
        setIsExpanded(true);
        if (fileContent === undefined) {
            window.ipcRenderer.invoke('read-file', step.filePath).then(content => {
                setFileContent(content);
            }).catch(err => {
                console.error('Failed to fetch file content:', err);
            });
        }
    };

    const toggleExpand = () => {
        if (!step.filePath) return;
        if (isExpanded) {
            setIsExpanded(false);
        } else {
            expandAndFetch();
        }
    };

    const handleFilenameClick = () => {
        if (!step.filePath) return;
        expandAndFetch();
        const lineNum = step.lineRange ? parseInt(step.lineRange.replace(/[#:L]/g, ''), 10) || undefined : undefined;
        onFileClick(step.filePath, lineNum);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{
                padding: '2px 0', fontSize: '13px', lineHeight: '1.6', display: 'flex',
                alignItems: 'center', color: 'var(--text-secondary, rgba(255,255,255,0.55))'
            }}>
                <span
                    onClick={toggleExpand}
                    style={{
                        marginRight: '4px', cursor: 'pointer', fontSize: '9px',
                        color: 'var(--text-secondary, rgba(255,255,255,0.35))',
                        transition: 'transform 0.15s ease',
                        transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                        display: 'inline-block', width: 12, textAlign: 'center'
                    }}
                >▾</span>
                <span style={{ marginRight: '6px' }}>
                    {isActive ? 'Analyzing' : 'Analyzed'}
                </span>
                <FileIcon filePath={step.filePath} />
                <span
                    onClick={handleFilenameClick}
                    style={{ color: 'var(--text-primary, rgba(255,255,255,0.85))', cursor: 'pointer' }}
                    onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
                >
                    {getFilename(step.filePath || '')}
                </span>
                {step.lineRange && (
                    <span style={{ color: 'var(--text-secondary, rgba(255,255,255,0.4))', marginLeft: '4px', fontSize: '12px' }}>
                        {step.lineRange.startsWith('#') || step.lineRange.startsWith(':') ? step.lineRange : `#${step.lineRange}`}
                    </span>
                )}
            </div>
            {isExpanded && (
                <div style={{
                    paddingLeft: 28, marginTop: 4, marginBottom: 8,
                    background: 'rgba(0,0,0,0.2)', borderRadius: 4,
                    padding: '8px 12px', maxHeight: 200, overflow: 'auto'
                }}>
                    {fileContent !== undefined ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {renderCodeWithLineNumbers(fileContent, step.lineRange)}
                        </div>
                    ) : (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            Loading...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
