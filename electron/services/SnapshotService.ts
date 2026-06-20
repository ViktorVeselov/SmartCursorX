import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { dbService } from '../db';
import { PathGuard } from './PathGuard';
import console from 'console';

export class SnapshotService {

    /**
     * Captures a full snapshot of the specified files across allowed roots and saves them to the DB as version control blobs.
     * @returns { snapshotId, skippedFiles } where skippedFiles are paths that didn't exist at capture time (new files).
     */
    static captureSnapshot(taskId: number, filePaths: string[], name: string): { snapshotId: number; skippedFiles: string[] } {
        console.assert(typeof taskId === 'number', 'taskId must be a valid number');
        console.assert(Array.isArray(filePaths), 'filePaths must be an array of strings');
        console.assert(typeof name === 'string' && name.length > 0, 'name must be a valid non-empty string');

        console.log(`[SnapshotService] Capturing snapshot "${name}" for task ID ${taskId}...`);
        
        const snapshotIdRaw = dbService.createSnapshot(`${name}_task_${taskId}`);
        const snapshotId = Number(snapshotIdRaw);
        console.assert(snapshotId > 0, 'Snapshot ID must be a positive integer');

        const skippedFiles: string[] = [];

        for (const file of filePaths) {
            const absolutePath = PathGuard.resolve(file);
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
                skippedFiles.push(file);
            }
        }

        return { snapshotId, skippedFiles };
    }

    /**
     * Restores the workspace files precisely back to the captured state of a given snapshot ID, strictly enforcing allowed root containment boundaries.
     * Also deletes any files in `filesToDelete` that were created during execution (new files not in the original snapshot).
     */
    static rollbackToSnapshot(snapshotId: number, filesToDelete?: string[]): void {
        console.assert(typeof snapshotId === 'number' && snapshotId > 0, 'snapshotId must be a positive number');
        console.log(`[SnapshotService] Performing safe rollback to snapshot ID ${snapshotId}...`);

        const files = dbService.getSnapshotFiles(snapshotId);
        if (!files || files.length === 0) {
            console.warn(`[SnapshotService] Snapshot ID ${snapshotId} has no files archived.`);
        } else {
            for (const f of files) {
                const absolutePath = f.file_path;
                const content = f.content;

                const resolvedPath = PathGuard.resolve(absolutePath);
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
        }

        // Delete files that were created during execution (didn't exist at snapshot time)
        if (filesToDelete && filesToDelete.length > 0) {
            for (const file of filesToDelete) {
                const absolutePath = PathGuard.resolve(file);
                if (absolutePath && fs.existsSync(absolutePath)) {
                    try {
                        fs.unlinkSync(absolutePath);
                        console.log(`[SnapshotService] Deleted new file created during execution: ${file}`);
                        // Also try to remove empty parent dirs
                        let dir = path.dirname(absolutePath);
                        while (dir !== path.dirname(dir)) {
                            try {
                                const entries = fs.readdirSync(dir);
                                if (entries.length === 0) {
                                    fs.rmdirSync(dir);
                                    console.log(`[SnapshotService] Removed empty directory: ${dir}`);
                                    dir = path.dirname(dir);
                                } else {
                                    break;
                                }
                            } catch {
                                break;
                            }
                        }
                    } catch (err) {
                        console.error(`[SnapshotService] Failed deleting new file ${file}:`, err);
                    }
                }
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

        const normalize = (p: string) => { let r = path.resolve(p); if (process.platform === 'win32') r = r.toLowerCase(); return r; };
        const f = files.find((file: any) => {
            return normalize(file.file_path) === normalize(filePath);
        });

        if (!f) {
            console.warn(`[SnapshotService] File ${filePath} not found in snapshot ID ${snapshotId}. Cannot rollback single file.`);
            return;
        }

        const resolvedPath = PathGuard.resolve(f.file_path);
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

