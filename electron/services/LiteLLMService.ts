import { spawn, ChildProcess } from 'child_process';
import { app } from 'electron';
import console from 'console';

export interface LiteLLMProxyConfig {
    enabled: boolean;
    port: number;
    model?: string;
    configPath?: string;
    // Cloud Credentials
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    awsRegion?: string;
    vertexProject?: string;
    vertexLocation?: string;
    azureApiKey?: string;
    azureApiBase?: string;
    azureApiVersion?: string;
}

export class LiteLLMService {
    private static instance: LiteLLMService;
    private proxyProcess: ChildProcess | null = null;

    private constructor() {
        // Safe process teardown on exit
        app.on('will-quit', () => {
            this.stopProxy();
        });
    }

    static getInstance(): LiteLLMService {
        if (!LiteLLMService.instance) {
            LiteLLMService.instance = new LiteLLMService();
        }
        return LiteLLMService.instance;
    }

    async startProxy(config: LiteLLMProxyConfig): Promise<boolean> {
        if (!config.enabled) {
            this.stopProxy();
            return false;
        }

        // Kill existing if already running
        this.stopProxy();

        console.log('[LiteLLMService] Starting Local Proxy on port', config.port);

        const args: string[] = ['--port', config.port.toString()];

        if (config.configPath && config.configPath.trim().length > 0) {
            args.push('--config', config.configPath.trim());
        } else if (config.model && config.model.trim().length > 0) {
            args.push('--model', config.model.trim());
        } else {
            args.push('--model', 'gpt-4o'); // Fallback
        }

        // Clone current env and inject secure credentials
        const env = { ...process.env };

        if (config.awsAccessKeyId) env.AWS_ACCESS_KEY_ID = config.awsAccessKeyId;
        if (config.awsSecretAccessKey) env.AWS_SECRET_ACCESS_KEY = config.awsSecretAccessKey;
        if (config.awsRegion) env.AWS_REGION_NAME = config.awsRegion;

        if (config.vertexProject) env.VERTEXAI_PROJECT = config.vertexProject;
        if (config.vertexLocation) env.VERTEXAI_LOCATION = config.vertexLocation;

        if (config.azureApiKey) env.AZURE_API_KEY = config.azureApiKey;
        if (config.azureApiBase) env.AZURE_API_BASE = config.azureApiBase;
        if (config.azureApiVersion) env.AZURE_API_VERSION = config.azureApiVersion;

        try {
            // Spawn litellm securely as a safe shell command
            const command = process.platform === 'win32' ? 'litellm.exe' : 'litellm';
            
            this.proxyProcess = spawn(command, args, {
                env,
                shell: process.platform === 'win32' // Safe shell wrapper for Windows system PATH
            });

            this.proxyProcess.stdout?.on('data', (data) => {
                console.log(`[LiteLLM Proxy STDOUT]: ${data}`);
            });

            this.proxyProcess.stderr?.on('data', (data) => {
                console.error(`[LiteLLM Proxy STDERR]: ${data}`);
            });

            this.proxyProcess.on('close', (code) => {
                console.log(`[LiteLLM Proxy] Exited with code ${code}`);
                this.proxyProcess = null;
            });

            return true;
        } catch (e) {
            console.error('[LiteLLMService] Failed to spawn litellm:', e);
            this.proxyProcess = null;
            return false;
        }
    }

    stopProxy() {
        if (this.proxyProcess) {
            console.log('[LiteLLMService] Stopping Local Proxy Process...');
            try {
                if (process.platform === 'win32') {
                    // Windows process group kill fallback to prevent dangling cmd shells
                    spawn('taskkill', ['/pid', this.proxyProcess.pid!.toString(), '/f', '/t']);
                } else {
                    this.proxyProcess.kill('SIGINT');
                }
            } catch (e) {
                console.error('[LiteLLMService] Error killing proxy process:', e);
            }
            this.proxyProcess = null;
        }
    }

    isProxyActive(): boolean {
        return this.proxyProcess !== null;
    }
}

export const liteLLMService = LiteLLMService.getInstance();
