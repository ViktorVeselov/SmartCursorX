import path from 'path';
import os from 'os';
import { createRequire } from 'module';
import { PendingModificationsService } from '../services/PendingModificationsService';
import { SnapshotService } from '../services/SnapshotService';
import { SessionChangesTrackerService } from '../services/SessionChangesTrackerService';
import { secureStore } from '../secureStore';
import type { IpcHandlerContext } from './index';

const require = createRequire(import.meta.url);
const fs = require('fs').promises;
const { execFile } = require('child_process');

const execGitSafe = (args: string[], cwd: string): Promise<string> => {
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

interface ChangeItemMetadata {
    relativePath: string;
    absolutePath: string;
    status: 'pending' | 'accepted' | 'git-modified' | 'git-untracked';
    taskId?: number;
    addedLines: number;
    removedLines: number;
}

const normalizePath = (p: string): string => {
    let resolved = path.resolve(p);
    if (process.platform === 'win32') {
        resolved = resolved.toLowerCase();
    }
    return resolved;
};

async function getWorkspaceRoot(rootPath?: string): Promise<string> {
    if (rootPath && rootPath !== '.') return rootPath;
    const activePath = secureStore.getActiveWorkspacePath();
    if (activePath) return activePath;
    return process.cwd();
}

async function isGitRepo(cwd: string): Promise<boolean> {
    const normalized = normalizePath(cwd);
    const tmpDir = normalizePath(os.tmpdir());
    if (normalized === tmpDir || normalized.startsWith(tmpDir + path.sep)) {
        return false;
    }
    try {
        const gitPath = path.join(cwd, '.git');
        const stat = await fs.stat(gitPath);
        return stat.isDirectory() || stat.isFile();
    } catch {
        return false;
    }
}

async function countFileLines(absolutePath: string): Promise<number> {
    try {
        const content = await fs.readFile(absolutePath, 'utf-8');
        return content.split('\n').length;
    } catch {
        return 0;
    }
}

async function getGitStats(cwd: string): Promise<Map<string, { added: number, removed: number }>> {
    const statsMap = new Map<string, { added: number, removed: number }>();
    try {
        // Unstaged changes stats
        const unstagedStats = await execGitSafe(['diff', '--numstat'], cwd);
        for (const line of unstagedStats.split('\n').filter(Boolean)) {
            const parts = line.split(/\s+/);
            if (parts.length >= 3) {
                const [addedStr, removedStr, file] = parts;
                const added = parseInt(addedStr, 10) || 0;
                const removed = parseInt(removedStr, 10) || 0;
                statsMap.set(file, { added, removed });
            }
        }
        
        // Staged changes stats
        const stagedStats = await execGitSafe(['diff', '--cached', '--numstat'], cwd);
        for (const line of stagedStats.split('\n').filter(Boolean)) {
            const parts = line.split(/\s+/);
            if (parts.length >= 3) {
                const [addedStr, removedStr, file] = parts;
                const added = parseInt(addedStr, 10) || 0;
                const removed = parseInt(removedStr, 10) || 0;
                const existing = statsMap.get(file);
                if (existing) {
                    statsMap.set(file, { added: existing.added + added, removed: existing.removed + removed });
                } else {
                    statsMap.set(file, { added, removed });
                }
            }
        }
    } catch (e) {
        console.error('[ChangesHandler] Failed to get git stats:', e);
    }
    return statsMap;
}

async function getGitFileList(cwd: string, type: 'all' | 'accepted' | 'pending'): Promise<ChangeItemMetadata[]> {
    try {
        const status = await execGitSafe(['status', '--porcelain'], cwd);
        const results: ChangeItemMetadata[] = [];
        const statsMap = await getGitStats(cwd);

        for (const line of status.split('\n').filter(Boolean)) {
            if (line.length < 4) continue;
            const x = line.substring(0, 1);
            const y = line.substring(1, 2);
            const file = line.substring(3);
            const absolutePath = path.resolve(cwd, file);

            const isUntracked = x === '?' || y === '?';
            const isStaged = x !== ' ' && x !== '?';

            let statusVal: 'accepted' | 'git-modified' | 'git-untracked' = 'git-modified';
            if (isStaged) {
                statusVal = 'accepted';
            } else if (isUntracked) {
                statusVal = 'git-untracked';
            } else {
                statusVal = 'git-modified';
            }

            // Filter out unstaged changes if we only want staged/accepted changes
            if (type === 'accepted' && statusVal !== 'accepted') {
                continue;
            }

            let addedLines = 0;
            let removedLines = 0;

            if (isUntracked) {
                addedLines = await countFileLines(absolutePath);
            } else {
                const stats = statsMap.get(file);
                if (stats) {
                    addedLines = stats.added;
                    removedLines = stats.removed;
                }
            }

            results.push({
                relativePath: file,
                absolutePath,
                status: statusVal,
                addedLines,
                removedLines,
            });
        }
        return results;
    } catch (e) {
        console.error('[ChangesHandler] getGitFileList error:', e);
        return [];
    }
}

function getPendingFromAllTasks(): ChangeItemMetadata[] {
    const allPending = PendingModificationsService.getAllPending();
    const results: ChangeItemMetadata[] = [];
    for (const [taskId, taskMods] of allPending) {
        for (const mod of taskMods.modifications) {
            results.push({
                relativePath: mod.relativePath,
                absolutePath: mod.absolutePath,
                status: 'pending',
                taskId,
                addedLines: mod.addedLines,
                removedLines: mod.removedLines,
            });
        }
    }
    return results;
}

async function getAcceptedChanges(cwd?: string): Promise<ChangeItemMetadata[]> {
    const accepted = SessionChangesTrackerService.getAccepted();
    const resolved = normalizePath(cwd || await getWorkspaceRoot());
    const results: ChangeItemMetadata[] = [];
    for (const absPath of accepted) {
        const normalizedAbs = normalizePath(absPath);
        const relativePath = path.relative(resolved, normalizedAbs);
        if (relativePath.startsWith('..')) continue;
        let addedLines = 0;
        let removedLines = 0;
        try {
            const original = SessionChangesTrackerService.getOriginalContent(absPath) ?? '';
            let current: string | null = null;
            try {
                current = await fs.readFile(absPath, 'utf-8');
            } catch {
                current = null;
            }
            if (current === null) {
                if (original === '') {
                    continue;
                } else {
                    removedLines = original.split('\n').length;
                }
            } else {
                if (original === current) {
                    continue;
                }
                if (original === '') {
                    addedLines = current.split('\n').length;
                } else {
                    const origLines = original.split('\n');
                    const currLines = current.split('\n');
                    const maxLen = Math.max(origLines.length, currLines.length);
                    for (let i = 0; i < maxLen; i++) {
                        if (origLines[i] !== currLines[i]) {
                            if (i >= origLines.length) addedLines++;
                            else if (i >= currLines.length) removedLines++;
                            else { addedLines++; removedLines++; }
                        }
                    }
                }
            }
        } catch {}
        results.push({
            relativePath,
            absolutePath: absPath,
            status: SessionChangesTrackerService.getStatus(absPath) || ('accepted' as const),
            addedLines,
            removedLines,
        });
    }
    return results;
}

function deduplicateByAbsolutePath(items: ChangeItemMetadata[]): ChangeItemMetadata[] {
    const seen = new Map<string, ChangeItemMetadata>();
    const priority: Record<string, number> = {
        pending: 0,
        'git-modified': 1,
        'git-untracked': 2,
        accepted: 3,
    };
    for (const item of items) {
        const key = normalizePath(item.absolutePath);
        const existing = seen.get(key);
        if (!existing || (priority[item.status] < priority[existing.status])) {
            seen.set(key, item);
        }
    }
    return Array.from(seen.values());
}

export function registerChangesHandlers(ipcMain: Electron.IpcMain, _context: IpcHandlerContext) {
    ipcMain.handle('changes:is-git', async (_event, rootPath?: string) => {
        const cwd = await getWorkspaceRoot(rootPath);
        return isGitRepo(cwd);
    });

    ipcMain.handle('changes:get-list', async (_event, type: 'all' | 'accepted' | 'pending', rootPath?: string) => {
        const cwd = await getWorkspaceRoot(rootPath);
        const isGit = await isGitRepo(cwd);

        let items: ChangeItemMetadata[] = [];

        if (type === 'all' || type === 'pending') {
            items = items.concat(getPendingFromAllTasks());
            const acceptedChanges = await getAcceptedChanges(cwd);
            items = items.concat(acceptedChanges.filter(c => c.status === 'pending'));
        }
        if (type === 'all' || type === 'accepted') {
            if (isGit) {
                const gitFiles = await getGitFileList(cwd, type);
                items = items.concat(gitFiles);
            }
            const acceptedChanges = await getAcceptedChanges(cwd);
            items = items.concat(acceptedChanges.filter(c => c.status === 'accepted'));
        }

        return deduplicateByAbsolutePath(items);
    });

    ipcMain.handle('changes:get-file-content', async (_event, relativePath: string, status: string, taskId?: number) => {
        const cwd = await getWorkspaceRoot();
        const absolutePath = path.resolve(cwd, relativePath);

        let originalContent = '';
        let proposedContent = '';

        if (status === 'pending' && taskId !== undefined) {
            const pending = PendingModificationsService.getPending(taskId);
            if (pending) {
                const mod = pending.modifications.find(m => m.relativePath === relativePath);
                if (mod) {
                    originalContent = mod.originalContent;
                    proposedContent = mod.proposedContent;
                    return { originalContent, proposedContent };
                }
            }
        }

        const isGit = await isGitRepo(cwd);
        if (isGit) {
            try {
                const gitPath = relativePath.replace(/\\/g, '/');
                originalContent = await execGitSafe(['show', `HEAD:${gitPath}`], cwd);
            } catch {
                originalContent = '';
            }
        } else {
            try {
                const snapshotName = `pre_execution_${taskId ?? 0}`;
                const snapshotId = SnapshotService.getSnapshotIdByName(snapshotName);
                if (snapshotId !== null) {
                    const snapshots = (await import('../db')).dbService.getSnapshotFiles(snapshotId) as any[];
                    const match = snapshots.find((s: any) => {
                        return normalizePath(s.file_path) === normalizePath(absolutePath);
                    });
                    if (match) {
                        originalContent = match.content;
                    }
                }
            } catch {
                originalContent = '';
            }
        }

        if (!originalContent) {
            originalContent = SessionChangesTrackerService.getOriginalContent(absolutePath) ?? '';
        }

        try {
            proposedContent = await fs.readFile(absolutePath, 'utf-8');
        } catch {
            proposedContent = '';
        }

        return { originalContent, proposedContent };
    });

    ipcMain.handle('changes:stage-file', async (_event, relativePath: string, status: string, taskId?: number) => {
        const cwd = await getWorkspaceRoot();
        const absolutePath = path.resolve(cwd, relativePath);
        const isGit = await isGitRepo(cwd);

        if (status === 'pending' && taskId !== undefined) {
            const pending = PendingModificationsService.getPending(taskId);
            if (pending) {
                const mod = pending.modifications.find(m => m.relativePath === relativePath);
                if (mod) {
                    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
                    await fs.writeFile(absolutePath, mod.proposedContent, 'utf-8');
                    if (isGit) {
                        await execGitSafe(['add', relativePath], cwd);
                    } else {
                        SessionChangesTrackerService.trackAccepted(absolutePath, mod.originalContent, 'accepted');
                    }
                    pending.modifications = pending.modifications.filter(m => m.relativePath !== relativePath);
                    if (pending.modifications.length === 0) {
                        PendingModificationsService.resolvePending(taskId, true);
                    }
                }
            }
        } else {
            SessionChangesTrackerService.accept(absolutePath);
            if (isGit) {
                await execGitSafe(['add', relativePath], cwd);
            }
        }

        if (_event && _event.sender) {
            _event.sender.send('changes:updated', { relativePath, action: 'stage' });
        }

        return { success: true };
    });

    ipcMain.handle('changes:discard-file', async (_event, relativePath: string, status: string, taskId?: number) => {
        const cwd = await getWorkspaceRoot();
        const absolutePath = path.resolve(cwd, relativePath);
        const isGit = await isGitRepo(cwd);

        if (status === 'pending' && taskId !== undefined) {
            const pending = PendingModificationsService.getPending(taskId);
            if (pending) {
                pending.modifications = pending.modifications.filter(m => m.relativePath !== relativePath);
                if (pending.modifications.length === 0) {
                    PendingModificationsService.resolvePending(taskId, false);
                }
            }
        } else if (status === 'accepted') {
            const originalContent = SessionChangesTrackerService.getOriginalContent(absolutePath);
            if (originalContent !== undefined) {
                if (originalContent === '') {
                    try { await fs.unlink(absolutePath); } catch {}
                } else {
                    await fs.writeFile(absolutePath, originalContent, 'utf-8');
                }
            } else if (isGit) {
                try { await execGitSafe(['checkout', 'HEAD', '--', relativePath], cwd); } catch {}
            }
            SessionChangesTrackerService.untrack(absolutePath);
        } else if (isGit) {
            if (status === 'git-untracked') {
                try {
                    await fs.unlink(absolutePath);
                } catch {
                }
            } else {
                try {
                    await execGitSafe(['checkout', '--', relativePath], cwd);
                } catch {
                }
            }
        } else {
            const snapshotName = `pre_execution_${taskId ?? 0}`;
            const snapshotId = SnapshotService.getSnapshotIdByName(snapshotName);
            if (snapshotId !== null) {
                SnapshotService.rollbackSingleFile(snapshotId, absolutePath);
            }
        }

        if (_event && _event.sender) {
            _event.sender.send('changes:updated', { relativePath, action: 'discard' });
        }

        return { success: true };
    });
}
