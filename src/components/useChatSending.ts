import { useState, useRef, useCallback, useEffect } from 'react';
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
    chatMode: 'write' | 'ask' | 'plan';
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
    setContextUsage?: React.Dispatch<React.SetStateAction<{ estimatedInput: number; contextLength: number } | null>>;
    setFileDiffs?: React.Dispatch<React.SetStateAction<{ filePath: string; originalContent: string; proposedContent: string; addedLines: number; removedLines: number }[]>>;
    onOpenPlan?: (taskId: number, taskTitle: string) => void;
    rootPath?: string;
}

export function useChatSending(params: ChatSendingParams) {
    const paramsRef = useRef(params);
    paramsRef.current = params;

    const lastSentMessageRef = useRef<{ content: string; attachedFile?: Record<string, unknown> | null; isPlanMode?: boolean } | null>(null);
    const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);
    const messageQueueRef = useRef<QueuedMessage[]>([]);
    messageQueueRef.current = messageQueue;

    const activeStreamIdsRef = useRef<Set<string>>(new Set());
    const activeStreamsRef = useRef<Map<string, {
        handleChunk: (chunk: any) => void;
        handleEnd: (...args: any[]) => void;
    }>>(new Map());

    useEffect(() => {
        const onChunk = (_: unknown, payload: any) => {
            const convId = payload?.convId;
            if (!convId) return;
            const stream = activeStreamsRef.current.get(convId);
            if (stream) stream.handleChunk(payload.chunk);
        };
        const onEnd = (_: unknown, payload: any) => {
            const convId = payload?.convId;
            if (!convId) return;
            const stream = activeStreamsRef.current.get(convId);
            if (stream) {
                stream.handleEnd(payload);
                activeStreamsRef.current.delete(convId);
            }
        };
        const onPlanChunk = (_: unknown, payload: any) => {
            const convId = payload?.convId;
            if (!convId) return;
            const stream = activeStreamsRef.current.get(convId);
            if (stream) stream.handleChunk(payload.chunk);
        };
        const onPlanEnd = (_: unknown, payload: any) => {
            const convId = payload?.convId;
            if (!convId) return;
            const stream = activeStreamsRef.current.get(convId);
            if (stream) {
                stream.handleEnd(payload.plan, payload.usage);
                activeStreamsRef.current.delete(convId);
            }
        };
        window.ipcRenderer.on('ai:chat-chunk', onChunk);
        window.ipcRenderer.on('ai:chat-end', onEnd);
        window.ipcRenderer.on('ai:plan-chunk', onPlanChunk);
        window.ipcRenderer.on('ai:plan-end', onPlanEnd);
        return () => {
            window.ipcRenderer.off('ai:chat-chunk', onChunk);
            window.ipcRenderer.off('ai:chat-end', onEnd);
            window.ipcRenderer.off('ai:plan-chunk', onPlanChunk);
            window.ipcRenderer.off('ai:plan-end', onPlanEnd);
        };
    }, []);

    const handleAbort = useCallback(async (convId?: string | unknown) => {
        const p = paramsRef.current;
        const targetConvId = typeof convId === 'string' ? convId : undefined;
        rLog('[ChatPanel:abort] handleAbort called' + (targetConvId ? ' convId:' + targetConvId : ' (all)'));

        if (targetConvId) {
            activeStreamsRef.current.delete(targetConvId);
            activeStreamIdsRef.current.delete(targetConvId);
            try {
                window.ipcRenderer.send('ai:chat-abort', targetConvId);
            } catch (e) {
                rError('[ChatPanel:abort] Failed to send abort command', e);
            }
            if (p.activeConversationId === targetConvId) {
                p.setIsLoading(false);
                p.setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
                p.setCurrentlyReadingFiles([]);
            }
        } else {
            activeStreamsRef.current.clear();
            activeStreamIdsRef.current.clear();
            try {
                window.ipcRenderer.send('ai:chat-abort');
            } catch (e) {
                rError('[ChatPanel:abort] Failed to send abort command', e);
            }
            p.setIsLoading(false);
            p.setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
            p.setCurrentlyReadingFiles([]);
        }
        setMessageQueue([]);
        if (p.timerRef.current) {
            clearInterval(p.timerRef.current);
            p.timerRef.current = null;
        }
    }, []);

    // eslint-disable-next-line max-lines-per-function, complexity
    const handleSend = useCallback(async (queuedMsg?: QueuedMessage) => {
        const p = paramsRef.current;
        const {
            messages, setMessages, isLoading, setIsLoading,
            input, setInput, attachedFile, setAttachedFile,
            chatMode, activeModel, activeProvider,
            effortLevel, executionMode, activeConversationId,
            setActiveConversationId, loadConversations, refreshActiveMessages,
            dbAgents, flows, activeAgent, activeWorkflow,
            planStartTimeRef, timerRef, currentActivitiesRef,
            setApiError, setCurrentlyReadingFiles, setStreamElapsed,
            onOpenPlan, rootPath,
        } = p;

        const isPlanModeActive = chatMode === 'plan';
        rLog('[ChatPanel:send] handleSend, chatMode:', chatMode, 'isLoading:', isLoading, 'queuedMsg:', !!queuedMsg);
        if (!activeModel) {
            setMessages(prev => [...prev, { role: 'system', content: '⚠️ No active model selected.' }]);
            return;
        }

        if (activeConversationId && activeStreamIdsRef.current.has(activeConversationId) && !queuedMsg) {
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

        planStartTimeRef.current = Date.now();
        setStreamElapsed(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            if (planStartTimeRef.current) setStreamElapsed((Date.now() - planStartTimeRef.current) / 1000);
        }, 100);

        let currentConvId = activeConversationId;
        let streamConvId = currentConvId || '';
        const isNewConversation = !currentConvId;
        let fullResponse = '';
        let fullPlanJson = '';

        if (!currentConvId) {
            currentConvId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            streamConvId = currentConvId;
        }

        const handleChunk = (chunk: any) => {
            const cp = paramsRef.current;
            if (!activeStreamsRef.current.has(streamConvId)) return;
            const isActiveConv = cp.activeConversationId === streamConvId;

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
                cp.setApiError({ type: errorType, message: errorMsg, timestamp: Date.now(), provider: cp.activeProvider, model: cp.activeModel });
                const fullErrorMsg = `⚠️ **AI ${errorType === 'TIMEOUT' ? 'Request Timeout' : errorType === 'AUTH' ? 'Auth Error' : errorType === 'RATE_LIMIT' ? 'Rate Limited' : errorType === 'NETWORK' ? 'Network Error' : 'Stream Error'}:** ${errorMsg}`;
                if (isActiveConv) {
                    cp.setMessages(prev => { const lm = prev[prev.length - 1]; if (lm?.role === 'assistant') return [...prev.slice(0, -1), { role: 'assistant', content: fullErrorMsg, isPlanMode: sendPlanModeActive, isStreaming: false, activities: lm.activities || [] }]; return prev; });
                }
                activeStreamIdsRef.current.delete(streamConvId);
                if (activeStreamIdsRef.current.size === 0) {
                    cp.setIsLoading(false);
                }
                activeStreamsRef.current.delete(streamConvId);
                if (timerRef.current && activeStreamIdsRef.current.size === 0) { clearInterval(timerRef.current); timerRef.current = null; }
                if (currentConvId) cp.setCurrentlyReadingFiles([]);
                return;
            }

            if (sendPlanModeActive) {
                fullPlanJson = chunk;
                try {
                    const partial = JSON.parse(chunk);
                    if (isActiveConv) {
                        const planFiles = partial.filesRead || partial.inventory?.filesRead || [];
                        if (Array.isArray(planFiles) && planFiles.length > 0) {
                            const existingPaths = new Set(currentActivitiesRef.current.filter((a: ActivityTimelineItem) => a.type === 'analyze' && a.filePath).map((a: ActivityTimelineItem) => (a.filePath as string).replace(/\\/g, '/').toLowerCase()));
                            let activitiesUpdated = false;
                            for (const fileRef of planFiles) {
                                const filePath = typeof fileRef === 'string' ? fileRef : (fileRef.path || '');
                                if (!filePath) continue;
                                const normPath = filePath.replace(/\\/g, '/').toLowerCase();
                                if (!existingPaths.has(normPath)) {
                                    existingPaths.add(normPath);
                                    currentActivitiesRef.current = [...currentActivitiesRef.current, { type: 'analyze', filePath, timestamp: Date.now() }];
                                    activitiesUpdated = true;
                                }
                            }
                            if (activitiesUpdated) {
                                cp.setMessages(prev => { const lm = prev[prev.length - 1]; if (lm?.role === 'assistant') return [...prev.slice(0, -1), { ...lm, isStreaming: true, isPlanMode: true, activities: currentActivitiesRef.current }]; return prev; });
                            }
                        }
                    }
                } catch { }
                return;
            }
            fullResponse += chunk;
            if (isActiveConv) {
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
                cp.setMessages(prev => {
                    const lm = prev[prev.length - 1];
                    if (lm.role === 'assistant') return [...prev.slice(0, -1), { role: 'assistant', content: fullResponse, isPlanMode: sendPlanModeActive, isStreaming: true, activities: activitiesUpdated ? currentActivitiesRef.current : (lm.activities || []) }];
                    return [...prev, { role: 'assistant', content: fullResponse, isPlanMode: sendPlanModeActive, isStreaming: true, activities: activitiesUpdated ? currentActivitiesRef.current : [] }];
                });
            }
        };

        // eslint-disable-next-line complexity
        const handleEnd = async (
            arg1?: any,
            arg2?: { inputTokens?: number; outputTokens?: number; cost?: number }
        ) => {
            const cp = paramsRef.current;
            if (!activeStreamsRef.current.has(streamConvId)) {
                console.log('[useChatSending:handleEnd] Stream not active, returning');
                return;
            }
            const isActiveConv = cp.activeConversationId === streamConvId;
            activeStreamsRef.current.delete(streamConvId);
            activeStreamIdsRef.current.delete(streamConvId);

            if (activeStreamIdsRef.current.size === 0) {
                cp.setIsLoading(false);
                if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
            }

            if (!sendPlanModeActive && arg1 && typeof arg1.estimatedInput === 'number' && typeof arg1.contextLength === 'number') {
                if (isActiveConv) cp.setContextUsage?.({ estimatedInput: arg1.estimatedInput, contextLength: arg1.contextLength });
            }

            if (!sendPlanModeActive && arg1 && Array.isArray(arg1.fileDiffs) && arg1.fileDiffs.length > 0) {
                if (isActiveConv) cp.setFileDiffs?.(arg1.fileDiffs);
            }

            const usageData = sendPlanModeActive ? arg2 : arg1;
            let responseToSave = fullResponse;

            if (sendPlanModeActive) {
                try {
                    const parsed = arg1 || (fullPlanJson ? JSON.parse(fullPlanJson) : null);
                    if (!parsed) throw new Error('Could not parse execution plan from stream.');
                    const activeTaskId = getNumericTaskId(currentConvId || '');
                    await window.ipcRenderer.invoke('plan:save', activeTaskId, JSON.stringify(parsed));

                    const finalDuration = planStartTimeRef.current ? ((Date.now() - planStartTimeRef.current) / 1000).toFixed(1) : '0.0';
                    const thinkingMeta = JSON.stringify({ duration: finalDuration, files: parsed.filesRead || [], stepsCount: Array.isArray(parsed.steps) ? parsed.steps.length : 0, expectedOutcome: parsed.expectedOutcome || '', confidence: parsed.confidence || 1.0, designDoc: parsed.designDoc || '', steps: (Array.isArray(parsed.steps) ? (parsed.steps as unknown[]) : []).map((s) => { const step = s as Record<string, unknown>; return { order: step.order, action: step.action, target: step.target, rationale: step.rationale, notes: step.notes, agent: step.agent }; }) });
                    const stepsCount = Array.isArray(parsed.steps) ? parsed.steps.length : 0;
                    responseToSave = `[ARCHITECTURAL_THINKING_START]${thinkingMeta}[ARCHITECTURAL_THINKING_END]**Implementation Plan Generated Successfully**\n\nA detailed roadmap with ${stepsCount} steps has been drafted for this task.\n\n[Click to Open Interactive Plan](plan://${activeTaskId})\n\n[CHAT_METADATA_START]${JSON.stringify({ duration: finalDuration, filesRead: parsed.filesRead || [], filesEdited: [], thoughts: '', activities: currentActivitiesRef.current, inputTokens: usageData?.inputTokens || 0, outputTokens: usageData?.outputTokens || 0, cost: usageData?.cost || 0 })}[CHAT_METADATA_END]`;
                    if (isActiveConv) {
                        cp.setMessages(prev => { const lm = prev[prev.length - 1]; if (lm?.role === 'assistant') return [...prev.slice(0, -1), { role: 'assistant', content: responseToSave, isPlanMode: false, isStreaming: false, filesRead: (Array.isArray(parsed.filesRead) ? parsed.filesRead : []) as string[], planSteps: (Array.isArray(parsed.steps) ? parsed.steps : []) as unknown[], activities: currentActivitiesRef.current }]; return prev; });
                    }
                    if (isActiveConv && onOpenPlan) onOpenPlan(activeTaskId, `Task #${activeTaskId}`);
                } catch (err) {
                    const activeTaskId = getNumericTaskId(currentConvId || '');
                    responseToSave = buildPlanDisplayMessage(activeTaskId, null, false) + `\n\n⚠️ Plan JSON could not be parsed automatically.`;
                    if (isActiveConv) {
                        cp.setMessages(prev => { const lm = prev[prev.length - 1]; if (lm?.role === 'assistant') return [...prev.slice(0, -1), { role: 'assistant', content: responseToSave, isPlanMode: false, isStreaming: false }]; return prev; });
                    }
                }
            } else {
                const finalDuration = planStartTimeRef.current ? ((Date.now() - planStartTimeRef.current) / 1000).toFixed(1) : '0.0';
                let thinkingContent = '';
                const si = fullResponse.indexOf('<think>'), ei = fullResponse.indexOf('</think>');
                if (si !== -1) thinkingContent = (ei !== -1 && ei > si ? fullResponse.substring(si + 7, ei) : fullResponse.substring(si + 7)).trim();
                const allFiles = extractFiles(fullResponse), edited = extractEditedFiles(fullResponse), viewed = allFiles.filter((f: string) => !edited.includes(f));
                responseToSave = `${fullResponse}\n\n[CHAT_METADATA_START]${JSON.stringify({ duration: finalDuration, filesRead: viewed, filesEdited: edited, thoughts: thinkingContent || '', activities: currentActivitiesRef.current, inputTokens: usageData?.inputTokens || 0, outputTokens: usageData?.outputTokens || 0, cost: usageData?.cost || 0 })}[CHAT_METADATA_END]`;
                if (isActiveConv) {
                    cp.setMessages(prev => { const lm = prev[prev.length - 1]; if (lm?.role === 'assistant') return [...prev.slice(0, -1), { role: 'assistant', content: responseToSave, isPlanMode: false, isStreaming: false, filesRead: viewed, planSteps: [] }]; return prev; });
                }
            }
            if (currentConvId) {
                try {
                    await window.ipcRenderer.invoke('chat:add-message', currentConvId, 'assistant', responseToSave);
                    await loadConversations();
                    if (isActiveConv) await refreshActiveMessages(currentConvId);
                } catch (dbErr) { console.error('Failed to save assistant reply to DB:', dbErr); }
            }
            const nq = messageQueueRef.current;
            if (nq.length > 0) { setMessageQueue(prev => prev.slice(1)); setTimeout(() => handleSend(nq[0]), 100); }
        };

        activeStreamsRef.current.set(streamConvId, { handleChunk, handleEnd });
        activeStreamIdsRef.current.add(streamConvId);

        try {
            if (isNewConversation) {
                await window.ipcRenderer.invoke('chat:create-conv', currentConvId, finalContent.trim().slice(0, 35) || 'New Chat', activeModel, activeProvider, rootPath);
                if (!activeStreamsRef.current.has(streamConvId)) return;
                setActiveConversationId(currentConvId);
                await loadConversations();
                if (!activeStreamsRef.current.has(streamConvId)) return;
            }
            await window.ipcRenderer.invoke('chat:add-message', currentConvId, 'user', finalContent);
            if (!activeStreamsRef.current.has(streamConvId)) return;


            const activeRules = await window.ipcRenderer.invoke('db:get-rules');
            if (!activeStreamsRef.current.has(streamConvId)) return;
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
            if (sendPlanModeActive) finalPrompt = buildPlanModePrompt(userMsg.content, executionMode, dbAgents, flows);
            else if (executionMode === 'think') finalPrompt = `[Thinking Mode Active: Generate step-by-step structure] ${finalPrompt}`;
            const llmUserMsg = { ...userMsg, content: finalPrompt };
            let finalSystemMessages = [...systemMessages];
            try {
                const taskTree = await window.ipcRenderer.invoke('task:get-tree');
                if (!activeStreamsRef.current.has(streamConvId)) return;
                const targetTaskId = getNumericTaskId(currentConvId || '');
                const activeTask = (taskTree as Record<string, unknown>[]).find((t: Record<string, unknown>) => t.id === targetTaskId && t.status === 'in_progress');
                if (activeTask) {
                    const budgetContext = await window.ipcRenderer.invoke('task:assemble-context', activeTask.id, messages, undefined, currentConvId, rootPath);
                    if (!activeStreamsRef.current.has(streamConvId)) return;
                    if (budgetContext?.systemPrompt) finalSystemMessages = [...(rulesSystemMessage ? [rulesSystemMessage] : []), { role: 'system', content: budgetContext.systemPrompt }];
                }
            } catch (e) { console.error('Failed to assemble budget context, falling back:', e); }
            if (!activeStreamsRef.current.has(streamConvId)) return;
            const messagesToSend = [...finalSystemMessages, ...messages.filter((m: Message) => m.role !== 'system'), llmUserMsg];
            lastSentMessageRef.current = { content: sendContent, attachedFile: sendAttachedFile, isPlanMode: sendPlanModeActive };
            window.ipcRenderer.send(sendPlanModeActive ? 'ai:plan-start' : 'ai:chat-start', {
                messages: messagesToSend, providerId: activeProvider, model: activeModel,
                effortLevel: effortLevel === 'default' ? undefined : effortLevel, thinking: executionMode === 'think',
                rootPath: rootPath || '',
                chatMode,
                convId: streamConvId,
            });
        } catch (error: unknown) {
            if (streamConvId) {
                activeStreamsRef.current.delete(streamConvId);
                activeStreamIdsRef.current.delete(streamConvId);
            }
            rError('[ChatPanel:send] ERROR:', error instanceof Error ? error.message : String(error));
            const errorMsg = error instanceof Error ? error.message : String(error);
            setApiError({ type: 'UNKNOWN', message: errorMsg, timestamp: Date.now(), provider: activeProvider, model: activeModel });
            const fullErrorMsg = `⚠️ **Error sending message:** ${errorMsg}`;
            setMessages(prev => { const lm = prev[prev.length - 1]; if (lm?.role === 'assistant') return [...prev.slice(0, -1), { role: 'assistant', content: fullErrorMsg, isStreaming: false }]; return prev; });
            if (activeStreamIdsRef.current.size === 0) {
                setIsLoading(false);
                if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
            }
            if (currentConvId) window.ipcRenderer.invoke('chat:add-message', currentConvId, 'assistant', fullErrorMsg).then(() => loadConversations()).catch(() => { });
            const nq = messageQueueRef.current;
            if (nq.length > 0) { setMessageQueue(prev => prev.slice(1)); setTimeout(() => handleSend(nq[0]), 100); }
        }
    }, []);

    return { handleSend, handleAbort, messageQueue, setMessageQueue, lastSentMessageRef };
}
