import { useState, useRef, useCallback } from 'react';
import { buildPlanDisplayMessage } from '../utils/jsonParser';
import { extractFiles, extractEditedFiles } from '../helpers/chatParsing';
import { getNumericTaskId } from '../utils/taskId';
import { rLog, rError } from '../utils/rendererLog';
import { handleSlashCommand } from '../helpers/chatCommands';
import { buildPlanModePrompt } from '../helpers/planPrompts';
import type { ActivityTimelineItem } from '../helpers/chatParsing';

interface Message {
    id?: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    isPlanMode?: boolean;
    isStreaming?: boolean;
    isAgentExecution?: boolean;
    filesRead?: string[];
    planSteps?: unknown[];
    activities?: ActivityTimelineItem[];
}

interface QueuedMessage {
    content: string;
    attachedFile?: { name: string; path: string; content: string } | null;
    isPlanMode?: boolean;
    id: number;
}

export interface ChatSendingParams {
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    isLoading: boolean;
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    input: string;
    setInput: React.Dispatch<React.SetStateAction<string>>;
    attachedFile: { name: string; path: string; content: string } | null;
    setAttachedFile: React.Dispatch<React.SetStateAction<{ name: string; path: string; content: string } | null>>;
    isPlanModeActive: boolean;
    activeModel: string;
    activeProvider: string;
    effortLevel: string;
    executionMode: string;
    activeConversationId: string | null;
    setActiveConversationId: React.Dispatch<React.SetStateAction<string | null>>;
    conversations: Record<string, unknown>[];
    loadConversations: () => Promise<void>;
    refreshActiveMessages: (convId: string, forceLastMessageStreaming?: boolean) => Promise<void>;
    dbAgents: { id: number; name: string; system_prompt: string }[];
    flows: { id: number; name: string; description: string; steps: unknown; agent_id: number }[];
    activeAgent: Record<string, unknown>;
    activeWorkflow: Record<string, unknown>;
    planStartTimeRef: React.MutableRefObject<number | null>;
    timerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
    currentActivitiesRef: React.MutableRefObject<ActivityTimelineItem[]>;
    setApiError: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>;
    setCurrentlyReadingFiles: React.Dispatch<React.SetStateAction<{ path: string; timestamp: number }[]>>;
    setStreamElapsed: React.Dispatch<React.SetStateAction<number>>;
    cleanupActiveListeners: () => void;
    streamActiveRef: React.MutableRefObject<boolean>;
    activeChunkListenerRef: React.MutableRefObject<((_: unknown, chunk: string) => void) | null>;
    activeEndListenerRef: React.MutableRefObject<((...args: unknown[]) => void) | null>;
    onOpenPlan?: (taskId: number, taskTitle: string) => void;
    rootPath?: string;
}

