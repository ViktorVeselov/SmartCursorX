import { dbService } from '../db';
import { secureStore } from '../secureStore';
import { liteLLMService } from '../services/LiteLLMService';
import { DocumentationService } from '../services/DocumentationService';
import { VerificationService } from '../services/VerificationService';
import { TaskService } from '../services/TaskService';
import { ContextAssembler } from '../services/ContextAssembler';
import { checkArgs, assertNonNull } from '../../src/helpers/invariant';

export function registerDBHandlers(ipcMain: Electron.IpcMain) {
    // Memories
    ipcMain.handle('db-add-memory', (_event, type: string, content: string) => {
        if (!content) throw new Error('Memory content cannot be empty');
        dbService.addMemory(type, content);
        return true;
    });

    ipcMain.handle('db-get-memories', (_event, type?: string) => {
        return dbService.getMemories(type);
    });

    ipcMain.handle('db-delete-memory', (_event, id: number) => {
        checkArgs(typeof id === 'number', 'Memory id must be a number');
        dbService.deleteMemory(id);
        return true;
    });

    // Agents
    ipcMain.handle('db-get-agents', () => dbService.getAgents());
    ipcMain.handle('db-add-agent', (_event, name: string, prompt: string) => {
        checkArgs(typeof name === 'string' && name.length > 0, 'Agent name must be a non-empty string');
        checkArgs(typeof prompt === 'string', 'Agent prompt must be a string');
        dbService.addAgent(name, prompt);
        return true;
    });
    ipcMain.handle('db-delete-agent', (_event, id: number) => {
        checkArgs(typeof id === 'number', 'Agent id must be a number');
        dbService.deleteAgent(id);
        return true;
    });

    // Flows
    ipcMain.handle('db-get-flows', () => dbService.getFlows());
    ipcMain.handle('db-add-flow', (_event, name: string, desc: string, steps: string[], agentId?: number) => {
        checkArgs(typeof name === 'string' && name.length > 0, 'Flow name must be a non-empty string');
        checkArgs(Array.isArray(steps), 'Flow steps must be an array');
        dbService.addFlow(name, desc, steps, agentId);
        return true;
    });
    ipcMain.handle('db-delete-flow', (_event, id: number) => {
        checkArgs(typeof id === 'number', 'Flow id must be a number');
        dbService.deleteFlow(id);
        return true;
    });
    ipcMain.handle('db-update-flow', (_event, id: number, steps: string[]) => {
        checkArgs(typeof id === 'number', 'Flow id must be a number');
        checkArgs(Array.isArray(steps), 'Flow steps must be an array');
        dbService.updateFlow(id, steps);
        return true;
    });

    // Custom Providers
    ipcMain.handle('ai:get-custom-providers', () => {
        return dbService.getCustomProviders();
    });
    ipcMain.handle('ai:get-provider-key', (_event, providerId: string) => {
        checkArgs(typeof providerId === 'string', 'providerId must be a string');
        const customProviders = dbService.getCustomProviders();
        const isCustom = customProviders.some((p: any) => p.id === providerId);
        if (isCustom) {
            return secureStore.getCustomProviderKey(providerId);
        }
        return secureStore.getApiKey(providerId);
    });
    ipcMain.handle('ai:add-custom-provider', (_event, id: string, name: string, baseUrl: string, apiKey?: string, isLocal?: boolean) => {
        checkArgs(typeof id === 'string' && id.length > 0, 'Custom provider id must be a non-empty string');
        checkArgs(typeof name === 'string' && name.length > 0, 'Custom provider name must be a non-empty string');
        checkArgs(typeof baseUrl === 'string' && baseUrl.length > 0, 'Custom provider baseUrl must be a non-empty string');
        dbService.addCustomProvider(id, name, baseUrl, apiKey, !!isLocal);
        return true;
    });
    ipcMain.handle('ai:delete-custom-provider', (_event, id: string) => {
        checkArgs(typeof id === 'string' && id.length > 0, 'Custom provider id must be a non-empty string');
        dbService.deleteCustomProvider(id);
        return true;
    });

    // Custom Models
    ipcMain.handle('ai:get-custom-models', (_event, providerId?: string) => {
        return dbService.getCustomModels(providerId);
    });
    ipcMain.handle('ai:add-custom-model', (_event, providerId: string, modelName: string, hasThinking?: boolean) => {
        checkArgs(typeof providerId === 'string' && providerId.length > 0, 'Custom model providerId must be a non-empty string');
        checkArgs(typeof modelName === 'string' && modelName.length > 0, 'Custom model name must be a non-empty string');
        dbService.addCustomModel(providerId, modelName, hasThinking ? 1 : 0);
        return true;
    });
    ipcMain.handle('ai:toggle-model-thinking', (_event, providerId: string, modelName: string, hasThinking: boolean) => {
        checkArgs(typeof providerId === 'string' && providerId.length > 0, 'Custom model providerId must be a non-empty string');
        checkArgs(typeof modelName === 'string' && modelName.length > 0, 'Custom model name must be a non-empty string');
        dbService.toggleCustomModelThinking(providerId, modelName, hasThinking ? 1 : 0);
        return true;
    });
    ipcMain.handle('ai:delete-custom-model', (_event, providerId: string, modelName: string) => {
        checkArgs(typeof providerId === 'string' && providerId.length > 0, 'Custom model providerId must be a non-empty string');
        checkArgs(typeof modelName === 'string' && modelName.length > 0, 'Custom model name must be a non-empty string');
        dbService.deleteCustomModel(providerId, modelName);
        return true;
    });

    // LiteLLM
    ipcMain.handle('litellm:get-status', () => {
        return {
            isActive: liteLLMService.isProxyActive()
        };
    });
    ipcMain.handle('litellm:stop', () => {
        liteLLMService.stopProxy();
        return true;
    });
    ipcMain.handle('litellm:start', async (_event, config) => {
        checkArgs(config !== null && typeof config === 'object', 'Proxy config must be an object');
        return await liteLLMService.startProxy(config);
    });

    // Usage & Token tracking
    ipcMain.handle('ai:get-usage-stats', () => {
        return dbService.getUsageStats();
    });
    ipcMain.handle('ai:clear-usage-stats', () => {
        return dbService.clearUsageStats();
    });

    // Agent Rules
    ipcMain.handle('db:get-rules', () => {
        return dbService.getAgentRules();
    });
    ipcMain.handle('db:add-rule', (_event, name: string, content: string, isActive: number) => {
        return dbService.addAgentRule(name, content, isActive);
    });
    ipcMain.handle('db:update-rule', (_event, id: number, name: string, content: string, isActive: number) => {
        return dbService.updateAgentRule(id, name, content, isActive);
    });
    ipcMain.handle('db:delete-rule', (_event, id: number) => {
        dbService.deleteAgentRule(id);
        return true;
    });
    ipcMain.handle('db:toggle-rule', (_event, id: number, isActive: number) => {
        dbService.toggleAgentRule(id, isActive);
        return true;
    });

    // Chat Conversations
    ipcMain.handle('chat:create-conv', (_event, id: string, title: string, model: string, provider: string, workspacePath?: string) => {
        checkArgs(typeof id === 'string' && id.length > 0, 'Conversation id must be a non-empty string');
        checkArgs(typeof title === 'string', 'Conversation title must be a string');
        checkArgs(typeof model === 'string', 'Conversation model must be a string');
        checkArgs(typeof provider === 'string', 'Conversation provider must be a string');
        return dbService.createConversation(id, title, model, provider, workspacePath);
    });
    ipcMain.handle('chat:get-convs', (_event, workspacePath?: string) => {
        return dbService.getConversations(workspacePath);
    });
    ipcMain.handle('chat:get-messages', (_event, conversationId: string) => {
        checkArgs(typeof conversationId === 'string', 'conversationId must be a string');
        return dbService.getConversationMessages(conversationId);
    });
    ipcMain.handle('chat:add-message', (_event, conversationId: string, role: string, content: string) => {
        checkArgs(typeof conversationId === 'string', 'conversationId must be a string');
        checkArgs(typeof role === 'string', 'role must be a string');
        checkArgs(typeof content === 'string', 'content must be a string');
        return dbService.addChatMessage(conversationId, role, content);
    });
    ipcMain.handle('chat:update-message', (_event, conversationId: string, messageId: number, content: string) => {
        checkArgs(typeof conversationId === 'string', 'conversationId must be a string');
        checkArgs(typeof messageId === 'number', 'messageId must be a number');
        checkArgs(typeof content === 'string', 'content must be a string');
        return dbService.updateChatMessage(conversationId, messageId, content);
    });
    ipcMain.handle('chat:fork-conv', async (_event, conversationId: string) => {
        checkArgs(typeof conversationId === 'string' && conversationId.length > 0, 'conversationId must be a non-empty string');
        const originalMessages = dbService.getConversationMessages(conversationId);
        assertNonNull(originalMessages, 'originalMessages from db.getConversationMessages');
        const conversations = dbService.getConversations();
        const originalConv = conversations.find((c: any) => c.id === conversationId);
        if (!originalConv) {
            throw new Error('Original conversation not found');
        }
        const forkId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const forkTitle = `[Fork] ${originalConv.title || 'Untitled Chat'}`;
        dbService.createConversation(forkId, forkTitle, originalConv.model, originalConv.provider, originalConv.workspace_path);
        for (const msg of originalMessages) {
            dbService.addChatMessage(forkId, msg.role, msg.content);
        }
        try {
            const originalTaskId = getNumericTaskId(conversationId);
            const originalPlan = dbService.getTaskPlan(originalTaskId);
            if (originalPlan) {
                const forkTaskId = getNumericTaskId(forkId);
                dbService.updateTaskPlanJson(forkTaskId, originalPlan.plan_json);
            }
        } catch (planErr) {
            console.error('Failed to fork associated task plan:', planErr);
        }
        return forkId;
    });
    ipcMain.handle('chat:delete-conv', (_event, conversationId: string) => {
        checkArgs(typeof conversationId === 'string' && conversationId.length > 0, 'conversationId must be a non-empty string');
        return dbService.deleteConversation(conversationId);
    });
    ipcMain.handle('chat:update-title', (_event, conversationId: string, title: string) => {
        checkArgs(typeof conversationId === 'string' && conversationId.length > 0, 'conversationId must be a non-empty string');
        checkArgs(typeof title === 'string', 'title must be a string');
        return dbService.updateConversationTitle(conversationId, title);
    });
    ipcMain.handle('chat:truncate-from-message', async (_event, conversationId: string, messageId: number) => {
        checkArgs(typeof conversationId === 'string', 'conversationId must be a string');
        checkArgs(typeof messageId === 'number', 'messageId must be a number');
        dbService.truncateChatMessages(conversationId, messageId);
        dbService.touchConversation(conversationId);
        return dbService.getConversationMessages(conversationId);
    });

    // Documentation
    ipcMain.handle('doc:generate', async (_event, taskId: number) => {
        checkArgs(typeof taskId === 'number', 'taskId must be a number');
        return DocumentationService.generateTaskDocs(taskId);
    });

    ipcMain.handle('doc:get', async (_event, taskId: number) => {
        checkArgs(typeof taskId === 'number', 'taskId must be a number');
        return dbService.getTaskDocs(taskId);
    });

    // Plan persistence
    ipcMain.handle('plan:get', async (_event, taskId: number) => {
        checkArgs(typeof taskId === 'number', '[plan:get] taskId must be a number');
        const row = dbService.getTaskPlan(taskId);
        if (!row) return null;
        return row;
    });

    ipcMain.handle('plan:save', async (_event, taskId: number, planJson: string) => {
        checkArgs(typeof taskId === 'number', '[plan:save] taskId must be a number');
        checkArgs(typeof planJson === 'string', '[plan:save] planJson must be a string');
        try {
            JSON.parse(planJson);
        } catch (e) {
            throw new Error(`[plan:save] Invalid JSON payload: ${(e as Error).message}`);
        }
        return dbService.updateTaskPlanJson(taskId, planJson);
    });

    ipcMain.handle('secure:list-keys', async () => {
        const { listEncryptedKeys } = await import('../secureStore');
        return listEncryptedKeys();
    });

    ipcMain.handle('test:secure-run', async () => {
        try {
            // @ts-expect-error - implicit any due to lack of declaration file
            const { runTests } = await import('../../scripts/test-secure-store.js');
            await runTests(secureStore, dbService);
            return { success: true };
        } catch (e: any) {
            console.error('[test:secure-run] Error running tests:', e);
            return { success: false, error: e.message };
        }
    });

    // Verification
    ipcMain.handle('verify:run', async (_event, taskOutputId: number) => {
        checkArgs(typeof taskOutputId === 'number', 'taskOutputId must be a number');
        return VerificationService.verifyOutput(taskOutputId);
    });

    ipcMain.handle('verify:get-rules', async () => {
        return dbService.getVerificationRules();
    });

    ipcMain.handle('verify:add-rule', async (_event, name: string, desc: string | null, type: string, triggerOn: string, config: object, appliesTo: string) => {
        return dbService.addVerificationRule(name, desc, type, triggerOn, config, appliesTo);
    });

    ipcMain.handle('verify:get-results', async (_event, outputId: number) => {
        return dbService.getVerificationResults(outputId);
    });

    ipcMain.handle('verify:human-review', async (_event, outputId: number, status: string) => {
        checkArgs(typeof outputId === 'number', 'outputId must be a number');
        checkArgs(['passed', 'failed'].includes(status), 'Status must be passed or failed');
        dbService.updateTaskOutputVerification(outputId, status);
        return true;
    });

    // Tasks
    ipcMain.handle('task:create', async (_event, title: string, desc: string | null, parentId?: number | null, agentId?: number | null, createdBy?: string, budget?: number, priority?: number) => {
        checkArgs(typeof title === 'string' && title.length > 0, 'Task title must be a non-empty string');
        return TaskService.createTask(title, desc, parentId, agentId, createdBy || 'user', budget || 3000, priority || 0);
    });

    ipcMain.handle('task:decompose', async (_event, parentId: number, subtasks: any[]) => {
        checkArgs(typeof parentId === 'number', 'parentId must be a number');
        checkArgs(Array.isArray(subtasks), 'subtasks must be an array');
        return TaskService.decomposeTask(parentId, subtasks);
    });

    ipcMain.handle('task:start', async (_event, taskId: number) => {
        checkArgs(typeof taskId === 'number', 'taskId must be a number');
        TaskService.startTask(taskId);
        return true;
    });

    ipcMain.handle('task:complete', async (_event, taskId: number, content: string, agentId?: number | null, type?: string, tokens?: number, model?: string, provider?: string) => {
        checkArgs(typeof taskId === 'number', 'taskId must be a number');
        checkArgs(typeof content === 'string' && content.length > 0, 'content must be a non-empty string');
        return TaskService.completeTask(taskId, content, agentId, type || 'text', tokens || 0, model, provider);
    });

    ipcMain.handle('task:fail', async (_event, taskId: number, reason: string) => {
        checkArgs(typeof taskId === 'number', 'taskId must be a number');
        checkArgs(typeof reason === 'string' && reason.length > 0, 'reason must be a non-empty string');
        TaskService.failTask(taskId, reason);
        return true;
    });

    ipcMain.handle('task:get-tree', async () => {
        return TaskService.getHierarchicalTasks();
    });

    ipcMain.handle('task:assemble-context', async (_event, taskId: number, messages: any[], budget?: any, conversationId?: string, workspacePath?: string) => {
        checkArgs(typeof taskId === 'number', 'taskId must be a number');
        checkArgs(Array.isArray(messages), 'messages must be an array');
        return ContextAssembler.assembleContext(taskId, messages, budget, conversationId, workspacePath);
    });

    ipcMain.handle('task:get-execution-details', async (_event, taskId: number) => {
        checkArgs(typeof taskId === 'number', 'taskId must be a number');
        return dbService.getTaskExecutionDetails(taskId);
    });
}

function getNumericTaskId(conversationId: string): number {
    if (!conversationId) return 1;
    let hash = 5381;
    for (let i = 0; i < conversationId.length; i++) {
        hash = (hash * 33) ^ conversationId.charCodeAt(i);
    }
    return Math.abs(hash) || 1;
}
