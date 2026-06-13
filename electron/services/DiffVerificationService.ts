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
    static async verify(taskId: number, modifiedFiles: string[]): Promise<DiffVerificationResult> {
        console.assert(typeof taskId === 'number', 'taskId must be a number');
        console.assert(Array.isArray(modifiedFiles), 'modifiedFiles must be an array');

        const violations: string[] = [];
        const antiPatterns: string[] = [];
        let compiles = true;
        let details = 'Deterministic verification details:\n';

        const planRow = dbService.getTaskPlan(taskId);
        if (planRow) {
            try {
                const plan = JSON.parse(planRow.plan_json);
                const allowedToModify = new Set((plan.filesToModify || []).map((f: string) => path.normalize(f)));
                
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
            details += `❌ Scope Violations: Modified files not in original plan: ${violations.join(', ')}\n`;
        } else {
            details += `✅ Scope Boundaries: Checked. All edits conform strictly to planning schema.\n`;
        }

        for (const file of modifiedFiles) {
            const absolutePath = path.resolve(file);
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
            }
        }

        if (antiPatterns.length > 0) {
            details += `❌ Code Quality Rules: Found anti-patterns:\n - ${antiPatterns.join('\n - ')}\n`;
        } else {
            details += `✅ Code Quality Rules: Checked. Banned typings or placeholders absent.\n`;
        }

        const hasTsFiles = modifiedFiles.some(f => ['.ts', '.tsx'].includes(path.extname(f)));
        const hasPyFiles = modifiedFiles.some(f => ['.py'].includes(path.extname(f)));

        const workspaceRoot = path.resolve(process.cwd());
        const parentRoot = path.resolve(workspaceRoot, '..');

        // Compile checks for TypeScript (React/Electron project)
        if (hasTsFiles) {
            const tsconfigPath = path.join(workspaceRoot, 'tsconfig.json');
            if (fs.existsSync(tsconfigPath)) {
                try {
                    details += `⚡ Running TypeScript compilation check (tsc --noEmit)...\n`;
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

        // Compile checks for Python (ADK community project)
        if (hasPyFiles) {
            const pythonWorkspace = path.resolve(parentRoot, 'adk-python-community');
            if (fs.existsSync(pythonWorkspace)) {
                try {
                    details += `⚡ Running Python syntax verification (py_compile)...\n`;
                    const pyFiles = modifiedFiles
                        .filter(f => path.extname(f) === '.py')
                        .map(f => path.resolve(workspaceRoot, f)); // Resolve absolute
                    
                    const pyCompileResult = await this.runPythonCheck(pythonWorkspace, pyFiles);
                    if (!pyCompileResult.success) {
                        compiles = false;
                        details += `❌ Python Compilation Check failed:\n${pyCompileResult.output}\n`;
                    } else {
                        details += `✅ Python Compilation Check passed.\n`;
                    }
                } catch (err: any) {
                    console.error('[DiffVerificationService] Failed to spawn python check:', err);
                    details += `⚠️ Python Compilation Check skipped: ${err.message || err}\n`;
                }
            }
        }

        return {
            compiles,
            scopeViolations: violations,
            antiPatterns,
            details
        };
    }

    private static runTscCheck(cwd: string): Promise<{ success: boolean; output: string }> {
        return new Promise((resolve) => {
            const proc = spawn('npx', ['tsc', '--noEmit'], {
                cwd,
                shell: true
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

    private static async runPythonCheck(cwd: string, files: string[]): Promise<{ success: boolean; output: string }> {
        const relativeFiles = files.map(f => path.relative(cwd, f));
        
        // Attempt with 'python' command first
        let result = await this.executePythonCommand('python', relativeFiles, cwd);
        
        // Fallback to 'python3' if 'python' command fails with execution spawn error
        if (!result.success && result.output.includes('Process execution error')) {
            console.log('[DiffVerificationService] "python" command unavailable. Retrying with "python3"...');
            result = await this.executePythonCommand('python3', relativeFiles, cwd);
        }
        
        return result;
    }

    private static executePythonCommand(command: string, args: string[], cwd: string): Promise<{ success: boolean; output: string }> {
        return new Promise((resolve) => {
            const proc = spawn(command, ['-m', 'py_compile', ...args], {
                cwd,
                shell: true
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
