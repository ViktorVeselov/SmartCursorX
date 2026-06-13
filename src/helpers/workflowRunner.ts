import { executeWorkflow, WorkflowAction } from '../utils/workflowExecutor';
import type { Node, Edge } from 'reactflow';

// eslint-disable-next-line max-lines-per-function
export async function runGraphWorkflow(
    nodes: unknown[],
    edges: unknown[],
    _agent: Record<string, unknown>,
    setMessages: React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>,
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
) {
    console.assert(Array.isArray(nodes), 'nodes list must be an array');
    console.assert(Array.isArray(edges), 'edges list must be an array');
    const generator = executeWorkflow(nodes as Node[], edges as Edge[], {});
    setIsLoading(true);

    // eslint-disable-next-line max-lines-per-function, complexity
    const executeSingleAction = async (action: WorkflowAction): Promise<unknown> => {
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

            const isLocalAgentRunningRef = { current: false };
            return new Promise((resolve) => {
                let agentResultText = '';
                const handleChunk = (_event: unknown, chunk: string) => {
                    agentResultText += chunk;
                };
                const handleComplete = (_event: unknown, code: number) => {
                    isLocalAgentRunningRef.current = false;
                    window.ipcRenderer.off('openclaw:agent-stream', handleChunk);
                    window.ipcRenderer.off('openclaw:agent-complete', handleComplete);
                    setMessages(prev => [...prev, { role: 'system', content: `[OpenClaw Agent] Completed with exit code ${code}.` }]);
                    resolve(agentResultText || 'Execution Completed');
                };

                window.ipcRenderer.on('openclaw:agent-stream', handleChunk);
                window.ipcRenderer.on('openclaw:agent-complete', handleComplete);

                window.ipcRenderer.invoke('openclaw:run-agent', message, depth).catch(err => {
                    isLocalAgentRunningRef.current = false;
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
                let result: unknown;
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
            } catch (err: unknown) {
                setMessages(prev => [...prev, { role: 'system', content: `[Code Search] Error: ${err instanceof Error ? err.message : String(err)}` }]);
                return `Error: ${err instanceof Error ? err.message : String(err)}`;
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
            } catch (err: unknown) {
                setMessages(prev => [...prev, { role: 'system', content: `[Verification] Error: ${err instanceof Error ? err.message : String(err)}` }]);
                return `Error: ${err instanceof Error ? err.message : String(err)}`;
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
    } catch (e: unknown) {
        console.error(e);
        setMessages(prev => [...prev, { role: 'system', content: `Workflow Error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
        setIsLoading(false);
    }
}
