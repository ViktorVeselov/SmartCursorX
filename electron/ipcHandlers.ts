import { ipcMain, BrowserWindow, dialog } from 'electron';
import path from 'path';
import crypto from 'crypto';
import { dbService } from './db';
import { aiService, AIService } from './services/AIService';
import { secureStore } from './secureStore';
import { liteLLMService } from './services/LiteLLMService';
import { openClawService } from './services/OpenClawService';
import { DocumentationService } from './services/DocumentationService';
import { VerificationService } from './services/VerificationService';
import { EmbeddingService } from './services/EmbeddingService';
import { TaskService } from './services/TaskService';
import { ContextAssembler } from './services/ContextAssembler';
import { CodeAnalysisService } from './services/CodeAnalysisService';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const fs = require('fs').promises;

// Type for PTY process
interface IPty {
    pid: number;
    cols: number;
    rows: number;
    on(event: string, callback: (data: any) => void): void;
    write(data: string): void;
    resize(cols: number, rows: number): void;
    kill(): void;
}

export class IpcManager {
    private ptyProcesses: Map<string, IPty> = new Map();
    private mainWindow: BrowserWindow | null = null;
    private native: any = null;

    constructor(nativeModule: any) {
        console.log('[IpcManager] Constructor');
        this.native = nativeModule;
    }

    setWindow(win: BrowserWindow) {
        console.log('[IpcManager] Setting Window');
        this.mainWindow = win;
    }

    registerHandlers() {
        console.log('[IpcManager] Registering Handlers');
        this.registerNativeHandlers();
        this.registerFileSystemHandlers();
        this.registerSettingsHandlers();
        this.registerDatabaseHandlers();
        this.registerTerminalHandlers();
        this.registerVCHandlers();
        this.registerGitHandlers();
        this.registerOpenClawHandlers();
        this.registerCodeAnalysisHandlers();
        this.registerTaskHandlers();
        this.registerRAGHandlers();
        this.registerVerificationHandlers();
        this.registerDocumentationHandlers();
        console.log('[IpcManager] Handlers Registered Complete');
    }

    private registerDocumentationHandlers() {
        ipcMain.handle('doc:generate', async (_event, taskId: number) => {
            console.assert(typeof taskId === 'number', 'taskId must be a number');
            return DocumentationService.generateTaskDocs(taskId);
        });

        ipcMain.handle('doc:get', async (_event, taskId: number) => {
            console.assert(typeof taskId === 'number', 'taskId must be a number');
            return dbService.getTaskDocs(taskId);
        });
    }

    private registerVerificationHandlers() {
        ipcMain.handle('verify:run', async (_event, taskOutputId: number) => {
            console.assert(typeof taskOutputId === 'number', 'taskOutputId must be a number');
            return VerificationService.verifyOutput(taskOutputId);
        });

        ipcMain.handle('verify:get-rules', async () => {
            return dbService.getVerificationRules();
        });

        ipcMain.handle('verify:add-rule', async (_event, name: string, desc: string | null, type: string, triggerOn: string, config: object, appliesTo: string) => {
            return dbService.addVerificationRule(name, desc, type, triggerOn, config, appliesTo);
        });

        ipcMain.handle('verify:get-results', async (_event, outputId: number) => {
            return dbService.getVerificationResults(outputId);
        });

        ipcMain.handle('verify:human-review', async (_event, outputId: number, status: string) => {
            console.assert(['passed', 'failed'].includes(status), 'Status must be passed or failed');
            dbService.updateTaskOutputVerification(outputId, status);
            return true;
        });
    }

    private registerRAGHandlers() {
        ipcMain.handle('rag:search', async (_event, query: string, limit?: number) => {
            console.assert(typeof query === 'string' && query.trim().length > 0, 'Query must be a non-empty string');
            return EmbeddingService.searchSimilarity(query, limit || 5);
        });

        ipcMain.handle('rag:index-content', async (_event, sourceType: string, sourceId: string | null, content: string, metadata: object) => {
            console.assert(typeof sourceType === 'string', 'sourceType must be a string');
            console.assert(typeof content === 'string', 'content must be a string');
            await EmbeddingService.indexKnowledge(sourceType, sourceId, content, metadata);
            return true;
        });
    }

