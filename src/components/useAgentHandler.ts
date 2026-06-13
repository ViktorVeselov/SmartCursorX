import { useEffect, useRef } from 'react';

export function useAgentHandler(
    activeConversationId: string | null,
    setMessages: React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>,
    loadConversations: () => Promise<void>
) {
    const isLocalAgentRunningRef = useRef(false);

    useEffect(() => {
        let currentAgentOutput = '';

        const handleAgentChunk = (_event: unknown, chunk: string) => {
            if (isLocalAgentRunningRef.current) return;
            currentAgentOutput += chunk;
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && (lastMsg as Record<string, unknown>).role === 'assistant' && (lastMsg as Record<string, unknown>).isAgentExecution) {
                    return [...prev.slice(0, -1), {
                        role: 'assistant',
                        content: currentAgentOutput,
                        isAgentExecution: true
                    }];
                } else {
                    return [...prev, {
                        role: 'assistant',
                        content: currentAgentOutput,
                        isAgentExecution: true
                    }];
                }
            });
        };

        const handleAgentComplete = async (_event: unknown, code: number) => {
            if (isLocalAgentRunningRef.current) return;
            const finalOutput = currentAgentOutput;
            currentAgentOutput = '';

            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && (lastMsg as Record<string, unknown>).role === 'assistant' && (lastMsg as Record<string, unknown>).isAgentExecution) {
                    return [...prev.slice(0, -1), {
                        role: 'assistant',
                        content: finalOutput + `\n\n*(Agent execution finished with code ${code})*`,
                        isAgentExecution: false
                    }];
                }
                return prev;
            });

            if (activeConversationId) {
                try {
                    await window.ipcRenderer.invoke(
                        'chat:add-message',
                        activeConversationId,
                        'assistant',
                        finalOutput + `\n\n*(Agent execution finished with code ${code})*`
                    );
                    await loadConversations();
                } catch (e) {
                    console.error('Failed to save background agent run to DB:', e);
                }
            }
        };

        window.ipcRenderer.on('openclaw:agent-stream', handleAgentChunk);
        window.ipcRenderer.on('openclaw:agent-complete', handleAgentComplete);

        return () => {
            window.ipcRenderer.off('openclaw:agent-stream', handleAgentChunk);
            window.ipcRenderer.off('openclaw:agent-complete', handleAgentComplete);
        };
    }, [activeConversationId, setMessages, loadConversations]);

    return { isLocalAgentRunningRef };
}
