import * as fs from 'fs';
import * as path from 'path';
import console from 'console';
import { SessionChangesTrackerService } from './SessionChangesTrackerService';
import type { PendingFileModification, PendingTaskModifications } from '../../src/types/appTypes';

export class PendingModificationsService {
    private static pending = new Map<number, PendingTaskModifications>();
    private static pendingResolvers = new Map<number, (accepted: boolean) => void>();

    static setPending(taskId: number, mods: PendingTaskModifications): void {
        this.pending.set(taskId, mods);
    }

    static getPending(taskId: number): PendingTaskModifications | undefined {
        return this.pending.get(taskId);
    }

    static getAllPending(): Map<number, PendingTaskModifications> {
        return new Map(this.pending);
    }

    static hasPending(): boolean {
        return this.pending.size > 0;
    }

    static getTaskIdForResolver(resolve: (accepted: boolean) => void): number | null {
        for (const [taskId, resolver] of this.pendingResolvers) {
            if (resolver === resolve) return taskId;
        }
        return null;
    }

    static setResolver(taskId: number, resolve: (accepted: boolean) => void): void {
        this.pendingResolvers.set(taskId, resolve);
    }

    static removePending(taskId: number): void {
        this.pending.delete(taskId);
        this.pendingResolvers.delete(taskId);
    }

    static applySingleFile(modification: PendingFileModification): boolean {
        try {
            const parentDir = path.dirname(modification.absolutePath);
            if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, { recursive: true });
            }
            fs.writeFileSync(modification.absolutePath, modification.proposedContent, 'utf-8');
            SessionChangesTrackerService.trackAccepted(modification.absolutePath, modification.originalContent, 'accepted');
            console.log(`[PendingModificationsService] Applied single file: ${modification.relativePath}`);
            return true;
        } catch (err) {
            console.error(`[PendingModificationsService] Failed to apply file: ${modification.relativePath}`, err);
            return false;
        }
    }

    static applyModifications(taskId: number): boolean {
        const mods = this.pending.get(taskId);
        if (!mods) {
            console.error(`[PendingModificationsService] No pending modifications for task ${taskId}`);
            return false;
        }

        let allApplied = true;
        for (const mod of mods.modifications) {
            const success = this.applySingleFile(mod);
            if (!success) allApplied = false;
        }

        console.log(`[PendingModificationsService] Applied all modifications for task ${taskId}, all succeeded: ${allApplied}`);
        return allApplied;
    }

    static resolvePending(taskId: number, accepted: boolean): void {
        const resolver = this.pendingResolvers.get(taskId);
        if (resolver) {
            this.pendingResolvers.delete(taskId);
            resolver(accepted);
        }
    }

    static clear(): void {
        this.pending.clear();
        this.pendingResolvers.clear();
    }
}
