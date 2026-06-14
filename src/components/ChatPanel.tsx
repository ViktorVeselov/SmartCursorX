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
import { useActivityTracking } from './useActivityTracking';
import { usePlanSync } from './usePlanSync';
import { useAgentHandler } from './useAgentHandler';
import { useConversations } from './useConversations';
import { useChatSending } from './useChatSending';

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
}
export type { ActivityTimelineItem } from '../helpers/chatParsing';

export interface Message {
    id?: number; role: 'user' | 'assistant' | 'system'; content: string;
    isPlanMode?: boolean; isStreaming?: boolean; isAgentExecution?: boolean;
    filesRead?: string[]; planSteps?: unknown[]; activities?: ActivityTimelineItem[];
}

const estimateCurrentTokens = (
    messages: Message[],
    currentInput: string,
    attachedFile: { content: string } | null
): number => {
    let baselineTokens = 0;
    let baselineIndex = -1;

    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'assistant' && msg.content) {
            const startIdx = msg.content.indexOf('[CHAT_METADATA_START]');
            const endIdx = msg.content.indexOf('[CHAT_METADATA_END]');
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                try {
                    const metaStr = msg.content.substring(startIdx + '[CHAT_METADATA_START]'.length, endIdx);
                    const meta = JSON.parse(metaStr);
                    const inputTokens = typeof meta.inputTokens === 'number' ? meta.inputTokens : 0;
                    const outputTokens = typeof meta.outputTokens === 'number' ? meta.outputTokens : 0;
                    baselineTokens = inputTokens + outputTokens;
                    baselineIndex = i;
                    break;
                } catch (e) {
                    console.error('Failed to parse chat metadata from message', e);
                }
            }
        }
    }

    let estimated = 0;
    if (baselineIndex !== -1) {
        let postBaselineChars = 0;
        for (let i = baselineIndex + 1; i < messages.length; i++) {
            postBaselineChars += (messages[i].content || '').length;
        }
        estimated = baselineTokens + Math.ceil(postBaselineChars / 4);
    } else {
        let totalChars = 0;
        for (const msg of messages) {
            totalChars += (msg.content || '').length;
        }
        estimated = Math.ceil(totalChars / 4);
    }

    let currentInputChars = currentInput.length;
    if (attachedFile && attachedFile.content) {
        currentInputChars += attachedFile.content.length;
    }
    estimated += Math.ceil(currentInputChars / 4);

    return estimated;
};

