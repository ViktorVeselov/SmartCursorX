import path from 'path';
import { app } from 'electron';
import { createDatabase, createTables, migrateKeysToSecureStore, migrateTaskIds } from './schema';
import {
    createConversation, getConversations, getConversationMessages, addChatMessage,
    updateChatMessage, truncateChatMessages, touchConversation, deleteConversation,
    updateConversationTitle
} from './conversations';
import {
    getAgentRules, addAgentRule, updateAgentRule, deleteAgentRule, toggleAgentRule,
    addAgent, getAgents, deleteAgent,
    addFlow, getFlows, deleteFlow, updateFlow,
    addCustomProvider, getCustomProviders, deleteCustomProvider,
    addCustomModel, getCustomModels, toggleCustomModelThinking, deleteCustomModel,
    addFineTunedModel, getFineTunedModels, getFineTunedModel, deleteFineTunedModel
} from './agents';
import {
    addMemory, getMemories, searchMemories, deleteMemory,
    createSnapshot, getSnapshot, addBlob, addSnapshotFile, getSnapshots, getSnapshotFiles,
    createTask, updateTaskStatus, getTask, getTaskTree, getSubtasks,
    addTaskOutput, updateTaskOutputVerification, getTaskOutputs, getTaskOutput,
    getTaskPlan, updateTaskPlanJson, findPlanByTitle, rollbackTaskPlan, addTaskPlan, updateTaskPlanStatus,
    addTaskDoc, getTaskDocs,
    addExecutionAttempt, getExecutionAttempts, getTaskExecutionDetails,
    addVerificationRule, getVerificationRules, addVerificationResult, getVerificationResults,
    addKnowledgeChunk, searchKnowledge,
    addModelPerformance, getModelPerformanceSummary, getModelPerformanceStats, getUsageStats, clearUsageStats
} from './settings';

export class DatabaseService {
    private db: any = null;
    private dbPath: string;

    constructor() {
        console.log('[DatabaseService] Constructor');
        this.dbPath = path.join(app.getPath('userData'), 'smart-cursor-x.sqlite');
    }

    async init() {
        console.log('[DatabaseService] Init', this.dbPath);
        try {
            this.db = createDatabase(this.dbPath);
            createTables(this.db);
            migrateKeysToSecureStore(this.db);
            migrateTaskIds(this.db);
            console.log(`Database initialized at ${this.dbPath}`);
        } catch (err) {
            console.error('Failed to initialize database:', err);
            throw err;
        }
    }

    save() {
    }

    createConversation(id: string, title: string, model: string, provider: string, workspacePath?: string) {
        return createConversation(this.db, id, title, model, provider, workspacePath);
    }
    getConversations(workspacePath?: string) {
        return getConversations(this.db, workspacePath);
    }
    getWorkspacePathForTask(taskId: number): string | null {
        if (!this.db) return null;
        try {
            const convs = this.db.prepare('SELECT id, workspace_path FROM conversations').all();
            for (const c of convs) {
                if (!c.id) continue;
                let hash = 5381;
                for (let i = 0; i < c.id.length; i++) {
                    hash = (hash * 33) ^ c.id.charCodeAt(i);
                }
                const expectedTaskId = Math.abs(hash) || 1;
                if (expectedTaskId === taskId) {
                    return c.workspace_path || null;
                }
            }
        } catch (e) {
            console.error('[DatabaseService] Failed to lookup workspace path for task:', e);
        }
        return null;
    }
    getConversationMessages(conversationId: string) {
        return getConversationMessages(this.db, conversationId);
    }
    addChatMessage(conversationId: string, role: string, content: string) {
        return addChatMessage(this.db, conversationId, role, content);
    }
    updateChatMessage(conversationId: string, messageId: number, content: string) {
        return updateChatMessage(this.db, conversationId, messageId, content);
    }
    truncateChatMessages(conversationId: string, messageId: number) {
        return truncateChatMessages(this.db, conversationId, messageId);
    }
    touchConversation(conversationId: string) {
        return touchConversation(this.db, conversationId);
    }
    deleteConversation(conversationId: string) {
        return deleteConversation(this.db, conversationId);
    }
    updateConversationTitle(conversationId: string, title: string) {
        return updateConversationTitle(this.db, conversationId, title);
    }

