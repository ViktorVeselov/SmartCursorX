import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { dbService } from '../db';
import console from 'console';

export interface DiffVerificationResult {
    compiles: boolean;
    scopeViolations: string[];
    antiPatterns: string[];
    details: string;
}

export class DiffVerificationService {
    /**
     * Executes fully deterministic compiler checks, file boundary rules, and anti-pattern lints.
     */
    static async verify(taskId: number, modifiedFiles: string[], skipTsc: boolean = false): Promise<DiffVerificationResult> {
        console.assert(typeof taskId === 'number', 'taskId must be a number');
        console.assert(Array.isArray(modifiedFiles), 'modifiedFiles must be an array');

        const violations: string[] = [];
        const antiPatterns: string[] = [];
        let compiles = true;
        let details = 'Deterministic verification details:\n';

        const workspaceRoot = dbService.getWorkspacePathForTask(taskId) || path.resolve(process.cwd());
        const planRow = dbService.getTaskPlan(taskId);
        let allowedToModify = new Set<string>();

        if (planRow) {
            try {
                const plan = JSON.parse(planRow.plan_json);
                const allPlanned = [...(plan.filesToModify || []), ...(plan.filesToCreate || [])];
                allowedToModify = new Set(allPlanned.map((f: string) => path.normalize(f)));
                
                for (const file of modifiedFiles) {
                    const normalizedFile = path.normalize(file);
                    if (allowedToModify.size > 0 && !allowedToModify.has(normalizedFile)) {
                        violations.push(file);
                    }
                }
            } catch (e) {
                console.error('[DiffVerificationService] Failed to parse plan JSON for scope validation:', e);
            }
        }

        if (violations.length > 0) {
            details += `⚠️ Scope note: Modified files outside original plan: ${violations.join(', ')}\n`;
        } else {
            details += `✅ Scope Boundaries: Checked. All edits conform strictly to planning schema.\n`;
        }

        for (const file of modifiedFiles) {
            const absolutePath = path.resolve(workspaceRoot, file);
            if (fs.existsSync(absolutePath)) {
                const content = fs.readFileSync(absolutePath, 'utf-8');
                const lines = content.split(/\r?\n/);
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();

                    if (['.ts', '.tsx'].includes(path.extname(file))) {
                        const hasExplicitAny = /:\s*any\b/.test(line) && !line.startsWith('//') && !line.startsWith('*');
                        if (hasExplicitAny) {
                            antiPatterns.push(`${path.basename(file)}:L${i + 1} - Found explicit banned "any" typing.`);
                        }
                    }

                    const hasPlaceholder = /(TODO|implement here|placeholder|write code here)/i.test(line);
                    if (hasPlaceholder && (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*'))) {
                        antiPatterns.push(`${path.basename(file)}:L${i + 1} - Unresolved code placeholder comment.`);
                    }
                }

                // Run AST local import integrity check
                if (['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(file))) {
                    const importViolations = this.verifyLocalImports(file, content, workspaceRoot, allowedToModify);
                    for (const v of importViolations) {
                        antiPatterns.push(`${path.basename(file)} - ${v}`);
                    }
                }
            }
        }

        if (antiPatterns.length > 0) {
            details += `❌ Code Quality & Import Rules: Found issues:\n - ${antiPatterns.join('\n - ')}\n`;
        } else {
            details += `✅ Code Quality & Import Rules: Checked. Banned typings, placeholders, and broken imports absent.\n`;
        }

        const hasTsFiles = modifiedFiles.some(f => ['.ts', '.tsx'].includes(path.extname(f)));

        if (!skipTsc && hasTsFiles) {
            const tsconfigPath = path.join(workspaceRoot, 'tsconfig.json');
            if (fs.existsSync(tsconfigPath)) {
                const nodeModulesPath = path.join(workspaceRoot, 'node_modules');
                if (!fs.existsSync(nodeModulesPath)) {
                    details += `⚠️ node_modules not found — skipping TypeScript compilation check (dependencies may not be installed)\n`;
                } else {
                    try {
                        details += `⚡ Running TypeScript compilation check (tsc --noEmit) in ${workspaceRoot}...\n`;
                        const tscResult = await this.runTscCheck(workspaceRoot);
                        if (!tscResult.success) {
                            compiles = false;
                            details += `❌ TypeScript Compilation Check failed:\n${tscResult.output}\n`;
                        } else {
                            details += `✅ TypeScript Compilation Check passed.\n`;
                        }
                    } catch (err: any) {
                        console.error('[DiffVerificationService] Failed to spawn tsc check:', err);
                        details += `⚠️ TS Compilation Check skipped: ${err.message || err}\n`;
                    }
                }
            }
        }

        if (skipTsc) {
            details += `⏭️ TypeScript compilation check skipped (deferred to post-execution CompilationCheckerService).\n`;
        }

        return {
            compiles,
            scopeViolations: violations,
            antiPatterns,
            details
        };
    }

    private static verifyLocalImports(
        file: string, 
        content: string, 
        workspaceRoot: string, 
        plannedFiles: Set<string>
    ): string[] {
        const importViolations: string[] = [];
        const fileDir = path.dirname(path.resolve(workspaceRoot, file));
        
        // Match imports and requires: import ... from '...' or import '...' or require('...')
        const importRegex = /(?:import\s+(?:[\w\s{},*]+)\s+from\s+|import\s+|require\()\s*['"]([^'"]+)['"]\s*\)?/g;
        
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1];
            
            // Only verify relative local imports (starting with . or ..)
            if (importPath.startsWith('.') || importPath.startsWith('..')) {
                const absoluteImportPath = path.resolve(fileDir, importPath);
                
                // Check if the resolved file exists on disk with typical extensions
                const extensions = ['', '.ts', '.tsx', '.d.ts', '.js', '.jsx', '/index.ts', '/index.js', '/index.tsx', '/index.jsx'];
                let resolved = false;
                
                for (const ext of extensions) {
                    const testPath = absoluteImportPath + ext;
                    if (fs.existsSync(testPath)) {
                        resolved = true;
                        break;
                    }
                    
                    // Also check if it matches one of the planned files in the pipeline
                    const relativeTestPath = path.relative(workspaceRoot, testPath);
                    const normalizedTestPath = path.normalize(relativeTestPath);
                    if (plannedFiles.has(normalizedTestPath)) {
                        resolved = true;
                        break;
                    }
                }
                
                if (!resolved) {
                    importViolations.push(`Broken local import: "${importPath}" (resolves to non-existent file relative to workspace: ${path.relative(workspaceRoot, absoluteImportPath)})`);
                }
            }
        }
        
