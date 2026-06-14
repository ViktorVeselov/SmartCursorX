import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { dbService } from '../db';
import console from 'console';

export class SnapshotService {
    private static getWhitelistedRoots(workspacePath?: string | null): string[] {
        if (workspacePath && workspacePath.trim().length > 0) {
            const workspaceRoot = path.resolve(workspacePath);
            const parentRoot = path.resolve(workspaceRoot, '..');
            return [
                workspaceRoot,
                path.resolve(parentRoot, 'adk-python-community'),
                path.resolve(parentRoot, 'google-sdk')
            ];
        }
        return [];
    }

    private static normalizePathForCompare(p: string): string {
        let resolved = path.resolve(p);
        if (process.platform === 'win32') {
            resolved = resolved.toLowerCase();
        }
        return resolved;
    }

    private static resolveToAllowedRoot(relativePath: string, workspacePath?: string | null): string | null {
        const roots = this.getWhitelistedRoots(workspacePath);
        for (const root of roots) {
            const resolvedPath = path.isAbsolute(relativePath)
                ? relativePath
                : path.resolve(root, relativePath);
            const normRoot = this.normalizePathForCompare(root);
            const normResolved = this.normalizePathForCompare(resolvedPath);
            
            const relative = path.relative(normRoot, normResolved);
            const contained = relative === '' || (relative && !relative.startsWith('..') && !path.isAbsolute(relative));
            if (contained) {
                return resolvedPath;
            }
        }
        return null;
    }

    /**
     * Captures a full snapshot of the specified files across allowed roots and saves them to the DB as version control blobs.
     */
    static captureSnapshot(taskId: number, filePaths: string[], name: string): number {
        console.assert(typeof taskId === 'number', 'taskId must be a valid number');
        console.assert(Array.isArray(filePaths), 'filePaths must be an array of strings');
        console.assert(typeof name === 'string' && name.length > 0, 'name must be a valid non-empty string');

        console.log(`[SnapshotService] Capturing snapshot "${name}" for task ID ${taskId}...`);
        
        const workspacePath = dbService.getWorkspacePathForTask(taskId);
        const snapshotIdRaw = dbService.createSnapshot(`${name}_task_${taskId}`);
        const snapshotId = Number(snapshotIdRaw);
        console.assert(snapshotId > 0, 'Snapshot ID must be a positive integer');

        for (const file of filePaths) {
            const absolutePath = this.resolveToAllowedRoot(file, workspacePath);
            if (absolutePath && fs.existsSync(absolutePath)) {
                try {
                    const content = fs.readFileSync(absolutePath, 'utf-8');
                    const hash = crypto.createHash('sha256').update(content).digest('hex');

                    dbService.addBlob(hash, content);
                    dbService.addSnapshotFile(snapshotId, absolutePath, hash);
                    
                    console.log(`[SnapshotService] Snapshotted file: ${file} (resolved: ${absolutePath}, hash: ${hash.substring(0, 8)})`);
                } catch (err) {
                    console.error(`[SnapshotService] Failed snapshotting file ${file}:`, err);
                }
            } else {
                console.warn(`[SnapshotService] Target file ${file} does not exist or is out of bounds. Skipping blob generation.`);
            }
        }

        return snapshotId;
    }

