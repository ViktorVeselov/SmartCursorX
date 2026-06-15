import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { registerFileSystemHandlers } from './filesystem';
import { registerAIHandlers } from './ai';
import { registerGitHandlers } from './git';
import { registerDBHandlers } from './db';
import { registerShellHandlers } from './shell';
import { registerSettingsHandlers } from './settings';
import { registerExecutionHandlers } from './execution';
import { registerFinetuningHandlers } from './finetuning';

export interface IPty {
    pid: number;
    cols: number;
    rows: number;
    on(event: string, callback: (data: any) => void): void;
    write(data: string): void;
    resize(cols: number, rows: number): void;
    kill(): void;
}

export interface IpcHandlerContext {
    mainWindow: BrowserWindow | null;
    native: any;
    ptyProcesses: Map<string, IPty>;
    activeStreamAborted: boolean;
    workspacePath: string;
}

export function registerAllHandlers(context: IpcHandlerContext) {
    registerFileSystemHandlers(ipcMain, context);
    registerAIHandlers(ipcMain, context);
    registerGitHandlers(ipcMain, context);
    registerDBHandlers(ipcMain);
    registerShellHandlers(ipcMain, context);
    registerSettingsHandlers(ipcMain);
    registerExecutionHandlers(ipcMain, context);
    registerFinetuningHandlers(ipcMain);
}
