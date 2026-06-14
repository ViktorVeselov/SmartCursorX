import * as path from 'path';

export class PathGuard {
    private static workspacePath: string | null = null;
    private static extraRoots: string[] = [];

    static configure(workspacePath: string): void {
        this.workspacePath = path.resolve(workspacePath);
        this.extraRoots = [];
    }

    static getWorkspacePath(): string | null {
        return this.workspacePath;
    }

    static registerRoot(root: string): void {
        this.extraRoots.push(path.resolve(root));
    }

    static resolve(relativePath: string): string | null {
        if (!this.workspacePath) return null;
        const roots = [this.workspacePath, ...this.extraRoots];
        for (const root of roots) {
            const resolvedPath = path.isAbsolute(relativePath)
                ? relativePath
                : path.resolve(root, relativePath);
            const normRoot = this.normalize(root);
            const normResolved = this.normalize(resolvedPath);
            const relative = path.relative(normRoot, normResolved);
            const contained = relative === '' || (relative && !relative.startsWith('..') && !path.isAbsolute(relative));
            if (contained) {
                return resolvedPath;
            }
        }
        return null;
    }

    static isContained(absolutePath: string): boolean {
        return this.resolve(absolutePath) !== null;
    }

    static setWorkspacePath(workspacePath: string): void {
        this.configure(workspacePath);
    }

    private static normalize(p: string): string {
        let resolved = path.resolve(p);
        if (process.platform === 'win32') {
            resolved = resolved.toLowerCase();
        }
        return resolved;
    }
}
