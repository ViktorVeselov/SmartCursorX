import { ExecutionLoopService } from '../services/ExecutionLoopService';
import { PendingModificationsService } from '../services/PendingModificationsService';
import { SnapshotService } from '../services/SnapshotService';
import { CompilationCheckerService } from '../services/CompilationCheckerService';
import { VerificationService } from '../services/VerificationService';
import { aiService } from '../services/AIService';
import { secureStore } from '../secureStore';
import { dbService } from '../db';
import type { IpcHandlerContext } from './index';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Applies repair patches from LLM output using FILE: block parser.
 * Parses blocks like:
 *   FILE: src/foo.ts
 *   ```...content...```
 */
function applyRepairPatches(workspaceRoot: string, text: string): void {
    const fileBlockRegex = /FILE:\s*(.+?)\s*\n\s*`{3,}(?:\w+)?\n([\s\S]*?)`{3,}/g;
    let match: RegExpExecArray | null;
    while ((match = fileBlockRegex.exec(text)) !== null) {
        const relativePath = match[1].trim();
        const content = match[2];
        const absolutePath = path.resolve(workspaceRoot, relativePath);
        try {
            const dir = path.dirname(absolutePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(absolutePath, content, 'utf-8');
            console.log(`[RepairPatcher] Applied fix to ${relativePath}`);
        } catch (err) {
            console.error(`[RepairPatcher] Failed to write ${relativePath}:`, err);
        }
    }
}

export function registerExecutionHandlers(ipcMain: Electron.IpcMain, _context: IpcHandlerContext) {
    ipcMain.handle('execution:start', async (_event, taskId: number) => {
        console.log(`[ExecutionHandler] Starting execution for task ${taskId}`);
        PendingModificationsService.clear();
        // Ensure AIService is initialized with current provider from secureStore
        // (chat UI may have changed provider/model via handleSelectModel)
        aiService.initializeFromStore();
        try {
            const execResult = await ExecutionLoopService.executeTask(taskId);
            if (execResult !== 'passed') {
                return { success: false, error: 'Execution failed' };
            }

            // Post-execution compilation check
            const workspaceRoot = dbService.getWorkspacePathForTask(taskId) || path.resolve(process.cwd());
            const report = await CompilationCheckerService.run(workspaceRoot);
            let repairAttempts = 0;

            if (!report.passed) {
                const compilerOutput = report.results
                    .filter(r => !r.passed)
                    .map(r => `[${r.language}]\n${r.output}`)
                    .join('\n---\n');

                // Repair loop: feed compiler errors to LLM for surgical fix
                const repairModel = secureStore.getSelectedModel();
                for (repairAttempts = 1; repairAttempts <= 3; repairAttempts++) {
                    if (!aiService.isActive()) break;

                    const response = await aiService.chat([
                        { role: 'system', content: `You are a surgical fix tool. The following compilation errors were found. Output ONLY the minimal file patches needed to fix them. Do not change functionality or add features.` },
                        { role: 'user', content: `Compilation errors:\n${compilerOutput}\n\nOutput file patches to fix these errors. Use FILE: path blocks with the full corrected content of each file that needs changes.` }
                    ], { temperature: 0.1, model: repairModel }) as import('../services/AIService').ChatResponse;

                    if (!response?.text) break;

                    applyRepairPatches(workspaceRoot, response.text);

                    // Re-check compilation
                    const recheck = await CompilationCheckerService.run(workspaceRoot);
                    if (recheck.passed) {
                        // Re-verify plan adherence after successful repair
                        try {
                            const taskOutputs = dbService.getTaskOutputs(taskId);
                            if (taskOutputs && taskOutputs.length > 0) {
                                const planRow = dbService.getTaskPlan(taskId);
                                if (planRow) {
                                    const plan = JSON.parse(planRow.plan_json);
                                    if (plan.autoVerify) {
                                        const finalCheck = await VerificationService.verifyOutput(taskOutputs[0].id);
                                        if (finalCheck === 'failed') {
                                            return {
                                                success: true,
                                                compilationPassed: true,
                                                repairAttempts,
                                                warning: 'Compilation fixed but plan adherence check failed — review required'
                                            };
                                        }
                                    }
                                }
                            }
                        } catch {
                            // Non-blocking — if plan re-verify fails, still report compilation success
                        }

                        return {
                            success: true,
                            compilationPassed: true,
                            repairAttempts
                        };
                    }
                }

                return {
                    success: true,
                    compilationPassed: false,
                    compilerErrors: compilerOutput,
                    repairAttempts
                };
            }

            return { success: true, compilationPassed: true, repairAttempts: 0 };
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
