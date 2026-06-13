import { type ActivityTimelineItem } from '../helpers/chatParsing';
import { FileIcon } from './FileIcon';

export function TimelineEditStep({
    step,
    onFileClick
}: {
    step: ActivityTimelineItem;
    onFileClick: (filePath?: string) => void;
}) {
    const getFilename = (fp: string) => fp.split(/[/\\]/).pop() || fp;

    return (
        <div style={{
            padding: '2px 0', fontSize: '13px', lineHeight: '1.6', display: 'flex',
            alignItems: 'center', color: 'var(--text-secondary, rgba(255,255,255,0.55))'
        }}>
            <span style={{ marginRight: '6px' }}>Edited</span>
            <FileIcon filePath={step.filePath} />
            <span
                onClick={() => onFileClick(step.filePath)}
                style={{ color: 'var(--text-primary, rgba(255,255,255,0.85))', cursor: 'pointer', marginRight: '6px' }}
                onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
            >
                {getFilename(step.filePath || '')}
            </span>
            {step.additions !== undefined && step.additions > 0 && (
                <span style={{ color: '#34d399', fontSize: '12px', marginRight: '4px', fontWeight: 600 }}>
                    +{step.additions}
                </span>
            )}
            {step.deletions !== undefined && step.deletions > 0 && (
                <span style={{ color: '#f87171', fontSize: '12px', fontWeight: 600 }}>
                    -{step.deletions}
                </span>
            )}
        </div>
    );
}
