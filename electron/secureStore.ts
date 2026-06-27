/**
 * SecureStore: Uses Electron's safeStorage API for OS-level encryption.
 * - Windows: Uses DPAPI
 * - macOS: Uses Keychain
 * - Linux: Uses Secret Service API / libsecret
 * Fallback: AES-256-GCM with machine-derived key when safeStorage unavailable.
 */
import { safeStorage } from 'electron';
import Store from 'electron-store';
import console from 'console';
import * as crypto from 'crypto';
import * as os from 'os';

// AES fallback constants
const AES_PREFIX = '$aes$';
const AES_IV_LENGTH = 16;
const AES_KEY_LENGTH = 32; // AES-256
const AES_ITERATIONS = 100_000;
const AES_DIGEST = 'sha256';

let fallbackKey: Buffer | null = null;

function deriveFallbackKey(): Buffer {
    if (fallbackKey) return fallbackKey;

    // Build machine fingerprint from hostname + MAC addresses
    const interfaces = os.networkInterfaces() || {};
    const macs: string[] = [];
    for (const iface of Object.values(interfaces)) {
        if (iface) {
            for (const addr of iface) {
                if (!addr.internal && addr.mac && addr.mac !== '00:00:00:00:00:00') {
                    macs.push(addr.mac);
                }
            }
        }
    }
    macs.sort();
    const fingerprint = `${os.hostname()}|${macs.join('|')}|cursor-replacer-aes-fallback`;
    const salt = crypto.createHash(AES_DIGEST).update(fingerprint).digest();
    fallbackKey = crypto.pbkdf2Sync(fingerprint, salt, AES_ITERATIONS, AES_KEY_LENGTH, AES_DIGEST);
    return fallbackKey;
}

