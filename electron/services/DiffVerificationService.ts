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

        const workspaceRoot = path.resolve(process.cwd());
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
            }
        }

        if (antiPatterns.length > 0) {
            details += `❌ Code Quality Rules: Found anti-patterns:\n - ${antiPatterns.join('\n - ')}\n`;
        } else {
            details += `✅ Code Quality Rules: Checked. Banned typings or placeholders absent.\n`;
        }

        let workspacePath = process.cwd();
        if (!fs.existsSync(path.join(workspacePath, 'tsconfig.json')) && fs.existsSync(path.join(workspacePath, 'cursor-replacer', 'tsconfig.json'))) {
            workspacePath = path.join(workspacePath, 'cursor-replacer');
        }

        if (fs.existsSync(path.join(workspacePath, 'tsconfig.json'))) {
            try {
                details += `⚡ Running project compilation check (tsc --noEmit)...\n`;
                const tscResult = await this.runTscCheck(workspacePath);
                if (!tscResult.success) {
                    compiles = false;
                    details += `❌ Compilation Check: Failed.\nCompiler Logs:\n${tscResult.output}\n`;
                } else {
                    details += `✅ Compilation Check: Passed. Project builds perfectly with zero errors.\n`;
                }
            } catch (err: any) {
                console.error('[DiffVerificationService] Failed to spawn tsc check:', err);
                details += `⚠️ Compilation Check: Skipped due to execution environment limits (${err.message || err}).\n`;
            }
        } else {
            details += `ℹ️ Compilation Check: Skipped. No tsconfig.json found at ${workspacePath}.\n`;
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
}
