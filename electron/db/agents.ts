import { secureStore } from '../secureStore';
import { checkArgs, assertNonNull } from '../../src/helpers/invariant';

export function getAgentRules(db: any) {
    if (!db) return [];
    return db.prepare('SELECT * FROM agent_rules ORDER BY created_at DESC').all();
}

export function addAgentRule(db: any, name: string, content: string, isActive: number = 1) {
    checkArgs(typeof name === 'string' && name.length > 0, 'Rule name must be a valid non-empty string');
    checkArgs(typeof content === 'string' && content.length > 0, 'Rule content must be a valid non-empty string');
    if (!db) throw new Error('DB not initialized');
    const stmt = db.prepare('INSERT INTO agent_rules (name, content, is_active) VALUES (?, ?, ?)');
    const info = stmt.run(name, content, isActive);
    return info.lastInsertRowid;
}

export function updateAgentRule(db: any, id: number, name: string, content: string, isActive: number) {
    checkArgs(typeof id === 'number', 'Rule ID must be a number');
    checkArgs(typeof name === 'string' && name.length > 0, 'Rule name must be a valid non-empty string');
    checkArgs(typeof content === 'string' && content.length > 0, 'Rule content must be a valid non-empty string');
    if (!db) throw new Error('DB not initialized');
    db.prepare('UPDATE agent_rules SET name = ?, content = ?, is_active = ? WHERE id = ?')
        .run(name, content, isActive, id);
}

export function deleteAgentRule(db: any, id: number) {
    checkArgs(typeof id === 'number', 'Rule ID must be a number');
    if (!db) throw new Error('DB not initialized');
    db.prepare('DELETE FROM agent_rules WHERE id = ?').run(id);
}

export function toggleAgentRule(db: any, id: number, isActive: number) {
    checkArgs(typeof id === 'number', 'Rule ID must be a number');
    if (!db) throw new Error('DB not initialized');
    db.prepare('UPDATE agent_rules SET is_active = ? WHERE id = ?').run(isActive, id);
}

export function addAgent(db: any, name: string, systemPrompt: string) {
    checkArgs(typeof name === 'string' && name.length > 0, 'Agent name must be a valid non-empty string');
    checkArgs(typeof systemPrompt === 'string' && systemPrompt.length > 0, 'System prompt must be a valid non-empty string');
    if (!db) throw new Error('DB not initialized');
    db.prepare('INSERT INTO agents (name, system_prompt) VALUES (?, ?)').run(name, systemPrompt);
}

export function getAgents(db: any) {
    if (!db) return [];
    return db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all();
}

export function deleteAgent(db: any, id: number) {
    checkArgs(typeof id === 'number', 'Agent ID must be a number');
    if (!db) throw new Error('DB not initialized');
    db.prepare('DELETE FROM agents WHERE id = ?').run(id);
}

export function addFlow(db: any, name: string, description: string, steps: string[], agentId?: number) {
    checkArgs(typeof name === 'string' && name.length > 0, 'Flow name must be a valid non-empty string');
    checkArgs(Array.isArray(steps), 'Steps must be an array of strings');
    if (!db) throw new Error('DB not initialized');
    db.prepare('INSERT INTO flows (name, description, steps, agent_id) VALUES (?, ?, ?, ?)').run(
        name,
        description,
        JSON.stringify(steps),
        agentId || null
    );
}

export function getFlows(db: any) {
    if (!db) return [];
    const flows = db.prepare(`
        SELECT f.*, a.name as agent_name 
        FROM flows f 
        LEFT JOIN agents a ON f.agent_id = a.id 
        ORDER BY f.created_at DESC
    `).all();
    assertNonNull(flows, 'Flows from db query');
    return flows.map((f: any) => ({ ...f, steps: JSON.parse(f.steps) }));
}

export function deleteFlow(db: any, id: number) {
    checkArgs(typeof id === 'number', 'Flow ID must be a number');
    if (!db) throw new Error('DB not initialized');
    db.prepare('DELETE FROM flows WHERE id = ?').run(id);
}

export function updateFlow(db: any, id: number, steps: string[]) {
    checkArgs(typeof id === 'number', 'Flow ID must be a number');
    checkArgs(Array.isArray(steps), 'Steps must be an array of strings');
    if (!db) throw new Error('DB not initialized');
    db.prepare('UPDATE flows SET steps = ? WHERE id = ?').run(JSON.stringify(steps), id);
}

export function addCustomProvider(db: any, id: string, name: string, baseUrl: string, apiKey?: string, isLocal: boolean = false) {
    checkArgs(typeof id === 'string' && id.length > 0, 'Provider ID is required');
    checkArgs(typeof name === 'string' && name.length > 0, 'Provider Name is required');
    checkArgs(typeof baseUrl === 'string' && baseUrl.length > 0, 'Provider Base URL is required');
    if (!db) throw new Error('DB not initialized');

    if (apiKey && apiKey.trim().length > 0) {
        secureStore.setCustomProviderKey(id, apiKey);
    }

    db.prepare('INSERT OR REPLACE INTO custom_providers (id, name, base_url, api_key, is_local) VALUES (?, ?, ?, NULL, ?)')
        .run(id, name, baseUrl, isLocal ? 1 : 0);
}

export function getCustomProviders(db: any) {
    if (!db) return [];
    return db.prepare('SELECT * FROM custom_providers ORDER BY created_at DESC').all();
}

export function deleteCustomProvider(db: any, id: string) {
    if (!db) throw new Error('DB not initialized');
    db.prepare('DELETE FROM custom_providers WHERE id = ?').run(id);
    db.prepare('DELETE FROM custom_models WHERE provider_id = ?').run(id);
    secureStore.deleteCustomProviderKey(id);
}

export function addCustomModel(db: any, providerId: string, modelName: string, hasThinking: number = 0) {
    checkArgs(typeof providerId === 'string' && providerId.length > 0, 'Provider ID must be a valid non-empty string');
    checkArgs(typeof modelName === 'string' && modelName.length > 0, 'Model Name must be a valid non-empty string');
    if (!db) throw new Error('DB not initialized');
    db.prepare('INSERT INTO custom_models (provider_id, model_name, has_thinking) VALUES (?, ?, ?) ON CONFLICT(provider_id, model_name) DO UPDATE SET has_thinking = excluded.has_thinking')
        .run(providerId, modelName, hasThinking);
}

export function getCustomModels(db: any, providerId?: string) {
    if (!db) return [];
    if (providerId) {
        return db.prepare('SELECT * FROM custom_models WHERE provider_id = ? ORDER BY model_name ASC').all(providerId);
    }
    return db.prepare('SELECT * FROM custom_models ORDER BY model_name ASC').all();
}

export function toggleCustomModelThinking(db: any, providerId: string, modelName: string, hasThinking: number) {
    if (!db) throw new Error('DB not initialized');
    db.prepare('UPDATE custom_models SET has_thinking = ? WHERE provider_id = ? AND model_name = ?')
        .run(hasThinking, providerId, modelName);
}

export function deleteCustomModel(db: any, providerId: string, modelName: string) {
    if (!db) throw new Error('DB not initialized');
    db.prepare('DELETE FROM custom_models WHERE provider_id = ? AND model_name = ?').run(providerId, modelName);
}
