import { useState, useEffect, useRef, useCallback } from 'react';

export function useCommentOffsets(parsedComments: { id: string }[], activeTab: string, planningSubTab: string, cleanDocContent: string, cleanPlanning: string) {
    const [commentOffsets, setCommentOffsets] = useState<Record<string, number>>({});
    const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const updateCommentOffsets = useCallback(() => {
        if (!containerRef.current || parsedComments.length === 0) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const newOffsets: Record<string, number> = {};

        parsedComments.forEach(comment => {
            const el = document.getElementById(`comment-target-${comment.id}`);
            if (el) {
                const rect = el.getBoundingClientRect();
                const topOffset = rect.top - containerRect.top + containerRef.current!.scrollTop;
                newOffsets[comment.id] = topOffset;
            }
        });

        const sortedIds = Object.keys(newOffsets).sort((a, b) => newOffsets[a] - newOffsets[b]);
        const minSpacing = 70;
        for (let i = 1; i < sortedIds.length; i++) {
            const prevId = sortedIds[i - 1];
            const currId = sortedIds[i];
            if (newOffsets[currId] < newOffsets[prevId] + minSpacing) {
                newOffsets[currId] = newOffsets[prevId] + minSpacing;
            }
        }

        setCommentOffsets(newOffsets);
    }, [parsedComments]);

    useEffect(() => {
        if (activeTab !== 'doc' && activeTab !== 'planning') return;

        let frameId = 0;
        const scheduleUpdate = () => {
            cancelAnimationFrame(frameId);
            frameId = window.requestAnimationFrame(updateCommentOffsets);
        };

        scheduleUpdate();

        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(scheduleUpdate)
            : null;

        if (containerRef.current) {
            resizeObserver?.observe(containerRef.current);
        }

        const markdownSelector = activeTab === 'planning'
            ? (planningSubTab === 'blueprints' ? '.code-planning-markdown' : '.tradeoffs-container')
            : (activeTab === 'doc' ? '.design-doc-markdown' : '.tradeoffs-container');
        const markdownEl = document.querySelector(markdownSelector);
        if (markdownEl && resizeObserver) {
            resizeObserver.observe(markdownEl);
        }

        window.addEventListener('resize', scheduleUpdate);

        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', scheduleUpdate);
            resizeObserver?.disconnect();
        };
    }, [activeTab, planningSubTab, cleanDocContent, cleanPlanning, updateCommentOffsets]);

    return { commentOffsets, hoveredCommentId, setHoveredCommentId, containerRef };
}