    private registerTaskHandlers() {
        ipcMain.handle('task:create', async (_event, title: string, desc: string | null, parentId?: number | null, agentId?: number | null, createdBy?: string, budget?: number, priority?: number) => {
            return TaskService.createTask(title, desc, parentId, agentId, createdBy || 'user', budget || 3000, priority || 0);
        });

        ipcMain.handle('task:decompose', async (_event, parentId: number, subtasks: any[]) => {
            return TaskService.decomposeTask(parentId, subtasks);
        });

        ipcMain.handle('task:start', async (_event, taskId: number) => {
            TaskService.startTask(taskId);
            return true;
        });

        ipcMain.handle('task:complete', async (_event, taskId: number, content: string, agentId?: number | null, type?: string, tokens?: number, model?: string, provider?: string) => {
            return TaskService.completeTask(taskId, content, agentId, type || 'text', tokens || 0, model, provider);
        });

        ipcMain.handle('task:fail', async (_event, taskId: number, reason: string) => {
            TaskService.failTask(taskId, reason);
            return true;
        });

        ipcMain.handle('task:get-tree', async () => {
            return TaskService.getHierarchicalTasks();
        });

        ipcMain.handle('task:assemble-context', async (_event, taskId: number, messages: any[], budget?: any) => {
            return ContextAssembler.assembleContext(taskId, messages, budget);
        });
    }

    private registerCodeAnalysisHandlers() {
        ipcMain.handle('code:get-symbols', async (_event, filePath: string) => {
            console.assert(typeof filePath === 'string', 'filePath must be a valid string');
            return CodeAnalysisService.parseFileSymbols(filePath);
        });

        ipcMain.handle('code:find-references', async (_event, symbolName: string, rootPath: string) => {
            console.assert(typeof symbolName === 'string', 'symbolName must be a valid string');
            console.assert(typeof rootPath === 'string', 'rootPath must be a valid string');
            return CodeAnalysisService.findReferences(symbolName, rootPath);
        });

        ipcMain.handle('code:get-call-hierarchy', async (_event, symbolName: string, rootPath: string, direction: 'incoming' | 'outgoing') => {
            console.assert(typeof symbolName === 'string', 'symbolName must be a valid string');
            console.assert(typeof rootPath === 'string', 'rootPath must be a valid string');
            console.assert(['incoming', 'outgoing'].includes(direction), 'Invalid direction: must be incoming or outgoing');
            return CodeAnalysisService.getCallHierarchy(symbolName, rootPath, direction);
        });

        ipcMain.handle('code:get-workspace-outline', async (_event, rootPath: string) => {
            console.assert(typeof rootPath === 'string', 'rootPath must be a valid string');
            return CodeAnalysisService.getWorkspaceOutline(rootPath);
        });
    }

    private registerNativeHandlers() {
        ipcMain.handle('native-search', async (_event, options) => {
            if (!this.native) throw new Error('Native module not loaded');
            return this.native.searchFiles(options);
        });

        ipcMain.handle('native-health-check', async () => {
            if (!this.native) return 'Native module failed to load';
            return this.native.nativeHealthCheck();
        });
    }

