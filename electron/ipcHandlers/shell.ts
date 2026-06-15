import { openClawService } from '../services/OpenClawService';
import { checkArgs } from '../../src/helpers/invariant';
import type { IpcHandlerContext } from './index';

export function registerShellHandlers(ipcMain: Electron.IpcMain, context: IpcHandlerContext) {
    ipcMain.on('renderer:log', (_event, level: string, ...args: any[]) => {
        const prefix = '[RENDERER]';
        if (level === 'error') {
            console.error(prefix, ...args);
        } else if (level === 'warn') {
            console.warn(prefix, ...args);
        } else {
            console.log(prefix, ...args);
        }
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const os = require('os');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pty = require('node-pty');
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

    ipcMain.handle('term-init', (_event, terminalId: string, shellType?: string) => {
        if (!terminalId) {
            terminalId = `term-${Date.now()}`;
        }

        let selectedShell = shell;
        if (shellType) {
            if (os.platform() === 'win32') {
                if (shellType === 'powershell') {
                    selectedShell = 'powershell.exe';
                } else if (shellType === 'cmd') {
                    selectedShell = 'cmd.exe';
                } else if (shellType === 'bash') {
                    selectedShell = 'bash.exe';
                } else {
                    selectedShell = shellType;
                }
            } else {
                if (shellType === 'zsh') {
                    selectedShell = 'zsh';
                } else if (shellType === 'bash') {
                    selectedShell = 'bash';
                } else if (shellType === 'sh') {
                    selectedShell = 'sh';
                } else {
                    selectedShell = shellType;
                }
            }
        }

        if (context.ptyProcesses.has(terminalId)) {
            try { context.ptyProcesses.get(terminalId)!.kill(); } catch (e) { }
            context.ptyProcesses.delete(terminalId);
        }

        const safeEnv = Object.fromEntries(
            Object.entries(process.env).filter(([key]) =>
                !/api[_-]?key|secret|token|password|credential/i.test(key)
            )
        );
        const ptyProcess = pty.spawn(selectedShell, [], {
            name: 'xterm-color',
            cols: 80,
            rows: 24,
            cwd: process.env.USERPROFILE || process.env.HOME,
            env: safeEnv
        }) as any;

        context.ptyProcesses.set(terminalId, ptyProcess);

        ptyProcess.on('data', (data: string) => {
            if (context.mainWindow && !context.mainWindow.isDestroyed()) {
                context.mainWindow.webContents.send('terminal-incoming', terminalId, data);
            }
        });

        ptyProcess.on('exit', () => {
            context.ptyProcesses.delete(terminalId);
            if (context.mainWindow && !context.mainWindow.isDestroyed()) {
                context.mainWindow.webContents.send('terminal-exit', terminalId);
            }
        });

        return { terminalId, pid: ptyProcess.pid };
    });

    ipcMain.handle('term-input', (_event, terminalId: string, data: string) => {
        const ptyProcess = context.ptyProcesses.get(terminalId);
        if (ptyProcess) {
            ptyProcess.write(data);
        }
    });

    ipcMain.handle('term-resize', (_event, terminalId: string, cols: number, rows: number) => {
        const ptyProcess = context.ptyProcesses.get(terminalId);
        if (ptyProcess) {
            ptyProcess.resize(cols, rows);
        }
    });

    ipcMain.handle('term-close', (_event, terminalId: string) => {
        const ptyProcess = context.ptyProcesses.get(terminalId);
        if (ptyProcess) {
            try { ptyProcess.kill(); } catch (e) { }
            context.ptyProcesses.delete(terminalId);
        }
        return true;
    });

    // OpenClaw handlers
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
        checkArgs(typeof channel === 'string' && typeof code === 'string', 'Channel and code must be strings');
        return await openClawService.approvePairing(channel, code);
    });

    ipcMain.handle('openclaw:run-agent', (_event, message, thinkingDepth) => {
        checkArgs(typeof message === 'string' && message.length > 0, 'Agent message must be a non-empty string');
        openClawService.runAgentStream(
            message,
            thinkingDepth || 'medium',
            (chunk) => {
                if (context.mainWindow && !context.mainWindow.isDestroyed()) {
                    context.mainWindow.webContents.send('openclaw:agent-stream', chunk);
                }
            },
            (code) => {
                if (context.mainWindow && !context.mainWindow.isDestroyed()) {
                    context.mainWindow.webContents.send('openclaw:agent-complete', code);
                }
            }
        );
        return true;
    });

    ipcMain.handle('openclaw:get-logs', () => {
        return openClawService.getLogs();
    });

    ipcMain.handle('shell:exec', async (_event, command: string) => {
        const { execSync } = require('child_process');
        try {
            const stdout = execSync(command, { encoding: 'utf-8', timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
            return { stdout: stdout.trim(), stderr: '' };
        } catch (err: any) {
            return { stdout: err.stdout?.trim() || '', stderr: err.stderr?.trim() || err.message };
        }
    });
}