function aesEncrypt(value: string): string {
    const key = deriveFallbackKey();
    const iv = crypto.randomBytes(AES_IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf-8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${AES_PREFIX}${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
}

function aesDecrypt(encoded: string): string {
    const parts = encoded.slice(AES_PREFIX.length).split(':');
    if (parts.length !== 3) throw new Error('Invalid AES encrypted value format');
    const key = deriveFallbackKey();
    const iv = Buffer.from(parts[0], 'base64');
    const encrypted = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf-8');
}

function isAesEncrypted(value: string): boolean {
    return value.startsWith(AES_PREFIX);
}

interface SecureStoreSchema {
    // Encrypted values stored as base64 strings
    openaiApiKey_encrypted?: string;
    anthropicApiKey_encrypted?: string;
    geminiApiKey_encrypted?: string;
    ollamaApiKey_encrypted?: string;
    openrouterApiKey_encrypted?: string;
    githubToken_encrypted?: string;
    huggingfaceToken_encrypted?: string;
    
    // Configurations and settings
    theme?: 'light' | 'dark';
    fontSize?: number;
    activeProvider?: string;
    selectedModel?: string;
    allowFileRead?: boolean;
    autoApproveCommands?: boolean;
    systemPromptOverride?: string;

    // LiteLLM Local Proxy states
    enableLiteLLMProxy?: boolean;
    liteLLMConfigPath?: string;
    liteLLMModel?: string;
    liteLLMPort?: number;

    // Enterprise Cloud Credentials
    awsRegion?: string;
    vertexProject?: string;
    vertexLocation?: string;
    azureApiBase?: string;
    azureApiVersion?: string;
    activeWorkspacePath?: string;
    
    windowBounds?: { width: number; height: number };

    // Pipeline enable/disable toggle
    pipelineEnabled?: boolean;

    // Pipeline config (model routing by task type)
    pipelineConfig?: {
        chat: { provider: string; model: string };
        planning: { provider: string; model: string };
        verification: { provider: string; model: string };
        codeCompletion: { provider: string; model: string };
    };

    // Embedding model config (decoupled from chat model)
    embeddingProvider?: string;
    embeddingModel?: string;
    embeddingBaseUrl?: string;
    embeddingDimension?: number;

    // Hardware detection cache (TTL: 30 days)
    hardwareSpec?: {
        gpuName: string;
        vramGB: number;
        ramGB: number;
        cpuCores: number;
        numGPUs: number;
        isAMD: boolean;
        backendType: string;
        timestamp: number;
    };
}

const store = new Store<SecureStoreSchema>({
    name: 'secure-settings', // Isolate from legacy config.json
    defaults: {
        theme: 'dark',
        fontSize: 14,
        activeProvider: 'openai',
        selectedModel: 'gpt-4o',
        allowFileRead: false,
        autoApproveCommands: false,
        systemPromptOverride: '',
        enableLiteLLMProxy: false,
        liteLLMConfigPath: '',
        liteLLMModel: 'gpt-4o',
        liteLLMPort: 4000,
        awsRegion: 'us-east-1',
        vertexProject: '',
        vertexLocation: 'us-central1',
        azureApiBase: '',
        azureApiVersion: '2024-02-01',
        activeWorkspacePath: '',

        embeddingProvider: 'openai',
        embeddingModel: 'text-embedding-3-small',
        embeddingBaseUrl: '',
        embeddingDimension: 0,
        pipelineEnabled: false
    }
});

/**
 * Encrypt a string using OS-level encryption.
 * Falls back to AES-256-GCM with machine-derived key when safeStorage unavailable.
 */
function encryptValue(value: string): string {
    console.assert(typeof value === 'string', 'Value to encrypt must be a string');
    if (!safeStorage.isEncryptionAvailable()) {
        return aesEncrypt(value);
    }
    const buffer = safeStorage.encryptString(value);
    return buffer.toString('base64');
}

/**
 * Decrypt a base64-encoded or AES-fallback encrypted string.
 * Handles all three formats:
 * - safeStorage base64 (no prefix)
 * - AES fallback ($aes$ prefix)
 * - Legacy plaintext (detected by absence of prefix + failed safeStorage decrypt)
 */
function decryptValue(encrypted: string): string {
    console.assert(typeof encrypted === 'string', 'Encrypted value must be a string');
    if (!encrypted) throw new Error('Empty encrypted value');

    // AES fallback format
    if (isAesEncrypted(encrypted)) {
        return aesDecrypt(encrypted);
    }

    // safeStorage format
    if (safeStorage.isEncryptionAvailable()) {
        const buffer = Buffer.from(encrypted, 'base64');
        return safeStorage.decryptString(buffer);
    }

    // Legacy plaintext (stored before AES fallback was added)
    console.warn('[SecureStore] Decrypting legacy plaintext value — consider re-saving after safeStorage becomes available');
    return encrypted;
}

export const secureStore = {
    // Key-specific Setters & Getters
    setApiKey(providerId: string, key: string): void {
        console.assert(typeof providerId === 'string', 'providerId must be a string');
        store.set(`${providerId}ApiKey_encrypted`, encryptValue(key));
    },
    getApiKey(providerId: string): string | undefined {
        console.assert(typeof providerId === 'string', 'providerId must be a string');
        const encrypted = store.get(`${providerId}ApiKey_encrypted` as any) as string | undefined;
        if (!encrypted) return undefined;
        try {
            return decryptValue(encrypted);
        } catch (e) {
            console.error(`[SecureStore] Failed to decrypt key for ${providerId}`, e);
            return undefined;
        }
    },
    deleteApiKey(providerId: string): void {
        console.assert(typeof providerId === 'string', 'providerId must be a string');
        store.delete(`${providerId}ApiKey_encrypted` as any);
    },

    setGitHubToken(token: string): void {
        store.set('githubToken_encrypted', encryptValue(token));
    },
    getGitHubToken(): string | undefined {
        const encrypted = store.get('githubToken_encrypted');
        if (!encrypted) return undefined;
        try {
            return decryptValue(encrypted);
        } catch (e) {
            console.error('[SecureStore] Failed to decrypt GitHub token', e);
            return undefined;
        }
    },
    deleteGitHubToken(): void {
        store.delete('githubToken_encrypted');
    },

    setHuggingFaceToken(token: string): void {
        store.set('huggingfaceToken_encrypted', encryptValue(token));
    },
    getHuggingFaceToken(): string | undefined {
        const encrypted = store.get('huggingfaceToken_encrypted');
        if (!encrypted) return undefined;
        try {
            return decryptValue(encrypted);
        } catch (e) {
            console.error('[SecureStore] Failed to decrypt Hugging Face token', e);
            return undefined;
        }
    },
    deleteHuggingFaceToken(): void {
        store.delete('huggingfaceToken_encrypted');
    },

    // Non-sensitive settings
    getTheme(): 'light' | 'dark' {
        return store.get('theme') || 'dark';
    },
    setTheme(theme: 'light' | 'dark'): void {
        console.assert(theme === 'light' || theme === 'dark', 'Theme must be light or dark');
        store.set('theme', theme);
    },

    getFontSize(): number {
        return store.get('fontSize') || 14;
    },
    setFontSize(size: number): void {
        console.assert(typeof size === 'number' && size > 0, 'FontSize must be a valid positive number');
        store.set('fontSize', size);
    },

    getActiveProvider(): string {
        return store.get('activeProvider') || 'openai';
    },
    setActiveProvider(provider: string): void {
        console.assert(typeof provider === 'string', 'Active provider must be a string');
        store.set('activeProvider', provider);
    },

    getSelectedModel(): string {
        return store.get('selectedModel') || 'gpt-4o';
    },
    setSelectedModel(model: string): void {
        console.assert(typeof model === 'string', 'Selected model must be a string');
        store.set('selectedModel', model);
    },

    getAllowFileRead(): boolean {
        return !!store.get('allowFileRead');
    },
    setAllowFileRead(allow: boolean): void {
        store.set('allowFileRead', allow);
    },

    getAutoApproveCommands(): boolean {
        return !!store.get('autoApproveCommands');
    },
    setAutoApproveCommands(approve: boolean): void {
        store.set('autoApproveCommands', approve);
    },

    getSystemPromptOverride(): string {
        return store.get('systemPromptOverride') || '';
    },
    setSystemPromptOverride(prompt: string): void {
        console.assert(typeof prompt === 'string', 'System prompt must be a string');
        store.set('systemPromptOverride', prompt);
    },

    // LiteLLM getters and setters
    getEnableLiteLLMProxy(): boolean {
        return !!store.get('enableLiteLLMProxy');
    },
    setEnableLiteLLMProxy(enable: boolean): void {
        store.set('enableLiteLLMProxy', enable);
    },

    getLiteLLMConfigPath(): string {
        return store.get('liteLLMConfigPath') || '';
    },
    setLiteLLMConfigPath(path: string): void {
        console.assert(typeof path === 'string', 'Config path must be a string');
        store.set('liteLLMConfigPath', path);
    },

    getLiteLLMModel(): string {
        return store.get('liteLLMModel') || 'gpt-4o';
    },
    setLiteLLMModel(model: string): void {
        console.assert(typeof model === 'string', 'Model must be a string');
        store.set('liteLLMModel', model);
    },

    getLiteLLMPort(): number {
        return store.get('liteLLMPort') || 4000;
    },
    setLiteLLMPort(port: number): void {
        console.assert(typeof port === 'number' && port > 0, 'Port must be a positive number');
        store.set('liteLLMPort', port);
    },

    // Cloud Credentials getters and setters
    getAwsRegion(): string {
        return store.get('awsRegion') || 'us-east-1';
    },
    setAwsRegion(region: string): void {
        console.assert(typeof region === 'string', 'AWS Region must be a string');
        store.set('awsRegion', region);
    },

    getVertexProject(): string {
        return store.get('vertexProject') || '';
    },
    setVertexProject(project: string): void {
        console.assert(typeof project === 'string', 'Vertex Project must be a string');
        store.set('vertexProject', project);
    },

    getVertexLocation(): string {
        return store.get('vertexLocation') || 'us-central1';
    },
    setVertexLocation(location: string): void {
        console.assert(typeof location === 'string', 'Vertex Location must be a string');
        store.set('vertexLocation', location);
    },

    getAzureApiBase(): string {
        return store.get('azureApiBase') || '';
    },
    setAzureApiBase(base: string): void {
        console.assert(typeof base === 'string', 'Azure API Base must be a string');
        store.set('azureApiBase', base);
    },

    getAzureApiVersion(): string {
        return store.get('azureApiVersion') || '2024-02-01';
    },
    setAzureApiVersion(version: string): void {
        console.assert(typeof version === 'string', 'Azure API Version must be a string');
        store.set('azureApiVersion', version);
    },

    getWindowBounds(): { width: number; height: number } | undefined {
        return store.get('windowBounds');
    },
    setWindowBounds(bounds: { width: number; height: number }): void {
        console.assert(bounds && typeof bounds.width === 'number', 'Window bounds must be valid');
        store.set('windowBounds', bounds);
    },

    getActiveWorkspacePath(): string {
        return store.get('activeWorkspacePath') || '';
    },
    setActiveWorkspacePath(pathStr: string): void {
        console.assert(typeof pathStr === 'string', 'Workspace path must be a string');
        store.set('activeWorkspacePath', pathStr);
    },

    getPipelineConfig(): any {
        return store.get('pipelineConfig');
    },
    setPipelineConfig(config: any): void {
        console.assert(config && typeof config === 'object', 'Pipeline config must be an object');
        store.set('pipelineConfig', config);
    },
    deletePipelineConfig(): void {
        store.delete('pipelineConfig');
    },

    // Embedding config getters & setters
    getEmbeddingProvider(): string {
        return store.get('embeddingProvider') || this.getActiveProvider() || 'openai';
    },
    setEmbeddingProvider(provider: string): void {
        console.assert(typeof provider === 'string', 'Embedding provider must be a string');
        store.set('embeddingProvider', provider);
    },

    getEmbeddingModel(): string {
        const stored = store.get('embeddingModel');
        if (stored) return stored;
        const provider = this.getEmbeddingProvider();
        if (provider === 'openrouter') return 'openai/text-embedding-3-small';
        return 'text-embedding-3-small';
    },
    setEmbeddingModel(model: string): void {
        console.assert(typeof model === 'string', 'Embedding model must be a string');
        store.set('embeddingModel', model);
    },

    getEmbeddingBaseUrl(): string {
        return store.get('embeddingBaseUrl') || '';
    },
    setEmbeddingBaseUrl(url: string): void {
        console.assert(typeof url === 'string', 'Embedding base URL must be a string');
        store.set('embeddingBaseUrl', url);
    },

    getEmbeddingConfig(): { provider: string; model: string; baseUrl: string; dimension: number } {
        return {
            provider: this.getEmbeddingProvider(),
            model: this.getEmbeddingModel(),
            baseUrl: this.getEmbeddingBaseUrl(),
            dimension: this.getEmbeddingDimension()
        };
    },

    getEmbeddingDimension(): number {
        return store.get('embeddingDimension') || 0;
    },
    setEmbeddingDimension(dim: number): void {
        console.assert(typeof dim === 'number' && dim > 0, 'Embedding dimension must be a positive number');
        const current = this.getEmbeddingDimension();
        if (current !== dim) {
            store.set('embeddingDimension', dim);
        }
    },

    getPipelineEnabled(): boolean {
        return !!store.get('pipelineEnabled');
    },
    setPipelineEnabled(enabled: boolean): void {
        store.set('pipelineEnabled', enabled);
    },

    getHardwareSpec(): SecureStoreSchema['hardwareSpec'] {
        return store.get('hardwareSpec');
    },
    setHardwareSpec(spec: SecureStoreSchema['hardwareSpec']): void {
        console.assert(spec && typeof spec.timestamp === 'number', 'Hardware spec must have timestamp');
        store.set('hardwareSpec', spec);
    },
    deleteHardwareSpec(): void {
        store.delete('hardwareSpec');
    },

    setCustomProviderKey(providerId: string, key: string): void {
        console.assert(typeof providerId === 'string', 'providerId must be a string');
        checkEncryptionGuard();
        store.set(`customProvider_${providerId}_encrypted` as any, encryptValue(key));
    },
    getCustomProviderKey(providerId: string): string | undefined {
        console.assert(typeof providerId === 'string', 'providerId must be a string');
        const encrypted = store.get(`customProvider_${providerId}_encrypted` as any) as string | undefined;
        if (!encrypted) return undefined;
        try {
            return decryptValue(encrypted);
        } catch (e) {
            console.error(`[SecureStore] Failed to decrypt key for custom provider ${providerId}`, e);
            return undefined;
        }
    },
    deleteCustomProviderKey(providerId: string): void {
        console.assert(typeof providerId === 'string', 'providerId must be a string');
        store.delete(`customProvider_${providerId}_encrypted` as any);
    }
};

// Encryption is always available (safeStorage or AES fallback)
function checkEncryptionGuard() {
    // No-op: AES-256-GCM fallback always available
}

// Export listEncryptedKeys separately
export function listEncryptedKeys() {
    const knownProviders = ['openai', 'anthropic', 'gemini', 'openrouter', 'ollama', 'github', 'huggingface'];
    const encryptionType = safeStorage.isEncryptionAvailable() ? 'os-level' : 'aes-256-gcm';
    return knownProviders.map(id => {
        let hasKey = false;
        if (id === 'github') {
            hasKey = !!secureStore.getGitHubToken();
        } else if (id === 'huggingface') {
            hasKey = !!secureStore.getHuggingFaceToken();
        } else {
            hasKey = !!secureStore.getApiKey(id);
        }
        return {
            providerId: id,
            hasKey,
            encryptionType
        };
    });
}

// Export raw store for settings reset/inspect
export { store };
