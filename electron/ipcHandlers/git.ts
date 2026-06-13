import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import { dbService } from '../db';
import { checkArgs, assertNonNull } from '../../src/helpers/invariant';
import type { IpcHandlerContext } from './index';

const require = createRequire(import.meta.url);
const fs = require('fs').promises;
const { execFile } = require('child_process');

const execGitSafe = (args: string[], cwd: string): Promise<string> => {
    checkArgs(Array.isArray(args), 'args must be an array of strings');
    checkArgs(args.every((a: any) => typeof a === 'string'), 'Every argument must be a string');
    checkArgs(typeof cwd === 'string', 'cwd must be a string');
    return new Promise((resolve, reject) => {
        execFile('git', args, { cwd, maxBuffer: 1024 * 1024 * 10 }, (error: any, stdout: string) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout.trim());
        });
    });
};

export function registerGitHandlers(ipcMain: Electron.IpcMain, context: IpcHandlerContext) {
    ipcMain.handle('git-status', async (_event, rootPath: string) => {
        const targetPath = (!rootPath || rootPath === '.') ? process.cwd() : rootPath;
        try {
            const status = await execGitSafe(['status', '--porcelain'], targetPath);
            return status.split('\n').filter(Boolean).map((line: string) => {
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
        checkArgs(typeof repoUrl === 'string' && repoUrl.trim().length > 0, 'repoUrl must be a valid non-empty string');
        checkArgs(typeof destinationDir === 'string' && destinationDir.trim().length > 0, 'destinationDir must be a valid non-empty string');

        let targetUrl = repoUrl.trim();
        if (!targetUrl.startsWith('https://') && !targetUrl.startsWith('git@') && !targetUrl.startsWith('http://')) {
            targetUrl = `https://github.com/${targetUrl}`;
        }

        try {
            const parentDir = path.dirname(destinationDir);
            const folderName = path.basename(destinationDir);
            await fs.mkdir(parentDir, { recursive: true });

            const { spawn } = require('child_process');
            const gitProc = spawn('git', ['clone', '--progress', targetUrl, folderName], { cwd: parentDir });
            gitProc.stderr.setEncoding('utf8');
            gitProc.stderr.on('data', (data: string) => {
                if (context.mainWindow && !context.mainWindow.isDestroyed()) {
                    context.mainWindow.webContents.send('git-clone-progress', data);
                }
            });
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
            checkArgs(typeof file === 'string' && file.length > 0, 'file argument must be a non-empty string');
            return await execGitSafe(['diff', 'HEAD', '--', file], targetPath);
        } catch (e) {
            return '';
        }
    });

    ipcMain.handle('vc-create-snapshot', async (_event, name: string, rootPath: string) => {
        const targetPath = (!rootPath || rootPath === '.') ? process.cwd() : rootPath;

        console.log('[VC] Creating snapshot:', name, 'for', targetPath);
        const snapshotId = dbService.createSnapshot(name);

        const walk = async (dir: string) => {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const res = path.resolve(dir, entry.name);
                    if (entry.isDirectory()) {
                        if (['node_modules', '.git', 'dist', 'target', 'build', '.idea', '.vscode', 'out', 'bin', 'obj'].includes(entry.name)) continue;
                        await walk(res);
                    } else {
                        try {
                            const content = await fs.readFile(res, 'utf-8');
                            const hash = crypto.createHash('sha256').update(content).digest('hex');
                            dbService.addBlob(hash, content);
                            dbService.addSnapshotFile(snapshotId, res, hash);
                        } catch (e) {
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

    ipcMain.handle('vc-get-snapshots', () => {
        return dbService.getSnapshots();
    });

    ipcMain.handle('vc-restore-snapshot', async (_event, snapshotId: number) => {
        checkArgs(typeof snapshotId === 'number', 'snapshotId must be a number');
        console.log('[VC] Restoring snapshot:', snapshotId);
        const files = dbService.getSnapshotFiles(snapshotId);
        assertNonNull(files, 'Snapshot files from dbService.getSnapshotFiles');
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
