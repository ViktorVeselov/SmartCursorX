import { useState, useCallback, useRef, useEffect } from 'react';
import { getNumericTaskId } from '../utils/taskId';
import { cleanAndExtractJSONObjects, mergeExecutionPlans } from '../utils/jsonParser';
import { rLog, rWarn, rError } from '../utils/rendererLog';

interface ConvMessage {
    id?: number; role: string; content: string;
    isPlanMode?: boolean; isStreaming?: boolean; isAgentExecution?: boolean;
    filesRead?: string[]; planSteps?: unknown[]; activities?: unknown[];
}

export function useConversations(
    setMessages: React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>,
    setLoadingConversations: React.Dispatch<React.SetStateAction<Set<string>>> | undefined,
    setActiveProvider: React.Dispatch<React.SetStateAction<string>>,
    setActiveModel: React.Dispatch<React.SetStateAction<string>>,
    rootPath: string,
    activeStreamIdsRef?: React.MutableRefObject<Set<string>>
) {
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const activeConvIdRef = useRef<string | null>(null);

    useEffect(() => {
        activeConvIdRef.current = activeConversationId;
    }, [activeConversationId]);
    const [conversations, setConversations] = useState<Record<string, unknown>[]>([]);
    const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
    const [editingConvId, setEditingConvId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [conversationContextMenu, setConversationContextMenu] = useState<{ x: number; y: number; conv: Record<string, unknown> } | null>(null);
    const selectingRef = useRef(false);

    const getMsg = (msg: Record<string, unknown>): ConvMessage => msg as unknown as ConvMessage;

    const loadConversations = useCallback(async () => {
        try {
            const convs = await window.ipcRenderer.invoke('chat:get-convs', rootPath);
            setConversations(convs || []);
        } catch (err) {
            console.error('Failed to load conversations:', err);
        }
    }, [rootPath]);

    const getEnrichedMessages = useCallback(async (convId: string): Promise<Record<string, unknown>[]> => {
        const msgs = await window.ipcRenderer.invoke('chat:get-messages', convId);
        const enrichedMsgs = await Promise.all(msgs.map(async (msg: Record<string, unknown>) => {
            const m = getMsg(msg);
            if (m.role === 'assistant') {
                const isPlanningMessage = m.content.includes('[ARCHITECTURAL_THINKING_START]') ||
                    m.content.includes('**Roadmap & Design Specifications**') ||
                    m.content.trim().startsWith('{');
                if (isPlanningMessage) {
                    const taskId = getNumericTaskId(convId);
                    try {
                        const res = await window.ipcRenderer.invoke('plan:get', taskId);
                        if (res && res.plan_json) {
                            const parsed = JSON.parse(res.plan_json);
                            return {
                                ...msg,
                                filesRead: parsed.filesRead || [],
                                planSteps: parsed.steps || []
                            };
                        }
                    } catch (e) {
                        console.error('Failed to load plan files for chat display:', e);
                    }
                }
            }
            return msg;
        }));
        return enrichedMsgs;
    }, []);

    const refreshActiveMessages = useCallback(async (convId: string, forceLastMessageStreaming = false) => {
        try {
            const enriched = await getEnrichedMessages(convId);
            if (enriched && enriched.length > 0) {
                const hasActiveStream = activeStreamIdsRef?.current.has(convId) || forceLastMessageStreaming;
                if (hasActiveStream) {
                    const lastIdx = enriched.length - 1;
                    if (getMsg(enriched[lastIdx]).role === 'assistant') {
                        enriched[lastIdx] = {
                            ...enriched[lastIdx],
                            isStreaming: true
                        };
                    } else {
                        // Append a streaming assistant placeholder message
                        enriched.push({
                            role: 'assistant',
                            content: '',
                            isStreaming: true,
                            activities: []
                        });
                    }
                }
                if (convId === activeConvIdRef.current) {
                    setMessages(enriched as Record<string, unknown>[]);
                }
            } else {
                if (convId === activeConvIdRef.current) {
                    setMessages([
                        { role: 'system', content: 'You are a helpful coding assistant.' }
                    ]);
                }
            }
        } catch (err) {
            console.error('Failed to refresh active messages:', err);
        }
    }, [setMessages, getEnrichedMessages, activeStreamIdsRef]);

    // eslint-disable-next-line complexity
    const handleRollbackConversation = async (messageId: number) => {
        rLog('[ChatPanel:rollback] handleRollbackConversation called for messageId:', messageId, 'activeConversationId:', activeConversationId);
        if (!activeConversationId) {
            rWarn('[ChatPanel:rollback] No active conversation, returning');
            return;
        }
        try {
            rLog('[ChatPanel:rollback] Truncating messages from messageId:', messageId);
            const remainingMsgs = await window.ipcRenderer.invoke('chat:truncate-from-message', activeConversationId, messageId);
            rLog('[ChatPanel:rollback] Truncated, remaining messages:', remainingMsgs.length);

            let restoredPlanSaved = false;
            for (let i = remainingMsgs.length - 1; i >= 0; i--) {
                const msg = getMsg(remainingMsgs[i]);
                if (msg.role === 'assistant') {
                    let parsed: Record<string, unknown> | null = null;
                    const thinkStart = msg.content.indexOf('[ARCHITECTURAL_THINKING_START]');
                    const thinkEnd = msg.content.indexOf('[ARCHITECTURAL_THINKING_END]');
                    if (thinkStart !== -1 && thinkEnd !== -1 && thinkEnd > thinkStart) {
                        const jsonStr = msg.content.substring(thinkStart + 30, thinkEnd);
                        // eslint-disable-next-line max-depth
                        try {
                            const meta = JSON.parse(jsonStr);
                            parsed = {
                                steps: meta.steps || [],
                                designDoc: meta.designDoc || '',
                                duration: meta.duration || '0.0',
                                filesRead: meta.files || [],
                                expectedOutcome: meta.expectedOutcome || '',
                                confidence: meta.confidence || 1.0
                            };
                        } catch (e) {
                            console.error('Failed to parse thinkingMeta during rollback:', e);
                        }
                    }

                    if (!parsed) {
                        const parsedObjects = cleanAndExtractJSONObjects(msg.content);
                        // eslint-disable-next-line max-depth
                        if (parsedObjects.length > 0) {
                            parsed = mergeExecutionPlans(parsedObjects);
                        }
                    }

                    if (parsed && (parsed.steps || parsed.designDoc)) {
                        const taskId = getNumericTaskId(activeConversationId);
                        await window.ipcRenderer.invoke('plan:save', taskId, JSON.stringify(parsed));
                        restoredPlanSaved = true;
                        break;
                    }
                }
            }

            if (!restoredPlanSaved) {
                const taskId = getNumericTaskId(activeConversationId);
                const emptyPlan = {
                    steps: [],
                    designDoc: '',
                    duration: '0.0',
                    filesRead: [],
                    filesToModify: [],
                    expectedOutcome: ''
                };
                await window.ipcRenderer.invoke('plan:save', taskId, JSON.stringify(emptyPlan));
            }

            await refreshActiveMessages(activeConversationId);
            rLog('[ChatPanel:rollback] Rollback complete, dispatching plan-reloaded event');
            window.dispatchEvent(new CustomEvent('plan-reloaded'));
        } catch (err) {
            rError('[ChatPanel:rollback] FAILED:', err);
        }
    };

    const handleSelectConversation = async (convId: string) => {
        if (selectingRef.current) {
            rLog('[ChatPanel:conv] handleSelectConversation re-entrant, dropping convId:', convId);
            return;
        }
        selectingRef.current = true;
        rLog('[ChatPanel:conv] handleSelectConversation called, convId:', convId);
        try {
            await refreshActiveMessages(convId);

            const conv = conversations.find(c => c.id === convId);
            if (conv) {
                setActiveProvider(typeof conv.provider === 'string' ? conv.provider : '');
                setActiveModel(typeof conv.model === 'string' ? conv.model : '');
            }
            setActiveConversationId(convId);
        } catch (err) {
            console.error('Failed to load conversation messages:', err);
        } finally {
            selectingRef.current = false;
        }
    };

    const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
        e.stopPropagation();
        try {
            await window.ipcRenderer.invoke('chat:delete-conv', convId);
            await loadConversations();
            if (activeConversationId === convId) {
                handleNewChat();
            }
        } catch (err) {
            console.error('Failed to delete conversation:', err);
        }
    };

    const handleStartRename = (e: React.MouseEvent, conv: Record<string, unknown>) => {
        e.stopPropagation();
        setEditingConvId(typeof conv.id === 'string' ? conv.id : null);
        setEditingTitle(typeof conv.title === 'string' ? conv.title : '');
    };

    const handleSaveRename = async (convId: string) => {
        if (!editingTitle.trim()) return;
        try {
            await window.ipcRenderer.invoke('chat:update-title', convId, editingTitle.trim());
            setEditingConvId(null);
            await loadConversations();
        } catch (err) {
            console.error('Failed to update title:', err);
        }
    };

    const handleNewChat = () => {
        setActiveConversationId(null);
        setMessages([
            { role: 'system', content: 'You are a helpful coding assistant.' }
        ]);
    };

    const handleConversationContextMenu = (e: React.MouseEvent, conv: Record<string, unknown>) => {
        e.preventDefault();
        e.stopPropagation();
        setConversationContextMenu({ x: e.clientX, y: e.clientY, conv });
    };

    const handleConversationMenuAction = async (action: string) => {
        if (!conversationContextMenu) return;
        const { conv } = conversationContextMenu;

        try {
            switch (action) {
                case 'fork':
                    await handleForkConversation(typeof conv.id === 'string' ? conv.id : undefined);
                    break;
                case 'rename':
                    setEditingConvId(typeof conv.id === 'string' ? conv.id : null);
                    setEditingTitle(typeof conv.title === 'string' ? conv.title : 'Untitled Conversation');
                    break;
                case 'delete':
                    await handleDeleteConversation({ stopPropagation: () => { } } as React.MouseEvent, typeof conv.id === 'string' ? conv.id : '');
                    break;
            }
        } finally {
            setConversationContextMenu(null);
        }
    };

    const handleForkConversation = async (conversationId?: string) => {
        const sourceConversationId = conversationId || activeConversationId;
        if (!sourceConversationId) return;
        try {
            if (setLoadingConversations) {
                setLoadingConversations(prev => {
                    const next = new Set(prev);
                    next.add(sourceConversationId);
                    return next;
                });
            }
            const newConvId = await window.ipcRenderer.invoke('chat:fork-conv', sourceConversationId);
            setActiveConversationId(newConvId);
            await loadConversations();
            await refreshActiveMessages(newConvId);
        } catch (e: unknown) {
            console.error('Failed to fork chat:', e);
            alert('Failed to fork chat: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            if (setLoadingConversations) {
                setLoadingConversations(prev => {
                    const next = new Set(prev);
                    next.delete(sourceConversationId);
                    return next;
                });
            }
        }
    };

    return {
        activeConversationId,
        setActiveConversationId,
        conversations,
        setConversations,
        showHistoryDrawer,
        setShowHistoryDrawer,
        editingConvId,
        setEditingConvId,
        editingTitle,
        setEditingTitle,
        conversationContextMenu,
        setConversationContextMenu,
        loadConversations,
        refreshActiveMessages,
        handleRollbackConversation,
        handleSelectConversation,
        handleDeleteConversation,
        handleStartRename,
        handleSaveRename,
        handleNewChat,
        handleConversationContextMenu,
        handleConversationMenuAction,
        handleForkConversation,
    };
}
