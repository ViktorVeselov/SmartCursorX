import { dialog } from 'electron';
import path from 'path';
import { createRequire } from 'module';
import { PathGuard } from '../services/PathGuard';
import { CodeAnalysisService } from '../services/CodeAnalysisService';
import { checkArgs } from '../../src/helpers/invariant';
import type { IpcHandlerContext } from './index';

const require = createRequire(import.meta.url);
const fs = require('fs').promises;

function getWorkspacePath(context: IpcHandlerContext): string {
    return context.workspacePath || PathGuard.getWorkspacePath() || '';
}

function resolveWorkspacePath(filePath: string, context: IpcHandlerContext): string {
    const workspacePath = getWorkspacePath(context);
    if (!workspacePath) return filePath;
    return path.isAbsolute(filePath) ? filePath : path.resolve(workspacePath, filePath);
}

export function registerFileSystemHandlers(ipcMain: Electron.IpcMain, context: IpcHandlerContext) {
    ipcMain.handle('native-search', async (_event, options) => {
        if (!context.native) throw new Error('Native module not loaded');
        const result = await context.native.searchFiles(options);
        _event.sender.send('main-process-message', {
            type: 'file-search',
            query: options.query || options.pattern || '',
            resultsCount: Array.isArray(result) ? result.length : (result && Array.isArray(result.results) ? result.results.length : 0),
            timestamp: Date.now()
        });
        return result;
    });

    ipcMain.handle('native-health-check', async () => {
        if (!context.native) return 'Native module failed to load';
        return context.native.nativeHealthCheck();
    });

    ipcMain.handle('read-dir', async (_event, dirPath) => {
        if (typeof dirPath !== 'string') throw new Error('Invalid path argument');
        const resolvedPath = resolveWorkspacePath(dirPath, context);
        if (!PathGuard.isContained(resolvedPath)) {
            throw new Error(`Security: Read directory "${dirPath}" is outside the workspace root`);
        }

        try {
            const names = await fs.readdir(resolvedPath);
            const items = await Promise.all(names.map(async (name: string) => {
                const fullPath = path.join(resolvedPath, name);
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
        const resolvedPath = resolveWorkspacePath(filePath, context);
        if (!PathGuard.isContained(resolvedPath)) {
            throw new Error(`Security: Read of "${filePath}" is outside the workspace root`);
        }

        const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.svg',
            '.pdf', '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib',
            '.woff', '.woff2', '.eot', '.ttf', '.mp4', '.mp3', '.wav', '.ogg'];
        const ext = path.extname(resolvedPath).toLowerCase();
        if (binaryExts.includes(ext)) {
            throw new Error(`Cannot read binary file "${path.basename(resolvedPath)}" — reading images, PDFs, and other binary files is not supported through the file read interface`);
        }

        try {
            _event.sender.send('main-process-message', {
                type: 'file-read',
                path: resolvedPath,
                timestamp: Date.now()
            });
            return await fs.readFile(resolvedPath, 'utf-8');
        } catch (err) {
            console.error('Error reading file:', err);
            throw err;
        }
    });

    ipcMain.handle('write-file', async (_event, filePath, content) => {
        if (typeof filePath !== 'string' || !filePath.trim()) throw new Error('Invalid file path');
        if (typeof content !== 'string') throw new Error('Invalid content');
        const resolvedPath = resolveWorkspacePath(filePath, context);
        if (!PathGuard.isContained(resolvedPath)) {
            throw new Error(`Security: Write to "${filePath}" is outside the workspace root`);
        }

        try {
            let additions = 0;
            let deletions = 0;
            try {
                const prevContent = await fs.readFile(resolvedPath, 'utf-8');
                const prevLines = prevContent.split('\n');
                const newLines = content.split('\n');

                const prevSet = new Set(prevLines.map((l: string) => l.trim()));
                const newSet = new Set(newLines.map((l: string) => l.trim()));

                for (const line of newLines) {
                    if (!prevSet.has(line.trim())) additions++;
                }
                for (const line of prevLines) {
                    if (!newSet.has(line.trim())) deletions++;
                }
            } catch (e) {
                additions = content.split('\n').length;
            }

            await fs.writeFile(resolvedPath, content, 'utf-8');

            _event.sender.send('main-process-message', {
                type: 'file-write',
                path: resolvedPath,
                additions,
                deletions,
                timestamp: Date.now()
            });
            return true;
        } catch (err) {
            console.error('Error writing file:', err);
            throw err;
        }
    });

    ipcMain.handle('delete-path', async (_event, targetPath) => {
        if (typeof targetPath !== 'string') throw new Error('Invalid path argument');
        const resolvedPath = resolveWorkspacePath(targetPath, context);
        if (!PathGuard.isContained(resolvedPath)) {
            throw new Error(`Security: Delete of "${targetPath}" is outside the workspace root`);
        }
        try {
            const stats = await fs.stat(resolvedPath);
            if (stats.isDirectory()) {
                await fs.rm(resolvedPath, { recursive: true, force: true });
            } else {
                await fs.unlink(resolvedPath);
            }
            return true;
        } catch (err) {
            console.error('Error deleting path:', err);
            throw err;
        }
    });

    ipcMain.handle('rename-path', async (_event, oldPath, newPath) => {
        if (typeof oldPath !== 'string' || typeof newPath !== 'string') throw new Error('Invalid path arguments');
        const resolvedOldPath = resolveWorkspacePath(oldPath, context);
        const resolvedNewPath = resolveWorkspacePath(newPath, context);
        if (!PathGuard.isContained(resolvedOldPath)) {
            throw new Error(`Security: Rename source "${oldPath}" is outside the workspace root`);
        }
        if (!PathGuard.isContained(resolvedNewPath)) {
            throw new Error(`Security: Rename target "${newPath}" is outside the workspace root`);
        }
        try {
            await fs.rename(resolvedOldPath, resolvedNewPath);
            return true;
        } catch (err) {
            console.error('Error renaming path:', err);
            throw err;
        }
    });

    ipcMain.handle('create-directory', async (_event, dirPath) => {
        if (typeof dirPath !== 'string') throw new Error('Invalid path argument');
        const resolvedPath = resolveWorkspacePath(dirPath, context);
        if (!PathGuard.isContained(resolvedPath)) {
            throw new Error(`Security: Create directory "${dirPath}" is outside the workspace root`);
        }
        try {
            await fs.mkdir(resolvedPath, { recursive: true });
            return true;
        } catch (err) {
            console.error('Error creating directory:', err);
            throw err;
        }
    });

    ipcMain.handle('resolve-path', async (_event, ...paths) => {
        try {
            const workspacePath = getWorkspacePath(context);
            if (paths.length === 0) {
                return workspacePath || path.resolve('.');
            }
            // If first path is relative and workspace exists, resolve against workspace
            const firstPath = paths[0];
            if (workspacePath && !path.isAbsolute(firstPath)) {
                return path.resolve(workspacePath, ...paths);
            }
            return path.resolve(...paths);
        } catch (err) {
            console.error('Error resolving path:', err);
            return '';
        }
    });

    ipcMain.handle('dialog-open-folder', async () => {
        if (!context.mainWindow) return null;
        const result = await dialog.showOpenDialog(context.mainWindow, {
            properties: ['openDirectory']
        });
        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }
        return result.filePaths[0];
    });

    ipcMain.handle('dialog-save-file', async (_event, defaultName?: string) => {
        if (!context.mainWindow) return null;
        const result = await dialog.showSaveDialog(context.mainWindow, {
            defaultPath: defaultName || 'untitled.txt',
            properties: ['showOverwriteConfirmation']
        });
        if (result.canceled || !result.filePath) {
            return null;
        }
        return result.filePath;
    });

    ipcMain.handle('dialog-open-file', async () => {
        if (!context.mainWindow) return null;
        const result = await dialog.showOpenDialog(context.mainWindow, {
            properties: ['openFile']
        });
        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }
        return result.filePaths[0];
    });

    ipcMain.handle('code:get-symbols', async (_event, filePath: string) => {
        checkArgs(typeof filePath === 'string' && filePath.length > 0, 'filePath must be a valid non-empty string');
        return CodeAnalysisService.parseFileSymbols(filePath);
    });

    ipcMain.handle('code:find-references', async (_event, symbolName: string, rootPath: string) => {
        checkArgs(typeof symbolName === 'string' && symbolName.length > 0, 'symbolName must be a valid non-empty string');
        checkArgs(typeof rootPath === 'string' && rootPath.length > 0, 'rootPath must be a valid non-empty string');
        return CodeAnalysisService.findReferences(symbolName, rootPath);
    });

    ipcMain.handle('code:get-call-hierarchy', async (_event, symbolName: string, rootPath: string, direction: 'incoming' | 'outgoing') => {
        checkArgs(typeof symbolName === 'string' && symbolName.length > 0, 'symbolName must be a valid non-empty string');
        checkArgs(typeof rootPath === 'string' && rootPath.length > 0, 'rootPath must be a valid non-empty string');
        checkArgs(['incoming', 'outgoing'].includes(direction), 'Invalid direction: must be incoming or outgoing');
        return CodeAnalysisService.getCallHierarchy(symbolName, rootPath, direction);
    });

    ipcMain.handle('code:get-workspace-outline', async (_event, rootPath: string) => {
        checkArgs(typeof rootPath === 'string' && rootPath.length > 0, 'rootPath must be a valid non-empty string');
        return CodeAnalysisService.getWorkspaceOutline(rootPath);
    });
}