    private registerFileSystemHandlers() {
        ipcMain.handle('read-dir', async (_event, dirPath) => {
            if (typeof dirPath !== 'string') throw new Error('Invalid path argument');

            try {
                const names = await fs.readdir(dirPath);
                const items = await Promise.all(names.map(async (name: string) => {
                    const fullPath = path.join(dirPath, name);
                    const stats = await fs.stat(fullPath);
                    return {
                        name,
                        path: fullPath,
                        isDirectory: stats.isDirectory()
                    };
                }));
                return items.sort((a: any, b: any) => {
                    if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                    return a.isDirectory ? -1 : 1;
                });
            } catch (err) {
                console.error('Error reading directory:', err);
                return [];
            }
        });

        ipcMain.handle('read-file', async (_event, filePath) => {
            if (typeof filePath !== 'string') throw new Error('Invalid path argument');
            try {
                return await fs.readFile(filePath, 'utf-8');
            } catch (err) {
                console.error('Error reading file:', err);
                throw err;
            }
        });

        ipcMain.handle('write-file', async (_event, filePath, content) => {
            if (typeof filePath !== 'string' || !filePath.trim()) throw new Error('Invalid file path');
            if (typeof content !== 'string') throw new Error('Invalid content');

            try {
                await fs.writeFile(filePath, content, 'utf-8');
                return true;
            } catch (err) {
                console.error('Error writing file:', err);
                throw err;
            }
        });

        ipcMain.handle('delete-path', async (_event, targetPath) => {
            if (typeof targetPath !== 'string') throw new Error('Invalid path argument');
            try {
                const stats = await fs.stat(targetPath);
                if (stats.isDirectory()) {
                    await fs.rm(targetPath, { recursive: true, force: true });
                } else {
                    await fs.unlink(targetPath);
                }
                return true;
            } catch (err) {
                console.error('Error deleting path:', err);
                throw err;
            }
        });

        ipcMain.handle('rename-path', async (_event, oldPath, newPath) => {
            if (typeof oldPath !== 'string' || typeof newPath !== 'string') throw new Error('Invalid path arguments');
            try {
                await fs.rename(oldPath, newPath);
                return true;
            } catch (err) {
                console.error('Error renaming path:', err);
                throw err;
            }
        });

        ipcMain.handle('create-directory', async (_event, dirPath) => {
            if (typeof dirPath !== 'string') throw new Error('Invalid path argument');
            try {
                await fs.mkdir(dirPath, { recursive: true });
                return true;
            } catch (err) {
                console.error('Error creating directory:', err);
                throw err;
            }
        });

        ipcMain.handle('resolve-path', async (_event, ...paths) => {
            // paths is an array of path segments to join and resolve
            try {
                return path.resolve(...paths);
            } catch (err) {
                console.error('Error resolving path:', err);
                return '';
            }
        });

        ipcMain.handle('dialog-open-folder', async () => {
            if (!this.mainWindow) return null;
            const result = await dialog.showOpenDialog(this.mainWindow, {
                properties: ['openDirectory']
            });
            if (result.canceled || result.filePaths.length === 0) {
                return null;
            }
            return result.filePaths[0];
        });

        ipcMain.handle('dialog-save-file', async (_event, defaultName?: string) => {
            if (!this.mainWindow) return null;
            const result = await dialog.showSaveDialog(this.mainWindow, {
                defaultPath: defaultName || 'untitled.txt',
                properties: ['showOverwriteConfirmation']
            });
            if (result.canceled || !result.filePath) {
                return null;
            }
            return result.filePath;
        });

        ipcMain.handle('dialog-open-file', async () => {
            if (!this.mainWindow) return null;
            const result = await dialog.showOpenDialog(this.mainWindow, {
                properties: ['openFile']
            });
            if (result.canceled || result.filePaths.length === 0) {
                return null;
            }
            return result.filePaths[0];
        });
    }

