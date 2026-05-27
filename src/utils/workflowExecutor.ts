import { Node, Edge, getOutgoers } from 'reactflow';

export interface WorkflowAction {
    type: 'log' | 'agent' | 'tool' | 'planner' | 'task' | 'finish' | 'openclaw' | 'parallel' | 'codesearch' | 'verify';
    message?: string;
    nodeId?: string;
    agentConfig?: { name: string; prompt: string };
    toolConfig?: { name: string; description: string; type: string };
    plannerConfig?: { goal: string };
    taskConfig?: { label: string; description?: string; assignee?: string };
    openClawConfig?: { message: string; thinkingDepth?: 'low' | 'medium' | 'high' };
    codeSearchConfig?: { query: string; searchType: 'symbols' | 'refs' | 'hierarchy' };
    verifyConfig?: { ruleId: number };
    actions?: WorkflowAction[];
}

export async function* executeWorkflow(nodes: Node[], edges: Edge[], initialContext: any): AsyncGenerator<WorkflowAction, void, any> {
    const startNode = nodes.find(n => n.type === 'input' || n.data?.label?.toLowerCase().includes('start'));

    if (!startNode) {
        yield { type: 'log', message: 'Error: No Start node found.' };
        return;
    }

    // A frontier of nodes currently executing
    let frontier: Node[] = [startNode];
    let context = initialContext;

    // Track completed nodes to prevent cycles
    const visited = new Set<string>();

    while (frontier.length > 0) {
        // Log executing nodes
        const labels = frontier.map(n => n.data.label).join(', ');
        yield { type: 'log', message: `Executing Node(s): ${labels}` };

        let responses: any[];

        if (frontier.length === 1) {
            const node = frontier[0];
            if (visited.has(node.id)) {
                // Prevent infinite loop
                frontier = [];
                continue;
            }
            visited.add(node.id);

            const action = getNodeAction(node);
            if (action.type === 'log') {
                // Start Node or bypass node doesn't yield for external completes
                responses = ['Start Completed'];
            } else {
                const response = yield action;
                responses = [response];
            }
        } else {
            // Execute multiple nodes concurrently
            const parallelNodes = [...frontier];
            const filterNodes = parallelNodes.filter(n => {
                if (visited.has(n.id)) return false;
                visited.add(n.id);
                return true;
            });

            if (filterNodes.length === 0) {
                frontier = [];
                continue;
            }

            const parallelResponses = yield {
                type: 'parallel',
                actions: filterNodes.map(node => ({
                    ...getNodeAction(node),
                    nodeId: node.id
                }))
            };
            responses = Array.isArray(parallelResponses) ? parallelResponses : [parallelResponses];
        }

        // Advance frontier to all outgoing nodes of current frontier
        let nextFrontier: Node[] = [];
        for (let i = 0; i < frontier.length; i++) {
            const node = frontier[i];
            const resp = responses[i] !== undefined ? responses[i] : 'Task Completed';

            // Merge output to context
            context = { ...context, [node.id]: resp, lastOutput: resp };

            const outgoers = getOutgoers(node, nodes, edges);
            for (const out of outgoers) {
                if (!visited.has(out.id) && !nextFrontier.some(fn => fn.id === out.id)) {
                    nextFrontier.push(out);
                }
            }
        }

        frontier = nextFrontier;
    }

    yield { type: 'finish', message: 'Workflow completed successfully.' };
}

function getNodeAction(node: Node): WorkflowAction {
    if (node.type === 'agent') {
        return {
            type: 'agent',
            nodeId: node.id,
            agentConfig: {
                name: node.data.label,
                prompt: node.data.prompt
            }
        };
    }
    if (node.type === 'codesearch') {
        return {
            type: 'codesearch',
            nodeId: node.id,
            codeSearchConfig: {
                query: node.data.query,
                searchType: node.data.searchType
            }
        };
    }
    if (node.type === 'verify') {
        return {
            type: 'verify',
            nodeId: node.id,
            verifyConfig: {
                ruleId: node.data.ruleId
            }
        };
    }
    if (node.type === 'openclaw') {
        return {
            type: 'openclaw',
            nodeId: node.id,
            openClawConfig: {
                message: node.data.message || node.data.label,
                thinkingDepth: node.data.thinkingDepth || 'medium'
            }
        };
    }
    if (node.type === 'tool') {
        return {
            type: 'tool',
            nodeId: node.id,
            toolConfig: {
                name: node.data.label,
                description: node.data.description,
                type: 'generic'
            }
        };
    }
    if (node.type === 'planner') {
        return {
            type: 'planner',
            nodeId: node.id,
            plannerConfig: {
                goal: node.data.goal
            }
        };
    }
    if (node.type === 'task') {
        return {
            type: 'task',
            nodeId: node.id,
            taskConfig: {
                label: node.data.label,
                description: node.data.description,
                assignee: node.data.assignee
            }
        };
    }
    return {
        type: 'log',
        nodeId: node.id,
        message: `Start: ${node.data.label || 'Start Flow'}`
    };
}
