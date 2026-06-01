import { useState, useEffect, useRef } from 'react';
import { executeWorkflow, WorkflowAction } from '../utils/workflowExecutor';
import { MarkdownRenderer } from './MarkdownRenderer';

const DollarIcon = ({ active, width = 13, height = 13, marginRight = 0 }: { active: boolean; width?: number; height?: number; marginRight?: number }) => (
    <svg 
        width={width} 
        height={height} 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        style={{ 
            transition: "all 0.3s ease",
            marginRight,
            color: active ? "#a78bfa" : "var(--text-secondary)",
            filter: active ? "drop-shadow(0 0 3px rgba(167, 139, 250, 0.6))" : "none"
        }}
    >
        <path fillRule="evenodd" d="M9 15a6 6 0 1 1 12 0 6 6 0 0 1-12 0Zm3.845-1.855a2.4 2.4 0 0 1 1.2-1.226 1 1 0 0 1 1.992-.026c.426.15.809.408 1.111.749a1 1 0 1 1-1.496 1.327.682.682 0 0 0-.36-.213.997.997 0 0 1-.113-.032.4.4 0 0 0-.394.074.93.93 0 0 0 .455.254 2.914 2.914 0 0 1 1.504.9c.373.433.669 1.092.464 1.823a.996.996 0 0 1-.046.129c-.226.519-.627.94-1.132 1.192a1 1 0 0 1-1.956.093 2.68 2.68 0 0 1-1.227-.798 1 1 0 1 1 1.506-1.315.682.682 0 0 0 .363.216c.038.009.075.02.111.032a.4.4 0 0 0 .395-.074.93.93 0 0 0-.455-.254 2.91 2.91 0 0 1-1.503-.9c-.375-.433-.666-1.089-.466-1.817a.994.994 0 0 1 .047-.134Zm1.884.573.003.008c-.003-.005-.003-.008-.003-.008Zm.55 2.613s-.002-.002-.003-.007a.032.032 0 0 1 .003.007ZM4 14a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0v-4a1 1 0 0 1 1-1Zm3-2a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Zm6.5-8a1 1 0 0 1 1-1H18a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-.796l-2.341 2.049a1 1 0 0 1-1.24.06l-2.894-2.066L6.614 9.29a1 1 0 1 1-1.228-1.578l4.5-3.5a1 1 0 0 1 1.195-.025l2.856 2.04L15.34 5h-.84a1 1 0 0 1-1-1Z" clipRule="evenodd"/>
    </svg>
);

export interface AppAgent {
    id: number;
    name: string;
    system_prompt?: string;
}

export interface AppFlow {
    id: number;
    name: string;
    description?: string;
    steps?: any;
}

export interface AppExecutionContext {
    agent: AppAgent;
    flow: AppFlow;
}