    private registerSettingsHandlers() {
        // OpenAI Key Handlers (using OS-level encryption)
        ipcMain.handle('get-api-key', () => secureStore.getApiKey('openai'));
        ipcMain.handle('set-api-key', (_event, key: string) => {
            if (!key.startsWith('sk-')) throw new Error('Invalid API Key format');
            secureStore.setApiKey('openai', key);
            return true;
        });

        // GitHub Token Handlers (using OS-level encryption)
        ipcMain.handle('get-github-token', () => secureStore.getGitHubToken());
        ipcMain.handle('set-github-token', (_event, token: string) => {
            // GitHub PATs can start with ghp_, gho_, ghu_, ghs_, ghr_ (classic) or github_pat_ (fine-grained)
            if (!token.startsWith('ghp_') && !token.startsWith('gho_') && !token.startsWith('ghu_') && !token.startsWith('ghs_') && !token.startsWith('ghr_') && !token.startsWith('github_pat_')) {
                throw new Error('Invalid GitHub token format. Must be a valid Personal Access Token.');
            }
            secureStore.setGitHubToken(token);
            return true;
        });
        // Test connection for local LLMs
        ipcMain.handle('ai:test-connection', async (_event, baseUrl: string) => {
            if (typeof baseUrl !== 'string' || !baseUrl.trim()) {
                throw new Error('Invalid baseUrl');
            }
            const trimmedUrl = baseUrl.replace(/\\+$/,'');
            try {
                const res = await fetch(`${trimmedUrl}/api/tags`);
                if (res.ok) return true;
            } catch (e) {
                // ignore and fallback
            }
            try {
                const head = await fetch(trimmedUrl, { method: 'HEAD' });
                return head.ok;
            } catch (e) {
                return false;
            }
        });
    }

    private registerDatabaseHandlers() {
        ipcMain.handle('db-add-memory', (_event, type: string, content: string) => {
            if (!content) throw new Error('Memory content cannot be empty');
            dbService.addMemory(type, content);
            return true;
        });

        ipcMain.handle('db-get-memories', (_event, type?: string) => {
            return dbService.getMemories(type);
        });

        ipcMain.handle('db-delete-memory', (_event, id: number) => {
            dbService.deleteMemory(id);
            return true;
        });

        // Agents
        ipcMain.handle('db-get-agents', () => dbService.getAgents());
        ipcMain.handle('db-add-agent', (_event, name: string, prompt: string) => {
            dbService.addAgent(name, prompt);
            return true;
        });
        ipcMain.handle('db-delete-agent', (_event, id: number) => {
            dbService.deleteAgent(id);
            return true;
        });

        // Flows
        ipcMain.handle('db-get-flows', () => dbService.getFlows());
        ipcMain.handle('db-add-flow', (_event, name: string, desc: string, steps: string[], agentId?: number) => {
            dbService.addFlow(name, desc, steps, agentId);
            return true;
        });
        ipcMain.handle('db-delete-flow', (_event, id: number) => {
            dbService.deleteFlow(id);
            return true;
        });
        ipcMain.handle('db-update-flow', (_event, id: number, steps: string[]) => {
            dbService.updateFlow(id, steps);
            return true;
        });

        // Custom Providers IPC
        ipcMain.handle('ai:get-custom-providers', () => {
            return dbService.getCustomProviders();
        });
        ipcMain.handle('ai:get-provider-key', (_event, providerId: string) => {
            console.assert(typeof providerId === 'string', 'providerId must be a string');
            return secureStore.getApiKey(providerId);
        });
        ipcMain.handle('ai:add-custom-provider', (_event, id: string, name: string, baseUrl: string, apiKey?: string) => {
            dbService.addCustomProvider(id, name, baseUrl, apiKey);
            return true;
        });
        ipcMain.handle('ai:delete-custom-provider', (_event, id: string) => {
            dbService.deleteCustomProvider(id);
            return true;
        });

        // Custom Models IPC
        ipcMain.handle('ai:get-custom-models', (_event, providerId?: string) => {
            return dbService.getCustomModels(providerId);
        });
        ipcMain.handle('ai:add-custom-model', (_event, providerId: string, modelName: string, hasThinking?: boolean) => {
            dbService.addCustomModel(providerId, modelName, hasThinking ? 1 : 0);
            return true;
        });
        ipcMain.handle('ai:toggle-model-thinking', (_event, providerId: string, modelName: string, hasThinking: boolean) => {
            dbService.toggleCustomModelThinking(providerId, modelName, hasThinking ? 1 : 0);
            return true;
        });
        ipcMain.handle('ai:delete-custom-model', (_event, providerId: string, modelName: string) => {
            dbService.deleteCustomModel(providerId, modelName);
            return true;
        });

        // LiteLLM Local Proxy Process Orchestration IPC Handlers
        ipcMain.handle('litellm:get-status', () => {
            return {
                isActive: liteLLMService.isProxyActive()
            };
        });
        ipcMain.handle('litellm:stop', () => {
            liteLLMService.stopProxy();
            return true;
        });
        ipcMain.handle('litellm:start', async (_event, config) => {
            console.assert(config !== null && typeof config === 'object', 'Proxy config must be an object');
            return await liteLLMService.startProxy(config);
        });
    }

