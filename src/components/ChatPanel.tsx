import { useState, useEffect, useRef } from 'react';
import { runGraphWorkflow } from '../helpers/workflowRunner';
import { getNumericTaskId } from '../utils/taskId';
import { isBinaryFile } from '../utils/fileTypes';
import { ApiErrorBanner, type ApiErrorInfo } from './ApiErrorBanner';
import { ActiveBadges } from './ActiveBadges';
import { ContextMenu } from './ContextMenu';
import { ChatSettingsPanel } from './ChatSettingsPanel';
import { ChatHistorySidebar } from './ChatHistorySidebar';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInputArea } from './ChatInputArea';
import { ChangeReviewBanner } from './ChangeReviewBanner';
import { useActivityTracking } from './useActivityTracking';
import { usePlanSync } from './usePlanSync';
import { useAgentHandler } from './useAgentHandler';
import { useConversations } from './useConversations';
import { useChatSending } from './useChatSending';
import { DiffEditor } from '@monaco-editor/react';

import { checkArgs } from '../helpers/invariant';
import type { ActivityTimelineItem } from '../helpers/chatParsing';

export interface AppAgent { id: number; name: string; system_prompt?: string; }
export interface AppFlow { id: number; name: string; description?: string; steps?: unknown; }
export interface AppExecutionContext { agent: AppAgent; flow: AppFlow; }
interface ChatPanelProps {
    isOpen: boolean; onClose: () => void; onApplyCode?: (code: string) => void;
    executionContext?: AppExecutionContext | null; settingsSavedTrigger?: number;
    onOpenPlan?: (taskId: number, taskTitle: string) => void;
    onActiveTaskIdChange?: (taskId: number | null) => void;
    rootPath?: string;
    pendingReview?: { taskId: number; fileCount: number; addedLines: number; removedLines: number } | null;
    pendingReviewApplying?: boolean;
    onOpenReview?: (taskId: number) => void;
    onAcceptAllChanges?: () => void;
    onRejectAllChanges?: () => void;
}
export type { ActivityTimelineItem } from '../helpers/chatParsing';

export interface Message {
    id?: number; role: 'user' | 'assistant' | 'system'; content: string;
    isPlanMode?: boolean; isStreaming?: boolean; isAgentExecution?: boolean;
    filesRead?: string[]; planSteps?: unknown[]; activities?: ActivityTimelineItem[];
}

