import * as path from 'path';

export class SessionChangesTrackerService {
    private static accepted = new Map<string, { originalPath: string; content: string; status: 'pending' | 'accepted' }>();

    private static normalizeKey(absPath: string): string {
        let resolved = path.resolve(absPath);
        if (process.platform === 'win32') {
            resolved = resolved.toLowerCase();
        }
        return resolved;
    }

    static trackAccepted(absolutePath: string, originalContent?: string, status: 'pending' | 'accepted' = 'pending'): void {
        const key = this.normalizeKey(absolutePath);
        const existing = this.accepted.get(key);
        if (!existing) {
            this.accepted.set(key, {
                originalPath: absolutePath,
                content: originalContent ?? '',
                status
            });
        } else if (status === 'pending' && existing.status === 'accepted') {
            existing.content = originalContent ?? '';
            existing.status = 'pending';
        }
    }

    static getOriginalContent(absolutePath: string): string | undefined {
        return this.accepted.get(this.normalizeKey(absolutePath))?.content;
    }

    static getStatus(absolutePath: string): 'pending' | 'accepted' | undefined {
        return this.accepted.get(this.normalizeKey(absolutePath))?.status;
    }

    static accept(absolutePath: string): void {
        const key = this.normalizeKey(absolutePath);
        const entry = this.accepted.get(key);
        if (entry) {
            entry.status = 'accepted';
        }
    }

    static getAccepted(): string[] {
        return Array.from(this.accepted.values()).map(v => v.originalPath);
    }

    static untrack(absolutePath: string): void {
        this.accepted.delete(this.normalizeKey(absolutePath));
    }

    static clear(): void {
        this.accepted.clear();
    }
}