    private registerTerminalHandlers() {
        const os = require('os');
        const pty = require('node-pty');
        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

        // Initialize terminal with unique ID
        ipcMain.handle('term-init', (_event, terminalId: string) => {
            if (!terminalId) {
                terminalId = `term-${Date.now()}`;
            }

            // Kill existing if same ID
            if (this.ptyProcesses.has(terminalId)) {
                try { this.ptyProcesses.get(terminalId)!.kill(); } catch (e) { }
                this.ptyProcesses.delete(terminalId);
            }

            const ptyProcess = pty.spawn(shell, [], {
                name: 'xterm-color',
                cols: 80,
                rows: 24,
                cwd: process.env.USERPROFILE || process.env.HOME,
                env: process.env
            });

            this.ptyProcesses.set(terminalId, ptyProcess);

            ptyProcess.on('data', (data: string) => {
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    // Send data with terminal ID so frontend can route to correct terminal
                    this.mainWindow.webContents.send('terminal-incoming', terminalId, data);
                }
            });

            ptyProcess.on('exit', () => {
                this.ptyProcesses.delete(terminalId);
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    this.mainWindow.webContents.send('terminal-exit', terminalId);
                }
            });

            return { terminalId, pid: ptyProcess.pid };
        });

        // Write to specific terminal
        ipcMain.handle('term-input', (_event, terminalId: string, data: string) => {
            const ptyProcess = this.ptyProcesses.get(terminalId);
            if (ptyProcess) {
                ptyProcess.write(data);
            }
        });

        // Resize specific terminal
        ipcMain.handle('term-resize', (_event, terminalId: string, cols: number, rows: number) => {
            const ptyProcess = this.ptyProcesses.get(terminalId);
            if (ptyProcess) {
                ptyProcess.resize(cols, rows);
            }
        });

        // Close specific terminal
        ipcMain.handle('term-close', (_event, terminalId: string) => {
            const ptyProcess = this.ptyProcesses.get(terminalId);
            if (ptyProcess) {
                try { ptyProcess.kill(); } catch (e) { }
                this.ptyProcesses.delete(terminalId);
            }
            return true;
        });
    }

    private registerVCHandlers() {
        // Create Snapshot
        ipcMain.handle('vc-create-snapshot', async (_event, name: string, rootPath: string) => {
            // Defaults if rootPath is '.' or empty
            const targetPath = (!rootPath || rootPath === '.') ? process.cwd() : rootPath;

            console.log('[VC] Creating snapshot:', name, 'for', targetPath);
            const snapshotId = dbService.createSnapshot(name);

            // Recursive walk function
            const walk = async (dir: string) => {
                try {
                    const entries = await fs.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const res = path.resolve(dir, entry.name);
                        if (entry.isDirectory()) {
                            if (['node_modules', '.git', 'dist', 'target', 'build', '.idea', '.vscode', 'out', 'bin', 'obj'].includes(entry.name)) continue;
                            await walk(res);
                        } else {
                            // Check max size? Skip large files?
                            // For now basic text files logic from try/catch
                            try {
                                const content = await fs.readFile(res, 'utf-8');
                                const hash = crypto.createHash('sha256').update(content).digest('hex');
                                dbService.addBlob(hash, content);
                                dbService.addSnapshotFile(snapshotId, res, hash);
                            } catch (e) {
                                // Likely binary or locked
                            }
                        }
                    }
                } catch (e) {
                    console.error('Failed to walk dir:', dir, e);
                }
            };

            await walk(targetPath);
            return snapshotId;
        });

        // Get Snapshots
        ipcMain.handle('vc-get-snapshots', () => {
            return dbService.getSnapshots();
        });

        // Restore Snapshot
        ipcMain.handle('vc-restore-snapshot', async (_event, snapshotId: number) => {
            console.log('[VC] Restoring snapshot:', snapshotId);
            const files = dbService.getSnapshotFiles(snapshotId);
            let count = 0;
            for (const file of files) {
                try {
                    await fs.mkdir(path.dirname(file.file_path), { recursive: true });
                    await fs.writeFile(file.file_path, file.content, 'utf-8');
                    count++;
                    console.log('Restored:', file.file_path);
                } catch (e) {
                    console.error('Failed to restore file:', file.file_path, e);
                }
            }
            return count;
        });
    }

    private registerGitHandlers() {
        const { execFile } = require('child_process');
        
        // Use execFile to prevent command injection (Arguments are passed safely as an array)
        const execGitSafe = (args: string[], cwd: string): Promise<string> => {
            return new Promise((resolve, reject) => {
                console.assert(Array.isArray(args), 'args must be an array of strings');
                console.assert(args.every(a => typeof a === 'string'), 'Every argument must be a string');
                console.assert(typeof cwd === 'string', 'cwd must be a string');
                
                execFile('git', args, { cwd, maxBuffer: 1024 * 1024 * 10 }, (error: any, stdout: string) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(stdout.trim());
                });
            });
        };

        ipcMain.handle('git-status', async (_event, rootPath: string) => {
            const targetPath = (!rootPath || rootPath === '.') ? process.cwd() : rootPath;
            try {
                const status = await execGitSafe(['status', '--porcelain'], targetPath);
                return status.split('\n').filter(Boolean).map(line => {
                    const code = line.substring(0, 2);
                    const file = line.substring(3);
                    return { code, file };
                });
            } catch (e) {
                return [];
            }
        });

        ipcMain.handle('git-branch', async (_event, rootPath: string) => {
            const targetPath = (!rootPath || rootPath === '.') ? process.cwd() : rootPath;
            try {
                return await execGitSafe(['rev-parse', '--abbrev-ref', 'HEAD'], targetPath);
            } catch (e) {
                return '';
            }
        });

        ipcMain.handle('git-clone', async (_event, repoUrl: string, destinationDir: string) => {
            console.assert(typeof repoUrl === 'string' && repoUrl.trim().length > 0, 'repoUrl must be a valid non-empty string');
            console.assert(typeof destinationDir === 'string' && destinationDir.trim().length > 0, 'destinationDir must be a valid non-empty string');

            let targetUrl = repoUrl.trim();
            if (!targetUrl.startsWith('https://') && !targetUrl.startsWith('git@') && !targetUrl.startsWith('http://')) {
                targetUrl = `https://github.com/${targetUrl}`;
            }

            try {
                const parentDir = path.dirname(destinationDir);
                const folderName = path.basename(destinationDir);
                await fs.mkdir(parentDir, { recursive: true });

                // Use spawn to get streaming progress on stderr
                const { spawn } = require('child_process');
                const gitProc = spawn('git', ['clone', '--progress', targetUrl, folderName], { cwd: parentDir });
                // Send progress messages to renderer
                gitProc.stderr.setEncoding('utf8');
                gitProc.stderr.on('data', (data: string) => {
                    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                        this.mainWindow.webContents.send('git-clone-progress', data);
                    }
                });
                // Resolve when process exits
                await new Promise<void>((resolve, reject) => {
                    gitProc.on('close', (code: number) => {
                        if (code === 0) resolve();
                        else reject(new Error(`git clone exited with code ${code}`));
                    });
                    gitProc.on('error', (err: Error) => reject(err));
                });
                return true;
            } catch (err: any) {
                console.error('Git clone error:', err);
                throw new Error(err.message || 'Failed to clone repository');
            }
        });

        ipcMain.handle('git-diff', async (_event, rootPath: string, file: string) => {
            const targetPath = (!rootPath || rootPath === '.') ? process.cwd() : rootPath;
            try {
                console.assert(typeof file === 'string' && file.length > 0, 'file argument must be a non-empty string');
                return await execGitSafe(['diff', 'HEAD', '--', file], targetPath);
            } catch (e) {
                return '';
            }
        });

        // ============================================
        // AI Chat Handler (Streaming)
        // ============================================
        ipcMain.on('ai:chat-start', async (event, { messages, providerId, model }) => {
            try {
                console.assert(Array.isArray(messages), 'messages must be a valid array');
                const targetProvider = providerId || secureStore.getActiveProvider();
                const targetModel = model || secureStore.getSelectedModel();

                // Check if it's a dynamic custom provider in SQLite
                const customProviders = dbService.getCustomProviders();
                const custom = customProviders.find((p: any) => p.id === targetProvider);

                let apiKey = secureStore.getApiKey(targetProvider) || AIService.getEnvKey(targetProvider) || '';
                let baseUrl = targetProvider === 'ollama' ? 'http://localhost:11434' : undefined;

                if (custom) {
                    if (!apiKey) {
                        apiKey = custom.api_key || '';
                    }
                    baseUrl = custom.base_url;
                }

                if (targetProvider !== 'ollama' && !custom) {
                    console.assert(apiKey.length > 0, `API key for provider ${targetProvider} must be configured`);
                }

                aiService.initialize({
                    providerId: targetProvider,
                    apiKey,
                    baseUrl
                });

                console.assert(aiService.isActive(), 'aiService must be active after initialization');

                const provider = aiService.getProvider();

                const overrideSystemPrompt = secureStore.getSystemPromptOverride();
                let finalMessages = [...messages];
                if (overrideSystemPrompt && overrideSystemPrompt.trim().length > 0) {
                    const systemIndex = finalMessages.findIndex(m => m.role === 'system');
                    if (systemIndex !== -1) {
                        finalMessages[systemIndex] = { role: 'system', content: overrideSystemPrompt };
                    } else {
                        finalMessages.unshift({ role: 'system', content: overrideSystemPrompt });
                    }
                }

                const stream = await provider.chat(finalMessages, {
                    stream: true,
                    model: targetModel,
                    temperature: 0.7
                });

                if (typeof stream === 'string') {
                    event.sender.send('ai:chat-chunk', stream);
                } else {
                    for await (const chunk of stream) {
                        event.sender.send('ai:chat-chunk', chunk);
                    }
                }

                event.sender.send('ai:chat-end');

            } catch (error: any) {
                console.error('AI Chat Error:', error);
                event.sender.send('ai:chat-chunk', `Error: ${error.message}`);
                event.sender.send('ai:chat-end');
            }
        });

        // Save Provider Settings Securely
        ipcMain.handle('ai:save-config', async (_, config) => {
            console.assert(config && typeof config.providerId === 'string', 'config.providerId must be a valid string');
            if (config.apiKey) {
                secureStore.setApiKey(config.providerId, config.apiKey);
            }
            secureStore.setActiveProvider(config.providerId);
            return true;
        });

        // Get Dynamic Config Securely
        ipcMain.handle('ai:get-config', async (_, providerId) => {
            console.assert(typeof providerId === 'string', 'providerId must be a string');
            const key = secureStore.getApiKey(providerId);
            return {
                providerId,
                hasKey: !!key || !!AIService.getEnvKey(providerId)
            };
        });

        // Load dynamic models list
        ipcMain.handle('ai:get-models', async (_, providerId) => {
            console.assert(typeof providerId === 'string', 'providerId must be a string');
            
            // Check if provider is a custom provider
            const customProviders = dbService.getCustomProviders();
            const custom = customProviders.find((p: any) => p.id === providerId);
            
            let apiKey = secureStore.getApiKey(providerId) || AIService.getEnvKey(providerId) || '';
            let baseUrl = providerId === 'ollama' ? 'http://localhost:11434' : undefined;
            
            if (custom) {
                if (!apiKey) {
                    apiKey = custom.api_key || '';
                }
                baseUrl = custom.base_url;
            }

            // Get custom models stored in SQLite for this provider
            const customModels = dbService.getCustomModels(providerId).map((m: any) => m.model_name);

            try {
                // Instantiating temporary provider to query models list
                const tempService = AIService.getInstance();
                tempService.initialize({
                    providerId,
                    apiKey,
                    baseUrl
                });
                const fetchedModels = await tempService.getProvider().getModels();
                // Combine and deduplicate
                const combined = Array.from(new Set([...customModels, ...fetchedModels]));
                return combined.length > 0 ? combined : customModels;
            } catch (e) {
                console.error(`Failed to list models for provider ${providerId}`, e);
                // Return static fallbacks on failure, merged with custom models
                let fallbacks: string[] = [];
                if (providerId === 'openai') fallbacks = ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'];
                else if (providerId === 'anthropic') fallbacks = ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'];
                else if (providerId === 'ollama') fallbacks = ['llama3', 'mistral'];
                
                const combined = Array.from(new Set([...customModels, ...fallbacks]));
                return combined;
            }
        });

        // General settings IPC handlers
        ipcMain.handle('get-general-settings', () => {
            return {
                theme: secureStore.getTheme(),
                fontSize: secureStore.getFontSize(),
                activeProvider: secureStore.getActiveProvider(),
                selectedModel: secureStore.getSelectedModel(),
                allowFileRead: secureStore.getAllowFileRead(),
                autoApproveCommands: secureStore.getAutoApproveCommands(),
                systemPromptOverride: secureStore.getSystemPromptOverride()
            };
        });

        ipcMain.handle('save-general-settings', (_, settings) => {
            console.assert(settings !== null && typeof settings === 'object', 'Settings must be an object');
            if (settings.theme) secureStore.setTheme(settings.theme);
            if (typeof settings.fontSize === 'number') secureStore.setFontSize(settings.fontSize);
            if (settings.activeProvider) secureStore.setActiveProvider(settings.activeProvider);
            if (settings.selectedModel) secureStore.setSelectedModel(settings.selectedModel);
            if (typeof settings.allowFileRead === 'boolean') secureStore.setAllowFileRead(settings.allowFileRead);
            if (typeof settings.autoApproveCommands === 'boolean') secureStore.setAutoApproveCommands(settings.autoApproveCommands);
            if (typeof settings.systemPromptOverride === 'string') secureStore.setSystemPromptOverride(settings.systemPromptOverride);
            return true;
        });
    }

    private registerOpenClawHandlers() {
        ipcMain.handle('openclaw:check-installed', async () => {
            return await openClawService.checkInstalled();
        });

        ipcMain.handle('openclaw:get-status', async () => {
            return await openClawService.getStatus();
        });

        ipcMain.handle('openclaw:start-gateway', async (_event, config) => {
            const port = config && typeof config.port === 'number' ? config.port : 3037;
            return await openClawService.startGateway(port);
        });

        ipcMain.handle('openclaw:stop-gateway', () => {
            openClawService.stopGateway();
            return true;
        });

        ipcMain.handle('openclaw:run-doctor', async () => {
            return await openClawService.runDoctor();
        });

        ipcMain.handle('openclaw:approve-pairing', async (_event, channel, code) => {
            console.assert(typeof channel === 'string' && typeof code === 'string', 'Channel and code must be strings');
            return await openClawService.approvePairing(channel, code);
        });

        ipcMain.handle('openclaw:run-agent', (_event, message, thinkingDepth) => {
            console.assert(typeof message === 'string', 'Agent message must be a string');
            openClawService.runAgentStream(
                message,
                thinkingDepth || 'medium',
                (chunk) => {
                    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                        this.mainWindow.webContents.send('openclaw:agent-stream', chunk);
                    }
                },
                (code) => {
                    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                        this.mainWindow.webContents.send('openclaw:agent-complete', code);
                    }
                }
            );
            return true;
        });

        ipcMain.handle('openclaw:get-logs', () => {
            return openClawService.getLogs();
        });
    }
}

