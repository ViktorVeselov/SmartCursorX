import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { dbService } from '../db';
import console from 'console';

export class SnapshotService {
    /**
     * Captures a full snapshot of the specified files and saves them to the DB as version control blobs.
     */
    static captureSnapshot(taskId: number, filePaths: string[], name: string): number {
        console.assert(typeof taskId === 'number', 'taskId must be a valid number');
        console.assert(Array.isArray(filePaths), 'filePaths must be an array of strings');
        console.assert(typeof name === 'string' && name.length > 0, 'name must be a valid non-empty string');

        console.log(`[SnapshotService] Capturing snapshot "${name}" for task ID ${taskId}...`);
        
        const snapshotIdRaw = dbService.createSnapshot(`${name}_task_${taskId}`);
        const snapshotId = Number(snapshotIdRaw);
        console.assert(snapshotId > 0, 'Snapshot ID must be a positive integer');

        for (const file of filePaths) {
            const absolutePath = path.resolve(file);
            if (fs.existsSync(absolutePath)) {
                try {
                    const content = fs.readFileSync(absolutePath, 'utf-8');
                    const hash = crypto.createHash('sha256').update(content).digest('hex');

                    dbService.addBlob(hash, content);
                    dbService.addSnapshotFile(snapshotId, file, hash);
                    
                    console.log(`[SnapshotService] Snapshotted file: ${file} (hash: ${hash.substring(0, 8)})`);
                } catch (err) {
                    console.error(`[SnapshotService] Failed snapshotting file ${file}:`, err);
                }
            } else {
                console.warn(`[SnapshotService] Target file ${file} does not exist. Skipping blob generation.`);
            }
        }

        return snapshotId;
    }

    /**
     * Restores the workspace files precisely back to the captured state of a given snapshot ID.
     */
    static rollbackToSnapshot(snapshotId: number): void {
        console.assert(typeof snapshotId === 'number' && snapshotId > 0, 'snapshotId must be a positive number');
        console.log(`[SnapshotService] Performing safe rollback to snapshot ID ${snapshotId}...`);

        const files = dbService.getSnapshotFiles(snapshotId);
        if (!files || files.length === 0) {
            console.warn(`[SnapshotService] Snapshot ID ${snapshotId} has no files archived. Rollback aborted.`);
            return;
        }

        for (const f of files) {
            const relativePath = f.file_path;
            const content = f.content;
            const absolutePath = path.resolve(relativePath);

            try {
                const parentDir = path.dirname(absolutePath);
                if (!fs.existsSync(parentDir)) {
                    fs.mkdirSync(parentDir, { recursive: true });
                }

                fs.writeFileSync(absolutePath, content, 'utf-8');
                console.log(`[SnapshotService] Restored file: ${relativePath}`);
            } catch (err) {
                console.error(`[SnapshotService] Failed restoring file ${relativePath} during rollback:`, err);
                throw new Error(`Rollback failed on file ${relativePath}: ${err}`);
            }
        }

        console.log('[SnapshotService] Rollback completed successfully.');
    }
}