    // ── Agent Rules ──
    getAgentRules() {
        return getAgentRules(this.db);
    }
    addAgentRule(name: string, content: string, isActive?: number) {
        return addAgentRule(this.db, name, content, isActive);
    }
    updateAgentRule(id: number, name: string, content: string, isActive: number) {
        return updateAgentRule(this.db, id, name, content, isActive);
    }
    deleteAgentRule(id: number) {
        return deleteAgentRule(this.db, id);
    }
    toggleAgentRule(id: number, isActive: number) {
        return toggleAgentRule(this.db, id, isActive);
    }

    // ── Agents ──
    addAgent(name: string, systemPrompt: string) {
        return addAgent(this.db, name, systemPrompt);
    }
    getAgents() {
        return getAgents(this.db);
    }
    deleteAgent(id: number) {
        return deleteAgent(this.db, id);
    }

    // ── Flows ──
    addFlow(name: string, description: string, steps: string[], agentId?: number) {
        return addFlow(this.db, name, description, steps, agentId);
    }
    getFlows() {
        return getFlows(this.db);
    }
    deleteFlow(id: number) {
        return deleteFlow(this.db, id);
    }
    updateFlow(id: number, steps: string[]) {
        return updateFlow(this.db, id, steps);
    }

    // ── Custom Providers ──
    addCustomProvider(id: string, name: string, baseUrl: string, apiKey?: string, isLocal?: boolean) {
        return addCustomProvider(this.db, id, name, baseUrl, apiKey, isLocal);
    }
    getCustomProviders() {
        return getCustomProviders(this.db);
    }
    deleteCustomProvider(id: string) {
        return deleteCustomProvider(this.db, id);
    }

    // ── Custom Models ──
    addCustomModel(providerId: string, modelName: string, hasThinking?: number) {
        return addCustomModel(this.db, providerId, modelName, hasThinking);
    }
    getCustomModels(providerId?: string) {
        return getCustomModels(this.db, providerId);
    }
    toggleCustomModelThinking(providerId: string, modelName: string, hasThinking: number) {
        return toggleCustomModelThinking(this.db, providerId, modelName, hasThinking);
    }
    deleteCustomModel(providerId: string, modelName: string) {
        return deleteCustomModel(this.db, providerId, modelName);
    }

    // ── Fine-Tuned Models ──
    addFineTunedModel(model: {
        id: string;
        name: string;
        baseModelId: string;
        baseModelHfRepo: string;
        adapterPath: string;
        backend: 'llamacpp' | 'python';
        quantization: '4bit' | '8bit' | '16bit';
        tags: string[];
    }) {
        return addFineTunedModel(this.db, model);
    }
    getFineTunedModels() {
        return getFineTunedModels(this.db);
    }
    getFineTunedModel(id: string) {
        return getFineTunedModel(this.db, id);
    }
    deleteFineTunedModel(id: string) {
        return deleteFineTunedModel(this.db, id);
    }

    // ── Memories ──
    addMemory(type: string, content: string) {
        return addMemory(this.db, type, content);
    }
    getMemories(type?: string) {
        return getMemories(this.db, type);
    }
    searchMemories(query: string, limit?: number) {
        return searchMemories(this.db, query, limit);
    }
    deleteMemory(id: number) {
        return deleteMemory(this.db, id);
    }

    // ── VC Snapshots ──
    createSnapshot(name: string) {
        return createSnapshot(this.db, name);
    }
    getSnapshot(id: number) {
        return getSnapshot(this.db, id);
    }
    addBlob(hash: string, content: string) {
        return addBlob(this.db, hash, content);
    }
    addSnapshotFile(snapshotId: number | bigint, filePath: string, blobHash: string) {
        return addSnapshotFile(this.db, snapshotId, filePath, blobHash);
    }
    getSnapshots() {
        return getSnapshots(this.db);
    }
    getSnapshotFiles(snapshotId: number) {
        return getSnapshotFiles(this.db, snapshotId);
    }

    // ── Tasks ──
    createTask(title: string, description: string | null, parentTaskId?: number | null, assignedAgentId?: number | null, createdBy?: string, contextBudget?: number, priority?: number) {
        return createTask(this.db, title, description, parentTaskId, assignedAgentId, createdBy, contextBudget, priority);
    }
    updateTaskStatus(id: number, status: string) {
        return updateTaskStatus(this.db, id, status);
    }
    getTask(id: number) {
        return getTask(this.db, id);
    }
    getTaskTree() {
        return getTaskTree(this.db);
    }
    getSubtasks(parentTaskId: number) {
        return getSubtasks(this.db, parentTaskId);
    }

