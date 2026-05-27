import path from 'path';
import { app } from 'electron';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const sqliteVec = require('sqlite-vec');

export class DatabaseService {
    private db: any = null;
    private dbPath: string;

    constructor() {
        console.log('[DatabaseService] Constructor');
        // Store DB in user data directory
        this.dbPath = path.join(app.getPath('userData'), 'cursor-replacer.sqlite');
    }

    async init() {
        // Keeping async signature for compatibility, though better-sqlite3 is sync
        console.log('[DatabaseService] Init', this.dbPath);
        try {
            this.db = new Database(this.dbPath, {
                // verbose: console.log 
            });
            this.db.pragma('journal_mode = WAL');
            
            // Load sqlite-vec extension
            sqliteVec.load(this.db);
            const versionRow = this.db.prepare('SELECT vec_version() AS version').get();
            console.log(`[DatabaseService] sqlite-vec loaded successfully. v${versionRow ? versionRow.version : 'unknown'}`);

            this.runMigrations();
            console.log(`Database initialized at ${this.dbPath}`);
        } catch (err) {
            console.error('Failed to initialize database:', err);
            throw err;
        }
    }

    private runMigrations() {
        if (!this.db) return;

        // Create Memory Table
        this.db.prepare(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL, -- 'project_context', 'preference', 'learning'
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

        // Create Workflows Table
        this.db.prepare(`
      CREATE TABLE IF NOT EXISTS workflows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        steps JSON NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

        // Create VC Tables
        this.db.prepare(`
            CREATE TABLE IF NOT EXISTS vc_blobs (
                hash TEXT PRIMARY KEY,
                content TEXT
            )
        `).run();

        this.db.prepare(`
            CREATE TABLE IF NOT EXISTS vc_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        this.db.prepare(`
            CREATE TABLE IF NOT EXISTS vc_snapshot_files (
                snapshot_id INTEGER,
                file_path TEXT NOT NULL,
                blob_hash TEXT NOT NULL,
                FOREIGN KEY(snapshot_id) REFERENCES vc_snapshots(id),
                FOREIGN KEY(blob_hash) REFERENCES vc_blobs(hash)
            )
        `).run();

        // Create Agents Agent
        this.db.prepare(`
            CREATE TABLE IF NOT EXISTS agents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                system_prompt TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        // Create Flows Table
        this.db.prepare(`
             CREATE TABLE IF NOT EXISTS flows (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                steps JSON NOT NULL,
                agent_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(agent_id) REFERENCES agents(id)
            )
        `).run();

        // Create Custom Providers Table
        this.db.prepare(`
            CREATE TABLE IF NOT EXISTS custom_providers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                base_url TEXT NOT NULL,
                api_key TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        // Create Custom Models Table
        this.db.prepare(`
            CREATE TABLE IF NOT EXISTS custom_models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_id TEXT NOT NULL,
                model_name TEXT NOT NULL,
                has_thinking INTEGER DEFAULT 0,
                UNIQUE(provider_id, model_name)
            )
        `).run();

        // Safety migration to add has_thinking if column doesn't exist
        try {
            this.db.prepare('ALTER TABLE custom_models ADD COLUMN has_thinking INTEGER DEFAULT 0').run();
        } catch (e) {
            // Column already exists, ignore
        }

        // ==========================================
        // AGENTIC platform phase 1 schema migrations
        // ==========================================

        // 1. Hierarchical Task tree
        this.db.prepare(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                priority INTEGER DEFAULT 0,
                parent_task_id INTEGER,
                assigned_agent_id INTEGER,
                created_by TEXT DEFAULT 'user',
                context_budget INTEGER DEFAULT 3000,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                FOREIGN KEY(parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY(assigned_agent_id) REFERENCES agents(id)
            )
        `).run();

        // 2. Task outputs
        this.db.prepare(`
            CREATE TABLE IF NOT EXISTS task_outputs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                agent_id INTEGER,
                output_type TEXT NOT NULL DEFAULT 'text',
                content TEXT NOT NULL,
                token_count INTEGER DEFAULT 0,
                model_used TEXT,
                provider_used TEXT,
                verification_status TEXT DEFAULT 'unverified',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY(agent_id) REFERENCES agents(id)
            )
        `).run();

        // 3. Verification Rules
        this.db.prepare(`
            CREATE TABLE IF NOT EXISTS verification_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                rule_type TEXT NOT NULL,
                trigger_on TEXT NOT NULL DEFAULT 'task_complete',
                config TEXT NOT NULL, -- JSON string
                applies_to TEXT DEFAULT '*',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        // 4. Verification Results
        this.db.prepare(`
            CREATE TABLE IF NOT EXISTS verification_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_output_id INTEGER NOT NULL,
                rule_id INTEGER NOT NULL,
                result TEXT NOT NULL,
                score REAL,
                details TEXT,
                verified_by TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(task_output_id) REFERENCES task_outputs(id) ON DELETE CASCADE,
                FOREIGN KEY(rule_id) REFERENCES verification_rules(id)
            )
        `).run();

        // 5. Raw knowledge chunks
        this.db.prepare(`
            CREATE TABLE IF NOT EXISTS knowledge_chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_type TEXT NOT NULL,
                source_id TEXT,
                content TEXT NOT NULL,
                metadata TEXT, -- JSON string
                token_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        // 6. Vector embeddings (sqlite-vec virtual table)
        this.db.prepare(`
            CREATE VIRTUAL TABLE IF NOT EXISTS vec_knowledge USING vec0(
                chunk_id INTEGER PRIMARY KEY,
                embedding float[1536] distance_metric=cosine
            )
        `).run();

        // 7. Task generated documentation
        this.db.prepare(`
            CREATE TABLE IF NOT EXISTS task_docs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                doc_type TEXT NOT NULL DEFAULT 'completion',
                generated_by TEXT DEFAULT 'auto',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
        `).run();
    }

    // No need for explicit save() in better-sqlite3 (auto-commits)
    save() {
        // No-op
    }

    // API Methods
    addMemory(type: string, content: string) {
        console.assert(type && typeof type === 'string', 'Memory type must be a valid string');
        console.assert(content && typeof content === 'string', 'Memory content must be a valid string');
        if (!this.db) throw new Error('DB not initialized');
        const stmt = this.db.prepare('INSERT INTO memories (type, content) VALUES (?, ?)');
        stmt.run(type, content);
    }

    getMemories(type?: string) {
        if (!this.db) return [];
        const query = type
            ? 'SELECT * FROM memories WHERE type = ? ORDER BY updated_at DESC'
            : 'SELECT * FROM memories ORDER BY updated_at DESC';

        const stmt = this.db.prepare(query);
        return type ? stmt.all(type) : stmt.all();
    }

    // VC Methods
    createSnapshot(name: string) {
        console.assert(name && typeof name === 'string', 'Snapshot name must be a valid string');
        if (!this.db) throw new Error('DB not initialized');
        const stmt = this.db.prepare('INSERT INTO vc_snapshots (name) VALUES (?)');
        const info = stmt.run(name);
        return info.lastInsertRowid;
    }

    addBlob(hash: string, content: string) {
        console.assert(hash && typeof hash === 'string', 'Blob hash must be a valid string');
        console.assert(content && typeof content === 'string', 'Blob content must be a valid string');
        if (!this.db) throw new Error('DB not initialized');
        const stmt = this.db.prepare('INSERT OR IGNORE INTO vc_blobs (hash, content) VALUES (?, ?)');
        stmt.run(hash, content);
    }

    addSnapshotFile(snapshotId: number | bigint, filePath: string, blobHash: string) {
        console.assert(snapshotId !== undefined, 'Snapshot ID is required');
        console.assert(filePath && typeof filePath === 'string', 'File path must be a valid string');
        console.assert(blobHash && typeof blobHash === 'string', 'Blob hash must be a valid string');
        if (!this.db) throw new Error('DB not initialized');
        const stmt = this.db.prepare('INSERT INTO vc_snapshot_files (snapshot_id, file_path, blob_hash) VALUES (?, ?, ?)');
        stmt.run(snapshotId, filePath, blobHash);
    }

    getSnapshots() {
        if (!this.db) return [];
        return this.db.prepare('SELECT * FROM vc_snapshots ORDER BY created_at DESC').all();
    }

    getSnapshotFiles(snapshotId: number) {
        if (!this.db) return [];
        return this.db.prepare(`
            SELECT f.file_path, b.content 
            FROM vc_snapshot_files f
            JOIN vc_blobs b ON f.blob_hash = b.hash
            WHERE f.snapshot_id = ?
        `).all(snapshotId);
    }

    deleteMemory(id: number) {
        if (!this.db) throw new Error('DB not initialized');
        this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    }

    // Agent Methods
    addAgent(name: string, systemPrompt: string) {
        console.assert(name && typeof name === 'string', 'Agent name must be a valid string');
        console.assert(systemPrompt && typeof systemPrompt === 'string', 'System prompt must be a valid string');
        if (!this.db) throw new Error('DB not initialized');
        this.db.prepare('INSERT INTO agents (name, system_prompt) VALUES (?, ?)').run(name, systemPrompt);
    }

    getAgents() {
        if (!this.db) return [];
        return this.db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all();
    }

    deleteAgent(id: number) {
        if (!this.db) throw new Error('DB not initialized');
        this.db.prepare('DELETE FROM agents WHERE id = ?').run(id);
    }

    // Flow Methods
    addFlow(name: string, description: string, steps: string[], agentId?: number) {
        console.assert(name && typeof name === 'string', 'Flow name must be a valid string');
        console.assert(Array.isArray(steps), 'Steps must be an array of strings');
        if (!this.db) throw new Error('DB not initialized');
        this.db.prepare('INSERT INTO flows (name, description, steps, agent_id) VALUES (?, ?, ?, ?)').run(
            name,
            description,
            JSON.stringify(steps),
            agentId || null
        );
    }

    getFlows() {
        if (!this.db) return [];
        const flows = this.db.prepare(`
            SELECT f.*, a.name as agent_name 
            FROM flows f 
            LEFT JOIN agents a ON f.agent_id = a.id 
            ORDER BY f.created_at DESC
        `).all();
        return flows.map((f: any) => ({ ...f, steps: JSON.parse(f.steps) }));
    }

    deleteFlow(id: number) {
        if (!this.db) throw new Error('DB not initialized');
        this.db.prepare('DELETE FROM flows WHERE id = ?').run(id);
    }

    updateFlow(id: number, steps: string[]) {
        console.assert(Array.isArray(steps), 'Steps must be an array of strings');
        if (!this.db) throw new Error('DB not initialized');
        this.db.prepare('UPDATE flows SET steps = ? WHERE id = ?').run(JSON.stringify(steps), id);
    }

    // Custom Providers Methods
    addCustomProvider(id: string, name: string, baseUrl: string, apiKey?: string) {
        console.assert(id && typeof id === 'string', 'Provider ID is required');
        console.assert(name && typeof name === 'string', 'Provider Name is required');
        console.assert(baseUrl && typeof baseUrl === 'string', 'Provider Base URL is required');
        if (!this.db) throw new Error('DB not initialized');
        this.db.prepare('INSERT OR REPLACE INTO custom_providers (id, name, base_url, api_key) VALUES (?, ?, ?, ?)')
            .run(id, name, baseUrl, apiKey || null);
    }

    getCustomProviders() {
        if (!this.db) return [];
        return this.db.prepare('SELECT * FROM custom_providers ORDER BY created_at DESC').all();
    }

    deleteCustomProvider(id: string) {
        if (!this.db) throw new Error('DB not initialized');
        this.db.prepare('DELETE FROM custom_providers WHERE id = ?').run(id);
        this.db.prepare('DELETE FROM custom_models WHERE provider_id = ?').run(id);
    }

    // Custom Models Methods
    addCustomModel(providerId: string, modelName: string, hasThinking: number = 0) {
        console.assert(providerId && typeof providerId === 'string', 'Provider ID must be a valid string');
        console.assert(modelName && typeof modelName === 'string', 'Model Name must be a valid string');
        if (!this.db) throw new Error('DB not initialized');
        this.db.prepare('INSERT INTO custom_models (provider_id, model_name, has_thinking) VALUES (?, ?, ?) ON CONFLICT(provider_id, model_name) DO UPDATE SET has_thinking = excluded.has_thinking')
            .run(providerId, modelName, hasThinking);
    }

    getCustomModels(providerId?: string) {
        if (!this.db) return [];
        if (providerId) {
            return this.db.prepare('SELECT * FROM custom_models WHERE provider_id = ? ORDER BY model_name ASC').all(providerId);
        }
        return this.db.prepare('SELECT * FROM custom_models ORDER BY model_name ASC').all();
    }

    toggleCustomModelThinking(providerId: string, modelName: string, hasThinking: number) {
        if (!this.db) throw new Error('DB not initialized');
        this.db.prepare('UPDATE custom_models SET has_thinking = ? WHERE provider_id = ? AND model_name = ?')
            .run(hasThinking, providerId, modelName);
    }

    deleteCustomModel(providerId: string, modelName: string) {
        if (!this.db) throw new Error('DB not initialized');
        this.db.prepare('DELETE FROM custom_models WHERE provider_id = ? AND model_name = ?').run(providerId, modelName);
    }

    // ==========================================
    // AGENTIC platform DB methods (Phase 1 API)
    // ==========================================

    // 1. Task Operations
    createTask(title: string, description: string | null, parentTaskId?: number | null, assignedAgentId?: number | null, createdBy: string = 'user', contextBudget: number = 3000, priority: number = 0) {
        console.assert(title && typeof title === 'string', 'Task title must be a valid string');
        console.assert(typeof createdBy === 'string', 'createdBy must be a string');
        console.assert(typeof contextBudget === 'number' && contextBudget > 0, 'contextBudget must be a positive number');
        if (!this.db) throw new Error('DB not initialized');
        
        const stmt = this.db.prepare(`
            INSERT INTO tasks (title, description, parent_task_id, assigned_agent_id, created_by, context_budget, priority)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(title, description, parentTaskId || null, assignedAgentId || null, createdBy, contextBudget, priority);
        return info.lastInsertRowid;
    }

    updateTaskStatus(id: number, status: string) {
        console.assert(typeof id === 'number', 'Task ID must be a number');
        console.assert(['pending', 'in_progress', 'completed', 'failed', 'blocked'].includes(status), 'Invalid task status');
        if (!this.db) throw new Error('DB not initialized');

        const completedAt = status === 'completed' ? new Date().toISOString() : null;
        this.db.prepare(`
            UPDATE tasks 
            SET status = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(status, completedAt, id);
    }

    getTask(id: number) {
        console.assert(typeof id === 'number', 'Task ID must be a number');
        if (!this.db) return null;
        return this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    }

    getTaskTree() {
        if (!this.db) return [];
        // Pull all tasks and we can assemble the tree structure in TS
        return this.db.prepare('SELECT * FROM tasks ORDER BY created_at ASC').all();
    }

    getSubtasks(parentTaskId: number) {
        console.assert(typeof parentTaskId === 'number', 'Parent Task ID must be a number');
        if (!this.db) return [];
        return this.db.prepare('SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at ASC').all(parentTaskId);
    }

    // 2. Task Outputs
    addTaskOutput(taskId: number, content: string, agentId?: number | null, outputType: string = 'text', tokenCount: number = 0, modelUsed?: string | null, providerUsed?: string | null) {
        console.assert(typeof taskId === 'number', 'Task ID must be a number');
        console.assert(content && typeof content === 'string', 'Content must be a valid string');
        if (!this.db) throw new Error('DB not initialized');

        const stmt = this.db.prepare(`
            INSERT INTO task_outputs (task_id, agent_id, output_type, content, token_count, model_used, provider_used)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(taskId, agentId || null, outputType, content, tokenCount, modelUsed || null, providerUsed || null);
        return info.lastInsertRowid;
    }

    updateTaskOutputVerification(id: number, status: string) {
        console.assert(typeof id === 'number', 'Output ID must be a number');
        console.assert(['unverified', 'passed', 'failed', 'needs_review'].includes(status), 'Invalid verification status');
        if (!this.db) throw new Error('DB not initialized');

        this.db.prepare('UPDATE task_outputs SET verification_status = ? WHERE id = ?').run(status, id);
    }

    getTaskOutputs(taskId: number) {
        console.assert(typeof taskId === 'number', 'Task ID must be a number');
        if (!this.db) return [];
        return this.db.prepare('SELECT * FROM task_outputs WHERE task_id = ? ORDER BY created_at DESC').all(taskId);
    }

    // 3. Verification Rules
    addVerificationRule(name: string, description: string | null, ruleType: string, triggerOn: string, config: object, appliesTo: string = '*') {
        console.assert(name && typeof name === 'string', 'Rule name is required');
        console.assert(['pattern', 'llm_judge', 'human'].includes(ruleType), 'Invalid rule type');
        if (!this.db) throw new Error('DB not initialized');

        const stmt = this.db.prepare(`
            INSERT INTO verification_rules (name, description, rule_type, trigger_on, config, applies_to)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(name, description, ruleType, triggerOn, JSON.stringify(config), appliesTo);
        return info.lastInsertRowid;
    }

    getVerificationRules() {
        if (!this.db) return [];
        const rules = this.db.prepare('SELECT * FROM verification_rules').all();
        return rules.map((r: any) => ({ ...r, config: JSON.parse(r.config) }));
    }

    // 4. Verification Results
    addVerificationResult(taskOutputId: number, ruleId: number, result: string, score: number | null, details: string | null, verifiedBy: string) {
        console.assert(typeof taskOutputId === 'number', 'Task Output ID must be a number');
        console.assert(typeof ruleId === 'number', 'Rule ID must be a number');
        console.assert(['passed', 'failed', 'pending_review'].includes(result), 'Invalid verification result');
        if (!this.db) throw new Error('DB not initialized');

        const stmt = this.db.prepare(`
            INSERT INTO verification_results (task_output_id, rule_id, result, score, details, verified_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(taskOutputId, ruleId, result, score, details, verifiedBy);
        return info.lastInsertRowid;
    }

    getVerificationResults(taskOutputId: number) {
        console.assert(typeof taskOutputId === 'number', 'Task Output ID must be a number');
        if (!this.db) return [];
        return this.db.prepare('SELECT * FROM verification_results WHERE task_output_id = ?').all(taskOutputId);
    }

    // 5. RAG: Knowledge Chunks & sqlite-vec KNN Search
    addKnowledgeChunk(sourceType: string, sourceId: string | null, content: string, metadata: object, tokenCount: number = 0, embedding?: number[] | Float32Array) {
        console.assert(sourceType && typeof sourceType === 'string', 'Source type is required');
        console.assert(content && typeof content === 'string', 'Chunk content is required');
        if (!this.db) throw new Error('DB not initialized');

        // Execute in transaction to ensure virtual vec0 index matches perfectly
        const runTx = this.db.transaction((embData?: Float32Array) => {
            const chunkStmt = this.db.prepare(`
                INSERT INTO knowledge_chunks (source_type, source_id, content, metadata, token_count)
                VALUES (?, ?, ?, ?, ?)
            `);
            const chunkInfo = chunkStmt.run(sourceType, sourceId, content, JSON.stringify(metadata), tokenCount);
            const chunkId = chunkInfo.lastInsertRowid;

            if (embData) {
                const vecStmt = this.db.prepare(`
                    INSERT INTO vec_knowledge (chunk_id, embedding)
                    VALUES (?, ?)
                `);
                // Binding vector as a Float32Array raw buffer as sqlite-vec expects
                vecStmt.run(chunkId, embData.buffer);
            }
            return chunkId;
        });

        let floatArray: Float32Array | undefined;
        if (embedding) {
            floatArray = embedding instanceof Float32Array ? embedding : new Float32Array(embedding);
            console.assert(floatArray.length === 1536, 'Vector embedding must have exactly 1536 dimensions');
        }

        return runTx(floatArray);
    }

    searchKnowledge(queryEmbedding: number[] | Float32Array, limit: number = 10) {
        console.assert(limit > 0, 'Limit must be positive');
        if (!this.db) return [];

        const floatArray = queryEmbedding instanceof Float32Array ? queryEmbedding : new Float32Array(queryEmbedding);
        console.assert(floatArray.length === 1536, 'Query vector must have exactly 1536 dimensions');

        // KNN semantic search via match inside virtual table joining raw chunks
        const stmt = this.db.prepare(`
            SELECT 
                k.id,
                k.source_type,
                k.source_id,
                k.content,
                k.metadata,
                k.token_count,
                v.distance
            FROM vec_knowledge v
            JOIN knowledge_chunks k ON v.chunk_id = k.id
            WHERE v.embedding MATCH ? AND v.k = ?
            ORDER BY v.distance ASC
        `);

        const results = stmt.all(floatArray.buffer, limit);
        return results.map((r: any) => ({
            ...r,
            metadata: r.metadata ? JSON.parse(r.metadata) : {}
        }));
    }

    // 6. Task Docs
    addTaskDoc(taskId: number, title: string, content: string, docType: string = 'completion', generatedBy: string = 'auto') {
        console.assert(typeof taskId === 'number', 'Task ID must be a number');
        console.assert(title && typeof title === 'string', 'Title must be a valid string');
        console.assert(content && typeof content === 'string', 'Doc content is required');
        if (!this.db) throw new Error('DB not initialized');

        const stmt = this.db.prepare(`
            INSERT INTO task_docs (task_id, title, content, doc_type, generated_by)
            VALUES (?, ?, ?, ?, ?)
        `);
        const info = stmt.run(taskId, title, content, docType, generatedBy);
        return info.lastInsertRowid;
    }

    getTaskDocs(taskId: number) {
        console.assert(typeof taskId === 'number', 'Task ID must be a number');
        if (!this.db) return [];
        return this.db.prepare('SELECT * FROM task_docs WHERE task_id = ? ORDER BY created_at DESC').all(taskId);
    }
}

export const dbService = new DatabaseService();