const getChatTokenDetails = (
    messages: Message[],
    currentInput: string,
    attachedFile: { content: string } | null
) => {
    let baselineTokens = 0;
    let baselineIndex = -1;
    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const breakdown: {
        inputTokens: number;
        outputTokens: number;
        cost: number;
        duration?: string;
    }[] = [];

    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'assistant' && msg.content) {
            const startIdx = msg.content.indexOf('[CHAT_METADATA_START]');
            const endIdx = msg.content.indexOf('[CHAT_METADATA_END]');
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                try {
                    const metaStr = msg.content.substring(startIdx + '[CHAT_METADATA_START]'.length, endIdx);
                    const meta = JSON.parse(metaStr);

                    // Accumulate cost
                    const cost = typeof meta.cost === 'number' ? meta.cost : 0;
                    totalCost += cost;

                    // Accumulate total input and output tokens
                    const inTokens = typeof meta.inputTokens === 'number' ? meta.inputTokens : 0;
                    const outTokens = typeof meta.outputTokens === 'number' ? meta.outputTokens : 0;
                    totalInputTokens += inTokens;
                    totalOutputTokens += outTokens;

                    // Set baseline if not already found
                    if (baselineIndex === -1) {
                        baselineTokens = inTokens + outTokens;
                        baselineIndex = i;
                    }
                } catch (e) {
                    console.error('Failed to parse chat metadata from message', e);
                }
            }
        }
    }

    for (const msg of messages) {
        if (msg.role === 'assistant' && msg.content) {
            const startIdx = msg.content.indexOf('[CHAT_METADATA_START]');
            const endIdx = msg.content.indexOf('[CHAT_METADATA_END]');
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                try {
                    const metaStr = msg.content.substring(startIdx + '[CHAT_METADATA_START]'.length, endIdx);
                    const meta = JSON.parse(metaStr);
                    breakdown.push({
                        inputTokens: typeof meta.inputTokens === 'number' ? meta.inputTokens : 0,
                        outputTokens: typeof meta.outputTokens === 'number' ? meta.outputTokens : 0,
                        cost: typeof meta.cost === 'number' ? meta.cost : 0,
                        duration: meta.duration
                    });
                } catch (e) {
                    console.error('Failed to parse chat metadata for breakdown:', e);
                }
            }
        }
    }

    let historyTokens = 0;
    if (baselineIndex !== -1) {
        let postBaselineChars = 0;
        for (let i = baselineIndex + 1; i < messages.length; i++) {
            postBaselineChars += (messages[i].content || '').length;
        }
        historyTokens = baselineTokens + Math.ceil(postBaselineChars / 4);
    } else {
        let totalChars = 0;
        for (const msg of messages) {
            totalChars += (msg.content || '').length;
        }
        historyTokens = Math.ceil(totalChars / 4);
    }

    const draftTokens = Math.ceil(currentInput.length / 4);
    const fileTokens = attachedFile && attachedFile.content ? Math.ceil(attachedFile.content.length / 4) : 0;
    const totalTokens = historyTokens + draftTokens + fileTokens;

    return {
        historyTokens,
        draftTokens,
        fileTokens,
        totalTokens,
        totalCost,
        totalInputTokens,
        totalOutputTokens,
        breakdown
    };
};

function ChatFileDiffCard({ diff, onDismiss }: { diff: { filePath: string; originalContent: string; proposedContent: string; addedLines: number; removedLines: number }; onDismiss: () => void }) {
    const [collapsed, setCollapsed] = useState(true);
    const handleReject = async () => {
        try {
            await window.ipcRenderer.invoke('changes:discard-file', diff.filePath, 'accepted');
            onDismiss();
        } catch (e) {
            console.error('Failed to reject changes:', e);
            onDismiss();
        }
    };
    const handleAccept = async () => {
        try {
            await window.ipcRenderer.invoke('changes:stage-file', diff.filePath, 'accepted');
            onDismiss();
        } catch (e) {
            console.error('Failed to accept changes:', e);
            onDismiss();
        }
    };
    const ext = diff.filePath.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = { ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', py: 'python', rs: 'rust', json: 'json', md: 'markdown', css: 'css', html: 'html', yaml: 'yaml', yml: 'yaml', sql: 'sql', sh: 'shell', bash: 'shell' };
    const language = langMap[ext] || 'plaintext';
    return (
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', fontSize: 11 }}>
                <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, fontSize: 10 }}>{collapsed ? '▶' : '▼'}</button>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{diff.filePath}</span>
                <span style={{ color: '#34d399', fontWeight: 500 }}>+{diff.addedLines}</span>
                <span style={{ color: '#f43f5e', fontWeight: 500 }}>-{diff.removedLines}</span>
                <span style={{ flex: 1 }} />
                <button onClick={handleAccept} style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', cursor: 'pointer', fontSize: 10, padding: '2px 8px', borderRadius: 4 }}>Accept</button>
                <button onClick={handleReject} style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: '#f43f5e', cursor: 'pointer', fontSize: 10, padding: '2px 8px', borderRadius: 4 }}>Reject</button>
            </div>
            {!collapsed && (
                <div style={{ height: 300, borderTop: '1px solid var(--border-subtle)' }}>
                    <DiffEditor height="100%" language={language} original={diff.originalContent} modified={diff.proposedContent} theme="vs-dark" options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true }} />
                </div>
            )}
        </div>
    );
}