export function ChatPanel({ isOpen, onClose, onApplyCode, executionContext, settingsSavedTrigger, onOpenPlan, onActiveTaskIdChange, rootPath = '' }: ChatPanelProps) {
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
    const [isPlanModeActive, setIsPlanModeActive] = useState(false);
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
    const [currentPlan, setCurrentPlan] = useState<Record<string, unknown>[] | null>(null);
    const [isAwaitingApproval, setIsAwaitingApproval] = useState(false);
    const [panelWidth, setPanelWidth] = useState(() => { const s = localStorage.getItem('chatPanelWidth'); return s ? parseInt(s, 10) : 400; });
    const [_flows, _setFlows] = useState<{ id: number; name: string; description: string; steps: unknown; agent_id: number }[]>([]);

    const activeChunkListenerRef = useRef<((_: unknown, chunk: string) => void) | null>(null);
    const activeEndListenerRef = useRef<((...args: unknown[]) => void) | null>(null);
    const streamActiveRef = useRef(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const resizingRef = useRef(false);
    const activeConversationIdRef = useRef<string | null>(null);

    const cleanupActiveListeners = () => {
        streamActiveRef.current = false;
        if (activeChunkListenerRef.current) {
            window.ipcRenderer.off('ai:chat-chunk', activeChunkListenerRef.current);
            window.ipcRenderer.off('ai:plan-chunk', activeChunkListenerRef.current);
            activeChunkListenerRef.current = null;
        }
        if (activeEndListenerRef.current) {
            window.ipcRenderer.off('ai:chat-end', activeEndListenerRef.current);
            window.ipcRenderer.off('ai:plan-end', activeEndListenerRef.current);
            activeEndListenerRef.current = null;
        }
    };

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

    useEffect(() => () => cleanupActiveListeners(), []);

    const { currentActivitiesRef } = useActivityTracking(setMessages as unknown as React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>, setCurrentlyReadingFiles);
    const {
        activeConversationId, setActiveConversationId, conversations, showHistoryDrawer,
        editingConvId, editingTitle, conversationContextMenu,
        loadConversations, refreshActiveMessages,
        handleRollbackConversation, handleSelectConversation,
        handleDeleteConversation, handleStartRename, handleSaveRename,
        handleNewChat, handleConversationContextMenu, handleConversationMenuAction, handleForkConversation,
        setShowHistoryDrawer, setEditingConvId, setEditingTitle, setConversationContextMenu,
    } = useConversations(setMessages as unknown as React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>, setIsLoading, setActiveProvider, setActiveModel, cleanupActiveListeners, streamActiveRef, rootPath);
    const { planStartTimeRef, timerRef } = usePlanSync(activeConversationIdRef, setMessages as unknown as React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>, setIsPlanModifying, setStreamElapsed, setCurrentlyReadingFiles, currentActivitiesRef as unknown as React.MutableRefObject<Record<string, unknown>[]>, refreshActiveMessages);
    useAgentHandler(activeConversationId, setMessages as unknown as React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>, loadConversations);

    const { handleSend, handleAbort, messageQueue, lastSentMessageRef } = useChatSending({
        messages, setMessages, isLoading, setIsLoading, input, setInput, attachedFile, setAttachedFile,
        isPlanModeActive, activeModel, activeProvider, effortLevel, executionMode,
        activeConversationId, setActiveConversationId, conversations: conversations as unknown as Record<string, unknown>[], loadConversations, refreshActiveMessages,
        dbAgents, flows: _flows, activeAgent: activeAgent as unknown as Record<string, unknown>, activeWorkflow: activeWorkflow as unknown as Record<string, unknown>,
        planStartTimeRef, timerRef, currentActivitiesRef,
        setApiError: setApiError as unknown as React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>, setCurrentlyReadingFiles, setStreamElapsed,
        cleanupActiveListeners, streamActiveRef, activeChunkListenerRef, activeEndListenerRef, onOpenPlan,
        rootPath,
    });

    useEffect(() => { activeConversationIdRef.current = activeConversationId; }, [activeConversationId]);
    useEffect(() => { if (onActiveTaskIdChange) onActiveTaskIdChange(activeConversationId ? getNumericTaskId(activeConversationId) : null); }, [activeConversationId, onActiveTaskIdChange]);
    useEffect(() => { scrollToBottom(); }, [messages, messageQueue]);
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

    useEffect(() => {
        const queryModels = async () => {
            const dbModels = await window.ipcRenderer.invoke('ai:get-custom-models', activeProvider);
            setCustomModels(dbModels || []);
            const chosenNames = (dbModels as Record<string, unknown>[]).map((m: Record<string, unknown>) => m.model_name as string);
            if (chosenNames.length > 0) {
                setAvailableModels(chosenNames);
                if (!chosenNames.includes(activeModel) || !activeModel) setActiveModel(chosenNames[0]);
            } else { setAvailableModels([]); setActiveModel(''); }
        };
        queryModels();
    }, [activeProvider, settingsSavedTrigger, activeModel]);

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
                            credentialStatuses={credentialStatuses}                             fetchCredentialStatuses={async () => {
                                try { const keys = await window.ipcRenderer.invoke('secure:list-keys'); const m: Record<string, { hasKey: boolean; encryptionAvailable: boolean }> = {}; for (const k of keys as Record<string, unknown>[]) m[k.providerId as string] = k as { hasKey: boolean; encryptionAvailable: boolean }; setCredentialStatuses(m); }
                                catch (e) { console.error('[ChatPanel] Failed to fetch credential statuses:', e); }
                            }}
                        />
                    )}
                    <ApiErrorBanner error={apiError as unknown as ApiErrorInfo | null} onDismiss={() => setApiError(null)}
                        onRetry={() => { const lastMsg = lastSentMessageRef.current; setApiError(null); if (lastMsg) handleSend({ content: lastMsg.content, attachedFile: lastMsg.attachedFile as { name: string; path: string; content: string } | null, isPlanMode: lastMsg.isPlanMode || false, id: Date.now() }); }}
                    />
                    <MessageList ref={messagesEndRef} messages={messages as unknown as Record<string, unknown>[]} messageQueue={messageQueue}
                        streamElapsed={streamElapsed} currentlyReadingFiles={currentlyReadingFiles}
                        onApplyCode={onApplyCode} onRollback={handleRollbackConversation}
                        activeConversationId={activeConversationId} onOpenPlan={onOpenPlan}
                    />
                    {currentPlan && currentPlan.length > 0 && (
                        <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <span style={{ fontWeight: 600, fontSize: 13 }}>🧠 Execution Plan</span>
                                {isAwaitingApproval && (
                                    <button onClick={async () => {
                                        setIsAwaitingApproval(false);
                                        setMessages(prev => [...prev, { role: 'system', content: '✅ Plan approved! Executing...' }]);
                                        for (const step of currentPlan as Record<string, unknown>[]) {
                                            setMessages(prev => [...prev, { role: 'system', content: `▶ ${(step as Record<string, unknown>).title as string}` }]);
                                            await new Promise(r => setTimeout(r, 500));
                                        }
                                        setMessages(prev => [...prev, { role: 'system', content: '🎉 Plan completed!' }]);
                                        setCurrentPlan(null);
                                    }}
                                        style={{ padding: '4px 8px', background: 'var(--accent-primary)', border: 'none', borderRadius: 4, color: 'white', fontSize: 11, cursor: 'pointer' }}
                                    >Approve Plan</button>
                                )}
                            </div>
                        </div>
                    )}
                    <ActiveBadges attachedFile={attachedFile} onRemoveFile={() => setAttachedFile(null)}
                        isPlanModeActive={isPlanModeActive} onTogglePlanMode={() => setIsPlanModeActive(false)}
                        activeAgent={activeAgent} onRemoveAgent={() => setActiveAgent(null)}
                        activeWorkflow={activeWorkflow} onRemoveWorkflow={() => setActiveWorkflow(null)}
                    />
                    <ChatInputArea input={input} setInput={setInput}
                        isLoading={isLoading} isPlanModifying={isPlanModifying} isPlanModeActive={isPlanModeActive}
                        attachedFile={attachedFile} activeModel={activeModel} activeProvider={activeProvider}
                        customModels={customModels} availableModels={availableModels}
                        showModelDropdown={showModelDropdown} setShowModelDropdown={setShowModelDropdown}
                        inlineModelInput={inlineModelInput} setInlineModelInput={setInlineModelInput}
                        setActiveModel={setActiveModel} setCustomModels={setCustomModels} setAvailableModels={setAvailableModels}
                        executionMode={executionMode} setExecutionMode={setExecutionMode}
                        effortLevel={effortLevel} setEffortLevel={setEffortLevel}
                        showPlusMenu={showPlusMenu} togglePlusMenu={togglePlusMenu}
                        dbAgents={dbAgents} flows={_flows}
                        showAgentSubmenu={showAgentSubmenu} setShowAgentSubmenu={setShowAgentSubmenu}
                        showWorkflowSubmenu={showWorkflowSubmenu} setShowWorkflowSubmenu={setShowWorkflowSubmenu}
                        setActiveAgent={setActiveAgent as unknown as React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>} setActiveWorkflow={setActiveWorkflow as unknown as React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>}
                        setIsPlanModeActive={setIsPlanModeActive}
                        handleFileUpload={handleFileUpload} handleSend={handleSend as unknown as (queuedMsg?: Record<string, unknown>) => void} handleAbort={handleAbort}
                        currentModelCanThink={currentModelCanThink}
                        currentTokens={estimateCurrentTokens(messages, input, attachedFile)}
                        modelLimit={modelLimit}
                    />
                </div>
            </div>
        </div>
    );
}
