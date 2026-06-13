export async function handleSlashCommand<T extends { role: 'user' | 'assistant' | 'system'; content: string }>(
    command: string,
    setMessages: React.Dispatch<React.SetStateAction<T[]>>
): Promise<boolean> {
    if (command.startsWith('/focus ')) {
        const target = command.substring(7).trim();
        const taskId = parseInt(target, 10);
        if (!isNaN(taskId)) {
            try {
                await window.ipcRenderer.invoke('task:start', taskId);
                setMessages(prev => [...prev,
                    { role: 'user', content: command } as T,
                    { role: 'system', content: `🎯 **Focus set to Task ID ${taskId}**. Status transitioned to **In Progress**.` } as T
                ]);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                setMessages(prev => [...prev,
                    { role: 'user', content: command } as T,
                    { role: 'system', content: `❌ **Failed to focus task:** ${msg}` } as T
                ]);
            }
        } else {
            setMessages(prev => [...prev,
                { role: 'user', content: command } as T,
                { role: 'system', content: `⚠️ **Invalid Task ID.** Usage: \`/focus [task_id]\`` } as T
            ]);
        }
        return true;
    }

    if (command.startsWith('/todo ')) {
        const todoText = command.substring(6).trim();
        if (todoText) {
            try {
                const taskTree = await window.ipcRenderer.invoke('task:get-tree');
                let parentId: number | null = null;
                const activeTask = taskTree.find((t: { status: string }) => t.status === 'in_progress');
                if (activeTask) {
                    parentId = activeTask.id;
                }

                const newTaskId = await window.ipcRenderer.invoke('task:create', todoText, null, parentId);
                setMessages(prev => [...prev,
                    { role: 'user', content: command } as T,
                    { role: 'system', content: `📝 **Subtask created successfully:** "${todoText}" (ID: ${newTaskId}${parentId ? `, Parent ID: ${parentId}` : ''})` } as T
                ]);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                setMessages(prev => [...prev,
                    { role: 'user', content: command } as T,
                    { role: 'system', content: `❌ **Failed to create subtask:** ${msg}` } as T
                ]);
            }
        } else {
            setMessages(prev => [...prev,
                { role: 'user', content: command } as T,
                { role: 'system', content: `⚠️ **Usage:** \`/todo [subtask title]\`` } as T
            ]);
        }
        return true;
    }

    if (command.startsWith('/checkpoint')) {
        const checkpointName = command.substring(11).trim() || `checkpoint_${Date.now()}`;
        try {
            const rootPath = await window.ipcRenderer.invoke('resolve-path', '.');
            const snapshotId = await window.ipcRenderer.invoke('vc-create-snapshot', checkpointName, rootPath);
            setMessages(prev => [...prev,
                { role: 'user', content: command } as T,
                { role: 'system', content: `💾 **Checkpoint "${checkpointName}" captured successfully!** (Snapshot ID: ${snapshotId})` } as T
            ]);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setMessages(prev => [...prev,
                { role: 'user', content: command } as T,
                { role: 'system', content: `❌ **Failed to capture checkpoint:** ${msg}` } as T
            ]);
        }
        return true;
    }

    return false;
}
