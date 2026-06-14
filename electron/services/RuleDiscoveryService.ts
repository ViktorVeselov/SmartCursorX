import * as fs from 'fs';
import * as path from 'path';

export class RuleDiscoveryService {
    /**
     * Walks up the directory tree starting from targetPath up to the workspaceRoot,
     * discovering and combining instructions from .replacerrules, .cursorrules, and AGENTS.md.
     */
    static discoverRules(targetPath: string, workspaceRoot: string): string {
        if (!targetPath || !workspaceRoot) return '';

        const resolvedRoot = path.resolve(workspaceRoot);
        let currentDir = path.resolve(targetPath);

        // Ensure we start scanning at a directory level
        try {
            const stats = fs.statSync(currentDir);
            if (!stats.isDirectory()) {
                currentDir = path.dirname(currentDir);
            }
        } catch {
            currentDir = resolvedRoot;
        }

        const ruleFiles = ['.replacerrules', '.cursorrules', 'AGENTS.md'];
        const discoveredRules: string[] = [];
        const scannedPaths = new Set<string>();

        while (true) {
            const resolvedCurrent = path.resolve(currentDir);
            
            // Check boundary traversal safety
            const relative = path.relative(resolvedRoot, resolvedCurrent);
            const isOutOfBounds = relative.startsWith('..');

            if (isOutOfBounds) {
                break;
            }

            for (const fileName of ruleFiles) {
                const filePath = path.join(resolvedCurrent, fileName);
                if (fs.existsSync(filePath)) {
                    try {
                        const content = fs.readFileSync(filePath, 'utf-8').trim();
                        if (content) {
                            discoveredRules.push(`=== LOCAL RULES FROM ${fileName} (at ${path.basename(resolvedCurrent) || '/'}) ===\n${content}`);
                        }
                    } catch (err) {
                        console.error(`[RuleDiscoveryService] Failed to read rule file ${filePath}:`, err);
                    }
                }
            }

            // Stop walking up if we reached the workspace root
            if (resolvedCurrent === resolvedRoot) {
                break;
            }

            const parent = path.dirname(currentDir);
            if (parent === currentDir || scannedPaths.has(parent)) {
                break; // Hit file system root
            }
            scannedPaths.add(currentDir);
            currentDir = parent;
        }

        return discoveredRules.reverse().join('\n\n'); // Reverse to apply parent/root level first, then deeper rules
    }
}
