import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import console from 'console';

export interface LanguageCheckResult {
    language: string;
    passed: boolean;
    output: string;
}

export interface CompilationReport {
    passed: boolean;
    results: LanguageCheckResult[];
}

export class CompilationCheckerService {
    /**
     * Detects project languages and runs all applicable compilation checks in parallel.
     * Supports: TypeScript (tsconfig.json), Rust (Cargo.toml), Go (go.mod),
     * Zig (build.zig), C/C++ (CMakeLists.txt).
     */
    static async run(workspaceRoot: string): Promise<CompilationReport> {
        const checks: Promise<LanguageCheckResult>[] = [];

        if (fs.existsSync(path.join(workspaceRoot, 'tsconfig.json'))) {
            checks.push(this.checkTypeScript(workspaceRoot));
        }
        if (fs.existsSync(path.join(workspaceRoot, 'Cargo.toml'))) {
            checks.push(this.checkRust(workspaceRoot));
        }
        if (fs.existsSync(path.join(workspaceRoot, 'go.mod'))) {
            checks.push(this.checkGo(workspaceRoot));
        }
        if (fs.existsSync(path.join(workspaceRoot, 'build.zig'))) {
            checks.push(this.checkZig(workspaceRoot));
        }
        if (fs.existsSync(path.join(workspaceRoot, 'CMakeLists.txt'))) {
            checks.push(this.checkCpp(workspaceRoot));
        }

        if (checks.length === 0) {
            console.log('[CompilationCheckerService] No supported project files found — skipping compilation checks.');
            return { passed: true, results: [] };
        }

        console.log(`[CompilationCheckerService] Running ${checks.length} compilation check(s)...`);
        const results = await Promise.all(checks);
        const passed = results.every(r => r.passed);

        for (const r of results) {
            if (r.passed) {
                console.log(`[CompilationCheckerService] ${r.language}: passed`);
            } else {
                console.warn(`[CompilationCheckerService] ${r.language}: FAILED`);
            }
        }

        return { passed, results };
    }

    private static checkTypeScript(workspaceRoot: string): Promise<LanguageCheckResult> {
        return this.runTool(workspaceRoot, 'npx', ['tsc', '--noEmit'], 'TypeScript');
    }

    private static checkRust(workspaceRoot: string): Promise<LanguageCheckResult> {
        return this.runTool(workspaceRoot, 'cargo', ['check', '--quiet'], 'Rust');
    }

    private static checkGo(workspaceRoot: string): Promise<LanguageCheckResult> {
        return this.runTool(workspaceRoot, 'go', ['vet', './...'], 'Go');
    }

    private static checkZig(workspaceRoot: string): Promise<LanguageCheckResult> {
        return this.runTool(workspaceRoot, 'zig', ['build'], 'Zig');
    }

    private static checkCpp(workspaceRoot: string): Promise<LanguageCheckResult> {
        return this.runTool(workspaceRoot, 'cmake', ['--build', '.'], 'C/C++');
    }

    private static runTool(
        cwd: string,
        command: string,
        args: string[],
        language: string
    ): Promise<LanguageCheckResult> {
        return new Promise((resolve) => {
            const proc = spawn(command, args, { cwd, shell: true });
            let output = '';
            const timeout = setTimeout(() => {
                proc.kill();
                resolve({
                    language,
                    passed: false,
                    output: `${language} check timed out after 120s`
                });
            }, 120_000);

            proc.stdout?.on('data', (d: Buffer) => { output += d.toString(); });
            proc.stderr?.on('data', (d: Buffer) => { output += d.toString(); });

            proc.on('close', (code: number | null) => {
                clearTimeout(timeout);
                resolve({
                    language,
                    passed: code === 0,
                    output: output.trim()
                });
            });

            proc.on('error', (err: Error) => {
                clearTimeout(timeout);
                resolve({
                    language,
                    passed: false,
                    output: `Failed to spawn ${command}: ${err.message}`
                });
            });
        });
    }
}