// eslint-disable-next-line max-lines-per-function
export function useChatSending(params: ChatSendingParams) {
    const paramsRef = useRef(params);
    paramsRef.current = params;

    const lastSentMessageRef = useRef<{ content: string; attachedFile?: Record<string, unknown> | null; isPlanMode?: boolean } | null>(null);
    const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);
    const messageQueueRef = useRef<QueuedMessage[]>([]);
    messageQueueRef.current = messageQueue;

    const handleAbort = useCallback(async () => {
        const p = paramsRef.current;
        rLog('[ChatPanel:abort] handleAbort called');
        p.cleanupActiveListeners();
        try {
            window.ipcRenderer.send('ai:chat-abort');
        } catch (e) {
            rError('[ChatPanel:abort] Failed to send abort command', e);
        }
        p.setIsLoading(false);
        setMessageQueue([]);
        if (p.timerRef.current) {
            clearInterval(p.timerRef.current);
            p.timerRef.current = null;
        }
        p.setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
        p.setCurrentlyReadingFiles([]);
    }, []);

    // eslint-disable-next-line max-lines-per-function, complexity
    const handleSend = useCallback(async (queuedMsg?: QueuedMessage) => {
        const p = paramsRef.current;
        const {
            messages, setMessages, isLoading, setIsLoading,
            input, setInput, attachedFile, setAttachedFile,
            isPlanModeActive, activeModel, activeProvider,
            effortLevel, executionMode, activeConversationId,
            setActiveConversationId, loadConversations, refreshActiveMessages,
            dbAgents, flows, activeAgent, activeWorkflow,
            planStartTimeRef, timerRef, currentActivitiesRef,
            setApiError, setCurrentlyReadingFiles, setStreamElapsed,
            cleanupActiveListeners, streamActiveRef,
            activeChunkListenerRef, activeEndListenerRef, onOpenPlan, rootPath,
        } = p;

        rLog('[ChatPanel:send] handleSend, isPlanMode:', isPlanModeActive, 'isLoading:', isLoading, 'queuedMsg:', !!queuedMsg);
        if (!activeModel) {
            setMessages(prev => [...prev, { role: 'system', content: '⚠️ No active model selected.' }]);
            return;
        }

        if (isLoading && !queuedMsg) {
            setMessageQueue(prev => [...prev, { content: input, attachedFile: attachedFile ? { ...attachedFile } : null, isPlanMode: isPlanModeActive, id: Date.now() }]);
            setInput('');
            setAttachedFile(null);
            return;
        }

        const sendContent = queuedMsg ? queuedMsg.content : input;
        const sendAttachedFile = queuedMsg ? queuedMsg.attachedFile : attachedFile;
        const sendPlanModeActive = queuedMsg ? !!queuedMsg.isPlanMode : isPlanModeActive;

        if (!sendContent.trim() && !sendAttachedFile) return;
        setApiError(null);

        if (sendContent.trim().startsWith('/')) {
            if (!queuedMsg) setInput('');
            const handled = await handleSlashCommand(sendContent.trim(), setMessages);
            if (handled) return;
        }

        let finalContent = sendContent;
        if (sendAttachedFile) {
            finalContent = `[Attached File: ${sendAttachedFile.name}]\n\`\`\`\n${sendAttachedFile.content}\n\`\`\`\n\n${sendContent}`;
            if (!queuedMsg) setAttachedFile(null);
        }

        currentActivitiesRef.current = [];
        const userMsg: Message = { role: 'user', content: finalContent };
        const assistantPlaceholder: Message = { role: 'assistant', content: '', isPlanMode: sendPlanModeActive, isStreaming: true, activities: [] };
        setMessages(prev => [...prev, userMsg, assistantPlaceholder]);

        if (!queuedMsg) setInput('');
        setCurrentlyReadingFiles([]);
        setIsLoading(true);
        streamActiveRef.current = true;

        planStartTimeRef.current = Date.now();
        setStreamElapsed(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            if (planStartTimeRef.current) setStreamElapsed((Date.now() - planStartTimeRef.current) / 1000);
        }, 100);

        let currentConvId = activeConversationId;
        try {
            if (!currentConvId) {
                currentConvId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                await window.ipcRenderer.invoke('chat:create-conv', currentConvId, finalContent.trim().slice(0, 35) || 'New Chat', activeModel, activeProvider, rootPath);
                if (!streamActiveRef.current) return;
                setActiveConversationId(currentConvId);
                await loadConversations();
                if (!streamActiveRef.current) return;
            }
            await window.ipcRenderer.invoke('chat:add-message', currentConvId, 'user', finalContent);
            if (!streamActiveRef.current) return;

            let fullResponse = '';
            let fullPlanJson = '';

            // eslint-disable-next-line complexity
            const handleChunk = (_: unknown, chunk: any) => {
                if (!streamActiveRef.current) return;

                let isError = false;
                let errorType = 'UNKNOWN';
                let errorMsg = '';

                if (typeof chunk === 'object' && chunk !== null && chunk.error) {
                    isError = true;
                    errorMsg = chunk.error;
                    errorType = chunk.errorType || 'UNKNOWN';
                } else if (typeof chunk === 'string' && chunk.startsWith('Error:')) {
                    isError = true;
                    const rest = chunk.substring(6).trim();
                    errorMsg = rest;
                    const parts = rest.match(/^(TIMEOUT|AUTH|RATE_LIMIT|NETWORK|UNKNOWN):\s*(.*)/s);
                    if (parts) {
                        errorType = parts[1];
                        errorMsg = parts[2].trim();
                    }
                }

                if (isError) {
                    setApiError({ type: errorType, message: errorMsg, timestamp: Date.now(), provider: activeProvider, model: activeModel });
                    const fullErrorMsg = `⚠️ **AI ${errorType === 'TIMEOUT' ? 'Request Timeout' : errorType === 'AUTH' ? 'Auth Error' : errorType === 'RATE_LIMIT' ? 'Rate Limited' : errorType === 'NETWORK' ? 'Network Error' : 'Stream Error'}:** ${errorMsg}`;
                    setMessages(prev => { const lm = prev[prev.length - 1]; if (lm?.role === 'assistant') return [...prev.slice(0, -1), { role: 'assistant', content: fullErrorMsg, isPlanMode: isPlanModeActive, isStreaming: false, activities: lm.activities || [] }]; return prev; });
                    setIsLoading(false);
                    cleanupActiveListeners();
                    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
                    if (currentConvId) window.ipcRenderer.invoke('chat:add-message', currentConvId, 'assistant', fullErrorMsg).then(() => loadConversations()).catch(() => { });
                    return;
                }

                if (isPlanModeActive) {
                    fullPlanJson = chunk;
                    try {
                        const partial = JSON.parse(chunk);
                        const planFiles = partial.filesRead || partial.inventory?.filesRead || [];
                        if (Array.isArray(planFiles) && planFiles.length > 0) {
                            const existingPaths = new Set(currentActivitiesRef.current.filter((a: ActivityTimelineItem) => a.type === 'analyze' && a.filePath).map((a: ActivityTimelineItem) => (a.filePath as string).replace(/\\/g, '/').toLowerCase()));
                            let activitiesUpdated = false;
                            for (const fileRef of planFiles) {
                                const filePath = typeof fileRef === 'string' ? fileRef : (fileRef.path || '');
                                // eslint-disable-next-line max-depth
                                if (!filePath) continue;
                                const normPath = filePath.replace(/\\/g, '/').toLowerCase();
                                // eslint-disable-next-line max-depth
                                if (!existingPaths.has(normPath)) {
                                    existingPaths.add(normPath);
                                    currentActivitiesRef.current = [...currentActivitiesRef.current, { type: 'analyze', filePath, timestamp: Date.now() }];
                                    activitiesUpdated = true;
                                }
                            }
                            if (activitiesUpdated) {
                                setMessages(prev => { const lm = prev[prev.length - 1]; if (lm?.role === 'assistant') return [...prev.slice(0, -1), { ...lm, isStreaming: true, isPlanMode: true, activities: currentActivitiesRef.current }]; return prev; });
                            }
                        }
                    } catch { }
                    return;
                }
                fullResponse += chunk;
                const filesInResponse = extractFiles(fullResponse);
                let activitiesUpdated = false;
                if (filesInResponse.length > 0) {
                    const existingPaths = new Set(currentActivitiesRef.current.filter((a: ActivityTimelineItem) => a.type === 'analyze' && a.filePath).map((a: ActivityTimelineItem) => (a.filePath as string).replace(/\\/g, '/').toLowerCase()));
                    for (const fileRef of filesInResponse) {
                        const hashIdx = fileRef.indexOf('#');
                        const filePath = hashIdx !== -1 ? fileRef.substring(0, hashIdx) : fileRef;
                        const lineRange = hashIdx !== -1 ? fileRef.substring(hashIdx) : undefined;
                        const normPath = filePath.replace(/\\/g, '/').toLowerCase();
                        if (!existingPaths.has(normPath)) {
                            existingPaths.add(normPath);
                            currentActivitiesRef.current = [...currentActivitiesRef.current, { type: 'analyze', filePath, lineRange, timestamp: Date.now() }];
                            activitiesUpdated = true;
                        }
                    }
                }
                setMessages(prev => {
                    const lm = prev[prev.length - 1];
                    if (lm.role === 'assistant') return [...prev.slice(0, -1), { role: 'assistant', content: fullResponse, isPlanMode: isPlanModeActive, isStreaming: true, activities: activitiesUpdated ? currentActivitiesRef.current : (lm.activities || []) }];
                    return [...prev, { role: 'assistant', content: fullResponse, isPlanMode: isPlanModeActive, isStreaming: true, activities: activitiesUpdated ? currentActivitiesRef.current : [] }];
                });
            };

            // eslint-disable-next-line complexity
            const handleEnd = async (
                arg1?: any,
                arg2?: { inputTokens?: number; outputTokens?: number; cost?: number }
            ) => {
                console.log('[useChatSending:handleEnd] Entered. isPlanModeActive:', isPlanModeActive, 'arg1:', arg1, 'arg2:', arg2);
                if (!streamActiveRef.current) {
                    console.log('[useChatSending:handleEnd] Stream not active, returning');
                    return;
                }
                streamActiveRef.current = false;
                setIsLoading(false);
                cleanupActiveListeners();
                if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
                
                const usageData = isPlanModeActive ? arg2 : arg1;
                console.log('[useChatSending:handleEnd] usageData identified:', usageData);
                let responseToSave = fullResponse;
                
                if (isPlanModeActive) {
                    try {
                        const parsed = arg1 || (fullPlanJson ? JSON.parse(fullPlanJson) : null);
                        console.log('[useChatSending:handleEnd] Parsed plan:', parsed);
                        if (!parsed) throw new Error('Could not parse execution plan from stream.');
                        const activeTaskId = getNumericTaskId(currentConvId || '');
                        await window.ipcRenderer.invoke('plan:save', activeTaskId, JSON.stringify(parsed));

                        const finalDuration = planStartTimeRef.current ? ((Date.now() - planStartTimeRef.current) / 1000).toFixed(1) : '0.0';
                        const thinkingMeta = JSON.stringify({ duration: finalDuration, files: parsed.filesRead || [], stepsCount: Array.isArray(parsed.steps) ? parsed.steps.length : 0, expectedOutcome: parsed.expectedOutcome || '', confidence: parsed.confidence || 1.0, designDoc: parsed.designDoc || '', steps: (Array.isArray(parsed.steps) ? (parsed.steps as unknown[]) : []).map((s) => { const step = s as Record<string, unknown>; return { order: step.order, action: step.action, target: step.target, rationale: step.rationale, notes: step.notes, agent: step.agent }; }) });
                        const stepsCount = Array.isArray(parsed.steps) ? parsed.steps.length : 0;
                        responseToSave = `[ARCHITECTURAL_THINKING_START]${thinkingMeta}[ARCHITECTURAL_THINKING_END]**Implementation Plan Generated Successfully**\n\nA detailed roadmap with ${stepsCount} steps has been drafted for this task.\n\n[Click to Open Interactive Plan](plan://${activeTaskId})\n\n[CHAT_METADATA_START]${JSON.stringify({ duration: finalDuration, filesRead: parsed.filesRead || [], filesEdited: [], thoughts: '', activities: currentActivitiesRef.current, inputTokens: usageData?.inputTokens || 0, outputTokens: usageData?.outputTokens || 0, cost: usageData?.cost || 0 })}[CHAT_METADATA_END]`;
                        setMessages(prev => { const lm = prev[prev.length - 1]; if (lm?.role === 'assistant') return [...prev.slice(0, -1), { role: 'assistant', content: responseToSave, isPlanMode: false, isStreaming: false, filesRead: (Array.isArray(parsed.filesRead) ? parsed.filesRead : []) as string[], planSteps: (Array.isArray(parsed.steps) ? parsed.steps : []) as unknown[], activities: currentActivitiesRef.current }]; return prev; });
                        if (onOpenPlan) onOpenPlan(activeTaskId, `Task #${activeTaskId}`);
                    } catch (err) {
                        const activeTaskId = getNumericTaskId(currentConvId || '');
                        responseToSave = buildPlanDisplayMessage(activeTaskId, null, false) + `\n\n⚠️ Plan JSON could not be parsed automatically.`;
                        setMessages(prev => { const lm = prev[prev.length - 1]; if (lm?.role === 'assistant') return [...prev.slice(0, -1), { role: 'assistant', content: responseToSave, isPlanMode: false, isStreaming: false }]; return prev; });
                    }
                } else {
                    const finalDuration = planStartTimeRef.current ? ((Date.now() - planStartTimeRef.current) / 1000).toFixed(1) : '0.0';
                    let thinkingContent = '';
                    const si = fullResponse.indexOf('<think>'), ei = fullResponse.indexOf('</think>');
                    if (si !== -1) thinkingContent = (ei !== -1 && ei > si ? fullResponse.substring(si + 7, ei) : fullResponse.substring(si + 7)).trim();
                    const allFiles = extractFiles(fullResponse), edited = extractEditedFiles(fullResponse), viewed = allFiles.filter((f: string) => !edited.includes(f));
                    responseToSave = `${fullResponse}\n\n[CHAT_METADATA_START]${JSON.stringify({ duration: finalDuration, filesRead: viewed, filesEdited: edited, thoughts: thinkingContent || '', activities: currentActivitiesRef.current, inputTokens: usageData?.inputTokens || 0, outputTokens: usageData?.outputTokens || 0, cost: usageData?.cost || 0 })}[CHAT_METADATA_END]`;
                    setMessages(prev => { const lm = prev[prev.length - 1]; if (lm?.role === 'assistant') return [...prev.slice(0, -1), { role: 'assistant', content: responseToSave, isPlanMode: false, isStreaming: false, filesRead: viewed, planSteps: [] }]; return prev; });
                }
                if (currentConvId) {
                    try { await window.ipcRenderer.invoke('chat:add-message', currentConvId, 'assistant', responseToSave); await loadConversations(); await refreshActiveMessages(currentConvId); } catch (dbErr) { console.error('Failed to save assistant reply to DB:', dbErr); }
                }
                const nq = messageQueueRef.current;
                if (nq.length > 0) { setMessageQueue(prev => prev.slice(1)); setTimeout(() => handleSend(nq[0]), 100); }
            };

            cleanupActiveListeners();
            streamActiveRef.current = true;
            activeChunkListenerRef.current = handleChunk;
            activeEndListenerRef.current = handleEnd as unknown as (...args: unknown[]) => void;

            if (isPlanModeActive) {
                window.ipcRenderer.on('ai:plan-chunk', handleChunk);
                window.ipcRenderer.once('ai:plan-end', handleEnd);
            } else {
                window.ipcRenderer.on('ai:chat-chunk', handleChunk);
                window.ipcRenderer.once('ai:chat-end', handleEnd);
            }

            const activeRules = await window.ipcRenderer.invoke('db:get-rules');
            if (!streamActiveRef.current) return;
            const enabledRules = ((activeRules || []) as Record<string, unknown>[]).filter((r: Record<string, unknown>) => r.is_active === 1);
            let rulesSystemMessage: Message | null = null;
            if (enabledRules.length > 0) {
                rulesSystemMessage = { role: 'system', content: `[System Instructions / Rules to Follow]\n${enabledRules.map((r: Record<string, unknown>) => `- ${(r.name as string)}: ${(r.content as string)}`).join('\n')}` };
            }
            const systemMessages: Message[] = rulesSystemMessage ? [rulesSystemMessage] : [];
            if (activeAgent) systemMessages.push({ role: 'system', content: `[Active Agent Persona: ${activeAgent.name}]\nSystem Prompt:\n${activeAgent.system_prompt || 'You are a helpful coding assistant.'}` });
            if (activeWorkflow) {
                const stepsText = Array.isArray(activeWorkflow.steps) ? (activeWorkflow.steps as unknown[]).map((s, idx: number) => `${idx + 1}. ${String(s)}`).join('\n') : typeof activeWorkflow.steps === 'object' ? JSON.stringify(activeWorkflow.steps) : String(activeWorkflow.steps) || '';
                systemMessages.push({ role: 'system', content: `[Active Workflow Context: ${activeWorkflow.name}]\nDescription: ${activeWorkflow.description || ''}\nSteps/Structure:\n${stepsText}` });
            }
            let finalPrompt = userMsg.content;
            if (isPlanModeActive) finalPrompt = buildPlanModePrompt(userMsg.content, executionMode, dbAgents, flows);
            else if (executionMode === 'think') finalPrompt = `[Thinking Mode Active: Generate step-by-step structure] ${finalPrompt}`;
            const llmUserMsg = { ...userMsg, content: finalPrompt };
            let finalSystemMessages = [...systemMessages];
            try {
                const taskTree = await window.ipcRenderer.invoke('task:get-tree');
                if (!streamActiveRef.current) return;
                const targetTaskId = getNumericTaskId(activeConversationId || '');
                const activeTask = (taskTree as Record<string, unknown>[]).find((t: Record<string, unknown>) => t.id === targetTaskId && t.status === 'in_progress');
                if (activeTask) {
                    const budgetContext = await window.ipcRenderer.invoke('task:assemble-context', activeTask.id, messages, undefined, activeConversationId, rootPath);
                    if (!streamActiveRef.current) return;
                    if (budgetContext?.systemPrompt) finalSystemMessages = [...(rulesSystemMessage ? [rulesSystemMessage] : []), { role: 'system', content: budgetContext.systemPrompt }];
                }
            } catch (e) { console.error('Failed to assemble budget context, falling back:', e); }
            if (!streamActiveRef.current) return;
            const messagesToSend = [...finalSystemMessages, ...messages.filter((m: Message) => m.role !== 'system'), llmUserMsg];
            lastSentMessageRef.current = { content: sendContent, attachedFile: sendAttachedFile, isPlanMode: sendPlanModeActive };
            window.ipcRenderer.send(isPlanModeActive ? 'ai:plan-start' : 'ai:chat-start', {
                messages: messagesToSend, providerId: activeProvider, model: activeModel,
                effortLevel: effortLevel === 'default' ? undefined : effortLevel, thinking: executionMode === 'think'
            });
        } catch (error: unknown) {
            rError('[ChatPanel:send] ERROR:', error instanceof Error ? error.message : String(error));
            const errorMsg = error instanceof Error ? error.message : String(error);
            setApiError({ type: 'UNKNOWN', message: errorMsg, timestamp: Date.now(), provider: activeProvider, model: activeModel });
            const fullErrorMsg = `⚠️ **Error sending message:** ${errorMsg}`;
            setMessages(prev => { const lm = prev[prev.length - 1]; if (lm?.role === 'assistant') return [...prev.slice(0, -1), { role: 'assistant', content: fullErrorMsg, isStreaming: false }]; return prev; });
            setIsLoading(false);
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
            if (currentConvId) window.ipcRenderer.invoke('chat:add-message', currentConvId, 'assistant', fullErrorMsg).then(() => loadConversations()).catch(() => { });
            const nq = messageQueueRef.current;
            if (nq.length > 0) { setMessageQueue(prev => prev.slice(1)); setTimeout(() => handleSend(nq[0]), 100); }
        }
    }, []);

    return { handleSend, handleAbort, messageQueue, setMessageQueue, lastSentMessageRef };
}