    /**
     * Restores the workspace files precisely back to the captured state of a given snapshot ID, strictly enforcing allowed root containment boundaries.
     */
    static rollbackToSnapshot(snapshotId: number): void {
        console.assert(typeof snapshotId === 'number' && snapshotId > 0, 'snapshotId must be a positive number');
        console.log(`[SnapshotService] Performing safe rollback to snapshot ID ${snapshotId}...`);

        const files = dbService.getSnapshotFiles(snapshotId);
        if (!files || files.length === 0) {
            console.warn(`[SnapshotService] Snapshot ID ${snapshotId} has no files archived. Rollback aborted.`);
            return;
        }

        const snapshot = dbService.getSnapshot(snapshotId);
        let workspacePath: string | null = null;
        if (snapshot && snapshot.name) {
            const match = snapshot.name.match(/_task_(\d+)/);
            if (match) {
                const taskId = parseInt(match[1], 10);
                workspacePath = dbService.getWorkspacePathForTask(taskId);
            }
        }

        for (const f of files) {
            const absolutePath = f.file_path;
            const content = f.content;

            // Security/containment check during rollback to prevent directory traversal
            const resolvedPath = this.resolveToAllowedRoot(absolutePath, workspacePath);
            if (!resolvedPath) {
                console.error(`[SnapshotService] Safety Block: Out-of-bounds rollback attempt rejected for path: ${absolutePath}`);
                throw new Error(`Rollback safety violation on path: ${absolutePath}`);
            }

            try {
                const parentDir = path.dirname(resolvedPath);
                if (!fs.existsSync(parentDir)) {
                    fs.mkdirSync(parentDir, { recursive: true });
                }

                fs.writeFileSync(resolvedPath, content, 'utf-8');
                console.log(`[SnapshotService] Restored file: ${resolvedPath}`);
            } catch (err) {
                console.error(`[SnapshotService] Failed restoring file ${resolvedPath} during rollback:`, err);
                throw new Error(`Rollback failed on file ${resolvedPath}: ${err}`);
            }
        }

        console.log('[SnapshotService] Rollback completed successfully.');
    }

    /**
     * Retrieves a snapshot ID by its name pattern.
     */
    static getSnapshotIdByName(name: string): number | null {
        try {
            const snapshots = dbService.getSnapshots();
            const match = (snapshots as any[]).find((s: any) => s.name === name || s.name.includes(name));
            return match ? Number(match.id) : null;
        } catch (err) {
            console.error('[SnapshotService] Failed to find snapshot by name:', err);
            return null;
        }
    }

    /**
     * Restores a single file from a snapshot (used when user rejects individual file changes).
     */
    static rollbackSingleFile(snapshotId: number, filePath: string): void {
        console.assert(typeof snapshotId === 'number' && snapshotId > 0, 'snapshotId must be a positive number');
        console.assert(typeof filePath === 'string' && filePath.length > 0, 'filePath must be a non-empty string');
        console.log(`[SnapshotService] Rolling back single file: ${filePath} from snapshot ID ${snapshotId}...`);

        const files = dbService.getSnapshotFiles(snapshotId);
        if (!files || files.length === 0) {
            console.warn(`[SnapshotService] Snapshot ID ${snapshotId} has no files archived. Single rollback aborted.`);
            return;
        }

        const snapshot = dbService.getSnapshot(snapshotId);
        let workspacePath: string | null = null;
        if (snapshot && snapshot.name) {
            const match = snapshot.name.match(/_task_(\d+)/);
            if (match) {
                const taskId = parseInt(match[1], 10);
                workspacePath = dbService.getWorkspacePathForTask(taskId);
            }
        }

        const f = files.find((file: any) => {
            const normSnapshot = this.normalizePathForCompare(file.file_path);
            const normTarget = this.normalizePathForCompare(filePath);
            return normSnapshot === normTarget;
        });

        if (!f) {
            console.warn(`[SnapshotService] File ${filePath} not found in snapshot ID ${snapshotId}. Cannot rollback single file.`);
            return;
        }

        const resolvedPath = this.resolveToAllowedRoot(f.file_path, workspacePath);
        if (!resolvedPath) {
            console.error(`[SnapshotService] Safety Block: Out-of-bounds rollback attempt rejected for path: ${f.file_path}`);
            throw new Error(`Rollback safety violation on path: ${f.file_path}`);
        }

        try {
            const parentDir = path.dirname(resolvedPath);
            if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, { recursive: true });
            }
            fs.writeFileSync(resolvedPath, f.content, 'utf-8');
            console.log(`[SnapshotService] Restored single file: ${resolvedPath}`);
        } catch (err) {
            console.error(`[SnapshotService] Failed restoring file ${resolvedPath} during single rollback:`, err);
            throw new Error(`Single rollback failed on file ${resolvedPath}: ${err}`);
        }
    }
}