export function ChatPanel({ isOpen, onClose, onApplyCode, executionContext, settingsSavedTrigger, onOpenPlan, onActiveTaskIdChange, rootPath = '', pendingReview, pendingReviewApplying, onOpenReview, onAcceptAllChanges, onRejectAllChanges }: ChatPanelProps) {
    const [messages, setMessages] = useState<Message[]>([{ role: 'system', content: 'You are a helpful coding assistant.' }]);
    const [apiError, setApiError] = useState<{ type: string; message: string; timestamp: number; provider?: string; model?: string } | null>(null);
    const [streamElapsed, setStreamElapsed] = useState(0);
    const [currentlyReadingFiles, setCurrentlyReadingFiles] = useState<{ path: string; timestamp: number }[]>([]);
    const [isPlanModifying, setIsPlanModifying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [input, setInput] = useState('');
    const [attachedFile, setAttachedFile] = useState<{ name: string; path: string; content: string } | null>(null);
    const [executionMode, setExecutionMode] = useState<'fast' | 'think'>('fast');
    const [effortLevel, setEffortLevel] = useState<'default' | 'low' | 'medium' | 'high'>('default');
    const [showPlusMenu, setShowPlusMenu] = useState(false);
    const [showAgentSubmenu, setShowAgentSubmenu] = useState(false);
    const [showWorkflowSubmenu, setShowWorkflowSubmenu] = useState(false);
    const [chatMode, setChatMode] = useState<'write' | 'ask' | 'plan'>('write');
    const [dbAgents, setDbAgents] = useState<{ id: number; name: string; system_prompt: string }[]>([]);
    const [activeAgent, setActiveAgent] = useState<AppAgent | null>(null);
    const [activeWorkflow, setActiveWorkflow] = useState<AppFlow | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [tempApiKey, setTempApiKey] = useState('');
    const [tempGithubToken, setTempGithubToken] = useState('');
    const [credentialStatuses, setCredentialStatuses] = useState<Record<string, { hasKey: boolean; encryptionAvailable: boolean }>>({});
    const [activeProvider, setActiveProvider] = useState('openai');
    const [activeModel, setActiveModel] = useState('gpt-4o');
    const [modelLimit, setModelLimit] = useState(128000);
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [inlineModelInput, setInlineModelInput] = useState('');
    const [customModels, setCustomModels] = useState<Record<string, unknown>[]>([]);
    const [contextUsage, setContextUsage] = useState<{ estimatedInput: number; contextLength: number } | null>(null);
    const [chatFileDiffs, setChatFileDiffs] = useState<{ filePath: string; originalContent: string; proposedContent: string; addedLines: number; removedLines: number }[]>([]);
    const lastProgressPhaseRef = useRef<string>('');
    const [panelWidth, setPanelWidth] = useState(() => { const s = localStorage.getItem('chatPanelWidth'); return s ? parseInt(s, 10) : 400; });
    const [_flows, _setFlows] = useState<{ id: number; name: string; description: string; steps: unknown; agent_id: number }[]>([]);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const lastMessageCountRef = useRef(messages.length);
    const resizingRef = useRef(false);
    const activeConversationIdRef = useRef<string | null>(null);

    const scrollToBottom = (force = false) => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        if (force || isNearBottom) {
            container.scrollTop = container.scrollHeight;
        }
    };
    const startResize = () => { resizingRef.current = true; document.body.style.cursor = 'ew-resize'; document.body.style.userSelect = 'none'; };
    const canModelThink = (modelName: string) => modelName.startsWith('o1-') || modelName.startsWith('o3-') || modelName.includes('deepseek-r1') || modelName.includes('reasoner') || modelName.includes('gemini') || modelName.includes('claude');
    const currentModelCanThink = activeModel ? canModelThink(activeModel) || customModels.some((cm: Record<string, unknown>) => cm.model_name === activeModel && cm.has_thinking === 1) : false;

    const handleFileUpload = async () => {
        try {
            const filePath = await window.ipcRenderer.invoke('dialog-open-file');
            if (!filePath) return;
            if (isBinaryFile(filePath)) {
                setMessages(prev => [...prev, { role: 'system', content: `⚠️ **Cannot read "${filePath.split(/[/\\]/).pop()}"** — this model does not support image input.` }]);
                return;
            }
            const content = await window.ipcRenderer.invoke('read-file', filePath);
            setAttachedFile({ name: filePath.split(/[/\\]/).pop() || filePath, path: filePath, content });
        } catch (e: unknown) { console.error('Failed to attach file', e); }
    };

    const togglePlusMenu = async () => {
        const nextState = !showPlusMenu;
        setShowPlusMenu(nextState);
        if (nextState) {
            setShowAgentSubmenu(false); setShowWorkflowSubmenu(false);
            try {
                const agentsData = await window.ipcRenderer.invoke('db-get-agents');
                setDbAgents(agentsData || []);
                const flowsData = await window.ipcRenderer.invoke('db-get-flows');
                _setFlows(flowsData || []);
            } catch (e) { console.error('Failed to load agents dynamically', e); }
        }
    };

    const { currentActivitiesRef } = useActivityTracking(setMessages as unknown as React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>, setCurrentlyReadingFiles);
    const {
        activeConversationId, setActiveConversationId, conversations, showHistoryDrawer,
        editingConvId, editingTitle, conversationContextMenu,
        loadConversations, refreshActiveMessages,
        handleRollbackConversation, handleSelectConversation,
        handleDeleteConversation, handleStartRename, handleSaveRename,
        handleNewChat, handleConversationContextMenu, handleConversationMenuAction, handleForkConversation,
        setShowHistoryDrawer, setEditingConvId, setEditingTitle, setConversationContextMenu,
    } = useConversations(setMessages as unknown as React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>, setIsLoading, setActiveProvider, setActiveModel, rootPath);
    const { planStartTimeRef, timerRef } = usePlanSync(activeConversationIdRef, setMessages as unknown as React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>, setIsPlanModifying, setStreamElapsed, setCurrentlyReadingFiles, currentActivitiesRef as unknown as React.MutableRefObject<Record<string, unknown>[]>, refreshActiveMessages);
    useAgentHandler(activeConversationId, setMessages as unknown as React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>, loadConversations);

    const { handleSend, handleAbort, messageQueue, lastSentMessageRef } = useChatSending({
        messages, setMessages, isLoading, setIsLoading, input, setInput, attachedFile, setAttachedFile,
        chatMode, activeModel, activeProvider, effortLevel, executionMode,
        activeConversationId, setActiveConversationId, conversations: conversations as unknown as Record<string, unknown>[], loadConversations, refreshActiveMessages,
        dbAgents, flows: _flows, activeAgent: activeAgent as unknown as Record<string, unknown>, activeWorkflow: activeWorkflow as unknown as Record<string, unknown>,
        planStartTimeRef, timerRef, currentActivitiesRef,
        setApiError: setApiError as unknown as React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>, setCurrentlyReadingFiles, setStreamElapsed,
        setContextUsage, setFileDiffs: setChatFileDiffs,
        onOpenPlan,
        rootPath,
    });

    useEffect(() => { activeConversationIdRef.current = activeConversationId; }, [activeConversationId]);
    useEffect(() => { if (onActiveTaskIdChange) onActiveTaskIdChange(activeConversationId ? getNumericTaskId(activeConversationId) : null); }, [activeConversationId, onActiveTaskIdChange]);
    useEffect(() => {
        const isNewMessage = messages.length > lastMessageCountRef.current;
        lastMessageCountRef.current = messages.length;
        scrollToBottom(isNewMessage);
    }, [messages, messageQueue]);
    useEffect(() => { localStorage.setItem('chatPanelWidth', panelWidth.toString()); }, [panelWidth]);
    useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, [timerRef]);

    useEffect(() => {
        const loadInitial = async () => {
            const settings = await window.ipcRenderer.invoke('get-general-settings');
            if (settings) { setActiveProvider(settings.activeProvider || 'openai'); setActiveModel(settings.selectedModel || 'gpt-4o'); }
            const flowsData = await window.ipcRenderer.invoke('db-get-flows');
            _setFlows(flowsData || []);
            const agentsData = await window.ipcRenderer.invoke('db-get-agents');
            setDbAgents(agentsData || []);
            await loadConversations();
        };
        loadInitial();
    }, [isOpen, settingsSavedTrigger, loadConversations]);
    const handleSelectModel = async (modelName: string, providerId: string) => {
        setActiveModel(modelName);
        setActiveProvider(providerId);

        const matchingModel = customModels.find(cm => cm.model_name === modelName && cm.provider_id === providerId);
        if (matchingModel) {
            setExecutionMode(matchingModel.has_thinking === 1 ? 'think' : 'fast');
        }

        try {
            const settings = await window.ipcRenderer.invoke('get-general-settings');
            await window.ipcRenderer.invoke('save-general-settings', {
                ...(settings || {}),
                activeProvider: providerId,
                selectedModel: modelName
            });
        } catch (e) {
            console.error('Failed to save general settings when changing model:', e);
        }
    };

    useEffect(() => {
        const queryModels = async () => {
            const dbModels = await window.ipcRenderer.invoke('ai:get-custom-models');
            setCustomModels(dbModels || []);
            const chosenNames = (dbModels as Record<string, unknown>[]).map((m: Record<string, unknown>) => m.model_name as string);
            if (chosenNames.length > 0) {
                setAvailableModels(chosenNames);
                const currentMatch = (dbModels as Record<string, unknown>[]).find(m => m.model_name === activeModel && m.provider_id === activeProvider);
                if (!currentMatch) {
                    const first = (dbModels as Record<string, unknown>[])[0];
                    setActiveModel(first.model_name as string);
                    setActiveProvider(first.provider_id as string);
                }
            } else { setAvailableModels([]); setActiveModel(''); }
        };
        queryModels();
    }, [settingsSavedTrigger]);

    useEffect(() => {
        const handleChangesUpdated = (_event: any, data: { relativePath: string; action: 'stage' | 'discard' }) => {
            if (data && data.relativePath) {
                setChatFileDiffs(prev => prev.filter(diff => {
                    const diffNorm = diff.filePath.replace(/\\/g, '/').toLowerCase();
                    const relNorm = data.relativePath.replace(/\\/g, '/').toLowerCase();
                    return diffNorm !== relNorm;
                }));
            }
        };
        const cleanup = window.ipcRenderer.on('changes:updated', handleChangesUpdated) as unknown as () => void;
        return () => cleanup();
    }, []);

    useEffect(() => {
        const handleExecutionProgress = (_event: any, data: { taskId: number; phase: string; message: string; attempt?: number; totalAttempts?: number }) => {
            const emoji: Record<string, string> = {
                investigating: '🔍',
                generating: '✏️',
                applying: '📦',
                verifying: '🧪',
                completed: '✅',
                failed: '❌',
                stopped: '⏹',
            };
            const prefix = emoji[data.phase] || '•';
            const attemptStr = data.attempt && data.totalAttempts ? ` (${data.attempt}/${data.totalAttempts})` : '';
            const content = `${prefix} ${data.message}${attemptStr}`;
            if (content !== lastProgressPhaseRef.current) {
                lastProgressPhaseRef.current = content;
                setMessages(prev => [...prev, { role: 'system', content }]);
            }
        };
        const cleanup2 = window.ipcRenderer.on('execution:progress', handleExecutionProgress) as unknown as () => void;
        return () => cleanup2();
    }, []);

    useEffect(() => {
        if (showSettings) {
            const fetchStatuses = async () => {
                try {
                    const keys = await window.ipcRenderer.invoke('secure:list-keys');
                    const statusMap: Record<string, { hasKey: boolean; encryptionAvailable: boolean }> = {};
                    for (const k of keys as Record<string, unknown>[]) statusMap[k.providerId as string] = k as { hasKey: boolean; encryptionAvailable: boolean };
                    setCredentialStatuses(statusMap);
                } catch (e) { console.error('[ChatPanel] Failed to fetch credential statuses:', e); }
            };
            fetchStatuses();
        }
    }, [showSettings]);

    useEffect(() => {
        const fetchContextLength = async () => {
            if (!activeProvider || !activeModel) return;
            try {
                const limit = await window.ipcRenderer.invoke('ai:get-model-context-length', {
                    providerId: activeProvider,
                    modelId: activeModel
                });
                if (typeof limit === 'number') {
                    setModelLimit(limit);
                } else {
                    setModelLimit(128000);
                }
            } catch (e) {
                console.error('[ChatPanel] Failed to fetch model context length:', e);
                setModelLimit(128000);
            }
        };
        fetchContextLength();
    }, [activeProvider, activeModel]);

    useEffect(() => {
        if (!executionContext) return;
        checkArgs(executionContext.agent != null, 'executionContext.agent must not be null');
        checkArgs(executionContext.flow != null, 'executionContext.flow must not be null');
        const { agent, flow } = executionContext;
        const steps = flow.steps as Record<string, unknown> | undefined;
        if (steps && steps.nodes) {
            setMessages([
                { role: 'system', content: (agent.system_prompt as string) || 'You are a helpful coding assistant.' },
                { role: 'system', content: `Starting Visual Workflow: ${flow.name}` },
            ]);
            runGraphWorkflow(steps.nodes as unknown[], steps.edges as unknown[], agent as unknown as Record<string, unknown>, setMessages as unknown as React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>, setIsLoading);
        } else {
            const stepsList = Array.isArray(flow.steps) ? (flow.steps as unknown[]) : [];
            const flowContext = `Wait! You are now executing a defined flow.\n\nFLOW: ${flow.name}\nDESCRIPTION: ${flow.description}\n\nSTEPS TO EXECUTE:\n${stepsList.map((s, i: number) => `${i + 1}. ${String(s)}`).join('\n')}\n\nPlease execute the steps one by one or as appropriate.`;
            setMessages([
                { role: 'system', content: agent.system_prompt || 'You are a helpful coding assistant.' },
                { role: 'system', content: flowContext },
                { role: 'assistant', content: `activated agent **${agent.name}**. I am ready to run flow: **${flow.name}**.` }
            ]);
        }
    }, [executionContext]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingRef.current) return;
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth < (showHistoryDrawer ? 400 : 160)) {
                resizingRef.current = false; onClose();
                document.body.style.cursor = 'default'; document.body.style.userSelect = 'auto';
                return;
            }
            setPanelWidth(Math.max(200, Math.min(window.innerWidth - 100 - (showHistoryDrawer ? 240 : 0), showHistoryDrawer ? newWidth - 240 : newWidth)));
        };
        const handleMouseUp = () => { resizingRef.current = false; document.body.style.cursor = 'default'; document.body.style.userSelect = 'auto'; };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, [showHistoryDrawer, onClose]);

    if (!isOpen) return null;

    return (
        <div className="chat-panel-container" style={{ width: showHistoryDrawer ? panelWidth + 240 : panelWidth }}>
            <div className="chat-resize-handle" onMouseDown={startResize} />
            <div className="chat-panel" style={{ display: 'flex', flexDirection: 'row', height: '100%', width: '100%', overflow: 'hidden' }}>
                {showHistoryDrawer && (
                    <ChatHistorySidebar
                        conversations={conversations} activeConversationId={activeConversationId}
                        editingConvId={editingConvId} editingTitle={editingTitle}
                        onSelectConversation={handleSelectConversation} onStartRename={handleStartRename}
                        onSaveRename={handleSaveRename} onDeleteConversation={handleDeleteConversation}
                        onContextMenu={handleConversationContextMenu} onNewChat={handleNewChat}
                        onSetEditingConvId={setEditingConvId} onSetEditingTitle={setEditingTitle}
                    />
                )}
                {conversationContextMenu && (
                    <ContextMenu x={conversationContextMenu.x} y={conversationContextMenu.y}
                        items={[
                            { label: 'Fork Conversation', action: () => handleConversationMenuAction('fork') },
                            { label: 'Rename', action: () => handleConversationMenuAction('rename'), shortcut: 'F2' },
                            { label: 'Delete', action: () => handleConversationMenuAction('delete'), danger: true }
                        ]}
                        onClose={() => setConversationContextMenu(null)}
                    />
                )}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    <ChatHeader
                        showHistoryDrawer={showHistoryDrawer} onToggleHistoryDrawer={() => setShowHistoryDrawer(!showHistoryDrawer)}
                        activeConversationId={activeConversationId} isLoading={isLoading}
                        onForkChat={() => handleForkConversation()} onForkSubThread={() => {
                            const sysMsg = messages.find(m => m.role === 'system') || { role: 'system', content: 'You are a helpful coding assistant.' };
                            const lastMsg = messages.length > 1 ? messages[messages.length - 1] : null;
                            const newMsgs = [sysMsg as Message];
                            if (lastMsg) newMsgs.push({ role: 'system', content: `[Parent Thread Context Summary]:\n${lastMsg.content.slice(0, 1000)}` });
                            setMessages(newMsgs);
                            setMessages(prev => [...prev, { role: 'system', content: '🥞 **Sub-Thread Forked!** Older conversation history pruned.' }]);
                        }}
                        onToggleSettings={() => setShowSettings(!showSettings)} onClose={onClose}
                    />
                    {showSettings && (
                        <ChatSettingsPanel tempApiKey={tempApiKey} setTempApiKey={setTempApiKey}
                            tempGithubToken={tempGithubToken} setTempGithubToken={setTempGithubToken}
                            credentialStatuses={credentialStatuses} fetchCredentialStatuses={async () => {
                                try { const keys = await window.ipcRenderer.invoke('secure:list-keys'); const m: Record<string, { hasKey: boolean; encryptionAvailable: boolean }> = {}; for (const k of keys as Record<string, unknown>[]) m[k.providerId as string] = k as { hasKey: boolean; encryptionAvailable: boolean }; setCredentialStatuses(m); }
                                catch (e) { console.error('[ChatPanel] Failed to fetch credential statuses:', e); }
                            }}
                        />
                    )}
                    <ApiErrorBanner error={apiError as unknown as ApiErrorInfo | null} onDismiss={() => setApiError(null)}
                        onRetry={() => { const lastMsg = lastSentMessageRef.current; setApiError(null); if (lastMsg) handleSend({ content: lastMsg.content, attachedFile: lastMsg.attachedFile as { name: string; path: string; content: string } | null, isPlanMode: lastMsg.isPlanMode || false, id: Date.now() }); }}
                    />
                    <MessageList ref={scrollContainerRef} messages={messages as unknown as Record<string, unknown>[]} messageQueue={messageQueue}
                        streamElapsed={streamElapsed} currentlyReadingFiles={currentlyReadingFiles}
                        onApplyCode={onApplyCode} onRollback={handleRollbackConversation}
                        activeConversationId={activeConversationId} onOpenPlan={onOpenPlan}
                    />
                    {pendingReview && (
                        <ChangeReviewBanner
                            taskId={pendingReview.taskId}
                            fileCount={pendingReview.fileCount}
                            addedLines={pendingReview.addedLines}
                            removedLines={pendingReview.removedLines}
                            onOpenReview={onOpenReview || (() => { })}
                            onAcceptAll={onAcceptAllChanges || (() => { })}
                            onRejectAll={onRejectAllChanges || (() => { })}
                            isApplying={pendingReviewApplying || false}
                        />
                    )}
                    <ActiveBadges attachedFile={attachedFile} onRemoveFile={() => setAttachedFile(null)}
                        chatMode={chatMode} onChatModeChange={setChatMode}
                        activeAgent={activeAgent} onRemoveAgent={() => setActiveAgent(null)}
                        activeWorkflow={activeWorkflow} onRemoveWorkflow={() => setActiveWorkflow(null)}
                    />
                    {contextUsage && contextUsage.contextLength > 0 && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '2px 12px', fontSize: 10, color: 'var(--text-secondary)',
                            borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                        }}>
                            <div style={{ flex: 1, height: 4, background: 'var(--border-color)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{
                                    width: `${Math.min(100, (contextUsage.estimatedInput / contextUsage.contextLength) * 100)}%`,
                                    height: '100%',
                                    background: contextUsage.estimatedInput > contextUsage.contextLength * 0.8 ? 'var(--accent-danger, #e74c3c)' : 'var(--accent-primary)',
                                    borderRadius: 2, transition: 'width 0.3s ease',
                                }} />
                            </div>
                            <span>{contextUsage.estimatedInput.toLocaleString()} / {contextUsage.contextLength.toLocaleString()} ({(contextUsage.estimatedInput / contextUsage.contextLength * 100).toFixed(0)}%)</span>
                        </div>
                    )}
                    {chatFileDiffs.length > 0 && (
                        <div style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', fontSize: 11 }}>
                                <span className="codicon codicon-diff" style={{ color: 'var(--accent-primary)', fontSize: 14 }} />
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                    {chatFileDiffs.length} file{chatFileDiffs.length !== 1 ? 's' : ''} modified
                                    (+{chatFileDiffs.reduce((s, d) => s + d.addedLines, 0)} / -{chatFileDiffs.reduce((s, d) => s + d.removedLines, 0)})
                                </span>
                                <span style={{ flex: 1 }} />
                                <button onClick={() => setChatFileDiffs([])} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 10, padding: '2px 8px', borderRadius: 4 }}>Dismiss All</button>
                            </div>
                            {chatFileDiffs.map((diff, idx) => (
                                <ChatFileDiffCard key={idx} diff={diff} onDismiss={() => setChatFileDiffs(prev => prev.filter((_, i) => i !== idx))} />
                            ))}
                        </div>
                    )}
                    <ChatInputArea input={input} setInput={setInput}
                        isLoading={isLoading} isPlanModifying={isPlanModifying} chatMode={chatMode}
                        attachedFile={attachedFile} activeModel={activeModel} activeProvider={activeProvider}
                        customModels={customModels} availableModels={availableModels}
                        showModelDropdown={showModelDropdown} setShowModelDropdown={setShowModelDropdown}
                        inlineModelInput={inlineModelInput} setInlineModelInput={setInlineModelInput}
                        onSelectModel={handleSelectModel} setCustomModels={setCustomModels} setAvailableModels={setAvailableModels}
                        executionMode={executionMode} setExecutionMode={setExecutionMode}
                        effortLevel={effortLevel} setEffortLevel={setEffortLevel}
                        showPlusMenu={showPlusMenu} togglePlusMenu={togglePlusMenu}
                        dbAgents={dbAgents} flows={_flows}
                        showAgentSubmenu={showAgentSubmenu} setShowAgentSubmenu={setShowAgentSubmenu}
                        showWorkflowSubmenu={showWorkflowSubmenu} setShowWorkflowSubmenu={setShowWorkflowSubmenu}
                        setActiveAgent={setActiveAgent as unknown as React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>} setActiveWorkflow={setActiveWorkflow as unknown as React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>}
                        onChatModeChange={setChatMode}
                        handleFileUpload={handleFileUpload} handleSend={handleSend as unknown as (queuedMsg?: Record<string, unknown>) => void} handleAbort={handleAbort}
                        currentModelCanThink={currentModelCanThink}
                        tokenDetails={getChatTokenDetails(messages, input, attachedFile)}
                        modelLimit={modelLimit}
                    />
                </div>
            </div>
        </div>
    );
}
