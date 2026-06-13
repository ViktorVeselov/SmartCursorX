import { useState, useEffect } from 'react';
import { type ActivityTimelineItem, type AssistantActivity } from '../helpers/chatParsing';
import { TimelineAnalyzeStep } from './TimelineAnalyzeStep';
import { TimelineEditStep } from './TimelineEditStep';

// eslint-disable-next-line complexity
export function ActivitySteps({ 
    activity,
    isStreaming = false,
    msgFilesRead = [],
    currentlyReadingFiles = [],
    streamElapsed = 0
}: { 
    activity: AssistantActivity;
    isStreaming?: boolean;
    msgFilesRead?: string[];
    currentlyReadingFiles?: { path: string; timestamp: number }[];
    streamElapsed?: number;
}) {
    const [isMainExpanded, setIsMainExpanded] = useState(isStreaming);
    const [isExploredExpanded, setIsExploredExpanded] = useState(true);

    useEffect(() => {
        setIsMainExpanded(isStreaming);
    }, [isStreaming]);

    // --- Build the unified step list ---
    const steps = (() => {
        // If we have explicit activities, use them
        if (activity.activities && activity.activities.length > 0) {
            const merged = [...activity.activities];

            if (isStreaming && currentlyReadingFiles && currentlyReadingFiles.length > 0) {
                const existingPaths = new Set(
                    activity.activities
                        .filter(a => a.type === 'analyze' && a.filePath)
                        .map(a => (a.filePath as string).replace(/\\/g, '/').toLowerCase())
                );

                currentlyReadingFiles.forEach(f => {
                    const normF = f.path.replace(/\\/g, '/').toLowerCase();
                    let found = false;
                    for (const existing of existingPaths) {
                        if (existing.endsWith(normF) || normF.endsWith(existing)) { found = true; break; }
                    }
                    if (!found) {
                        let cleanPath = f.path;
                        let lineRange = '';
                        const hashIdx = cleanPath.indexOf('#');
                        if (hashIdx !== -1) { cleanPath = f.path.substring(0, hashIdx); lineRange = f.path.substring(hashIdx); }
                        merged.push({ type: 'analyze', filePath: cleanPath, lineRange: lineRange || undefined, timestamp: f.timestamp || Date.now() });
                        existingPaths.add(cleanPath.replace(/\\/g, '/').toLowerCase());
                    }
                });
            }
            return merged;
        }

        // Backward compat / Plan Mode (build from planSteps and filesRead/Edited)
        const virtualSteps: ActivityTimelineItem[] = [];
        const seenFiles = new Set<string>();

        const baseFilesRead = activity.filesRead && activity.filesRead.length > 0
            ? activity.filesRead
            : (msgFilesRead && msgFilesRead.length > 0 ? msgFilesRead : []);

        baseFilesRead.forEach(file => {
            const norm = file.replace(/\\/g, '/').toLowerCase();
            if (!seenFiles.has(norm)) {
                seenFiles.add(norm);
                let cleanPath = file; let lineRange = '';
                const hashIdx = file.indexOf('#');
                if (hashIdx !== -1) { cleanPath = file.substring(0, hashIdx); lineRange = file.substring(hashIdx); }
                virtualSteps.push({ type: 'analyze', filePath: cleanPath, lineRange: lineRange || undefined, timestamp: 0 });
            }
        });

        (activity.filesEdited || []).forEach(file => {
            const norm = file.replace(/\\/g, '/').toLowerCase();
            if (!seenFiles.has(norm)) {
                seenFiles.add(norm);
            }
            virtualSteps.push({ type: 'edit', filePath: file, timestamp: 0 });
        });

        (activity.planSteps || []).forEach(step => {
            virtualSteps.push({
                type: 'plan' as const,
                query: step.action + (step.target ? ` on ${step.target}` : ''),
                timestamp: step.order
            });
        });

        return virtualSteps;
    })();

    // Build thinking info
    const hasThoughts = activity.thoughts && activity.thoughts.trim().length > 0;

    if (steps.length === 0 && !isStreaming && !hasThoughts) return null;

    const isActivelyReading = (filePath: string) => {
        if (!isStreaming || !currentlyReadingFiles) return false;
        const normP = filePath.replace(/\\/g, '/').toLowerCase();
        return currentlyReadingFiles.some(f => {
            const normF = f.path.replace(/\\/g, '/').toLowerCase();
            return normF.endsWith(normP) || normP.endsWith(normF);
        });
    };

    const getDurationString = () => {
        if (isStreaming) {
            return `${streamElapsed.toFixed(1)}s`;
        }
        if (!activity.duration) return '';
        if (/[a-zA-Z]/.test(activity.duration)) {
            return activity.duration;
        }
        const num = parseFloat(activity.duration);
        if (isNaN(num)) return activity.duration;
        if (num >= 60) {
            return `${Math.floor(num / 60)}m ${Math.round(num % 60)}s`;
        }
        return `${num.toFixed(1)}s`;
    };

    const handleFileClick = (filePath?: string, line?: number) => {
        if (!filePath) return;
        window.dispatchEvent(new CustomEvent('open-workspace-file', {
            detail: { path: filePath, line }
        }));
    };

    // Filter steps
    const searchSteps = steps.filter(s => s.type === 'search');
    const analyzeSteps = steps.filter(s => s.type === 'analyze');
    const editSteps = steps.filter(s => s.type === 'edit');
    const planSteps = steps.filter(s => (s.type as string) === 'plan');

    const uniqueFiles = Array.from(new Set(analyzeSteps.map(s => s.filePath?.replace(/\\/g, '/').toLowerCase()).filter(Boolean)));
    const uniqueFilesCount = uniqueFiles.length;
    const searchesCount = searchSteps.length;

    const durationStr = getDurationString();
    const mainHeader = isStreaming 
        ? `Working${durationStr ? ` (${durationStr})` : ''}`
        : `Worked${durationStr ? ` for ${durationStr}` : ''}`;

    const exploredHeader = isStreaming
        ? `Exploring...`
        : `Explored ${uniqueFilesCount} file${uniqueFilesCount !== 1 ? 's' : ''}, ${searchesCount} search${searchesCount !== 1 ? 'es' : ''}`;

    return (
        <div style={{ marginBottom: '8px', width: '100%', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* Thinking line (if thoughts exist) */}
            {hasThoughts && (
                <div style={{ 
                    padding: '2px 0', 
                    fontSize: '13px', 
                    lineHeight: '1.6', 
                    color: 'var(--text-secondary, rgba(255,255,255,0.55))',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary, rgba(255,255,255,0.85))' }}>
                        {isStreaming ? 'Thinking' : 'Thought briefly'}
                    </span>
                </div>
            )}

            {/* Initial thinking state when no steps yet */}
            {isStreaming && steps.length === 0 && !hasThoughts && (
                <div style={{ 
                    padding: '2px 0', 
                    fontSize: '13px', 
                    lineHeight: '1.6', 
                    color: 'var(--text-secondary, rgba(255,255,255,0.55))',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary, rgba(255,255,255,0.85))' }}>Thinking</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>...</span>
                </div>
            )}

            {activity.cost ? (
                <div style={{
                    padding: '2px 0',
                    fontSize: '12px',
                    lineHeight: '1.6',
                    color: 'var(--text-secondary, rgba(255,255,255,0.5))',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <span style={{ color: '#10b981' }}>${activity.cost.toFixed(4)}</span>
                    <span style={{ color: 'var(--text-secondary, rgba(255,255,255,0.35))', fontSize: '11px' }}>
                        ({activity.inputTokens || 0} in / {activity.outputTokens || 0} out tok.)
                    </span>
                </div>
            ) : null}

            {/* Top-level collapsible: Worked for [duration] ▾ */}
            {steps.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <div
                        onClick={() => setIsMainExpanded(!isMainExpanded)}
                        style={{
                            padding: '2px 0',
                            fontSize: '13px',
                            lineHeight: '1.6',
                            cursor: 'pointer',
                            userSelect: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: 'var(--text-secondary, rgba(255,255,255,0.55))',
                            fontWeight: 500
                        }}
                    >
                        <span style={{ color: 'var(--text-primary, rgba(255,255,255,0.85))' }}>{mainHeader}</span>
                        <span style={{
                            fontSize: '9px',
                            color: 'var(--text-secondary, rgba(255,255,255,0.35))',
                            transition: 'transform 0.15s ease',
                            transform: isMainExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                            display: 'inline-block'
                        }}>▾</span>
                    </div>

                    {isMainExpanded && (
                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                            {/* Explored collapsible section */}
                            {(searchSteps.length > 0 || analyzeSteps.length > 0 || isStreaming) && (
                                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', paddingLeft: '14px' }}>
                                    <div
                                        onClick={() => setIsExploredExpanded(!isExploredExpanded)}
                                        style={{
                                            padding: '2px 0',
                                            fontSize: '13px',
                                            lineHeight: '1.6',
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            color: 'var(--text-secondary, rgba(255,255,255,0.55))',
                                            fontWeight: 500
                                        }}
                                    >
                                        <span>{exploredHeader}</span>
                                        <span style={{
                                            fontSize: '9px',
                                            color: 'var(--text-secondary, rgba(255,255,255,0.35))',
                                            transition: 'transform 0.15s ease',
                                            transform: isExploredExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                                            display: 'inline-block'
                                        }}>▾</span>
                                    </div>

                                    {isExploredExpanded && (
                                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', paddingLeft: '14px' }}>
                                            {steps.filter(s => s.type !== 'edit' && (s.type as string) !== 'plan').map((step, idx) => {
                                                if (step.type === 'search') {
                                                    return (
                                                        <div key={idx} style={{ 
                                                            padding: '2px 0', 
                                                            fontSize: '13px', 
                                                            lineHeight: '1.6', 
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            color: 'var(--text-secondary, rgba(255,255,255,0.55))' 
                                                        }}>
                                                            <span style={{ marginRight: '6px' }}>Searched</span>
                                                            <span style={{ 
                                                                fontFamily: 'Consolas, Monaco, monospace', 
                                                                fontSize: '12px', 
                                                                color: 'var(--text-primary, rgba(255,255,255,0.85))',
                                                                background: 'rgba(255,255,255,0.03)',
                                                                padding: '1px 4px',
                                                                borderRadius: '3px'
                                                            }}>
                                                                {step.query}
                                                            </span>
                                                            {step.resultsCount !== undefined && (
                                                                <span style={{ 
                                                                    fontSize: '11px', 
                                                                    color: 'var(--text-secondary, rgba(255,255,255,0.4))',
                                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                                    padding: '1px 6px',
                                                                    borderRadius: '10px',
                                                                    marginLeft: '8px',
                                                                    fontWeight: 500
                                                                }}>
                                                                    {step.resultsCount} {step.resultsCount === 1 ? 'result' : 'results'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                }

                                                if (step.type === 'analyze') {
                                                    return (
                                                        <TimelineAnalyzeStep
                                                            key={idx}
                                                            step={step}
                                                            isActive={isActivelyReading(step.filePath || '')}
                                                            onFileClick={handleFileClick}
                                                        />
                                                    );
                                                }

                                                return null;
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Planned steps */}
                            {planSteps.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', paddingLeft: '14px' }}>
                                    {planSteps.map((step, idx) => (
                                        <div key={idx} style={{ 
                                            padding: '2px 0', 
                                            fontSize: '13px', 
                                            lineHeight: '1.6', 
                                            display: 'flex',
                                            alignItems: 'center',
                                            color: 'var(--text-secondary, rgba(255,255,255,0.55))' 
                                        }}>
                                            <span style={{ marginRight: '6px', fontWeight: 600, color: 'var(--text-primary, rgba(255,255,255,0.85))' }}>
                                                Planned
                                            </span>
                                            <span style={{ color: 'var(--text-secondary, rgba(255,255,255,0.55))' }}>
                                                {step.query}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Edited steps - siblings to Explored, indented by same amount (14px) */}
                            {editSteps.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', paddingLeft: '14px' }}>
                                    {editSteps.map((step, idx) => (
                                        <TimelineEditStep
                                            key={idx}
                                            step={step}
                                            onFileClick={handleFileClick}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

