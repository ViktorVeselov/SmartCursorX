import path from 'path';
import { app } from 'electron';
import { createRequire } from 'module';
import { secureStore } from '../secureStore';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const sqliteVec = require('sqlite-vec');

export function createDatabase(dbPath?: string): any {
    const resolvedPath = dbPath || path.join(app.getPath('userData'), 'cursor-replacer.sqlite');
    const db = new Database(resolvedPath, {});
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('temp_store = MEMORY');
    db.pragma('cache_size = -64000');

    let vecPath = sqliteVec.getLoadablePath();
    if (app.isPackaged) {
        vecPath = vecPath.replace('app.asar', 'app.asar.unpacked');
    }
    db.loadExtension(vecPath);
    const versionRow = db.prepare('SELECT vec_version() AS version').get();
    console.log(`[DatabaseService] sqlite-vec loaded successfully. v${versionRow ? versionRow.version : 'unknown'}`);

    return db;
}

export function createTables(db: any) {
    if (!db) return;

    db.prepare(`
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS workflows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            steps JSON NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS vc_blobs (
            hash TEXT PRIMARY KEY,
            content TEXT
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS vc_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS vc_snapshot_files (
            snapshot_id INTEGER,
            file_path TEXT NOT NULL,
            blob_hash TEXT NOT NULL,
            FOREIGN KEY(snapshot_id) REFERENCES vc_snapshots(id),
            FOREIGN KEY(blob_hash) REFERENCES vc_blobs(hash)
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS agents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            system_prompt TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    db.prepare(`
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

    const defaultFlowSteps = JSON.stringify({
        nodes: [
            { id: 'start', position: { x: 250, y: 50 }, data: { label: 'Start Flow' }, type: 'input' },
            { id: 'codesearch-1', position: { x: 250, y: 150 }, data: { label: 'Investigate Workspace', query: 'Find targets', searchType: 'symbols' }, type: 'codesearch' },
            { id: 'planner-2', position: { x: 250, y: 250 }, data: { label: 'Analyze & Plan Changes', goal: 'Establish non-ambiguous plan skeleton' }, type: 'planner' },
            { id: 'agent-3', position: { x: 250, y: 350 }, data: { label: 'Modify Target Files', prompt: 'Apply planned changes to the code' }, type: 'agent' },
            { id: 'verify-4', position: { x: 250, y: 450 }, data: { label: 'Verify Code and Compile', ruleId: 1 }, type: 'verify' }
        ],
        edges: [
            { id: 'e-start-codesearch', source: 'start', target: 'codesearch-1', animated: true },
            { id: 'e-codesearch-planner', source: 'codesearch-1', target: 'planner-2', animated: true },
            { id: 'e-planner-agent', source: 'planner-2', target: 'agent-3', animated: true },
            { id: 'e-agent-verify', source: 'agent-3', target: 'verify-4', animated: true }
        ]
    });

    db.prepare(`
        INSERT OR IGNORE INTO flows (id, name, description, steps, agent_id)
        VALUES (1, 'Code Changes', 'The default system workflow: investigates files, makes edits, and verifies changes using compilation and linter validation rules.', ?, NULL)
    `).run(defaultFlowSteps);


    db.prepare(`
        CREATE TABLE IF NOT EXISTS custom_providers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            base_url TEXT NOT NULL,
            api_key TEXT,
            is_local INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS custom_models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider_id TEXT NOT NULL,
            model_name TEXT NOT NULL,
            has_thinking INTEGER DEFAULT 0,
            UNIQUE(provider_id, model_name)
        )
    `).run();

    try {
        db.prepare('ALTER TABLE custom_models ADD COLUMN has_thinking INTEGER DEFAULT 0').run();
    } catch (e) {
    }

    try {
        db.prepare('ALTER TABLE custom_providers ADD COLUMN is_local INTEGER DEFAULT 0').run();
    } catch (e) {
    }

    db.prepare(`
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

    db.prepare(`
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

    db.prepare(`
        CREATE TABLE IF NOT EXISTS verification_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            rule_type TEXT NOT NULL,
            trigger_on TEXT NOT NULL DEFAULT 'task_complete',
            config TEXT NOT NULL,
            applies_to TEXT DEFAULT '*',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    db.prepare(`
        INSERT OR IGNORE INTO verification_rules (id, name, description, rule_type, trigger_on, config, applies_to)
        VALUES (1, 'Tier 0 Deterministic Checks', 'Enforces strict scope boundaries, TypeScript compilation, and typing safety checks.', 'pattern', 'task_complete', '{}', '*')
    `).run();

    db.prepare(`
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

    db.prepare(`
        CREATE TABLE IF NOT EXISTS knowledge_chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_type TEXT NOT NULL,
            source_id TEXT,
            content TEXT NOT NULL,
            metadata TEXT,
            token_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    db.prepare(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_knowledge USING vec0(
            chunk_id INTEGER PRIMARY KEY,
            embedding float[1536] distance_metric=cosine
        )
    `).run();

    db.prepare(`
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

    db.prepare(`
        CREATE TABLE IF NOT EXISTS task_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            plan_json TEXT NOT NULL,
            status TEXT DEFAULT 'draft',
            confidence REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS execution_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            attempt_number INTEGER NOT NULL,
            model_used TEXT,
            provider_used TEXT,
            plan_id INTEGER,
            output_id INTEGER,
            verification_status TEXT,
            failure_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY(plan_id) REFERENCES task_plans(id) ON DELETE SET NULL,
            FOREIGN KEY(output_id) REFERENCES task_outputs(id) ON DELETE SET NULL
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS model_performance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model TEXT NOT NULL,
            provider TEXT NOT NULL,
            task_type TEXT,
            success INTEGER NOT NULL,
            attempt_number INTEGER,
            token_count INTEGER,
            latency_ms INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    try {
        db.prepare('ALTER TABLE model_performance ADD COLUMN input_tokens INTEGER DEFAULT 0').run();
    } catch (e) {}
    try {
        db.prepare('ALTER TABLE model_performance ADD COLUMN output_tokens INTEGER DEFAULT 0').run();
    } catch (e) {}

    db.prepare(`
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            model TEXT NOT NULL,
            provider TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    try {
        db.prepare("ALTER TABLE conversations ADD COLUMN model TEXT NOT NULL DEFAULT 'gpt-4o'").run();
    } catch (e) {}
    try {
        db.prepare("ALTER TABLE conversations ADD COLUMN provider TEXT NOT NULL DEFAULT 'openai'").run();
    } catch (e) {}
    try {
        db.prepare("ALTER TABLE conversations ADD COLUMN workspace_path TEXT").run();
    } catch (e) {}

    db.prepare(`
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS agent_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    db.prepare(`
        INSERT OR IGNORE INTO agent_rules (id, name, content, is_active)
        VALUES (1, 'Assumption Validator', 'This agent is dedicated to rigorous verification and the elimination of groundless assumptions. It ensures that every claim is backed by evidence and every requirement is clarified.

Core Principles:
1. Evidence-Based: No claim should be made without a direct citation from the codebase, documentation, or tool output.
2. Assumption Identification: Active scanning for words like "probably", "likely", "should", "standard", or "usually" which often hide assumptions.
3. Explicit Uncertainty: If something is unknown, it must be stated as unknown rather than guessed.
4. Source Verification: Double-check that information extracted from one source doesn''t conflict with another.

Instructions:
When planning:
1. Inventory: List all "facts" extracted from the current context.
2. Challenge: For each fact, identify the source. If no source exists, mark it as an ASSUMPTION.
3. Risk Assessment: Rank assumptions by their potential impact on the project (High/Medium/Low).
4. Verification Plan: Propose specific steps (e.g., "Run grep", "Ask the user") to convert each assumption into a fact.', 1)
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS task_taxonomy_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          axis TEXT NOT NULL,
          resolved_path TEXT NOT NULL,
          confidence REAL NOT NULL,
          classified_by TEXT NOT NULL,
          classification_depth INTEGER NOT NULL,
          fragments_injected INTEGER NOT NULL,
          phase TEXT NOT NULL,
          reclassified INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();
}

export function migrateKeysToSecureStore(db: any) {
    if (!db) return;
    try {
        const providers = db.prepare("SELECT id, api_key FROM custom_providers WHERE api_key IS NOT NULL AND api_key != ''").all();
        if (providers.length > 0) {
            console.log(`[DatabaseService] Found ${providers.length} custom providers with plaintext API keys in SQLite. Migrating...`);
            for (const p of providers) {
                if (p.api_key && p.api_key.trim().length > 0) {
                    secureStore.setCustomProviderKey(p.id, p.api_key);
                    console.log(`[DatabaseService] Securely migrated API key for custom provider: ${p.id}`);
                }
            }
            db.prepare('UPDATE custom_providers SET api_key = NULL').run();
            console.log(`[DatabaseService] Cleared plaintext API keys from SQLite database.`);
        }
    } catch (e) {
        console.error('[DatabaseService] Failed to run custom provider API key migration:', e);
    }
}

export function migrateTaskIds(db: any) {
    if (!db) return;
    console.log('[DatabaseService] Checking for legacy taskId migrations...');
    try {
        const conversations = db.prepare('SELECT id FROM conversations').all();

        const getLegacyId = (convId: string): number => {
            if (!convId) return 1;
            const match = convId.match(/conv_(\d+)/);
            if (match) return parseInt(match[1], 10);
            let hash = 0;
            for (let i = 0; i < convId.length; i++) {
                hash = (hash * 31 + convId.charCodeAt(i)) & 0xffffffff;
            }
            return Math.abs(hash) || 1;
        };

        const getNewId = (convId: string): number => {
            if (!convId) return 1;
            let hash = 5381;
            for (let i = 0; i < convId.length; i++) {
                hash = (hash * 33) ^ convId.charCodeAt(i);
            }
            return Math.abs(hash) || 1;
        };

        const runTx = db.transaction(() => {
            for (const conv of conversations) {
                const legacyId = getLegacyId(conv.id);
                const newId = getNewId(conv.id);

                if (legacyId !== newId) {
                    const hasLegacyTask = db.prepare('SELECT id FROM tasks WHERE id = ?').get(legacyId);
                    if (hasLegacyTask) {
                        console.log(`[DatabaseService] Migrating legacy taskId ${legacyId} to new taskId ${newId} for conversation ${conv.id}`);
                        const hasNewTask = db.prepare('SELECT id FROM tasks WHERE id = ?').get(newId);
                        if (hasNewTask) {
                            db.prepare('DELETE FROM task_plans WHERE task_id = ?').run(legacyId);
                            db.prepare('DELETE FROM tasks WHERE id = ?').run(legacyId);
                        } else {
                            db.pragma('foreign_keys = OFF');
                            db.prepare('UPDATE tasks SET id = ? WHERE id = ?').run(newId, legacyId);
                            db.prepare('UPDATE task_plans SET task_id = ? WHERE task_id = ?').run(newId, legacyId);
                            db.prepare('UPDATE task_outputs SET task_id = ? WHERE task_id = ?').run(newId, legacyId);
                            db.prepare('UPDATE execution_attempts SET task_id = ? WHERE task_id = ?').run(newId, legacyId);
                            db.prepare('UPDATE task_docs SET task_id = ? WHERE task_id = ?').run(newId, legacyId);
                            db.pragma('foreign_keys = ON');
                        }
                    }
                }
            }
        });

        runTx();
        console.log('[DatabaseService] Task ID migration check complete.');
    } catch (err) {
        console.error('[DatabaseService] Task ID migration failed:', err);
    }
}
