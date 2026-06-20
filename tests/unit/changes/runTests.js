var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// tests/unit/taxonomy/electron-mock.js
var safeStorage, app;
var init_electron_mock = __esm({
  "tests/unit/taxonomy/electron-mock.js"() {
    "use strict";
    safeStorage = {
      isEncryptionAvailable: () => false,
      encryptString: (s) => s,
      decryptString: (s) => s
    };
    app = {
      getPath: (name) => "."
    };
  }
});

// tests/unit/taxonomy/electron-store-mock.js
var ElectronStore;
var init_electron_store_mock = __esm({
  "tests/unit/taxonomy/electron-store-mock.js"() {
    "use strict";
    ElectronStore = class {
      constructor() {
        this.data = {};
      }
      get(key) {
        return this.data[key] !== void 0 ? this.data[key] : null;
      }
      set(key, val) {
        this.data[key] = val;
      }
      delete(key) {
        delete this.data[key];
      }
    };
  }
});

// electron/secureStore.ts
import console3 from "console";
function encryptValue(value) {
  console3.assert(typeof value === "string", "Value to encrypt must be a string");
  if (!safeStorage.isEncryptionAvailable()) {
    console3.warn("[SecureStore] Encryption not available, storing as-is");
    return value;
  }
  const buffer = safeStorage.encryptString(value);
  return buffer.toString("base64");
}
function decryptValue(encrypted) {
  console3.assert(typeof encrypted === "string", "Encrypted value must be a base64 string");
  if (!safeStorage.isEncryptionAvailable()) {
    console3.warn("[SecureStore] Encryption not available, returning as-is");
    return encrypted;
  }
  const buffer = Buffer.from(encrypted, "base64");
  return safeStorage.decryptString(buffer);
}
function checkEncryptionGuard() {
  if (!safeStorage.isEncryptionAvailable()) {
    const isDev = !app.isPackaged || process.env.NODE_ENV === "development";
    if (isDev) {
      throw new Error("[SecureStore] OS-level encryption is not available in development.");
    }
  }
}
var store, secureStore, originalSetApiKey, originalSetGitHubToken, originalSetHuggingFaceToken;
var init_secureStore = __esm({
  "electron/secureStore.ts"() {
    "use strict";
    init_electron_mock();
    init_electron_store_mock();
    store = new ElectronStore({
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
    secureStore = {
      // Key-specific Setters & Getters
      setApiKey(providerId, key) {
        console3.assert(typeof providerId === "string", "providerId must be a string");
        store.set(`${providerId}ApiKey_encrypted`, encryptValue(key));
      },
      getApiKey(providerId) {
        console3.assert(typeof providerId === "string", "providerId must be a string");
        const encrypted = store.get(`${providerId}ApiKey_encrypted`);
        if (!encrypted) return void 0;
        try {
          return decryptValue(encrypted);
        } catch (e) {
          console3.error(`[SecureStore] Failed to decrypt key for ${providerId}`, e);
          return void 0;
        }
      },
      deleteApiKey(providerId) {
        console3.assert(typeof providerId === "string", "providerId must be a string");
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
          console3.error("[SecureStore] Failed to decrypt GitHub token", e);
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
          console3.error("[SecureStore] Failed to decrypt Hugging Face token", e);
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
        console3.assert(theme === "light" || theme === "dark", "Theme must be light or dark");
        store.set("theme", theme);
      },
      getFontSize() {
        return store.get("fontSize") || 14;
      },
      setFontSize(size) {
        console3.assert(typeof size === "number" && size > 0, "FontSize must be a valid positive number");
        store.set("fontSize", size);
      },
      getActiveProvider() {
        return store.get("activeProvider") || "openai";
      },
      setActiveProvider(provider) {
        console3.assert(typeof provider === "string", "Active provider must be a string");
        store.set("activeProvider", provider);
      },
      getSelectedModel() {
        return store.get("selectedModel") || "gpt-4o";
      },
      setSelectedModel(model) {
        console3.assert(typeof model === "string", "Selected model must be a string");
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
        console3.assert(typeof prompt === "string", "System prompt must be a string");
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
      setLiteLLMConfigPath(path9) {
        console3.assert(typeof path9 === "string", "Config path must be a string");
        store.set("liteLLMConfigPath", path9);
      },
      getLiteLLMModel() {
        return store.get("liteLLMModel") || "gpt-4o";
      },
      setLiteLLMModel(model) {
        console3.assert(typeof model === "string", "Model must be a string");
        store.set("liteLLMModel", model);
      },
      getLiteLLMPort() {
        return store.get("liteLLMPort") || 4e3;
      },
      setLiteLLMPort(port) {
        console3.assert(typeof port === "number" && port > 0, "Port must be a positive number");
        store.set("liteLLMPort", port);
      },
      // Cloud Credentials getters and setters
      getAwsRegion() {
        return store.get("awsRegion") || "us-east-1";
      },
      setAwsRegion(region) {
        console3.assert(typeof region === "string", "AWS Region must be a string");
        store.set("awsRegion", region);
      },
      getVertexProject() {
        return store.get("vertexProject") || "";
      },
      setVertexProject(project) {
        console3.assert(typeof project === "string", "Vertex Project must be a string");
        store.set("vertexProject", project);
      },
      getVertexLocation() {
        return store.get("vertexLocation") || "us-central1";
      },
      setVertexLocation(location) {
        console3.assert(typeof location === "string", "Vertex Location must be a string");
        store.set("vertexLocation", location);
      },
      getAzureApiBase() {
        return store.get("azureApiBase") || "";
      },
      setAzureApiBase(base) {
        console3.assert(typeof base === "string", "Azure API Base must be a string");
        store.set("azureApiBase", base);
      },
      getAzureApiVersion() {
        return store.get("azureApiVersion") || "2024-02-01";
      },
      setAzureApiVersion(version) {
        console3.assert(typeof version === "string", "Azure API Version must be a string");
        store.set("azureApiVersion", version);
      },
      getWindowBounds() {
        return store.get("windowBounds");
      },
      setWindowBounds(bounds) {
        console3.assert(bounds && typeof bounds.width === "number", "Window bounds must be valid");
        store.set("windowBounds", bounds);
      },
      getActiveWorkspacePath() {
        return store.get("activeWorkspacePath") || "";
      },
      setActiveWorkspacePath(pathStr) {
        console3.assert(typeof pathStr === "string", "Workspace path must be a string");
        store.set("activeWorkspacePath", pathStr);
      },
      getHardwareSpec() {
        return store.get("hardwareSpec");
      },
      setHardwareSpec(spec) {
        console3.assert(spec && typeof spec.timestamp === "number", "Hardware spec must have timestamp");
        store.set("hardwareSpec", spec);
      },
      deleteHardwareSpec() {
        store.delete("hardwareSpec");
      },
      setCustomProviderKey(providerId, key) {
        console3.assert(typeof providerId === "string", "providerId must be a string");
        checkEncryptionGuard();
        store.set(`customProvider_${providerId}_encrypted`, encryptValue(key));
      },
      getCustomProviderKey(providerId) {
        console3.assert(typeof providerId === "string", "providerId must be a string");
        const encrypted = store.get(`customProvider_${providerId}_encrypted`);
        if (!encrypted) return void 0;
        try {
          return decryptValue(encrypted);
        } catch (e) {
          console3.error(`[SecureStore] Failed to decrypt key for custom provider ${providerId}`, e);
          return void 0;
        }
      },
      deleteCustomProviderKey(providerId) {
        console3.assert(typeof providerId === "string", "providerId must be a string");
        store.delete(`customProvider_${providerId}_encrypted`);
      }
    };
    originalSetApiKey = secureStore.setApiKey;
    secureStore.setApiKey = function(providerId, key) {
      checkEncryptionGuard();
      originalSetApiKey.call(secureStore, providerId, key);
    };
    originalSetGitHubToken = secureStore.setGitHubToken;
    secureStore.setGitHubToken = function(token) {
      checkEncryptionGuard();
      originalSetGitHubToken.call(secureStore, token);
    };
    originalSetHuggingFaceToken = secureStore.setHuggingFaceToken;
    secureStore.setHuggingFaceToken = function(token) {
      checkEncryptionGuard();
      originalSetHuggingFaceToken.call(secureStore, token);
    };
  }
});

// electron/db/schema.ts
import path3 from "path";
import { createRequire } from "module";
function createDatabase(dbPath) {
  const resolvedPath = dbPath || path3.join(app.getPath("userData"), "smart-cursor-x.sqlite");
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
    db.prepare("ALTER TABLE custom_models ADD COLUMN context_size INTEGER DEFAULT NULL").run();
  } catch (e) {
    if (!e?.message?.includes("duplicate column")) throw e;
  }
  try {
    db.prepare("ALTER TABLE custom_providers ADD COLUMN is_local INTEGER DEFAULT 0").run();
  } catch (e) {
    if (!e?.message?.includes("duplicate column")) throw e;
  }
  try {
    db.prepare('ALTER TABLE custom_models ADD COLUMN gpu_mode TEXT DEFAULT "auto"').run();
  } catch (e) {
    if (!e?.message?.includes("duplicate column")) throw e;
  }
  try {
    db.prepare("ALTER TABLE custom_models ADD COLUMN gpu_layers INTEGER DEFAULT NULL").run();
  } catch (e) {
    if (!e?.message?.includes("duplicate column")) throw e;
  }
  try {
    db.prepare('ALTER TABLE custom_models ADD COLUMN gpu_target TEXT DEFAULT "auto"').run();
  } catch (e) {
    if (!e?.message?.includes("duplicate column")) throw e;
  }
  try {
    db.prepare("ALTER TABLE custom_models ADD COLUMN tensor_split TEXT DEFAULT NULL").run();
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
  db.prepare(`
        CREATE TABLE IF NOT EXISTS context_cache (
            model_key TEXT PRIMARY KEY,
            context_length INTEGER NOT NULL,
            cached_at INTEGER NOT NULL
        )
    `).run();
  db.prepare(`
        CREATE TABLE IF NOT EXISTS compression_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            model TEXT NOT NULL,
            compressed_at INTEGER NOT NULL,
            tokens_before INTEGER NOT NULL,
            tokens_after INTEGER NOT NULL,
            strategy TEXT NOT NULL,
            details TEXT
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
var require2, Database, sqliteVec;
var init_schema = __esm({
  "electron/db/schema.ts"() {
    "use strict";
    init_electron_mock();
    init_secureStore();
    require2 = createRequire(import.meta.url);
    Database = require2("better-sqlite3");
    sqliteVec = require2("sqlite-vec");
  }
});

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
var init_invariant = __esm({
  "src/helpers/invariant.ts"() {
    "use strict";
  }
});

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
var init_conversations = __esm({
  "electron/db/conversations.ts"() {
    "use strict";
    init_invariant();
  }
});

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
function addCustomModel(db, providerId, modelName, hasThinking = 0, contextSize) {
  checkArgs(typeof providerId === "string" && providerId.length > 0, "Provider ID must be a valid non-empty string");
  checkArgs(typeof modelName === "string" && modelName.length > 0, "Model Name must be a valid non-empty string");
  if (!db) throw new Error("DB not initialized");
  db.prepare("INSERT INTO custom_models (provider_id, model_name, has_thinking, context_size) VALUES (?, ?, ?, ?) ON CONFLICT(provider_id, model_name) DO UPDATE SET has_thinking = excluded.has_thinking, context_size = excluded.context_size").run(providerId, modelName, hasThinking, contextSize ?? null);
}
function updateCustomModelContextSize(db, providerId, modelName, contextSize) {
  checkArgs(typeof providerId === "string" && providerId.length > 0, "Provider ID must be a valid non-empty string");
  checkArgs(typeof modelName === "string" && modelName.length > 0, "Model Name must be a valid non-empty string");
  checkArgs(typeof contextSize === "number" && contextSize > 0, "Context size must be a positive number");
  if (!db) throw new Error("DB not initialized");
  db.prepare("UPDATE custom_models SET context_size = ? WHERE provider_id = ? AND model_name = ?").run(contextSize, providerId, modelName);
}
function updateCustomModelGpuConfig(db, providerId, modelName, gpuMode, gpuLayers, gpuTarget, tensorSplit) {
  checkArgs(typeof providerId === "string" && providerId.length > 0, "Provider ID must be a valid non-empty string");
  checkArgs(typeof modelName === "string" && modelName.length > 0, "Model Name must be a valid non-empty string");
  checkArgs(typeof gpuMode === "string", "GPU mode must be a valid string");
  checkArgs(typeof gpuTarget === "string", "GPU target must be a valid string");
  if (!db) throw new Error("DB not initialized");
  db.prepare("UPDATE custom_models SET gpu_mode = ?, gpu_layers = ?, gpu_target = ?, tensor_split = ? WHERE provider_id = ? AND model_name = ?").run(gpuMode, gpuLayers, gpuTarget, tensorSplit, providerId, modelName);
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
var init_agents = __esm({
  "electron/db/agents.ts"() {
    "use strict";
    init_secureStore();
    init_invariant();
  }
});

// electron/services/CostEstimatorService.ts
var CostEstimatorService;
var init_CostEstimatorService = __esm({
  "electron/services/CostEstimatorService.ts"() {
    "use strict";
    CostEstimatorService = class {
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
        if (provider === "ollama" || provider === "local" || normModel.includes("llama") || normModel.includes("mistral") || normModel.includes("phi")) {
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
  }
});

// electron/db/settings.ts
import { Buffer as Buffer2 } from "node:buffer";
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
var init_settings = __esm({
  "electron/db/settings.ts"() {
    "use strict";
    init_CostEstimatorService();
    init_invariant();
  }
});

// electron/db/contextCache.ts
function getCachedContext(db, modelKey) {
  if (!db) return null;
  try {
    const row = db.prepare("SELECT context_length, cached_at FROM context_cache WHERE model_key = ?").get(modelKey);
    if (!row) return null;
    const age = Date.now() - row.cached_at;
    if (age > CACHE_TTL_MS) {
      db.prepare("DELETE FROM context_cache WHERE model_key = ?").run(modelKey);
      return null;
    }
    return row.context_length;
  } catch {
    return null;
  }
}
function setCachedContext(db, modelKey, contextLength) {
  if (!db) return;
  try {
    db.prepare(`
      INSERT INTO context_cache (model_key, context_length, cached_at)
      VALUES (?, ?, ?)
      ON CONFLICT(model_key) DO UPDATE SET context_length = excluded.context_length, cached_at = excluded.cached_at
    `).run(modelKey, contextLength, Date.now());
  } catch (e) {
    console.warn("[contextCache] Failed to cache context length:", e);
  }
}
function logCompression(db, conversationId, model, tokensBefore, tokensAfter, strategy, details) {
  if (!db) return;
  try {
    db.prepare(`
      INSERT INTO compression_log (conversation_id, model, compressed_at, tokens_before, tokens_after, strategy, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(conversationId, model, Date.now(), tokensBefore, tokensAfter, strategy, details || null);
  } catch (e) {
    console.warn("[contextCache] Failed to log compression:", e);
  }
}
function getCompressionLog(db, conversationId) {
  if (!db) return [];
  try {
    if (conversationId) {
      return db.prepare("SELECT * FROM compression_log WHERE conversation_id = ? ORDER BY compressed_at DESC").all(conversationId);
    }
    return db.prepare("SELECT * FROM compression_log ORDER BY compressed_at DESC LIMIT 50").all();
  } catch {
    return [];
  }
}
var CACHE_TTL_MS;
var init_contextCache = __esm({
  "electron/db/contextCache.ts"() {
    "use strict";
    CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
  }
});

// electron/db/index.ts
var db_exports = {};
__export(db_exports, {
  DatabaseService: () => DatabaseService,
  dbService: () => dbService
});
import path4 from "path";
var DatabaseService, dbService;
var init_db = __esm({
  "electron/db/index.ts"() {
    "use strict";
    init_electron_mock();
    init_schema();
    init_conversations();
    init_agents();
    init_settings();
    init_contextCache();
    DatabaseService = class {
      db = null;
      dbPath;
      constructor() {
        console.log("[DatabaseService] Constructor");
        this.dbPath = path4.join(app.getPath("userData"), "smart-cursor-x.sqlite");
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
      updateCustomModelContextSize(providerId, modelName, contextSize) {
        return updateCustomModelContextSize(this.db, providerId, modelName, contextSize);
      }
      updateCustomModelGpuConfig(providerId, modelName, gpuMode, gpuLayers, gpuTarget, tensorSplit) {
        return updateCustomModelGpuConfig(this.db, providerId, modelName, gpuMode, gpuLayers, gpuTarget, tensorSplit);
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
      // ── Context Cache ──
      getCachedContext(modelKey) {
        return getCachedContext(this.db, modelKey);
      }
      setCachedContext(modelKey, contextLength) {
        return setCachedContext(this.db, modelKey, contextLength);
      }
      logCompression(conversationId, model, tokensBefore, tokensAfter, strategy, details) {
        return logCompression(this.db, conversationId, model, tokensBefore, tokensAfter, strategy, details);
      }
      getCompressionLog(conversationId) {
        return getCompressionLog(this.db, conversationId);
      }
    };
    dbService = new DatabaseService();
  }
});

// tests/unit/changes/runTests.ts
import path8 from "path";
import fs4 from "fs";
import os2 from "os";

// electron/ipcHandlers/changes.ts
import path7 from "path";
import os from "os";
import { createRequire as createRequire2 } from "module";

// electron/services/PendingModificationsService.ts
import * as fs from "fs";
import * as path2 from "path";
import console2 from "console";

// electron/services/SessionChangesTrackerService.ts
import * as path from "path";
var SessionChangesTrackerService = class {
  static accepted = /* @__PURE__ */ new Map();
  static normalizeKey(absPath) {
    let resolved = path.resolve(absPath);
    if (process.platform === "win32") {
      resolved = resolved.toLowerCase();
    }
    return resolved;
  }
  static trackAccepted(absolutePath, originalContent, status = "pending") {
    const key = this.normalizeKey(absolutePath);
    const existing = this.accepted.get(key);
    if (!existing) {
      this.accepted.set(key, {
        originalPath: absolutePath,
        content: originalContent ?? "",
        status
      });
    } else if (status === "pending" && existing.status === "accepted") {
      existing.content = originalContent ?? "";
      existing.status = "pending";
    }
  }
  static getOriginalContent(absolutePath) {
    return this.accepted.get(this.normalizeKey(absolutePath))?.content;
  }
  static getStatus(absolutePath) {
    return this.accepted.get(this.normalizeKey(absolutePath))?.status;
  }
  static accept(absolutePath) {
    const key = this.normalizeKey(absolutePath);
    const entry = this.accepted.get(key);
    if (entry) {
      entry.status = "accepted";
    }
  }
  static getAccepted() {
    return Array.from(this.accepted.values()).map((v) => v.originalPath);
  }
  static untrack(absolutePath) {
    this.accepted.delete(this.normalizeKey(absolutePath));
  }
  static clear() {
    this.accepted.clear();
  }
};

// electron/services/PendingModificationsService.ts
var PendingModificationsService = class {
  static pending = /* @__PURE__ */ new Map();
  static pendingResolvers = /* @__PURE__ */ new Map();
  static setPending(taskId, mods) {
    this.pending.set(taskId, mods);
  }
  static getPending(taskId) {
    return this.pending.get(taskId);
  }
  static getAllPending() {
    return new Map(this.pending);
  }
  static hasPending() {
    return this.pending.size > 0;
  }
  static getTaskIdForResolver(resolve4) {
    for (const [taskId, resolver] of this.pendingResolvers) {
      if (resolver === resolve4) return taskId;
    }
    return null;
  }
  static setResolver(taskId, resolve4) {
    this.pendingResolvers.set(taskId, resolve4);
  }
  static removePending(taskId) {
    this.pending.delete(taskId);
    this.pendingResolvers.delete(taskId);
  }
  static applySingleFile(modification) {
    try {
      const parentDir = path2.dirname(modification.absolutePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(modification.absolutePath, modification.proposedContent, "utf-8");
      SessionChangesTrackerService.trackAccepted(modification.absolutePath, modification.originalContent, "accepted");
      console2.log(`[PendingModificationsService] Applied single file: ${modification.relativePath}`);
      return true;
    } catch (err) {
      console2.error(`[PendingModificationsService] Failed to apply file: ${modification.relativePath}`, err);
      return false;
    }
  }
  static applyModifications(taskId) {
    const mods = this.pending.get(taskId);
    if (!mods) {
      console2.error(`[PendingModificationsService] No pending modifications for task ${taskId}`);
      return false;
    }
    let allApplied = true;
    for (const mod of mods.modifications) {
      const success = this.applySingleFile(mod);
      if (!success) allApplied = false;
    }
    console2.log(`[PendingModificationsService] Applied all modifications for task ${taskId}, all succeeded: ${allApplied}`);
    return allApplied;
  }
  static resolvePending(taskId, accepted) {
    const resolver = this.pendingResolvers.get(taskId);
    if (resolver) {
      this.pendingResolvers.delete(taskId);
      resolver(accepted);
    }
  }
  static clear() {
    this.pending.clear();
    this.pendingResolvers.clear();
  }
};

// electron/services/SnapshotService.ts
init_db();
import * as fs2 from "fs";
import * as path6 from "path";
import * as crypto from "crypto";

// electron/services/PathGuard.ts
import * as path5 from "path";
var PathGuard = class {
  static workspacePath = null;
  static extraRoots = [];
  static configure(workspacePath) {
    this.workspacePath = path5.resolve(workspacePath);
    this.extraRoots = [];
  }
  static getWorkspacePath() {
    return this.workspacePath;
  }
  static registerRoot(root) {
    this.extraRoots.push(path5.resolve(root));
  }
  static resolve(relativePath) {
    if (!this.workspacePath) return null;
    const roots = [this.workspacePath, ...this.extraRoots];
    for (const root of roots) {
      const resolvedPath = path5.isAbsolute(relativePath) ? relativePath : path5.resolve(root, relativePath);
      const normRoot = this.normalize(root);
      const normResolved = this.normalize(resolvedPath);
      const relative2 = path5.relative(normRoot, normResolved);
      const contained = relative2 === "" || relative2 && !relative2.startsWith("..") && !path5.isAbsolute(relative2);
      if (contained) {
        return resolvedPath;
      }
    }
    return null;
  }
  static isContained(absolutePath) {
    return this.resolve(absolutePath) !== null;
  }
  static setWorkspacePath(workspacePath) {
    this.configure(workspacePath);
  }
  static normalize(p) {
    let resolved = path5.resolve(p);
    if (process.platform === "win32") {
      resolved = resolved.toLowerCase();
    }
    return resolved;
  }
};

// electron/services/SnapshotService.ts
import console4 from "console";
var SnapshotService = class {
  /**
   * Captures a full snapshot of the specified files across allowed roots and saves them to the DB as version control blobs.
   */
  static captureSnapshot(taskId, filePaths, name) {
    console4.assert(typeof taskId === "number", "taskId must be a valid number");
    console4.assert(Array.isArray(filePaths), "filePaths must be an array of strings");
    console4.assert(typeof name === "string" && name.length > 0, "name must be a valid non-empty string");
    console4.log(`[SnapshotService] Capturing snapshot "${name}" for task ID ${taskId}...`);
    const snapshotIdRaw = dbService.createSnapshot(`${name}_task_${taskId}`);
    const snapshotId = Number(snapshotIdRaw);
    console4.assert(snapshotId > 0, "Snapshot ID must be a positive integer");
    for (const file of filePaths) {
      const absolutePath = PathGuard.resolve(file);
      if (absolutePath && fs2.existsSync(absolutePath)) {
        try {
          const content = fs2.readFileSync(absolutePath, "utf-8");
          const hash = crypto.createHash("sha256").update(content).digest("hex");
          dbService.addBlob(hash, content);
          dbService.addSnapshotFile(snapshotId, absolutePath, hash);
          console4.log(`[SnapshotService] Snapshotted file: ${file} (resolved: ${absolutePath}, hash: ${hash.substring(0, 8)})`);
        } catch (err) {
          console4.error(`[SnapshotService] Failed snapshotting file ${file}:`, err);
        }
      } else {
        console4.warn(`[SnapshotService] Target file ${file} does not exist or is out of bounds. Skipping blob generation.`);
      }
    }
    return snapshotId;
  }
  /**
   * Restores the workspace files precisely back to the captured state of a given snapshot ID, strictly enforcing allowed root containment boundaries.
   */
  static rollbackToSnapshot(snapshotId) {
    console4.assert(typeof snapshotId === "number" && snapshotId > 0, "snapshotId must be a positive number");
    console4.log(`[SnapshotService] Performing safe rollback to snapshot ID ${snapshotId}...`);
    const files = dbService.getSnapshotFiles(snapshotId);
    if (!files || files.length === 0) {
      console4.warn(`[SnapshotService] Snapshot ID ${snapshotId} has no files archived. Rollback aborted.`);
      return;
    }
    for (const f of files) {
      const absolutePath = f.file_path;
      const content = f.content;
      const resolvedPath = PathGuard.resolve(absolutePath);
      if (!resolvedPath) {
        console4.error(`[SnapshotService] Safety Block: Out-of-bounds rollback attempt rejected for path: ${absolutePath}`);
        throw new Error(`Rollback safety violation on path: ${absolutePath}`);
      }
      try {
        const parentDir = path6.dirname(resolvedPath);
        if (!fs2.existsSync(parentDir)) {
          fs2.mkdirSync(parentDir, { recursive: true });
        }
        fs2.writeFileSync(resolvedPath, content, "utf-8");
        console4.log(`[SnapshotService] Restored file: ${resolvedPath}`);
      } catch (err) {
        console4.error(`[SnapshotService] Failed restoring file ${resolvedPath} during rollback:`, err);
        throw new Error(`Rollback failed on file ${resolvedPath}: ${err}`);
      }
    }
    console4.log("[SnapshotService] Rollback completed successfully.");
  }
  /**
   * Retrieves a snapshot ID by its name pattern.
   */
  static getSnapshotIdByName(name) {
    try {
      const snapshots = dbService.getSnapshots();
      const match = snapshots.find((s) => s.name === name || s.name.includes(name));
      return match ? Number(match.id) : null;
    } catch (err) {
      console4.error("[SnapshotService] Failed to find snapshot by name:", err);
      return null;
    }
  }
  /**
   * Restores a single file from a snapshot (used when user rejects individual file changes).
   */
  static rollbackSingleFile(snapshotId, filePath) {
    console4.assert(typeof snapshotId === "number" && snapshotId > 0, "snapshotId must be a positive number");
    console4.assert(typeof filePath === "string" && filePath.length > 0, "filePath must be a non-empty string");
    console4.log(`[SnapshotService] Rolling back single file: ${filePath} from snapshot ID ${snapshotId}...`);
    const files = dbService.getSnapshotFiles(snapshotId);
    if (!files || files.length === 0) {
      console4.warn(`[SnapshotService] Snapshot ID ${snapshotId} has no files archived. Single rollback aborted.`);
      return;
    }
    const normalize = (p) => {
      let r = path6.resolve(p);
      if (process.platform === "win32") r = r.toLowerCase();
      return r;
    };
    const f = files.find((file) => {
      return normalize(file.file_path) === normalize(filePath);
    });
    if (!f) {
      console4.warn(`[SnapshotService] File ${filePath} not found in snapshot ID ${snapshotId}. Cannot rollback single file.`);
      return;
    }
    const resolvedPath = PathGuard.resolve(f.file_path);
    if (!resolvedPath) {
      console4.error(`[SnapshotService] Safety Block: Out-of-bounds rollback attempt rejected for path: ${f.file_path}`);
      throw new Error(`Rollback safety violation on path: ${f.file_path}`);
    }
    try {
      const parentDir = path6.dirname(resolvedPath);
      if (!fs2.existsSync(parentDir)) {
        fs2.mkdirSync(parentDir, { recursive: true });
      }
      fs2.writeFileSync(resolvedPath, f.content, "utf-8");
      console4.log(`[SnapshotService] Restored single file: ${resolvedPath}`);
    } catch (err) {
      console4.error(`[SnapshotService] Failed restoring file ${resolvedPath} during single rollback:`, err);
      throw new Error(`Single rollback failed on file ${resolvedPath}: ${err}`);
    }
  }
};

// electron/ipcHandlers/changes.ts
init_secureStore();
var require3 = createRequire2(import.meta.url);
var fs3 = require3("fs").promises;
var { execFile } = require3("child_process");
var execGitSafe = (args, cwd) => {
  return new Promise((resolve4, reject) => {
    execFile("git", args, { cwd, maxBuffer: 1024 * 1024 * 10 }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve4(stdout.trim());
    });
  });
};
var normalizePath = (p) => {
  let resolved = path7.resolve(p);
  if (process.platform === "win32") {
    resolved = resolved.toLowerCase();
  }
  return resolved;
};
async function getWorkspaceRoot(rootPath) {
  if (rootPath && rootPath !== ".") return rootPath;
  const activePath = secureStore.getActiveWorkspacePath();
  if (activePath) return activePath;
  return process.cwd();
}
async function isGitRepo(cwd) {
  const normalized = normalizePath(cwd);
  const tmpDir = normalizePath(os.tmpdir());
  if (normalized === tmpDir || normalized.startsWith(tmpDir + path7.sep)) {
    return false;
  }
  try {
    const gitPath = path7.join(cwd, ".git");
    const stat = await fs3.stat(gitPath);
    return stat.isDirectory() || stat.isFile();
  } catch {
    return false;
  }
}
async function countFileLines(absolutePath) {
  try {
    const content = await fs3.readFile(absolutePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}
async function getGitStats(cwd) {
  const statsMap = /* @__PURE__ */ new Map();
  try {
    const unstagedStats = await execGitSafe(["diff", "--numstat"], cwd);
    for (const line of unstagedStats.split("\n").filter(Boolean)) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const [addedStr, removedStr, file] = parts;
        const added = parseInt(addedStr, 10) || 0;
        const removed = parseInt(removedStr, 10) || 0;
        statsMap.set(file, { added, removed });
      }
    }
    const stagedStats = await execGitSafe(["diff", "--cached", "--numstat"], cwd);
    for (const line of stagedStats.split("\n").filter(Boolean)) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const [addedStr, removedStr, file] = parts;
        const added = parseInt(addedStr, 10) || 0;
        const removed = parseInt(removedStr, 10) || 0;
        const existing = statsMap.get(file);
        if (existing) {
          statsMap.set(file, { added: existing.added + added, removed: existing.removed + removed });
        } else {
          statsMap.set(file, { added, removed });
        }
      }
    }
  } catch (e) {
    console.error("[ChangesHandler] Failed to get git stats:", e);
  }
  return statsMap;
}
async function getGitFileList(cwd, type) {
  try {
    const status = await execGitSafe(["status", "--porcelain"], cwd);
    const results = [];
    const statsMap = await getGitStats(cwd);
    for (const line of status.split("\n").filter(Boolean)) {
      if (line.length < 4) continue;
      const x = line.substring(0, 1);
      const y = line.substring(1, 2);
      const file = line.substring(3);
      const absolutePath = path7.resolve(cwd, file);
      const isUntracked = x === "?" || y === "?";
      const isStaged = x !== " " && x !== "?";
      let statusVal = "git-modified";
      if (isStaged) {
        statusVal = "accepted";
      } else if (isUntracked) {
        statusVal = "git-untracked";
      } else {
        statusVal = "git-modified";
      }
      if (type === "accepted" && statusVal !== "accepted") {
        continue;
      }
      let addedLines = 0;
      let removedLines = 0;
      if (isUntracked) {
        addedLines = await countFileLines(absolutePath);
      } else {
        const stats = statsMap.get(file);
        if (stats) {
          addedLines = stats.added;
          removedLines = stats.removed;
        }
      }
      results.push({
        relativePath: file,
        absolutePath,
        status: statusVal,
        addedLines,
        removedLines
      });
    }
    return results;
  } catch (e) {
    console.error("[ChangesHandler] getGitFileList error:", e);
    return [];
  }
}
function getPendingFromAllTasks() {
  const allPending = PendingModificationsService.getAllPending();
  const results = [];
  for (const [taskId, taskMods] of allPending) {
    for (const mod of taskMods.modifications) {
      results.push({
        relativePath: mod.relativePath,
        absolutePath: mod.absolutePath,
        status: "pending",
        taskId,
        addedLines: mod.addedLines,
        removedLines: mod.removedLines
      });
    }
  }
  return results;
}
async function getAcceptedChanges(cwd) {
  const accepted = SessionChangesTrackerService.getAccepted();
  const resolved = normalizePath(cwd || await getWorkspaceRoot());
  const results = [];
  for (const absPath of accepted) {
    const normalizedAbs = normalizePath(absPath);
    const relativePath = path7.relative(resolved, normalizedAbs);
    if (relativePath.startsWith("..")) continue;
    let addedLines = 0;
    let removedLines = 0;
    try {
      const original = SessionChangesTrackerService.getOriginalContent(absPath) ?? "";
      let current = null;
      try {
        current = await fs3.readFile(absPath, "utf-8");
      } catch {
        current = null;
      }
      if (current === null) {
        if (original === "") {
          continue;
        } else {
          removedLines = original.split("\n").length;
        }
      } else {
        if (original === current) {
          continue;
        }
        if (original === "") {
          addedLines = current.split("\n").length;
        } else {
          const origLines = original.split("\n");
          const currLines = current.split("\n");
          const maxLen = Math.max(origLines.length, currLines.length);
          for (let i = 0; i < maxLen; i++) {
            if (origLines[i] !== currLines[i]) {
              if (i >= origLines.length) addedLines++;
              else if (i >= currLines.length) removedLines++;
              else {
                addedLines++;
                removedLines++;
              }
            }
          }
        }
      }
    } catch {
    }
    results.push({
      relativePath,
      absolutePath: absPath,
      status: SessionChangesTrackerService.getStatus(absPath) || "accepted",
      addedLines,
      removedLines
    });
  }
  return results;
}
function deduplicateByAbsolutePath(items) {
  const seen = /* @__PURE__ */ new Map();
  const priority = {
    pending: 0,
    "git-modified": 1,
    "git-untracked": 2,
    accepted: 3
  };
  for (const item of items) {
    const key = normalizePath(item.absolutePath);
    const existing = seen.get(key);
    if (!existing || priority[item.status] < priority[existing.status]) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}
function registerChangesHandlers(ipcMain, _context) {
  ipcMain.handle("changes:is-git", async (_event, rootPath) => {
    const cwd = await getWorkspaceRoot(rootPath);
    return isGitRepo(cwd);
  });
  ipcMain.handle("changes:get-list", async (_event, type, rootPath) => {
    const cwd = await getWorkspaceRoot(rootPath);
    const isGit = await isGitRepo(cwd);
    let items = [];
    if (type === "all" || type === "pending") {
      items = items.concat(getPendingFromAllTasks());
      const acceptedChanges = await getAcceptedChanges(cwd);
      items = items.concat(acceptedChanges.filter((c) => c.status === "pending"));
    }
    if (type === "all" || type === "accepted") {
      if (isGit) {
        const gitFiles = await getGitFileList(cwd, type);
        items = items.concat(gitFiles);
      }
      const acceptedChanges = await getAcceptedChanges(cwd);
      items = items.concat(acceptedChanges.filter((c) => c.status === "accepted"));
    }
    return deduplicateByAbsolutePath(items);
  });
  ipcMain.handle("changes:get-file-content", async (_event, relativePath, status, taskId) => {
    const cwd = await getWorkspaceRoot();
    const absolutePath = path7.resolve(cwd, relativePath);
    let originalContent = "";
    let proposedContent = "";
    if (status === "pending" && taskId !== void 0) {
      const pending = PendingModificationsService.getPending(taskId);
      if (pending) {
        const mod = pending.modifications.find((m) => m.relativePath === relativePath);
        if (mod) {
          originalContent = mod.originalContent;
          proposedContent = mod.proposedContent;
          return { originalContent, proposedContent };
        }
      }
    }
    const isGit = await isGitRepo(cwd);
    if (isGit) {
      try {
        const gitPath = relativePath.replace(/\\/g, "/");
        originalContent = await execGitSafe(["show", `HEAD:${gitPath}`], cwd);
      } catch {
        originalContent = "";
      }
    } else {
      try {
        const snapshotName = `pre_execution_${taskId ?? 0}`;
        const snapshotId = SnapshotService.getSnapshotIdByName(snapshotName);
        if (snapshotId !== null) {
          const snapshots = (await Promise.resolve().then(() => (init_db(), db_exports))).dbService.getSnapshotFiles(snapshotId);
          const match = snapshots.find((s) => {
            return normalizePath(s.file_path) === normalizePath(absolutePath);
          });
          if (match) {
            originalContent = match.content;
          }
        }
      } catch {
        originalContent = "";
      }
    }
    if (!originalContent) {
      originalContent = SessionChangesTrackerService.getOriginalContent(absolutePath) ?? "";
    }
    try {
      proposedContent = await fs3.readFile(absolutePath, "utf-8");
    } catch {
      proposedContent = "";
    }
    return { originalContent, proposedContent };
  });
  ipcMain.handle("changes:stage-file", async (_event, relativePath, status, taskId) => {
    const cwd = await getWorkspaceRoot();
    const absolutePath = path7.resolve(cwd, relativePath);
    const isGit = await isGitRepo(cwd);
    if (status === "pending" && taskId !== void 0) {
      const pending = PendingModificationsService.getPending(taskId);
      if (pending) {
        const mod = pending.modifications.find((m) => m.relativePath === relativePath);
        if (mod) {
          await fs3.mkdir(path7.dirname(absolutePath), { recursive: true });
          await fs3.writeFile(absolutePath, mod.proposedContent, "utf-8");
          if (isGit) {
            await execGitSafe(["add", relativePath], cwd);
          } else {
            SessionChangesTrackerService.trackAccepted(absolutePath, mod.originalContent, "accepted");
          }
          pending.modifications = pending.modifications.filter((m) => m.relativePath !== relativePath);
          if (pending.modifications.length === 0) {
            PendingModificationsService.resolvePending(taskId, true);
          }
        }
      }
    } else {
      SessionChangesTrackerService.accept(absolutePath);
      if (isGit) {
        await execGitSafe(["add", relativePath], cwd);
      }
    }
    if (_event && _event.sender) {
      _event.sender.send("changes:updated", { relativePath, action: "stage" });
    }
    return { success: true };
  });
  ipcMain.handle("changes:discard-file", async (_event, relativePath, status, taskId) => {
    const cwd = await getWorkspaceRoot();
    const absolutePath = path7.resolve(cwd, relativePath);
    const isGit = await isGitRepo(cwd);
    if (status === "pending" && taskId !== void 0) {
      const pending = PendingModificationsService.getPending(taskId);
      if (pending) {
        pending.modifications = pending.modifications.filter((m) => m.relativePath !== relativePath);
        if (pending.modifications.length === 0) {
          PendingModificationsService.resolvePending(taskId, false);
        }
      }
    } else if (status === "accepted") {
      const originalContent = SessionChangesTrackerService.getOriginalContent(absolutePath);
      if (originalContent !== void 0) {
        if (originalContent === "") {
          try {
            await fs3.unlink(absolutePath);
          } catch {
          }
        } else {
          await fs3.writeFile(absolutePath, originalContent, "utf-8");
        }
      } else if (isGit) {
        try {
          await execGitSafe(["checkout", "HEAD", "--", relativePath], cwd);
        } catch {
        }
      }
      SessionChangesTrackerService.untrack(absolutePath);
    } else if (isGit) {
      if (status === "git-untracked") {
        try {
          await fs3.unlink(absolutePath);
        } catch {
        }
      } else {
        try {
          await execGitSafe(["checkout", "--", relativePath], cwd);
        } catch {
        }
      }
    } else {
      const snapshotName = `pre_execution_${taskId ?? 0}`;
      const snapshotId = SnapshotService.getSnapshotIdByName(snapshotName);
      if (snapshotId !== null) {
        SnapshotService.rollbackSingleFile(snapshotId, absolutePath);
      }
    }
    if (_event && _event.sender) {
      _event.sender.send("changes:updated", { relativePath, action: "discard" });
    }
    return { success: true };
  });
}

// tests/unit/changes/runTests.ts
init_secureStore();
var passed = 0;
var failed = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`FAIL: ${message} \u2014 expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}
async function run() {
  console.log("--- CHANGES HANDLERS UNIT TESTS ---");
  const handlers = /* @__PURE__ */ new Map();
  const mockIpcMain = {
    handle(channel, handler) {
      handlers.set(channel, handler);
    }
  };
  const mockContext = {};
  registerChangesHandlers(mockIpcMain, mockContext);
  const getListHandler = handlers.get("changes:get-list");
  const getContentHandler = handlers.get("changes:get-file-content");
  const stageHandler = handlers.get("changes:stage-file");
  const discardHandler = handlers.get("changes:discard-file");
  assert(getListHandler !== void 0, "changes:get-list handler registered");
  assert(getContentHandler !== void 0, "changes:get-file-content handler registered");
  assert(stageHandler !== void 0, "changes:stage-file handler registered");
  assert(discardHandler !== void 0, "changes:discard-file handler registered");
  const workspaceRoot = process.cwd();
  secureStore.setActiveWorkspacePath(workspaceRoot);
  PendingModificationsService.clear();
  SessionChangesTrackerService.clear();
  let list = await getListHandler(null, "pending");
  assertEqual(list.length, 0, "getList returns empty array when no changes exist");
  PendingModificationsService.setPending(101, {
    taskId: 101,
    modifications: [
      {
        relativePath: "src/components/TopBar.tsx",
        absolutePath: path8.resolve(workspaceRoot, "src/components/TopBar.tsx"),
        originalContent: "old TopBar content",
        proposedContent: "new TopBar content",
        addedLines: 5,
        removedLines: 2,
        patches: []
      }
    ],
    createdAt: Date.now()
  });
  list = await getListHandler(null, "pending");
  assertEqual(list.length, 1, "getList returns 1 pending AI change");
  assertEqual(list[0].relativePath, "src/components/TopBar.tsx", "correct relativePath returned");
  assertEqual(list[0].status, "pending", "correct status returned");
  assertEqual(list[0].taskId, 101, "correct taskId returned");
  let content = await getContentHandler(null, "src/components/TopBar.tsx", "pending", 101);
  assertEqual(content.originalContent, "old TopBar content", "original content returned correctly");
  assertEqual(content.proposedContent, "new TopBar content", "proposed content returned correctly");
  const tempNonGitWorkspace = os2.tmpdir();
  secureStore.setActiveWorkspacePath(tempNonGitWorkspace);
  const testFileRelative = "changes_test_file.txt";
  const testFileAbsolute = path8.resolve(tempNonGitWorkspace, testFileRelative);
  PendingModificationsService.setPending(103, {
    taskId: 103,
    modifications: [
      {
        relativePath: testFileRelative,
        absolutePath: testFileAbsolute,
        originalContent: "hello",
        proposedContent: "hello world",
        addedLines: 1,
        removedLines: 1,
        patches: []
      }
    ],
    createdAt: Date.now()
  });
  await stageHandler(null, testFileRelative, "pending", 103);
  assertEqual(SessionChangesTrackerService.getAccepted().length, 1, "File tracked in SessionChangesTrackerService in non-Git workspace");
  assertEqual(SessionChangesTrackerService.getAccepted()[0], testFileAbsolute, "correct absolute path tracked");
  try {
    const fileContent = fs4.readFileSync(testFileAbsolute, "utf-8");
    assertEqual(fileContent, "hello world", "Proposed content successfully written to disk");
    fs4.unlinkSync(testFileAbsolute);
  } catch (e) {
    console.error("Failed to read/unlink changes test file:", e);
    failed++;
  }
  console.log(`
--- CHANGES HANDLERS RESULTS: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}
run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
