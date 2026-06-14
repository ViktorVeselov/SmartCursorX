import * as fs from 'fs';
import * as path from 'path';
import console from 'console';

export interface PatchBlock {
    find: string;
    replace: string;
}

export interface FilePatch {
    file: string;
    patches: PatchBlock[];
}

export class ASTPatchingService {
    private static getWhitelistedRoots(): string[] {
        const workspaceRoot = path.resolve(process.cwd());
        const parentRoot = path.resolve(workspaceRoot, '..');
        return [
            workspaceRoot,
            path.resolve(parentRoot, 'adk-python-community'),
            path.resolve(parentRoot, 'google-sdk')
        ];
    }

    private static normalizePathForCompare(p: string): string {
        let resolved = path.resolve(p);
        if (process.platform === 'win32') {
            resolved = resolved.toLowerCase();
        }
        return resolved;
    }

    private static resolveToAllowedRoot(relativePath: string): string | null {
        const roots = this.getWhitelistedRoots();
        for (const root of roots) {
            const resolvedPath = path.isAbsolute(relativePath)
                ? relativePath
                : path.resolve(root, relativePath);
            const normRoot = this.normalizePathForCompare(root);
            const normResolved = this.normalizePathForCompare(resolvedPath);
            
            const relative = path.relative(normRoot, normResolved);
            const contained = relative === '' || (relative && !relative.startsWith('..') && !path.isAbsolute(relative));
            if (contained) {
                return resolvedPath;
            }
        }
        return null;
    }

    /**
     * Enforces Phase-Specific Tool Masking & Steering Policy.
     */
    static shapeSystemInstructions(phase: 'investigate' | 'modify' | 'verify', basePrompt: string, activeFileExt?: string, taxonomyResult?: any): string {
        let steeringDirectives = '';

        if (phase === 'investigate') {
            steeringDirectives = `
=== TAXONOMY POLICY: ACTIVE INVESTIGATION PHASE ===
- You are STRICTLY restricted to gathering facts and checking assumptions.
- DO NOT generate code modifications or write/apply file changes.
- Focus exclusively on:
  1. Static analysis of imports and dependency trees.
  2. Database schemas and configuration constraints.
  3. Filling out your active scratchpad with zero-blind-spots proof.
- Available cognitive actions: GREP, READ_FILE, VIEW_OUTLINE, FIND_REFERENCES.
- Restricted actions: WRITE_FILE, APPLY_EDITS (HIDDEN/BLOCKED).

=== ASSUMPTION VALIDATOR POLICY ===
- Evidence-Based: No claim should be made without a direct citation or grep from the codebase, documentation, or tool output.
- Assumption Identification: Scan actively for words like "probably", "likely", "should", "standard", or "usually" and treat them as assumptions.
- Explicit Uncertainty: If something is unknown, state it clearly as unknown.
- Report Format:
  1. Confirmed Facts: [Fact] -> [Source]
  2. Critical Assumptions: [Assumption] -> [Why it's a risk] -> [How to verify]
`;
        } else if (phase === 'modify') {
            steeringDirectives = `
=== TAXONOMY POLICY: TARGET MODIFICATION PHASE ===
- You are strictly authorized to modify codebase files.
- You must output lightweight, precision-targeted JSON patches rather than rewriting massive files.
- Return your changes in a strict JSON AST Patch format matching this structure:
\`\`\`json
[
  {
    "file": "relative/path/to/file.ts",
    "patches": [
      {
        "find": "exact block of code to search",
        "replace": "replacement code block to drop in"
      }
    ]
  }
]
\`\`\`
- Enforce strict type-safety, maintain imports, and avoid implicit 'any' declarations.
- Restricted actions: GREP, FIND_FILES (BLOCKED - focus purely on patching targets).
`;
        } else if (phase === 'verify') {
            const compilerInstruction = activeFileExt === '.py'
                ? "spawning python syntax verification checks (python -m py_compile)"
                : "spawning TypeScript syntax/type verification checks (npx tsc --noEmit)";
            
            steeringDirectives = `
=== TAXONOMY POLICY: COMPILER-AUDITED VERIFICATION PHASE ===
- You are in auditing/verification mode.
- We are running active compiler loops: ${compilerInstruction}.
- Analyze raw diagnostic stdout/stderr compile results.
- Self-correct any syntax/compile errors by planning precise repairs.
- Focus entirely on ensuring the codebase builds with 100% success.
`;
        }

        let domainDirectives = '';
        if (taxonomyResult && taxonomyResult.resolvedSlots) {
            // Check if we have specific slots for this phase
            const slotName = phase === 'investigate' ? 'domain_guidance' : phase === 'modify' ? 'domain_guidance' : 'verification_focus';
            const val = taxonomyResult.resolvedSlots.get(slotName);
            if (val && val.trim().length > 0) {
                domainDirectives = `\n${val}\n`;
            }
        }

        return `${basePrompt}\n${steeringDirectives}\n${domainDirectives}`;
    }

    /**
     * Programmatic AST-like JSON patch applier.
     */
    static applyJSONPatch(patchJson: string): boolean {
        if (!patchJson) return false;

        try {
            // Extract clean JSON block if model wrapped it in markdown code fences
            let cleaned = patchJson.trim();
            if (cleaned.startsWith('```')) {
                const firstLine = cleaned.indexOf('\n');
                const lastFence = cleaned.lastIndexOf('```');
                if (firstLine !== -1 && lastFence !== -1 && lastFence > firstLine) {
                    cleaned = cleaned.substring(firstLine, lastFence).trim();
                }
            }

            const patches = JSON.parse(cleaned) as FilePatch[];
            if (!Array.isArray(patches)) {
                throw new Error("JSON Patch payload is not a valid array.");
            }

            let appliedAny = false;

            for (const filePatch of patches) {
                const relativePath = filePatch.file;
                const absolutePath = this.resolveToAllowedRoot(relativePath);

                if (!absolutePath) {
                    console.error(`[ASTPatchingService] Safety Block: Out-of-bounds patch target rejected: ${relativePath}`);
                    return false;
                }

                if (!fs.existsSync(absolutePath)) {
                    console.error(`[ASTPatchingService] Patch target file does not exist: ${relativePath}`);
                    return false;
                }

                let content = fs.readFileSync(absolutePath, 'utf-8');

                for (const patch of filePatch.patches) {
                    const findStr = patch.find;
                    const replaceStr = patch.replace;

                    // Exact match search
                    const index = content.indexOf(findStr);
                    if (index === -1) {
                        console.error(`[ASTPatchingService] Patch failed: could not locate target block in ${relativePath}. Target was:\n${findStr}`);
                        return false;
                    }

                    // Perform precise replacement
                    content = content.substring(0, index) + replaceStr + content.substring(index + findStr.length);
                }

                // Write modified contents back to disk
                const parentDir = path.dirname(absolutePath);
                if (!fs.existsSync(parentDir)) {
                    fs.mkdirSync(parentDir, { recursive: true });
                }
                fs.writeFileSync(absolutePath, content, 'utf-8');
                console.log(`[ASTPatchingService] Successfully applied AST patch to: ${relativePath}`);
                appliedAny = true;
            }

            return appliedAny;
        } catch (err: any) {
            console.error('[ASTPatchingService] Failed parsing or applying JSON AST patch:', err);
            return false;
        }
    }
}
