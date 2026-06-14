import { fileURLToPath as myFileURLToPath } from 'url'; import { dirname as myDirname } from 'path'; const __filename = myFileURLToPath(import.meta.url); const __dirname = myDirname(__filename);

// electron/services/taxonomy/TaxonomyService.ts
import * as fs from "fs";
import * as path3 from "path";
import { fileURLToPath } from "url";

// electron/db/index.ts
import path2 from "path";

// electron/services/taxonomy/__tests__/electron-mock.js
var safeStorage = {
  isEncryptionAvailable: () => false,
  encryptString: (s) => s,
  decryptString: (s) => s
};
var app = {
  getPath: (name) => "."
};

// electron/db/schema.ts
import path from "path";
import { createRequire } from "module";

// electron/services/taxonomy/__tests__/electron-store-mock.js
var ElectronStore = class {
  constructor() {
  }
  get(key) {
    return null;
  }
  set(key, val) {
  }
  delete(key) {
  }
};

// electron/secureStore.ts
import console2 from "console";
var store = new ElectronStore({
  name: "secure-settings",
  // Isolate from legacy config.json
  defaults: {
    theme: "dark",
    fontSize: 14,
    activeProvider: "openai",
    selectedModel: "gpt-4o",
    allowFileRead: false,
    autoApproveCommands: false,
    systemPromptOverride: "",
    enableLiteLLMProxy: false,
    liteLLMConfigPath: "",
    liteLLMModel: "gpt-4o",
    liteLLMPort: 4e3,
    awsRegion: "us-east-1",
    vertexProject: "",
    vertexLocation: "us-central1",
    azureApiBase: "",
    azureApiVersion: "2024-02-01",
    activeWorkspacePath: ""
  }
});
function encryptValue(value) {
  console2.assert(typeof value === "string", "Value to encrypt must be a string");
  if (!safeStorage.isEncryptionAvailable()) {
    console2.warn("[SecureStore] Encryption not available, storing as-is");
    return value;
  }
  const buffer = safeStorage.encryptString(value);
  return buffer.toString("base64");
}
function decryptValue(encrypted) {
  console2.assert(typeof encrypted === "string", "Encrypted value must be a base64 string");
  if (!safeStorage.isEncryptionAvailable()) {
    console2.warn("[SecureStore] Encryption not available, returning as-is");
    return encrypted;
  }
  const buffer = Buffer.from(encrypted, "base64");
  return safeStorage.decryptString(buffer);
}
var secureStore = {
  // Key-specific Setters & Getters
  setApiKey(providerId, key) {
    console2.assert(typeof providerId === "string", "providerId must be a string");
    store.set(`${providerId}ApiKey_encrypted`, encryptValue(key));
  },
  getApiKey(providerId) {
    console2.assert(typeof providerId === "string", "providerId must be a string");
    const encrypted = store.get(`${providerId}ApiKey_encrypted`);
    if (!encrypted) return void 0;
    try {
      return decryptValue(encrypted);
    } catch (e) {
      console2.error(`[SecureStore] Failed to decrypt key for ${providerId}`, e);
      return void 0;
    }
  },
  deleteApiKey(providerId) {
    console2.assert(typeof providerId === "string", "providerId must be a string");
    store.delete(`${providerId}ApiKey_encrypted`);
  },
  setGitHubToken(token) {
    store.set("githubToken_encrypted", encryptValue(token));
  },
  getGitHubToken() {
    const encrypted = store.get("githubToken_encrypted");
    if (!encrypted) return void 0;
    try {
      return decryptValue(encrypted);
    } catch (e) {
      console2.error("[SecureStore] Failed to decrypt GitHub token", e);
      return void 0;
    }
  },
  // Non-sensitive settings
  getTheme() {
    return store.get("theme") || "dark";
  },
  setTheme(theme) {
    console2.assert(theme === "light" || theme === "dark", "Theme must be light or dark");
    store.set("theme", theme);
  },
  getFontSize() {
    return store.get("fontSize") || 14;
  },
  setFontSize(size) {
    console2.assert(typeof size === "number" && size > 0, "FontSize must be a valid positive number");
    store.set("fontSize", size);
  },
  getActiveProvider() {
    return store.get("activeProvider") || "openai";
  },
  setActiveProvider(provider) {
    console2.assert(typeof provider === "string", "Active provider must be a string");
    store.set("activeProvider", provider);
  },
  getSelectedModel() {
    return store.get("selectedModel") || "gpt-4o";
  },
  setSelectedModel(model) {
    console2.assert(typeof model === "string", "Selected model must be a string");
    store.set("selectedModel", model);
  },
  getAllowFileRead() {
    return !!store.get("allowFileRead");
  },
  setAllowFileRead(allow) {
    store.set("allowFileRead", allow);
  },
  getAutoApproveCommands() {
    return !!store.get("autoApproveCommands");
  },
  setAutoApproveCommands(approve) {
    store.set("autoApproveCommands", approve);
  },
  getSystemPromptOverride() {
    return store.get("systemPromptOverride") || "";
  },
  setSystemPromptOverride(prompt) {
    console2.assert(typeof prompt === "string", "System prompt must be a string");
    store.set("systemPromptOverride", prompt);
  },
  // LiteLLM getters and setters
  getEnableLiteLLMProxy() {
    return !!store.get("enableLiteLLMProxy");
  },
  setEnableLiteLLMProxy(enable) {
    store.set("enableLiteLLMProxy", enable);
  },
  getLiteLLMConfigPath() {
    return store.get("liteLLMConfigPath") || "";
  },
  setLiteLLMConfigPath(path4) {
    console2.assert(typeof path4 === "string", "Config path must be a string");
    store.set("liteLLMConfigPath", path4);
  },
  getLiteLLMModel() {
    return store.get("liteLLMModel") || "gpt-4o";
  },
  setLiteLLMModel(model) {
    console2.assert(typeof model === "string", "Model must be a string");
    store.set("liteLLMModel", model);
  },
  getLiteLLMPort() {
    return store.get("liteLLMPort") || 4e3;
  },
  setLiteLLMPort(port) {
    console2.assert(typeof port === "number" && port > 0, "Port must be a positive number");
    store.set("liteLLMPort", port);
  },
  // Cloud Credentials getters and setters
  getAwsRegion() {
    return store.get("awsRegion") || "us-east-1";
  },
  setAwsRegion(region) {
    console2.assert(typeof region === "string", "AWS Region must be a string");
    store.set("awsRegion", region);
  },
  getVertexProject() {
    return store.get("vertexProject") || "";
  },
  setVertexProject(project) {
    console2.assert(typeof project === "string", "Vertex Project must be a string");
    store.set("vertexProject", project);
  },
  getVertexLocation() {
    return store.get("vertexLocation") || "us-central1";
  },
  setVertexLocation(location) {
    console2.assert(typeof location === "string", "Vertex Location must be a string");
    store.set("vertexLocation", location);
  },
  getAzureApiBase() {
    return store.get("azureApiBase") || "";
  },
  setAzureApiBase(base) {
    console2.assert(typeof base === "string", "Azure API Base must be a string");
    store.set("azureApiBase", base);
  },
  getAzureApiVersion() {
    return store.get("azureApiVersion") || "2024-02-01";
  },
  setAzureApiVersion(version) {
    console2.assert(typeof version === "string", "Azure API Version must be a string");
    store.set("azureApiVersion", version);
  },
  getWindowBounds() {
    return store.get("windowBounds");
  },
  setWindowBounds(bounds) {
    console2.assert(bounds && typeof bounds.width === "number", "Window bounds must be valid");
    store.set("windowBounds", bounds);
  },
  getActiveWorkspacePath() {
    return store.get("activeWorkspacePath") || "";
  },
  setActiveWorkspacePath(pathStr) {
    console2.assert(typeof pathStr === "string", "Workspace path must be a string");
    store.set("activeWorkspacePath", pathStr);
  },
  setCustomProviderKey(providerId, key) {
    console2.assert(typeof providerId === "string", "providerId must be a string");
    checkEncryptionGuard();
    store.set(`customProvider_${providerId}_encrypted`, encryptValue(key));
  },
  getCustomProviderKey(providerId) {
    console2.assert(typeof providerId === "string", "providerId must be a string");
    const encrypted = store.get(`customProvider_${providerId}_encrypted`);
    if (!encrypted) return void 0;
    try {
      return decryptValue(encrypted);
    } catch (e) {
      console2.error(`[SecureStore] Failed to decrypt key for custom provider ${providerId}`, e);
      return void 0;
    }
  },
  deleteCustomProviderKey(providerId) {
    console2.assert(typeof providerId === "string", "providerId must be a string");
    store.delete(`customProvider_${providerId}_encrypted`);
  }
};
function checkEncryptionGuard() {
  if (!safeStorage.isEncryptionAvailable()) {
    const isDev = !app.isPackaged || process.env.NODE_ENV === "development";
    if (isDev) {
      throw new Error("[SecureStore] OS-level encryption is not available in development.");
    }
  }
}
var originalSetApiKey = secureStore.setApiKey;
secureStore.setApiKey = function(providerId, key) {
  checkEncryptionGuard();
  originalSetApiKey.call(secureStore, providerId, key);
};
var originalSetGitHubToken = secureStore.setGitHubToken;
secureStore.setGitHubToken = function(token) {
  checkEncryptionGuard();
  originalSetGitHubToken.call(secureStore, token);
};

// electron/db/schema.ts
var require2 = createRequire(import.meta.url);
var Database = require2("better-sqlite3");
var sqliteVec = require2("sqlite-vec");
function createDatabase(dbPath) {
  const resolvedPath = dbPath || path.join(app.getPath("userData"), "cursor-replacer.sqlite");
  const db = new Database(resolvedPath, {});
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("temp_store = MEMORY");
  db.pragma("cache_size = -64000");
  let vecPath = sqliteVec.getLoadablePath();
  if (app.isPackaged) {
    vecPath = vecPath.replace("app.asar", "app.asar.unpacked");
  }
  db.loadExtension(vecPath);
  const versionRow = db.prepare("SELECT vec_version() AS version").get();
  console.log(`[DatabaseService] sqlite-vec loaded successfully. v${versionRow ? versionRow.version : "unknown"}`);
  return db;
}
function createTables(db) {
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
      { id: "start", position: { x: 250, y: 50 }, data: { label: "Start Flow" }, type: "input" },
      { id: "codesearch-1", position: { x: 250, y: 150 }, data: { label: "Investigate Workspace", query: "Find targets", searchType: "symbols" }, type: "codesearch" },
      { id: "planner-2", position: { x: 250, y: 250 }, data: { label: "Analyze & Plan Changes", goal: "Establish non-ambiguous plan skeleton" }, type: "planner" },
      { id: "agent-3", position: { x: 250, y: 350 }, data: { label: "Modify Target Files", prompt: "Apply planned changes to the code" }, type: "agent" },
      { id: "verify-4", position: { x: 250, y: 450 }, data: { label: "Verify Code and Compile", ruleId: 1 }, type: "verify" }
    ],
    edges: [
      { id: "e-start-codesearch", source: "start", target: "codesearch-1", animated: true },
      { id: "e-codesearch-planner", source: "codesearch-1", target: "planner-2", animated: true },
      { id: "e-planner-agent", source: "planner-2", target: "agent-3", animated: true },
      { id: "e-agent-verify", source: "agent-3", target: "verify-4", animated: true }
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
    db.prepare("ALTER TABLE custom_models ADD COLUMN has_thinking INTEGER DEFAULT 0").run();
  } catch (e) {
  }
  try {
    db.prepare("ALTER TABLE custom_providers ADD COLUMN is_local INTEGER DEFAULT 0").run();
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
    db.prepare("ALTER TABLE model_performance ADD COLUMN input_tokens INTEGER DEFAULT 0").run();
  } catch (e) {
  }
  try {
    db.prepare("ALTER TABLE model_performance ADD COLUMN output_tokens INTEGER DEFAULT 0").run();
  } catch (e) {
  }
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
  } catch (e) {
  }
  try {
    db.prepare("ALTER TABLE conversations ADD COLUMN provider TEXT NOT NULL DEFAULT 'openai'").run();
  } catch (e) {
  }
  try {
    db.prepare("ALTER TABLE conversations ADD COLUMN workspace_path TEXT").run();
  } catch (e) {
  }
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
function migrateKeysToSecureStore(db) {
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
      db.prepare("UPDATE custom_providers SET api_key = NULL").run();
      console.log(`[DatabaseService] Cleared plaintext API keys from SQLite database.`);
    }
  } catch (e) {
    console.error("[DatabaseService] Failed to run custom provider API key migration:", e);
  }
}
function migrateTaskIds(db) {
  if (!db) return;
  console.log("[DatabaseService] Checking for legacy taskId migrations...");
  try {
    const conversations = db.prepare("SELECT id FROM conversations").all();
    const getLegacyId = (convId) => {
      if (!convId) return 1;
      const match = convId.match(/conv_(\d+)/);
      if (match) return parseInt(match[1], 10);
      let hash = 0;
      for (let i = 0; i < convId.length; i++) {
        hash = hash * 31 + convId.charCodeAt(i) & 4294967295;
      }
      return Math.abs(hash) || 1;
    };
    const getNewId = (convId) => {
      if (!convId) return 1;
      let hash = 5381;
      for (let i = 0; i < convId.length; i++) {
        hash = hash * 33 ^ convId.charCodeAt(i);
      }
      return Math.abs(hash) || 1;
    };
    const runTx = db.transaction(() => {
      for (const conv of conversations) {
        const legacyId = getLegacyId(conv.id);
        const newId = getNewId(conv.id);
        if (legacyId !== newId) {
          const hasLegacyTask = db.prepare("SELECT id FROM tasks WHERE id = ?").get(legacyId);
          if (hasLegacyTask) {
            console.log(`[DatabaseService] Migrating legacy taskId ${legacyId} to new taskId ${newId} for conversation ${conv.id}`);
            const hasNewTask = db.prepare("SELECT id FROM tasks WHERE id = ?").get(newId);
            if (hasNewTask) {
              db.prepare("DELETE FROM task_plans WHERE task_id = ?").run(legacyId);
              db.prepare("DELETE FROM tasks WHERE id = ?").run(legacyId);
            } else {
              db.pragma("foreign_keys = OFF");
              db.prepare("UPDATE tasks SET id = ? WHERE id = ?").run(newId, legacyId);
              db.prepare("UPDATE task_plans SET task_id = ? WHERE task_id = ?").run(newId, legacyId);
              db.prepare("UPDATE task_outputs SET task_id = ? WHERE task_id = ?").run(newId, legacyId);
              db.prepare("UPDATE execution_attempts SET task_id = ? WHERE task_id = ?").run(newId, legacyId);
              db.prepare("UPDATE task_docs SET task_id = ? WHERE task_id = ?").run(newId, legacyId);
              db.pragma("foreign_keys = ON");
            }
          }
        }
      }
    });
    runTx();
    console.log("[DatabaseService] Task ID migration check complete.");
  } catch (err) {
    console.error("[DatabaseService] Task ID migration failed:", err);
  }
}

