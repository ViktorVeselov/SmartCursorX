import { useState, useEffect } from 'react';

export interface TaskNode {
    id: number;
    title: string;
    description: string | null;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
    priority: number;
    parent_task_id: number | null;
    assigned_agent_id: number | null;
    created_by: string;
    context_budget: number;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
    children?: TaskNode[];
}

interface TaskPanelProps {
    onOpenPlan?: (taskId: number, taskTitle: string) => void;
}

export function TaskPanel({ onOpenPlan }: TaskPanelProps) {
    const [tasks, setTasks] = useState<TaskNode[]>([]);
    const [selectedTask, setSelectedTask] = useState<TaskNode | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDesc, setNewTaskDesc] = useState('');
    const [isDecomposing, setIsDecomposing] = useState<number | null>(null);
    const [subtaskInputs, setSubtaskInputs] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadTasks();
    }, []);

    const loadTasks = async () => {
        setIsLoading(true);
        try {
            const data = await window.ipcRenderer.invoke('task:get-tree');
            setTasks(data || []);
        } catch (e) {
            console.error('Failed to load tasks:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateRootTask = async () => {
        if (!newTaskTitle.trim()) return;
        setIsLoading(true);
        try {
            await window.ipcRenderer.invoke('task:create', newTaskTitle.trim(), newTaskDesc.trim() || null);
            setNewTaskTitle('');
            setNewTaskDesc('');
            loadTasks();
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDecompose = async (parentId: number) => {
        if (!subtaskInputs.trim()) return;
        const subList = subtaskInputs.split('\n').filter(s => s.trim()).map(s => ({
            title: s.trim(),
            description: null
        }));
        if (subList.length === 0) return;

        setIsLoading(true);
        try {
            await window.ipcRenderer.invoke('task:decompose', parentId, subList);
            setSubtaskInputs('');
            setIsDecomposing(null);
            loadTasks();
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const updateStatus = async (taskId: number, status: string) => {
        setIsLoading(true);
        try {
            if (status === 'completed') {
                await window.ipcRenderer.invoke('task:complete', taskId, 'Completed manually via UI');
            } else if (status === 'failed') {
                await window.ipcRenderer.invoke('task:fail', taskId, 'Failed manually via UI');
            } else if (status === 'in_progress') {
                await window.ipcRenderer.invoke('task:start', taskId);
            }
            loadTasks();
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <span className="codicon codicon-pass" style={{ color: '#42b883' }} />;
            case 'failed': return <span className="codicon codicon-error" style={{ color: '#ff3e00' }} />;
            case 'in_progress': return <span className="codicon codicon-play" style={{ color: '#00add8' }} />;
            case 'blocked': return <span className="codicon codicon-lock" style={{ color: '#eab308' }} />;
            default: return <span className="codicon codicon-circle-outline" style={{ color: 'var(--text-secondary)' }} />;
        }
    };

    const renderTaskNode = (node: TaskNode, depth: number = 0) => {
        return (
            <div key={node.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <div 
                    onClick={() => setSelectedTask(node)}
                    style={{
                        padding: '6px 12px',
                        paddingLeft: `${12 + depth * 16}px`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: selectedTask?.id === node.id ? 'var(--bg-active)' : 'transparent',
                        borderRadius: 'var(--radius-sm)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        {getStatusIcon(node.status)}
                        <span style={{ 
                            textDecoration: node.status === 'completed' ? 'line-through' : 'none',
                            color: node.status === 'completed' ? 'var(--text-secondary)' : 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>
                            {node.title}
                        </span>
                    </div>
                </div>

                {node.children && node.children.map(child => renderTaskNode(child, depth + 1))}
            </div>
        );
    };

    return (
        <div className="task-panel" style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            color: 'var(--text-primary)',
            background: 'var(--bg-secondary)',
            fontSize: '12px'
        }}>
            <div style={{ padding: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="codicon codicon-checklist" style={{ color: 'var(--accent-primary)' }} />
                    Task Tree Hierarchy
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                {isLoading && <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Loading tasks...</div>}
                
                {tasks.map(node => renderTaskNode(node))}

                {tasks.length === 0 && !isLoading && (
                    <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', padding: '10px' }}>No active tasks created</div>
                )}
            </div>

            {/* Task Detail Inspector & Actions */}
            {selectedTask && (
                <div style={{
                    padding: '12px',
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'var(--bg-tertiary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{selectedTask.title}</div>
                        <button 
                            onClick={() => setSelectedTask(null)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                            <span className="codicon codicon-close" />
                        </button>
                    </div>

                    {selectedTask.description && (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{selectedTask.description}</div>
                    )}

                    <div style={{ display: 'flex', gap: '6px' }}>
                        {selectedTask.status !== 'in_progress' && selectedTask.status !== 'completed' && (
                            <button 
                                onClick={() => updateStatus(selectedTask.id, 'in_progress')}
                                style={{ padding: '4px 8px', background: 'var(--accent-primary)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}
                            >Start</button>
                        )}
                        {selectedTask.status === 'in_progress' && (
                            <>
                                <button 
                                    onClick={() => updateStatus(selectedTask.id, 'completed')}
                                    style={{ padding: '4px 8px', background: '#42b883', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}
                                >Complete</button>
                                <button 
                                    onClick={() => updateStatus(selectedTask.id, 'failed')}
                                    style={{ padding: '4px 8px', background: '#ff3e00', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}
                                >Fail</button>
                            </>
                        )}
                        <button 
                            onClick={() => { setIsDecomposing(selectedTask.id); setSubtaskInputs(''); }}
                            style={{ padding: '4px 8px', background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer' }}
                        >Decompose</button>
                        {onOpenPlan && (
                            <button 
                                onClick={() => onOpenPlan(selectedTask.id, selectedTask.title)}
                                style={{ padding: '4px 8px', background: 'rgba(129, 140, 248, 0.15)', border: '1px solid rgba(129, 140, 248, 0.3)', borderRadius: '4px', color: '#a5b4fc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <span className="codicon codicon-project" />
                                Roadmap
                            </button>
                        )}
                    </div>

                    {isDecomposing === selectedTask.id && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                            <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Add Subtasks (one per line):</label>
                            <textarea
                                value={subtaskInputs}
                                onChange={e => setSubtaskInputs(e.target.value)}
                                style={{
                                    width: '100%',
                                    minHeight: '60px',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    outline: 'none',
                                    padding: '4px'
                                }}
                            />
                            <div style={{ display: 'flex', gap: '6px', alignSelf: 'flex-end' }}>
                                <button onClick={() => setIsDecomposing(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
                                <button onClick={() => handleDecompose(selectedTask.id)} style={{ padding: '3px 8px', background: 'var(--accent-primary)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}>Save</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Quick Task Creation footer */}
            {!selectedTask && (
                <div style={{
                    padding: '10px',
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'var(--bg-tertiary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                }}>
                    <input
                        type="text"
                        placeholder="Create new task..."
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '5px 8px',
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            borderRadius: 'var(--radius-sm)',
                            outline: 'none'
                        }}
                    />
                    <input
                        type="text"
                        placeholder="Task description (optional)..."
                        value={newTaskDesc}
                        onChange={e => setNewTaskDesc(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '5px 8px',
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            borderRadius: 'var(--radius-sm)',
                            outline: 'none'
                        }}
                    />
                    <button
                        onClick={handleCreateRootTask}
                        disabled={!newTaskTitle.trim()}
                        style={{
                            width: '100%',
                            padding: '6px',
                            background: newTaskTitle.trim() ? 'var(--accent-primary)' : 'var(--bg-hover)',
                            color: newTaskTitle.trim() ? 'white' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: newTaskTitle.trim() ? 'pointer' : 'default',
                            fontWeight: 500
                        }}
                    >
                        Create Root Task
                    </button>
                </div>
            )}
        </div>
    );
}
