import { dbService } from '../db';

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

export class TaskService {
    /**
     * Creates a new task and returns its ID.
     */
    static createTask(
        title: string,
        description: string | null,
        parentTaskId?: number | null,
        assignedAgentId?: number | null,
        createdBy: string = 'user',
        contextBudget: number = 3000,
        priority: number = 0
    ): number {
        console.assert(title && typeof title === 'string', 'Title must be a valid string');
        console.assert(contextBudget > 0, 'Context budget must be a positive number');
        
        const id = dbService.createTask(
            title,
            description,
            parentTaskId || null,
            assignedAgentId || null,
            createdBy,
            contextBudget,
            priority
        );
        return Number(id);
    }

    /**
     * Decomposes a task into multiple sequential or parallel child subtasks.
     */
    static decomposeTask(parentTaskId: number, subtasks: Array<{ title: string; description: string | null; priority?: number }>): number[] {
        console.assert(typeof parentTaskId === 'number', 'Parent Task ID must be a number');
        console.assert(Array.isArray(subtasks), 'Subtasks must be an array');

        const parent = dbService.getTask(parentTaskId);
        if (!parent) {
            throw new Error(`Parent task with ID ${parentTaskId} not found`);
        }

        const subtaskIds: number[] = [];
        for (let i = 0; i < subtasks.length; i++) {
            const sub = subtasks[i];
            const id = dbService.createTask(
                sub.title,
                sub.description,
                parentTaskId,
                parent.assigned_agent_id,
                'agent',
                parent.context_budget,
                sub.priority || 0
            );
            subtaskIds.push(Number(id));
        }

        // Auto-transition parent to in_progress upon decomposition
        if (parent.status === 'pending') {
            dbService.updateTaskStatus(parentTaskId, 'in_progress');
        }

        return subtaskIds;
    }

    /**
     * Starts a task execution cycle.
     */
    static startTask(taskId: number): void {
        console.assert(typeof taskId === 'number', 'Task ID must be a number');
        dbService.updateTaskStatus(taskId, 'in_progress');
    }

    /**
     * Completes a task execution cycle, saving the structural output contents.
     */
    static completeTask(
        taskId: number,
        content: string,
        agentId?: number | null,
        outputType: string = 'text',
        tokenCount: number = 0,
        modelUsed?: string | null,
        providerUsed?: string | null
    ): number {
        console.assert(typeof taskId === 'number', 'Task ID must be a number');
        console.assert(content && typeof content === 'string', 'Output content is required');

        // Store output
        const outputId = dbService.addTaskOutput(
            taskId,
            content,
            agentId || null,
            outputType,
            tokenCount,
            modelUsed || null,
            providerUsed || null
        );

        // Transition task status
        dbService.updateTaskStatus(taskId, 'completed');

        // Check if all siblings are completed to optionally auto-complete parent
        this.checkAndCompleteParent(taskId);

        return Number(outputId);
    }

    /**
     * Marks a task execution loop cycle as failed.
     */
    static failTask(taskId: number, reason: string): void {
        console.assert(typeof taskId === 'number', 'Task ID must be a number');
        dbService.updateTaskStatus(taskId, 'failed');
        
        // Log the failure reason as a task output error trace
        dbService.addTaskOutput(taskId, `Failure details: ${reason}`, null, 'error');
    }

    /**
     * Retrieves hierarchical task lists structured as nodes.
     */
    static getHierarchicalTasks(): TaskNode[] {
        const rawTasks: TaskNode[] = dbService.getTaskTree() as TaskNode[];
        const taskMap = new Map<number, TaskNode>();
        const roots: TaskNode[] = [];

        // Map construction
        for (const t of rawTasks) {
            taskMap.set(t.id, { ...t, children: [] });
        }

        // Tree assembly
        for (const t of rawTasks) {
            const mapped = taskMap.get(t.id)!;
            if (t.parent_task_id === null) {
                roots.push(mapped);
            } else {
                const parent = taskMap.get(t.parent_task_id);
                if (parent) {
                    parent.children = parent.children || [];
                    parent.children.push(mapped);
                } else {
                    roots.push(mapped); // fallback safety
                }
            }
        }

        return roots;
    }

    private static checkAndCompleteParent(completedTaskId: number): void {
        const completedTask = dbService.getTask(completedTaskId);
        if (!completedTask || completedTask.parent_task_id === null) return;

        const parentId = completedTask.parent_task_id;
        const siblings = dbService.getSubtasks(parentId) as TaskNode[];

        // If all subtasks of the parent are completed, complete the parent
        const allCompleted = siblings.every(s => s.status === 'completed');
        if (allCompleted) {
            dbService.updateTaskStatus(parentId, 'completed');
            // Recurse upwards
            this.checkAndCompleteParent(parentId);
        }
    }
}