// src/helpers/invariant.ts
function assertNonNull(value, name) {
  if (value === null) {
    if (process.env.NODE_ENV === "production") {
      console.error(`Invariant violation: ${name} is null`);
      return void 0;
    }
    throw new Error(`${name} must not be null`);
  }
  return value;
}
function checkArgs(condition, message) {
  if (!condition) {
    throw new Error(`Invalid arguments: ${message}`);
  }
}

// electron/db/conversations.ts
function createConversation(db, id, title, model, provider, workspacePath) {
  checkArgs(typeof id === "string", "id must be a string");
  checkArgs(typeof title === "string", "title must be a string");
  checkArgs(typeof model === "string", "model must be a string");
  checkArgs(typeof provider === "string", "provider must be a string");
  if (!db) throw new Error("DB not initialized");
  db.prepare("INSERT OR REPLACE INTO conversations (id, title, model, provider, workspace_path) VALUES (?, ?, ?, ?, ?)").run(id, title, model, provider, workspacePath || null);
  return id;
}
function getConversations(db, workspacePath) {
  if (!db) return [];
  if (workspacePath && workspacePath.trim().length > 0) {
    return db.prepare("SELECT * FROM conversations WHERE workspace_path = ? ORDER BY updated_at DESC").all(workspacePath);
  } else {
    return db.prepare("SELECT * FROM conversations WHERE workspace_path IS NULL OR workspace_path = '' ORDER BY updated_at DESC").all();
  }
}
function getConversationMessages(db, conversationId) {
  if (!db) return [];
  return db.prepare("SELECT id, role, content, created_at FROM chat_messages WHERE conversation_id = ? ORDER BY id ASC").all(conversationId);
}
function addChatMessage(db, conversationId, role, content) {
  if (!db) throw new Error("DB not initialized");
  const conv = db.prepare("SELECT id FROM conversations WHERE id = ?").get(conversationId);
  if (!conv) {
    console.warn(`[DatabaseService] Conversation ${conversationId} does not exist. Skipping message save.`);
    return false;
  }
  assertNonNull(conv, "Conversation from db.get in addChatMessage");
  const info = db.prepare("INSERT INTO chat_messages (conversation_id, role, content) VALUES (?, ?, ?)").run(conversationId, role, content);
  db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(conversationId);
  return info.lastInsertRowid;
}
function updateChatMessage(db, conversationId, messageId, content) {
  checkArgs(typeof conversationId === "string", "conversationId must be a string");
  checkArgs(typeof messageId === "number", "messageId must be a number");
  checkArgs(typeof content === "string", "content must be a string");
  if (!db) throw new Error("DB not initialized");
  const result = db.prepare("UPDATE chat_messages SET content = ? WHERE conversation_id = ? AND id = ?").run(content, conversationId, messageId);
  if (result.changes > 0) {
    db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(conversationId);
  }
  return result.changes > 0;
}
function truncateChatMessages(db, conversationId, messageId) {
  checkArgs(typeof conversationId === "string", "conversationId must be a string");
  checkArgs(typeof messageId === "number", "messageId must be a number");
  if (!db) throw new Error("DB not initialized");
  db.prepare("DELETE FROM chat_messages WHERE conversation_id = ? AND id > ?").run(conversationId, messageId);
}
function touchConversation(db, conversationId) {
  if (!db) throw new Error("DB not initialized");
  db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(conversationId);
}
function deleteConversation(db, conversationId) {
  if (!db) throw new Error("DB not initialized");
  db.prepare("DELETE FROM conversations WHERE id = ?").run(conversationId);
  return true;
}
function updateConversationTitle(db, conversationId, title) {
  if (!db) throw new Error("DB not initialized");
  db.prepare("UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(title, conversationId);
  return true;
}

// electron/db/agents.ts
function getAgentRules(db) {
  if (!db) return [];
  return db.prepare("SELECT * FROM agent_rules ORDER BY created_at DESC").all();
}
function addAgentRule(db, name, content, isActive = 1) {
  checkArgs(typeof name === "string" && name.length > 0, "Rule name must be a valid non-empty string");
  checkArgs(typeof content === "string" && content.length > 0, "Rule content must be a valid non-empty string");
  if (!db) throw new Error("DB not initialized");
  const stmt = db.prepare("INSERT INTO agent_rules (name, content, is_active) VALUES (?, ?, ?)");
  const info = stmt.run(name, content, isActive);
  return info.lastInsertRowid;
}
function updateAgentRule(db, id, name, content, isActive) {
  checkArgs(typeof id === "number", "Rule ID must be a number");
  checkArgs(typeof name === "string" && name.length > 0, "Rule name must be a valid non-empty string");
  checkArgs(typeof content === "string" && content.length > 0, "Rule content must be a valid non-empty string");
  if (!db) throw new Error("DB not initialized");
  db.prepare("UPDATE agent_rules SET name = ?, content = ?, is_active = ? WHERE id = ?").run(name, content, isActive, id);
}
function deleteAgentRule(db, id) {
  checkArgs(typeof id === "number", "Rule ID must be a number");
  if (!db) throw new Error("DB not initialized");
  db.prepare("DELETE FROM agent_rules WHERE id = ?").run(id);
}
function toggleAgentRule(db, id, isActive) {
  checkArgs(typeof id === "number", "Rule ID must be a number");
  if (!db) throw new Error("DB not initialized");
  db.prepare("UPDATE agent_rules SET is_active = ? WHERE id = ?").run(isActive, id);
}
function addAgent(db, name, systemPrompt) {
  checkArgs(typeof name === "string" && name.length > 0, "Agent name must be a valid non-empty string");
  checkArgs(typeof systemPrompt === "string" && systemPrompt.length > 0, "System prompt must be a valid non-empty string");
  if (!db) throw new Error("DB not initialized");
  db.prepare("INSERT INTO agents (name, system_prompt) VALUES (?, ?)").run(name, systemPrompt);
}
function getAgents(db) {
  if (!db) return [];
  return db.prepare("SELECT * FROM agents ORDER BY created_at DESC").all();
}
function deleteAgent(db, id) {
  checkArgs(typeof id === "number", "Agent ID must be a number");
  if (!db) throw new Error("DB not initialized");
  db.prepare("DELETE FROM agents WHERE id = ?").run(id);
}
function addFlow(db, name, description, steps, agentId) {
  checkArgs(typeof name === "string" && name.length > 0, "Flow name must be a valid non-empty string");
  checkArgs(Array.isArray(steps), "Steps must be an array of strings");
  if (!db) throw new Error("DB not initialized");
  db.prepare("INSERT INTO flows (name, description, steps, agent_id) VALUES (?, ?, ?, ?)").run(
    name,
    description,
    JSON.stringify(steps),
    agentId || null
  );
}
function getFlows(db) {
  if (!db) return [];
  const flows = db.prepare(`
        SELECT f.*, a.name as agent_name 
        FROM flows f 
        LEFT JOIN agents a ON f.agent_id = a.id 
        ORDER BY f.created_at DESC
    `).all();
  assertNonNull(flows, "Flows from db query");
  return flows.map((f) => ({ ...f, steps: JSON.parse(f.steps) }));
}
function deleteFlow(db, id) {
  checkArgs(typeof id === "number", "Flow ID must be a number");
  if (!db) throw new Error("DB not initialized");
  db.prepare("DELETE FROM flows WHERE id = ?").run(id);
}
function updateFlow(db, id, steps) {
  checkArgs(typeof id === "number", "Flow ID must be a number");
  checkArgs(Array.isArray(steps), "Steps must be an array of strings");
  if (!db) throw new Error("DB not initialized");
  db.prepare("UPDATE flows SET steps = ? WHERE id = ?").run(JSON.stringify(steps), id);
}
function addCustomProvider(db, id, name, baseUrl, apiKey, isLocal = false) {
  checkArgs(typeof id === "string" && id.length > 0, "Provider ID is required");
  checkArgs(typeof name === "string" && name.length > 0, "Provider Name is required");
  checkArgs(typeof baseUrl === "string" && baseUrl.length > 0, "Provider Base URL is required");
  if (!db) throw new Error("DB not initialized");
  if (apiKey && apiKey.trim().length > 0) {
    secureStore.setCustomProviderKey(id, apiKey);
  }
  db.prepare("INSERT OR REPLACE INTO custom_providers (id, name, base_url, api_key, is_local) VALUES (?, ?, ?, NULL, ?)").run(id, name, baseUrl, isLocal ? 1 : 0);
}
function getCustomProviders(db) {
  if (!db) return [];
  return db.prepare("SELECT * FROM custom_providers ORDER BY created_at DESC").all();
}
function deleteCustomProvider(db, id) {
  if (!db) throw new Error("DB not initialized");
  db.prepare("DELETE FROM custom_providers WHERE id = ?").run(id);
  db.prepare("DELETE FROM custom_models WHERE provider_id = ?").run(id);
  secureStore.deleteCustomProviderKey(id);
}
function addCustomModel(db, providerId, modelName, hasThinking = 0) {
  checkArgs(typeof providerId === "string" && providerId.length > 0, "Provider ID must be a valid non-empty string");
  checkArgs(typeof modelName === "string" && modelName.length > 0, "Model Name must be a valid non-empty string");
  if (!db) throw new Error("DB not initialized");
  db.prepare("INSERT INTO custom_models (provider_id, model_name, has_thinking) VALUES (?, ?, ?) ON CONFLICT(provider_id, model_name) DO UPDATE SET has_thinking = excluded.has_thinking").run(providerId, modelName, hasThinking);
}
function getCustomModels(db, providerId) {
  if (!db) return [];
  if (providerId) {
    return db.prepare("SELECT * FROM custom_models WHERE provider_id = ? ORDER BY model_name ASC").all(providerId);
  }
  return db.prepare("SELECT * FROM custom_models ORDER BY model_name ASC").all();
}
function toggleCustomModelThinking(db, providerId, modelName, hasThinking) {
  if (!db) throw new Error("DB not initialized");
  db.prepare("UPDATE custom_models SET has_thinking = ? WHERE provider_id = ? AND model_name = ?").run(hasThinking, providerId, modelName);
}
function deleteCustomModel(db, providerId, modelName) {
  if (!db) throw new Error("DB not initialized");
  db.prepare("DELETE FROM custom_models WHERE provider_id = ? AND model_name = ?").run(providerId, modelName);
}

// electron/db/settings.ts
import { Buffer as Buffer2 } from "node:buffer";

// electron/services/CostEstimatorService.ts
var CostEstimatorService = class {
  // Model pricing dictionary
  static pricing = {
    // OpenAI Models
    "gpt-4o": { inputCostPerM: 2.5, outputCostPerM: 10 },
    "gpt-4o-mini": { inputCostPerM: 0.15, outputCostPerM: 0.6 },
    "gpt-4-turbo": { inputCostPerM: 10, outputCostPerM: 30 },
    "gpt-4": { inputCostPerM: 30, outputCostPerM: 60 },
    "gpt-3.5-turbo": { inputCostPerM: 0.5, outputCostPerM: 1.5 },
    "o1": { inputCostPerM: 15, outputCostPerM: 60 },
    "o1-mini": { inputCostPerM: 3, outputCostPerM: 12 },
    "o3-mini": { inputCostPerM: 1.1, outputCostPerM: 4.4 },
    // Anthropic Models
    "claude-3-5-sonnet-latest": { inputCostPerM: 3, outputCostPerM: 15 },
    "claude-3-5-sonnet-20241022": { inputCostPerM: 3, outputCostPerM: 15 },
    "claude-3-5-haiku-latest": { inputCostPerM: 0.8, outputCostPerM: 4 },
    "claude-3-5-haiku-20241022": { inputCostPerM: 0.8, outputCostPerM: 4 },
    "claude-3-opus-20240229": { inputCostPerM: 15, outputCostPerM: 75 },
    "claude-3-sonnet-20240229": { inputCostPerM: 3, outputCostPerM: 15 },
    "claude-3-haiku-20240307": { inputCostPerM: 0.25, outputCostPerM: 1.25 },
    // Gemini Models
    "gemini-1.5-flash": { inputCostPerM: 0.075, outputCostPerM: 0.3 },
    "gemini-1.5-pro": { inputCostPerM: 1.25, outputCostPerM: 5 },
    "gemini-2.5-flash": { inputCostPerM: 0.075, outputCostPerM: 0.3 },
    "gemini-2.5-pro": { inputCostPerM: 1.25, outputCostPerM: 5 },
    "gemini-3-flash": { inputCostPerM: 0.5, outputCostPerM: 3 },
    "gemini-3.5-flash": { inputCostPerM: 1.5, outputCostPerM: 9 },
    "gemini-3.1-pro": { inputCostPerM: 2, outputCostPerM: 12 },
    // Embedding Models
    "text-embedding-3-small": { inputCostPerM: 0.02, outputCostPerM: 0 },
    "gemini-embedding-001": { inputCostPerM: 0.025, outputCostPerM: 0 },
    "local-hashing": { inputCostPerM: 0, outputCostPerM: 0 },
    // DeepSeek Models (via Zen)
    "deepseek-v4-pro": { inputCostPerM: 1.74, outputCostPerM: 3.48 },
    "deepseek-v4-flash": { inputCostPerM: 0.14, outputCostPerM: 0.28 },
    // OpenCode Zen Models (paid)
    "qwen3.7-max": { inputCostPerM: 2.5, outputCostPerM: 7.5 },
    "qwen3.7-plus": { inputCostPerM: 0.4, outputCostPerM: 1.6 },
    "qwen3.6-plus": { inputCostPerM: 0.5, outputCostPerM: 3 },
    "qwen3.5-plus": { inputCostPerM: 0.2, outputCostPerM: 1.2 },
    "minimax-m2.7": { inputCostPerM: 0.3, outputCostPerM: 1.2 },
    "minimax-m2.5": { inputCostPerM: 0.3, outputCostPerM: 1.2 },
    "glm-5.1": { inputCostPerM: 1.4, outputCostPerM: 4.4 },
    "glm-5": { inputCostPerM: 1, outputCostPerM: 3.2 },
    "kimi-k2.5": { inputCostPerM: 0.6, outputCostPerM: 3 },
    "kimi-k2.6": { inputCostPerM: 0.95, outputCostPerM: 4 },
    "grok-build-0.1": { inputCostPerM: 1, outputCostPerM: 2 },
    // New Claude Models (via Zen)
    "claude-haiku-4.5": { inputCostPerM: 1, outputCostPerM: 5 },
    "claude-sonnet-4": { inputCostPerM: 3, outputCostPerM: 15 },
    "claude-sonnet-4.5": { inputCostPerM: 3, outputCostPerM: 15 },
    "claude-sonnet-4.6": { inputCostPerM: 3, outputCostPerM: 15 },
    "claude-opus-4.1": { inputCostPerM: 15, outputCostPerM: 75 },
    "claude-opus-4.5": { inputCostPerM: 5, outputCostPerM: 25 },
    "claude-opus-4.6": { inputCostPerM: 5, outputCostPerM: 25 },
    "claude-opus-4.7": { inputCostPerM: 5, outputCostPerM: 25 },
    "claude-opus-4.8": { inputCostPerM: 5, outputCostPerM: 25 },
    "claude-fable-5": { inputCostPerM: 10, outputCostPerM: 50 },
    // GPT-5.x Models (via Zen)
    "gpt-5-nano": { inputCostPerM: 0.05, outputCostPerM: 0.4 },
    "gpt-5.1-codex-mini": { inputCostPerM: 0.25, outputCostPerM: 2 },
    "gpt-5.1-codex": { inputCostPerM: 1.07, outputCostPerM: 8.5 },
    "gpt-5.1-codex-max": { inputCostPerM: 1.25, outputCostPerM: 10 },
    "gpt-5.1": { inputCostPerM: 1.07, outputCostPerM: 8.5 },
    "gpt-5-codex": { inputCostPerM: 1.07, outputCostPerM: 8.5 },
    "gpt-5": { inputCostPerM: 1.07, outputCostPerM: 8.5 },
    "gpt-5.2-codex": { inputCostPerM: 1.75, outputCostPerM: 14 },
    "gpt-5.2": { inputCostPerM: 1.75, outputCostPerM: 14 },
    "gpt-5.3-codex-spark": { inputCostPerM: 1.75, outputCostPerM: 14 },
    "gpt-5.3-codex": { inputCostPerM: 1.75, outputCostPerM: 14 },
    "gpt-5.4-nano": { inputCostPerM: 0.2, outputCostPerM: 1.25 },
    "gpt-5.4-mini": { inputCostPerM: 0.75, outputCostPerM: 4.5 },
    "gpt-5.4": { inputCostPerM: 2.5, outputCostPerM: 15 },
    "gpt-5.4-pro": { inputCostPerM: 30, outputCostPerM: 180 },
    "gpt-5.5": { inputCostPerM: 5, outputCostPerM: 30 },
    "gpt-5.5-pro": { inputCostPerM: 30, outputCostPerM: 180 }
  };
  /**
   * Gets the price details for a model. Falls back to a default if unknown.
   */
  static getModelPrice(model, provider) {
    if (!model) return { inputCostPerM: 0, outputCostPerM: 0 };
    const normModel = model.toLowerCase();
    if (provider === "ollama" || normModel.includes("llama") || normModel.includes("mistral") || normModel.includes("phi")) {
      return { inputCostPerM: 0, outputCostPerM: 0 };
    }
    if (normModel.includes("-free")) {
      return { inputCostPerM: 0, outputCostPerM: 0 };
    }
    if (this.pricing[normModel]) {
      return this.pricing[normModel];
    }
    const baseModel = normModel.replace(/-(high|low)$/, "");
    if (baseModel !== normModel && this.pricing[baseModel]) {
      return this.pricing[baseModel];
    }
    for (const [key, value] of Object.entries(this.pricing)) {
      if (normModel.includes(key)) {
        return value;
      }
    }
    return { inputCostPerM: 1, outputCostPerM: 3 };
  }
  /**
   * Estimates cost in USD for a given input & output token count.
   */
  static estimateCost(model, inputTokens, outputTokens, provider) {
    const price = this.getModelPrice(model, provider);
    const inputCost = inputTokens / 1e6 * price.inputCostPerM;
    const outputCost = outputTokens / 1e6 * price.outputCostPerM;
    return Number((inputCost + outputCost).toFixed(6));
  }
};

// electron/db/settings.ts
function addMemory(db, type, content) {
  checkArgs(typeof type === "string" && type.length > 0, "Memory type must be a valid non-empty string");
  checkArgs(typeof content === "string" && content.length > 0, "Memory content must be a valid non-empty string");
  if (!db) throw new Error("DB not initialized");
  const stmt = db.prepare("INSERT INTO memories (type, content) VALUES (?, ?)");
  stmt.run(type, content);
}
function getMemories(db, type) {
  if (!db) return [];
  const query = type ? "SELECT * FROM memories WHERE type = ? ORDER BY updated_at DESC" : "SELECT * FROM memories ORDER BY updated_at DESC";
  const stmt = db.prepare(query);
  return type ? stmt.all(type) : stmt.all();
}
function searchMemories(db, query, limit = 5) {
  if (!db) return [];
  const terms = query.split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) {
    return db.prepare("SELECT * FROM memories ORDER BY updated_at DESC LIMIT ?").all(limit);
  }
  const conditions = terms.map(() => "content LIKE ? OR type LIKE ?").join(" OR ");
  const params = [];
  for (const t of terms) {
    params.push(`%${t}%`, `%${t}%`);
  }
  params.push(limit);
  const stmt = db.prepare(`
        SELECT * FROM memories 
        WHERE ${conditions}
        ORDER BY updated_at DESC
        LIMIT ?
    `);
  return stmt.all(...params);
}
function deleteMemory(db, id) {
  if (!db) throw new Error("DB not initialized");
  db.prepare("DELETE FROM memories WHERE id = ?").run(id);
}
function createSnapshot(db, name) {
  checkArgs(typeof name === "string" && name.length > 0, "Snapshot name must be a valid non-empty string");
  if (!db) throw new Error("DB not initialized");
  const stmt = db.prepare("INSERT INTO vc_snapshots (name) VALUES (?)");
  const info = stmt.run(name);
  return info.lastInsertRowid;
}
function addBlob(db, hash, content) {
  checkArgs(typeof hash === "string" && hash.length > 0, "Blob hash must be a valid non-empty string");
  checkArgs(typeof content === "string" && content.length > 0, "Blob content must be a valid non-empty string");
  if (!db) throw new Error("DB not initialized");
  const stmt = db.prepare("INSERT OR IGNORE INTO vc_blobs (hash, content) VALUES (?, ?)");
  stmt.run(hash, content);
}
function addSnapshotFile(db, snapshotId, filePath, blobHash) {
  checkArgs(snapshotId !== void 0, "Snapshot ID is required");
  checkArgs(typeof filePath === "string" && filePath.length > 0, "File path must be a valid non-empty string");
  checkArgs(typeof blobHash === "string" && blobHash.length > 0, "Blob hash must be a valid non-empty string");
  if (!db) throw new Error("DB not initialized");
  const stmt = db.prepare("INSERT INTO vc_snapshot_files (snapshot_id, file_path, blob_hash) VALUES (?, ?, ?)");
  stmt.run(snapshotId, filePath, blobHash);
}
function getSnapshots(db) {
  if (!db) return [];
  return db.prepare("SELECT * FROM vc_snapshots ORDER BY created_at DESC").all();
}
function getSnapshot(db, id) {
  if (!db) return null;
  return db.prepare("SELECT * FROM vc_snapshots WHERE id = ?").get(id);
}
function getSnapshotFiles(db, snapshotId) {
  if (!db) return [];
  return db.prepare(`
        SELECT f.file_path, b.content 
        FROM vc_snapshot_files f
        JOIN vc_blobs b ON f.blob_hash = b.hash
        WHERE f.snapshot_id = ?
    `).all(snapshotId);
}
function createTask(db, title, description, parentTaskId, assignedAgentId, createdBy = "user", contextBudget = 3e3, priority = 0) {
  checkArgs(typeof title === "string" && title.length > 0, "Task title must be a valid non-empty string");
  checkArgs(typeof createdBy === "string", "createdBy must be a string");
  checkArgs(typeof contextBudget === "number" && contextBudget > 0, "contextBudget must be a positive number");
  if (!db) throw new Error("DB not initialized");
  const stmt = db.prepare(`
        INSERT INTO tasks (title, description, parent_task_id, assigned_agent_id, created_by, context_budget, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
  const info = stmt.run(title, description, parentTaskId || null, assignedAgentId || null, createdBy, contextBudget, priority);
  return info.lastInsertRowid;
}
function updateTaskStatus(db, id, status) {
  checkArgs(typeof id === "number", "Task ID must be a number");
  checkArgs(["pending", "in_progress", "completed", "failed", "blocked"].includes(status), "Invalid task status");
  if (!db) throw new Error("DB not initialized");
  const completedAt = status === "completed" ? (/* @__PURE__ */ new Date()).toISOString() : null;
  db.prepare(`
        UPDATE tasks 
        SET status = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `).run(status, completedAt, id);
}
function getTask(db, id) {
  checkArgs(typeof id === "number", "Task ID must be a number");
  if (!db) return null;
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
}
function getTaskTree(db) {
  if (!db) return [];
  return db.prepare("SELECT * FROM tasks ORDER BY created_at ASC").all();
}
function getSubtasks(db, parentTaskId) {
  checkArgs(typeof parentTaskId === "number", "Parent Task ID must be a number");
  if (!db) return [];
  return db.prepare("SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at ASC").all(parentTaskId);
}
function addTaskOutput(db, taskId, content, agentId, outputType = "text", tokenCount = 0, modelUsed, providerUsed) {
  checkArgs(typeof taskId === "number", "Task ID must be a number");
  checkArgs(typeof content === "string" && content.length > 0, "Content must be a valid non-empty string");
  if (!db) throw new Error("DB not initialized");
  const stmt = db.prepare(`
        INSERT INTO task_outputs (task_id, agent_id, output_type, content, token_count, model_used, provider_used)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
  const info = stmt.run(taskId, agentId || null, outputType, content, tokenCount, modelUsed || null, providerUsed || null);
  return info.lastInsertRowid;
}
function updateTaskOutputVerification(db, id, status) {
  checkArgs(typeof id === "number", "Output ID must be a number");
  checkArgs(typeof status === "string", "Verification status must be a string");
  if (!db) throw new Error("DB not initialized");
  db.prepare("UPDATE task_outputs SET verification_status = ? WHERE id = ?").run(status, id);
}
function getTaskOutputs(db, taskId) {
  checkArgs(typeof taskId === "number", "Task ID must be a number");
  if (!db) return [];
  return db.prepare("SELECT * FROM task_outputs WHERE task_id = ? ORDER BY created_at DESC").all(taskId);
}
function getTaskOutput(db, id) {
  checkArgs(typeof id === "number", "Output ID must be a number");
  if (!db) return null;
  return db.prepare("SELECT * FROM task_outputs WHERE id = ?").get(id);
}
function getTaskPlan(db, taskId) {
  checkArgs(typeof taskId === "number", "Task ID must be a number");
  if (!db) return null;
  const plan = db.prepare("SELECT * FROM task_plans WHERE task_id = ? ORDER BY created_at DESC LIMIT 1").get(taskId);
  return plan;
}
function updateTaskPlanJson(db, taskId, planJson, status = "draft", confidence) {
  checkArgs(typeof taskId === "number", "Task ID must be a number");
  checkArgs(typeof planJson === "string", "Plan JSON must be a string");
  if (!db) throw new Error("DB not initialized");
  const taskRow = db.prepare("SELECT id FROM tasks WHERE id = ?").get(taskId);
  if (!taskRow) {
    db.prepare("INSERT INTO tasks (id, title, description, status) VALUES (?, 'Chat Plan Task', 'Auto-created task from chat planning session', 'in_progress')").run(taskId);
  }
  const existing = db.prepare("SELECT id FROM task_plans WHERE task_id = ? ORDER BY created_at DESC LIMIT 1").get(taskId);
  if (existing) {
    db.prepare("UPDATE task_plans SET plan_json = ?, status = ?, confidence = ? WHERE id = ?").run(planJson, status, confidence !== void 0 ? confidence : null, existing.id);
  } else {
    db.prepare("INSERT INTO task_plans (task_id, plan_json, status, confidence) VALUES (?, ?, ?, ?)").run(taskId, planJson, status, confidence !== void 0 ? confidence : 1);
  }
  return true;
}
function findPlanByTitle(db, taskId, title) {
  checkArgs(typeof taskId === "number", "Task ID must be a number");
  checkArgs(typeof title === "string", "Title must be a string");
  if (!db) return null;
  const rows = db.prepare("SELECT * FROM task_plans WHERE task_id = ?").all(taskId);
  for (const row of rows) {
    try {
      const json = JSON.parse(row.plan_json);
      if (json.title && json.title === title) {
        return row;
      }
    } catch (e) {
    }
  }
  return null;
}
function rollbackTaskPlan(db, taskId) {
  checkArgs(typeof taskId === "number", "Task ID must be a number");
  if (!db) throw new Error("DB not initialized");
  const latest = db.prepare("SELECT id FROM task_plans WHERE task_id = ? ORDER BY created_at DESC LIMIT 1").get(taskId);
  if (latest && latest.id) {
    db.prepare("DELETE FROM task_plans WHERE id = ?").run(latest.id);
  }
}
function addTaskPlan(db, taskId, planJson, confidence, status = "draft") {
  checkArgs(typeof taskId === "number", "Task ID must be a number");
  checkArgs(typeof planJson === "string", "Plan JSON must be a string");
  checkArgs(typeof confidence === "number", "Confidence must be a number");
  if (!db) throw new Error("DB not initialized");
  const stmt = db.prepare(`
        INSERT INTO task_plans (task_id, plan_json, status, confidence)
        VALUES (?, ?, ?, ?)
    `);
  const info = stmt.run(taskId, planJson, status, confidence);
  return info.lastInsertRowid;
}
function updateTaskPlanStatus(db, planId, status) {
  checkArgs(typeof planId === "number", "Plan ID must be a number");
  checkArgs(typeof status === "string", "Status must be a string");
  if (!db) throw new Error("DB not initialized");
  db.prepare("UPDATE task_plans SET status = ? WHERE id = ?").run(status, planId);
}
function addTaskDoc(db, taskId, title, content, docType = "completion", generatedBy = "auto") {
  checkArgs(typeof taskId === "number", "Task ID must be a number");
  checkArgs(typeof title === "string" && title.length > 0, "Title must be a valid non-empty string");
  checkArgs(typeof content === "string" && content.length > 0, "Doc content must be a valid non-empty string");
  if (!db) throw new Error("DB not initialized");
  const stmt = db.prepare(`
        INSERT INTO task_docs (task_id, title, content, doc_type, generated_by)
        VALUES (?, ?, ?, ?, ?)
    `);
  const info = stmt.run(taskId, title, content, docType, generatedBy);
  return info.lastInsertRowid;
}
function getTaskDocs(db, taskId) {
  checkArgs(typeof taskId === "number", "Task ID must be a number");
  if (!db) return [];
  return db.prepare("SELECT * FROM task_docs WHERE task_id = ? ORDER BY created_at DESC").all(taskId);
}
function addExecutionAttempt(db, taskId, attemptNumber, modelUsed, providerUsed, planId, outputId, verificationStatus, failureReason) {
  checkArgs(typeof taskId === "number", "Task ID must be a number");
  checkArgs(typeof attemptNumber === "number", "Attempt number must be a number");
  if (!db) throw new Error("DB not initialized");
  const stmt = db.prepare(`
        INSERT INTO execution_attempts (task_id, attempt_number, model_used, provider_used, plan_id, output_id, verification_status, failure_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
  const info = stmt.run(taskId, attemptNumber, modelUsed, providerUsed, planId, outputId, verificationStatus, failureReason);
  return info.lastInsertRowid;
}
function getExecutionAttempts(db, taskId) {
  checkArgs(typeof taskId === "number", "Task ID must be a number");
  if (!db) return [];
  return db.prepare("SELECT * FROM execution_attempts WHERE task_id = ? ORDER BY attempt_number ASC").all(taskId);
}
function getTaskExecutionDetails(db, taskId) {
  checkArgs(typeof taskId === "number", "Task ID must be a number");
  if (!db) return [];
  const attempts = db.prepare(`
        SELECT ea.*, o.content as output_content
        FROM execution_attempts ea
        LEFT JOIN task_outputs o ON ea.output_id = o.id
        WHERE ea.task_id = ?
        ORDER BY ea.attempt_number ASC
    `).all(taskId);
  return attempts.map((a) => {
    let verificationResults = [];
    if (a.output_id) {
      verificationResults = db.prepare(`
                SELECT vr.*, r.name as rule_name, r.rule_type
                FROM verification_results vr
                JOIN verification_rules r ON vr.rule_id = r.id
                WHERE vr.task_output_id = ?
            `).all(a.output_id);
    }
    return {
      ...a,
      verification_results: verificationResults
    };
  });
}
function addVerificationRule(db, name, description, ruleType, triggerOn, config, appliesTo = "*") {
  checkArgs(typeof name === "string" && name.length > 0, "Rule name is required");
  checkArgs(["pattern", "llm_judge", "human"].includes(ruleType), "Invalid rule type");
  if (!db) throw new Error("DB not initialized");
  const stmt = db.prepare(`
        INSERT INTO verification_rules (name, description, rule_type, trigger_on, config, applies_to)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
  const info = stmt.run(name, description, ruleType, triggerOn, JSON.stringify(config), appliesTo);
  return info.lastInsertRowid;
}
function getVerificationRules(db) {
  if (!db) return [];
  const rules = db.prepare("SELECT * FROM verification_rules").all();
  return rules.map((r) => ({ ...r, config: JSON.parse(r.config) }));
}
function addVerificationResult(db, taskOutputId, ruleId, result, score, details, verifiedBy) {
  checkArgs(typeof taskOutputId === "number", "Task Output ID must be a number");
  checkArgs(typeof ruleId === "number", "Rule ID must be a number");
  checkArgs(["passed", "failed", "pending_review"].includes(result), "Invalid verification result");
  if (!db) throw new Error("DB not initialized");
  const stmt = db.prepare(`
        INSERT INTO verification_results (task_output_id, rule_id, result, score, details, verified_by)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
  const info = stmt.run(taskOutputId, ruleId, result, score, details, verifiedBy);
  return info.lastInsertRowid;
}
function getVerificationResults(db, taskOutputId) {
  checkArgs(typeof taskOutputId === "number", "Task Output ID must be a number");
  if (!db) return [];
  return db.prepare("SELECT * FROM verification_results WHERE task_output_id = ?").all(taskOutputId);
}
function addKnowledgeChunk(db, sourceType, sourceId, content, metadata, tokenCount = 0, embedding) {
  checkArgs(typeof sourceType === "string" && sourceType.length > 0, "Source type is required");
  checkArgs(typeof content === "string" && content.length > 0, "Chunk content is required");
  if (!db) throw new Error("DB not initialized");
  const runTx = db.transaction((embData) => {
    const chunkStmt = db.prepare(`
            INSERT INTO knowledge_chunks (source_type, source_id, content, metadata, token_count)
            VALUES (?, ?, ?, ?, ?)
        `);
    const chunkInfo = chunkStmt.run(sourceType, sourceId, content, JSON.stringify(metadata), tokenCount);
    const chunkId = chunkInfo.lastInsertRowid;
    if (embData) {
      const vecStmt = db.prepare(`
                INSERT INTO vec_knowledge (chunk_id, embedding)
                VALUES (?, ?)
            `);
      vecStmt.run(BigInt(chunkId), Buffer2.from(embData.buffer, embData.byteOffset, embData.byteLength));
    }
    return chunkId;
  });
  let floatArray;
  if (embedding) {
    floatArray = embedding instanceof Float32Array ? embedding : new Float32Array(embedding);
    checkArgs(floatArray.length === 1536, "Vector embedding must have exactly 1536 dimensions");
  }
  return runTx(floatArray);
}
function searchKnowledge(db, queryEmbedding, limit = 10) {
  checkArgs(limit > 0, "Limit must be positive");
  if (!db) return [];
  const floatArray = queryEmbedding instanceof Float32Array ? queryEmbedding : new Float32Array(queryEmbedding);
  checkArgs(floatArray.length === 1536, "Query vector must have exactly 1536 dimensions");
  const stmt = db.prepare(`
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
  const results = stmt.all(Buffer2.from(floatArray.buffer, floatArray.byteOffset, floatArray.byteLength), limit);
  return results.map((r) => ({
    ...r,
    metadata: r.metadata ? JSON.parse(r.metadata) : {}
  }));
}
function addModelPerformance(db, model, provider, taskType, success, attemptNumber, tokenCount, latencyMs, inputTokens = 0, outputTokens = 0) {
  checkArgs(typeof model === "string" && model.length > 0, "Model must be a non-empty string");
  checkArgs(typeof provider === "string" && provider.length > 0, "Provider must be a non-empty string");
  if (!db) throw new Error("DB not initialized");
  const inputVal = inputTokens || Math.round(tokenCount * 0.8);
  const outputVal = outputTokens || tokenCount - inputVal;
  const stmt = db.prepare(`
        INSERT INTO model_performance (model, provider, task_type, success, attempt_number, token_count, latency_ms, input_tokens, output_tokens)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  const info = stmt.run(model, provider, taskType, success, attemptNumber, tokenCount, latencyMs, inputVal, outputVal);
  return info.lastInsertRowid;
}
function getModelPerformanceSummary(db) {
  if (!db) return [];
  return db.prepare(`
        SELECT model, provider, COUNT(*) as total_runs, SUM(success) as successful_runs, AVG(latency_ms) as avg_latency
        FROM model_performance
        GROUP BY model, provider
    `).all();
}
function getUsageStats(db) {
  if (!db) return { totalTokens: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, breakdowns: [] };
  const rows = db.prepare(`
        SELECT model, provider, COUNT(*) as total_runs, SUM(token_count) as total_tokens, SUM(input_tokens) as total_input, SUM(output_tokens) as total_output
        FROM model_performance
        GROUP BY model, provider
    `).all();
  let totalTokens = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;
  const breakdowns = rows.map((row) => {
    const tokens = row.total_tokens || 0;
    const inputTokens = row.total_input || 0;
    const outputTokens = row.total_output || 0;
    totalTokens += tokens;
    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;
    const cost = CostEstimatorService.estimateCost(row.model, inputTokens, outputTokens, row.provider);
    totalCost += cost;
    return {
      model: row.model,
      provider: row.provider,
      runs: row.total_runs,
      tokens,
      inputTokens,
      outputTokens,
      cost: Number(cost.toFixed(6))
    };
  });
  return {
    totalTokens,
    totalInputTokens,
    totalOutputTokens,
    totalCost: Number(totalCost.toFixed(4)),
    breakdowns
  };
}
function clearUsageStats(db) {
  if (!db) throw new Error("DB not initialized");
  db.prepare("DELETE FROM model_performance").run();
  return true;
}

// electron/db/index.ts
var DatabaseService = class {
  db = null;
  dbPath;
  constructor() {
    console.log("[DatabaseService] Constructor");
    this.dbPath = path2.join(app.getPath("userData"), "cursor-replacer.sqlite");
  }
  async init() {
    console.log("[DatabaseService] Init", this.dbPath);
    try {
      this.db = createDatabase(this.dbPath);
      createTables(this.db);
      migrateKeysToSecureStore(this.db);
      migrateTaskIds(this.db);
      console.log(`Database initialized at ${this.dbPath}`);
    } catch (err) {
      console.error("Failed to initialize database:", err);
      throw err;
    }
  }
  save() {
  }
  createConversation(id, title, model, provider, workspacePath) {
    return createConversation(this.db, id, title, model, provider, workspacePath);
  }
  getConversations(workspacePath) {
    return getConversations(this.db, workspacePath);
  }
  getWorkspacePathForTask(taskId) {
    if (!this.db) return null;
    try {
      const convs = this.db.prepare("SELECT id, workspace_path FROM conversations").all();
      for (const c of convs) {
        if (!c.id) continue;
        let hash = 5381;
        for (let i = 0; i < c.id.length; i++) {
          hash = hash * 33 ^ c.id.charCodeAt(i);
        }
        const expectedTaskId = Math.abs(hash) || 1;
        if (expectedTaskId === taskId) {
          return c.workspace_path || null;
        }
      }
    } catch (e) {
      console.error("[DatabaseService] Failed to lookup workspace path for task:", e);
    }
    return null;
  }
  getConversationMessages(conversationId) {
    return getConversationMessages(this.db, conversationId);
  }
  addChatMessage(conversationId, role, content) {
    return addChatMessage(this.db, conversationId, role, content);
  }
  updateChatMessage(conversationId, messageId, content) {
    return updateChatMessage(this.db, conversationId, messageId, content);
  }
  truncateChatMessages(conversationId, messageId) {
    return truncateChatMessages(this.db, conversationId, messageId);
  }
  touchConversation(conversationId) {
    return touchConversation(this.db, conversationId);
  }
  deleteConversation(conversationId) {
    return deleteConversation(this.db, conversationId);
  }
  updateConversationTitle(conversationId, title) {
    return updateConversationTitle(this.db, conversationId, title);
  }
  // ── Agent Rules ──
  getAgentRules() {
    return getAgentRules(this.db);
  }
  addAgentRule(name, content, isActive) {
    return addAgentRule(this.db, name, content, isActive);
  }
  updateAgentRule(id, name, content, isActive) {
    return updateAgentRule(this.db, id, name, content, isActive);
  }
  deleteAgentRule(id) {
    return deleteAgentRule(this.db, id);
  }
  toggleAgentRule(id, isActive) {
    return toggleAgentRule(this.db, id, isActive);
  }
  // ── Agents ──
  addAgent(name, systemPrompt) {
    return addAgent(this.db, name, systemPrompt);
  }
  getAgents() {
    return getAgents(this.db);
  }
  deleteAgent(id) {
    return deleteAgent(this.db, id);
  }
  // ── Flows ──
  addFlow(name, description, steps, agentId) {
    return addFlow(this.db, name, description, steps, agentId);
  }
  getFlows() {
    return getFlows(this.db);
  }
  deleteFlow(id) {
    return deleteFlow(this.db, id);
  }
  updateFlow(id, steps) {
    return updateFlow(this.db, id, steps);
  }
  // ── Custom Providers ──
  addCustomProvider(id, name, baseUrl, apiKey, isLocal) {
    return addCustomProvider(this.db, id, name, baseUrl, apiKey, isLocal);
  }
  getCustomProviders() {
    return getCustomProviders(this.db);
  }
  deleteCustomProvider(id) {
    return deleteCustomProvider(this.db, id);
  }
  // ── Custom Models ──
  addCustomModel(providerId, modelName, hasThinking) {
    return addCustomModel(this.db, providerId, modelName, hasThinking);
  }
  getCustomModels(providerId) {
    return getCustomModels(this.db, providerId);
  }
  toggleCustomModelThinking(providerId, modelName, hasThinking) {
    return toggleCustomModelThinking(this.db, providerId, modelName, hasThinking);
  }
  deleteCustomModel(providerId, modelName) {
    return deleteCustomModel(this.db, providerId, modelName);
  }
  // ── Memories ──
  addMemory(type, content) {
    return addMemory(this.db, type, content);
  }
  getMemories(type) {
    return getMemories(this.db, type);
  }
  searchMemories(query, limit) {
    return searchMemories(this.db, query, limit);
  }
  deleteMemory(id) {
    return deleteMemory(this.db, id);
  }
  // ── VC Snapshots ──
  createSnapshot(name) {
    return createSnapshot(this.db, name);
  }
  getSnapshot(id) {
    return getSnapshot(this.db, id);
  }
  addBlob(hash, content) {
    return addBlob(this.db, hash, content);
  }
  addSnapshotFile(snapshotId, filePath, blobHash) {
    return addSnapshotFile(this.db, snapshotId, filePath, blobHash);
  }
  getSnapshots() {
    return getSnapshots(this.db);
  }
  getSnapshotFiles(snapshotId) {
    return getSnapshotFiles(this.db, snapshotId);
  }
  // ── Tasks ──
  createTask(title, description, parentTaskId, assignedAgentId, createdBy, contextBudget, priority) {
    return createTask(this.db, title, description, parentTaskId, assignedAgentId, createdBy, contextBudget, priority);
  }
  updateTaskStatus(id, status) {
    return updateTaskStatus(this.db, id, status);
  }
  getTask(id) {
    return getTask(this.db, id);
  }
  getTaskTree() {
    return getTaskTree(this.db);
  }
  getSubtasks(parentTaskId) {
    return getSubtasks(this.db, parentTaskId);
  }
  // ── Task Outputs ──
  addTaskOutput(taskId, content, agentId, outputType, tokenCount, modelUsed, providerUsed) {
    return addTaskOutput(this.db, taskId, content, agentId, outputType, tokenCount, modelUsed, providerUsed);
  }
  updateTaskOutputVerification(id, status) {
    return updateTaskOutputVerification(this.db, id, status);
  }
  getTaskOutputs(taskId) {
    return getTaskOutputs(this.db, taskId);
  }
  getTaskOutput(id) {
    return getTaskOutput(this.db, id);
  }
  // ── Task Plans ──
  getTaskPlan(taskId) {
    return getTaskPlan(this.db, taskId);
  }
  updateTaskPlanJson(taskId, planJson, status, confidence) {
    return updateTaskPlanJson(this.db, taskId, planJson, status, confidence);
  }
  findPlanByTitle(taskId, title) {
    return findPlanByTitle(this.db, taskId, title);
  }
  rollbackTaskPlan(taskId) {
    return rollbackTaskPlan(this.db, taskId);
  }
  addTaskPlan(taskId, planJson, confidence, status) {
    return addTaskPlan(this.db, taskId, planJson, confidence, status);
  }
  updateTaskPlanStatus(planId, status) {
    return updateTaskPlanStatus(this.db, planId, status);
  }
  // ── Task Docs ──
  addTaskDoc(taskId, title, content, docType, generatedBy) {
    return addTaskDoc(this.db, taskId, title, content, docType, generatedBy);
  }
  getTaskDocs(taskId) {
    return getTaskDocs(this.db, taskId);
  }
  // ── Execution Attempts ──
  addExecutionAttempt(taskId, attemptNumber, modelUsed, providerUsed, planId, outputId, verificationStatus, failureReason) {
    return addExecutionAttempt(this.db, taskId, attemptNumber, modelUsed, providerUsed, planId, outputId, verificationStatus, failureReason);
  }
  getExecutionAttempts(taskId) {
    return getExecutionAttempts(this.db, taskId);
  }
  getTaskExecutionDetails(taskId) {
    return getTaskExecutionDetails(this.db, taskId);
  }
  // ── Verification Rules ──
  addVerificationRule(name, description, ruleType, triggerOn, config, appliesTo) {
    return addVerificationRule(this.db, name, description, ruleType, triggerOn, config, appliesTo);
  }
  getVerificationRules() {
    return getVerificationRules(this.db);
  }
  // ── Verification Results ──
  addVerificationResult(taskOutputId, ruleId, result, score, details, verifiedBy) {
    return addVerificationResult(this.db, taskOutputId, ruleId, result, score, details, verifiedBy);
  }
  getVerificationResults(taskOutputId) {
    return getVerificationResults(this.db, taskOutputId);
  }
  // ── Knowledge ──
  addKnowledgeChunk(sourceType, sourceId, content, metadata, tokenCount, embedding) {
    return addKnowledgeChunk(this.db, sourceType, sourceId, content, metadata, tokenCount, embedding);
  }
  searchKnowledge(queryEmbedding, limit) {
    return searchKnowledge(this.db, queryEmbedding, limit);
  }
  // ── Model Performance ──
  addModelPerformance(model, provider, taskType, success, attemptNumber, tokenCount, latencyMs, inputTokens, outputTokens) {
    return addModelPerformance(this.db, model, provider, taskType, success, attemptNumber, tokenCount, latencyMs, inputTokens, outputTokens);
  }
  getModelPerformanceSummary() {
    return getModelPerformanceSummary(this.db);
  }
  getUsageStats() {
    return getUsageStats(this.db);
  }
  clearUsageStats() {
    return clearUsageStats(this.db);
  }
};
var dbService = new DatabaseService();

// electron/services/taxonomy/TaxonomyClassifier.ts
var DEFAULT_MULTIPLIERS = {
  taskTitle: 2,
  taskDescription: 1.5,
  fileName: 1.8,
  directoryName: 1.5,
  importStatement: 2.5,
  packageJson: 2,
  codeSymbol: 1.5,
  codeBody: 0.8,
  comment: 0.5,
  stringLiteral: 0.3,
  agentThought: 1.8
};
var DEFAULT_THRESHOLDS = {
  activationThreshold: 0.6,
  depthThresholds: {
    1: 0.4,
    2: 0.5,
    3: 0.65,
    4: 0.75,
    5: 0.85
  },
  siblingAmbiguityBand: 0.15,
  complexityGate: {
    minTitleWords: 3,
    minFilesModified: 1,
    minPlanSteps: 2
  }
};
var TaxonomyClassifier = class {
  static shouldActivateTaxonomy(task, plan, thresholds = DEFAULT_THRESHOLDS) {
    if (!task || !task.title) return false;
    const titleWords = task.title.trim().split(/\s+/).filter(Boolean).length;
    if (titleWords < thresholds.complexityGate.minTitleWords) return false;
    const trivialPatterns = /^(rename|typo|comment|format|indent|whitespace|spelling)/i;
    if (trivialPatterns.test(task.title)) return false;
    if (plan) {
      const parsedPlan = typeof plan === "string" ? JSON.parse(plan) : plan;
      const stepsCount = parsedPlan.steps ? parsedPlan.steps.length : 0;
      const filesCount = parsedPlan.filesToModify ? parsedPlan.filesToModify.length : 0;
      if (stepsCount > 0 && stepsCount < thresholds.complexityGate.minPlanSteps) return false;
      if (filesCount > 0 && filesCount < thresholds.complexityGate.minFilesModified) return false;
    }
    return true;
  }
  static gatherSignals(task, plan, investigationResults, fileContentsMap, packageJsonDeps = []) {
    const title = task?.title || "";
    const description = task?.description || "";
    const fileNames = [];
    const directoryPaths = [];
    const importStatements = [];
    const codeSymbols = [];
    const comments = [];
    const stringLiterals = [];
    let codeBody = "";
    if (plan) {
      const parsedPlan = typeof plan === "string" ? JSON.parse(plan) : plan;
      if (parsedPlan.filesToModify && Array.isArray(parsedPlan.filesToModify)) {
        for (const file of parsedPlan.filesToModify) {
          const baseName = file.split(/[/\\]/).pop() || "";
          fileNames.push(baseName);
          const dirName = file.split(/[/\\]/).slice(0, -1).join("/") || "";
          if (dirName) directoryPaths.push(dirName);
        }
      }
    }
    if (fileContentsMap) {
      for (const [filePath, content] of Object.entries(fileContentsMap)) {
        const baseName = filePath.split(/[/\\]/).pop() || "";
        if (!fileNames.includes(baseName)) {
          fileNames.push(baseName);
        }
        const dirName = filePath.split(/[/\\]/).slice(0, -1).join("/") || "";
        if (dirName && !directoryPaths.includes(dirName)) {
          directoryPaths.push(dirName);
        }
        codeBody += "\n" + content;
        const lines = content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("import ") || trimmed.startsWith("const ") && trimmed.includes("require(")) {
            importStatements.push(trimmed);
          }
          if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.endsWith("*/")) {
            comments.push(trimmed);
          }
          const strings = trimmed.match(/(["'`])(.*?)\1/g);
          if (strings) {
            for (const str of strings) {
              stringLiterals.push(str);
            }
          }
        }
      }
    }
    if (codeBody) {
      const classMatches = codeBody.match(/class\s+([a-zA-Z0-9_$]+)/g);
      if (classMatches) {
        for (const m of classMatches) {
          const sym = m.split(/\s+/)[1];
          if (sym) codeSymbols.push(sym);
        }
      }
      const funcMatches = codeBody.match(/function\s+([a-zA-Z0-9_$]+)/g);
      if (funcMatches) {
        for (const m of funcMatches) {
          const sym = m.split(/\s+/)[1];
          if (sym) codeSymbols.push(sym);
        }
      }
      const constMatches = codeBody.match(/const\s+([a-zA-Z0-9_$]+)\s*=/g);
      if (constMatches) {
        for (const m of constMatches) {
          const parts = m.split(/\s+/);
          const sym = parts[1];
          if (sym && sym !== "=") codeSymbols.push(sym);
        }
      }
    }
    const agentThoughts = investigationResults ? [investigationResults] : [];
    return {
      taskTitle: title,
      taskDescription: description,
      fileNames,
      directoryPaths,
      importStatements,
      packageJsonDeps,
      codeSymbols,
      codeBody,
      comments,
      stringLiterals,
      agentThoughts
    };
  }
  static scoreNode(node, signals, multipliers = DEFAULT_MULTIPLIERS, depth = 1) {
    let score = 0;
    const triggers = node.triggers;
    if (!triggers) return 0;
    const checkTextContainsWord = (text, word) => {
      const cleanWord = word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`\\b${cleanWord}\\b`, "i");
      return regex.test(text);
    };
    const countMatches = (list, term, isWord = true) => {
      let count = 0;
      for (const item of list) {
        if (isWord) {
          if (checkTextContainsWord(item, term)) count++;
        } else {
          if (item.toLowerCase().includes(term.toLowerCase())) count++;
        }
      }
      return count;
    };
    if (triggers.words) {
      for (const w of triggers.words) {
        if (checkTextContainsWord(signals.taskTitle, w.word)) {
          score += w.weight * multipliers.taskTitle;
        }
        if (checkTextContainsWord(signals.taskDescription, w.word)) {
          score += w.weight * multipliers.taskDescription;
        }
        for (const fName of signals.fileNames) {
          if (checkTextContainsWord(fName, w.word)) {
            score += w.weight * multipliers.fileName;
          }
        }
        for (const dir of signals.directoryPaths) {
          if (checkTextContainsWord(dir, w.word)) {
            score += w.weight * multipliers.directoryName;
          }
        }
        if (countMatches(signals.importStatements, w.word) > 0) {
          score += w.weight * multipliers.importStatement;
        }
        if (countMatches(signals.packageJsonDeps, w.word) > 0) {
          score += w.weight * multipliers.packageJson;
        }
        if (countMatches(signals.codeSymbols, w.word) > 0) {
          score += w.weight * multipliers.codeSymbol;
        }
        if (checkTextContainsWord(signals.codeBody, w.word)) {
          score += w.weight * multipliers.codeBody;
        }
        if (countMatches(signals.comments, w.word) > 0) {
          score += w.weight * multipliers.comment;
        }
        if (countMatches(signals.stringLiterals, w.word) > 0) {
          score += w.weight * multipliers.stringLiteral;
        }
        for (const thought of signals.agentThoughts) {
          if (checkTextContainsWord(thought, w.word)) {
            score += w.weight * multipliers.agentThought;
          }
        }
      }
    }
    if (triggers.phrases) {
      for (const p of triggers.phrases) {
        const matchesPhrase = (text) => text.toLowerCase().includes(p.phrase.toLowerCase());
        if (matchesPhrase(signals.taskTitle)) score += p.weight * multipliers.taskTitle;
        if (matchesPhrase(signals.taskDescription)) score += p.weight * multipliers.taskDescription;
        for (const fName of signals.fileNames) {
          if (matchesPhrase(fName)) score += p.weight * multipliers.fileName;
        }
        for (const dir of signals.directoryPaths) {
          if (matchesPhrase(dir)) score += p.weight * multipliers.directoryName;
        }
        if (countMatches(signals.importStatements, p.phrase, false) > 0) score += p.weight * multipliers.importStatement;
        if (countMatches(signals.packageJsonDeps, p.phrase, false) > 0) score += p.weight * multipliers.packageJson;
        if (countMatches(signals.codeSymbols, p.phrase, false) > 0) score += p.weight * multipliers.codeSymbol;
        if (matchesPhrase(signals.codeBody)) score += p.weight * multipliers.codeBody;
        if (countMatches(signals.comments, p.phrase, false) > 0) score += p.weight * multipliers.comment;
        if (countMatches(signals.stringLiterals, p.phrase, false) > 0) score += p.weight * multipliers.stringLiteral;
        for (const thought of signals.agentThoughts) {
          if (matchesPhrase(thought)) score += p.weight * multipliers.agentThought;
        }
      }
    }
    if (triggers.antiWords) {
      for (const aw of triggers.antiWords) {
        if (checkTextContainsWord(signals.taskTitle, aw.word) || checkTextContainsWord(signals.taskDescription, aw.word) || signals.fileNames.some((f) => checkTextContainsWord(f, aw.word))) {
          score += aw.weight;
        }
      }
    }
    if (triggers.importPatterns) {
      for (const imp of triggers.importPatterns) {
        const normalizedImp = imp.toLowerCase().replace(/['"]/g, "'");
        if (signals.importStatements.some((line) => line.toLowerCase().replace(/['"]/g, "'").includes(normalizedImp))) {
          score += 2;
        }
      }
    }
    if (triggers.filePatterns) {
      for (const pat of triggers.filePatterns) {
        const regexPat = pat.replace(/\*\*/g, ".*").replace(/\*/g, "[^/\\\\]*");
        const regex = new RegExp(`^${regexPat}$`, "i");
        if (signals.fileNames.some((f) => regex.test(f)) || signals.directoryPaths.some((d) => regex.test(d))) {
          score += 1.5;
        }
      }
    }
    if (triggers.symbolPatterns) {
      for (const sym of triggers.symbolPatterns) {
        if (signals.codeSymbols.some((s) => s.toLowerCase() === sym.toLowerCase())) {
          score += 1;
        }
      }
    }
    const depthPenalty = 1 / (1 + depth * 0.15);
    return score * depthPenalty;
  }
  static classifyAxis(axisName, axisTree, signals, thresholds = DEFAULT_THRESHOLDS, multipliers = DEFAULT_MULTIPLIERS) {
    let currentNode = axisTree;
    const pathIds = [];
    while (currentNode) {
      if (currentNode.children.length === 0) {
        break;
      }
      const childScores = /* @__PURE__ */ new Map();
      for (const child of currentNode.children) {
        const childDepth = pathIds.length + 1;
        const score = this.scoreNode(child, signals, multipliers, childDepth);
        childScores.set(child, score);
      }
      const sorted = [...childScores.entries()].sort((a, b) => b[1] - a[1]);
      if (sorted.length === 0) break;
      const [topNode, topScore] = sorted[0];
      const currentDepth = pathIds.length + 1;
      const requiredThreshold = thresholds.depthThresholds[currentDepth] || thresholds.activationThreshold;
      if (topScore < requiredThreshold) {
        break;
      }
      if (sorted.length >= 2) {
        const [, secondScore] = sorted[1];
        if (topScore - secondScore < thresholds.siblingAmbiguityBand) {
          break;
        }
      }
      currentNode = topNode;
      pathIds.push(currentNode.id);
    }
    if (pathIds.length === 0) {
      return null;
    }
    const totalScore = pathIds.reduce((sum, id, index) => {
      const node = this.findNodeInSubtree(axisTree, id);
      return sum + (node ? this.scoreNode(node, signals, multipliers, index + 1) : 0);
    }, 0);
    const confidence = Math.min(1, totalScore / pathIds.length);
    return {
      axisName,
      nodeIds: pathIds,
      deepestNode: currentNode,
      confidence,
      depth: pathIds.length
    };
  }
  static findNodeInSubtree(root, id) {
    if (root.id === id) return root;
    for (const child of root.children) {
      const found = this.findNodeInSubtree(child, id);
      if (found) return found;
    }
    return null;
  }
};

// electron/services/taxonomy/FragmentRenderer.ts
var FragmentRenderer = class {
  static renderFragment(fragment, _signals) {
    const lines = [];
    lines.push(`### GUIDANCE [${fragment.weight.toUpperCase()}]: ${fragment.summary}`);
    if (fragment.defersToCodebase) {
      lines.push(`*Deference Policy: If existing patterns in the codebase address this concern, follow the existing pattern unless it has a known deficiency.*`);
    }
    lines.push(fragment.coreGuidance);
    if (fragment.decisionTree) {
      lines.push("\n**Decision Flowchart:**");
      lines.push(this.renderDecisionTree(fragment.decisionTree, 0));
    }
    if (fragment.codePatterns && fragment.codePatterns.length > 0) {
      lines.push("\n**Code Examples:**");
      for (const pattern of fragment.codePatterns) {
        lines.push(`*Concern: ${pattern.concern}*`);
        lines.push(`\u274C **DON'T (Wrong):**
\`\`\`${pattern.wrong.language}
${pattern.wrong.code}
\`\`\`
*Why: ${pattern.wrong.explanation}*
`);
        lines.push(`\u2705 **DO (Correct):**
\`\`\`${pattern.correct.language}
${pattern.correct.code}
\`\`\`
*Why: ${pattern.correct.explanation}*`);
        if (pattern.detectionHint) {
          lines.push(`*Detection Hint: ${pattern.detectionHint}*`);
        }
        lines.push("");
      }
    }
    if (fragment.commonMistakes && fragment.commonMistakes.length > 0) {
      lines.push("\n**Common Mistakes to Avoid:**");
      for (const mistake of fragment.commonMistakes) {
        lines.push(`- **[${mistake.severity.toUpperCase()}]** ${mistake.mistake}`);
        lines.push(`  *Why it happens:* ${mistake.whyItHappens}`);
        lines.push(`  *Correction:* ${mistake.correction}`);
      }
    }
    if (fragment.guardrails && fragment.guardrails.length > 0) {
      lines.push("\n**Hard Guardrails:**");
      for (const guard of fragment.guardrails) {
        lines.push(`\u{1F6AB} **NEVER:** ${guard.rule}`);
        lines.push(`  *Rationale:* ${guard.rationale}`);
        lines.push(`  *Alternative:* ${guard.alternative}`);
      }
    }
    if (fragment.scaffolding && fragment.scaffolding.length > 0) {
      lines.push("\n**Step-by-Step Scaffolding:**");
      const sortedScaffold = [...fragment.scaffolding].sort((a, b) => a.stepNumber - b.stepNumber);
      for (const step of sortedScaffold) {
        lines.push(`${step.stepNumber}. **Instruction:** ${step.instruction}`);
        lines.push(`   *Expected Output:* ${step.expectedOutput}`);
        if (step.dependsOn && step.dependsOn.length > 0) {
          lines.push(`   *Depends on steps:* [${step.dependsOn.join(", ")}]`);
        }
        if (step.pitfalls && step.pitfalls.length > 0) {
          lines.push(`   *Pitfalls:* ${step.pitfalls.join("; ")}`);
        }
      }
    }
    if (fragment.selfVerification && fragment.selfVerification.length > 0) {
      lines.push("\n**Self-Verification Checklist:**");
      for (const check of fragment.selfVerification) {
        lines.push(`[ ] **Check:** ${check.check}`);
        lines.push(`    *How to verify:* ${check.howToVerify}`);
        lines.push(`    *Failure indicator:* ${check.failureIndicator}`);
        lines.push(`    *Remediation:* ${check.remediation}`);
      }
    }
    return lines.join("\n");
  }
  static renderDecisionTree(node, indent) {
    const spaces = " ".repeat(indent * 2);
    let result = `${spaces}IF: ${node.condition}
`;
    const renderBranch = (branch, type) => {
      const branchSpaces = " ".repeat((indent + 1) * 2);
      if (typeof branch === "string") {
        return `${branchSpaces}${type} \u2192 ${branch}
`;
      } else {
        return `${branchSpaces}${type} \u2192
${this.renderDecisionTree(branch, indent + 2)}`;
      }
    };
    result += renderBranch(node.ifTrue, "YES");
    result += renderBranch(node.ifFalse, "NO");
    return result;
  }
  static renderSlotBlock(fragments, axisName, resolvedPath, signals, matchedRules = []) {
    if (fragments.length === 0 && matchedRules.length === 0) return "";
    const lines = [];
    lines.push(`
=== TAXONOMY DOMAIN AWARENESS: ${axisName.toUpperCase()} (${resolvedPath}) ===`);
    const alwaysTriggered = fragments.filter((f) => f.trigger === "always");
    const conditionalTriggered = fragments.filter((f) => {
      if (f.trigger !== "conditional") return false;
      if (!f.conditionalSignals || f.conditionalSignals.length === 0) return false;
      const signalsSource = `${signals.taskTitle} ${signals.taskDescription} ${signals.codeBody}`.toLowerCase();
      return f.conditionalSignals.some((sig) => signalsSource.includes(sig.toLowerCase()));
    });
    const activeFragments = [...alwaysTriggered, ...conditionalTriggered];
    const weightPriority = { critical: 0, principle: 1, awareness: 2 };
    activeFragments.sort((a, b) => weightPriority[a.weight] - weightPriority[b.weight]);
    for (const fragment of activeFragments) {
      lines.push(this.renderFragment(fragment, signals));
      lines.push("");
    }
    if (matchedRules.length > 0) {
      lines.push("**Cross-Axis Rules Activated:**");
      for (const rule of matchedRules) {
        lines.push(`- *Between ${rule.axis1Path} and ${rule.axis2Path}*`);
        lines.push(`  *Resolution:* ${rule.resolution}`);
        lines.push(`  *Guidance:* ${rule.intersectionGuidance}`);
      }
      lines.push("");
    }
    lines.push(`=== END TAXONOMY AWARENESS: ${axisName.toUpperCase()} ===`);
    return lines.join("\n");
  }
};

// electron/services/taxonomy/TaxonomyPromptComposer.ts
function findNodeInTree(tree, id) {
  for (const rootNode of Object.values(tree)) {
    const found = TaxonomyClassifier.findNodeInSubtree(rootNode, id);
    if (found) return found;
  }
  return null;
}
var TaxonomyPromptComposer = class _TaxonomyPromptComposer {
  static SOFT_THRESHOLD = 0.3;
  static resolveSlots(classification, context, signals, crossAxisRules = [], taxonomyTree) {
    const resolvedSlots = /* @__PURE__ */ new Map();
    const activeFragmentIds = [];
    const matchedRules = [];
    const activeAxes = [
      { name: "domain", path: classification.domain, slot: "domain_guidance" },
      { name: "paradigm", path: classification.paradigm, slot: "structural_patterns" },
      { name: "scale", path: classification.scale, slot: "scale_awareness" },
      { name: "concurrency", path: classification.concurrency, slot: "concurrency_guidance" },
      { name: "lifecycle", path: classification.lifecycle, slot: "lifecycle_context" }
    ];
    const activePaths = /* @__PURE__ */ new Set();
    for (const axis of activeAxes) {
      if (axis.path) {
        for (const nodeId of axis.path.nodeIds) {
          activePaths.add(nodeId);
        }
      }
    }
    for (const rule of crossAxisRules) {
      const match1 = activePaths.has(rule.axis1Path);
      const match2 = activePaths.has(rule.axis2Path);
      if (match1 && match2) {
        matchedRules.push(rule);
      }
    }
    for (const axis of activeAxes) {
      if (!axis.path) {
        resolvedSlots.set(axis.slot, "");
        continue;
      }
      const accumulatedFragments = [];
      const rootNode = taxonomyTree ? taxonomyTree[axis.name] : null;
      if (rootNode && taxonomyTree) {
        for (const nodeId of axis.path.nodeIds) {
          const node = TaxonomyClassifier.findNodeInSubtree(rootNode, nodeId);
          if (node) {
            const frags = node.fragments[context] || [];
            accumulatedFragments.push(...frags);
          }
        }
      } else {
        accumulatedFragments.push(...axis.path.deepestNode.fragments[context] || []);
      }
      const crossRefFragments = [];
      const evaluatedCrossRefs = /* @__PURE__ */ new Set();
      if (taxonomyTree) {
        for (const frag of accumulatedFragments) {
          if (frag.crossReferences) {
            for (const refId of frag.crossReferences) {
              if (evaluatedCrossRefs.has(refId)) continue;
              evaluatedCrossRefs.add(refId);
              const refNode = findNodeInTree(taxonomyTree, refId);
              if (refNode) {
                const score = TaxonomyClassifier.scoreNode(refNode, signals);
                if (score >= _TaxonomyPromptComposer.SOFT_THRESHOLD) {
                  const refNodeIds = [];
                  const parts = refId.split(".");
                  let currentPrefix = "";
                  for (const part of parts) {
                    currentPrefix = currentPrefix ? `${currentPrefix}.${part}` : part;
                    refNodeIds.push(currentPrefix);
                  }
                  for (const nodeId of refNodeIds) {
                    const node = findNodeInTree(taxonomyTree, nodeId);
                    if (node) {
                      const refFrags = node.fragments[context] || [];
                      for (const rf of refFrags) {
                        if (rf.weight === "awareness" || rf.weight === "principle") {
                          if (!crossRefFragments.some((existing) => existing.id === rf.id)) {
                            crossRefFragments.push(rf);
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      const axisMatchedRules = matchedRules.filter(
        (r) => r.axis1Path.startsWith(axis.path.nodeIds[0]) || r.axis2Path.startsWith(axis.path.nodeIds[0])
      );
      let slotContent = FragmentRenderer.renderSlotBlock(
        accumulatedFragments,
        axis.name,
        axis.path.nodeIds.join(" -> "),
        signals,
        axisMatchedRules
      );
      if (crossRefFragments.length > 0) {
        slotContent += `

### Supporting Cross-Domain Guidance
`;
        slotContent += crossRefFragments.map((rf) => {
          activeFragmentIds.push(rf.id);
          return FragmentRenderer.renderFragment(rf, signals);
        }).join("\n\n");
      }
      if (classification.scale && (classification.scale.deepestNode.id === "single-user.local-desktop" || classification.scale.deepestNode.id === "single-user")) {
        const suppressPatterns = [
          "distributed caching",
          "horizontal partition",
          "sharding",
          "replica",
          "message queue",
          "load balancer"
        ];
        for (const pat of suppressPatterns) {
          if (slotContent.toLowerCase().includes(pat)) {
            const regex = new RegExp(`.*${pat}.*\\n?`, "gi");
            slotContent = slotContent.replace(regex, "");
          }
        }
      }
      resolvedSlots.set(axis.slot, slotContent);
      for (const f of accumulatedFragments) {
        activeFragmentIds.push(f.id);
      }
    }
    return { resolvedSlots, activeFragmentIds, matchedRules };
  }
  static composePrompt(baseTemplate, slots) {
    let prompt = baseTemplate;
    const metaInstructionSlot = "meta_instruction";
    const hasActiveTaxonomy = [...slots.values()].some((val) => val && val.trim().length > 0);
    const metaInstructionText = hasActiveTaxonomy ? `=== TAXONOMY-DRIVEN DOMAIN AWARENESS ===
The following domain-specific guidance has been activated based on analysis of your task.
These are ADDITIONAL concerns to verify \u2014 they do NOT replace direct analysis of the
actual codebase. Always verify guidance against the code before applying.
If existing patterns in the codebase address a concern, follow the existing pattern.
If guidance conflicts with what the code actually does, the code takes precedence.
=== END TAXONOMY HEADER ===
` : "";
    slots.set(metaInstructionSlot, metaInstructionText);
    const slotRegex = /\{\{slot:([a-zA-Z0-9_]+)\}\}/g;
    prompt = prompt.replace(slotRegex, (_match, slotName) => {
      return slots.get(slotName) || "";
    });
    return prompt;
  }
  static composeToolDescriptions(baseTools, classification, taxonomyTree) {
    const activeNodes = [
      classification.domain,
      classification.paradigm,
      classification.scale,
      classification.concurrency,
      classification.lifecycle
    ];
    const overridesMap = /* @__PURE__ */ new Map();
    for (const p of activeNodes) {
      if (p) {
        if (taxonomyTree) {
          for (const nodeId of p.nodeIds) {
            const node = findNodeInTree(taxonomyTree, nodeId);
            if (node && node.toolOverrides) {
              for (const ov of node.toolOverrides) {
                overridesMap.set(ov.toolId, ov);
              }
            }
          }
        } else {
          const currentNode = p.deepestNode;
          if (currentNode && currentNode.toolOverrides) {
            for (const ov of currentNode.toolOverrides) {
              overridesMap.set(ov.toolId, ov);
            }
          }
        }
      }
    }
    return baseTools.map((tool) => {
      const override = overridesMap.get(tool.name);
      if (override) {
        return {
          ...tool,
          description: override.description
        };
      }
      return tool;
    });
  }
};

// electron/services/taxonomy/TaxonomyService.ts
var TaxonomyService = class _TaxonomyService {
  static instance = null;
  taxonomyTree = {};
  crossAxisRules = [];
  wordIndex = /* @__PURE__ */ new Map();
  // word -> set of nodeIds
  phraseIndex = [];
  isInitialized = false;
  constructor() {
  }
  static getInstance() {
    if (!this.instance) {
      this.instance = new _TaxonomyService();
    }
    return this.instance;
  }
  initialize() {
    if (this.isInitialized) return;
    try {
      const servicesDir = typeof __filename !== "undefined" ? path3.dirname(__filename) : path3.dirname(fileURLToPath(import.meta.url));
      const treePath = path3.join(servicesDir, "taxonomyTree.json");
      const rulesPath = path3.join(servicesDir, "crossAxisRules.json");
      if (!fs.existsSync(treePath)) {
        throw new Error(`Taxonomy tree JSON file not found at ${treePath}`);
      }
      if (!fs.existsSync(rulesPath)) {
        throw new Error(`Cross-axis rules JSON file not found at ${rulesPath}`);
      }
      this.taxonomyTree = JSON.parse(fs.readFileSync(treePath, "utf8"));
      const rulesJson = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
      this.crossAxisRules = rulesJson.rules || [];
      this.buildIndices();
      this.validateTreeIntegrity();
      this.isInitialized = true;
      console.log("[TaxonomyService] Successfully initialized taxonomy engine.");
    } catch (e) {
      console.error("[TaxonomyService] Initialization failed:", e);
      throw e;
    }
  }
  buildIndices() {
    this.wordIndex.clear();
    this.phraseIndex = [];
    const walk = (node) => {
      if (node.triggers) {
        if (node.triggers.words) {
          for (const w of node.triggers.words) {
            const wordLower = w.word.toLowerCase();
            if (!this.wordIndex.has(wordLower)) {
              this.wordIndex.set(wordLower, /* @__PURE__ */ new Set());
            }
            this.wordIndex.get(wordLower).add(node.id);
          }
        }
        if (node.triggers.phrases) {
          for (const p of node.triggers.phrases) {
            this.phraseIndex.push({ phrase: p.phrase.toLowerCase(), nodeId: node.id });
          }
        }
      }
      if (node.children) {
        for (const child of node.children) {
          walk(child);
        }
      }
    };
    for (const axisTree of Object.values(this.taxonomyTree)) {
      walk(axisTree);
    }
    this.phraseIndex.sort((a, b) => b.phrase.length - a.phrase.length);
  }
  validateTreeIntegrity() {
    const nodeIds = /* @__PURE__ */ new Set();
    const checkNode = (node) => {
      if (!node.id) {
        throw new Error("Taxonomy node missing unique ID");
      }
      if (nodeIds.has(node.id)) {
        throw new Error(`Duplicate taxonomy node ID found: ${node.id}`);
      }
      nodeIds.add(node.id);
      if (node.children) {
        for (const child of node.children) {
          checkNode(child);
        }
      }
    };
    for (const [axisName, axisTree] of Object.entries(this.taxonomyTree)) {
      if (axisTree.id !== axisName) {
        throw new Error(`Axis root node ID '${axisTree.id}' must match key '${axisName}'`);
      }
      checkNode(axisTree);
    }
  }
  classify(task, context, plan, investigationResults, fileContentsMap, packageJsonDeps = []) {
    this.initialize();
    if (!TaxonomyClassifier.shouldActivateTaxonomy(task, plan)) {
      return {
        classification: {
          domain: null,
          paradigm: null,
          scale: null,
          concurrency: null,
          lifecycle: null,
          activatedAxes: 0,
          overallConfidence: 0
        },
        resolvedSlots: /* @__PURE__ */ new Map(),
        toolOverrides: [],
        activeFragmentIds: [],
        classifiedBy: "heuristic",
        skippedReason: "complexity gate"
      };
    }
    const signals = TaxonomyClassifier.gatherSignals(
      task,
      plan,
      investigationResults,
      fileContentsMap,
      packageJsonDeps
    );
    const classification = {
      domain: null,
      paradigm: null,
      scale: null,
      concurrency: null,
      lifecycle: null,
      activatedAxes: 0,
      overallConfidence: 0
    };
    const axesKeys = ["domain", "paradigm", "scale", "concurrency", "lifecycle"];
    let totalConfidence = 0;
    let activeCount = 0;
    for (const key of axesKeys) {
      const rootNode = this.taxonomyTree[key];
      if (rootNode) {
        const path4 = TaxonomyClassifier.classifyAxis(key, rootNode, signals);
        if (path4) {
          classification[key] = path4;
          totalConfidence += path4.confidence;
          activeCount++;
        }
      }
    }
    classification.activatedAxes = activeCount;
    classification.overallConfidence = activeCount > 0 ? totalConfidence / activeCount : 0;
    const { resolvedSlots, activeFragmentIds } = TaxonomyPromptComposer.resolveSlots(
      classification,
      context,
      signals,
      this.crossAxisRules,
      this.taxonomyTree
    );
    const toolOverrides = [];
    const collectOverrides = (path4) => {
      for (const nodeId of path4.nodeIds) {
        const node = TaxonomyClassifier.findNodeInSubtree(rootNodeForPath(path4.axisName), nodeId);
        if (node && node.toolOverrides) {
          toolOverrides.push(...node.toolOverrides);
        }
      }
    };
    const rootNodeForPath = (axisName) => this.taxonomyTree[axisName];
    for (const key of axesKeys) {
      const path4 = classification[key];
      if (path4) {
        collectOverrides(path4);
      }
    }
    const uniqueOverridesMap = /* @__PURE__ */ new Map();
    for (const ov of toolOverrides) {
      uniqueOverridesMap.set(ov.toolId, ov);
    }
    return {
      classification,
      resolvedSlots,
      toolOverrides: [...uniqueOverridesMap.values()],
      activeFragmentIds,
      classifiedBy: "heuristic",
      skippedReason: null
    };
  }
  reclassify(_previousResult, task, context, plan, newInvestigationResults, fileContentsMap, packageJsonDeps = []) {
    return this.classify(task, context, plan, newInvestigationResults, fileContentsMap, packageJsonDeps);
  }
  trackResult(taskId, result, phase) {
    if (!result || result.skippedReason) return;
    try {
      const db = dbService.db;
      if (!db) {
        console.warn("[TaxonomyService] Database connection not available for tracking.");
        return;
      }
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
          created_at TEXT DEFAULT (datetime('now'))
        )
      `).run();
      const stmt = db.prepare(`
        INSERT INTO task_taxonomy_tracking (
          task_id, axis, resolved_path, confidence, classified_by, classification_depth, fragments_injected, phase
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const axesKeys = ["domain", "paradigm", "scale", "concurrency", "lifecycle"];
      for (const key of axesKeys) {
        const path4 = result.classification[key];
        if (path4) {
          const depth = path4.depth;
          const fragmentsCount = result.activeFragmentIds.length;
          stmt.run(
            taskId,
            key,
            path4.nodeIds.join("."),
            path4.confidence,
            result.classifiedBy,
            depth,
            fragmentsCount,
            phase
          );
        }
      }
    } catch (e) {
      console.error("[TaxonomyService] Failed to track result in database:", e);
    }
  }
};
var taxonomyService = TaxonomyService.getInstance();

// electron/services/taxonomy/__tests__/runTests.ts
function assert(condition, message) {
  if (!condition) {
    console.error(`\u274C Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`\u2705 ${message}`);
}
async function run() {
  console.log("--- STARTING TAXONOMY ENGINE TESTS ---");
  const runQueries = [];
  const dbMock = {
    prepare: (query) => {
      return {
        run: (...args) => {
          runQueries.push({ query, args });
          return { changes: 1 };
        }
      };
    }
  };
  dbService.db = dbMock;
  try {
    taxonomyService.initialize();
    console.log("\u2705 Taxonomy tree successfully loaded and validated for integrity.");
  } catch (e) {
    console.error("\u274C Failed to initialize taxonomy service:", e);
    process.exit(1);
  }
  const trivialTask = { title: "Rename user", description: "simple rename" };
  const shouldActivateTrivial = TaxonomyClassifier.shouldActivateTaxonomy(trivialTask);
  assert(!shouldActivateTrivial, "Trivial task should not activate taxonomy");
  const longTrivialTask = { title: "Format the sql query with indentation", description: "make it look nice" };
  const shouldActivateLongTrivial = TaxonomyClassifier.shouldActivateTaxonomy(longTrivialTask);
  assert(!shouldActivateLongTrivial, "Long task with trivial keywords ('format') should not activate taxonomy");
  const complexTask = {
    title: "Implement robust postgres database connection pool with automatic retry and failover management for the backend API",
    description: "Create a pool that manages postgres database operations, handles transaction isolation, and optimizes high throughput under concurrent requests in the backend server API."
  };
  const shouldActivateComplex = TaxonomyClassifier.shouldActivateTaxonomy(complexTask);
  assert(shouldActivateComplex, "Complex task should activate taxonomy");
  const mockPlan = {
    steps: ["Setup pool", "Handle concurrency", "Add metrics"],
    filesToModify: ["src/db/connection.ts", "package.json"]
  };
  const result = taxonomyService.classify(
    complexTask,
    "execution",
    mockPlan,
    "Analyzing db transaction load and pool size config.",
    { "src/db/connection.ts": 'import pg from "pg"; const client = new pg.Client();' },
    ["pg", "better-sqlite3"]
  );
  assert(!result.skippedReason, "Complex task classification should not be skipped");
  assert(result.classification.activatedAxes > 0, "At least one axis should be activated");
  const domainPath = result.classification.domain;
  assert(domainPath !== null, "Domain axis should be resolved");
  if (domainPath) {
    console.log(`Resolved Domain: ${domainPath.nodeIds.join(" -> ")} (Confidence: ${domainPath.confidence})`);
    assert(domainPath.nodeIds.includes("backend"), "Resolved domain should descend to backend");
    assert(domainPath.nodeIds.includes("backend.database.relational.postgresql"), "Resolved domain should descend to postgresql");
  }
  const domainGuidanceSlot = result.resolvedSlots.get("domain_guidance");
  assert(!!domainGuidanceSlot, "domain_guidance slot should be resolved and populated");
  assert(result.activeFragmentIds.includes("relational-transactions"), "postgresql path should inherit relational-transactions from parent");
  assert(domainGuidanceSlot.includes("Proper transactional bounds in RDBMS"), "domain_guidance slot should contain inherited parent transaction rules");
  console.log("\u2705 Hierarchical Fragment Inheritance validated successfully.");
  const parentNode = taxonomyService.taxonomyTree.domain.children[0].children[0].children[0];
  const txFragment = parentNode.fragments["execution"][0];
  txFragment.crossReferences = ["backend.database.keyvalue.redis"];
  const resultWithCrossRef = taxonomyService.classify(
    complexTask,
    "execution",
    mockPlan,
    "Analyzing db transaction load. Using Redis for caching transaction state.",
    { "src/db/connection.ts": 'import pg from "pg";' },
    ["pg"]
  );
  const primaryDomain = resultWithCrossRef.classification.domain;
  console.log("primaryDomain resolved path:", primaryDomain ? primaryDomain.nodeIds.join(" -> ") : "null");
  const rootNode = taxonomyService.taxonomyTree.domain;
  const dbNode = rootNode.children[0].children[0];
  const signals = TaxonomyClassifier.gatherSignals(
    complexTask,
    mockPlan,
    "Analyzing db transaction load. Using Redis for caching transaction state.",
    { "src/db/connection.ts": 'import pg from "pg";' },
    ["pg"]
  );
  for (const child of dbNode.children) {
    const score = TaxonomyClassifier.scoreNode(child, signals, void 0, 3);
    console.log(`Node ${child.id} Score: ${score}`);
  }
  assert(primaryDomain !== null && primaryDomain.nodeIds.includes("backend.database.relational.postgresql"), "Primary domain should remain postgresql");
  assert(resultWithCrossRef.activeFragmentIds.includes("cache-ttl-stampede"), "Redis cache fragment should be resolved as a supporting cross-reference");
  const guidanceWithCrossRef = resultWithCrossRef.resolvedSlots.get("domain_guidance");
  assert(guidanceWithCrossRef.includes("Supporting Cross-Domain Guidance"), "guidance should contain Supporting Cross-Domain Guidance section");
  assert(guidanceWithCrossRef.includes("cache-ttl-stampede") || guidanceWithCrossRef.includes("Provide cache key TTL and stampede protection"), "guidance should contain cache TTL guidelines");
  txFragment.crossReferences = null;
  console.log("\u2705 Soft-Threshold Cross-Referencing validated successfully.");
  taxonomyService.trackResult(101, result, "planning");
  assert(runQueries.length > 0, "Should run db insert query to track result");
  const trackQuery = runQueries.find((q) => q.query.includes("INSERT INTO task_taxonomy_tracking"));
  assert(!!trackQuery, "Should insert tracking data into database");
  assert(trackQuery.args[0] === 101, "First argument should be taskId 101");
  assert(trackQuery.args[1] === "domain", "Second argument should be the taxonomy axis");
  console.log("--- ALL TAXONOMY ENGINE TESTS PASSED SUCCESSFULLY! ---");
}
run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
