import { ExecutionLoopService } from '../services/ExecutionLoopService';
import { PendingModificationsService } from '../services/PendingModificationsService';
import { SnapshotService } from '../services/SnapshotService';
import { dbService } from '../db';
import type { IpcHandlerContext } from './index';

export function registerExecutionHandlers(ipcMain: Electron.IpcMain, _context: IpcHandlerContext) {
    ipcMain.handle('execution:start', async (_event, taskId: number) => {
        console.log(`[ExecutionHandler] Starting execution for task ${taskId}`);
        PendingModificationsService.clear();
        try {
            const result = await ExecutionLoopService.executeTask(taskId);
            return { success: result === 'passed' };
        } catch (err: any) {
            console.error(`[ExecutionHandler] Execution failed for task ${taskId}:`, err);
            return { success: false, error: err.message || String(err) };
        }
    });

    ipcMain.handle('execution:get-pending', async (_event, taskId: number) => {
        const pending = PendingModificationsService.getPending(taskId);
        if (!pending) return null;
        return {
            taskId: pending.taskId,
            modifications: pending.modifications.map(m => ({
                relativePath: m.relativePath,
                absolutePath: m.absolutePath,
                originalContent: m.originalContent,
                proposedContent: m.proposedContent,
                addedLines: m.addedLines,
                removedLines: m.removedLines,
                patches: m.patches,
            })),
            createdAt: pending.createdAt,
        };
    });

    ipcMain.handle('execution:apply-pending', async (_event, taskId: number) => {
        console.log(`[ExecutionHandler] Applying pending modifications for task ${taskId}`);
        const pending = PendingModificationsService.getPending(taskId);
        const mods = pending ? [...pending.modifications] : [];
        const success = PendingModificationsService.applyModifications(taskId);
        if (success) {
            PendingModificationsService.resolvePending(taskId, true);
            PendingModificationsService.removePending(taskId);
            if (_event && _event.sender) {
                for (const mod of mods) {
                    _event.sender.send('changes:updated', { relativePath: mod.relativePath, action: 'stage' });
                }
                _event.sender.send('execution:pending-modifications', {
                    taskId,
                    modifications: []
                });
            }
        }
        return { success };
    });

    ipcMain.handle('execution:reject-pending', async (_event, taskId: number) => {
        console.log(`[ExecutionHandler] Rejecting pending modifications for task ${taskId}`);
        const pending = PendingModificationsService.getPending(taskId);
        const mods = pending ? [...pending.modifications] : [];
        try {
            const plan = dbService.getTaskPlan(taskId);
            if (plan) {
                const snapshotName = `pre_execution_${taskId}`;
                const snapshotId = SnapshotService.getSnapshotIdByName(snapshotName);
                if (snapshotId !== null) {
                    SnapshotService.rollbackToSnapshot(snapshotId);
                }
            }
        } catch (err) {
            console.error('[ExecutionHandler] Rollback error during rejection:', err);
        }
        PendingModificationsService.resolvePending(taskId, false);
        PendingModificationsService.removePending(taskId);
        if (_event && _event.sender) {
            for (const mod of mods) {
                _event.sender.send('changes:updated', { relativePath: mod.relativePath, action: 'discard' });
            }
            _event.sender.send('execution:pending-modifications', {
                taskId,
                modifications: []
            });
        }
        return { success: true };
    });

    ipcMain.handle('execution:apply-single', async (_event, taskId: number, relativePath: string) => {
        console.log(`[ExecutionHandler] Applying single file for task ${taskId}: ${relativePath}`);
        const pending = PendingModificationsService.getPending(taskId);
        if (!pending) return { success: false, error: 'No pending modifications found' };

        const mod = pending.modifications.find(m => m.relativePath === relativePath);
        if (!mod) return { success: false, error: `File ${relativePath} not in pending modifications` };

        const success = PendingModificationsService.applySingleFile(mod);
        if (success) {
            pending.modifications = pending.modifications.filter(m => m.relativePath !== relativePath);
            if (pending.modifications.length === 0) {
                PendingModificationsService.resolvePending(taskId, true);
                PendingModificationsService.removePending(taskId);
            }
            if (_event && _event.sender) {
                _event.sender.send('changes:updated', { relativePath, action: 'stage' });
                _event.sender.send('execution:pending-modifications', {
                    taskId,
                    modifications: pending.modifications.map(m => ({
                        relativePath: m.relativePath,
                        addedLines: m.addedLines,
                        removedLines: m.removedLines
                    }))
                });
            }
        }
        return { success };
    });

    ipcMain.handle('execution:reject-single', async (_event, taskId: number, relativePath: string) => {
        console.log(`[ExecutionHandler] Rejecting single file for task ${taskId}: ${relativePath}`);
        const pending = PendingModificationsService.getPending(taskId);
        if (!pending) return { success: false, error: 'No pending modifications found' };

        const mod = pending.modifications.find(m => m.relativePath === relativePath);
        if (!mod) return { success: false, error: `File ${relativePath} not in pending modifications` };

        try {
            const snapshotName = `pre_execution_${taskId}`;
            const snapshotId = SnapshotService.getSnapshotIdByName(snapshotName);
            if (snapshotId !== null) {
                SnapshotService.rollbackSingleFile(snapshotId, mod.absolutePath);
            }
        } catch (err) {
            console.error('[ExecutionHandler] Single file rollback error:', err);
        }

        pending.modifications = pending.modifications.filter(m => m.relativePath !== relativePath);
        const isEmpty = pending.modifications.length === 0;
        if (isEmpty) {
            PendingModificationsService.resolvePending(taskId, false);
            PendingModificationsService.removePending(taskId);
        }
        if (_event && _event.sender) {
            _event.sender.send('changes:updated', { relativePath, action: 'discard' });
            _event.sender.send('execution:pending-modifications', {
                taskId,
                modifications: pending.modifications.map(m => ({
                    relativePath: m.relativePath,
                    addedLines: m.addedLines,
                    removedLines: m.removedLines
                }))
            });
        }
        return { success: true };
    });

    ipcMain.handle('execution:has-pending', async () => {
        return PendingModificationsService.hasPending();
    });

    ipcMain.handle('execution:dlq-respond', async (_event, taskId: number, guidance: string | null) => {
        console.log(`[ExecutionHandler] DLQ response for task ${taskId}: ${guidance ? 'guidance provided' : 'cancelled'}`);
        ExecutionLoopService.resolveDlq(taskId, guidance);
        return { success: true };
    });

    ipcMain.handle('execution:stop', async (_event, taskId: number) => {
        console.log(`[ExecutionHandler] Stopping execution for task ${taskId}`);
        ExecutionLoopService.stopExecution(taskId);
        return { success: true };
    });
}
