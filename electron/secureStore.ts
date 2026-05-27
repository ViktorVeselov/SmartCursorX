/**
 * SecureStore: Uses Electron's safeStorage API for OS-level encryption.
 * - Windows: Uses DPAPI
 * - macOS: Uses Keychain
 * - Linux: Uses Secret Service API / libsecret
 */
import { safeStorage } from 'electron';
import Store from 'electron-store';
import console from 'console';

interface SecureStoreSchema {
    // Encrypted values stored as base64 strings
    openaiApiKey_encrypted?: string;
    anthropicApiKey_encrypted?: string;
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
        systemPromptOverride: ''
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

    getWindowBounds(): { width: number; height: number } | undefined {
        return store.get('windowBounds');
    },
    setWindowBounds(bounds: { width: number; height: number }): void {
        console.assert(bounds && typeof bounds.width === 'number', 'Window bounds must be valid');
        store.set('windowBounds', bounds);
    }
};

// Export raw store for settings reset/inspect
export { store };
