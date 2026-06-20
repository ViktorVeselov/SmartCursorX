import { useEffect, useRef } from 'react';

// eslint-disable-next-line max-lines-per-function
export function usePlanSync(
    activeConversationIdRef: React.MutableRefObject<string | null>,
    setMessages: React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>,
    setIsPlanModifying: React.Dispatch<React.SetStateAction<boolean>>,
    setStreamElapsed: React.Dispatch<React.SetStateAction<number>>,
    setCurrentlyReadingFiles: React.Dispatch<React.SetStateAction<{ path: string; timestamp: number }[]>>,
    currentActivitiesRef: React.MutableRefObject<Record<string, unknown>[]>,
    refreshActiveMessages: (convId: string, forceLastMessageStreaming?: boolean) => Promise<void>
) {
    const planStartTimeRef = useRef<number | null>(null);
    const planModifyAssistantMessageIdRef = useRef<number | null>(null);
    const planModifyInFlightRef = useRef(false);
    const planModifyConvIdRef = useRef<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // eslint-disable-next-line max-lines-per-function
    useEffect(() => {
        const handlePlanModifyStarted = async (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.silent) return;

            const instructions = customEvent.detail.instructions;
            const convId = activeConversationIdRef.current;

            if (planModifyInFlightRef.current || planModifyAssistantMessageIdRef.current !== null) {
                return;
            }

            if (convId) {
                const userContent = `**Plan Modification Request**:\n> ${instructions}`;
                try {
                    await window.ipcRenderer.invoke('chat:add-message', convId, 'user', userContent);

                    currentActivitiesRef.current = [];
                    setCurrentlyReadingFiles([]);
                    setIsPlanModifying(true);
                    planStartTimeRef.current = Date.now();
                    setStreamElapsed(0);
                    if (timerRef.current) {
                        clearInterval(timerRef.current);
                    }
                    timerRef.current = setInterval(() => {
                        if (planStartTimeRef.current) {
                            setStreamElapsed((Date.now() - planStartTimeRef.current) / 1000);
                        }
                    }, 100);

                    const assistantContent = `**AI is updating the implementation plan...**\nRunning background optimization. Please wait.`;
                    const tempMessageId = await window.ipcRenderer.invoke('chat:add-message', convId, 'assistant', assistantContent);
                    planModifyAssistantMessageIdRef.current = tempMessageId !== undefined && tempMessageId !== null ? Number(tempMessageId) : null;
                    planModifyConvIdRef.current = convId;
                    planModifyInFlightRef.current = true;
                    await refreshActiveMessages(convId, true);
                } catch (err) {
                    console.error('Failed to document plan modification start:', err);
                }
            }
        };

        const handlePlanModifyEnded = async (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.silent) return;

            const success = customEvent.detail.success;
            const description = customEvent.detail.description;
            const errorMessage = customEvent.detail.errorMessage || 'The model did not return valid plan JSON.';
            const convId = planModifyConvIdRef.current;
            const trackedMessageId = planModifyAssistantMessageIdRef.current;

            if (!planModifyInFlightRef.current && trackedMessageId === null) {
                return;
            }

            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            setIsPlanModifying(false);
            planModifyInFlightRef.current = false;
            planModifyAssistantMessageIdRef.current = null;
            planModifyConvIdRef.current = null;

            if (convId && trackedMessageId !== null) {
                try {
                    const finalDuration = planStartTimeRef.current
                        ? ((Date.now() - planStartTimeRef.current) / 1000).toFixed(1)
                        : '0.0';

                    const statusContent = success
                        ? `**Plan Modified Successfully** (Took ${finalDuration}s)\n${description}\n\nRoadmap & Design Specifications updated in [Design Doc (implementation_plan.md)](file:///implementation_plan.md) successfully. Inspect the detailed plan in the tabs above.`
                        : `**Plan Modification Failed** (Took ${finalDuration}s)\n${errorMessage}`;

                    const updated = await window.ipcRenderer.invoke(
                        'chat:update-message',
                        convId,
                        trackedMessageId,
                        statusContent
                    );
                    if (!updated) {
                        console.warn('Failed to update plan modification status message; skipping duplicate insert.');
                    }

                    await refreshActiveMessages(convId, false);
                } catch (err) {
                    console.error('Failed to document plan modification end:', err);
                }
            }
        };

        window.addEventListener('plan:modify-started', handlePlanModifyStarted);
        window.addEventListener('plan:modify-ended', handlePlanModifyEnded);

        return () => {
            window.removeEventListener('plan:modify-started', handlePlanModifyStarted);
            window.removeEventListener('plan:modify-ended', handlePlanModifyEnded);
        };
    }, [activeConversationIdRef, setMessages, setIsPlanModifying, setStreamElapsed, setCurrentlyReadingFiles, currentActivitiesRef, refreshActiveMessages]);

    return { planStartTimeRef, timerRef };
}
