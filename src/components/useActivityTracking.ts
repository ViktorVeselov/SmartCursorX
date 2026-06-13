import { useEffect, useRef } from 'react';
import { extractFiles } from '../helpers/chatParsing';
import type { ActivityTimelineItem } from '../helpers/chatParsing';

// eslint-disable-next-line max-lines-per-function
export function useActivityTracking(
    setMessages: React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>,
    setCurrentlyReadingFiles: React.Dispatch<React.SetStateAction<{ path: string; timestamp: number }[]>>
) {
    const currentActivitiesRef = useRef<ActivityTimelineItem[]>([]);

    const appendActivity = (newItem: ActivityTimelineItem) => {
        currentActivitiesRef.current = [...currentActivitiesRef.current, newItem];
        setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && (lastMsg as Record<string, unknown>).role === 'assistant' && (lastMsg as Record<string, unknown>).isStreaming) {
                return [...prev.slice(0, -1), {
                    ...(lastMsg as Record<string, unknown>),
                    activities: currentActivitiesRef.current
                }];
            }
            return prev;
        });
    };

    const parsePathRange = (path: string): { cleanPath: string; lineRange: string } => {
        let cleanPath = path;
        let lineRange = '';
        const hashIdx = path.indexOf('#');
        if (hashIdx !== -1) {
            cleanPath = path.substring(0, hashIdx);
            lineRange = path.substring(hashIdx);
        } else {
            const colonIdx = path.lastIndexOf(':');
            if (colonIdx > 1 && /^\d+/.test(path.substring(colonIdx + 1))) {
                cleanPath = path.substring(0, colonIdx);
                lineRange = ':' + path.substring(colonIdx + 1);
            }
        }
        return { cleanPath, lineRange };
    };

    const handleFileRead = (data: Record<string, unknown>) => {
        const path = typeof data.path === 'string' ? data.path : '';
        setCurrentlyReadingFiles(prev => {
            if (prev.some(p => p.path === path)) return prev;
            return [...prev.slice(-14), { path, timestamp: Date.now() }];
        });

        const normPath = path.replace(/\\/g, '/').toLowerCase();
        if (!currentActivitiesRef.current.some(a => a.type === 'analyze' && a.filePath?.replace(/\\/g, '/').toLowerCase() === normPath)) {
            const { cleanPath, lineRange: parsedRange } = parsePathRange(path);
            let lineRange = parsedRange;

            if (!lineRange) {
                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && (lastMsg as Record<string, unknown>).role === 'assistant' && (lastMsg as Record<string, unknown>).content) {
                        const contentStr = typeof lastMsg.content === 'string' ? lastMsg.content : '';
                        const allFiles = extractFiles(contentStr);
                        const matched = allFiles.find(f => {
                            const filePath = f.split('#')[0].replace(/\\/g, '/').toLowerCase();
                            return filePath === normPath || filePath.endsWith(normPath) || normPath.endsWith(filePath);
                        });
                        if (matched) {
                            const matchHashIdx = matched.indexOf('#');
                            if (matchHashIdx !== -1) {
                                lineRange = matched.substring(matchHashIdx);
                            }
                        }
                    }
                    return prev;
                });
            }

            const timestamp = typeof data.timestamp === 'number' ? data.timestamp : Date.now();
            const newItem: ActivityTimelineItem = {
                type: 'analyze',
                filePath: cleanPath,
                lineRange: lineRange || undefined,
                timestamp: timestamp
            };
            appendActivity(newItem);
        }
    };

    const handleFileSearch = (data: Record<string, unknown>) => {
        const query = typeof data.query === 'string' ? data.query : '';
        const resultsCount = typeof data.resultsCount === 'number' ? data.resultsCount : 0;
        const timestamp = typeof data.timestamp === 'number' ? data.timestamp : Date.now();
        const newItem: ActivityTimelineItem = {
            type: 'search',
            query: query,
            resultsCount: resultsCount,
            timestamp: timestamp
        };
        appendActivity(newItem);
    };

    const handleFileWrite = (data: Record<string, unknown>) => {
        const path = typeof data.path === 'string' ? data.path : '';
        const { cleanPath, lineRange } = parsePathRange(path);
        const additions = typeof data.additions === 'number' ? data.additions : 0;
        const deletions = typeof data.deletions === 'number' ? data.deletions : 0;
        const timestamp = typeof data.timestamp === 'number' ? data.timestamp : Date.now();
        const newItem: ActivityTimelineItem = {
            type: 'edit',
            filePath: cleanPath,
            lineRange: lineRange || undefined,
            additions: additions,
            deletions: deletions,
            timestamp: timestamp
        };
        appendActivity(newItem);
    };

    useEffect(() => {
        const handleMainProcessMessage = (_event: unknown, data: Record<string, unknown>) => {
            if (!data) return;
            if (data.type === 'file-read') {
                handleFileRead(data);
            } else if (data.type === 'file-search') {
                handleFileSearch(data);
            } else if (data.type === 'file-write') {
                handleFileWrite(data);
            }
        };

        window.ipcRenderer.on('main-process-message', handleMainProcessMessage);
        return () => {
            window.ipcRenderer.off('main-process-message', handleMainProcessMessage);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setMessages, setCurrentlyReadingFiles]);

    return { currentActivitiesRef };
}