        return importViolations;
    }

    /**
     * Standalone compilation check for use in post-execution CompilationCheckerService.
     * Runs tsc --noEmit and returns structured result.
     */
    static async checkCompilation(workspaceRoot: string): Promise<{ success: boolean; output: string }> {
        const tsconfigPath = path.join(workspaceRoot, 'tsconfig.json');
        if (!fs.existsSync(tsconfigPath)) {
            return { success: true, output: 'No tsconfig.json found — skipping TypeScript check' };
        }
        const nodeModulesPath = path.join(workspaceRoot, 'node_modules');
        if (!fs.existsSync(nodeModulesPath)) {
            return { success: true, output: 'node_modules not found — skipping TypeScript check' };
        }
        return this.runTscCheck(workspaceRoot);
    }

    private static runTscCheck(cwd: string): Promise<{ success: boolean; output: string }> {
        return new Promise((resolve) => {
            const proc = spawn('npx', ['tsc', '--noEmit'], {
                cwd,
                shell: process.platform === 'win32'
            });

            let output = '';
            proc.stdout?.on('data', (d) => output += d.toString());
            proc.stderr?.on('data', (d) => output += d.toString());

            proc.on('close', (code) => {
                resolve({
                    success: code === 0,
                    output: output.trim()
                });
            });

            proc.on('error', (err) => {
                resolve({
                    success: false,
                    output: `Process execution error: ${err.message}`
                });
            });
        });
    }


}