interface ChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onApplyCode?: (code: string) => void;
    executionContext?: AppExecutionContext | null;
    settingsSavedTrigger?: number;
}

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export function ChatPanel({ isOpen, onClose, onApplyCode, executionContext, settingsSavedTrigger }: ChatPanelProps) {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'system', content: 'You are a helpful coding assistant.' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [githubToken, setGithubToken] = useState<string | null>(null);

    // Settings Panel
    const [showSettings, setShowSettings] = useState(false);
    const [tempApiKey, setTempApiKey] = useState('');
    const [tempGithubToken, setTempGithubToken] = useState('');

    // Active Model & Provider selection
    const [activeProvider, setActiveProvider] = useState('openai');
    const [activeModel, setActiveModel] = useState('gpt-4o');
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [inlineModelInput, setInlineModelInput] = useState('');
    const [customModels, setCustomModels] = useState<any[]>([]);

    // File attachments
    const [attachedFile, setAttachedFile] = useState<{ name: string; path: string; content: string } | null>(null);

    // Execution Modes: 'fast' | 'think'
    const [executionMode, setExecutionMode] = useState<'fast' | 'think'>('fast');

    // Plus button popover menu states
    const [showPlusMenu, setShowPlusMenu] = useState(false);
    const [showAgentSubmenu, setShowAgentSubmenu] = useState(false);
    const [showWorkflowSubmenu, setShowWorkflowSubmenu] = useState(false);
    const [isPlanModeActive, setIsPlanModeActive] = useState(false);
    const [dbAgents, setDbAgents] = useState<{ id: number; name: string; system_prompt: string }[]>([]);
    const [activeAgent, setActiveAgent] = useState<AppAgent | null>(null);
    const [activeWorkflow, setActiveWorkflow] = useState<AppFlow | null>(null);

    // Slash Commands (Temporarily prefixed with underscore to satisfy strict checks)
    interface Flow { id: number; name: string; description: string; steps: any; agent_id: number; }
    const [_flows, _setFlows] = useState<Flow[]>([]);

    // Think Planning State
    interface PlanStep {
        id: string;
        title: string;
        subSteps?: PlanStep[];
        status: 'pending' | 'in-progress' | 'done';
        expanded?: boolean;
    }
    const [currentPlan, setCurrentPlan] = useState<PlanStep[] | null>(null);
    const [isAwaitingApproval, setIsAwaitingApproval] = useState(false);

    // Update context when executionContext changes
    useEffect(() => {
        if (executionContext) {
            const { agent, flow } = executionContext;

            if (flow.steps && flow.steps.nodes) {
                setMessages([
                    { role: 'system', content: agent.system_prompt || 'You are a helpful coding assistant.' },
                    { role: 'system', content: `Starting Visual Workflow: ${flow.name}` },
                ]);
                runGraphWorkflow(flow.steps.nodes, flow.steps.edges, agent);
            } else {
                const stepsList = Array.isArray(flow.steps) ? flow.steps : [];
                const flowContext = `Wait! You are now executing a defined flow.\n\nFLOW: ${flow.name}\nDESCRIPTION: ${flow.description}\n\nSTEPS TO EXECUTE:\n${stepsList.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}\n\nPlease execute the steps one by one or as appropriate.`;

                setMessages([
                    { role: 'system', content: agent.system_prompt || 'You are a helpful coding assistant.' },
                    { role: 'system', content: flowContext },
                    { role: 'assistant', content: `activated agent **${agent.name}**. I am ready to run flow: **${flow.name}**.` }
                ]);
            }
        }
    }, [executionContext]);

    const runGraphWorkflow = async (nodes: any[], edges: any[], _agent: any) => {
        console.assert(Array.isArray(nodes), 'nodes list must be an array');
        console.assert(Array.isArray(edges), 'edges list must be an array');
        const generator = executeWorkflow(nodes, edges, {});
        setIsLoading(true);

        const executeSingleAction = async (action: WorkflowAction): Promise<any> => {
            if (action.type === 'log') {
                setMessages(prev => [...prev, { role: 'system', content: `[Workflow] ${action.message}` }]);
                return 'Log Printed';
            }
            if (action.type === 'tool') {
                setMessages(prev => [...prev, { role: 'system', content: `[Tool] Executing ${action.toolConfig?.name}...` }]);
                await new Promise(r => setTimeout(r, 1000));
                setMessages(prev => [...prev, { role: 'system', content: `[Tool] Output: Success (Simulated)` }]);
                return 'Tool Success';
            }
            if (action.type === 'planner') {
                setMessages(prev => [...prev, { role: 'system', content: `[Planner] Analyzing Goal: "${action.plannerConfig?.goal}"` }]);
                await new Promise(r => setTimeout(r, 1500));
                setMessages(prev => [...prev, { role: 'system', content: `[Planner] Plan Generated.` }]);
                return ['Analyzing Requirements', 'Code Implementation', 'Verification'];
            }
            if (action.type === 'task') {
                setMessages(prev => [...prev, { role: 'system', content: `[Task] ${action.taskConfig?.label}` }]);
                if (action.taskConfig?.assignee) {
                    setMessages(prev => [...prev, { role: 'system', content: `  ↳ Assigned to: ${action.taskConfig?.assignee}` }]);
                }
                await new Promise(r => setTimeout(r, 800));
                return 'Task Done';
            }
            if (action.type === 'openclaw') {
                const message = action.openClawConfig?.message || 'Run Agent';
                const depth = action.openClawConfig?.thinkingDepth || 'medium';
                setMessages(prev => [...prev, { role: 'system', content: `[OpenClaw Agent] Invoking: "${message}" (Reasoning: ${depth})` }]);
                
                return new Promise((resolve) => {
                    let agentResultText = '';
                    const handleChunk = (_event: any, chunk: string) => {
                        agentResultText += chunk;
                    };
                    const handleComplete = (_event: any, code: number) => {
                        window.ipcRenderer.off('openclaw:agent-stream', handleChunk);
                        window.ipcRenderer.off('openclaw:agent-complete', handleComplete);
                        setMessages(prev => [...prev, { role: 'system', content: `[OpenClaw Agent] Completed with exit code ${code}.` }]);
                        resolve(agentResultText || 'Execution Completed');
                    };

                    window.ipcRenderer.on('openclaw:agent-stream', handleChunk);
                    window.ipcRenderer.on('openclaw:agent-complete', handleComplete);
                    
                    window.ipcRenderer.invoke('openclaw:run-agent', message, depth).catch(err => {
                        window.ipcRenderer.off('openclaw:agent-stream', handleChunk);
                        window.ipcRenderer.off('openclaw:agent-complete', handleComplete);
                        setMessages(prev => [...prev, { role: 'system', content: `[OpenClaw Agent] Spawn Error: ${err.message}` }]);
                        resolve(`Error: ${err.message}`);
                    });
                });
            }
            if (action.type === 'codesearch') {
                const searchType = action.codeSearchConfig?.searchType || 'symbols';
                const query = action.codeSearchConfig?.query || '';
                setMessages(prev => [...prev, { role: 'system', content: `[Code Search] Running ${searchType} search for "${query}"...` }]);
                try {
                    const rootPath = await window.ipcRenderer.invoke('resolve-path', '.');
                    let result: any;
                    if (searchType === 'symbols') {
                        result = await window.ipcRenderer.invoke('code:get-symbols', query);
                    } else if (searchType === 'refs') {
                        result = await window.ipcRenderer.invoke('code:find-references', query, rootPath);
                    } else if (searchType === 'hierarchy') {
                        result = await window.ipcRenderer.invoke('code:get-call-hierarchy', query, rootPath, 'incoming');
                    }
                    const formatted = JSON.stringify(result, null, 2);
                    setMessages(prev => [...prev, { role: 'system', content: `[Code Search] Found details:\n\`\`\`json\n${formatted.slice(0, 1000)}\n\`\`\`` }]);
                    return result;
                } catch (err: any) {
                    setMessages(prev => [...prev, { role: 'system', content: `[Code Search] Error: ${err.message}` }]);
                    return `Error: ${err.message}`;
                }
            }
            if (action.type === 'verify') {
                const ruleId = action.verifyConfig?.ruleId || 0;
                setMessages(prev => [...prev, { role: 'system', content: `[Verification] Running Verification rule ID ${ruleId}...` }]);
                try {
                    const result = await window.ipcRenderer.invoke('verify:run', ruleId);
                    const statusEmoji = result.status === 'passed' ? '✅' : '❌';
                    setMessages(prev => [...prev, { role: 'system', content: `[Verification] Result: ${statusEmoji} ${result.status.toUpperCase()} - ${result.message || ''}` }]);
                    return result;
                } catch (err: any) {
                    setMessages(prev => [...prev, { role: 'system', content: `[Verification] Error: ${err.message}` }]);
                    return `Error: ${err.message}`;
                }
            }
            return 'Action Completed';
        };

        try {
            let result = await generator.next();
            while (!result.done) {
                const action = result.value as WorkflowAction;

                if (action.type === 'log') {
                    setMessages(prev => [...prev, { role: 'system', content: `[Workflow] ${action.message}` }]);
                    result = await generator.next();
                }
                else if (action.type === 'agent') {
                    setMessages(prev => [...prev, { role: 'assistant', content: `[Agent: ${action.agentConfig?.name}] Executing...` }]);
                    setMessages(prev => [...prev, { role: 'system', content: 'Graph execution via Frontend is deprecated. Please migrate graph features.' }]);
                    return;
                }
                else if (action.type === 'parallel') {
                    setMessages(prev => [...prev, { role: 'system', content: `[Parallel] Launching ${action.actions?.length || 0} tasks concurrently...` }]);
                    const results = await Promise.all((action.actions || []).map(act => executeSingleAction(act)));
                    setMessages(prev => [...prev, { role: 'system', content: `[Parallel] All parallel branches completed.` }]);
                    result = await generator.next(results);
                }
                else {
                    const actionResponse = await executeSingleAction(action);
                    result = await generator.next(actionResponse);
                }
            }
            setMessages(prev => [...prev, { role: 'system', content: 'Workflow Completed Successfully.' }]);
        } catch (e: any) {
            console.error(e);
            setMessages(prev => [...prev, { role: 'system', content: `Workflow Error: ${e.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const [panelWidth, setPanelWidth] = useState(() => {
        const saved = localStorage.getItem('chatPanelWidth');
        return saved ? parseInt(saved, 10) : 400;
    });
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const resizingRef = useRef(false);

    // Load active settings and query model list
    useEffect(() => {
        const loadInitialData = async () => {
            const settings = await window.ipcRenderer.invoke('get-general-settings');
            if (settings) {
                setActiveProvider(settings.activeProvider || 'openai');
                setActiveModel(settings.selectedModel || 'gpt-4o');
            }

            const key = await window.ipcRenderer.invoke('get-api-key');
            if (key) setApiKey(key);

            const ghToken = await window.ipcRenderer.invoke('get-github-token');
            if (ghToken) setGithubToken(ghToken);

            const flowsData = await window.ipcRenderer.invoke('db-get-flows');
            _setFlows(flowsData || []);

            const agentsData = await window.ipcRenderer.invoke('db-get-agents');
            setDbAgents(agentsData || []);
        };
        loadInitialData();
    }, [isOpen, settingsSavedTrigger]);

    const togglePlusMenu = async () => {
        const nextState = !showPlusMenu;
        setShowPlusMenu(nextState);
        if (nextState) {
            setShowAgentSubmenu(false);
            setShowWorkflowSubmenu(false);
            try {
                const agentsData = await window.ipcRenderer.invoke('db-get-agents');
                setDbAgents(agentsData || []);
                const flowsData = await window.ipcRenderer.invoke('db-get-flows');
                _setFlows(flowsData || []);
            } catch (e) {
                console.error('Failed to load agents dynamically', e);
            }
        }
    };

    // Query dynamic model switcher list on provider changes or settings saved
    useEffect(() => {
        const queryModels = async () => {
            // 1. Fetch custom/chosen models from SQLite
            const dbModels = await window.ipcRenderer.invoke('ai:get-custom-models', activeProvider);
            setCustomModels(dbModels || []);
            const chosenNames = dbModels.map((m: any) => m.model_name);
            
            if (chosenNames.length > 0) {
                // Show ONLY chosen models!
                setAvailableModels(chosenNames);
                if (!chosenNames.includes(activeModel)) {
                    setActiveModel(chosenNames[0]);
                }
            } else {
                // Fallback: Fetch all dynamic models
                const list = await window.ipcRenderer.invoke('ai:get-models', activeProvider);
                setAvailableModels(list || []);
                if (list && list.length > 0 && !list.includes(activeModel)) {
                    setActiveModel(list[0]);
                }
            }
        };
        queryModels();
    }, [activeProvider, settingsSavedTrigger]);

    useEffect(() => {
        localStorage.setItem('chatPanelWidth', panelWidth.toString());
    }, [panelWidth]);

    // Resize handlers
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingRef.current) return;
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth < 160) {
                // Snap shut!
                resizingRef.current = false;
                onClose();
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
                return;
            }
            setPanelWidth(Math.max(200, Math.min(window.innerWidth - 100, newWidth)));
        };

        const handleMouseUp = () => {
            resizingRef.current = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const startResize = () => {
        resizingRef.current = true;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleFileUpload = async () => {
        try {
            const filePath = await window.ipcRenderer.invoke('dialog-open-file');
            if (!filePath) return;
            const content = await window.ipcRenderer.invoke('read-file', filePath);
            const name = filePath.split(/[/\\]/).pop() || filePath;
            setAttachedFile({ name, path: filePath, content });
        } catch (e: any) {
            console.error('Failed to attach file', e);
        }
    };

    const handleSend = async () => {
        if (!input.trim() && !attachedFile || isLoading) return;

        let finalContent = input;
        if (attachedFile) {
            finalContent = `[Attached File: ${attachedFile.name}]\n\`\`\`\n${attachedFile.content}\n\`\`\`\n\n${input}`;
            setAttachedFile(null);
        }

        const userMsg: Message = { role: 'user', content: finalContent };
        setMessages(prev => [...prev, userMsg]);

        setInput('');
        setIsLoading(true);

        try {
            let fullResponse = '';

            const handleChunk = (_: any, chunk: string) => {
                if (chunk.startsWith('Error:')) {
                    console.error('AI Stream Error:', chunk);
                    return;
                }

                fullResponse += chunk;
                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg.role === 'assistant') {
                        return [...prev.slice(0, -1), { role: 'assistant', content: fullResponse }];
                    } else {
                        return [...prev, { role: 'assistant', content: fullResponse }];
                    }
                });
            };

            const handleEnd = () => {
                setIsLoading(false);
                window.ipcRenderer.off('ai:chat-chunk', handleChunk);
                window.ipcRenderer.off('ai:chat-end', handleEnd);
            };

            window.ipcRenderer.on('ai:chat-chunk', handleChunk);
            window.ipcRenderer.on('ai:chat-end', handleEnd);

            // Dynamic Persona & Workflow Prompt Injection
            const systemMessages: Message[] = [];
            if (activeAgent) {
                systemMessages.push({
                    role: 'system',
                    content: `[Active Agent Persona: ${activeAgent.name}]\nSystem Prompt:\n${activeAgent.system_prompt || 'You are a helpful coding assistant.'}`
                });
            }
            if (activeWorkflow) {
                const stepsText = Array.isArray(activeWorkflow.steps)
                    ? activeWorkflow.steps.map((s: any, idx: number) => `${idx + 1}. ${s}`).join('\n')
                    : typeof activeWorkflow.steps === 'object'
                        ? JSON.stringify(activeWorkflow.steps)
                        : activeWorkflow.steps || '';
                systemMessages.push({
                    role: 'system',
                    content: `[Active Workflow Context: ${activeWorkflow.name}]\nDescription: ${activeWorkflow.description || ''}\nSteps/Structure:\n${stepsText}`
                });
            }

            // Plan execution mode logic mapping
            // Thinking and Plan execution mode logic mapping
            let finalPrompt = userMsg.content;
            if (executionMode === 'think') {
                finalPrompt = `[Thinking Mode Active: Generate step-by-step structure] ${finalPrompt}`;
            }
            if (isPlanModeActive) {
                finalPrompt = `[Plan Mode Active: Perform structured task planning] ${finalPrompt}`;
            }
            userMsg.content = finalPrompt;

            // If an active workflow or agent defines a task ID, we assemble context budget intelligently
            let finalSystemMessages = [...systemMessages];
            try {
                // If a root task is available in database, pull active context budget
                const taskTree = await window.ipcRenderer.invoke('task:get-tree');
                const activeTask = taskTree.find((t: any) => t.status === 'in_progress');
                if (activeTask) {
                    const budgetContext = await window.ipcRenderer.invoke('task:assemble-context', activeTask.id, messages);
                    if (budgetContext && budgetContext.systemPrompt) {
                        finalSystemMessages = [{ role: 'system', content: budgetContext.systemPrompt }];
                    }
                }
            } catch (e) {
                console.error('Failed to assemble budget context, falling back:', e);
            }

            window.ipcRenderer.send('ai:chat-start', {
                messages: [
                    ...finalSystemMessages,
                    ...messages.filter(m => m.role !== 'system'),
                    userMsg
                ],
                providerId: activeProvider,
                model: activeModel
            });

        } catch (error) {
            console.error('Error sending message:', error);
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="chat-panel-container" style={{ width: panelWidth }}>
            <div
                className="chat-resize-handle"
                onMouseDown={startResize}
            />

            <div className="chat-panel">
                <div className="chat-header">
                    <h3><span className="codicon codicon-hubot" style={{ marginRight: 8 }} />AI Assistant</h3>
                    <div className="chat-actions">
                        <button onClick={() => setShowSettings(!showSettings)} title="API Keys">
                            <span className="codicon codicon-key" />
                        </button>
                        <button onClick={onClose} title="Close Chat Panel">
                            <span className="codicon codicon-close" />
                        </button>
                    </div>
                </div>

                {showSettings && (
                    <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--text-secondary)' }}>OpenAI API Key</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    type="password"
                                    placeholder="sk-..."
                                    value={tempApiKey}
                                    onChange={e => setTempApiKey(e.target.value)}
                                    style={{ flex: 1, padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                                />
                                <button
                                    onClick={async () => {
                                        try {
                                            await window.ipcRenderer.invoke('set-api-key', tempApiKey);
                                            setApiKey(tempApiKey);
                                            setTempApiKey('');
                                        } catch (e: any) { alert(e.message); }
                                    }}
                                    style={{ padding: '6px 12px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                >Save</button>
                            </div>
                            {apiKey && <span style={{ fontSize: 10, color: '#4ade80' }}>✓ Key configured</span>}
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--text-secondary)' }}>GitHub Token (PAT)</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    type="password"
                                    placeholder="ghp_..."
                                    value={tempGithubToken}
                                    onChange={e => setTempGithubToken(e.target.value)}
                                    style={{ flex: 1, padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                                />
                                <button
                                    onClick={async () => {
                                        try {
                                            await window.ipcRenderer.invoke('set-github-token', tempGithubToken);
                                            setGithubToken(tempGithubToken);
                                            setTempGithubToken('');
                                        } catch (e: any) { alert(e.message); }
                                    }}
                                    style={{ padding: '6px 12px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                >Save</button>
                            </div>
                            {githubToken && <span style={{ fontSize: 10, color: '#4ade80' }}>✓ GitHub connected</span>}
                        </div>
                    </div>
                )}

                {/* Always render Chat Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {messages.filter(m => m.role !== 'system').map((msg, i) => (
                        <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                            <div style={{
                                background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                                padding: '8px 12px',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--font-base)',
                                minWidth: '80px'
                            }}>
                                {msg.role === 'user' ? (
                                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                                ) : (
                                    <MarkdownRenderer content={msg.content} onApplyCode={onApplyCode} />
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Plan Tree UI (Think Planning Mode) */}
                {currentPlan && currentPlan.length > 0 && (
                    <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>🧠 Execution Plan</span>
                            {isAwaitingApproval && (
                                <button
                                    onClick={async () => {
                                        setIsAwaitingApproval(false);
                                        setMessages(prev => [...prev, { role: 'system', content: '✅ Plan approved! Executing...' }]);
                                        for (const step of currentPlan) {
                                            setMessages(prev => [...prev, { role: 'system', content: `▶ ${step.title}` }]);
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
                    {/* Attached File Badge & Plan Badge */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '0 16px 8px 16px', alignSelf: 'flex-start' }}>
                    {attachedFile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
                            <span className="codicon codicon-file" style={{ fontSize: 12 }} />
                            <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{attachedFile.name}</span>
                            <span
                                className="codicon codicon-close"
                                style={{ fontSize: 10, cursor: 'pointer', marginLeft: 4 }}
                                onClick={() => setAttachedFile(null)}
                            />
                        </div>
                    )}
                    {isPlanModeActive && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'rgba(0, 122, 204, 0.1)', border: '1px solid rgba(0, 122, 204, 0.2)', borderRadius: 4 }}>
                            <span className="codicon codicon-checklist" style={{ fontSize: 12, color: 'var(--accent-primary)' }} />
                            <span style={{ fontSize: 11, color: 'var(--accent-primary)', fontWeight: 600 }}>Plan Mode Active</span>
                            <span
                                className="codicon codicon-close"
                                style={{ fontSize: 10, cursor: 'pointer', marginLeft: 4, color: 'var(--accent-primary)' }}
                                onClick={() => setIsPlanModeActive(false)}
                            />
                        </div>
                    )}
                    {activeAgent && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: 4 }}>
                            <span className="codicon codicon-hubot" style={{ fontSize: 12, color: '#a855f7' }} />
                            <span style={{ fontSize: 11, color: '#a855f7', fontWeight: 600 }}>Agent: {activeAgent.name}</span>
                            <span
                                className="codicon codicon-close"
                                style={{ fontSize: 10, cursor: 'pointer', marginLeft: 4, color: '#a855f7' }}
                                onClick={() => setActiveAgent(null)}
                            />
                        </div>
                    )}
                    {activeWorkflow && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: 4 }}>
                            <span className="codicon codicon-git-merge" style={{ fontSize: 12, color: '#eab308' }} />
                            <span style={{ fontSize: 11, color: '#eab308', fontWeight: 600 }}>Workflow: {activeWorkflow.name}</span>
                            <span
                                className="codicon codicon-close"
                                style={{ fontSize: 10, cursor: 'pointer', marginLeft: 4, color: '#eab308' }}
                                onClick={() => setActiveWorkflow(null)}
                            />
                        </div>
                    )}
                </div>

                        {/* Premium Unified Chat Box Container */}
                <div className="chat-input-area" style={{ padding: '12px 16px 16px 16px', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '16px',
                        padding: '12px 14px',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onFocusCapture={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        e.currentTarget.style.boxShadow = '0 8px 30px rgba(99, 102, 241, 0.15)';
                    }}
                    onBlurCapture={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.15)';
                    }}
                    >
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                    (e.target as HTMLTextAreaElement).style.height = 'auto';
                                }
                            }}
                            placeholder="Ask anything... (type / for flows)"
                            disabled={isLoading}
                            style={{
                                minHeight: 48,
                                maxHeight: '35vh',
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                resize: 'none',
                                fontSize: '13px',
                                fontFamily: 'inherit',
                                color: 'var(--text-primary)',
                                overflowY: 'auto',
                                width: '100%',
                                padding: 0,
                                margin: '0 0 10px 0',
                                lineHeight: '1.5'
                            }}
                        />

                        {/* Toolbar Container embedded inside the capsule */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {/* Plus Trigger Button with Popover Dropdown */}
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <button
                                        onClick={togglePlusMenu}
                                        title="Add content or tools"
                                        disabled={isLoading}
                                        style={{
                                            padding: '4px',
                                            background: showPlusMenu ? 'var(--bg-active)' : 'transparent',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            color: 'var(--text-secondary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 24,
                                            height: 24,
                                            transition: 'var(--transition-smooth)'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                        onMouseOut={(e) => e.currentTarget.style.background = showPlusMenu ? 'var(--bg-active)' : 'transparent'}
                                    >
                                        <span className="codicon codicon-plus" style={{ fontSize: 13 }} />
                                    </button>

                                    {showPlusMenu && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '100%',
                                            left: 0,
                                            background: 'var(--bg-glass)',
                                            backdropFilter: 'var(--glass-blur)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: 'var(--radius-md)',
                                            boxShadow: 'var(--shadow-lg)',
                                            zIndex: 1100,
                                            minWidth: 160,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            marginBottom: 8,
                                            padding: 4
                                        }}>
                                            <div
                                                onClick={async () => {
                                                    setShowPlusMenu(false);
                                                    await handleFileUpload();
                                                }}
                                                style={{
                                                    padding: '6px 12px',
                                                    fontSize: 'var(--font-xs)',
                                                    cursor: 'pointer',
                                                    color: 'var(--text-primary)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    borderRadius: 'var(--radius-sm)'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <span className="codicon codicon-file-media" />
                                                Attach File
                                            </div>

                                            {/* Attach Agent Submenu */}
                                            <div style={{ position: 'relative' }}>
                                                <div
                                                    onClick={() => {
                                                        setShowAgentSubmenu(!showAgentSubmenu);
                                                        setShowWorkflowSubmenu(false);
                                                    }}
                                                    style={{
                                                        padding: '6px 12px',
                                                        fontSize: 'var(--font-xs)',
                                                        cursor: 'pointer',
                                                        color: 'var(--text-primary)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                        borderRadius: 'var(--radius-sm)'
                                                    }}
                                                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <span className="codicon codicon-hubot" />
                                                    Attach Agent
                                                    <span className="codicon codicon-chevron-right" style={{ marginLeft: 'auto', fontSize: 10 }} />
                                                </div>

                                                {showAgentSubmenu && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: '100%',
                                                        bottom: 0,
                                                        background: 'var(--bg-glass)',
                                                        backdropFilter: 'var(--glass-blur)',
                                                        border: '1px solid var(--border-subtle)',
                                                        borderRadius: 'var(--radius-md)',
                                                        boxShadow: 'var(--shadow-lg)',
                                                        zIndex: 1150,
                                                        minWidth: 140,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        marginLeft: 4,
                                                        padding: 4
                                                    }}>
                                                        {dbAgents.length === 0 ? (
                                                            <div style={{ padding: '6px 12px', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                                                No custom agents
                                                            </div>
                                                        ) : (
                                                            dbAgents.map(agent => (
                                                                <div
                                                                    key={agent.id}
                                                                    onClick={() => {
                                                                        setActiveAgent(agent);
                                                                        setShowPlusMenu(false);
                                                                        setShowAgentSubmenu(false);
                                                                    }}
                                                                    style={{
                                                                        padding: '6px 12px',
                                                                        fontSize: 'var(--font-xs)',
                                                                        cursor: 'pointer',
                                                                        color: 'var(--text-primary)',
                                                                        borderRadius: 'var(--radius-sm)'
                                                                    }}
                                                                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                                >
                                                                    {agent.name}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Attach Workflow Submenu */}
                                            <div style={{ position: 'relative' }}>
                                                <div
                                                    onClick={() => {
                                                        setShowWorkflowSubmenu(!showWorkflowSubmenu);
                                                        setShowAgentSubmenu(false);
                                                    }}
                                                    style={{
                                                        padding: '6px 12px',
                                                        fontSize: 'var(--font-xs)',
                                                        cursor: 'pointer',
                                                        color: 'var(--text-primary)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                        borderRadius: 'var(--radius-sm)'
                                                    }}
                                                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <span className="codicon codicon-git-merge" />
                                                    Attach Workflow
                                                    <span className="codicon codicon-chevron-right" style={{ marginLeft: 'auto', fontSize: 10 }} />
                                                </div>

                                                {showWorkflowSubmenu && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: '100%',
                                                        bottom: 0,
                                                        background: 'var(--bg-glass)',
                                                        backdropFilter: 'var(--glass-blur)',
                                                        border: '1px solid var(--border-subtle)',
                                                        borderRadius: 'var(--radius-md)',
                                                        boxShadow: 'var(--shadow-lg)',
                                                        zIndex: 1150,
                                                        minWidth: 140,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        marginLeft: 4,
                                                        padding: 4
                                                    }}>
                                                        {_flows.length === 0 ? (
                                                            <div style={{ padding: '6px 12px', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                                                No workflows available
                                                            </div>
                                                        ) : (
                                                            _flows.map(flow => (
                                                                <div
                                                                    key={flow.id}
                                                                    onClick={() => {
                                                                        setActiveWorkflow(flow);
                                                                        setShowPlusMenu(false);
                                                                        setShowWorkflowSubmenu(false);
                                                                    }}
                                                                    style={{
                                                                        padding: '6px 12px',
                                                                        fontSize: 'var(--font-xs)',
                                                                        cursor: 'pointer',
                                                                        color: 'var(--text-primary)',
                                                                        borderRadius: 'var(--radius-sm)'
                                                                    }}
                                                                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                                >
                                                                    {flow.name}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div
                                                onClick={() => {
                                                    setIsPlanModeActive(!isPlanModeActive);
                                                    setShowPlusMenu(false);
                                                }}
                                                style={{
                                                    padding: '6px 12px',
                                                    fontSize: 'var(--font-xs)',
                                                    cursor: 'pointer',
                                                    color: isPlanModeActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                                                    fontWeight: isPlanModeActive ? 600 : 500,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    borderRadius: 'var(--radius-sm)'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <span className={`codicon ${isPlanModeActive ? 'codicon-check' : 'codicon-checklist'}`} />
                                                Plan Mode {isPlanModeActive ? '(Active)' : ''}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Model Selector Dropdown switcher */}
                                <div style={{ position: 'relative' }}>
                                    <div style={{
                                        fontSize: '11px',
                                        color: 'var(--text-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        cursor: 'pointer',
                                        padding: '4px 8px',
                                        borderRadius: '8px',
                                        background: 'var(--bg-hover)',
                                        transition: 'var(--transition-smooth)',
                                        userSelect: 'none'
                                    }} 
                                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-active)'}
                                    onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                    onClick={() => setShowModelDropdown(!showModelDropdown)}>
                                        <span style={{ fontWeight: 500 }}>{activeModel.toUpperCase()}</span>
                                        <span className="codicon codicon-chevron-down" style={{ fontSize: 10, opacity: 0.8 }} />
                                    </div>
                                    {showModelDropdown && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '100%',
                                            left: 0,
                                            background: 'var(--bg-glass)',
                                            backdropFilter: 'var(--glass-blur)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: 'var(--radius-md)',
                                            boxShadow: 'var(--shadow-lg)',
                                            zIndex: 1100,
                                            minWidth: 200,
                                            maxHeight: 280,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            marginBottom: 6,
                                            padding: 4
                                        }}>
                                            {/* Search or Add Model Input field */}
                                            <div style={{ padding: '4px 6px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
                                                <input
                                                    type="text"
                                                    placeholder="Search or add model..."
                                                    value={inlineModelInput}
                                                    onChange={e => setInlineModelInput(e.target.value)}
                                                    style={{ width: '100%', background: 'var(--bg-input)', border: 'none', color: 'var(--text-primary)', padding: '5px 8px', borderRadius: '4px', fontSize: '10px', outline: 'none', boxSizing: 'border-box' }}
                                                    onKeyDown={async (e) => {
                                                        if (e.key === 'Enter' && inlineModelInput.trim()) {
                                                            e.preventDefault();
                                                            const name = inlineModelInput.trim();
                                                            const hasTh = name.startsWith('o1') || name.startsWith('o3') || name.includes('r1') || name.includes('reasoner');
                                                            await window.ipcRenderer.invoke('ai:add-custom-model', activeProvider, name, hasTh);
                                                            setInlineModelInput('');
                                                            
                                                            const dbModels = await window.ipcRenderer.invoke('ai:get-custom-models', activeProvider);
                                                            setCustomModels(dbModels || []);
                                                            const chosenNames = dbModels.map((cm: any) => cm.model_name);
                                                            if (chosenNames.length > 0) {
                                                                setAvailableModels(chosenNames);
                                                            }
                                                            setActiveModel(name);
                                                            setShowModelDropdown(false);
                                                        }
                                                    }}
                                                />
                                            </div>

                                            {/* Scrollable models list */}
                                            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 180 }}>
                                                {availableModels
                                                    .filter(m => m.toLowerCase().includes(inlineModelInput.toLowerCase()))
                                                    .map(m => {
                                                        const customMatch = customModels.find(cm => cm.model_name === m);
                                                        const hasThinking = customMatch ? customMatch.has_thinking === 1 : (m.startsWith('o1-') || m.startsWith('o3-') || m.includes('deepseek-r1') || m.includes('reasoner'));

                                                        return (
                                                            <div
                                                                key={m}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'space-between',
                                                                    padding: '5px 8px',
                                                                    borderRadius: 'var(--radius-sm)',
                                                                    background: activeModel === m ? 'var(--bg-active)' : 'transparent',
                                                                    cursor: 'pointer',
                                                                    transition: 'var(--transition-smooth)'
                                                                }}
                                                                onMouseOver={(e) => { if (activeModel !== m) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                                                onMouseOut={(e) => { if (activeModel !== m) e.currentTarget.style.background = 'transparent'; }}
                                                            >
                                                                <span
                                                                    onClick={() => {
                                                                        setActiveModel(m);
                                                                        setShowModelDropdown(false);
                                                                    }}
                                                                    style={{
                                                                        flex: 1,
                                                                        fontSize: 'var(--font-xs)',
                                                                        color: activeModel === m ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                                        textAlign: 'left',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap'
                                                                    }}
                                                                >
                                                                    {m}
                                                                </span>

                                                                {/* Brain Icon Toggle for Thinking capability */}
                                                                <button
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        const customMatch = customModels.find(cm => cm.model_name === m);
                                                                        if (customMatch) {
                                                                            await window.ipcRenderer.invoke('ai:toggle-model-thinking', activeProvider, m, !hasThinking);
                                                                        } else {
                                                                            await window.ipcRenderer.invoke('ai:add-custom-model', activeProvider, m, !hasThinking);
                                                                        }
                                                                        const dbModels = await window.ipcRenderer.invoke('ai:get-custom-models', activeProvider);
                                                                        setCustomModels(dbModels || []);
                                                                    }}
                                                                    title={hasThinking ? 'Disable Reasoning/Thinking for Model' : 'Enable Reasoning/Thinking for Model'}
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        padding: '2px',
                                                                        outline: 'none',
                                                                        transition: 'var(--transition-smooth)'
                                                                    }}
                                                                >
                                                                    {/* Miniature Sliding Switch for Model Capability */}
                                                                    <div style={{
                                                                        width: 20,
                                                                        height: 11,
                                                                        borderRadius: 5.5,
                                                                        background: hasThinking ? '#a78bfa' : 'rgba(255,255,255,0.15)',
                                                                        position: 'relative',
                                                                        transition: 'background 0.2s ease'
                                                                    }}>
                                                                        <div style={{
                                                                            width: 7,
                                                                            height: 7,
                                                                            borderRadius: '50%',
                                                                            background: '#ffffff',
                                                                            position: 'absolute',
                                                                            top: 2,
                                                                            left: hasThinking ? 11 : 2,
                                                                            transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                                                        }} />
                                                                    </div>
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Thinking Mode Toggle Switch */}
                                <div 
                                    onClick={() => setExecutionMode(prev => prev === 'think' ? 'fast' : 'think')}
                                    title="Toggle AI Thinking / Reasoning Mode"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        padding: '4px 6px',
                                        borderRadius: '8px',
                                        transition: 'background 0.2s ease',
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <DollarIcon active={executionMode === 'think'} />
                                    {/* Sleek Switch Toggle */}
                                    <div style={{
                                        width: 26,
                                        height: 14,
                                        borderRadius: 7,
                                        background: executionMode === 'think' ? '#a78bfa' : 'rgba(255,255,255,0.15)',
                                        position: 'relative',
                                        transition: 'background 0.25s ease',
                                        boxShadow: executionMode === 'think' ? '0 0 8px rgba(167, 139, 250, 0.4)' : 'none'
                                    }}>
                                        <div style={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: '50%',
                                            background: '#ffffff',
                                            position: 'absolute',
                                            top: 2,
                                            left: executionMode === 'think' ? 14 : 2,
                                            transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }} />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {/* Microphone Icon (Visual indicator for voice features) */}
                                <button
                                    title="Voice Input"
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-secondary)',
                                        padding: '4px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'var(--transition-smooth)'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                                >
                                    <span className="codicon codicon-mic" style={{ fontSize: 14 }} />
                                </button>

                                {/* Dynamic rounded blue Arrow Send Button */}
                                <button
                                    onClick={handleSend}
                                    disabled={isLoading || !input.trim()}
                                    style={{
                                        background: input.trim() ? '#0070f3' : 'var(--bg-hover)',
                                        color: input.trim() ? 'white' : 'var(--text-secondary)',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: 28,
                                        height: 28,
                                        cursor: input.trim() ? 'pointer' : 'default',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'var(--transition-smooth)',
                                        transform: input.trim() ? 'scale(1.05)' : 'scale(1)',
                                    }}
                                >
                                    <span className="codicon codicon-arrow-up" style={{ fontSize: 13, fontWeight: 'bold' }} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