    // ── Task Outputs ──
    addTaskOutput(taskId: number, content: string, agentId?: number | null, outputType?: string, tokenCount?: number, modelUsed?: string | null, providerUsed?: string | null) {
        return addTaskOutput(this.db, taskId, content, agentId, outputType, tokenCount, modelUsed, providerUsed);
    }
    updateTaskOutputVerification(id: number, status: string) {
        return updateTaskOutputVerification(this.db, id, status);
    }
    getTaskOutputs(taskId: number) {
        return getTaskOutputs(this.db, taskId);
    }
    getTaskOutput(id: number) {
        return getTaskOutput(this.db, id);
    }

    // ── Task Plans ──
    getTaskPlan(taskId: number) {
        return getTaskPlan(this.db, taskId);
    }
    updateTaskPlanJson(taskId: number, planJson: string, status?: string, confidence?: number) {
        return updateTaskPlanJson(this.db, taskId, planJson, status, confidence);
    }
    findPlanByTitle(taskId: number, title: string) {
        return findPlanByTitle(this.db, taskId, title);
    }
    rollbackTaskPlan(taskId: number) {
        return rollbackTaskPlan(this.db, taskId);
    }
    addTaskPlan(taskId: number, planJson: string, confidence: number, status?: string) {
        return addTaskPlan(this.db, taskId, planJson, confidence, status);
    }
    updateTaskPlanStatus(planId: number, status: string) {
        return updateTaskPlanStatus(this.db, planId, status);
    }

    // ── Task Docs ──
    addTaskDoc(taskId: number, title: string, content: string, docType?: string, generatedBy?: string) {
        return addTaskDoc(this.db, taskId, title, content, docType, generatedBy);
    }
    getTaskDocs(taskId: number) {
        return getTaskDocs(this.db, taskId);
    }

    // ── Execution Attempts ──
    addExecutionAttempt(taskId: number, attemptNumber: number, modelUsed: string | null, providerUsed: string | null, planId: number | null, outputId: number | null, verificationStatus: string, failureReason: string | null) {
        return addExecutionAttempt(this.db, taskId, attemptNumber, modelUsed, providerUsed, planId, outputId, verificationStatus, failureReason);
    }
    getExecutionAttempts(taskId: number) {
        return getExecutionAttempts(this.db, taskId);
    }
    getTaskExecutionDetails(taskId: number) {
        return getTaskExecutionDetails(this.db, taskId);
    }

    // ── Verification Rules ──
    addVerificationRule(name: string, description: string | null, ruleType: string, triggerOn: string, config: object, appliesTo?: string) {
        return addVerificationRule(this.db, name, description, ruleType, triggerOn, config, appliesTo);
    }
    getVerificationRules() {
        return getVerificationRules(this.db);
    }

    // ── Verification Results ──
    addVerificationResult(taskOutputId: number, ruleId: number, result: string, score: number | null, details: string | null, verifiedBy: string) {
        return addVerificationResult(this.db, taskOutputId, ruleId, result, score, details, verifiedBy);
    }
    getVerificationResults(taskOutputId: number) {
        return getVerificationResults(this.db, taskOutputId);
    }

    // ── Knowledge ──
    addKnowledgeChunk(sourceType: string, sourceId: string | null, content: string, metadata: object, tokenCount?: number, embedding?: number[] | Float32Array) {
        return addKnowledgeChunk(this.db, sourceType, sourceId, content, metadata, tokenCount, embedding);
    }
    searchKnowledge(queryEmbedding: number[] | Float32Array, limit?: number) {
        return searchKnowledge(this.db, queryEmbedding, limit);
    }

    // ── Model Performance ──
    addModelPerformance(model: string, provider: string, taskType: string | null, success: number, attemptNumber: number, tokenCount: number, latencyMs: number, inputTokens?: number, outputTokens?: number) {
        return addModelPerformance(this.db, model, provider, taskType, success, attemptNumber, tokenCount, latencyMs, inputTokens, outputTokens);
    }
    getModelPerformanceSummary() {
        return getModelPerformanceSummary(this.db);
    }
    getModelPerformanceStats(filterProvider?: string, filterModel?: string, filterTaskType?: string) {
        return getModelPerformanceStats(this.db, filterProvider, filterModel, filterTaskType);
    }
    getUsageStats() {
        return getUsageStats(this.db);
    }
    clearUsageStats() {
        return clearUsageStats(this.db);
    }
}

export const dbService = new DatabaseService();
