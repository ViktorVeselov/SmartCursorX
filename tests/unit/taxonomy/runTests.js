// tests/unit/taxonomy/runTests.ts
import { fileURLToPath } from "url";
import * as path3 from "path";
import * as fs from "fs";

// electron/db/index.ts
import path2 from "path";

// tests/unit/taxonomy/electron-mock.js
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

// tests/unit/taxonomy/electron-store-mock.js
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
  deleteGitHubToken() {
    store.delete("githubToken_encrypted");
  },
  setHuggingFaceToken(token) {
    store.set("huggingfaceToken_encrypted", encryptValue(token));
  },
  getHuggingFaceToken() {
    const encrypted = store.get("huggingfaceToken_encrypted");
    if (!encrypted) return void 0;
    try {
      return decryptValue(encrypted);
    } catch (e) {
      console2.error("[SecureStore] Failed to decrypt Hugging Face token", e);
      return void 0;
    }
  },
  deleteHuggingFaceToken() {
    store.delete("huggingfaceToken_encrypted");
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
  getHardwareSpec() {
    return store.get("hardwareSpec");
  },
  setHardwareSpec(spec) {
    console2.assert(spec && typeof spec.timestamp === "number", "Hardware spec must have timestamp");
    store.set("hardwareSpec", spec);
  },
  deleteHardwareSpec() {
    store.delete("hardwareSpec");
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
var originalSetHuggingFaceToken = secureStore.setHuggingFaceToken;
secureStore.setHuggingFaceToken = function(token) {
  checkEncryptionGuard();
  originalSetHuggingFaceToken.call(secureStore, token);
};

// electron/db/schema.ts
var require2 = createRequire(import.meta.url);
var Database = require2("better-sqlite3");
var sqliteVec = require2("sqlite-vec");
function createDatabase(dbPath) {
  const resolvedPath = dbPath || path.join(app.getPath("userData"), "smart-cursor-x.sqlite");
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
  db.prepare(`
        CREATE TABLE IF NOT EXISTS fine_tuned_models (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            base_model_id TEXT NOT NULL,
            base_model_hf_repo TEXT NOT NULL,
            adapter_path TEXT NOT NULL,
            backend TEXT NOT NULL CHECK(backend IN ('llamacpp', 'python')),
            quantization TEXT NOT NULL CHECK(quantization IN ('4bit', '8bit', '16bit')),
            tags TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();
  try {
    db.prepare("ALTER TABLE custom_models ADD COLUMN has_thinking INTEGER DEFAULT 0").run();
  } catch (e) {
    if (!e?.message?.includes("duplicate column")) throw e;
  }
  try {
    db.prepare("ALTER TABLE custom_providers ADD COLUMN is_local INTEGER DEFAULT 0").run();
  } catch (e) {
    if (!e?.message?.includes("duplicate column")) throw e;
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
    if (!e?.message?.includes("duplicate column")) throw e;
  }
  try {
    db.prepare("ALTER TABLE model_performance ADD COLUMN output_tokens INTEGER DEFAULT 0").run();
  } catch (e) {
    if (!e?.message?.includes("duplicate column")) throw e;
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
    if (!e?.message?.includes("duplicate column")) throw e;
  }
  try {
    db.prepare("ALTER TABLE conversations ADD COLUMN provider TEXT NOT NULL DEFAULT 'openai'").run();
  } catch (e) {
    if (!e?.message?.includes("duplicate column")) throw e;
  }
  try {
    db.prepare("ALTER TABLE conversations ADD COLUMN workspace_path TEXT").run();
  } catch (e) {
    if (!e?.message?.includes("duplicate column")) throw e;
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
function addFineTunedModel(db, model) {
  checkArgs(typeof model.id === "string" && model.id.length > 0, "Model ID is required");
  checkArgs(typeof model.name === "string" && model.name.length > 0, "Model Name is required");
  checkArgs(typeof model.baseModelId === "string" && model.baseModelId.length > 0, "Base Model ID is required");
  checkArgs(typeof model.baseModelHfRepo === "string" && model.baseModelHfRepo.length > 0, "Base Model HF Repo is required");
  checkArgs(typeof model.adapterPath === "string" && model.adapterPath.length > 0, "Adapter Path is required");
  checkArgs(model.backend === "llamacpp" || model.backend === "python", "Backend must be llamacpp or python");
  checkArgs(model.quantization === "4bit" || model.quantization === "8bit" || model.quantization === "16bit", "Quantization must be 4bit, 8bit, or 16bit");
  if (!db) throw new Error("DB not initialized");
  db.prepare(`
        INSERT INTO fine_tuned_models (id, name, base_model_id, base_model_hf_repo, adapter_path, backend, quantization, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            base_model_id = excluded.base_model_id,
            base_model_hf_repo = excluded.base_model_hf_repo,
            adapter_path = excluded.adapter_path,
            backend = excluded.backend,
            quantization = excluded.quantization,
            tags = excluded.tags
    `).run(model.id, model.name, model.baseModelId, model.baseModelHfRepo, model.adapterPath, model.backend, model.quantization, JSON.stringify(model.tags));
}
function getFineTunedModels(db) {
  if (!db) return [];
  const rows = db.prepare("SELECT * FROM fine_tuned_models ORDER BY created_at DESC").all();
  return rows.map((row) => ({
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : []
  }));
}
function getFineTunedModel(db, id) {
  if (!db) return null;
  const row = db.prepare("SELECT * FROM fine_tuned_models WHERE id = ?").get(id);
  if (!row) return null;
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : []
  };
}
function deleteFineTunedModel(db, id) {
  if (!db) throw new Error("DB not initialized");
  db.prepare("DELETE FROM fine_tuned_models WHERE id = ?").run(id);
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
    if (provider === "openrouter" || normModel.includes("-free") || normModel.includes(":free") || normModel.includes("free")) {
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
function getModelPerformanceStats(db, filterProvider, filterModel, filterTaskType) {
  if (!db) return [];
  let query = `
        SELECT
            model, provider, task_type,
            COUNT(*) as total_runs,
            SUM(success) as successful_runs,
            ROUND(CAST(SUM(success) AS REAL) / MAX(COUNT(*), 1), 4) as success_rate,
            AVG(latency_ms) as avg_latency_ms,
            AVG(input_tokens) as avg_input_tokens,
            AVG(output_tokens) as avg_output_tokens,
            AVG(token_count) as avg_token_count
        FROM model_performance
        WHERE 1=1
    `;
  const params = [];
  if (filterProvider) {
    query += " AND provider = ?";
    params.push(filterProvider);
  }
  if (filterModel) {
    query += " AND model = ?";
    params.push(filterModel);
  }
  if (filterTaskType) {
    query += " AND task_type = ?";
    params.push(filterTaskType);
  }
  query += ` GROUP BY model, provider, task_type ORDER BY total_runs DESC`;
  const rows = db.prepare(query).all(...params);
  return rows.map((row) => ({
    model: row.model,
    provider: row.provider,
    taskType: row.task_type,
    totalRuns: row.total_runs,
    successfulRuns: row.successful_runs,
    successRate: row.success_rate,
    avgLatencyMs: Math.round(row.avg_latency_ms || 0),
    avgInputTokens: Math.round(row.avg_input_tokens || 0),
    avgOutputTokens: Math.round(row.avg_output_tokens || 0),
    avgTokens: Math.round(row.avg_token_count || 0)
  }));
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
    this.dbPath = path2.join(app.getPath("userData"), "smart-cursor-x.sqlite");
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
  // ── Fine-Tuned Models ──
  addFineTunedModel(model) {
    return addFineTunedModel(this.db, model);
  }
  getFineTunedModels() {
    return getFineTunedModels(this.db);
  }
  getFineTunedModel(id) {
    return getFineTunedModel(this.db, id);
  }
  deleteFineTunedModel(id) {
    return deleteFineTunedModel(this.db, id);
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
  getModelPerformanceStats(filterProvider, filterModel, filterTaskType) {
    return getModelPerformanceStats(this.db, filterProvider, filterModel, filterTaskType);
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
  static detectLanguage(signals) {
    const fileNames = (signals.fileNames || []).map((f) => f.toLowerCase());
    const imports = (signals.importStatements || []).map((i) => i.toLowerCase());
    const packageDeps = (signals.packageJsonDeps || []).map((p) => p.toLowerCase());
    const codeBody = (signals.codeBody || "").toLowerCase();
    if (fileNames.some((f) => f.endsWith(".rs")) || imports.some((i) => i.includes("use std::") || i.includes("extern crate")) || codeBody.includes("fn main()") || codeBody.includes("use std::") || codeBody.includes("impl ")) {
      return "rust";
    }
    if (fileNames.some((f) => f.endsWith(".go")) || imports.some((i) => i.includes('import "') || i.includes("package main")) || codeBody.includes("package ") || codeBody.includes("func ")) {
      return "go";
    }
    if (fileNames.some((f) => f.endsWith(".cpp") || f.endsWith(".h") || f.endsWith(".hpp") || f.endsWith(".cc") || f.endsWith(".cxx")) || imports.some((i) => i.includes("#include")) || codeBody.includes("#include") || codeBody.includes("std::cout") || codeBody.includes("int main()")) {
      return "cpp";
    }
    if (fileNames.some((f) => f.endsWith(".java")) || imports.some((i) => i.includes("import java.")) || codeBody.includes("public class ") || codeBody.includes("system.out.println")) {
      return "java";
    }
    if (fileNames.some((f) => f.endsWith(".py")) || imports.some((i) => i.includes("import ") && (i.includes("from ") || i.includes("def "))) || codeBody.includes("def ") || codeBody.includes("import sys") || codeBody.includes("print(")) {
      return "python";
    }
    if (fileNames.some((f) => f.endsWith(".ts") || f.endsWith(".tsx")) || packageDeps.includes("typescript") || imports.some((i) => i.includes('from "') || i.includes("require("))) {
      return "typescript";
    }
    if (fileNames.some((f) => f.endsWith(".js") || f.endsWith(".jsx")) || packageDeps.length > 0) {
      return "javascript";
    }
    return "typescript";
  }
  static renderFragment(fragment, signals) {
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
      const activeLanguage = this.detectLanguage(signals);
      let filteredPatterns = fragment.codePatterns.filter((pattern) => {
        const patternLang = pattern.wrong.language.toLowerCase();
        if (activeLanguage === "typescript" || activeLanguage === "javascript") {
          return patternLang === "typescript" || patternLang === "javascript" || patternLang === "js" || patternLang === "ts";
        }
        if (activeLanguage === "cpp") {
          return patternLang === "cpp" || patternLang === "c++";
        }
        return patternLang === activeLanguage;
      });
      if (filteredPatterns.length === 0) {
        filteredPatterns = fragment.codePatterns;
      }
      if (filteredPatterns.length > 0) {
        lines.push("\n**Code Examples:**");
        for (const pattern of filteredPatterns) {
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
    if (signals.fileNames && signals.fileNames.length > 0) {
      const activeFiles = signals.fileNames.slice(0, 3).join(", ");
      lines.push(`> [!NOTE]`);
      lines.push(`> This task touches file(s): **${activeFiles}**.`);
      if (signals.codeSymbols && signals.codeSymbols.length > 0) {
        const activeSymbols = signals.codeSymbols.slice(0, 5).join(", ");
        lines.push(`> Active symbols detected: \`${activeSymbols}\`.`);
      }
      lines.push(`> When implementing the patterns below, ensure they align with the interfaces and styles of these files.`);
      lines.push("");
    }
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
  static META_INSTRUCTION_HEADER = `=== TAXONOMY-DRIVEN DOMAIN AWARENESS ===
The following domain-specific guidance has been activated based on analysis of your task.
These are ADDITIONAL concerns to verify \u2014 they do NOT replace direct analysis of the
actual codebase. Always verify guidance against the code before applying.
If existing patterns in the codebase address a concern, follow the existing pattern.
If guidance conflicts with what the code actually does, the code takes precedence.
=== END TAXONOMY HEADER ===
`;
  static SUPPORTING_GUIDANCE_HEADER = `

### Supporting Cross-Domain Guidance
`;
  static SUPPRESS_PATTERNS = [
    "distributed caching",
    "horizontal partition",
    "sharding",
    "replica",
    "message queue",
    "load balancer"
  ];
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
        slotContent += _TaxonomyPromptComposer.SUPPORTING_GUIDANCE_HEADER;
        slotContent += crossRefFragments.map((rf) => {
          activeFragmentIds.push(rf.id);
          return FragmentRenderer.renderFragment(rf, signals);
        }).join("\n\n");
      }
      if (classification.scale && (classification.scale.deepestNode.id === "single-user.local-desktop" || classification.scale.deepestNode.id === "single-user")) {
        for (const pat of _TaxonomyPromptComposer.SUPPRESS_PATTERNS) {
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
    const metaInstructionText = hasActiveTaxonomy ? _TaxonomyPromptComposer.META_INSTRUCTION_HEADER : "";
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

// electron/services/taxonomy/taxonomyTree.json
var taxonomyTree_default = {
  domain: {
    id: "domain",
    label: "Domain Axis Root",
    children: [
      {
        id: "backend",
        label: "Backend Development",
        children: [
          {
            id: "backend.database",
            label: "Database Persistence",
            children: [
              {
                id: "backend.database.relational",
                label: "Relational Database Engine",
                children: [
                  {
                    id: "backend.database.relational.postgresql",
                    label: "PostgreSQL",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "postgresql",
                          weight: 0.85
                        },
                        {
                          word: "postgres",
                          weight: 0.85
                        },
                        {
                          word: "pg",
                          weight: 0.85
                        },
                        {
                          word: "pgpool",
                          weight: 0.85
                        },
                        {
                          word: "pgbouncer",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "postgresql database",
                          weight: 0.95
                        },
                        {
                          phrase: "postgresql db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'pg'",
                        "require('pg')",
                        "from 'pg-pool'",
                        "require('pg-pool')",
                        "from 'postgres'",
                        "require('postgres')"
                      ],
                      filePatterns: [
                        "**/postgresql*",
                        "**/*postgresql*"
                      ],
                      symbolPatterns: [
                        "pool",
                        "client",
                        "pgclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.mysql",
                    label: "MySQL",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "mysql",
                          weight: 0.85
                        },
                        {
                          word: "mariadb",
                          weight: 0.85
                        },
                        {
                          word: "myisam",
                          weight: 0.85
                        },
                        {
                          word: "innodb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "mysql database",
                          weight: 0.95
                        },
                        {
                          phrase: "mysql db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'mysql'",
                        "require('mysql')",
                        "from 'mysql2'",
                        "require('mysql2')",
                        "from 'mysql2/promise'",
                        "require('mysql2/promise')"
                      ],
                      filePatterns: [
                        "**/mysql*",
                        "**/*mysql*"
                      ],
                      symbolPatterns: [
                        "connection",
                        "pool",
                        "mysqlclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.sqlite",
                    label: "SQLite",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "sqlite",
                          weight: 0.85
                        },
                        {
                          word: "sqlite3",
                          weight: 0.85
                        },
                        {
                          word: "better-sqlite3",
                          weight: 0.85
                        },
                        {
                          word: "libsql",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "sqlite database",
                          weight: 0.95
                        },
                        {
                          phrase: "sqlite db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'sqlite3'",
                        "require('sqlite3')",
                        "from 'better-sqlite3'",
                        "require('better-sqlite3')",
                        "from 'sqlite'",
                        "require('sqlite')",
                        "from 'libsql'",
                        "require('libsql')"
                      ],
                      filePatterns: [
                        "**/sqlite*",
                        "**/*sqlite*"
                      ],
                      symbolPatterns: [
                        "database",
                        "statement"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.oracle",
                    label: "Oracle Database",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "oracle",
                          weight: 0.85
                        },
                        {
                          word: "oracledb",
                          weight: 0.85
                        },
                        {
                          word: "plsql",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "oracle database database",
                          weight: 0.95
                        },
                        {
                          phrase: "oracle database db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'oracledb'",
                        "require('oracledb')"
                      ],
                      filePatterns: [
                        "**/oracle*",
                        "**/*oracle*"
                      ],
                      symbolPatterns: [
                        "connection",
                        "oracleclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.mssql",
                    label: "Microsoft SQL Server",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "mssql",
                          weight: 0.85
                        },
                        {
                          word: "sqlserver",
                          weight: 0.85
                        },
                        {
                          word: "tsql",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "microsoft sql server database",
                          weight: 0.95
                        },
                        {
                          phrase: "microsoft sql server db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'mssql'",
                        "require('mssql')",
                        "from 'tedious'",
                        "require('tedious')"
                      ],
                      filePatterns: [
                        "**/mssql*",
                        "**/*mssql*"
                      ],
                      symbolPatterns: [
                        "connectionpool",
                        "request"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.mariadb",
                    label: "MariaDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "mariadb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "mariadb database",
                          weight: 0.95
                        },
                        {
                          phrase: "mariadb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'mariadb'",
                        "require('mariadb')"
                      ],
                      filePatterns: [
                        "**/mariadb*",
                        "**/*mariadb*"
                      ],
                      symbolPatterns: [
                        "pool",
                        "connection"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.cockroachdb",
                    label: "CockroachDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "cockroach",
                          weight: 0.85
                        },
                        {
                          word: "cockroachdb",
                          weight: 0.85
                        },
                        {
                          word: "crdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "cockroachdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "cockroachdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'pg'",
                        "require('pg')"
                      ],
                      filePatterns: [
                        "**/cockroachdb*",
                        "**/*cockroachdb*"
                      ],
                      symbolPatterns: [
                        "pool",
                        "client"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.spanner",
                    label: "Google Cloud Spanner",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "spanner",
                          weight: 0.85
                        },
                        {
                          word: "cloudspanner",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "google cloud spanner database",
                          weight: 0.95
                        },
                        {
                          phrase: "google cloud spanner db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@google-cloud/spanner'",
                        "require('@google-cloud/spanner')"
                      ],
                      filePatterns: [
                        "**/spanner*",
                        "**/*spanner*"
                      ],
                      symbolPatterns: [
                        "spanner",
                        "database"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.yugabyte",
                    label: "YugabyteDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "yugabyte",
                          weight: 0.85
                        },
                        {
                          word: "yugabytedb",
                          weight: 0.85
                        },
                        {
                          word: "ycql",
                          weight: 0.85
                        },
                        {
                          word: "ysql",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "yugabytedb database",
                          weight: 0.95
                        },
                        {
                          phrase: "yugabytedb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'pg'",
                        "require('pg')",
                        "from 'cassandra-driver'",
                        "require('cassandra-driver')"
                      ],
                      filePatterns: [
                        "**/yugabyte*",
                        "**/*yugabyte*"
                      ],
                      symbolPatterns: [
                        "client",
                        "cluster"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.tidb",
                    label: "TiDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "tidb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "tidb database",
                          weight: 0.95
                        },
                        {
                          phrase: "tidb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'mysql2'",
                        "require('mysql2')"
                      ],
                      filePatterns: [
                        "**/tidb*",
                        "**/*tidb*"
                      ],
                      symbolPatterns: [
                        "connection",
                        "pool"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.singlestore",
                    label: "SingleStore (memsql)",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "singlestore",
                          weight: 0.85
                        },
                        {
                          word: "memsql",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "singlestore (memsql) database",
                          weight: 0.95
                        },
                        {
                          phrase: "singlestore (memsql) db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'mysql2'",
                        "require('mysql2')"
                      ],
                      filePatterns: [
                        "**/singlestore*",
                        "**/*singlestore*"
                      ],
                      symbolPatterns: [
                        "connection",
                        "pool"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.db2",
                    label: "IBM DB2",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "db2",
                          weight: 0.85
                        },
                        {
                          word: "ibmdb2",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "ibm db2 database",
                          weight: 0.95
                        },
                        {
                          phrase: "ibm db2 db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'ibm_db'",
                        "require('ibm_db')"
                      ],
                      filePatterns: [
                        "**/db2*",
                        "**/*db2*"
                      ],
                      symbolPatterns: [
                        "database",
                        "connection"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.firebird",
                    label: "Firebird",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "firebird",
                          weight: 0.85
                        },
                        {
                          word: "firebirdsql",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "firebird database",
                          weight: 0.95
                        },
                        {
                          phrase: "firebird db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'node-firebird'",
                        "require('node-firebird')"
                      ],
                      filePatterns: [
                        "**/firebird*",
                        "**/*firebird*"
                      ],
                      symbolPatterns: [
                        "connection",
                        "database"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.h2",
                    label: "H2 Database",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "h2",
                          weight: 0.85
                        },
                        {
                          word: "h2database",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "h2 database database",
                          weight: 0.95
                        },
                        {
                          phrase: "h2 database db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/h2*",
                        "**/*h2*"
                      ],
                      symbolPatterns: [
                        "connection",
                        "jdbc"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.derby",
                    label: "Apache Derby",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "derby",
                          weight: 0.85
                        },
                        {
                          word: "apachederby",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "apache derby database",
                          weight: 0.95
                        },
                        {
                          phrase: "apache derby db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/derby*",
                        "**/*derby*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.informix",
                    label: "Informix",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "informix",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "informix database",
                          weight: 0.95
                        },
                        {
                          phrase: "informix db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/informix*",
                        "**/*informix*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.ingres",
                    label: "Ingres",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "ingres",
                          weight: 0.85
                        },
                        {
                          word: "actian",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "ingres database",
                          weight: 0.95
                        },
                        {
                          phrase: "ingres db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/ingres*",
                        "**/*ingres*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.saphana",
                    label: "SAP HANA",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "saphana",
                          weight: 0.85
                        },
                        {
                          word: "hana",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "sap hana database",
                          weight: 0.95
                        },
                        {
                          phrase: "sap hana db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@sap/hana-client'",
                        "require('@sap/hana-client')"
                      ],
                      filePatterns: [
                        "**/saphana*",
                        "**/*saphana*"
                      ],
                      symbolPatterns: [
                        "connection"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.aurora-pg",
                    label: "AWS Aurora PostgreSQL",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "aurora",
                          weight: 0.85
                        },
                        {
                          word: "rds",
                          weight: 0.85
                        },
                        {
                          word: "aws-sdk",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "aws aurora postgresql database",
                          weight: 0.95
                        },
                        {
                          phrase: "aws aurora postgresql db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@aws-sdk/client-rds-data'",
                        "require('@aws-sdk/client-rds-data')"
                      ],
                      filePatterns: [
                        "**/aurora-pg*",
                        "**/*aurora-pg*"
                      ],
                      symbolPatterns: [
                        "rdsdataservice"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.aurora-mysql",
                    label: "AWS Aurora MySQL",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "aurora",
                          weight: 0.85
                        },
                        {
                          word: "rds",
                          weight: 0.85
                        },
                        {
                          word: "aws-sdk",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "aws aurora mysql database",
                          weight: 0.95
                        },
                        {
                          phrase: "aws aurora mysql db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@aws-sdk/client-rds-data'",
                        "require('@aws-sdk/client-rds-data')"
                      ],
                      filePatterns: [
                        "**/aurora-mysql*",
                        "**/*aurora-mysql*"
                      ],
                      symbolPatterns: [
                        "rdsdataservice"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.cloudsql-pg",
                    label: "Google Cloud SQL PostgreSQL",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "cloudsql",
                          weight: 0.85
                        },
                        {
                          word: "gcp",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "google cloud sql postgresql database",
                          weight: 0.95
                        },
                        {
                          phrase: "google cloud sql postgresql db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/cloudsql-pg*",
                        "**/*cloudsql-pg*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.cloudsql-mysql",
                    label: "Google Cloud SQL MySQL",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "cloudsql",
                          weight: 0.85
                        },
                        {
                          word: "gcp",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "google cloud sql mysql database",
                          weight: 0.95
                        },
                        {
                          phrase: "google cloud sql mysql db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/cloudsql-mysql*",
                        "**/*cloudsql-mysql*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.cloudsql-mssql",
                    label: "Google Cloud SQL SQL Server",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "cloudsql",
                          weight: 0.85
                        },
                        {
                          word: "gcp",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "google cloud sql sql server database",
                          weight: 0.95
                        },
                        {
                          phrase: "google cloud sql sql server db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/cloudsql-mssql*",
                        "**/*cloudsql-mssql*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.azuresql",
                    label: "Azure SQL Database",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "azuresql",
                          weight: 0.85
                        },
                        {
                          word: "azure",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "azure sql database database",
                          weight: 0.95
                        },
                        {
                          phrase: "azure sql database db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/azuresql*",
                        "**/*azuresql*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.azure-pg",
                    label: "Azure Database for PostgreSQL",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "azure",
                          weight: 0.85
                        },
                        {
                          word: "postgres",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "azure database for postgresql database",
                          weight: 0.95
                        },
                        {
                          phrase: "azure database for postgresql db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/azure-pg*",
                        "**/*azure-pg*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.azure-mysql",
                    label: "Azure Database for MySQL",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "azure",
                          weight: 0.85
                        },
                        {
                          word: "mysql",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "azure database for mysql database",
                          weight: 0.95
                        },
                        {
                          phrase: "azure database for mysql db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/azure-mysql*",
                        "**/*azure-mysql*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.percona-mysql",
                    label: "Percona Server for MySQL",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "percona",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "percona server for mysql database",
                          weight: 0.95
                        },
                        {
                          phrase: "percona server for mysql db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/percona-mysql*",
                        "**/*percona-mysql*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.percona-mongo",
                    label: "Percona Server for MongoDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "percona",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "percona server for mongodb database",
                          weight: 0.95
                        },
                        {
                          phrase: "percona server for mongodb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/percona-mongo*",
                        "**/*percona-mongo*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.teradata",
                    label: "Teradata",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "teradata",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "teradata database",
                          weight: 0.95
                        },
                        {
                          phrase: "teradata db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/teradata*",
                        "**/*teradata*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.sybase",
                    label: "Sybase ASE",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "sybase",
                          weight: 0.85
                        },
                        {
                          word: "ase",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "sybase ase database",
                          weight: 0.95
                        },
                        {
                          phrase: "sybase ase db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/sybase*",
                        "**/*sybase*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.virtuoso",
                    label: "Virtuoso",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "virtuoso",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "virtuoso database",
                          weight: 0.95
                        },
                        {
                          phrase: "virtuoso db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/virtuoso*",
                        "**/*virtuoso*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.nuodb",
                    label: "NuoDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "nuodb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "nuodb database",
                          weight: 0.95
                        },
                        {
                          phrase: "nuodb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/nuodb*",
                        "**/*nuodb*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.hive",
                    label: "Apache Hive",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "hive",
                          weight: 0.85
                        },
                        {
                          word: "hive2",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "apache hive database",
                          weight: 0.95
                        },
                        {
                          phrase: "apache hive db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'thrift-hive'",
                        "require('thrift-hive')"
                      ],
                      filePatterns: [
                        "**/hive*",
                        "**/*hive*"
                      ],
                      symbolPatterns: [
                        "hiveclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.impala",
                    label: "Cloudera Impala",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "impala",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "cloudera impala database",
                          weight: 0.95
                        },
                        {
                          phrase: "cloudera impala db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/impala*",
                        "**/*impala*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.greenplum",
                    label: "Greenplum",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "greenplum",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "greenplum database",
                          weight: 0.95
                        },
                        {
                          phrase: "greenplum db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/greenplum*",
                        "**/*greenplum*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.hsqldb",
                    label: "HSQLDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "hsqldb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "hsqldb database",
                          weight: 0.95
                        },
                        {
                          phrase: "hsqldb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/hsqldb*",
                        "**/*hsqldb*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.presto",
                    label: "Presto",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "presto",
                          weight: 0.85
                        },
                        {
                          word: "prestodb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "presto database",
                          weight: 0.95
                        },
                        {
                          phrase: "presto db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'presto-client'",
                        "require('presto-client')"
                      ],
                      filePatterns: [
                        "**/presto*",
                        "**/*presto*"
                      ],
                      symbolPatterns: [
                        "prestoclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.trino",
                    label: "Trino",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "trino",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "trino database",
                          weight: 0.95
                        },
                        {
                          phrase: "trino db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'trino-client-node'",
                        "require('trino-client-node')"
                      ],
                      filePatterns: [
                        "**/trino*",
                        "**/*trino*"
                      ],
                      symbolPatterns: [
                        "trinoclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.vertica",
                    label: "Vertica",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "vertica",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "vertica database",
                          weight: 0.95
                        },
                        {
                          phrase: "vertica db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'vertica'",
                        "require('vertica')"
                      ],
                      filePatterns: [
                        "**/vertica*",
                        "**/*vertica*"
                      ],
                      symbolPatterns: [
                        "verticaclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.sqlite-cloud",
                    label: "SQLite Cloud",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "sqlitecloud",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "sqlite cloud database",
                          weight: 0.95
                        },
                        {
                          phrase: "sqlite cloud db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@sqlitecloud/sdk'",
                        "require('@sqlitecloud/sdk')"
                      ],
                      filePatterns: [
                        "**/sqlite-cloud*",
                        "**/*sqlite-cloud*"
                      ],
                      symbolPatterns: [
                        "sqlitecloud"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.libsql",
                    label: "Libsql (Turso)",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "libsql",
                          weight: 0.85
                        },
                        {
                          word: "turso",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "libsql (turso) database",
                          weight: 0.95
                        },
                        {
                          phrase: "libsql (turso) db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@libsql/client'",
                        "require('@libsql/client')"
                      ],
                      filePatterns: [
                        "**/libsql*",
                        "**/*libsql*"
                      ],
                      symbolPatterns: [
                        "libsqlclient",
                        "createclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.duckdb",
                    label: "DuckDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "duckdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "duckdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "duckdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'duckdb'",
                        "require('duckdb')"
                      ],
                      filePatterns: [
                        "**/duckdb*",
                        "**/*duckdb*"
                      ],
                      symbolPatterns: [
                        "database",
                        "connection"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.oceanbase",
                    label: "OceanBase",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "oceanbase",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "oceanbase database",
                          weight: 0.95
                        },
                        {
                          phrase: "oceanbase db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/oceanbase*",
                        "**/*oceanbase*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.relational.voltdb",
                    label: "VoltDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "voltdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "voltdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "voltdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/voltdb*",
                        "**/*voltdb*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  }
                ],
                triggers: {
                  words: [
                    {
                      word: "relational",
                      weight: 0.6
                    },
                    {
                      word: "sql",
                      weight: 0.4
                    },
                    {
                      word: "rdbms",
                      weight: 0.8
                    },
                    {
                      word: "postgresql",
                      weight: 0.3
                    },
                    {
                      word: "postgres",
                      weight: 0.3
                    },
                    {
                      word: "pg",
                      weight: 0.3
                    },
                    {
                      word: "pgpool",
                      weight: 0.3
                    },
                    {
                      word: "pgbouncer",
                      weight: 0.3
                    },
                    {
                      word: "mysql",
                      weight: 0.3
                    },
                    {
                      word: "mariadb",
                      weight: 0.3
                    },
                    {
                      word: "myisam",
                      weight: 0.3
                    },
                    {
                      word: "innodb",
                      weight: 0.3
                    },
                    {
                      word: "sqlite",
                      weight: 0.3
                    },
                    {
                      word: "sqlite3",
                      weight: 0.3
                    },
                    {
                      word: "better-sqlite3",
                      weight: 0.3
                    },
                    {
                      word: "libsql",
                      weight: 0.3
                    },
                    {
                      word: "oracle",
                      weight: 0.3
                    },
                    {
                      word: "oracledb",
                      weight: 0.3
                    },
                    {
                      word: "plsql",
                      weight: 0.3
                    },
                    {
                      word: "mssql",
                      weight: 0.3
                    },
                    {
                      word: "sqlserver",
                      weight: 0.3
                    },
                    {
                      word: "tsql",
                      weight: 0.3
                    },
                    {
                      word: "cockroach",
                      weight: 0.3
                    },
                    {
                      word: "cockroachdb",
                      weight: 0.3
                    },
                    {
                      word: "crdb",
                      weight: 0.3
                    },
                    {
                      word: "spanner",
                      weight: 0.3
                    },
                    {
                      word: "cloudspanner",
                      weight: 0.3
                    },
                    {
                      word: "yugabyte",
                      weight: 0.3
                    },
                    {
                      word: "yugabytedb",
                      weight: 0.3
                    },
                    {
                      word: "ycql",
                      weight: 0.3
                    },
                    {
                      word: "ysql",
                      weight: 0.3
                    },
                    {
                      word: "tidb",
                      weight: 0.3
                    },
                    {
                      word: "singlestore",
                      weight: 0.3
                    },
                    {
                      word: "memsql",
                      weight: 0.3
                    },
                    {
                      word: "db2",
                      weight: 0.3
                    },
                    {
                      word: "ibmdb2",
                      weight: 0.3
                    },
                    {
                      word: "firebird",
                      weight: 0.3
                    },
                    {
                      word: "firebirdsql",
                      weight: 0.3
                    },
                    {
                      word: "h2",
                      weight: 0.3
                    },
                    {
                      word: "h2database",
                      weight: 0.3
                    },
                    {
                      word: "derby",
                      weight: 0.3
                    },
                    {
                      word: "apachederby",
                      weight: 0.3
                    },
                    {
                      word: "informix",
                      weight: 0.3
                    },
                    {
                      word: "ingres",
                      weight: 0.3
                    },
                    {
                      word: "actian",
                      weight: 0.3
                    },
                    {
                      word: "saphana",
                      weight: 0.3
                    },
                    {
                      word: "hana",
                      weight: 0.3
                    },
                    {
                      word: "aurora",
                      weight: 0.3
                    },
                    {
                      word: "rds",
                      weight: 0.3
                    },
                    {
                      word: "aws-sdk",
                      weight: 0.3
                    },
                    {
                      word: "cloudsql",
                      weight: 0.3
                    },
                    {
                      word: "gcp",
                      weight: 0.3
                    },
                    {
                      word: "azuresql",
                      weight: 0.3
                    },
                    {
                      word: "azure",
                      weight: 0.3
                    },
                    {
                      word: "percona",
                      weight: 0.3
                    },
                    {
                      word: "teradata",
                      weight: 0.3
                    },
                    {
                      word: "sybase",
                      weight: 0.3
                    },
                    {
                      word: "ase",
                      weight: 0.3
                    },
                    {
                      word: "virtuoso",
                      weight: 0.3
                    },
                    {
                      word: "nuodb",
                      weight: 0.3
                    },
                    {
                      word: "hive",
                      weight: 0.3
                    },
                    {
                      word: "hive2",
                      weight: 0.3
                    },
                    {
                      word: "impala",
                      weight: 0.3
                    },
                    {
                      word: "greenplum",
                      weight: 0.3
                    },
                    {
                      word: "hsqldb",
                      weight: 0.3
                    },
                    {
                      word: "presto",
                      weight: 0.3
                    },
                    {
                      word: "prestodb",
                      weight: 0.3
                    },
                    {
                      word: "trino",
                      weight: 0.3
                    },
                    {
                      word: "vertica",
                      weight: 0.3
                    },
                    {
                      word: "sqlitecloud",
                      weight: 0.3
                    },
                    {
                      word: "turso",
                      weight: 0.3
                    },
                    {
                      word: "duckdb",
                      weight: 0.3
                    },
                    {
                      word: "oceanbase",
                      weight: 0.3
                    },
                    {
                      word: "voltdb",
                      weight: 0.3
                    }
                  ],
                  phrases: [],
                  antiWords: [],
                  importPatterns: [
                    "from 'pg'",
                    "require('pg')",
                    "from 'pg-pool'",
                    "require('pg-pool')",
                    "from 'postgres'",
                    "require('postgres')",
                    "from 'mysql'",
                    "require('mysql')",
                    "from 'mysql2'",
                    "require('mysql2')",
                    "from 'mysql2/promise'",
                    "require('mysql2/promise')",
                    "from 'sqlite3'",
                    "require('sqlite3')",
                    "from 'better-sqlite3'",
                    "require('better-sqlite3')",
                    "from 'sqlite'",
                    "require('sqlite')",
                    "from 'libsql'",
                    "require('libsql')",
                    "from 'oracledb'",
                    "require('oracledb')",
                    "from 'mssql'",
                    "require('mssql')",
                    "from 'tedious'",
                    "require('tedious')",
                    "from 'mariadb'",
                    "require('mariadb')",
                    "from '@google-cloud/spanner'",
                    "require('@google-cloud/spanner')",
                    "from 'cassandra-driver'",
                    "require('cassandra-driver')",
                    "from 'ibm_db'",
                    "require('ibm_db')",
                    "from 'node-firebird'",
                    "require('node-firebird')",
                    "from '@sap/hana-client'",
                    "require('@sap/hana-client')",
                    "from '@aws-sdk/client-rds-data'",
                    "require('@aws-sdk/client-rds-data')",
                    "from 'thrift-hive'",
                    "require('thrift-hive')",
                    "from 'presto-client'",
                    "require('presto-client')",
                    "from 'trino-client-node'",
                    "require('trino-client-node')",
                    "from 'vertica'",
                    "require('vertica')",
                    "from '@sqlitecloud/sdk'",
                    "require('@sqlitecloud/sdk')",
                    "from '@libsql/client'",
                    "require('@libsql/client')",
                    "from 'duckdb'",
                    "require('duckdb')"
                  ],
                  filePatterns: [
                    "**/postgresql*",
                    "**/*postgresql*",
                    "**/mysql*",
                    "**/*mysql*",
                    "**/sqlite*",
                    "**/*sqlite*",
                    "**/oracle*",
                    "**/*oracle*",
                    "**/mssql*",
                    "**/*mssql*",
                    "**/mariadb*",
                    "**/*mariadb*",
                    "**/cockroachdb*",
                    "**/*cockroachdb*",
                    "**/spanner*",
                    "**/*spanner*",
                    "**/yugabyte*",
                    "**/*yugabyte*",
                    "**/tidb*",
                    "**/*tidb*",
                    "**/singlestore*",
                    "**/*singlestore*",
                    "**/db2*",
                    "**/*db2*",
                    "**/firebird*",
                    "**/*firebird*",
                    "**/h2*",
                    "**/*h2*",
                    "**/derby*",
                    "**/*derby*",
                    "**/informix*",
                    "**/*informix*",
                    "**/ingres*",
                    "**/*ingres*",
                    "**/saphana*",
                    "**/*saphana*",
                    "**/aurora-pg*",
                    "**/*aurora-pg*",
                    "**/aurora-mysql*",
                    "**/*aurora-mysql*",
                    "**/cloudsql-pg*",
                    "**/*cloudsql-pg*",
                    "**/cloudsql-mysql*",
                    "**/*cloudsql-mysql*",
                    "**/cloudsql-mssql*",
                    "**/*cloudsql-mssql*",
                    "**/azuresql*",
                    "**/*azuresql*",
                    "**/azure-pg*",
                    "**/*azure-pg*",
                    "**/azure-mysql*",
                    "**/*azure-mysql*",
                    "**/percona-mysql*",
                    "**/*percona-mysql*",
                    "**/percona-mongo*",
                    "**/*percona-mongo*",
                    "**/teradata*",
                    "**/*teradata*",
                    "**/sybase*",
                    "**/*sybase*",
                    "**/virtuoso*",
                    "**/*virtuoso*",
                    "**/nuodb*",
                    "**/*nuodb*",
                    "**/hive*",
                    "**/*hive*",
                    "**/impala*",
                    "**/*impala*",
                    "**/greenplum*",
                    "**/*greenplum*",
                    "**/hsqldb*",
                    "**/*hsqldb*",
                    "**/presto*",
                    "**/*presto*",
                    "**/trino*",
                    "**/*trino*",
                    "**/vertica*",
                    "**/*vertica*",
                    "**/sqlite-cloud*",
                    "**/*sqlite-cloud*",
                    "**/libsql*",
                    "**/*libsql*",
                    "**/duckdb*",
                    "**/*duckdb*",
                    "**/oceanbase*",
                    "**/*oceanbase*",
                    "**/voltdb*",
                    "**/*voltdb*"
                  ],
                  symbolPatterns: [
                    "pool",
                    "client",
                    "pgclient",
                    "connection",
                    "mysqlclient",
                    "database",
                    "statement",
                    "oracleclient",
                    "connectionpool",
                    "request",
                    "spanner",
                    "cluster",
                    "jdbc",
                    "rdsdataservice",
                    "hiveclient",
                    "prestoclient",
                    "trinoclient",
                    "verticaclient",
                    "sqlitecloud",
                    "libsqlclient",
                    "createclient"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  execution: [
                    {
                      id: "relational-transactions",
                      summary: "Proper transactional bounds in RDBMS",
                      weight: "critical",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "When executing multiple writes in a relational database, wrap them in a TRANSACTION (BEGIN/COMMIT) to preserve atomicity.",
                      decisionTree: null,
                      codePatterns: [
                        {
                          concern: "Atomic database updates",
                          wrong: {
                            code: 'await db.query("INSERT INTO users ...");\nawait db.query("INSERT INTO profiles ...");',
                            language: "javascript",
                            explanation: "If the second query fails, the user is left in an inconsistent state."
                          },
                          correct: {
                            code: 'await db.query("BEGIN");\ntry {\n  await db.query("INSERT INTO users ...");\n  await db.query("INSERT INTO profiles ...");\n  await db.query("COMMIT");\n} catch (e) {\n  await db.query("ROLLBACK");\n  throw e;\n}',
                            language: "javascript",
                            explanation: "Ensures that either both writes succeed or neither does."
                          },
                          detectionHint: "Multiple sequential write queries without BEGIN/COMMIT"
                        }
                      ],
                      commonMistakes: [
                        {
                          mistake: "Leaving database transactions uncommitted or un-rolled back in catch branches",
                          whyItHappens: "Forgetting rollback statement inside the catch block.",
                          correction: "Always include ROLLBACK in the catch block and ensure connection is released.",
                          severity: "data-loss"
                        }
                      ],
                      selfVerification: [
                        {
                          check: "Every BEGIN block has a corresponding COMMIT and ROLLBACK path",
                          howToVerify: "Verify query lines and make sure error handler calls ROLLBACK.",
                          failureIndicator: "BEGIN query found without ROLLBACK inside catch block",
                          remediation: "Add a ROLLBACK statement to the database catch wrapper."
                        }
                      ],
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ],
                  verification: null
                },
                toolOverrides: []
              },
              {
                id: "backend.database.document",
                label: "Document Datastore",
                children: [
                  {
                    id: "backend.database.document.mongodb",
                    label: "MongoDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "mongodb",
                          weight: 0.85
                        },
                        {
                          word: "mongo",
                          weight: 0.85
                        },
                        {
                          word: "mongoose",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "mongodb database",
                          weight: 0.95
                        },
                        {
                          phrase: "mongodb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'mongodb'",
                        "require('mongodb')",
                        "from 'mongoose'",
                        "require('mongoose')"
                      ],
                      filePatterns: [
                        "**/mongodb*",
                        "**/*mongodb*"
                      ],
                      symbolPatterns: [
                        "mongoclient",
                        "schema",
                        "model"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.couchdb",
                    label: "Apache CouchDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "couchdb",
                          weight: 0.85
                        },
                        {
                          word: "nano",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "apache couchdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "apache couchdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'nano'",
                        "require('nano')"
                      ],
                      filePatterns: [
                        "**/couchdb*",
                        "**/*couchdb*"
                      ],
                      symbolPatterns: [
                        "nano"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.documentdb",
                    label: "AWS DocumentDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "documentdb",
                          weight: 0.85
                        },
                        {
                          word: "mongodb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "aws documentdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "aws documentdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'mongodb'",
                        "require('mongodb')"
                      ],
                      filePatterns: [
                        "**/documentdb*",
                        "**/*documentdb*"
                      ],
                      symbolPatterns: [
                        "mongoclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.cosmosdb",
                    label: "Azure Cosmos DB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "cosmosdb",
                          weight: 0.85
                        },
                        {
                          word: "cosmos",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "azure cosmos db database",
                          weight: 0.95
                        },
                        {
                          phrase: "azure cosmos db db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@azure/cosmos'",
                        "require('@azure/cosmos')"
                      ],
                      filePatterns: [
                        "**/cosmosdb*",
                        "**/*cosmosdb*"
                      ],
                      symbolPatterns: [
                        "cosmosclient",
                        "container"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.faunadb",
                    label: "FaunaDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "fauna",
                          weight: 0.85
                        },
                        {
                          word: "faunadb",
                          weight: 0.85
                        },
                        {
                          word: "fql",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "faunadb database",
                          weight: 0.95
                        },
                        {
                          phrase: "faunadb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'faunadb'",
                        "require('faunadb')"
                      ],
                      filePatterns: [
                        "**/faunadb*",
                        "**/*faunadb*"
                      ],
                      symbolPatterns: [
                        "faunaclient",
                        "client"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.firestore",
                    label: "Firebase Firestore",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "firestore",
                          weight: 0.85
                        },
                        {
                          word: "firebase",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "firebase firestore database",
                          weight: 0.95
                        },
                        {
                          phrase: "firebase firestore db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'firebase/firestore'",
                        "require('firebase/firestore')",
                        "from '@google-cloud/firestore'",
                        "require('@google-cloud/firestore')"
                      ],
                      filePatterns: [
                        "**/firestore*",
                        "**/*firestore*"
                      ],
                      symbolPatterns: [
                        "firestore",
                        "collectionreference"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.rethinkdb",
                    label: "RethinkDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "rethinkdb",
                          weight: 0.85
                        },
                        {
                          word: "rethink",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "rethinkdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "rethinkdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'rethinkdb'",
                        "require('rethinkdb')",
                        "from 'rethinkdbdash'",
                        "require('rethinkdbdash')"
                      ],
                      filePatterns: [
                        "**/rethinkdb*",
                        "**/*rethinkdb*"
                      ],
                      symbolPatterns: [
                        "rethinkconnection"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.arangodb",
                    label: "ArangoDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "arangodb",
                          weight: 0.85
                        },
                        {
                          word: "arangojs",
                          weight: 0.85
                        },
                        {
                          word: "aql",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "arangodb database",
                          weight: 0.95
                        },
                        {
                          phrase: "arangodb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'arangojs'",
                        "require('arangojs')"
                      ],
                      filePatterns: [
                        "**/arangodb*",
                        "**/*arangodb*"
                      ],
                      symbolPatterns: [
                        "database",
                        "arangojs"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.orientdb",
                    label: "OrientDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "orientdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "orientdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "orientdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'orientjs'",
                        "require('orientjs')"
                      ],
                      filePatterns: [
                        "**/orientdb*",
                        "**/*orientdb*"
                      ],
                      symbolPatterns: [
                        "orientdb"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.ravendb",
                    label: "RavenDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "ravendb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "ravendb database",
                          weight: 0.95
                        },
                        {
                          phrase: "ravendb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'ravendb'",
                        "require('ravendb')"
                      ],
                      filePatterns: [
                        "**/ravendb*",
                        "**/*ravendb*"
                      ],
                      symbolPatterns: [
                        "documentstore"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.couchbase",
                    label: "Couchbase",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "couchbase",
                          weight: 0.85
                        },
                        {
                          word: "n1ql",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "couchbase database",
                          weight: 0.95
                        },
                        {
                          phrase: "couchbase db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'couchbase'",
                        "require('couchbase')"
                      ],
                      filePatterns: [
                        "**/couchbase*",
                        "**/*couchbase*"
                      ],
                      symbolPatterns: [
                        "cluster",
                        "bucket"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.pouchdb",
                    label: "PouchDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "pouchdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "pouchdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "pouchdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'pouchdb'",
                        "require('pouchdb')",
                        "from 'pouchdb-node'",
                        "require('pouchdb-node')"
                      ],
                      filePatterns: [
                        "**/pouchdb*",
                        "**/*pouchdb*"
                      ],
                      symbolPatterns: [
                        "pouchdb"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.marklogic",
                    label: "MarkLogic",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "marklogic",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "marklogic database",
                          weight: 0.95
                        },
                        {
                          phrase: "marklogic db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'marklogic'",
                        "require('marklogic')"
                      ],
                      filePatterns: [
                        "**/marklogic*",
                        "**/*marklogic*"
                      ],
                      symbolPatterns: [
                        "databaseclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.basex",
                    label: "BaseX",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "basex",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "basex database",
                          weight: 0.95
                        },
                        {
                          phrase: "basex db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/basex*",
                        "**/*basex*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.existdb",
                    label: "eXist-db",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "existdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "exist-db database",
                          weight: 0.95
                        },
                        {
                          phrase: "exist-db db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/existdb*",
                        "**/*existdb*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.jackrabbit",
                    label: "Apache Jackrabbit",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "jackrabbit",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "apache jackrabbit database",
                          weight: 0.95
                        },
                        {
                          phrase: "apache jackrabbit db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/jackrabbit*",
                        "**/*jackrabbit*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.cloudant",
                    label: "IBM Cloudant",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "cloudant",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "ibm cloudant database",
                          weight: 0.95
                        },
                        {
                          phrase: "ibm cloudant db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@ibm-cloud/cloudant'",
                        "require('@ibm-cloud/cloudant')"
                      ],
                      filePatterns: [
                        "**/cloudant*",
                        "**/*cloudant*"
                      ],
                      symbolPatterns: [
                        "cloudant"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.supabase-jsonb",
                    label: "Supabase JSONB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "supabase",
                          weight: 0.85
                        },
                        {
                          word: "postgrest",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "supabase jsonb database",
                          weight: 0.95
                        },
                        {
                          phrase: "supabase jsonb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/supabase-jsonb*",
                        "**/*supabase-jsonb*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.nedb",
                    label: "NeDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "nedb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "nedb database",
                          weight: 0.95
                        },
                        {
                          phrase: "nedb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'nedb'",
                        "require('nedb')"
                      ],
                      filePatterns: [
                        "**/nedb*",
                        "**/*nedb*"
                      ],
                      symbolPatterns: [
                        "datastore"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.gundb",
                    label: "GunDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "gundb",
                          weight: 0.85
                        },
                        {
                          word: "gun",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "gundb database",
                          weight: 0.95
                        },
                        {
                          phrase: "gundb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'gun'",
                        "require('gun')"
                      ],
                      filePatterns: [
                        "**/gundb*",
                        "**/*gundb*"
                      ],
                      symbolPatterns: [
                        "gun"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.rxdb",
                    label: "RxDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "rxdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "rxdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "rxdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'rxdb'",
                        "require('rxdb')"
                      ],
                      filePatterns: [
                        "**/rxdb*",
                        "**/*rxdb*"
                      ],
                      symbolPatterns: [
                        "rxdatabase"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.lovefield",
                    label: "Lovefield",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "lovefield",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "lovefield database",
                          weight: 0.95
                        },
                        {
                          phrase: "lovefield db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/lovefield*",
                        "**/*lovefield*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.ejdb",
                    label: "EJDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "ejdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "ejdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "ejdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/ejdb*",
                        "**/*ejdb*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.lowdb",
                    label: "Lowdb",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "lowdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "lowdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "lowdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'lowdb'",
                        "require('lowdb')"
                      ],
                      filePatterns: [
                        "**/lowdb*",
                        "**/*lowdb*"
                      ],
                      symbolPatterns: [
                        "low"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.document.minimongo",
                    label: "Minimongo",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "minimongo",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "minimongo database",
                          weight: 0.95
                        },
                        {
                          phrase: "minimongo db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/minimongo*",
                        "**/*minimongo*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  }
                ],
                triggers: {
                  words: [
                    {
                      word: "document",
                      weight: 0.5
                    },
                    {
                      word: "nosql",
                      weight: 0.6
                    },
                    {
                      word: "json",
                      weight: 0.3
                    },
                    {
                      word: "mongodb",
                      weight: 0.3
                    },
                    {
                      word: "mongo",
                      weight: 0.3
                    },
                    {
                      word: "mongoose",
                      weight: 0.3
                    },
                    {
                      word: "couchdb",
                      weight: 0.3
                    },
                    {
                      word: "nano",
                      weight: 0.3
                    },
                    {
                      word: "documentdb",
                      weight: 0.3
                    },
                    {
                      word: "cosmosdb",
                      weight: 0.3
                    },
                    {
                      word: "cosmos",
                      weight: 0.3
                    },
                    {
                      word: "fauna",
                      weight: 0.3
                    },
                    {
                      word: "faunadb",
                      weight: 0.3
                    },
                    {
                      word: "fql",
                      weight: 0.3
                    },
                    {
                      word: "firestore",
                      weight: 0.3
                    },
                    {
                      word: "firebase",
                      weight: 0.3
                    },
                    {
                      word: "rethinkdb",
                      weight: 0.3
                    },
                    {
                      word: "rethink",
                      weight: 0.3
                    },
                    {
                      word: "arangodb",
                      weight: 0.3
                    },
                    {
                      word: "arangojs",
                      weight: 0.3
                    },
                    {
                      word: "aql",
                      weight: 0.3
                    },
                    {
                      word: "orientdb",
                      weight: 0.3
                    },
                    {
                      word: "ravendb",
                      weight: 0.3
                    },
                    {
                      word: "couchbase",
                      weight: 0.3
                    },
                    {
                      word: "n1ql",
                      weight: 0.3
                    },
                    {
                      word: "pouchdb",
                      weight: 0.3
                    },
                    {
                      word: "marklogic",
                      weight: 0.3
                    },
                    {
                      word: "basex",
                      weight: 0.3
                    },
                    {
                      word: "existdb",
                      weight: 0.3
                    },
                    {
                      word: "jackrabbit",
                      weight: 0.3
                    },
                    {
                      word: "cloudant",
                      weight: 0.3
                    },
                    {
                      word: "supabase",
                      weight: 0.3
                    },
                    {
                      word: "postgrest",
                      weight: 0.3
                    },
                    {
                      word: "nedb",
                      weight: 0.3
                    },
                    {
                      word: "gundb",
                      weight: 0.3
                    },
                    {
                      word: "gun",
                      weight: 0.3
                    },
                    {
                      word: "rxdb",
                      weight: 0.3
                    },
                    {
                      word: "lovefield",
                      weight: 0.3
                    },
                    {
                      word: "ejdb",
                      weight: 0.3
                    },
                    {
                      word: "lowdb",
                      weight: 0.3
                    },
                    {
                      word: "minimongo",
                      weight: 0.3
                    }
                  ],
                  phrases: [],
                  antiWords: [],
                  importPatterns: [
                    "from 'mongodb'",
                    "require('mongodb')",
                    "from 'mongoose'",
                    "require('mongoose')",
                    "from 'nano'",
                    "require('nano')",
                    "from '@azure/cosmos'",
                    "require('@azure/cosmos')",
                    "from 'faunadb'",
                    "require('faunadb')",
                    "from 'firebase/firestore'",
                    "require('firebase/firestore')",
                    "from '@google-cloud/firestore'",
                    "require('@google-cloud/firestore')",
                    "from 'rethinkdb'",
                    "require('rethinkdb')",
                    "from 'rethinkdbdash'",
                    "require('rethinkdbdash')",
                    "from 'arangojs'",
                    "require('arangojs')",
                    "from 'orientjs'",
                    "require('orientjs')",
                    "from 'ravendb'",
                    "require('ravendb')",
                    "from 'couchbase'",
                    "require('couchbase')",
                    "from 'pouchdb'",
                    "require('pouchdb')",
                    "from 'pouchdb-node'",
                    "require('pouchdb-node')",
                    "from 'marklogic'",
                    "require('marklogic')",
                    "from '@ibm-cloud/cloudant'",
                    "require('@ibm-cloud/cloudant')",
                    "from 'nedb'",
                    "require('nedb')",
                    "from 'gun'",
                    "require('gun')",
                    "from 'rxdb'",
                    "require('rxdb')",
                    "from 'lowdb'",
                    "require('lowdb')"
                  ],
                  filePatterns: [
                    "**/mongodb*",
                    "**/*mongodb*",
                    "**/couchdb*",
                    "**/*couchdb*",
                    "**/documentdb*",
                    "**/*documentdb*",
                    "**/cosmosdb*",
                    "**/*cosmosdb*",
                    "**/faunadb*",
                    "**/*faunadb*",
                    "**/firestore*",
                    "**/*firestore*",
                    "**/rethinkdb*",
                    "**/*rethinkdb*",
                    "**/arangodb*",
                    "**/*arangodb*",
                    "**/orientdb*",
                    "**/*orientdb*",
                    "**/ravendb*",
                    "**/*ravendb*",
                    "**/couchbase*",
                    "**/*couchbase*",
                    "**/pouchdb*",
                    "**/*pouchdb*",
                    "**/marklogic*",
                    "**/*marklogic*",
                    "**/basex*",
                    "**/*basex*",
                    "**/existdb*",
                    "**/*existdb*",
                    "**/jackrabbit*",
                    "**/*jackrabbit*",
                    "**/cloudant*",
                    "**/*cloudant*",
                    "**/supabase-jsonb*",
                    "**/*supabase-jsonb*",
                    "**/nedb*",
                    "**/*nedb*",
                    "**/gundb*",
                    "**/*gundb*",
                    "**/rxdb*",
                    "**/*rxdb*",
                    "**/lovefield*",
                    "**/*lovefield*",
                    "**/ejdb*",
                    "**/*ejdb*",
                    "**/lowdb*",
                    "**/*lowdb*",
                    "**/minimongo*",
                    "**/*minimongo*"
                  ],
                  symbolPatterns: [
                    "mongoclient",
                    "schema",
                    "model",
                    "nano",
                    "cosmosclient",
                    "container",
                    "faunaclient",
                    "client",
                    "firestore",
                    "collectionreference",
                    "rethinkconnection",
                    "database",
                    "arangojs",
                    "orientdb",
                    "documentstore",
                    "cluster",
                    "bucket",
                    "pouchdb",
                    "databaseclient",
                    "cloudant",
                    "datastore",
                    "gun",
                    "rxdatabase",
                    "low"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  execution: [
                    {
                      id: "document-connection-cache",
                      summary: "Reuse MongoClient / Database connection handles",
                      weight: "critical",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "In document stores, always cache and reuse database client instances. Avoid calling connect() on every request handler.",
                      decisionTree: null,
                      codePatterns: [
                        {
                          concern: "MongoClient connection caching",
                          wrong: {
                            code: 'app.get("/data", async (req, res) => {\n  const client = await MongoClient.connect(url);\n  res.json(await client.db().collection("data").find().toArray());\n});',
                            language: "javascript",
                            explanation: "Re-connects on every request, exhausting connection limits instantly."
                          },
                          correct: {
                            code: 'let cachedClient = null;\nasync function getClient() {\n  if (!cachedClient) cachedClient = await MongoClient.connect(url);\n  return cachedClient;\n}\napp.get("/data", async (req, res) => {\n  const client = await getClient();\n  res.json(await client.db().collection("data").find().toArray());\n});',
                            language: "javascript",
                            explanation: "Caches the client instance globally and reuses it across requests."
                          },
                          detectionHint: "MongoClient.connect inside requests or route handlers"
                        }
                      ],
                      commonMistakes: [],
                      selfVerification: [],
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ],
                  verification: null
                },
                toolOverrides: []
              },
              {
                id: "backend.database.keyvalue",
                label: "Key-Value & Cache Store",
                children: [
                  {
                    id: "backend.database.keyvalue.redis",
                    label: "Redis",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "redis",
                          weight: 0.85
                        },
                        {
                          word: "ioredis",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "redis database",
                          weight: 0.95
                        },
                        {
                          phrase: "redis db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'redis'",
                        "require('redis')",
                        "from 'ioredis'",
                        "require('ioredis')"
                      ],
                      filePatterns: [
                        "**/redis*",
                        "**/*redis*"
                      ],
                      symbolPatterns: [
                        "redis",
                        "redisclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.memcached",
                    label: "Memcached",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "memcached",
                          weight: 0.85
                        },
                        {
                          word: "memcache",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "memcached database",
                          weight: 0.95
                        },
                        {
                          phrase: "memcached db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'memcached'",
                        "require('memcached')",
                        "from 'memcache'",
                        "require('memcache')"
                      ],
                      filePatterns: [
                        "**/memcached*",
                        "**/*memcached*"
                      ],
                      symbolPatterns: [
                        "memcached"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.dynamodb",
                    label: "AWS DynamoDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "dynamodb",
                          weight: 0.85
                        },
                        {
                          word: "dynamo",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "aws dynamodb database",
                          weight: 0.95
                        },
                        {
                          phrase: "aws dynamodb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@aws-sdk/client-dynamodb'",
                        "require('@aws-sdk/client-dynamodb')",
                        "from 'aws-sdk'",
                        "require('aws-sdk')"
                      ],
                      filePatterns: [
                        "**/dynamodb*",
                        "**/*dynamodb*"
                      ],
                      symbolPatterns: [
                        "dynamodb",
                        "dynamodbclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.keydb",
                    label: "KeyDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "keydb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "keydb database",
                          weight: 0.95
                        },
                        {
                          phrase: "keydb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'ioredis'",
                        "require('ioredis')",
                        "from 'redis'",
                        "require('redis')"
                      ],
                      filePatterns: [
                        "**/keydb*",
                        "**/*keydb*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.dragonfly",
                    label: "Dragonfly",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "dragonfly",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "dragonfly database",
                          weight: 0.95
                        },
                        {
                          phrase: "dragonfly db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'ioredis'",
                        "require('ioredis')",
                        "from 'redis'",
                        "require('redis')"
                      ],
                      filePatterns: [
                        "**/dragonfly*",
                        "**/*dragonfly*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.aerospike",
                    label: "Aerospike",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "aerospike",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "aerospike database",
                          weight: 0.95
                        },
                        {
                          phrase: "aerospike db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'aerospike'",
                        "require('aerospike')"
                      ],
                      filePatterns: [
                        "**/aerospike*",
                        "**/*aerospike*"
                      ],
                      symbolPatterns: [
                        "aerospikeclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.riak",
                    label: "Riak KV",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "riak",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "riak kv database",
                          weight: 0.95
                        },
                        {
                          phrase: "riak kv db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'basho-riak-client'",
                        "require('basho-riak-client')"
                      ],
                      filePatterns: [
                        "**/riak*",
                        "**/*riak*"
                      ],
                      symbolPatterns: [
                        "riakclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.rocksdb",
                    label: "RocksDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "rocksdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "rocksdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "rocksdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'rocksdb'",
                        "require('rocksdb')",
                        "from 'leveldown'",
                        "require('leveldown')"
                      ],
                      filePatterns: [
                        "**/rocksdb*",
                        "**/*rocksdb*"
                      ],
                      symbolPatterns: [
                        "rocksdb"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.leveldb",
                    label: "LevelDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "leveldb",
                          weight: 0.85
                        },
                        {
                          word: "levelup",
                          weight: 0.85
                        },
                        {
                          word: "leveldown",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "leveldb database",
                          weight: 0.95
                        },
                        {
                          phrase: "leveldb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'levelup'",
                        "require('levelup')",
                        "from 'leveldown'",
                        "require('leveldown')",
                        "from 'level'",
                        "require('level')"
                      ],
                      filePatterns: [
                        "**/leveldb*",
                        "**/*leveldb*"
                      ],
                      symbolPatterns: [
                        "levelup"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.boltdb",
                    label: "BoltDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "boltdb",
                          weight: 0.85
                        },
                        {
                          word: "bolt",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "boltdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "boltdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/boltdb*",
                        "**/*boltdb*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.badgerdb",
                    label: "BadgerDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "badger",
                          weight: 0.85
                        },
                        {
                          word: "badgerdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "badgerdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "badgerdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/badgerdb*",
                        "**/*badgerdb*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.lmdb",
                    label: "LMDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "lmdb",
                          weight: 0.85
                        },
                        {
                          word: "lightningdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "lmdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "lmdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'lmdb'",
                        "require('lmdb')",
                        "from 'node-lmdb'",
                        "require('node-lmdb')"
                      ],
                      filePatterns: [
                        "**/lmdb*",
                        "**/*lmdb*"
                      ],
                      symbolPatterns: [
                        "env",
                        "database"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.hazelcast",
                    label: "Hazelcast",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "hazelcast",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "hazelcast database",
                          weight: 0.95
                        },
                        {
                          phrase: "hazelcast db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'hazelcast-client'",
                        "require('hazelcast-client')"
                      ],
                      filePatterns: [
                        "**/hazelcast*",
                        "**/*hazelcast*"
                      ],
                      symbolPatterns: [
                        "client"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.geode",
                    label: "Apache Geode",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "geode",
                          weight: 0.85
                        },
                        {
                          word: "gemfire",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "apache geode database",
                          weight: 0.95
                        },
                        {
                          phrase: "apache geode db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/geode*",
                        "**/*geode*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.coherence",
                    label: "Oracle Coherence",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "coherence",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "oracle coherence database",
                          weight: 0.95
                        },
                        {
                          phrase: "oracle coherence db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/coherence*",
                        "**/*coherence*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.ehcache",
                    label: "Ehcache",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "ehcache",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "ehcache database",
                          weight: 0.95
                        },
                        {
                          phrase: "ehcache db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/ehcache*",
                        "**/*ehcache*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.infinispan",
                    label: "Infinispan",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "infinispan",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "infinispan database",
                          weight: 0.95
                        },
                        {
                          phrase: "infinispan db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/infinispan*",
                        "**/*infinispan*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.couchbase-memcached",
                    label: "Couchbase Memcached",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "couchbase",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "couchbase memcached database",
                          weight: 0.95
                        },
                        {
                          phrase: "couchbase memcached db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/couchbase-memcached*",
                        "**/*couchbase-memcached*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.tile38",
                    label: "Tile38",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "tile38",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "tile38 database",
                          weight: 0.95
                        },
                        {
                          phrase: "tile38 db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'tile38'",
                        "require('tile38')"
                      ],
                      filePatterns: [
                        "**/tile38*",
                        "**/*tile38*"
                      ],
                      symbolPatterns: [
                        "tile38"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.tarantool",
                    label: "Tarantool",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "tarantool",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "tarantool database",
                          weight: 0.95
                        },
                        {
                          phrase: "tarantool db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'tarantool-driver'",
                        "require('tarantool-driver')"
                      ],
                      filePatterns: [
                        "**/tarantool*",
                        "**/*tarantool*"
                      ],
                      symbolPatterns: [
                        "tarantool"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.tikv",
                    label: "TiKV",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "tikv",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "tikv database",
                          weight: 0.95
                        },
                        {
                          phrase: "tikv db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/tikv*",
                        "**/*tikv*"
                      ],
                      symbolPatterns: [
                        "tikvclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.etcd",
                    label: "Etcd",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "etcd",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "etcd database",
                          weight: 0.95
                        },
                        {
                          phrase: "etcd db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'etcd3'",
                        "require('etcd3')"
                      ],
                      filePatterns: [
                        "**/etcd*",
                        "**/*etcd*"
                      ],
                      symbolPatterns: [
                        "etcd3",
                        "etcd"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.consul-kv",
                    label: "Consul KV",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "consul",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "consul kv database",
                          weight: 0.95
                        },
                        {
                          phrase: "consul kv db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'consul'",
                        "require('consul')"
                      ],
                      filePatterns: [
                        "**/consul-kv*",
                        "**/*consul-kv*"
                      ],
                      symbolPatterns: [
                        "consul"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.voldemort",
                    label: "Voldemort",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "voldemort",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "voldemort database",
                          weight: 0.95
                        },
                        {
                          phrase: "voldemort db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/voldemort*",
                        "**/*voldemort*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.keyvalue.berkeleydb",
                    label: "BerkeleyDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "berkeleydb",
                          weight: 0.85
                        },
                        {
                          word: "bdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "berkeleydb database",
                          weight: 0.95
                        },
                        {
                          phrase: "berkeleydb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/berkeleydb*",
                        "**/*berkeleydb*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  }
                ],
                triggers: {
                  words: [
                    {
                      word: "cache",
                      weight: 0.4
                    },
                    {
                      word: "keyvalue",
                      weight: 0.6
                    },
                    {
                      word: "redis",
                      weight: 0.4
                    },
                    {
                      word: "ioredis",
                      weight: 0.3
                    },
                    {
                      word: "memcached",
                      weight: 0.3
                    },
                    {
                      word: "memcache",
                      weight: 0.3
                    },
                    {
                      word: "dynamodb",
                      weight: 0.3
                    },
                    {
                      word: "dynamo",
                      weight: 0.3
                    },
                    {
                      word: "keydb",
                      weight: 0.3
                    },
                    {
                      word: "dragonfly",
                      weight: 0.3
                    },
                    {
                      word: "aerospike",
                      weight: 0.3
                    },
                    {
                      word: "riak",
                      weight: 0.3
                    },
                    {
                      word: "rocksdb",
                      weight: 0.3
                    },
                    {
                      word: "leveldb",
                      weight: 0.3
                    },
                    {
                      word: "levelup",
                      weight: 0.3
                    },
                    {
                      word: "leveldown",
                      weight: 0.3
                    },
                    {
                      word: "boltdb",
                      weight: 0.3
                    },
                    {
                      word: "bolt",
                      weight: 0.3
                    },
                    {
                      word: "badger",
                      weight: 0.3
                    },
                    {
                      word: "badgerdb",
                      weight: 0.3
                    },
                    {
                      word: "lmdb",
                      weight: 0.3
                    },
                    {
                      word: "lightningdb",
                      weight: 0.3
                    },
                    {
                      word: "hazelcast",
                      weight: 0.3
                    },
                    {
                      word: "geode",
                      weight: 0.3
                    },
                    {
                      word: "gemfire",
                      weight: 0.3
                    },
                    {
                      word: "coherence",
                      weight: 0.3
                    },
                    {
                      word: "ehcache",
                      weight: 0.3
                    },
                    {
                      word: "infinispan",
                      weight: 0.3
                    },
                    {
                      word: "couchbase",
                      weight: 0.3
                    },
                    {
                      word: "tile38",
                      weight: 0.3
                    },
                    {
                      word: "tarantool",
                      weight: 0.3
                    },
                    {
                      word: "tikv",
                      weight: 0.3
                    },
                    {
                      word: "etcd",
                      weight: 0.3
                    },
                    {
                      word: "consul",
                      weight: 0.3
                    },
                    {
                      word: "voldemort",
                      weight: 0.3
                    },
                    {
                      word: "berkeleydb",
                      weight: 0.3
                    },
                    {
                      word: "bdb",
                      weight: 0.3
                    }
                  ],
                  phrases: [],
                  antiWords: [],
                  importPatterns: [
                    "from 'redis'",
                    "require('redis')",
                    "from 'ioredis'",
                    "require('ioredis')",
                    "from 'memcached'",
                    "require('memcached')",
                    "from 'memcache'",
                    "require('memcache')",
                    "from '@aws-sdk/client-dynamodb'",
                    "require('@aws-sdk/client-dynamodb')",
                    "from 'aws-sdk'",
                    "require('aws-sdk')",
                    "from 'aerospike'",
                    "require('aerospike')",
                    "from 'basho-riak-client'",
                    "require('basho-riak-client')",
                    "from 'rocksdb'",
                    "require('rocksdb')",
                    "from 'leveldown'",
                    "require('leveldown')",
                    "from 'levelup'",
                    "require('levelup')",
                    "from 'level'",
                    "require('level')",
                    "from 'lmdb'",
                    "require('lmdb')",
                    "from 'node-lmdb'",
                    "require('node-lmdb')",
                    "from 'hazelcast-client'",
                    "require('hazelcast-client')",
                    "from 'tile38'",
                    "require('tile38')",
                    "from 'tarantool-driver'",
                    "require('tarantool-driver')",
                    "from 'etcd3'",
                    "require('etcd3')",
                    "from 'consul'",
                    "require('consul')"
                  ],
                  filePatterns: [
                    "**/redis*",
                    "**/*redis*",
                    "**/memcached*",
                    "**/*memcached*",
                    "**/dynamodb*",
                    "**/*dynamodb*",
                    "**/keydb*",
                    "**/*keydb*",
                    "**/dragonfly*",
                    "**/*dragonfly*",
                    "**/aerospike*",
                    "**/*aerospike*",
                    "**/riak*",
                    "**/*riak*",
                    "**/rocksdb*",
                    "**/*rocksdb*",
                    "**/leveldb*",
                    "**/*leveldb*",
                    "**/boltdb*",
                    "**/*boltdb*",
                    "**/badgerdb*",
                    "**/*badgerdb*",
                    "**/lmdb*",
                    "**/*lmdb*",
                    "**/hazelcast*",
                    "**/*hazelcast*",
                    "**/geode*",
                    "**/*geode*",
                    "**/coherence*",
                    "**/*coherence*",
                    "**/ehcache*",
                    "**/*ehcache*",
                    "**/infinispan*",
                    "**/*infinispan*",
                    "**/couchbase-memcached*",
                    "**/*couchbase-memcached*",
                    "**/tile38*",
                    "**/*tile38*",
                    "**/tarantool*",
                    "**/*tarantool*",
                    "**/tikv*",
                    "**/*tikv*",
                    "**/etcd*",
                    "**/*etcd*",
                    "**/consul-kv*",
                    "**/*consul-kv*",
                    "**/voldemort*",
                    "**/*voldemort*",
                    "**/berkeleydb*",
                    "**/*berkeleydb*"
                  ],
                  symbolPatterns: [
                    "redis",
                    "redisclient",
                    "memcached",
                    "dynamodb",
                    "dynamodbclient",
                    "aerospikeclient",
                    "riakclient",
                    "rocksdb",
                    "levelup",
                    "env",
                    "database",
                    "client",
                    "tile38",
                    "tarantool",
                    "tikvclient",
                    "etcd3",
                    "etcd",
                    "consul"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  execution: [
                    {
                      id: "cache-ttl-stampede",
                      summary: "Provide cache key TTL and stampede protection",
                      weight: "principle",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "When caching keys, always define a TTL (Time To Live). Consider cache stampede mitigation for hot keys.",
                      decisionTree: null,
                      codePatterns: [],
                      commonMistakes: [
                        {
                          mistake: "Caching sensitive or dynamic user data indefinitely without TTL",
                          whyItHappens: "Forgetting to set expire parameters in cache client calls.",
                          correction: "Ensure all SET commands include an EX option.",
                          severity: "functional"
                        }
                      ],
                      selfVerification: [],
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ],
                  verification: null
                },
                toolOverrides: []
              },
              {
                id: "backend.database.widecolumn",
                label: "Wide-Column Family Database",
                children: [
                  {
                    id: "backend.database.widecolumn.cassandra",
                    label: "Apache Cassandra",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "cassandra",
                          weight: 0.85
                        },
                        {
                          word: "cql",
                          weight: 0.85
                        },
                        {
                          word: "cqlsh",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "apache cassandra database",
                          weight: 0.95
                        },
                        {
                          phrase: "apache cassandra db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'cassandra-driver'",
                        "require('cassandra-driver')"
                      ],
                      filePatterns: [
                        "**/cassandra*",
                        "**/*cassandra*"
                      ],
                      symbolPatterns: [
                        "client",
                        "dseclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.widecolumn.scylladb",
                    label: "ScyllaDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "scylladb",
                          weight: 0.85
                        },
                        {
                          word: "scylla",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "scylladb database",
                          weight: 0.95
                        },
                        {
                          phrase: "scylladb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'cassandra-driver'",
                        "require('cassandra-driver')"
                      ],
                      filePatterns: [
                        "**/scylladb*",
                        "**/*scylladb*"
                      ],
                      symbolPatterns: [
                        "client"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.widecolumn.hbase",
                    label: "Apache HBase",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "hbase",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "apache hbase database",
                          weight: 0.95
                        },
                        {
                          phrase: "apache hbase db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'hbase'",
                        "require('hbase')"
                      ],
                      filePatterns: [
                        "**/hbase*",
                        "**/*hbase*"
                      ],
                      symbolPatterns: [
                        "hbaseclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.widecolumn.accumulo",
                    label: "Apache Accumulo",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "accumulo",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "apache accumulo database",
                          weight: 0.95
                        },
                        {
                          phrase: "apache accumulo db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/accumulo*",
                        "**/*accumulo*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.widecolumn.bigtable",
                    label: "Google Cloud Bigtable",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "bigtable",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "google cloud bigtable database",
                          weight: 0.95
                        },
                        {
                          phrase: "google cloud bigtable db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@google-cloud/bigtable'",
                        "require('@google-cloud/bigtable')"
                      ],
                      filePatterns: [
                        "**/bigtable*",
                        "**/*bigtable*"
                      ],
                      symbolPatterns: [
                        "bigtable"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.widecolumn.keyspaces",
                    label: "AWS Keyspaces",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "keyspaces",
                          weight: 0.85
                        },
                        {
                          word: "cassandra",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "aws keyspaces database",
                          weight: 0.95
                        },
                        {
                          phrase: "aws keyspaces db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'cassandra-driver'",
                        "require('cassandra-driver')"
                      ],
                      filePatterns: [
                        "**/keyspaces*",
                        "**/*keyspaces*"
                      ],
                      symbolPatterns: [
                        "client"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.widecolumn.cosmos-cassandra",
                    label: "Azure Cosmos DB Cassandra",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "cosmos",
                          weight: 0.85
                        },
                        {
                          word: "cassandra",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "azure cosmos db cassandra database",
                          weight: 0.95
                        },
                        {
                          phrase: "azure cosmos db cassandra db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'cassandra-driver'",
                        "require('cassandra-driver')"
                      ],
                      filePatterns: [
                        "**/cosmos-cassandra*",
                        "**/*cosmos-cassandra*"
                      ],
                      symbolPatterns: [
                        "client"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.widecolumn.hypertable",
                    label: "Hypertable",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "hypertable",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "hypertable database",
                          weight: 0.95
                        },
                        {
                          phrase: "hypertable db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/hypertable*",
                        "**/*hypertable*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.widecolumn.maprdb",
                    label: "MapR-DB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "maprdb",
                          weight: 0.85
                        },
                        {
                          word: "mapr",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "mapr-db database",
                          weight: 0.95
                        },
                        {
                          phrase: "mapr-db db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/maprdb*",
                        "**/*maprdb*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.widecolumn.scylladb-cloud",
                    label: "ScyllaDB Cloud",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "scylla",
                          weight: 0.85
                        },
                        {
                          word: "scylladb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "scylladb cloud database",
                          weight: 0.95
                        },
                        {
                          phrase: "scylladb cloud db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/scylladb-cloud*",
                        "**/*scylladb-cloud*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.widecolumn.cassandra-enterprise",
                    label: "Cassandra Enterprise (DSE)",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "dse",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "cassandra enterprise (dse) database",
                          weight: 0.95
                        },
                        {
                          phrase: "cassandra enterprise (dse) db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'cassandra-driver'",
                        "require('cassandra-driver')"
                      ],
                      filePatterns: [
                        "**/cassandra-enterprise*",
                        "**/*cassandra-enterprise*"
                      ],
                      symbolPatterns: [
                        "dseclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.widecolumn.elassandra",
                    label: "Elassandra",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "elassandra",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "elassandra database",
                          weight: 0.95
                        },
                        {
                          phrase: "elassandra db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/elassandra*",
                        "**/*elassandra*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.widecolumn.yugabyte-ycql",
                    label: "YugabyteDB YCQL",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "yugabyte",
                          weight: 0.85
                        },
                        {
                          word: "ycql",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "yugabytedb ycql database",
                          weight: 0.95
                        },
                        {
                          phrase: "yugabytedb ycql db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'cassandra-driver'",
                        "require('cassandra-driver')"
                      ],
                      filePatterns: [
                        "**/yugabyte-ycql*",
                        "**/*yugabyte-ycql*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.widecolumn.cockroach-widecolumn",
                    label: "CockroachDB Wide-column",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "cockroach",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "cockroachdb wide-column database",
                          weight: 0.95
                        },
                        {
                          phrase: "cockroachdb wide-column db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/cockroach-widecolumn*",
                        "**/*cockroach-widecolumn*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.widecolumn.splicemachine",
                    label: "Splice Machine",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "splicemachine",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "splice machine database",
                          weight: 0.95
                        },
                        {
                          phrase: "splice machine db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/splicemachine*",
                        "**/*splicemachine*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  }
                ],
                triggers: {
                  words: [
                    {
                      word: "widecolumn",
                      weight: 0.7
                    },
                    {
                      word: "cassandra",
                      weight: 0.4
                    },
                    {
                      word: "hbase",
                      weight: 0.4
                    },
                    {
                      word: "cql",
                      weight: 0.3
                    },
                    {
                      word: "cqlsh",
                      weight: 0.3
                    },
                    {
                      word: "scylladb",
                      weight: 0.3
                    },
                    {
                      word: "scylla",
                      weight: 0.3
                    },
                    {
                      word: "accumulo",
                      weight: 0.3
                    },
                    {
                      word: "bigtable",
                      weight: 0.3
                    },
                    {
                      word: "keyspaces",
                      weight: 0.3
                    },
                    {
                      word: "cosmos",
                      weight: 0.3
                    },
                    {
                      word: "hypertable",
                      weight: 0.3
                    },
                    {
                      word: "maprdb",
                      weight: 0.3
                    },
                    {
                      word: "mapr",
                      weight: 0.3
                    },
                    {
                      word: "dse",
                      weight: 0.3
                    },
                    {
                      word: "elassandra",
                      weight: 0.3
                    },
                    {
                      word: "yugabyte",
                      weight: 0.3
                    },
                    {
                      word: "ycql",
                      weight: 0.3
                    },
                    {
                      word: "cockroach",
                      weight: 0.3
                    },
                    {
                      word: "splicemachine",
                      weight: 0.3
                    }
                  ],
                  phrases: [],
                  antiWords: [],
                  importPatterns: [
                    "from 'cassandra-driver'",
                    "require('cassandra-driver')",
                    "from 'hbase'",
                    "require('hbase')",
                    "from '@google-cloud/bigtable'",
                    "require('@google-cloud/bigtable')"
                  ],
                  filePatterns: [
                    "**/cassandra*",
                    "**/*cassandra*",
                    "**/scylladb*",
                    "**/*scylladb*",
                    "**/hbase*",
                    "**/*hbase*",
                    "**/accumulo*",
                    "**/*accumulo*",
                    "**/bigtable*",
                    "**/*bigtable*",
                    "**/keyspaces*",
                    "**/*keyspaces*",
                    "**/cosmos-cassandra*",
                    "**/*cosmos-cassandra*",
                    "**/hypertable*",
                    "**/*hypertable*",
                    "**/maprdb*",
                    "**/*maprdb*",
                    "**/scylladb-cloud*",
                    "**/*scylladb-cloud*",
                    "**/cassandra-enterprise*",
                    "**/*cassandra-enterprise*",
                    "**/elassandra*",
                    "**/*elassandra*",
                    "**/yugabyte-ycql*",
                    "**/*yugabyte-ycql*",
                    "**/cockroach-widecolumn*",
                    "**/*cockroach-widecolumn*",
                    "**/splicemachine*",
                    "**/*splicemachine*"
                  ],
                  symbolPatterns: [
                    "client",
                    "dseclient",
                    "hbaseclient",
                    "bigtable"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  execution: [
                    {
                      id: "widecolumn-queries",
                      summary: "Query-driven design in Cassandra/ScyllaDB",
                      weight: "principle",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "In wide-column stores, design tables strictly around queries. Avoid joins and perform denormalization to match target read shapes.",
                      decisionTree: null,
                      codePatterns: [],
                      commonMistakes: [],
                      selfVerification: [],
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ],
                  verification: null
                },
                toolOverrides: []
              },
              {
                id: "backend.database.columnar",
                label: "Columnar Warehouse & OLAP Engine",
                children: [
                  {
                    id: "backend.database.columnar.clickhouse",
                    label: "ClickHouse",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "clickhouse",
                          weight: 0.85
                        },
                        {
                          word: "ch",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "clickhouse database",
                          weight: 0.95
                        },
                        {
                          phrase: "clickhouse db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@clickhouse/client'",
                        "require('@clickhouse/client')"
                      ],
                      filePatterns: [
                        "**/clickhouse*",
                        "**/*clickhouse*"
                      ],
                      symbolPatterns: [
                        "clickhouseclient",
                        "createclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.snowflake",
                    label: "Snowflake",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "snowflake",
                          weight: 0.85
                        },
                        {
                          word: "snowsql",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "snowflake database",
                          weight: 0.95
                        },
                        {
                          phrase: "snowflake db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'snowflake-sdk'",
                        "require('snowflake-sdk')"
                      ],
                      filePatterns: [
                        "**/snowflake*",
                        "**/*snowflake*"
                      ],
                      symbolPatterns: [
                        "connection"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.bigquery",
                    label: "Google BigQuery",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "bigquery",
                          weight: 0.85
                        },
                        {
                          word: "bq",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "google bigquery database",
                          weight: 0.95
                        },
                        {
                          phrase: "google bigquery db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@google-cloud/bigquery'",
                        "require('@google-cloud/bigquery')"
                      ],
                      filePatterns: [
                        "**/bigquery*",
                        "**/*bigquery*"
                      ],
                      symbolPatterns: [
                        "bigquery"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.redshift",
                    label: "AWS Redshift",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "redshift",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "aws redshift database",
                          weight: 0.95
                        },
                        {
                          phrase: "aws redshift db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'pg'",
                        "require('pg')"
                      ],
                      filePatterns: [
                        "**/redshift*",
                        "**/*redshift*"
                      ],
                      symbolPatterns: [
                        "redshift"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.athena",
                    label: "AWS Athena",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "athena",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "aws athena database",
                          weight: 0.95
                        },
                        {
                          phrase: "aws athena db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'athena-express'",
                        "require('athena-express')",
                        "from '@aws-sdk/client-athena'",
                        "require('@aws-sdk/client-athena')"
                      ],
                      filePatterns: [
                        "**/athena*",
                        "**/*athena*"
                      ],
                      symbolPatterns: [
                        "athenaexpress",
                        "athenaclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.druid",
                    label: "Apache Druid",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "druid",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "apache druid database",
                          weight: 0.95
                        },
                        {
                          phrase: "apache druid db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'druid-client'",
                        "require('druid-client')"
                      ],
                      filePatterns: [
                        "**/druid*",
                        "**/*druid*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.pinot",
                    label: "Apache Pinot",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "pinot",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "apache pinot database",
                          weight: 0.95
                        },
                        {
                          phrase: "apache pinot db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'pinot-client'",
                        "require('pinot-client')"
                      ],
                      filePatterns: [
                        "**/pinot*",
                        "**/*pinot*"
                      ],
                      symbolPatterns: [
                        "pinotclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.duckdb-olap",
                    label: "DuckDB OLAP",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "duckdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "duckdb olap database",
                          weight: 0.95
                        },
                        {
                          phrase: "duckdb olap db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'duckdb'",
                        "require('duckdb')"
                      ],
                      filePatterns: [
                        "**/duckdb-olap*",
                        "**/*duckdb-olap*"
                      ],
                      symbolPatterns: [
                        "database"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.monetdb",
                    label: "MonetDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "monetdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "monetdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "monetdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/monetdb*",
                        "**/*monetdb*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.vertica-olap",
                    label: "Vertica OLAP",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "vertica",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "vertica olap database",
                          weight: 0.95
                        },
                        {
                          phrase: "vertica olap db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/vertica-olap*",
                        "**/*vertica-olap*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.teradata-vantage",
                    label: "Teradata Vantage",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "teradata",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "teradata vantage database",
                          weight: 0.95
                        },
                        {
                          phrase: "teradata vantage db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/teradata-vantage*",
                        "**/*teradata-vantage*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.greenplum-olap",
                    label: "Greenplum Database",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "greenplum",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "greenplum database database",
                          weight: 0.95
                        },
                        {
                          phrase: "greenplum database db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/greenplum-olap*",
                        "**/*greenplum-olap*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.clickhouse-cloud",
                    label: "ClickHouse Cloud",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "clickhouse",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "clickhouse cloud database",
                          weight: 0.95
                        },
                        {
                          phrase: "clickhouse cloud db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/clickhouse-cloud*",
                        "**/*clickhouse-cloud*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.databricks-sql",
                    label: "Databricks SQL",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "databricks",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "databricks sql database",
                          weight: 0.95
                        },
                        {
                          phrase: "databricks sql db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@databricks/databricks-sdk'",
                        "require('@databricks/databricks-sdk')"
                      ],
                      filePatterns: [
                        "**/databricks-sql*",
                        "**/*databricks-sql*"
                      ],
                      symbolPatterns: [
                        "databricksconnection"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.synapse",
                    label: "Azure Synapse Analytics",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "synapse",
                          weight: 0.85
                        },
                        {
                          word: "azure",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "azure synapse analytics database",
                          weight: 0.95
                        },
                        {
                          phrase: "azure synapse analytics db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/synapse*",
                        "**/*synapse*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.starrocks",
                    label: "StarRocks",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "starrocks",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "starrocks database",
                          weight: 0.95
                        },
                        {
                          phrase: "starrocks db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/starrocks*",
                        "**/*starrocks*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.doris",
                    label: "Apache Doris",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "doris",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "apache doris database",
                          weight: 0.95
                        },
                        {
                          phrase: "apache doris db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/doris*",
                        "**/*doris*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.matrixone",
                    label: "MatrixOne",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "matrixone",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "matrixone database",
                          weight: 0.95
                        },
                        {
                          phrase: "matrixone db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/matrixone*",
                        "**/*matrixone*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.clickhouse-keeper",
                    label: "ClickHouse Keeper",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "clickhouse",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "clickhouse keeper database",
                          weight: 0.95
                        },
                        {
                          phrase: "clickhouse keeper db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/clickhouse-keeper*",
                        "**/*clickhouse-keeper*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.columnar.vectorwise",
                    label: "Vectorwise",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "vectorwise",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "vectorwise database",
                          weight: 0.95
                        },
                        {
                          phrase: "vectorwise db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/vectorwise*",
                        "**/*vectorwise*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  }
                ],
                triggers: {
                  words: [
                    {
                      word: "columnar",
                      weight: 0.7
                    },
                    {
                      word: "olap",
                      weight: 0.7
                    },
                    {
                      word: "warehouse",
                      weight: 0.6
                    },
                    {
                      word: "clickhouse",
                      weight: 0.3
                    },
                    {
                      word: "ch",
                      weight: 0.3
                    },
                    {
                      word: "snowflake",
                      weight: 0.3
                    },
                    {
                      word: "snowsql",
                      weight: 0.3
                    },
                    {
                      word: "bigquery",
                      weight: 0.3
                    },
                    {
                      word: "bq",
                      weight: 0.3
                    },
                    {
                      word: "redshift",
                      weight: 0.3
                    },
                    {
                      word: "athena",
                      weight: 0.3
                    },
                    {
                      word: "druid",
                      weight: 0.3
                    },
                    {
                      word: "pinot",
                      weight: 0.3
                    },
                    {
                      word: "duckdb",
                      weight: 0.3
                    },
                    {
                      word: "monetdb",
                      weight: 0.3
                    },
                    {
                      word: "vertica",
                      weight: 0.3
                    },
                    {
                      word: "teradata",
                      weight: 0.3
                    },
                    {
                      word: "greenplum",
                      weight: 0.3
                    },
                    {
                      word: "databricks",
                      weight: 0.3
                    },
                    {
                      word: "synapse",
                      weight: 0.3
                    },
                    {
                      word: "azure",
                      weight: 0.3
                    },
                    {
                      word: "starrocks",
                      weight: 0.3
                    },
                    {
                      word: "doris",
                      weight: 0.3
                    },
                    {
                      word: "matrixone",
                      weight: 0.3
                    },
                    {
                      word: "vectorwise",
                      weight: 0.3
                    }
                  ],
                  phrases: [],
                  antiWords: [],
                  importPatterns: [
                    "from '@clickhouse/client'",
                    "require('@clickhouse/client')",
                    "from 'snowflake-sdk'",
                    "require('snowflake-sdk')",
                    "from '@google-cloud/bigquery'",
                    "require('@google-cloud/bigquery')",
                    "from 'pg'",
                    "require('pg')",
                    "from 'athena-express'",
                    "require('athena-express')",
                    "from '@aws-sdk/client-athena'",
                    "require('@aws-sdk/client-athena')",
                    "from 'druid-client'",
                    "require('druid-client')",
                    "from 'pinot-client'",
                    "require('pinot-client')",
                    "from 'duckdb'",
                    "require('duckdb')",
                    "from '@databricks/databricks-sdk'",
                    "require('@databricks/databricks-sdk')"
                  ],
                  filePatterns: [
                    "**/clickhouse*",
                    "**/*clickhouse*",
                    "**/snowflake*",
                    "**/*snowflake*",
                    "**/bigquery*",
                    "**/*bigquery*",
                    "**/redshift*",
                    "**/*redshift*",
                    "**/athena*",
                    "**/*athena*",
                    "**/druid*",
                    "**/*druid*",
                    "**/pinot*",
                    "**/*pinot*",
                    "**/duckdb-olap*",
                    "**/*duckdb-olap*",
                    "**/monetdb*",
                    "**/*monetdb*",
                    "**/vertica-olap*",
                    "**/*vertica-olap*",
                    "**/teradata-vantage*",
                    "**/*teradata-vantage*",
                    "**/greenplum-olap*",
                    "**/*greenplum-olap*",
                    "**/clickhouse-cloud*",
                    "**/*clickhouse-cloud*",
                    "**/databricks-sql*",
                    "**/*databricks-sql*",
                    "**/synapse*",
                    "**/*synapse*",
                    "**/starrocks*",
                    "**/*starrocks*",
                    "**/doris*",
                    "**/*doris*",
                    "**/matrixone*",
                    "**/*matrixone*",
                    "**/clickhouse-keeper*",
                    "**/*clickhouse-keeper*",
                    "**/vectorwise*",
                    "**/*vectorwise*"
                  ],
                  symbolPatterns: [
                    "clickhouseclient",
                    "createclient",
                    "connection",
                    "bigquery",
                    "redshift",
                    "athenaexpress",
                    "athenaclient",
                    "pinotclient",
                    "database",
                    "databricksconnection"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  execution: [
                    {
                      id: "columnar-batch-writes",
                      summary: "Batch writes in columnar engines",
                      weight: "critical",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Columnar engines (e.g. ClickHouse, Snowflake) are built for large batches. NEVER write single rows concurrently; instead, buffer inserts.",
                      decisionTree: null,
                      codePatterns: [],
                      commonMistakes: [
                        {
                          mistake: "Direct single-row inserts from real-time events",
                          whyItHappens: "Treating ClickHouse like OLTP PostgreSQL database.",
                          correction: "Buffer writes in memory or use a queue (Kafka/Redis) to write 1000+ rows in batch.",
                          severity: "functional"
                        }
                      ],
                      selfVerification: [],
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ],
                  verification: null
                },
                toolOverrides: []
              },
              {
                id: "backend.database.timeseries",
                label: "Time-Series Engine",
                children: [
                  {
                    id: "backend.database.timeseries.timescaledb",
                    label: "TimescaleDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "timescaledb",
                          weight: 0.85
                        },
                        {
                          word: "timescale",
                          weight: 0.85
                        },
                        {
                          word: "hypertable",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "timescaledb database",
                          weight: 0.95
                        },
                        {
                          phrase: "timescaledb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'pg'",
                        "require('pg')"
                      ],
                      filePatterns: [
                        "**/timescaledb*",
                        "**/*timescaledb*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.timeseries.influxdb",
                    label: "InfluxDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "influxdb",
                          weight: 0.85
                        },
                        {
                          word: "influx",
                          weight: 0.85
                        },
                        {
                          word: "flux",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "influxdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "influxdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@influxdata/influxdb-client'",
                        "require('@influxdata/influxdb-client')"
                      ],
                      filePatterns: [
                        "**/influxdb*",
                        "**/*influxdb*"
                      ],
                      symbolPatterns: [
                        "influxdb",
                        "point"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.timeseries.questdb",
                    label: "QuestDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "questdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "questdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "questdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@questdb/nodejs-client'",
                        "require('@questdb/nodejs-client')"
                      ],
                      filePatterns: [
                        "**/questdb*",
                        "**/*questdb*"
                      ],
                      symbolPatterns: [
                        "sender"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.timeseries.victoriametrics",
                    label: "VictoriaMetrics",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "victoriametrics",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "victoriametrics database",
                          weight: 0.95
                        },
                        {
                          phrase: "victoriametrics db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/victoriametrics*",
                        "**/*victoriametrics*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.timeseries.prometheus",
                    label: "Prometheus",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "prometheus",
                          weight: 0.85
                        },
                        {
                          word: "promql",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "prometheus database",
                          weight: 0.95
                        },
                        {
                          phrase: "prometheus db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'prom-client'",
                        "require('prom-client')"
                      ],
                      filePatterns: [
                        "**/prometheus*",
                        "**/*prometheus*"
                      ],
                      symbolPatterns: [
                        "registry",
                        "counter",
                        "gauge"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.timeseries.graphite",
                    label: "Graphite",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "graphite",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "graphite database",
                          weight: 0.95
                        },
                        {
                          phrase: "graphite db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/graphite*",
                        "**/*graphite*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.timeseries.opentsdb",
                    label: "OpenTSDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "opentsdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "opentsdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "opentsdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/opentsdb*",
                        "**/*opentsdb*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.timeseries.kdbplus",
                    label: "KDB+",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "kdb",
                          weight: 0.85
                        },
                        {
                          word: "q-language",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "kdb+ database",
                          weight: 0.95
                        },
                        {
                          phrase: "kdb+ db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/kdbplus*",
                        "**/*kdbplus*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.timeseries.tdengine",
                    label: "TDengine",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "tdengine",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "tdengine database",
                          weight: 0.95
                        },
                        {
                          phrase: "tdengine db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@tdengine/client'",
                        "require('@tdengine/client')"
                      ],
                      filePatterns: [
                        "**/tdengine*",
                        "**/*tdengine*"
                      ],
                      symbolPatterns: [
                        "connection"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.timeseries.iotdb",
                    label: "Apache IoTDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "iotdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "apache iotdb database",
                          weight: 0.95
                        },
                        {
                          phrase: "apache iotdb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/iotdb*",
                        "**/*iotdb*"
                      ],
                      symbolPatterns: [
                        "session"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.timeseries.timestream",
                    label: "AWS Timestream",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "timestream",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "aws timestream database",
                          weight: 0.95
                        },
                        {
                          phrase: "aws timestream db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@aws-sdk/client-timestream-write'",
                        "require('@aws-sdk/client-timestream-write')"
                      ],
                      filePatterns: [
                        "**/timestream*",
                        "**/*timestream*"
                      ],
                      symbolPatterns: [
                        "timestreamwriteclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.timeseries.timeseries-insights",
                    label: "Azure Time Series Insights",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "timeseries",
                          weight: 0.85
                        },
                        {
                          word: "azure",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "azure time series insights database",
                          weight: 0.95
                        },
                        {
                          phrase: "azure time series insights db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/timeseries-insights*",
                        "**/*timeseries-insights*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.timeseries.influxdb-iox",
                    label: "InfluxDB IOx",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "iox",
                          weight: 0.85
                        },
                        {
                          word: "influxdb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "influxdb iox database",
                          weight: 0.95
                        },
                        {
                          phrase: "influxdb iox db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/influxdb-iox*",
                        "**/*influxdb-iox*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.timeseries.druid-ts",
                    label: "Druid Time-Series",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "druid",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "druid time-series database",
                          weight: 0.95
                        },
                        {
                          phrase: "druid time-series db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/druid-ts*",
                        "**/*druid-ts*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.timeseries.timescale-cloud",
                    label: "Timescale Cloud",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "timescale",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "timescale cloud database",
                          weight: 0.95
                        },
                        {
                          phrase: "timescale cloud db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/timescale-cloud*",
                        "**/*timescale-cloud*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  }
                ],
                triggers: {
                  words: [
                    {
                      word: "timeseries",
                      weight: 0.7
                    },
                    {
                      word: "influx",
                      weight: 0.4
                    },
                    {
                      word: "questdb",
                      weight: 0.4
                    },
                    {
                      word: "timescaledb",
                      weight: 0.3
                    },
                    {
                      word: "timescale",
                      weight: 0.3
                    },
                    {
                      word: "hypertable",
                      weight: 0.3
                    },
                    {
                      word: "influxdb",
                      weight: 0.3
                    },
                    {
                      word: "flux",
                      weight: 0.3
                    },
                    {
                      word: "victoriametrics",
                      weight: 0.3
                    },
                    {
                      word: "prometheus",
                      weight: 0.3
                    },
                    {
                      word: "promql",
                      weight: 0.3
                    },
                    {
                      word: "graphite",
                      weight: 0.3
                    },
                    {
                      word: "opentsdb",
                      weight: 0.3
                    },
                    {
                      word: "kdb",
                      weight: 0.3
                    },
                    {
                      word: "q-language",
                      weight: 0.3
                    },
                    {
                      word: "tdengine",
                      weight: 0.3
                    },
                    {
                      word: "iotdb",
                      weight: 0.3
                    },
                    {
                      word: "timestream",
                      weight: 0.3
                    },
                    {
                      word: "azure",
                      weight: 0.3
                    },
                    {
                      word: "iox",
                      weight: 0.3
                    },
                    {
                      word: "druid",
                      weight: 0.3
                    }
                  ],
                  phrases: [],
                  antiWords: [],
                  importPatterns: [
                    "from 'pg'",
                    "require('pg')",
                    "from '@influxdata/influxdb-client'",
                    "require('@influxdata/influxdb-client')",
                    "from '@questdb/nodejs-client'",
                    "require('@questdb/nodejs-client')",
                    "from 'prom-client'",
                    "require('prom-client')",
                    "from '@tdengine/client'",
                    "require('@tdengine/client')",
                    "from '@aws-sdk/client-timestream-write'",
                    "require('@aws-sdk/client-timestream-write')"
                  ],
                  filePatterns: [
                    "**/timescaledb*",
                    "**/*timescaledb*",
                    "**/influxdb*",
                    "**/*influxdb*",
                    "**/questdb*",
                    "**/*questdb*",
                    "**/victoriametrics*",
                    "**/*victoriametrics*",
                    "**/prometheus*",
                    "**/*prometheus*",
                    "**/graphite*",
                    "**/*graphite*",
                    "**/opentsdb*",
                    "**/*opentsdb*",
                    "**/kdbplus*",
                    "**/*kdbplus*",
                    "**/tdengine*",
                    "**/*tdengine*",
                    "**/iotdb*",
                    "**/*iotdb*",
                    "**/timestream*",
                    "**/*timestream*",
                    "**/timeseries-insights*",
                    "**/*timeseries-insights*",
                    "**/influxdb-iox*",
                    "**/*influxdb-iox*",
                    "**/druid-ts*",
                    "**/*druid-ts*",
                    "**/timescale-cloud*",
                    "**/*timescale-cloud*"
                  ],
                  symbolPatterns: [
                    "influxdb",
                    "point",
                    "sender",
                    "registry",
                    "counter",
                    "gauge",
                    "connection",
                    "session",
                    "timestreamwriteclient"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  execution: [
                    {
                      id: "timeseries-indexing",
                      summary: "Time index sorting requirements",
                      weight: "principle",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Always ensure timeseries inserts are strictly timestamped and queried using time boundaries to utilize indexing partitions.",
                      decisionTree: null,
                      codePatterns: [],
                      commonMistakes: [],
                      selfVerification: [],
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ],
                  verification: null
                },
                toolOverrides: []
              },
              {
                id: "backend.database.search",
                label: "Search Engine Store",
                children: [
                  {
                    id: "backend.database.search.opensearch",
                    label: "OpenSearch",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "opensearch",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "opensearch database",
                          weight: 0.95
                        },
                        {
                          phrase: "opensearch db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@opensearch-project/opensearch'",
                        "require('@opensearch-project/opensearch')"
                      ],
                      filePatterns: [
                        "**/opensearch*",
                        "**/*opensearch*"
                      ],
                      symbolPatterns: [
                        "client"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.search.elasticsearch",
                    label: "Elasticsearch",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "elasticsearch",
                          weight: 0.85
                        },
                        {
                          word: "es",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "elasticsearch database",
                          weight: 0.95
                        },
                        {
                          phrase: "elasticsearch db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@elastic/elasticsearch'",
                        "require('@elastic/elasticsearch')"
                      ],
                      filePatterns: [
                        "**/elasticsearch*",
                        "**/*elasticsearch*"
                      ],
                      symbolPatterns: [
                        "client"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.search.solr",
                    label: "Apache Solr",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "solr",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "apache solr database",
                          weight: 0.95
                        },
                        {
                          phrase: "apache solr db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'solr-client'",
                        "require('solr-client')"
                      ],
                      filePatterns: [
                        "**/solr*",
                        "**/*solr*"
                      ],
                      symbolPatterns: [
                        "client"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.search.algolia",
                    label: "Algolia",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "algolia",
                          weight: 0.85
                        },
                        {
                          word: "algoliasearch",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "algolia database",
                          weight: 0.95
                        },
                        {
                          phrase: "algolia db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'algoliasearch'",
                        "require('algoliasearch')"
                      ],
                      filePatterns: [
                        "**/algolia*",
                        "**/*algolia*"
                      ],
                      symbolPatterns: [
                        "searchclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.search.meilisearch",
                    label: "Meilisearch",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "meilisearch",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "meilisearch database",
                          weight: 0.95
                        },
                        {
                          phrase: "meilisearch db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'meilisearch'",
                        "require('meilisearch')"
                      ],
                      filePatterns: [
                        "**/meilisearch*",
                        "**/*meilisearch*"
                      ],
                      symbolPatterns: [
                        "meilisearch",
                        "meilisearchclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.search.typesense",
                    label: "Typesense",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "typesense",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "typesense database",
                          weight: 0.95
                        },
                        {
                          phrase: "typesense db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'typesense'",
                        "require('typesense')"
                      ],
                      filePatterns: [
                        "**/typesense*",
                        "**/*typesense*"
                      ],
                      symbolPatterns: [
                        "client"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.search.vespa",
                    label: "Vespa",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "vespa",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "vespa database",
                          weight: 0.95
                        },
                        {
                          phrase: "vespa db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/vespa*",
                        "**/*vespa*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.search.sphinx",
                    label: "Sphinx Search",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "sphinx",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "sphinx search database",
                          weight: 0.95
                        },
                        {
                          phrase: "sphinx search db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'limestone'",
                        "require('limestone')"
                      ],
                      filePatterns: [
                        "**/sphinx*",
                        "**/*sphinx*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.search.bleve",
                    label: "Bleve",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "bleve",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "bleve database",
                          weight: 0.95
                        },
                        {
                          phrase: "bleve db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/bleve*",
                        "**/*bleve*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.search.manticore",
                    label: "Manticore Search",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "manticore",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "manticore search database",
                          weight: 0.95
                        },
                        {
                          phrase: "manticore search db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'manticoresearch'",
                        "require('manticoresearch')"
                      ],
                      filePatterns: [
                        "**/manticore*",
                        "**/*manticore*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.search.cloudsearch",
                    label: "AWS CloudSearch",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "cloudsearch",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "aws cloudsearch database",
                          weight: 0.95
                        },
                        {
                          phrase: "aws cloudsearch db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@aws-sdk/client-cloudsearch-domain'",
                        "require('@aws-sdk/client-cloudsearch-domain')"
                      ],
                      filePatterns: [
                        "**/cloudsearch*",
                        "**/*cloudsearch*"
                      ],
                      symbolPatterns: [
                        "cloudsearchdomainclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.search.azure-search",
                    label: "Azure Cognitive Search",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "azure",
                          weight: 0.85
                        },
                        {
                          word: "search",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "azure cognitive search database",
                          weight: 0.95
                        },
                        {
                          phrase: "azure cognitive search db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@azure/search-documents'",
                        "require('@azure/search-documents')"
                      ],
                      filePatterns: [
                        "**/azure-search*",
                        "**/*azure-search*"
                      ],
                      symbolPatterns: [
                        "searchclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.search.sonic",
                    label: "Sonic",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "sonic",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "sonic database",
                          weight: 0.95
                        },
                        {
                          phrase: "sonic db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'sonic-channel'",
                        "require('sonic-channel')"
                      ],
                      filePatterns: [
                        "**/sonic*",
                        "**/*sonic*"
                      ],
                      symbolPatterns: [
                        "sonicchannel"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.search.whoosh",
                    label: "Whoosh",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "whoosh",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "whoosh database",
                          weight: 0.95
                        },
                        {
                          phrase: "whoosh db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/whoosh*",
                        "**/*whoosh*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.search.quickwit",
                    label: "Quickwit",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "quickwit",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "quickwit database",
                          weight: 0.95
                        },
                        {
                          phrase: "quickwit db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/quickwit*",
                        "**/*quickwit*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  }
                ],
                triggers: {
                  words: [
                    {
                      word: "opensearch",
                      weight: 0.4
                    },
                    {
                      word: "elasticsearch",
                      weight: 0.4
                    },
                    {
                      word: "meilisearch",
                      weight: 0.4
                    },
                    {
                      word: "es",
                      weight: 0.3
                    },
                    {
                      word: "solr",
                      weight: 0.3
                    },
                    {
                      word: "algolia",
                      weight: 0.3
                    },
                    {
                      word: "algoliasearch",
                      weight: 0.3
                    },
                    {
                      word: "typesense",
                      weight: 0.3
                    },
                    {
                      word: "vespa",
                      weight: 0.3
                    },
                    {
                      word: "sphinx",
                      weight: 0.3
                    },
                    {
                      word: "bleve",
                      weight: 0.3
                    },
                    {
                      word: "manticore",
                      weight: 0.3
                    },
                    {
                      word: "cloudsearch",
                      weight: 0.3
                    },
                    {
                      word: "azure",
                      weight: 0.3
                    },
                    {
                      word: "search",
                      weight: 0.3
                    },
                    {
                      word: "sonic",
                      weight: 0.3
                    },
                    {
                      word: "whoosh",
                      weight: 0.3
                    },
                    {
                      word: "quickwit",
                      weight: 0.3
                    }
                  ],
                  phrases: [],
                  antiWords: [],
                  importPatterns: [
                    "from '@opensearch-project/opensearch'",
                    "require('@opensearch-project/opensearch')",
                    "from '@elastic/elasticsearch'",
                    "require('@elastic/elasticsearch')",
                    "from 'solr-client'",
                    "require('solr-client')",
                    "from 'algoliasearch'",
                    "require('algoliasearch')",
                    "from 'meilisearch'",
                    "require('meilisearch')",
                    "from 'typesense'",
                    "require('typesense')",
                    "from 'limestone'",
                    "require('limestone')",
                    "from 'manticoresearch'",
                    "require('manticoresearch')",
                    "from '@aws-sdk/client-cloudsearch-domain'",
                    "require('@aws-sdk/client-cloudsearch-domain')",
                    "from '@azure/search-documents'",
                    "require('@azure/search-documents')",
                    "from 'sonic-channel'",
                    "require('sonic-channel')"
                  ],
                  filePatterns: [
                    "**/opensearch*",
                    "**/*opensearch*",
                    "**/elasticsearch*",
                    "**/*elasticsearch*",
                    "**/solr*",
                    "**/*solr*",
                    "**/algolia*",
                    "**/*algolia*",
                    "**/meilisearch*",
                    "**/*meilisearch*",
                    "**/typesense*",
                    "**/*typesense*",
                    "**/vespa*",
                    "**/*vespa*",
                    "**/sphinx*",
                    "**/*sphinx*",
                    "**/bleve*",
                    "**/*bleve*",
                    "**/manticore*",
                    "**/*manticore*",
                    "**/cloudsearch*",
                    "**/*cloudsearch*",
                    "**/azure-search*",
                    "**/*azure-search*",
                    "**/sonic*",
                    "**/*sonic*",
                    "**/whoosh*",
                    "**/*whoosh*",
                    "**/quickwit*",
                    "**/*quickwit*"
                  ],
                  symbolPatterns: [
                    "client",
                    "searchclient",
                    "meilisearch",
                    "meilisearchclient",
                    "cloudsearchdomainclient",
                    "sonicchannel"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  execution: [
                    {
                      id: "search-bulk-indexing",
                      summary: "Bulk operations for indexing documents",
                      weight: "principle",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "When indexing multiple search documents in OpenSearch/Elasticsearch, use bulk APIs (_bulk) rather than single index updates.",
                      decisionTree: null,
                      codePatterns: [],
                      commonMistakes: [],
                      selfVerification: [],
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ],
                  verification: null
                },
                toolOverrides: []
              },
              {
                id: "backend.database.vector",
                label: "Vector Database",
                children: [
                  {
                    id: "backend.database.vector.pinecone",
                    label: "Pinecone",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "pinecone",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "pinecone database",
                          weight: 0.95
                        },
                        {
                          phrase: "pinecone db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@pinecone-database/pinecone'",
                        "require('@pinecone-database/pinecone')"
                      ],
                      filePatterns: [
                        "**/pinecone*",
                        "**/*pinecone*"
                      ],
                      symbolPatterns: [
                        "pinecone",
                        "pineconeclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.vector.milvus",
                    label: "Milvus",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "milvus",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "milvus database",
                          weight: 0.95
                        },
                        {
                          phrase: "milvus db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@zilliz/milvus2-sdk-node'",
                        "require('@zilliz/milvus2-sdk-node')"
                      ],
                      filePatterns: [
                        "**/milvus*",
                        "**/*milvus*"
                      ],
                      symbolPatterns: [
                        "milvusclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.vector.qdrant",
                    label: "Qdrant",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "qdrant",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "qdrant database",
                          weight: 0.95
                        },
                        {
                          phrase: "qdrant db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from '@qdrant/js-client-rest'",
                        "require('@qdrant/js-client-rest')"
                      ],
                      filePatterns: [
                        "**/qdrant*",
                        "**/*qdrant*"
                      ],
                      symbolPatterns: [
                        "qdrantclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.vector.weaviate",
                    label: "Weaviate",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "weaviate",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "weaviate database",
                          weight: 0.95
                        },
                        {
                          phrase: "weaviate db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'weaviate-ts-client'",
                        "require('weaviate-ts-client')",
                        "from 'weaviate-client'",
                        "require('weaviate-client')"
                      ],
                      filePatterns: [
                        "**/weaviate*",
                        "**/*weaviate*"
                      ],
                      symbolPatterns: [
                        "weaviateclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.vector.chroma",
                    label: "Chroma",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "chroma",
                          weight: 0.85
                        },
                        {
                          word: "chromadb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "chroma database",
                          weight: 0.95
                        },
                        {
                          phrase: "chroma db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'chromadb'",
                        "require('chromadb')"
                      ],
                      filePatterns: [
                        "**/chroma*",
                        "**/*chroma*"
                      ],
                      symbolPatterns: [
                        "chromaclient"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.vector.pgvector",
                    label: "pgvector",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "pgvector",
                          weight: 0.85
                        },
                        {
                          word: "vector",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "pgvector database",
                          weight: 0.95
                        },
                        {
                          phrase: "pgvector db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'pgvector'",
                        "require('pgvector')"
                      ],
                      filePatterns: [
                        "**/pgvector*",
                        "**/*pgvector*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.vector.faiss",
                    label: "FAISS",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "faiss",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "faiss database",
                          weight: 0.95
                        },
                        {
                          phrase: "faiss db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/faiss*",
                        "**/*faiss*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.vector.vald",
                    label: "Vald",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "vald",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "vald database",
                          weight: 0.95
                        },
                        {
                          phrase: "vald db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/vald*",
                        "**/*vald*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.vector.lancedb",
                    label: "LanceDB",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "lancedb",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "lancedb database",
                          weight: 0.95
                        },
                        {
                          phrase: "lancedb db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'vectordb'",
                        "require('vectordb')"
                      ],
                      filePatterns: [
                        "**/lancedb*",
                        "**/*lancedb*"
                      ],
                      symbolPatterns: [
                        "connect"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.vector.milvus-lite",
                    label: "Milvus Lite",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "milvus",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "milvus lite database",
                          weight: 0.95
                        },
                        {
                          phrase: "milvus lite db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/milvus-lite*",
                        "**/*milvus-lite*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.vector.marqo",
                    label: "Marqo",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "marqo",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "marqo database",
                          weight: 0.95
                        },
                        {
                          phrase: "marqo db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [
                        "from 'marqo'",
                        "require('marqo')"
                      ],
                      filePatterns: [
                        "**/marqo*",
                        "**/*marqo*"
                      ],
                      symbolPatterns: [
                        "client"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.vector.vespa-vector",
                    label: "Vespa Vector",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "vespa",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "vespa vector database",
                          weight: 0.95
                        },
                        {
                          phrase: "vespa vector db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/vespa-vector*",
                        "**/*vespa-vector*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.vector.opensearch-vector",
                    label: "AWS OpenSearch Vector",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "opensearch",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "aws opensearch vector database",
                          weight: 0.95
                        },
                        {
                          phrase: "aws opensearch vector db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/opensearch-vector*",
                        "**/*opensearch-vector*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.vector.elasticsearch-vector",
                    label: "Elasticsearch Vector",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "elasticsearch",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "elasticsearch vector database",
                          weight: 0.95
                        },
                        {
                          phrase: "elasticsearch vector db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/elasticsearch-vector*",
                        "**/*elasticsearch-vector*"
                      ],
                      symbolPatterns: []
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  },
                  {
                    id: "backend.database.vector.redisvl",
                    label: "RedisVL",
                    children: [],
                    triggers: {
                      words: [
                        {
                          word: "redisvl",
                          weight: 0.85
                        }
                      ],
                      phrases: [
                        {
                          phrase: "redisvl database",
                          weight: 0.95
                        },
                        {
                          phrase: "redisvl db",
                          weight: 0.95
                        }
                      ],
                      antiWords: [],
                      importPatterns: [],
                      filePatterns: [
                        "**/redisvl*",
                        "**/*redisvl*"
                      ],
                      symbolPatterns: [
                        "searchindex"
                      ]
                    },
                    fragments: {
                      chat: null,
                      planning: null,
                      taskCreation: null,
                      investigation: null,
                      execution: null,
                      verification: null
                    },
                    toolOverrides: []
                  }
                ],
                triggers: {
                  words: [
                    {
                      word: "vector",
                      weight: 0.5
                    },
                    {
                      word: "pinecone",
                      weight: 0.4
                    },
                    {
                      word: "weaviate",
                      weight: 0.4
                    },
                    {
                      word: "milvus",
                      weight: 0.3
                    },
                    {
                      word: "qdrant",
                      weight: 0.3
                    },
                    {
                      word: "chroma",
                      weight: 0.3
                    },
                    {
                      word: "chromadb",
                      weight: 0.3
                    },
                    {
                      word: "pgvector",
                      weight: 0.3
                    },
                    {
                      word: "faiss",
                      weight: 0.3
                    },
                    {
                      word: "vald",
                      weight: 0.3
                    },
                    {
                      word: "lancedb",
                      weight: 0.3
                    },
                    {
                      word: "marqo",
                      weight: 0.3
                    },
                    {
                      word: "vespa",
                      weight: 0.3
                    },
                    {
                      word: "opensearch",
                      weight: 0.3
                    },
                    {
                      word: "elasticsearch",
                      weight: 0.3
                    },
                    {
                      word: "redisvl",
                      weight: 0.3
                    }
                  ],
                  phrases: [],
                  antiWords: [],
                  importPatterns: [
                    "from '@pinecone-database/pinecone'",
                    "require('@pinecone-database/pinecone')",
                    "from '@zilliz/milvus2-sdk-node'",
                    "require('@zilliz/milvus2-sdk-node')",
                    "from '@qdrant/js-client-rest'",
                    "require('@qdrant/js-client-rest')",
                    "from 'weaviate-ts-client'",
                    "require('weaviate-ts-client')",
                    "from 'weaviate-client'",
                    "require('weaviate-client')",
                    "from 'chromadb'",
                    "require('chromadb')",
                    "from 'pgvector'",
                    "require('pgvector')",
                    "from 'vectordb'",
                    "require('vectordb')",
                    "from 'marqo'",
                    "require('marqo')"
                  ],
                  filePatterns: [
                    "**/pinecone*",
                    "**/*pinecone*",
                    "**/milvus*",
                    "**/*milvus*",
                    "**/qdrant*",
                    "**/*qdrant*",
                    "**/weaviate*",
                    "**/*weaviate*",
                    "**/chroma*",
                    "**/*chroma*",
                    "**/pgvector*",
                    "**/*pgvector*",
                    "**/faiss*",
                    "**/*faiss*",
                    "**/vald*",
                    "**/*vald*",
                    "**/lancedb*",
                    "**/*lancedb*",
                    "**/milvus-lite*",
                    "**/*milvus-lite*",
                    "**/marqo*",
                    "**/*marqo*",
                    "**/vespa-vector*",
                    "**/*vespa-vector*",
                    "**/opensearch-vector*",
                    "**/*opensearch-vector*",
                    "**/elasticsearch-vector*",
                    "**/*elasticsearch-vector*",
                    "**/redisvl*",
                    "**/*redisvl*"
                  ],
                  symbolPatterns: [
                    "pinecone",
                    "pineconeclient",
                    "milvusclient",
                    "qdrantclient",
                    "weaviateclient",
                    "chromaclient",
                    "connect",
                    "client",
                    "searchindex"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  execution: [
                    {
                      id: "vector-similarity-metrics",
                      summary: "Vector distance metric alignment",
                      weight: "critical",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Ensure cosine similarity or L2 euclidean metrics are correctly configured to match the embedding model outputs.",
                      decisionTree: null,
                      codePatterns: [],
                      commonMistakes: [],
                      selfVerification: [],
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ],
                  verification: null
                },
                toolOverrides: []
              }
            ],
            triggers: {
              words: [
                {
                  word: "database",
                  weight: 0.5
                },
                {
                  word: "sql",
                  weight: 0.4
                },
                {
                  word: "query",
                  weight: 0.3
                },
                {
                  word: "postgresql",
                  weight: 0.3
                },
                {
                  word: "postgres",
                  weight: 0.3
                },
                {
                  word: "pg",
                  weight: 0.3
                },
                {
                  word: "pgpool",
                  weight: 0.3
                },
                {
                  word: "pgbouncer",
                  weight: 0.3
                },
                {
                  word: "mysql",
                  weight: 0.3
                },
                {
                  word: "mariadb",
                  weight: 0.3
                },
                {
                  word: "myisam",
                  weight: 0.3
                },
                {
                  word: "innodb",
                  weight: 0.3
                },
                {
                  word: "sqlite",
                  weight: 0.3
                },
                {
                  word: "sqlite3",
                  weight: 0.3
                },
                {
                  word: "better-sqlite3",
                  weight: 0.3
                },
                {
                  word: "libsql",
                  weight: 0.3
                },
                {
                  word: "oracle",
                  weight: 0.3
                },
                {
                  word: "oracledb",
                  weight: 0.3
                },
                {
                  word: "plsql",
                  weight: 0.3
                },
                {
                  word: "mssql",
                  weight: 0.3
                },
                {
                  word: "sqlserver",
                  weight: 0.3
                },
                {
                  word: "tsql",
                  weight: 0.3
                },
                {
                  word: "cockroach",
                  weight: 0.3
                },
                {
                  word: "cockroachdb",
                  weight: 0.3
                },
                {
                  word: "crdb",
                  weight: 0.3
                },
                {
                  word: "spanner",
                  weight: 0.3
                },
                {
                  word: "cloudspanner",
                  weight: 0.3
                },
                {
                  word: "yugabyte",
                  weight: 0.3
                },
                {
                  word: "yugabytedb",
                  weight: 0.3
                },
                {
                  word: "ycql",
                  weight: 0.3
                },
                {
                  word: "ysql",
                  weight: 0.3
                },
                {
                  word: "tidb",
                  weight: 0.3
                },
                {
                  word: "singlestore",
                  weight: 0.3
                },
                {
                  word: "memsql",
                  weight: 0.3
                },
                {
                  word: "db2",
                  weight: 0.3
                },
                {
                  word: "ibmdb2",
                  weight: 0.3
                },
                {
                  word: "firebird",
                  weight: 0.3
                },
                {
                  word: "firebirdsql",
                  weight: 0.3
                },
                {
                  word: "h2",
                  weight: 0.3
                },
                {
                  word: "h2database",
                  weight: 0.3
                },
                {
                  word: "derby",
                  weight: 0.3
                },
                {
                  word: "apachederby",
                  weight: 0.3
                },
                {
                  word: "informix",
                  weight: 0.3
                },
                {
                  word: "ingres",
                  weight: 0.3
                },
                {
                  word: "actian",
                  weight: 0.3
                },
                {
                  word: "saphana",
                  weight: 0.3
                },
                {
                  word: "hana",
                  weight: 0.3
                },
                {
                  word: "aurora",
                  weight: 0.3
                },
                {
                  word: "rds",
                  weight: 0.3
                },
                {
                  word: "aws-sdk",
                  weight: 0.3
                },
                {
                  word: "cloudsql",
                  weight: 0.3
                },
                {
                  word: "gcp",
                  weight: 0.3
                },
                {
                  word: "azuresql",
                  weight: 0.3
                },
                {
                  word: "azure",
                  weight: 0.3
                },
                {
                  word: "percona",
                  weight: 0.3
                },
                {
                  word: "teradata",
                  weight: 0.3
                },
                {
                  word: "sybase",
                  weight: 0.3
                },
                {
                  word: "ase",
                  weight: 0.3
                },
                {
                  word: "virtuoso",
                  weight: 0.3
                },
                {
                  word: "nuodb",
                  weight: 0.3
                },
                {
                  word: "hive",
                  weight: 0.3
                },
                {
                  word: "hive2",
                  weight: 0.3
                },
                {
                  word: "impala",
                  weight: 0.3
                },
                {
                  word: "greenplum",
                  weight: 0.3
                },
                {
                  word: "hsqldb",
                  weight: 0.3
                },
                {
                  word: "presto",
                  weight: 0.3
                },
                {
                  word: "prestodb",
                  weight: 0.3
                },
                {
                  word: "trino",
                  weight: 0.3
                },
                {
                  word: "vertica",
                  weight: 0.3
                },
                {
                  word: "sqlitecloud",
                  weight: 0.3
                },
                {
                  word: "turso",
                  weight: 0.3
                },
                {
                  word: "duckdb",
                  weight: 0.3
                },
                {
                  word: "oceanbase",
                  weight: 0.3
                },
                {
                  word: "voltdb",
                  weight: 0.3
                },
                {
                  word: "mongodb",
                  weight: 0.3
                },
                {
                  word: "mongo",
                  weight: 0.3
                },
                {
                  word: "mongoose",
                  weight: 0.3
                },
                {
                  word: "couchdb",
                  weight: 0.3
                },
                {
                  word: "nano",
                  weight: 0.3
                },
                {
                  word: "documentdb",
                  weight: 0.3
                },
                {
                  word: "cosmosdb",
                  weight: 0.3
                },
                {
                  word: "cosmos",
                  weight: 0.3
                },
                {
                  word: "fauna",
                  weight: 0.3
                },
                {
                  word: "faunadb",
                  weight: 0.3
                },
                {
                  word: "fql",
                  weight: 0.3
                },
                {
                  word: "firestore",
                  weight: 0.3
                },
                {
                  word: "firebase",
                  weight: 0.3
                },
                {
                  word: "rethinkdb",
                  weight: 0.3
                },
                {
                  word: "rethink",
                  weight: 0.3
                },
                {
                  word: "arangodb",
                  weight: 0.3
                },
                {
                  word: "arangojs",
                  weight: 0.3
                },
                {
                  word: "aql",
                  weight: 0.3
                },
                {
                  word: "orientdb",
                  weight: 0.3
                },
                {
                  word: "ravendb",
                  weight: 0.3
                },
                {
                  word: "couchbase",
                  weight: 0.3
                },
                {
                  word: "n1ql",
                  weight: 0.3
                },
                {
                  word: "pouchdb",
                  weight: 0.3
                },
                {
                  word: "marklogic",
                  weight: 0.3
                },
                {
                  word: "basex",
                  weight: 0.3
                },
                {
                  word: "existdb",
                  weight: 0.3
                },
                {
                  word: "jackrabbit",
                  weight: 0.3
                },
                {
                  word: "cloudant",
                  weight: 0.3
                },
                {
                  word: "supabase",
                  weight: 0.3
                },
                {
                  word: "postgrest",
                  weight: 0.3
                },
                {
                  word: "nedb",
                  weight: 0.3
                },
                {
                  word: "gundb",
                  weight: 0.3
                },
                {
                  word: "gun",
                  weight: 0.3
                },
                {
                  word: "rxdb",
                  weight: 0.3
                },
                {
                  word: "lovefield",
                  weight: 0.3
                },
                {
                  word: "ejdb",
                  weight: 0.3
                },
                {
                  word: "lowdb",
                  weight: 0.3
                },
                {
                  word: "minimongo",
                  weight: 0.3
                },
                {
                  word: "redis",
                  weight: 0.3
                },
                {
                  word: "ioredis",
                  weight: 0.3
                },
                {
                  word: "memcached",
                  weight: 0.3
                },
                {
                  word: "memcache",
                  weight: 0.3
                },
                {
                  word: "dynamodb",
                  weight: 0.3
                },
                {
                  word: "dynamo",
                  weight: 0.3
                },
                {
                  word: "keydb",
                  weight: 0.3
                },
                {
                  word: "dragonfly",
                  weight: 0.3
                },
                {
                  word: "aerospike",
                  weight: 0.3
                },
                {
                  word: "riak",
                  weight: 0.3
                },
                {
                  word: "rocksdb",
                  weight: 0.3
                },
                {
                  word: "leveldb",
                  weight: 0.3
                },
                {
                  word: "levelup",
                  weight: 0.3
                },
                {
                  word: "leveldown",
                  weight: 0.3
                },
                {
                  word: "boltdb",
                  weight: 0.3
                },
                {
                  word: "bolt",
                  weight: 0.3
                },
                {
                  word: "badger",
                  weight: 0.3
                },
                {
                  word: "badgerdb",
                  weight: 0.3
                },
                {
                  word: "lmdb",
                  weight: 0.3
                },
                {
                  word: "lightningdb",
                  weight: 0.3
                },
                {
                  word: "hazelcast",
                  weight: 0.3
                },
                {
                  word: "geode",
                  weight: 0.3
                },
                {
                  word: "gemfire",
                  weight: 0.3
                },
                {
                  word: "coherence",
                  weight: 0.3
                },
                {
                  word: "ehcache",
                  weight: 0.3
                },
                {
                  word: "infinispan",
                  weight: 0.3
                },
                {
                  word: "tile38",
                  weight: 0.3
                },
                {
                  word: "tarantool",
                  weight: 0.3
                },
                {
                  word: "tikv",
                  weight: 0.3
                },
                {
                  word: "etcd",
                  weight: 0.3
                },
                {
                  word: "consul",
                  weight: 0.3
                },
                {
                  word: "voldemort",
                  weight: 0.3
                },
                {
                  word: "berkeleydb",
                  weight: 0.3
                },
                {
                  word: "bdb",
                  weight: 0.3
                },
                {
                  word: "cassandra",
                  weight: 0.3
                },
                {
                  word: "cql",
                  weight: 0.3
                },
                {
                  word: "cqlsh",
                  weight: 0.3
                },
                {
                  word: "scylladb",
                  weight: 0.3
                },
                {
                  word: "scylla",
                  weight: 0.3
                },
                {
                  word: "hbase",
                  weight: 0.3
                },
                {
                  word: "accumulo",
                  weight: 0.3
                },
                {
                  word: "bigtable",
                  weight: 0.3
                },
                {
                  word: "keyspaces",
                  weight: 0.3
                },
                {
                  word: "hypertable",
                  weight: 0.3
                },
                {
                  word: "maprdb",
                  weight: 0.3
                },
                {
                  word: "mapr",
                  weight: 0.3
                },
                {
                  word: "dse",
                  weight: 0.3
                },
                {
                  word: "elassandra",
                  weight: 0.3
                },
                {
                  word: "splicemachine",
                  weight: 0.3
                },
                {
                  word: "clickhouse",
                  weight: 0.3
                },
                {
                  word: "ch",
                  weight: 0.3
                },
                {
                  word: "snowflake",
                  weight: 0.3
                },
                {
                  word: "snowsql",
                  weight: 0.3
                },
                {
                  word: "bigquery",
                  weight: 0.3
                },
                {
                  word: "bq",
                  weight: 0.3
                },
                {
                  word: "redshift",
                  weight: 0.3
                },
                {
                  word: "athena",
                  weight: 0.3
                },
                {
                  word: "druid",
                  weight: 0.3
                },
                {
                  word: "pinot",
                  weight: 0.3
                },
                {
                  word: "monetdb",
                  weight: 0.3
                },
                {
                  word: "databricks",
                  weight: 0.3
                },
                {
                  word: "synapse",
                  weight: 0.3
                },
                {
                  word: "starrocks",
                  weight: 0.3
                },
                {
                  word: "doris",
                  weight: 0.3
                },
                {
                  word: "matrixone",
                  weight: 0.3
                },
                {
                  word: "vectorwise",
                  weight: 0.3
                },
                {
                  word: "timescaledb",
                  weight: 0.3
                },
                {
                  word: "timescale",
                  weight: 0.3
                },
                {
                  word: "influxdb",
                  weight: 0.3
                },
                {
                  word: "influx",
                  weight: 0.3
                },
                {
                  word: "flux",
                  weight: 0.3
                },
                {
                  word: "questdb",
                  weight: 0.3
                },
                {
                  word: "victoriametrics",
                  weight: 0.3
                },
                {
                  word: "prometheus",
                  weight: 0.3
                },
                {
                  word: "promql",
                  weight: 0.3
                },
                {
                  word: "graphite",
                  weight: 0.3
                },
                {
                  word: "opentsdb",
                  weight: 0.3
                },
                {
                  word: "kdb",
                  weight: 0.3
                },
                {
                  word: "q-language",
                  weight: 0.3
                },
                {
                  word: "tdengine",
                  weight: 0.3
                },
                {
                  word: "iotdb",
                  weight: 0.3
                },
                {
                  word: "timestream",
                  weight: 0.3
                },
                {
                  word: "timeseries",
                  weight: 0.3
                },
                {
                  word: "iox",
                  weight: 0.3
                },
                {
                  word: "opensearch",
                  weight: 0.3
                },
                {
                  word: "elasticsearch",
                  weight: 0.3
                },
                {
                  word: "es",
                  weight: 0.3
                },
                {
                  word: "solr",
                  weight: 0.3
                },
                {
                  word: "algolia",
                  weight: 0.3
                },
                {
                  word: "algoliasearch",
                  weight: 0.3
                },
                {
                  word: "meilisearch",
                  weight: 0.3
                },
                {
                  word: "typesense",
                  weight: 0.3
                },
                {
                  word: "vespa",
                  weight: 0.3
                },
                {
                  word: "sphinx",
                  weight: 0.3
                },
                {
                  word: "bleve",
                  weight: 0.3
                },
                {
                  word: "manticore",
                  weight: 0.3
                },
                {
                  word: "cloudsearch",
                  weight: 0.3
                },
                {
                  word: "search",
                  weight: 0.3
                },
                {
                  word: "sonic",
                  weight: 0.3
                },
                {
                  word: "whoosh",
                  weight: 0.3
                },
                {
                  word: "quickwit",
                  weight: 0.3
                },
                {
                  word: "pinecone",
                  weight: 0.3
                },
                {
                  word: "milvus",
                  weight: 0.3
                },
                {
                  word: "qdrant",
                  weight: 0.3
                },
                {
                  word: "weaviate",
                  weight: 0.3
                },
                {
                  word: "chroma",
                  weight: 0.3
                },
                {
                  word: "chromadb",
                  weight: 0.3
                },
                {
                  word: "pgvector",
                  weight: 0.3
                },
                {
                  word: "vector",
                  weight: 0.3
                },
                {
                  word: "faiss",
                  weight: 0.3
                },
                {
                  word: "vald",
                  weight: 0.3
                },
                {
                  word: "lancedb",
                  weight: 0.3
                },
                {
                  word: "marqo",
                  weight: 0.3
                },
                {
                  word: "redisvl",
                  weight: 0.3
                }
              ],
              phrases: [],
              antiWords: [],
              importPatterns: [],
              filePatterns: [],
              symbolPatterns: []
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              execution: null,
              verification: null
            },
            toolOverrides: []
          },
          {
            id: "backend.api",
            label: "API Design & Protocols",
            children: [
              {
                id: "backend.api.rest",
                label: "RESTful API",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "rest",
                      weight: 0.85
                    },
                    {
                      word: "restful",
                      weight: 0.85
                    },
                    {
                      word: "http",
                      weight: 0.85
                    },
                    {
                      word: "endpoint",
                      weight: 0.85
                    },
                    {
                      word: "json",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "rest api",
                      weight: 0.95
                    },
                    {
                      phrase: "http endpoint",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from 'express'",
                    "require('express')",
                    "from 'koa'",
                    "require('koa')",
                    "from 'fastify'",
                    "require('fastify')"
                  ],
                  filePatterns: [
                    "**/rest*",
                    "**/*rest*"
                  ],
                  symbolPatterns: [
                    "router",
                    "controller",
                    "get",
                    "post"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "rest-semantics",
                      summary: "RESTful Semantics",
                      weight: "critical",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Enforce strict HTTP method semantics: GET (safe/idempotent), POST (non-idempotent), PUT (idempotent replace), PATCH (idempotent partial update), DELETE (idempotent). Ensure proper status codes (e.g., 201 Created, 400 Bad Request, 404 Not Found).",
                      decisionTree: null,
                      codePatterns: [
                        {
                          concern: "Idempotency and Safety of GET requests",
                          wrong: {
                            language: "typescript",
                            code: 'app.get("/users/:id/activate", async (req, res) => {\n  await db.updateUserStatus(req.params.id, "active");\n  res.json({ success: true });\n});',
                            explanation: "GET requests must be safe and not cause state mutations."
                          },
                          correct: {
                            language: "typescript",
                            code: 'app.post("/users/:id/activate", async (req, res) => {\n  await db.updateUserStatus(req.params.id, "active");\n  res.status(200).json({ success: true });\n});',
                            explanation: "State modification is mapped to a POST request."
                          },
                          detectionHint: "Database write or state update inside a GET controller"
                        },
                        {
                          concern: "Idempotent HTTP methods in Python",
                          wrong: {
                            language: "python",
                            code: '@app.get("/items/{item_id}/increment")\ndef increment_item(item_id: str):\n    db.increment(item_id)\n    return {"status": "ok"}',
                            explanation: "Modifying data via a HTTP GET endpoint violates REST safety guidelines."
                          },
                          correct: {
                            language: "python",
                            code: '@app.patch("/items/{item_id}")\ndef update_item(item_id: str, delta: int):\n    db.update_item_qty(item_id, delta)\n    return {"status": "updated"}',
                            explanation: "Use PATCH or POST for actions that update/modify resource state."
                          },
                          detectionHint: "GET method modifying database rows"
                        },
                        {
                          concern: "Restful status codes in Go",
                          wrong: {
                            language: "go",
                            code: "func CreateUser(w http.ResponseWriter, r *http.Request) {\n    user := saveUser(r.Body)\n    w.WriteHeader(http.StatusOK)\n    json.NewEncoder(w).Encode(user)\n}",
                            explanation: "Returning 200 OK for resource creation instead of 201 Created."
                          },
                          correct: {
                            language: "go",
                            code: "func CreateUser(w http.ResponseWriter, r *http.Request) {\n    user := saveUser(r.Body)\n    w.WriteHeader(http.StatusCreated)\n    json.NewEncoder(w).Encode(user)\n}",
                            explanation: "Use StatusCreated (201) when a resource is successfully created."
                          },
                          detectionHint: "Status OK (200) returned on create handlers"
                        }
                      ],
                      commonMistakes: [
                        {
                          mistake: "Using GET requests to delete resources",
                          whyItHappens: "Quick implementation without writing frontend forms or AJAX POST calls.",
                          correction: "Map deletion to HTTP DELETE or POST with a payload.",
                          severity: "security"
                        }
                      ],
                      selfVerification: [
                        {
                          check: "All GET requests are read-only",
                          howToVerify: "Verify that GET routes do not trigger save, update, or delete commands.",
                          failureIndicator: "GET route containing database write methods",
                          remediation: "Change the route method to POST, PUT, or PATCH."
                        }
                      ],
                      outputConstraints: null,
                      guardrails: [
                        {
                          rule: "Never allow GET routes to modify database or file state.",
                          rationale: "Web crawlers, pre-fetching browsers, and caching proxies trigger GET requests automatically.",
                          alternative: "Use POST for general operations, and PATCH/PUT for specific resource updates."
                        }
                      ],
                      scaffolding: null,
                      crossReferences: null
                    },
                    {
                      id: "rest-pagination",
                      summary: "Pagination Strategy",
                      weight: "principle",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Prefer cursor-based pagination for large datasets to avoid offset drift and performance issues. Always include `next_cursor` in the response payload.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              },
              {
                id: "backend.api.graphql",
                label: "GraphQL",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "graphql",
                      weight: 0.85
                    },
                    {
                      word: "gql",
                      weight: 0.85
                    },
                    {
                      word: "resolver",
                      weight: 0.85
                    },
                    {
                      word: "mutation",
                      weight: 0.85
                    },
                    {
                      word: "subscription",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "graphql schema",
                      weight: 0.95
                    },
                    {
                      phrase: "apollo server",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from 'graphql'",
                    "require('graphql')",
                    "from 'apollo-server'",
                    "require('apollo-server')",
                    "from '@nestjs/graphql'",
                    "require('@nestjs/graphql')"
                  ],
                  filePatterns: [
                    "**/graphql*",
                    "**/*graphql*"
                  ],
                  symbolPatterns: [
                    "resolver",
                    "query",
                    "mutation"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "graphql-n1",
                      summary: "N+1 Mitigation",
                      weight: "critical",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Always use Dataloaders for batching and caching field resolutions. Never perform inline database queries inside scalar field resolvers.",
                      decisionTree: null,
                      codePatterns: [
                        {
                          concern: "Inline queries causing N+1",
                          wrong: {
                            language: "typescript",
                            code: "const resolvers = {\n  User: {\n    posts: async (user) => {\n      return await db.getPostsForUser(user.id);\n    }\n  }\n};",
                            explanation: "Resolves posts individually for every user, issuing N queries for N users."
                          },
                          correct: {
                            language: "typescript",
                            code: "const resolvers = {\n  User: {\n    posts: (user, args, context) => {\n      return context.loaders.postsLoader.load(user.id);\n    }\n  }\n};",
                            explanation: "Batches and caches the post resolutions in a single database query."
                          },
                          detectionHint: "Database queries invoked inside type-specific sub-resolvers"
                        },
                        {
                          concern: "Python GraphQL batching",
                          wrong: {
                            language: "python",
                            code: "class UserNode(DjangoObjectType):\n    def resolve_posts(self, info):\n        return Post.objects.filter(author=self)",
                            explanation: "Triggers a separate SQL query for each author resolved in the list."
                          },
                          correct: {
                            language: "python",
                            code: "class UserNode(DjangoObjectType):\n    def resolve_posts(self, info):\n        return info.context.loaders.posts_by_author.load(self.id)",
                            explanation: "Loads author posts using a dataloader to batch relational queries."
                          },
                          detectionHint: "Django ORM query inside field resolver"
                        }
                      ],
                      commonMistakes: [
                        {
                          mistake: "Failing to instantiate DataLoader per-request",
                          whyItHappens: "Creating the DataLoader as a global singleton, causing users to see cached data of other users.",
                          correction: "Instantiate all DataLoaders inside the context builder function for every request.",
                          severity: "security"
                        }
                      ],
                      selfVerification: [
                        {
                          check: "DataLoader instance is request-scoped",
                          howToVerify: "Verify that loaders are created within the request context function, not in global module scope.",
                          failureIndicator: "new DataLoader() found in root module levels",
                          remediation: "Move DataLoader instantiation inside the express/apollo context callback."
                        }
                      ],
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    },
                    {
                      id: "graphql-security",
                      summary: "GraphQL Security",
                      weight: "principle",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Enforce query depth limiting and complexity cost analysis to prevent malicious nested queries from causing DoS.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              },
              {
                id: "backend.api.grpc",
                label: "gRPC",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "grpc",
                      weight: 0.85
                    },
                    {
                      word: "protobuf",
                      weight: 0.85
                    },
                    {
                      word: "rpc",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "grpc channel",
                      weight: 0.95
                    },
                    {
                      phrase: "protocol buffers",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from '@grpc/grpc-js'",
                    "require('@grpc/grpc-js')",
                    "from 'google-protobuf'",
                    "require('google-protobuf')"
                  ],
                  filePatterns: [
                    "**/grpc*",
                    "**/*grpc*"
                  ],
                  symbolPatterns: [
                    "servercredentials",
                    "loadpackagedefinition"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "grpc-versioning",
                      summary: "Protobuf Versioning",
                      weight: "principle",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Never rename or change the type of existing fields in Protobuf. Only add new fields with new tag numbers.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              },
              {
                id: "backend.api.websocket",
                label: "WebSocket",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "websocket",
                      weight: 0.85
                    },
                    {
                      word: "ws",
                      weight: 0.85
                    },
                    {
                      word: "socket.io",
                      weight: 0.85
                    },
                    {
                      word: "socketio",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "web socket",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from 'ws'",
                    "require('ws')",
                    "from 'socket.io'",
                    "require('socket.io')"
                  ],
                  filePatterns: [
                    "**/websocket*",
                    "**/*websocket*"
                  ],
                  symbolPatterns: [
                    "server",
                    "websocketserver",
                    "on",
                    "emit"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "ws-lifecycle",
                      summary: "WebSocket Lifecycle",
                      weight: "critical",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Implement ping/pong heartbeats to detect stale connections. Handle disconnections gracefully with exponential backoff reconnections.",
                      decisionTree: null,
                      codePatterns: [
                        {
                          concern: "Stale connection leaks",
                          wrong: {
                            language: "typescript",
                            code: 'wss.on("connection", (ws) => {\n  console.log("connected");\n});',
                            explanation: "Fails to detect silent disconnections, leading to socket leaks and dead subscriptions."
                          },
                          correct: {
                            language: "typescript",
                            code: 'wss.on("connection", (ws) => {\n  ws.isAlive = true;\n  ws.on("pong", () => { ws.isAlive = true; });\n});\nsetInterval(() => {\n  wss.clients.forEach((ws) => {\n    if (!ws.isAlive) return ws.terminate();\n    ws.isAlive = false;\n    ws.ping();\n  });\n}, 30000);',
                            explanation: "Regularly pings clients and terminates dead sockets that fail to reply."
                          },
                          detectionHint: "WebSocket server connection without ping interval"
                        },
                        {
                          concern: "Rust connection management in Axum",
                          wrong: {
                            language: "rust",
                            code: "async fn handle_socket(mut socket: WebSocket) {\n    while let Some(msg) = socket.recv().await {\n        // Process incoming\n    }\n}",
                            explanation: "Infinite wait loop that fails to handle dead connection cleanups."
                          },
                          correct: {
                            language: "rust",
                            code: "async fn handle_socket(mut socket: WebSocket) {\n    let mut interval = tokio::time::interval(Duration::from_secs(30));\n    loop {\n        tokio::select! {\n            Some(msg) = socket.recv() => { /* handle msg */ }\n            _ = interval.tick() => { socket.send(Message::Ping(vec![])).await.ok(); }\n        }\n    }\n}",
                            explanation: "Sends standard WebSocket pings on interval ticks to maintain socket activity."
                          },
                          detectionHint: "Axum WebSocket handler missing Ping interval select loop"
                        }
                      ],
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    },
                    {
                      id: "ws-state",
                      summary: "WebSocket State",
                      weight: "principle",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Do not rely on the WebSocket connection for single source of truth state. Hydrate initial state via REST before opening the socket for deltas.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              },
              {
                id: "backend.api.webhook",
                label: "Webhook",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "webhook",
                      weight: 0.85
                    },
                    {
                      word: "signature",
                      weight: 0.85
                    },
                    {
                      word: "hmac",
                      weight: 0.85
                    },
                    {
                      word: "callback",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "webhook endpoint",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [],
                  filePatterns: [
                    "**/webhook*",
                    "**/*webhook*"
                  ],
                  symbolPatterns: [
                    "verifysignature"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "webhook-idempotency",
                      summary: "Webhook Idempotency",
                      weight: "critical",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Store webhook event IDs and verify idempotency before processing to handle duplicate deliveries safely.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              }
            ],
            triggers: {
              words: [
                {
                  word: "api",
                  weight: 0.8
                },
                {
                  word: "endpoint",
                  weight: 0.6
                }
              ],
              phrases: [],
              antiWords: [],
              importPatterns: [],
              filePatterns: [],
              symbolPatterns: []
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              execution: null,
              verification: null
            },
            toolOverrides: []
          },
          {
            id: "backend.error-handling",
            label: "Error Handling & Resiliency",
            children: [
              {
                id: "backend.error-handling.retry-patterns",
                label: "Retry Patterns",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "retry",
                      weight: 0.85
                    },
                    {
                      word: "backoff",
                      weight: 0.85
                    },
                    {
                      word: "jitter",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "exponential backoff",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from 'async-retry'",
                    "require('async-retry')"
                  ],
                  filePatterns: [
                    "**/retry-patterns*",
                    "**/*retry-patterns*"
                  ],
                  symbolPatterns: [
                    "retry"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "retry-logic",
                      summary: "Safe Retries",
                      weight: "critical",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Only retry idempotent operations (GET, PUT, DELETE). Use exponential backoff with full jitter to avoid thundering herd problems.",
                      decisionTree: null,
                      codePatterns: [
                        {
                          concern: "Linear or raw retries without backoff/jitter",
                          wrong: {
                            language: "typescript",
                            code: "async function fetchWithRetry(url) {\n  for (let i = 0; i < 3; i++) {\n    try { return await fetch(url); }\n    catch (e) { /* retry immediately */ }\n  }\n}",
                            explanation: "Retries instantly without delay, overwhelming a struggling downstream service."
                          },
                          correct: {
                            language: "typescript",
                            code: "async function fetchWithRetry(url, retries = 3, delay = 1000) {\n  try {\n    return await fetch(url);\n  } catch (e) {\n    if (retries <= 0) throw e;\n    const jitter = Math.random() * delay;\n    await new Promise(r => setTimeout(r, delay + jitter));\n    return fetchWithRetry(url, retries - 1, delay * 2);\n  }\n}",
                            explanation: "Applies exponential backoff (delay * 2) combined with random jitter to distribute retries."
                          },
                          detectionHint: "Retry loops without delay or setTimeout"
                        },
                        {
                          concern: "Python backoff implementation",
                          wrong: {
                            language: "python",
                            code: "def call_service():\n    for _ in range(3):\n        try: return requests.get(url)\n        except: pass",
                            explanation: "Performs immediate retries upon failure, contributing to stampedes."
                          },
                          correct: {
                            language: "python",
                            code: "import time, random\ndef call_service(retries=3, delay=1.0):\n    try:\n        return requests.get(url)\n    except Exception as e:\n        if retries <= 0: raise e\n        time.sleep(delay + random.uniform(0, delay))\n        return call_service(retries - 1, delay * 2)",
                            explanation: "Uses random.uniform for jitter and multiplies delay to exponentially scale backoff."
                          },
                          detectionHint: "time.sleep called in exception blocks without dynamic delay"
                        }
                      ],
                      commonMistakes: [
                        {
                          mistake: "Retrying non-idempotent operations (POST)",
                          whyItHappens: "Treating all network errors identically.",
                          correction: "Only retry GET, PUT, or DELETE. If POST fails, return error and let caller decide.",
                          severity: "data-loss"
                        }
                      ],
                      selfVerification: [
                        {
                          check: "Only idempotent calls are retried",
                          howToVerify: "Verify that retry wrappers are not wrapped around POST or non-idempotent requests.",
                          failureIndicator: "POST requests wrapped with retry logic",
                          remediation: "Remove retry logic wrapper from the POST request caller."
                        }
                      ],
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              },
              {
                id: "backend.error-handling.circuit-breaker",
                label: "Circuit Breaker",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "circuit",
                      weight: 0.85
                    },
                    {
                      word: "breaker",
                      weight: 0.85
                    },
                    {
                      word: "opossum",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "circuit breaker",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from 'opossum'",
                    "require('opossum')"
                  ],
                  filePatterns: [
                    "**/circuit-breaker*",
                    "**/*circuit-breaker*"
                  ],
                  symbolPatterns: [
                    "circuitbreaker"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "circuit-breaker",
                      summary: "Circuit Breaker",
                      weight: "principle",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Wrap external network calls in a circuit breaker to fail fast when downstream is degraded.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              },
              {
                id: "backend.error-handling.error-boundaries",
                label: "Error Boundaries",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "error",
                      weight: 0.85
                    },
                    {
                      word: "exception",
                      weight: 0.85
                    },
                    {
                      word: "catch",
                      weight: 0.85
                    },
                    {
                      word: "throw",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "error handler",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [],
                  filePatterns: [
                    "**/error-boundaries*",
                    "**/*error-boundaries*"
                  ],
                  symbolPatterns: [
                    "errorhandler",
                    "catch"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "structured-errors",
                      summary: "Structured Logging",
                      weight: "critical",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Log errors as structured JSON. Never expose raw stack traces in HTTP responses to prevent information leakage.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              }
            ],
            triggers: {
              words: [
                {
                  word: "error",
                  weight: 0.6
                },
                {
                  word: "exception",
                  weight: 0.6
                }
              ],
              phrases: [],
              antiWords: [],
              importPatterns: [],
              filePatterns: [],
              symbolPatterns: []
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              execution: null,
              verification: null
            },
            toolOverrides: []
          },
          {
            id: "backend.architecture",
            label: "Code Architecture",
            children: [
              {
                id: "backend.architecture.dependency-injection",
                label: "Dependency Injection",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "di",
                      weight: 0.85
                    },
                    {
                      word: "ioc",
                      weight: 0.85
                    },
                    {
                      word: "inject",
                      weight: 0.85
                    },
                    {
                      word: "singleton",
                      weight: 0.85
                    },
                    {
                      word: "transient",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "dependency injection",
                      weight: 0.95
                    },
                    {
                      phrase: "inversion of control",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from 'inversify'",
                    "require('inversify')",
                    "from 'tsyringe'",
                    "require('tsyringe')",
                    "from '@nestjs/common'",
                    "require('@nestjs/common')"
                  ],
                  filePatterns: [
                    "**/dependency-injection*",
                    "**/*dependency-injection*"
                  ],
                  symbolPatterns: [
                    "injectable",
                    "container"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "di-lifecycle",
                      summary: "DI Lifecycle",
                      weight: "principle",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Be extremely careful with Singletons holding state. Prefer Transient or Request-scoped lifecycles for stateful dependencies.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              },
              {
                id: "backend.architecture.microservices",
                label: "Microservices",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "microservice",
                      weight: 0.85
                    },
                    {
                      word: "distributed",
                      weight: 0.85
                    },
                    {
                      word: "tracing",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "distributed system",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from '@opentelemetry/api'",
                    "require('@opentelemetry/api')"
                  ],
                  filePatterns: [
                    "**/microservices*",
                    "**/*microservices*"
                  ],
                  symbolPatterns: [
                    "tracer"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "ms-tracing",
                      summary: "Distributed Tracing",
                      weight: "principle",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Ensure trace context (e.g. W3C traceparent headers) is passed down via context when calling downstream microservices.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              },
              {
                id: "backend.architecture.cqrs",
                label: "CQRS",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "cqrs",
                      weight: 0.85
                    },
                    {
                      word: "command",
                      weight: 0.85
                    },
                    {
                      word: "query",
                      weight: 0.85
                    },
                    {
                      word: "projection",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "command query",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from '@nestjs/cqrs'",
                    "require('@nestjs/cqrs')"
                  ],
                  filePatterns: [
                    "**/cqrs*",
                    "**/*cqrs*"
                  ],
                  symbolPatterns: [
                    "commandhandler",
                    "queryhandler"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "cqrs-consistency",
                      summary: "Eventual Consistency",
                      weight: "principle",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Queries in CQRS may return stale data. Design UI to handle eventual consistency (e.g. optimistic updates).",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              },
              {
                id: "backend.architecture.saga",
                label: "Saga Pattern",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "saga",
                      weight: 0.85
                    },
                    {
                      word: "choreography",
                      weight: 0.85
                    },
                    {
                      word: "orchestration",
                      weight: 0.85
                    },
                    {
                      word: "compensating",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "saga pattern",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [],
                  filePatterns: [
                    "**/saga*",
                    "**/*saga*"
                  ],
                  symbolPatterns: []
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "saga-compensation",
                      summary: "Compensating Transactions",
                      weight: "critical",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Every step in a Saga must have a reverse compensating action defined to revert partial state on failure.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              }
            ],
            triggers: {
              words: [],
              phrases: [],
              antiWords: [],
              importPatterns: [],
              filePatterns: [],
              symbolPatterns: []
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              execution: null,
              verification: null
            },
            toolOverrides: []
          },
          {
            id: "backend.messaging",
            label: "Messaging & Queues",
            children: [
              {
                id: "backend.messaging.kafka",
                label: "Kafka",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "kafka",
                      weight: 0.85
                    },
                    {
                      word: "producer",
                      weight: 0.85
                    },
                    {
                      word: "consumer",
                      weight: 0.85
                    },
                    {
                      word: "partition",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "apache kafka",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from 'kafkajs'",
                    "require('kafkajs')"
                  ],
                  filePatterns: [
                    "**/kafka*",
                    "**/*kafka*"
                  ],
                  symbolPatterns: [
                    "kafka",
                    "producer",
                    "consumer"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "kafka-offsets",
                      summary: "Offset Management",
                      weight: "principle",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Handle manual offset commits carefully. Do not commit an offset until the message is fully processed and persisted to your DB.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              },
              {
                id: "backend.messaging.rabbitmq",
                label: "RabbitMQ",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "rabbitmq",
                      weight: 0.85
                    },
                    {
                      word: "amqp",
                      weight: 0.85
                    },
                    {
                      word: "exchange",
                      weight: 0.85
                    },
                    {
                      word: "queue",
                      weight: 0.85
                    },
                    {
                      word: "routing-key",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "rabbit mq",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from 'amqplib'",
                    "require('amqplib')"
                  ],
                  filePatterns: [
                    "**/rabbitmq*",
                    "**/*rabbitmq*"
                  ],
                  symbolPatterns: [
                    "connect",
                    "channel"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "rabbitmq-prefetch",
                      summary: "Prefetch Limits",
                      weight: "principle",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Set a strict prefetch limit on consumers to prevent overwhelming the worker node.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              },
              {
                id: "backend.messaging.sqs",
                label: "AWS SQS",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "sqs",
                      weight: 0.85
                    },
                    {
                      word: "fifo",
                      weight: 0.85
                    },
                    {
                      word: "dlq",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "aws sqs",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from '@aws-sdk/client-sqs'",
                    "require('@aws-sdk/client-sqs')"
                  ],
                  filePatterns: [
                    "**/sqs*",
                    "**/*sqs*"
                  ],
                  symbolPatterns: [
                    "sqsclient"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "sqs-visibility",
                      summary: "Visibility Timeout",
                      weight: "principle",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "If a message takes longer to process than the visibility timeout, it will be delivered again. Use heartbeat extensions if necessary.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              }
            ],
            triggers: {
              words: [
                {
                  word: "queue",
                  weight: 0.8
                }
              ],
              phrases: [],
              antiWords: [],
              importPatterns: [],
              filePatterns: [],
              symbolPatterns: []
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              execution: null,
              verification: null
            },
            toolOverrides: []
          }
        ],
        triggers: {
          words: [
            {
              word: "backend",
              weight: 0.4
            },
            {
              word: "server",
              weight: 0.3
            },
            {
              word: "api",
              weight: 0.3
            }
          ],
          phrases: [],
          antiWords: [],
          importPatterns: [],
          filePatterns: [],
          symbolPatterns: []
        },
        fragments: {
          chat: null,
          planning: null,
          taskCreation: null,
          investigation: null,
          execution: null,
          verification: null
        },
        toolOverrides: []
      },
      {
        id: "frontend",
        label: "Frontend Development",
        children: [
          {
            id: "frontend.react",
            label: "React Framework",
            children: [
              {
                id: "frontend.react.state-management",
                label: "React State Management",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "redux",
                      weight: 0.9
                    },
                    {
                      word: "zustand",
                      weight: 0.95
                    },
                    {
                      word: "context",
                      weight: 0.4
                    }
                  ],
                  phrases: [
                    {
                      phrase: "state management",
                      weight: 0.9
                    },
                    {
                      phrase: "react context",
                      weight: 0.85
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from 'zustand'",
                    "from 'react-redux'"
                  ],
                  filePatterns: [
                    "**/store*.ts",
                    "**/context*.ts"
                  ],
                  symbolPatterns: [
                    "useContext",
                    "createStore",
                    "createContext"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  execution: [
                    {
                      id: "react-context-perf",
                      summary: "Prevent React Context unnecessary re-renders",
                      weight: "awareness",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Use context only for low-frequency updates (themes, user auth). For high-frequency state, use Zustand or Redux.",
                      decisionTree: null,
                      codePatterns: [],
                      commonMistakes: [
                        {
                          mistake: "Wrapping full App tree in a high-frequency context provider",
                          whyItHappens: "Tutorials show Context as a general state solution, ignoring React's global re-render trigger.",
                          correction: "Use split contexts or Zustand stores.",
                          severity: "functional"
                        }
                      ],
                      selfVerification: [],
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ],
                  verification: null
                },
                toolOverrides: []
              }
            ],
            triggers: {
              words: [
                {
                  word: "react",
                  weight: 0.9
                },
                {
                  word: "jsx",
                  weight: 0.8
                },
                {
                  word: "tsx",
                  weight: 0.6
                }
              ],
              phrases: [],
              antiWords: [],
              importPatterns: [
                "from 'react'"
              ],
              filePatterns: [
                "**/*.tsx",
                "**/*.jsx"
              ],
              symbolPatterns: [
                "useState",
                "useEffect",
                "useMemo"
              ]
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              execution: null,
              verification: null
            },
            toolOverrides: []
          },
          {
            id: "frontend.state-management",
            label: "State Management",
            children: [
              {
                id: "frontend.state-management.redux",
                label: "Redux",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "redux",
                      weight: 0.85
                    },
                    {
                      word: "thunk",
                      weight: 0.85
                    },
                    {
                      word: "saga",
                      weight: 0.85
                    },
                    {
                      word: "slice",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "redux toolkit",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from '@reduxjs/toolkit'",
                    "require('@reduxjs/toolkit')",
                    "from 'react-redux'",
                    "require('react-redux')"
                  ],
                  filePatterns: [
                    "**/redux*",
                    "**/*redux*"
                  ],
                  symbolPatterns: [
                    "useselector",
                    "usedispatch"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "redux-immutability",
                      summary: "Immutability",
                      weight: "principle",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Never mutate state directly in reducers. Use RTK/Immer properly or spread operators.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              },
              {
                id: "frontend.state-management.zustand",
                label: "Zustand",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "zustand",
                      weight: 0.85
                    },
                    {
                      word: "slice",
                      weight: 0.85
                    },
                    {
                      word: "store",
                      weight: 0.85
                    }
                  ],
                  phrases: [],
                  antiWords: [],
                  importPatterns: [
                    "from 'zustand'",
                    "require('zustand')"
                  ],
                  filePatterns: [
                    "**/zustand*",
                    "**/*zustand*"
                  ],
                  symbolPatterns: [
                    "create"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "zustand-selectors",
                      summary: "Selectors",
                      weight: "principle",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Always use granular selectors when subscribing to Zustand stores to prevent unnecessary component re-renders.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              },
              {
                id: "frontend.state-management.signals",
                label: "Signals",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "signal",
                      weight: 0.85
                    },
                    {
                      word: "computed",
                      weight: 0.85
                    },
                    {
                      word: "effect",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "preact signals",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from '@preact/signals'",
                    "require('@preact/signals')",
                    "from '@preact/signals-react'",
                    "require('@preact/signals-react')"
                  ],
                  filePatterns: [
                    "**/signals*",
                    "**/*signals*"
                  ],
                  symbolPatterns: [
                    "signal",
                    "computed"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "signals-derived",
                      summary: "Derived State",
                      weight: "principle",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Do not sync derived state into independent signals. Use `computed` for any state that can be derived from other signals.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              }
            ],
            triggers: {
              words: [],
              phrases: [],
              antiWords: [],
              importPatterns: [],
              filePatterns: [],
              symbolPatterns: []
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              execution: null,
              verification: null
            },
            toolOverrides: []
          }
        ],
        triggers: {
          words: [
            {
              word: "frontend",
              weight: 0.4
            },
            {
              word: "ui",
              weight: 0.3
            },
            {
              word: "browser",
              weight: 0.3
            }
          ],
          phrases: [],
          antiWords: [],
          importPatterns: [],
          filePatterns: [],
          symbolPatterns: []
        },
        fragments: {
          chat: null,
          planning: null,
          taskCreation: null,
          investigation: null,
          execution: null,
          verification: null
        },
        toolOverrides: []
      },
      {
        id: "security",
        label: "Security Core",
        children: [
          {
            id: "security.authentication",
            label: "Authentication",
            children: [
              {
                id: "security.authentication.jwt-refresh-tokens",
                label: "JWT Refresh Tokens",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "jwt",
                      weight: 0.8
                    },
                    {
                      word: "token",
                      weight: 0.3
                    },
                    {
                      word: "refresh",
                      weight: 0.3
                    }
                  ],
                  phrases: [
                    {
                      phrase: "refresh token",
                      weight: 0.9
                    },
                    {
                      phrase: "jwt auth",
                      weight: 0.9
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from 'jsonwebtoken'"
                  ],
                  filePatterns: [
                    "**/auth*.ts",
                    "**/jwt*.ts"
                  ],
                  symbolPatterns: [
                    "sign",
                    "verify",
                    "refreshToken"
                  ]
                },
                triggersOverride: null,
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  execution: [
                    {
                      id: "jwt-csrf-httponly",
                      summary: "Always store JWTs in httpOnly cookies",
                      weight: "critical",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Refresh tokens and access tokens should never be stored in localStorage. Store in httpOnly, Secure, SameSite=Strict cookies.",
                      decisionTree: null,
                      codePatterns: [],
                      commonMistakes: [
                        {
                          mistake: "Storing sensitive tokens in localStorage",
                          whyItHappens: "localStorage is easy to access in JavaScript; developers forget about XSS risks.",
                          correction: "Use res.cookie('token', val, { httpOnly: true, secure: true })",
                          severity: "security"
                        }
                      ],
                      selfVerification: [],
                      outputConstraints: null,
                      guardrails: [
                        {
                          rule: "NEVER expose refresh tokens to JavaScript (do not use localStorage or standard cookies)",
                          rationale: "Makes tokens vulnerable to cross-site scripting (XSS) extraction.",
                          alternative: "Use httpOnly, Secure cookies."
                        }
                      ],
                      scaffolding: null,
                      crossReferences: null
                    }
                  ],
                  verification: null
                },
                toolOverrides: []
              }
            ],
            triggers: {
              words: [
                {
                  word: "auth",
                  weight: 0.6
                },
                {
                  word: "login",
                  weight: 0.5
                },
                {
                  word: "authenticate",
                  weight: 0.7
                }
              ],
              phrases: [],
              antiWords: [],
              importPatterns: [],
              filePatterns: [],
              symbolPatterns: []
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              execution: null,
              verification: null
            },
            toolOverrides: []
          },
          {
            id: "security.injection",
            label: "Injection Prevention",
            children: [
              {
                id: "security.injection.sql-injection",
                label: "SQL Injection",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "sql",
                      weight: 0.85
                    },
                    {
                      word: "query",
                      weight: 0.85
                    },
                    {
                      word: "raw",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "raw query",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [],
                  filePatterns: [
                    "**/sql-injection*",
                    "**/*sql-injection*"
                  ],
                  symbolPatterns: []
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "prevent-sqli",
                      summary: "Parameterized Queries",
                      weight: "critical",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "NEVER interpolate string variables directly into SQL. Always use parameterized queries or the ORMs strict binding mechanisms.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              },
              {
                id: "security.injection.xss",
                label: "XSS",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "xss",
                      weight: 0.85
                    },
                    {
                      word: "dangerouslySetInnerHTML",
                      weight: 0.85
                    },
                    {
                      word: "sanitize",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "cross site scripting",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from 'dompurify'",
                    "require('dompurify')"
                  ],
                  filePatterns: [
                    "**/xss*",
                    "**/*xss*"
                  ],
                  symbolPatterns: [
                    "sanitize"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "prevent-xss",
                      summary: "DOM Purify",
                      weight: "critical",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Never use `dangerouslySetInnerHTML` with untrusted user input without running it through DOMPurify first.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              }
            ],
            triggers: {
              words: [],
              phrases: [],
              antiWords: [],
              importPatterns: [],
              filePatterns: [],
              symbolPatterns: []
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              execution: null,
              verification: null
            },
            toolOverrides: []
          },
          {
            id: "security.secrets-management",
            label: "Secrets Management",
            children: [
              {
                id: "security.secrets-management.env-vars",
                label: "Environment Variables",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "env",
                      weight: 0.85
                    },
                    {
                      word: "dotenv",
                      weight: 0.85
                    },
                    {
                      word: "process.env",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "environment variable",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from 'dotenv'",
                    "require('dotenv')"
                  ],
                  filePatterns: [
                    "**/env-vars*",
                    "**/*env-vars*"
                  ],
                  symbolPatterns: [
                    "config"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "no-hardcoded-secrets",
                      summary: "No Hardcoded Secrets",
                      weight: "critical",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "NEVER hardcode API keys, passwords, or tokens in source code. Ensure `.env` is in `.gitignore`.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              }
            ],
            triggers: {
              words: [],
              phrases: [],
              antiWords: [],
              importPatterns: [],
              filePatterns: [],
              symbolPatterns: []
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              execution: null,
              verification: null
            },
            toolOverrides: []
          },
          {
            id: "security.cryptography",
            label: "Cryptography",
            children: [
              {
                id: "security.cryptography.password-hashing",
                label: "Password Hashing",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "hash",
                      weight: 0.85
                    },
                    {
                      word: "bcrypt",
                      weight: 0.85
                    },
                    {
                      word: "argon2",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "hash password",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from 'bcrypt'",
                    "require('bcrypt')",
                    "from 'argon2'",
                    "require('argon2')"
                  ],
                  filePatterns: [
                    "**/password-hashing*",
                    "**/*password-hashing*"
                  ],
                  symbolPatterns: [
                    "hash",
                    "compare"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "strong-hashing",
                      summary: "Strong Hashing",
                      weight: "critical",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Use Argon2id or bcrypt with appropriate work factors for passwords. Never use MD5 or SHA-1 for passwords.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              },
              {
                id: "security.cryptography.constant-time",
                label: "Constant Time Compares",
                children: [],
                triggers: {
                  words: [
                    {
                      word: "compare",
                      weight: 0.85
                    },
                    {
                      word: "hmac",
                      weight: 0.85
                    },
                    {
                      word: "signature",
                      weight: 0.85
                    }
                  ],
                  phrases: [
                    {
                      phrase: "timing attack",
                      weight: 0.95
                    }
                  ],
                  antiWords: [],
                  importPatterns: [
                    "from 'crypto'",
                    "require('crypto')"
                  ],
                  filePatterns: [
                    "**/constant-time*",
                    "**/*constant-time*"
                  ],
                  symbolPatterns: [
                    "timingsafeequal"
                  ]
                },
                fragments: {
                  chat: null,
                  planning: null,
                  taskCreation: null,
                  investigation: null,
                  verification: null,
                  execution: [
                    {
                      id: "timing-attacks",
                      summary: "Timing Attacks",
                      weight: "critical",
                      trigger: "always",
                      defersToCodebase: true,
                      coreGuidance: "Always use `crypto.timingSafeEqual` when comparing HMAC signatures or tokens to prevent timing attacks.",
                      decisionTree: null,
                      codePatterns: null,
                      commonMistakes: null,
                      selfVerification: null,
                      outputConstraints: null,
                      guardrails: null,
                      scaffolding: null,
                      crossReferences: null
                    }
                  ]
                },
                toolOverrides: []
              }
            ],
            triggers: {
              words: [
                {
                  word: "crypto",
                  weight: 0.8
                }
              ],
              phrases: [],
              antiWords: [],
              importPatterns: [],
              filePatterns: [],
              symbolPatterns: []
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              execution: null,
              verification: null
            },
            toolOverrides: []
          }
        ],
        triggers: {
          words: [
            {
              word: "security",
              weight: 0.5
            },
            {
              word: "safe",
              weight: 0.2
            },
            {
              word: "vulnerability",
              weight: 0.6
            }
          ],
          phrases: [],
          antiWords: [],
          importPatterns: [],
          filePatterns: [],
          symbolPatterns: []
        },
        fragments: {
          chat: null,
          planning: null,
          taskCreation: null,
          investigation: null,
          execution: null,
          verification: null
        },
        toolOverrides: []
      },
      {
        id: "testing",
        label: "Testing Methodologies",
        children: [
          {
            id: "testing.unit",
            label: "Unit Testing",
            children: [],
            triggers: {
              words: [
                {
                  word: "jest",
                  weight: 0.85
                },
                {
                  word: "mocha",
                  weight: 0.85
                },
                {
                  word: "vitest",
                  weight: 0.85
                },
                {
                  word: "unit",
                  weight: 0.85
                },
                {
                  word: "mock",
                  weight: 0.85
                },
                {
                  word: "spy",
                  weight: 0.85
                }
              ],
              phrases: [
                {
                  phrase: "unit test",
                  weight: 0.95
                }
              ],
              antiWords: [],
              importPatterns: [
                "from 'jest'",
                "require('jest')",
                "from 'vitest'",
                "require('vitest')"
              ],
              filePatterns: [
                "**/unit*",
                "**/*unit*"
              ],
              symbolPatterns: [
                "describe",
                "it",
                "expect"
              ]
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              verification: null,
              execution: [
                {
                  id: "unit-aaa",
                  summary: "AAA Pattern",
                  weight: "principle",
                  trigger: "always",
                  defersToCodebase: true,
                  coreGuidance: "Format unit tests using Arrange, Act, Assert blocks. Mock I/O boundaries aggressively.",
                  decisionTree: null,
                  codePatterns: null,
                  commonMistakes: null,
                  selfVerification: null,
                  outputConstraints: null,
                  guardrails: null,
                  scaffolding: null,
                  crossReferences: null
                },
                {
                  id: "pure-functions",
                  summary: "Pure Function Testing",
                  weight: "principle",
                  trigger: "always",
                  defersToCodebase: true,
                  coreGuidance: "For pure functions, use table-driven tests or parameterized inputs to cover edge cases exhaustively.",
                  decisionTree: null,
                  codePatterns: null,
                  commonMistakes: null,
                  selfVerification: null,
                  outputConstraints: null,
                  guardrails: null,
                  scaffolding: null,
                  crossReferences: null
                }
              ]
            },
            toolOverrides: []
          },
          {
            id: "testing.integration",
            label: "Integration Testing",
            children: [],
            triggers: {
              words: [
                {
                  word: "integration",
                  weight: 0.85
                },
                {
                  word: "testcontainers",
                  weight: 0.85
                },
                {
                  word: "supertest",
                  weight: 0.85
                }
              ],
              phrases: [
                {
                  phrase: "integration test",
                  weight: 0.95
                }
              ],
              antiWords: [],
              importPatterns: [
                "from 'testcontainers'",
                "require('testcontainers')",
                "from 'supertest'",
                "require('supertest')"
              ],
              filePatterns: [
                "**/integration*",
                "**/*integration*"
              ],
              symbolPatterns: [
                "genericcontainer"
              ]
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              verification: null,
              execution: [
                {
                  id: "integration-db",
                  summary: "Database Isolation",
                  weight: "principle",
                  trigger: "always",
                  defersToCodebase: true,
                  coreGuidance: "Run integration tests against ephemeral databases (e.g. Testcontainers) and rollback transactions after each test suite.",
                  decisionTree: null,
                  codePatterns: null,
                  commonMistakes: null,
                  selfVerification: null,
                  outputConstraints: null,
                  guardrails: null,
                  scaffolding: null,
                  crossReferences: null
                }
              ]
            },
            toolOverrides: []
          },
          {
            id: "testing.e2e",
            label: "E2E Testing",
            children: [],
            triggers: {
              words: [
                {
                  word: "cypress",
                  weight: 0.85
                },
                {
                  word: "playwright",
                  weight: 0.85
                },
                {
                  word: "puppeteer",
                  weight: 0.85
                },
                {
                  word: "e2e",
                  weight: 0.85
                }
              ],
              phrases: [
                {
                  phrase: "e2e test",
                  weight: 0.95
                },
                {
                  phrase: "end to end",
                  weight: 0.95
                }
              ],
              antiWords: [],
              importPatterns: [
                "from 'cypress'",
                "require('cypress')",
                "from '@playwright/test'",
                "require('@playwright/test')"
              ],
              filePatterns: [
                "**/e2e*",
                "**/*e2e*"
              ],
              symbolPatterns: [
                "page",
                "browser"
              ]
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              verification: null,
              execution: [
                {
                  id: "e2e-flakiness",
                  summary: "E2E Flakiness",
                  weight: "principle",
                  trigger: "always",
                  defersToCodebase: true,
                  coreGuidance: "Avoid setting state via UI clicks. Seed database state via direct API calls before running UI assertions to reduce test flakiness.",
                  decisionTree: null,
                  codePatterns: null,
                  commonMistakes: null,
                  selfVerification: null,
                  outputConstraints: null,
                  guardrails: null,
                  scaffolding: null,
                  crossReferences: null
                }
              ]
            },
            toolOverrides: []
          }
        ],
        triggers: {
          words: [
            {
              word: "test",
              weight: 0.8
            },
            {
              word: "spec",
              weight: 0.6
            }
          ],
          phrases: [],
          antiWords: [],
          importPatterns: [],
          filePatterns: [
            "**/*.spec.*",
            "**/*.test.*"
          ],
          symbolPatterns: []
        },
        fragments: {
          chat: null,
          planning: null,
          taskCreation: null,
          investigation: null,
          execution: null,
          verification: null
        },
        toolOverrides: []
      },
      {
        id: "devops",
        label: "DevOps & Infrastructure",
        children: [
          {
            id: "devops.ci-cd",
            label: "CI/CD Pipelines",
            children: [],
            triggers: {
              words: [
                {
                  word: "github-actions",
                  weight: 0.85
                },
                {
                  word: "gitlab-ci",
                  weight: 0.85
                },
                {
                  word: "jenkins",
                  weight: 0.85
                },
                {
                  word: "pipeline",
                  weight: 0.85
                }
              ],
              phrases: [
                {
                  phrase: "continuous integration",
                  weight: 0.95
                }
              ],
              antiWords: [],
              importPatterns: [],
              filePatterns: [
                "**/ci-cd*",
                "**/*ci-cd*"
              ],
              symbolPatterns: []
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              verification: null,
              execution: [
                {
                  id: "ci-caching",
                  summary: "Build Caching",
                  weight: "principle",
                  trigger: "always",
                  defersToCodebase: true,
                  coreGuidance: "Implement proper dependency caching in CI to speed up build times.",
                  decisionTree: null,
                  codePatterns: null,
                  commonMistakes: null,
                  selfVerification: null,
                  outputConstraints: null,
                  guardrails: null,
                  scaffolding: null,
                  crossReferences: null
                }
              ]
            },
            toolOverrides: []
          },
          {
            id: "devops.docker",
            label: "Docker",
            children: [],
            triggers: {
              words: [
                {
                  word: "docker",
                  weight: 0.85
                },
                {
                  word: "dockerfile",
                  weight: 0.85
                },
                {
                  word: "container",
                  weight: 0.85
                }
              ],
              phrases: [
                {
                  phrase: "docker image",
                  weight: 0.95
                }
              ],
              antiWords: [],
              importPatterns: [],
              filePatterns: [
                "**/docker*",
                "**/*docker*"
              ],
              symbolPatterns: []
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              verification: null,
              execution: [
                {
                  id: "docker-multi-stage",
                  summary: "Multi-stage Builds",
                  weight: "critical",
                  trigger: "always",
                  defersToCodebase: true,
                  coreGuidance: "Use multi-stage builds to keep final image sizes small. Never run the node process as `root` user in production.",
                  decisionTree: null,
                  codePatterns: null,
                  commonMistakes: null,
                  selfVerification: null,
                  outputConstraints: null,
                  guardrails: null,
                  scaffolding: null,
                  crossReferences: null
                }
              ]
            },
            toolOverrides: []
          },
          {
            id: "devops.terraform",
            label: "Terraform",
            children: [],
            triggers: {
              words: [
                {
                  word: "terraform",
                  weight: 0.85
                },
                {
                  word: "tf",
                  weight: 0.85
                },
                {
                  word: "hcl",
                  weight: 0.85
                },
                {
                  word: "provider",
                  weight: 0.85
                }
              ],
              phrases: [
                {
                  phrase: "infrastructure as code",
                  weight: 0.95
                }
              ],
              antiWords: [],
              importPatterns: [],
              filePatterns: [
                "**/terraform*",
                "**/*terraform*"
              ],
              symbolPatterns: []
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              verification: null,
              execution: [
                {
                  id: "tf-state",
                  summary: "State Management",
                  weight: "critical",
                  trigger: "always",
                  defersToCodebase: true,
                  coreGuidance: "Always configure a remote backend for state (e.g. S3 + DynamoDB locking). Never commit `terraform.tfstate` to source control.",
                  decisionTree: null,
                  codePatterns: null,
                  commonMistakes: null,
                  selfVerification: null,
                  outputConstraints: null,
                  guardrails: null,
                  scaffolding: null,
                  crossReferences: null
                }
              ]
            },
            toolOverrides: []
          }
        ],
        triggers: {
          words: [],
          phrases: [],
          antiWords: [],
          importPatterns: [],
          filePatterns: [
            "**/*.tf",
            "**/Dockerfile",
            "**/.github/workflows/*"
          ],
          symbolPatterns: []
        },
        fragments: {
          chat: null,
          planning: null,
          taskCreation: null,
          investigation: null,
          execution: null,
          verification: null
        },
        toolOverrides: []
      },
      {
        id: "performance",
        label: "Performance Optimization",
        children: [
          {
            id: "performance.caching-strategy",
            label: "Caching Strategy",
            children: [],
            triggers: {
              words: [
                {
                  word: "cache",
                  weight: 0.85
                },
                {
                  word: "redis",
                  weight: 0.85
                },
                {
                  word: "memcached",
                  weight: 0.85
                },
                {
                  word: "ttl",
                  weight: 0.85
                }
              ],
              phrases: [
                {
                  phrase: "cache aside",
                  weight: 0.95
                },
                {
                  phrase: "write through",
                  weight: 0.95
                }
              ],
              antiWords: [],
              importPatterns: [],
              filePatterns: [
                "**/caching-strategy*",
                "**/*caching-strategy*"
              ],
              symbolPatterns: []
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              verification: null,
              execution: [
                {
                  id: "cache-stampede",
                  summary: "Cache Stampede",
                  weight: "principle",
                  trigger: "always",
                  defersToCodebase: true,
                  coreGuidance: "Implement probabilistic early expiration or mutex locks to prevent cache stampedes on hot keys.",
                  decisionTree: null,
                  codePatterns: null,
                  commonMistakes: null,
                  selfVerification: null,
                  outputConstraints: null,
                  guardrails: null,
                  scaffolding: null,
                  crossReferences: null
                }
              ]
            },
            toolOverrides: []
          },
          {
            id: "performance.memory-management",
            label: "Memory Management",
            children: [],
            triggers: {
              words: [
                {
                  word: "memory",
                  weight: 0.85
                },
                {
                  word: "leak",
                  weight: 0.85
                },
                {
                  word: "stream",
                  weight: 0.85
                },
                {
                  word: "buffer",
                  weight: 0.85
                }
              ],
              phrases: [
                {
                  phrase: "memory leak",
                  weight: 0.95
                },
                {
                  phrase: "garbage collection",
                  weight: 0.95
                }
              ],
              antiWords: [],
              importPatterns: [],
              filePatterns: [
                "**/memory-management*",
                "**/*memory-management*"
              ],
              symbolPatterns: []
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              verification: null,
              execution: [
                {
                  id: "stream-vs-buffer",
                  summary: "Streams vs Buffers",
                  weight: "critical",
                  trigger: "always",
                  defersToCodebase: true,
                  coreGuidance: "Always use Streams (`fs.createReadStream`, `.pipe()`) for handling large files or payloads. Never buffer large files entirely in RAM.",
                  decisionTree: null,
                  codePatterns: null,
                  commonMistakes: null,
                  selfVerification: null,
                  outputConstraints: null,
                  guardrails: null,
                  scaffolding: null,
                  crossReferences: null
                }
              ]
            },
            toolOverrides: []
          },
          {
            id: "performance.query-optimization",
            label: "Query Optimization",
            children: [],
            triggers: {
              words: [
                {
                  word: "explain",
                  weight: 0.85
                },
                {
                  word: "index",
                  weight: 0.85
                },
                {
                  word: "n+1",
                  weight: 0.85
                },
                {
                  word: "slow-query",
                  weight: 0.85
                }
              ],
              phrases: [
                {
                  phrase: "query optimization",
                  weight: 0.95
                }
              ],
              antiWords: [],
              importPatterns: [],
              filePatterns: [
                "**/query-optimization*",
                "**/*query-optimization*"
              ],
              symbolPatterns: []
            },
            fragments: {
              chat: null,
              planning: null,
              taskCreation: null,
              investigation: null,
              verification: null,
              execution: [
                {
                  id: "n-plus-1",
                  summary: "N+1 Query Prevention",
                  weight: "principle",
                  trigger: "always",
                  defersToCodebase: true,
                  coreGuidance: "Check loops fetching relations. Batch them using `IN` clauses or join eagerly to prevent N+1 queries.",
                  decisionTree: null,
                  codePatterns: null,
                  commonMistakes: null,
                  selfVerification: null,
                  outputConstraints: null,
                  guardrails: null,
                  scaffolding: null,
                  crossReferences: null
                }
              ]
            },
            toolOverrides: []
          }
        ],
        triggers: {
          words: [
            {
              word: "performance",
              weight: 0.8
            }
          ],
          phrases: [],
          antiWords: [],
          importPatterns: [],
          filePatterns: [],
          symbolPatterns: []
        },
        fragments: {
          chat: null,
          planning: null,
          taskCreation: null,
          investigation: null,
          execution: null,
          verification: null
        },
        toolOverrides: []
      }
    ]
  },
  paradigm: {
    id: "paradigm",
    label: "Paradigm Axis Root",
    children: [
      {
        id: "paradigm.functional",
        label: "Functional Programming",
        children: [],
        triggers: {
          words: [
            {
              word: "fp",
              weight: 0.85
            },
            {
              word: "pure",
              weight: 0.85
            },
            {
              word: "immutable",
              weight: 0.85
            },
            {
              word: "map",
              weight: 0.85
            },
            {
              word: "reduce",
              weight: 0.85
            },
            {
              word: "filter",
              weight: 0.85
            }
          ],
          phrases: [
            {
              phrase: "pure function",
              weight: 0.95
            }
          ],
          antiWords: [],
          importPatterns: [
            "from 'ramda'",
            "require('ramda')",
            "from 'lodash/fp'",
            "require('lodash/fp')"
          ],
          filePatterns: [
            "**/functional*",
            "**/*functional*"
          ],
          symbolPatterns: []
        },
        fragments: {
          chat: null,
          planning: null,
          taskCreation: null,
          investigation: null,
          verification: null,
          execution: [
            {
              id: "functional-pure",
              summary: "Pure Functions",
              weight: "principle",
              trigger: "always",
              defersToCodebase: true,
              coreGuidance: "Avoid mutations and side effects. Return new copies of objects/arrays rather than modifying arguments in place.",
              decisionTree: null,
              codePatterns: [
                {
                  concern: "In-place argument mutation",
                  wrong: {
                    language: "typescript",
                    code: "function addActiveUser(users: User[], newUser: User): User[] {\n  users.push(newUser);\n  return users;\n}",
                    explanation: "Mutates the input array argument directly, which can cause unexpected reactivity bugs."
                  },
                  correct: {
                    language: "typescript",
                    code: "function addActiveUser(users: User[], newUser: User): User[] {\n  return [...users, newUser];\n}",
                    explanation: "Returns a brand new array, preserving the original array argument immutable."
                  },
                  detectionHint: "push, splice, shift, pop, or object property assignments on arguments"
                },
                {
                  concern: "Python list mutability pitfalls",
                  wrong: {
                    language: "python",
                    code: "def append_to(element, target=[]):\n    target.append(element)\n    return target",
                    explanation: "Mutable default arguments are shared across all function calls, leading to cross-call leaks."
                  },
                  correct: {
                    language: "python",
                    code: "def append_to(element, target=None):\n    if target is None:\n        target = []\n    new_target = list(target)\n    new_target.append(element)\n    return new_target",
                    explanation: "Uses None as a default placeholder and constructs a copy of the list before mutating."
                  },
                  detectionHint: "Mutable default arguments in python method definitions"
                }
              ],
              commonMistakes: null,
              selfVerification: null,
              outputConstraints: null,
              guardrails: null,
              scaffolding: null,
              crossReferences: null
            }
          ]
        },
        toolOverrides: []
      },
      {
        id: "paradigm.object-oriented",
        label: "Object-Oriented Programming",
        children: [],
        triggers: {
          words: [
            {
              word: "oop",
              weight: 0.85
            },
            {
              word: "class",
              weight: 0.85
            },
            {
              word: "interface",
              weight: 0.85
            },
            {
              word: "extends",
              weight: 0.85
            },
            {
              word: "implements",
              weight: 0.85
            }
          ],
          phrases: [
            {
              phrase: "object oriented",
              weight: 0.95
            }
          ],
          antiWords: [],
          importPatterns: [],
          filePatterns: [
            "**/object-oriented*",
            "**/*object-oriented*"
          ],
          symbolPatterns: [
            "class",
            "interface"
          ]
        },
        fragments: {
          chat: null,
          planning: null,
          taskCreation: null,
          investigation: null,
          verification: null,
          execution: [
            {
              id: "oop-solid",
              summary: "SOLID Principles",
              weight: "principle",
              trigger: "always",
              defersToCodebase: true,
              coreGuidance: "Favor composition over inheritance. Ensure subclasses can be substituted for base classes without breaking behavior (Liskov Substitution).",
              decisionTree: null,
              codePatterns: null,
              commonMistakes: null,
              selfVerification: null,
              outputConstraints: null,
              guardrails: null,
              scaffolding: null,
              crossReferences: null
            }
          ]
        },
        toolOverrides: []
      },
      {
        id: "paradigm.event-driven",
        label: "Event-Driven",
        children: [],
        triggers: {
          words: [
            {
              word: "event",
              weight: 0.85
            },
            {
              word: "emit",
              weight: 0.85
            },
            {
              word: "subscriber",
              weight: 0.85
            },
            {
              word: "publisher",
              weight: 0.85
            }
          ],
          phrases: [
            {
              phrase: "event driven",
              weight: 0.95
            }
          ],
          antiWords: [],
          importPatterns: [
            "from 'events'",
            "require('events')"
          ],
          filePatterns: [
            "**/event-driven*",
            "**/*event-driven*"
          ],
          symbolPatterns: [
            "eventemitter"
          ]
        },
        fragments: {
          chat: null,
          planning: null,
          taskCreation: null,
          investigation: null,
          verification: null,
          execution: [
            {
              id: "ed-idempotency",
              summary: "Idempotent Handlers",
              weight: "principle",
              trigger: "always",
              defersToCodebase: true,
              coreGuidance: "Event handlers must be idempotent. They may be called multiple times for the same event payload.",
              decisionTree: null,
              codePatterns: null,
              commonMistakes: null,
              selfVerification: null,
              outputConstraints: null,
              guardrails: null,
              scaffolding: null,
              crossReferences: null
            }
          ]
        },
        toolOverrides: []
      }
    ],
    triggers: {
      words: [],
      phrases: [],
      antiWords: [],
      importPatterns: [],
      filePatterns: [],
      symbolPatterns: []
    },
    fragments: {
      chat: null,
      planning: null,
      taskCreation: null,
      investigation: null,
      execution: null,
      verification: null
    },
    toolOverrides: []
  },
  scale: {
    id: "scale",
    label: "Scale Axis Root",
    children: [
      {
        id: "scale.single-user",
        label: "Single User",
        children: [],
        triggers: {
          words: [
            {
              word: "desktop",
              weight: 0.85
            },
            {
              word: "local",
              weight: 0.85
            },
            {
              word: "cli",
              weight: 0.85
            },
            {
              word: "electron",
              weight: 0.85
            }
          ],
          phrases: [
            {
              phrase: "single user",
              weight: 0.95
            }
          ],
          antiWords: [],
          importPatterns: [],
          filePatterns: [
            "**/single-user*",
            "**/*single-user*"
          ],
          symbolPatterns: []
        },
        fragments: {
          chat: null,
          planning: null,
          taskCreation: null,
          investigation: null,
          verification: null,
          execution: [
            {
              id: "scale-single",
              summary: "Local Scale",
              weight: "principle",
              trigger: "always",
              defersToCodebase: true,
              coreGuidance: "Favor local files or SQLite over distributed networks. Avoid heavy connection pooling.",
              decisionTree: null,
              codePatterns: null,
              commonMistakes: null,
              selfVerification: null,
              outputConstraints: null,
              guardrails: null,
              scaffolding: null,
              crossReferences: null
            }
          ]
        },
        toolOverrides: []
      },
      {
        id: "scale.production",
        label: "Production",
        children: [],
        triggers: {
          words: [
            {
              word: "production",
              weight: 0.85
            },
            {
              word: "cluster",
              weight: 0.85
            },
            {
              word: "ha",
              weight: 0.85
            },
            {
              word: "lb",
              weight: 0.85
            }
          ],
          phrases: [
            {
              phrase: "high availability",
              weight: 0.95
            }
          ],
          antiWords: [],
          importPatterns: [],
          filePatterns: [
            "**/production*",
            "**/*production*"
          ],
          symbolPatterns: []
        },
        fragments: {
          chat: null,
          planning: null,
          taskCreation: null,
          investigation: null,
          verification: null,
          execution: [
            {
              id: "scale-ha",
              summary: "High Availability",
              weight: "critical",
              trigger: "always",
              defersToCodebase: true,
              coreGuidance: "Assume servers can die at any time. Keep node processes strictly stateless. Offload all session state to Redis/DB.",
              decisionTree: null,
              codePatterns: [
                {
                  concern: "In-memory stateful sessions",
                  wrong: {
                    language: "typescript",
                    code: 'const activeSessions = new Map();\napp.post("/login", (req, res) => {\n  activeSessions.set(req.body.userId, req.session);\n  res.send("logged in");\n});',
                    explanation: "Sessions stored in local maps are lost when the instance restarts or scales horizontally."
                  },
                  correct: {
                    language: "typescript",
                    code: 'app.post("/login", async (req, res) => {\n  await redis.set(`session:${req.body.userId}`, JSON.stringify(req.session), "EX", 3600);\n  res.send("logged in");\n});',
                    explanation: "Offloads session state to a shared Redis cluster, keeping the web process completely stateless."
                  },
                  detectionHint: "In-memory Maps or arrays storing session or user state"
                },
                {
                  concern: "Stateless Python handlers",
                  wrong: {
                    language: "python",
                    code: 'logged_in_users = {}\n@app.post("/session")\ndef create_session(user_id: str):\n    logged_in_users[user_id] = True',
                    explanation: "Global dictionary storage prevents horizontal scaling across multiple Gunicorn/Uvicorn workers."
                  },
                  correct: {
                    language: "python",
                    code: '@app.post("/session")\ndef create_session(user_id: str, redis_client=Depends(get_redis)):\n    redis_client.setex(f"session:{user_id}", 3600, "active")',
                    explanation: "Stores login/session details externally in Redis for multi-instance stateless coordination."
                  },
                  detectionHint: "Global module variables modified in request routes"
                }
              ],
              commonMistakes: [
                {
                  mistake: "Using local filesystem storage for user uploads",
                  whyItHappens: "Simpler setup than configuring cloud object storage.",
                  correction: "Stream uploads directly to cloud storage (S3, GCS) rather than saving to local disk.",
                  severity: "data-loss"
                }
              ],
              selfVerification: [
                {
                  check: "Process contains zero local stateful dependencies",
                  howToVerify: "Verify that node restarts or parallel execution does not impact session or transaction completeness.",
                  failureIndicator: "Local filesystem storage or global arrays used to tracks active user transaction states",
                  remediation: "Migrate global state variables to shared cache (Redis) or database tables."
                }
              ],
              outputConstraints: null,
              guardrails: null,
              scaffolding: null,
              crossReferences: null
            }
          ]
        },
        toolOverrides: []
      },
      {
        id: "scale.serverless",
        label: "Serverless",
        children: [],
        triggers: {
          words: [
            {
              word: "lambda",
              weight: 0.85
            },
            {
              word: "serverless",
              weight: 0.85
            },
            {
              word: "cold-start",
              weight: 0.85
            }
          ],
          phrases: [
            {
              phrase: "aws lambda",
              weight: 0.95
            }
          ],
          antiWords: [],
          importPatterns: [],
          filePatterns: [
            "**/serverless*",
            "**/*serverless*"
          ],
          symbolPatterns: []
        },
        fragments: {
          chat: null,
          planning: null,
          taskCreation: null,
          investigation: null,
          verification: null,
          execution: [
            {
              id: "scale-serverless",
              summary: "Cold Starts",
              weight: "principle",
              trigger: "always",
              defersToCodebase: true,
              coreGuidance: "Minimize dependencies and avoid heavy initialization code in the global scope to reduce cold start times.",
              decisionTree: null,
              codePatterns: null,
              commonMistakes: null,
              selfVerification: null,
              outputConstraints: null,
              guardrails: null,
              scaffolding: null,
              crossReferences: null
            }
          ]
        },
        toolOverrides: []
      }
    ],
    triggers: {
      words: [],
      phrases: [],
      antiWords: [],
      importPatterns: [],
      filePatterns: [],
      symbolPatterns: []
    },
    fragments: {
      chat: null,
      planning: null,
      taskCreation: null,
      investigation: null,
      execution: null,
      verification: null
    },
    toolOverrides: []
  },
  concurrency: {
    id: "concurrency",
    label: "Concurrency Axis Root",
    children: [
      {
        id: "concurrency.async-await",
        label: "Async/Await",
        children: [],
        triggers: {
          words: [
            {
              word: "async",
              weight: 0.85
            },
            {
              word: "await",
              weight: 0.85
            },
            {
              word: "promise",
              weight: 0.85
            }
          ],
          phrases: [
            {
              phrase: "promise all",
              weight: 0.95
            }
          ],
          antiWords: [],
          importPatterns: [],
          filePatterns: [
            "**/async-await*",
            "**/*async-await*"
          ],
          symbolPatterns: []
        },
        fragments: {
          chat: null,
          planning: null,
          taskCreation: null,
          investigation: null,
          verification: null,
          execution: [
            {
              id: "async-errors",
              summary: "Unhandled Rejections",
              weight: "principle",
              trigger: "always",
              defersToCodebase: true,
              coreGuidance: "Always wrap `await` calls in try/catch or use `.catch()` on promises. Never leave unhandled rejections.",
              decisionTree: null,
              codePatterns: null,
              commonMistakes: null,
              selfVerification: null,
              outputConstraints: null,
              guardrails: null,
              scaffolding: null,
              crossReferences: null
            }
          ]
        },
        toolOverrides: []
      },
      {
        id: "concurrency.multi-threaded",
        label: "Multi-threaded",
        children: [],
        triggers: {
          words: [
            {
              word: "worker",
              weight: 0.85
            },
            {
              word: "thread",
              weight: 0.85
            },
            {
              word: "pool",
              weight: 0.85
            },
            {
              word: "mutex",
              weight: 0.85
            },
            {
              word: "lock",
              weight: 0.85
            }
          ],
          phrases: [
            {
              phrase: "worker thread",
              weight: 0.95
            }
          ],
          antiWords: [],
          importPatterns: [
            "from 'worker_threads'",
            "require('worker_threads')"
          ],
          filePatterns: [
            "**/multi-threaded*",
            "**/*multi-threaded*"
          ],
          symbolPatterns: [
            "worker",
            "sharedarraybuffer"
          ]
        },
        fragments: {
          chat: null,
          planning: null,
          taskCreation: null,
          investigation: null,
          verification: null,
          execution: [
            {
              id: "thread-safety",
              summary: "Thread Safety",
              weight: "critical",
              trigger: "always",
              defersToCodebase: true,
              coreGuidance: "Use `Atomics` when interacting with `SharedArrayBuffer` to prevent race conditions across worker threads.",
              decisionTree: null,
              codePatterns: [
                {
                  concern: "Non-atomic shared array mutations",
                  wrong: {
                    language: "typescript",
                    code: "const sharedArray = new Int32Array(sharedBuffer);\nsharedArray[0]++;",
                    explanation: "Increments shared memory non-atomically, leading to lost updates under multi-threaded races."
                  },
                  correct: {
                    language: "typescript",
                    code: "const sharedArray = new Int32Array(sharedBuffer);\nAtomics.add(sharedArray, 0, 1);",
                    explanation: "Uses Atomics.add to perform thread-safe, atomic updates in shared memory."
                  },
                  detectionHint: "Direct array index assignments on SharedArrayBuffer views"
                },
                {
                  concern: "Java multi-threaded synchronization",
                  wrong: {
                    language: "java",
                    code: "public class Counter {\n    private int count = 0;\n    public void increment() { count++; }\n}",
                    explanation: "The count++ operation is not atomic and causes race conditions across threads."
                  },
                  correct: {
                    language: "java",
                    code: "import java.util.concurrent.atomic.AtomicInteger;\npublic class Counter {\n    private final AtomicInteger count = new AtomicInteger(0);\n    public void increment() { count.incrementAndGet(); }\n}",
                    explanation: "AtomicInteger uses lock-free hardware instructions (CAS) to perform thread-safe increments."
                  },
                  detectionHint: "Non-synchronized variables modified across threads"
                },
                {
                  concern: "C++ thread synchronization",
                  wrong: {
                    language: "cpp",
                    code: "int counter = 0;\nvoid worker() {\n    for (int i = 0; i < 1000; ++i) {\n        counter++;\n    }\n}",
                    explanation: "Unsynchronized concurrent modifications on a global variable trigger undefined behavior."
                  },
                  correct: {
                    language: "cpp",
                    code: "#include <atomic>\nstd::atomic<int> counter(0);\nvoid worker() {\n    for (int i = 0; i < 1000; ++i) {\n        counter++;\n    }\n}",
                    explanation: "std::atomic wrappers execute safe atomic operations that compile to hardware lock instructions."
                  },
                  detectionHint: "Global variable updates in thread loops without mutex or std::atomic"
                }
              ],
              commonMistakes: null,
              selfVerification: null,
              outputConstraints: null,
              guardrails: null,
              scaffolding: null,
              crossReferences: null
            }
          ]
        },
        toolOverrides: []
      }
    ],
    triggers: {
      words: [],
      phrases: [],
      antiWords: [],
      importPatterns: [],
      filePatterns: [],
      symbolPatterns: []
    },
    fragments: {
      chat: null,
      planning: null,
      taskCreation: null,
      investigation: null,
      execution: null,
      verification: null
    },
    toolOverrides: []
  },
  lifecycle: {
    id: "lifecycle",
    label: "Lifecycle Stage Axis Root",
    children: [
      {
        id: "lifecycle.bug-fix",
        label: "Bug Fixing",
        children: [],
        triggers: {
          words: [
            {
              word: "bug",
              weight: 0.85
            },
            {
              word: "fix",
              weight: 0.85
            },
            {
              word: "issue",
              weight: 0.85
            },
            {
              word: "patch",
              weight: 0.85
            },
            {
              word: "hotfix",
              weight: 0.85
            }
          ],
          phrases: [
            {
              phrase: "fix bug",
              weight: 0.95
            },
            {
              phrase: "resolve issue",
              weight: 0.95
            }
          ],
          antiWords: [],
          importPatterns: [],
          filePatterns: [
            "**/bug-fix*",
            "**/*bug-fix*"
          ],
          symbolPatterns: []
        },
        fragments: {
          chat: null,
          taskCreation: null,
          investigation: null,
          verification: null,
          planning: [
            {
              id: "bug-rca",
              summary: "Root Cause Analysis",
              weight: "principle",
              trigger: "always",
              defersToCodebase: true,
              coreGuidance: "Identify the root cause, not just the symptom. Write a regression test BEFORE applying the fix to ensure it remains fixed.",
              decisionTree: null,
              codePatterns: null,
              commonMistakes: null,
              selfVerification: null,
              outputConstraints: null,
              guardrails: null,
              scaffolding: null,
              crossReferences: null
            }
          ],
          execution: [
            {
              id: "bug-blast-radius",
              summary: "Minimal Blast Radius",
              weight: "principle",
              trigger: "always",
              defersToCodebase: true,
              coreGuidance: "Keep code changes strictly isolated to the bug. Do not mix refactoring with bug fixes to minimize risk.",
              decisionTree: null,
              codePatterns: null,
              commonMistakes: null,
              selfVerification: null,
              outputConstraints: null,
              guardrails: null,
              scaffolding: null,
              crossReferences: null
            }
          ]
        },
        toolOverrides: []
      },
      {
        id: "lifecycle.feature-addition",
        label: "Feature Addition",
        children: [],
        triggers: {
          words: [
            {
              word: "feature",
              weight: 0.85
            },
            {
              word: "feat",
              weight: 0.85
            },
            {
              word: "add",
              weight: 0.85
            },
            {
              word: "implement",
              weight: 0.85
            }
          ],
          phrases: [
            {
              phrase: "new feature",
              weight: 0.95
            }
          ],
          antiWords: [],
          importPatterns: [],
          filePatterns: [
            "**/feature-addition*",
            "**/*feature-addition*"
          ],
          symbolPatterns: []
        },
        fragments: {
          chat: null,
          taskCreation: null,
          investigation: null,
          verification: null,
          planning: [
            {
              id: "feat-compat",
              summary: "Backwards Compatibility",
              weight: "principle",
              trigger: "always",
              defersToCodebase: true,
              coreGuidance: "Ensure new features do not break existing API contracts or require immediate client upgrades. Use feature flags if rolling out incrementally.",
              decisionTree: null,
              codePatterns: null,
              commonMistakes: null,
              selfVerification: null,
              outputConstraints: null,
              guardrails: null,
              scaffolding: null,
              crossReferences: null
            }
          ],
          execution: null
        },
        toolOverrides: []
      },
      {
        id: "lifecycle.refactoring",
        label: "Refactoring",
        children: [],
        triggers: {
          words: [
            {
              word: "refactor",
              weight: 0.85
            },
            {
              word: "cleanup",
              weight: 0.85
            },
            {
              word: "technical-debt",
              weight: 0.85
            }
          ],
          phrases: [
            {
              phrase: "refactor code",
              weight: 0.95
            }
          ],
          antiWords: [],
          importPatterns: [],
          filePatterns: [
            "**/refactoring*",
            "**/*refactoring*"
          ],
          symbolPatterns: []
        },
        fragments: {
          chat: null,
          taskCreation: null,
          investigation: null,
          verification: null,
          planning: [
            {
              id: "refactor-test",
              summary: "Test-First Refactoring",
              weight: "principle",
              trigger: "always",
              defersToCodebase: true,
              coreGuidance: "Ensure a solid test harness exists covering the current behavior before changing internal structures.",
              decisionTree: null,
              codePatterns: null,
              commonMistakes: null,
              selfVerification: null,
              outputConstraints: null,
              guardrails: null,
              scaffolding: null,
              crossReferences: null
            }
          ],
          execution: [
            {
              id: "refactor-behavior",
              summary: "Preserve Behavior",
              weight: "principle",
              trigger: "always",
              defersToCodebase: true,
              coreGuidance: "Do not alter the public API or observable behavior of the module being refactored.",
              decisionTree: null,
              codePatterns: null,
              commonMistakes: null,
              selfVerification: null,
              outputConstraints: null,
              guardrails: null,
              scaffolding: null,
              crossReferences: null
            }
          ]
        },
        toolOverrides: []
      }
    ],
    triggers: {
      words: [],
      phrases: [],
      antiWords: [],
      importPatterns: [],
      filePatterns: [],
      symbolPatterns: []
    },
    fragments: {
      chat: null,
      planning: null,
      taskCreation: null,
      investigation: null,
      execution: null,
      verification: null
    },
    toolOverrides: []
  }
};

// electron/services/taxonomy/crossAxisRules.json
var crossAxisRules_default = {
  rules: [
    {
      axis1: "domain",
      axis1Path: "backend.database.relational.postgresql",
      axis2: "scale",
      axis2Path: "single-user.local-desktop",
      resolution: "Prefer local SQLite connection patterns if suitable; if PostgreSQL is requested, disable heavy connection pooling sizes or distributed setups. Enforce local single-client mode.",
      intersectionGuidance: "Local PostgreSQL execution: Keep pool size small (max: 2-5 connections). Avoid configuring distributed replication, master-replica routing, or horizontal scaling parameters."
    },
    {
      axis1: "domain",
      axis1Path: "backend.database.relational.postgresql",
      axis2: "paradigm",
      axis2Path: "functional",
      resolution: "Use database connection parameters passed as function arguments. Avoid mutating global objects or relying on class-scoped connections.",
      intersectionGuidance: "Functional Database Pattern: Maintain pure functions. Pass query clients (PoolClient or Transaction) explicitly as the first argument to database functions."
    },
    {
      axis1: "domain",
      axis1Path: "backend.database.relational.sqlite",
      axis2: "concurrency",
      axis2Path: "async-await",
      resolution: "Configure SQLite in WAL mode and use an appropriate busy_timeout (e.g. 5000ms) to prevent lock blocking on concurrent async writes.",
      intersectionGuidance: "SQLite Concurrency: Enable WAL mode (`db.pragma('journal_mode = WAL')`) and set busy_timeout to 5000ms. Handle transaction retries if SQLITE_BUSY occurs."
    },
    {
      axis1: "domain",
      axis1Path: "backend.database.keyvalue.redis",
      axis2: "concurrency",
      axis2Path: "async-await",
      resolution: "Use atomic Redis transactions (MULTI/EXEC) or Lua scripting (EVAL) to prevent race conditions during concurrent read-modify-write cache operations.",
      intersectionGuidance: "Redis Concurrency: Wrap multi-step key operations in MULTI/EXEC or deploy an atomic Lua script to run checks and mutations on the Redis server in a single thread-safe step."
    },
    {
      axis1: "domain",
      axis1Path: "backend.database.relational.postgresql",
      axis2: "scale",
      axis2Path: "production",
      resolution: "Configure pgbouncer or connection pooling dynamically. Set statement_timeout and lock_timeout to prevent query pileups.",
      intersectionGuidance: "Production PostgreSQL: Set connection pool size strictly. Implement lock_timeout (e.g., `SET lock_timeout = '3s'`) on transaction runs to prevent lock cascades on high-traffic tables."
    },
    {
      axis1: "domain",
      axis1Path: "backend.database.search.opensearch",
      axis2: "scale",
      axis2Path: "production",
      resolution: "Buffer search documents and execute updates in bulk. Configure circuit breakers and index refresh intervals for high write throughput.",
      intersectionGuidance: "Production OpenSearch: Batch search indexing requests into bulk (_bulk) API transactions. Set refresh_interval to 30s or longer to reduce IO contention under heavy loads."
    },
    {
      axis1: "domain",
      axis1Path: "backend.database.keyvalue.dynamodb",
      axis2: "scale",
      axis2Path: "production",
      resolution: "Mitigate hot partition keys. Use composite partition keys or pre-sharded suffixes if writes exceed 1000 WCU per key.",
      intersectionGuidance: "Production DynamoDB: Distribute writes evenly. If a partition key handles hot traffic (such as tenant or daily stats), append a random hash suffix (e.g. USER_123#2) to distribute data across physical storage nodes."
    },
    {
      axis1: "domain",
      axis1Path: "backend.database.columnar.clickhouse",
      axis2: "concurrency",
      axis2Path: "async-await",
      resolution: "Aggregate concurrent inserts into a single batch write. Avoid triggering concurrent inserts of individual rows to prevent clickhouse parts limits exhaustion.",
      intersectionGuidance: "ClickHouse Concurrency: Implement an in-memory buffer queue. Collect rows from concurrent async processes and flush them in batches of 10,000+ records to avoid exhausting merge parts."
    }
  ]
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
      this.taxonomyTree = taxonomyTree_default;
      this.crossAxisRules = crossAxisRules_default.rules || [];
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

// tests/unit/taxonomy/runTests.ts
function assert(condition, message) {
  if (!condition) {
    console.error(`\u274C Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`\u2705 ${message}`);
}
async function run() {
  console.log("--- STARTING TAXONOMY ENGINE TESTS ---");
  const currentDir = path3.dirname(fileURLToPath(import.meta.url));
  const srcDir = path3.resolve(currentDir, "../../../electron/services/taxonomy");
  for (const file of ["taxonomyTree.json", "crossAxisRules.json"]) {
    const srcFile = path3.join(srcDir, file);
    const destFile = path3.join(currentDir, file);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, destFile);
    } else {
      console.warn(`\u26A0\uFE0F Warning: Source taxonomy JSON file not found at ${srcFile}`);
    }
  }
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
  const pythonTask = {
    title: "Implement user authentication with rest api in python",
    description: "Write auth handlers for fastapi web framework"
  };
  const pythonPlan = {
    steps: ["Setup FastAPI app", "Add routes"],
    filesToModify: ["main.py"]
  };
  const pythonResult = taxonomyService.classify(
    pythonTask,
    "execution",
    pythonPlan,
    "FastAPI app dev.",
    { "main.py": "from fastapi import FastAPI\napp = FastAPI()" }
  );
  console.log("Python classification domain path:", pythonResult.classification.domain ? pythonResult.classification.domain.nodeIds.join(" -> ") : "null");
  console.log("Python classification confidence:", pythonResult.classification.domain ? pythonResult.classification.domain.confidence : 0);
  const pythonGuidance = pythonResult.resolvedSlots.get("domain_guidance");
  console.log("--- Python Guidance Start ---");
  console.log(pythonGuidance);
  console.log("--- Python Guidance End ---");
  assert(!!pythonGuidance, "domain_guidance slot should be populated for Python REST task");
  assert(pythonGuidance.includes("def increment_item(item_id: str):") || pythonGuidance.includes("def update_item(item_id: str, delta: int):"), "Guidance should include Python-specific code patterns");
  assert(!pythonGuidance.includes('app.get("/users/:id/activate", async (req, res) =>'), "Guidance should NOT include TS/JS code patterns when Python is detected");
  console.log("\u2705 Language-sensitive code pattern filtering (Python) validated successfully.");
  const rustTask = {
    title: "Setup websocket client connection in backend API using rust",
    description: "use tokio-tungstenite for websocket connection"
  };
  const rustPlan = {
    steps: ["Connect socket", "Listen"],
    filesToModify: ["src/main.rs"]
  };
  const rustResult = taxonomyService.classify(
    rustTask,
    "execution",
    rustPlan,
    "Rust socket dev.",
    { "src/main.rs": "use std::net::TcpStream;\nfn main() {}" }
  );
  const rustGuidance = rustResult.resolvedSlots.get("domain_guidance");
  assert(!!rustGuidance, "domain_guidance slot should be populated for Rust WS task");
  assert(rustGuidance.includes("async fn handle_socket(mut socket: WebSocket)"), "Guidance should include Rust-specific code patterns");
  assert(!rustGuidance.includes('wss.on("connection", (ws) =>'), "Guidance should NOT include TS/JS code patterns when Rust is detected");
  console.log("\u2705 Language-sensitive code pattern filtering (Rust) validated successfully.");
  const contextualizedGuidance = pythonResult.resolvedSlots.get("domain_guidance");
  assert(contextualizedGuidance.includes("This task touches file(s): **main.py**"), "Guidance should include dynamic contextual note with filenames");
  console.log("\u2705 Dynamic Contextualization Header validated successfully.");
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
