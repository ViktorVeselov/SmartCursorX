import { useCallback, useEffect } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
    BackgroundVariant,
    Panel
} from 'reactflow';
import 'reactflow/dist/style.css';

interface VisualWorkflowEditorProps {
    initialNodes?: Node[];
    initialEdges?: Edge[];
    onSave?: (nodes: Node[], edges: Edge[]) => void;
}

import { AgentNode } from './workflow/AgentNode';
import { ToolNode } from './workflow/ToolNode';
import { PlannerNode } from './workflow/PlannerNode';
import { TaskNode } from './workflow/TaskNode';
import { OpenClawNode } from './workflow/OpenClawNode';
import { CodeSearchNode } from './workflow/CodeSearchNode';
import { VerifyNode } from './workflow/VerifyNode';

const nodeTypes = {
    agent: AgentNode,
    tool: ToolNode,
    planner: PlannerNode,
    task: TaskNode,
    openclaw: OpenClawNode,
    codesearch: CodeSearchNode,
    verify: VerifyNode,
};

const defaultNodes: Node[] = [
    { id: 'start', position: { x: 100, y: 100 }, data: { label: 'Start Flow' }, type: 'input' },
];

export function VisualWorkflowEditor({ initialNodes, initialEdges, onSave }: VisualWorkflowEditorProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes || defaultNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || []);

    const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    // Save on changes (debounced ideally, or manual save)
    useEffect(() => {
        if (onSave) {
            const timer = setTimeout(() => {
                onSave(nodes, edges);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [nodes, edges, onSave]);

    const addNode = (type: 'agent' | 'tool' | 'planner' | 'task' | 'openclaw' | 'codesearch' | 'verify') => {
        const id = `${type}-${nodes.length + 1}`;
        const data: Record<string, unknown> = { label: `New ${type === 'openclaw' ? 'OpenClaw' : type}` };

        if (type === 'agent') data.prompt = 'System Prompt...';
        if (type === 'tool') data.description = 'Tool config...';
        if (type === 'planner') data.goal = 'High level objective...';
        if (type === 'task') data.description = 'Specific task...';
        if (type === 'codesearch') {
            data.query = 'find functions';
            data.searchType = 'symbols';
        }
        if (type === 'verify') {
            data.ruleId = 1;
        }
        if (type === 'openclaw') {
            data.message = 'Task Details...';
            data.thinkingDepth = 'medium';
        }

        const newNode: Node = {
            id,
            position: { x: Math.random() * 400, y: Math.random() * 400 },
            data,
            type,
        };
        setNodes((nds) => nds.concat(newNode));
    };

    return (
        <div style={{ width: '100%', height: '100%', border: '1px solid var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
            >
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                <Controls />
                <MiniMap style={{ background: 'var(--bg-secondary)' }} />
                <Panel position="top-right">
                    <button onClick={() => addNode('agent')} style={{ marginRight: 6, padding: '4px 8px', cursor: 'pointer' }}>+ Agent</button>
                    <button onClick={() => addNode('tool')} style={{ marginRight: 6, padding: '4px 8px', cursor: 'pointer' }}>+ Tool</button>
                    <button onClick={() => addNode('planner')} style={{ marginRight: 6, padding: '4px 8px', cursor: 'pointer', background: '#e9d5ff', border: '1px solid #a855f7' }}>+ Planner</button>
                    <button onClick={() => addNode('task')} style={{ marginRight: 6, padding: '4px 8px', cursor: 'pointer', background: '#dbeafe', border: '1px solid #3b82f6' }}>+ Task</button>
                    <button onClick={() => addNode('codesearch')} style={{ marginRight: 6, padding: '4px 8px', cursor: 'pointer', background: 'rgba(6, 182, 212, 0.15)', border: '1px solid #06b6d4', color: '#06b6d4' }}>+ Code Search</button>
                    <button onClick={() => addNode('verify')} style={{ marginRight: 6, padding: '4px 8px', cursor: 'pointer', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', color: '#f59e0b' }}>+ Verify Gate</button>
                    <button onClick={() => addNode('openclaw')} style={{ padding: '4px 8px', cursor: 'pointer', background: 'rgba(255, 90, 54, 0.15)', border: '1px solid #ff5a36', color: '#ff5a36', borderRadius: 'var(--radius-sm)' }}>+ OpenClaw</button>
                </Panel>
            </ReactFlow>
        </div>
    );
}
