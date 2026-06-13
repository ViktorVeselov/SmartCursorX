import { useState, useEffect, useRef } from 'react';
import { findMarkdownSubstring } from '../helpers/planEditorUtils';
import type { ExecutionPlan, SelectedTextInfo } from '../helpers/planEditorTypes';

// eslint-disable-next-line max-lines-per-function
export function useInlineEdit(
    plan: ExecutionPlan | null,
    savePlan: (p: ExecutionPlan) => Promise<void>,
    activeTab: string,
    planningSubTab: string,
    registerAiStreamHandlers: (onChunk: (_: unknown, chunk: string) => void, onEnd: () => void | Promise<void>) => void
) {
    const [selectedTextInfo, setSelectedTextInfo] = useState<SelectedTextInfo | null>(null);
    const [showSelectionPopup, setShowSelectionPopup] = useState<'menu' | 'comment' | 'edit' | null>(null);
    const [commentText, setCommentText] = useState('');
    const [editInstruction, setEditInstruction] = useState('');
    const [isInlineAiLoading, setIsInlineAiLoading] = useState(false);
    const selectionPopupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!selectedTextInfo) return;
        const handleMouseDown = (e: MouseEvent) => {
            if (selectionPopupRef.current && !selectionPopupRef.current.contains(e.target as Node)) {
                setSelectedTextInfo(null);
                setShowSelectionPopup(null);
            }
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [selectedTextInfo]);

    useEffect(() => {
        const handleGlobalMouseUp = (e: MouseEvent) => {
            if (activeTab !== 'doc' && activeTab !== 'planning') return;

            const selector = activeTab === 'planning' 
                ? (planningSubTab === 'blueprints' ? '.code-planning-markdown' : '.tradeoffs-container') 
                : (activeTab === 'doc' ? '.design-doc-markdown' : '.tradeoffs-container');
            const markdownEl = document.querySelector(selector);
            if (!markdownEl) return;

            setTimeout(() => {
                const sel = window.getSelection();
                if (sel && sel.toString().trim()) {
                    const text = sel.toString();
                    
                    try {
                        const range = sel.getRangeAt(0);
                        if (markdownEl.contains(range.commonAncestorContainer) || markdownEl.contains(range.startContainer)) {
                            const { x: popupX, y: popupY } = calcPopupPos(e.clientX, e.clientY);
                            setSelectedTextInfo({ text, start: 0, end: 0, isTextarea: false, x: popupX, y: popupY });
                            setShowSelectionPopup('menu');
                        }
                    } catch (err) {
                        console.error('Failed to get selection range:', err);
                    }
                }
            }, 50);
        };

        document.addEventListener('mouseup', handleGlobalMouseUp);
        return () => {
            document.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [activeTab, planningSubTab]);

    const calcPopupPos = (mouseX: number, mouseY: number): { x: number; y: number } => {
        const popupWidth = 324;
        const popupHeight = 120;
        const padding = 10;
        const x = Math.max(padding, Math.min(window.innerWidth - popupWidth - padding, mouseX - 160));
        const spaceBelow = window.innerHeight - mouseY;
        const y = spaceBelow > popupHeight + 24
            ? mouseY + 14
            : Math.max(padding, mouseY - popupHeight - 14);
        return { x, y };
    };

    const handleLeaveCommentSubmit = () => {
        if (!plan || !selectedTextInfo || !commentText.trim()) return;
        const currentPlan = plan;
        const targetClean = selectedTextInfo.text.replace(/\n/g, ' ');
        const commentString = `\n> \u{1F4AC} **Refactor Comment:** ${commentText} \u2014 *on: "${targetClean}"*\n`;
        
        if (activeTab === 'planning') {
            const originalPlanning = currentPlan.codePlanning || '';
            const newText = originalPlanning.trim() + `\n\n` + commentString;
            savePlan({ ...currentPlan, codePlanning: newText });
        } else {
            const originalDoc = currentPlan.designDoc || '';
            const newText = originalDoc.trim() + `\n\n` + commentString;
            savePlan({ ...currentPlan, designDoc: newText });
        }

        setSelectedTextInfo(null);
        setShowSelectionPopup(null);
        setCommentText('');
        setEditInstruction('');
    };

    const handleQuickEditSubmit = async () => {
        if (!plan || !selectedTextInfo || !editInstruction.trim()) return;
        const currentPlan = plan;
        setIsInlineAiLoading(true);
        const currentInstruction = editInstruction.trim();

        const prompt = `You are a technical editor. Rewrite the following selected block of a design document or plan based on the instruction provided. Return ONLY the rewritten text without any markdown wrappers (unless they are part of the content itself), warnings, or explanations. Keep the exact format of the content.

Selected text block to modify:
"""
${selectedTextInfo.text}
"""

Instruction:
${currentInstruction}

Rewritten block:`;

        let resultText = '';

        const handleEnd = async () => {
            setIsInlineAiLoading(false);

            const replacement = resultText.trim();
            const originalText = activeTab === 'planning' ? (currentPlan.codePlanning || '') : (currentPlan.designDoc || '');
            const match = findMarkdownSubstring(originalText, selectedTextInfo.text);
            if (match) {
                const newText = originalText.substring(0, match.start) + replacement + originalText.substring(match.end);
                if (activeTab === 'planning') {
                    savePlan({ ...currentPlan, codePlanning: newText });
                } else {
                    savePlan({ ...currentPlan, designDoc: newText });
                }
            } else {
                const newText = originalText.replace(selectedTextInfo.text, replacement);
                if (activeTab === 'planning') {
                    savePlan({ ...currentPlan, codePlanning: newText });
                } else {
                    savePlan({ ...currentPlan, designDoc: newText });
                }
            }

            setSelectedTextInfo(null);
            setShowSelectionPopup(null);
            setEditInstruction('');
        };

        registerAiStreamHandlers((_, chunk) => {
            if (!chunk.startsWith('Error:')) {
                resultText += chunk;
            }
        }, handleEnd);

        window.ipcRenderer.send('ai:chat-start', {
            messages: [
                { role: 'user', content: prompt }
            ]
        });
    };

    return {
        selectedTextInfo, setSelectedTextInfo,
        showSelectionPopup, setShowSelectionPopup,
        commentText, setCommentText,
        editInstruction, setEditInstruction,
        isInlineAiLoading,
        selectionPopupRef,
        handleLeaveCommentSubmit,
        handleQuickEditSubmit,
    };
}
