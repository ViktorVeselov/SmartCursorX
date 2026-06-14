/**
 * SecureStore: Uses Electron's safeStorage API for OS-level encryption.
 * - Windows: Uses DPAPI
 * - macOS: Uses Keychain
 * - Linux: Uses Secret Service API / libsecret
 */
import { safeStorage, app } from 'electron';
import Store from 'electron-store';
import console from 'console';

interface SecureStoreSchema {
    // Encrypted values stored as base64 strings
    openaiApiKey_encrypted?: string;
    anthropicApiKey_encrypted?: string;
    geminiApiKey_encrypted?: string;
    ollamaApiKey_encrypted?: string;
    githubToken_encrypted?: string;
    
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
        activeWorkspacePath: ''
    }
});

/**
 * Encrypt a string using OS-level encryption
 */
function encryptValue(value: string): string {
    console.assert(typeof value === 'string', 'Value to encrypt must be a string');
    if (!safeStorage.isEncryptionAvailable()) {
        console.warn('[SecureStore] Encryption not available, storing as-is');
        return value;
    }
    const buffer = safeStorage.encryptString(value);
    return buffer.toString('base64');
}

/**
 * Decrypt a base64-encoded encrypted string
 */
function decryptValue(encrypted: string): string {
    console.assert(typeof encrypted === 'string', 'Encrypted value must be a base64 string');
    if (!safeStorage.isEncryptionAvailable()) {
        console.warn('[SecureStore] Encryption not available, returning as-is');
        return encrypted;
    }
    const buffer = Buffer.from(encrypted, 'base64');
    return safeStorage.decryptString(buffer);
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

// Helper to guard encryption availability in development mode
function checkEncryptionGuard() {
    if (!safeStorage.isEncryptionAvailable()) {
        const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
        if (isDev) {
            throw new Error('[SecureStore] OS-level encryption is not available in development.');
        }
    }
}

// Override existing setters to enforce the encryption guard
const originalSetApiKey = secureStore.setApiKey;
secureStore.setApiKey = function(providerId: string, key: string): void {
    checkEncryptionGuard();
    originalSetApiKey.call(secureStore, providerId, key);
};

const originalSetGitHubToken = secureStore.setGitHubToken;
secureStore.setGitHubToken = function(token: string): void {
    checkEncryptionGuard();
    originalSetGitHubToken.call(secureStore, token);
};

// Export listEncryptedKeys separately
export function listEncryptedKeys() {
    const knownProviders = ['openai', 'anthropic', 'gemini', 'ollama', 'github'];
    const encryptionAvailable = safeStorage.isEncryptionAvailable();
    return knownProviders.map(id => {
        let hasKey = false;
        if (id === 'github') {
            hasKey = !!secureStore.getGitHubToken();
        } else {
            hasKey = !!secureStore.getApiKey(id);
        }
        return {
            providerId: id,
            hasKey,
            encryptionAvailable
        };
    });
}

// Export raw store for settings reset/inspect
export { store };
