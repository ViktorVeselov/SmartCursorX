import { spawn, ChildProcess } from 'child_process';
import { app } from 'electron';
import console from 'console';

export interface OpenClawStatus {
    isRunning: boolean;
    pid: number | null;
    version: string;
    logs: string[];
}

export class OpenClawService {
    private static instance: OpenClawService;
    private gatewayProcess: ChildProcess | null = null;
    private logs: string[] = [];
    private maxLogs = 200;
    private cachedVersion: string = '';

    private constructor() {
        app.on('will-quit', () => {
            this.stopGateway();
        });
    }

    static getInstance(): OpenClawService {
        if (!OpenClawService.instance) {
            OpenClawService.instance = new OpenClawService();
        }
        return OpenClawService.instance;
    }

    private addLog(line: string) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        this.logs.push(`[${timestamp}] ${line}`);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    }

    getLogs(): string[] {
        return this.logs;
    }

    async checkVersion(): Promise<string> {
        if (this.cachedVersion) return this.cachedVersion;

        return new Promise((resolve) => {
            try {
                const child = spawn('openclaw', ['--version']);

                let output = '';
                child.stdout?.on('data', (data) => {
                    output += data.toString();
                });

                child.on('close', (code) => {
                    if (code === 0 && output.trim()) {
                        this.cachedVersion = output.trim();
                        resolve(this.cachedVersion);
                    } else {
                        resolve('');
                    }
                });

                child.on('error', () => {
                    resolve('');
                });
            } catch (e) {
                console.error('[OpenClawService] Failed to check version:', e);
                resolve('');
            }
        });
    }

    async checkInstalled(): Promise<boolean> {
        const ver = await this.checkVersion();
        return ver.length > 0;
    }

    async startGateway(port: number = 3037): Promise<boolean> {
        if (this.gatewayProcess) {
            this.stopGateway();
        }

        this.addLog(`Starting OpenClaw Gateway on port ${port}...`);

        try {
            // Check if openclaw is available
            const installed = await this.checkInstalled();
            if (!installed) {
                this.addLog('Error: openclaw CLI is not installed or not in PATH.');
                return false;
            }

            // Spawn the openclaw gateway daemon
            // Typical command: openclaw gateway start --port 3037 (or similar, depending on configuration)
            // We use system environment for PATH resolution
            this.gatewayProcess = spawn('openclaw', ['gateway', 'start', '--port', port.toString()], {
                env: { ...process.env }
            });

            this.gatewayProcess.stdout?.on('data', (data) => {
                const text = data.toString().trim();
                if (text) {
                    this.addLog(`STDOUT: ${text}`);
                    console.log(`[OpenClaw Gateway STDOUT]: ${text}`);
                }
            });

            this.gatewayProcess.stderr?.on('data', (data) => {
                const text = data.toString().trim();
                if (text) {
                    this.addLog(`STDERR: ${text}`);
                    console.error(`[OpenClaw Gateway STDERR]: ${text}`);
                }
            });

            this.gatewayProcess.on('close', (code) => {
                this.addLog(`Gateway process closed with code ${code}`);
                this.gatewayProcess = null;
            });

            return true;
        } catch (e: any) {
            this.addLog(`Failed to spawn gateway process: ${e.message || e}`);
            this.gatewayProcess = null;
            return false;
        }
    }

    stopGateway() {
        if (this.gatewayProcess) {
            this.addLog('Stopping OpenClaw Gateway...');
            try {
                if (process.platform === 'win32') {
                    spawn('taskkill', ['/pid', this.gatewayProcess.pid!.toString(), '/f', '/t']);
                } else {
                    this.gatewayProcess.kill('SIGINT');
                }
            } catch (e: any) {
                this.addLog(`Error stopping gateway: ${e.message || e}`);
            }
            this.gatewayProcess = null;
            this.addLog('Gateway stopped.');
        }
    }

    async getStatus(): Promise<OpenClawStatus> {
        const version = await this.checkVersion();
        return {
            isRunning: this.gatewayProcess !== null,
            pid: this.gatewayProcess ? this.gatewayProcess.pid || null : null,
            version,
            logs: this.logs
        };
    }

    async runDoctor(): Promise<string> {
        this.addLog('Running diagnostics (openclaw doctor)...');
        return new Promise((resolve) => {
            try {
                const child = spawn('openclaw', ['doctor']);

                let output = '';
                child.stdout?.on('data', (data) => {
                    output += data.toString();
                });
                child.stderr?.on('data', (data) => {
                    output += data.toString();
                });

                child.on('close', (code) => {
                    this.addLog(`Doctor execution completed with code ${code}`);
                    resolve(output || 'Diagnostics ran but returned empty output.');
                });

                child.on('error', (err) => {
                    resolve(`Failed to run diagnostics: ${err.message}`);
                });
            } catch (e: any) {
                resolve(`Error spawning openclaw doctor: ${e.message || e}`);
            }
        });
    }

    async approvePairing(channel: string, code: string): Promise<boolean> {
        this.addLog(`Approving pairing request for channel "${channel}" with code "${code}"...`);
        return new Promise((resolve) => {
            try {
                const child = spawn('openclaw', ['pairing', 'approve', channel, code]);

                let output = '';
                child.stdout?.on('data', (data) => {
                    output += data.toString();
                });
                child.stderr?.on('data', (data) => {
                    output += data.toString();
                });

                child.on('close', (code) => {
                    this.addLog(`Pairing approved result (code ${code}): ${output.trim()}`);
                    resolve(code === 0);
                });

                child.on('error', (err) => {
                    this.addLog(`Pairing failed to run: ${err.message}`);
                    resolve(false);
                });
            } catch (e: any) {
                this.addLog(`Pairing approve exception: ${e.message || e}`);
                resolve(false);
            }
        });
    }

    // Stream-capable runAgent. Calls callbacks for stdout stream chunks.
    runAgentStream(
        message: string,
        thinkingDepth: string = 'medium',
        onChunk: (chunk: string) => void,
        onClose: (code: number) => void
    ) {
        this.addLog(`Invoking agent with message "${message.substring(0, 30)}..." and thinking depth "${thinkingDepth}"`);
        try {
            // CLI command syntax: openclaw agent --message "msg" --thinking depth
            const child = spawn('openclaw', ['agent', '--message', message, '--thinking', thinkingDepth]);

            child.stdout?.on('data', (data) => {
                onChunk(data.toString());
            });

            child.stderr?.on('data', (data) => {
                onChunk(data.toString());
            });

            child.on('close', (code) => {
                this.addLog(`Agent execution closed with code ${code}`);
                onClose(code || 0);
            });

            child.on('error', (err) => {
                onChunk(`\nError executing agent: ${err.message}`);
                onClose(1);
            });
        } catch (e: any) {
            onChunk(`\nException invoking openclaw agent: ${e.message || e}`);
            onClose(1);
        }
    }
}

export const openClawService = OpenClawService.getInstance();
