import * as fs from 'fs';
import * as path from 'path';
import { diffLines } from 'diff';
import console from 'console';
import { PathGuard } from './PathGuard';
import type { PendingFileModification, PendingPatch } from '../../src/types/appTypes';

export interface PatchBlock {
    find: string;
    replace: string;
}

export interface FilePatch {
    file: string;
    patches: PatchBlock[];
    /** @deprecated use file instead — treated as alias for `file` */
    path?: string;
    /** @deprecated use file instead — treated as alias for `file` */
    filename?: string;
    /** @deprecated use patches instead — treated as alias for `[{ find: "", replace: content }]` */
    content?: string;
    /** @deprecated use patches instead — treated as alias for `[{ find: "", replace: code }]` */
    code?: string;
}

export class ASTPatchingService {

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

    private static computeLineStats(original: string, proposed: string): { addedLines: number; removedLines: number } {
        try {
            const changes = diffLines(original, proposed);
            let added = 0;
            let removed = 0;
            for (const change of changes) {
                if (change.added) added += change.count ?? 0;
                if (change.removed) removed += change.count ?? 0;
            }
            return { addedLines: added, removedLines: removed };
        } catch {
            return { addedLines: 0, removedLines: 0 };
        }
    }

    private static extractJson(text: string): string {
        let cleaned = text.trim();
        
        // Find markdown code blocks (e.g. ```json ... ``` or ``` ... ```)
        const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/i;
        const match = cleaned.match(codeBlockRegex);
        if (match && match[1]) {
            return match[1].trim();
        }
        
        // Fallback: Find the first '[' or '{' and the last ']' or '}'
        const firstBracket = cleaned.indexOf('[');
        const firstBrace = cleaned.indexOf('{');
        let start = -1;
        let end = -1;
        
        if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
            start = firstBracket;
            end = cleaned.lastIndexOf(']');
        } else if (firstBrace !== -1) {
            start = firstBrace;
            end = cleaned.lastIndexOf('}');
        }
        
        if (start !== -1 && end !== -1 && end > start) {
            return cleaned.substring(start, end + 1).trim();
        }
        
        return cleaned;
    }

    /**
     * Parses JSON AST patches and returns preview data without writing to disk.
     * Used by the Change Review system to show users pending modifications before applying.
     */
    static generatePreviewPatches(patchJson: string, stepTarget?: string, isCreate: boolean = false): PendingFileModification[] {
        if (!patchJson) return [];

        try {
            const cleaned = this.extractJson(patchJson);
            let patches = JSON.parse(cleaned) as FilePatch[];
            if (!Array.isArray(patches)) {
                if (patches && typeof patches === 'object' && (('file' in patches && 'patches' in patches) || (('file' in patches || 'path' in patches || 'filename' in patches) && ('content' in patches || 'code' in patches || 'patches' in patches)))) {
                    patches = [patches as FilePatch];
                } else {
                    throw new Error("JSON Patch payload is not a valid array or single patch object.");
                }
            }

            const results: PendingFileModification[] = [];

            for (const filePatch of patches) {
                const relativePath = filePatch.file || filePatch.path || filePatch.filename || '';
                const absolutePath = PathGuard.resolve(relativePath);

                if (!absolutePath) {
                    console.error(`[ASTPatchingService] Preview Safety Block: Out-of-bounds patch target rejected: ${relativePath}`);
                    continue;
                }

                    let content = '';
                    try {
                        const isTargetCreate = isCreate && (
                            relativePath === stepTarget ||
                            (stepTarget && absolutePath === PathGuard.resolve(stepTarget))
                        );
                        if (!isTargetCreate && fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
                            content = fs.readFileSync(absolutePath, 'utf-8');
                        }
                    } catch {
                        // EISDIR or permission error — treat as empty (new file)
                    }
                    const originalContent = content;
                const appliedPatches: PendingPatch[] = [];

                const patchList = filePatch.patches || (filePatch.content ? [{ find: '', replace: filePatch.content }] : filePatch.code ? [{ find: '', replace: filePatch.code }] : null);
                if (!patchList) {
                    console.error(`[ASTPatchingService] Preview: No patches, content, or code found for ${relativePath}, skipping.`);
                    continue;
                }

                for (const patch of patchList) {
                    const findStr = patch.find;
                    const replaceStr = patch.replace;

                    const index = content.indexOf(findStr);
                    if (index === -1) {
                        if (content === '') {
                            content = replaceStr;
                            appliedPatches.push({ find: findStr, replace: replaceStr });
                            continue;
                        }
                        console.error(`[ASTPatchingService] Preview: could not locate target block in ${relativePath}. Skipping patch.`);
                        continue;
                    }

                    content = content.substring(0, index) + replaceStr + content.substring(index + findStr.length);
                    appliedPatches.push({ find: findStr, replace: replaceStr });
                }

                if (appliedPatches.length === 0) {
                    console.error(`[ASTPatchingService] Preview: No patches applied for ${relativePath}, skipping.`);
                    continue;
                }

                const lineStats = this.computeLineStats(originalContent, content);

                results.push({
                    relativePath,
                    absolutePath,
                    originalContent,
                    proposedContent: content,
                    patches: appliedPatches,
                    addedLines: lineStats.addedLines,
                    removedLines: lineStats.removedLines,
                });
            }

            return results;
        } catch (err: any) {
            console.error('[ASTPatchingService] Failed to generate preview patches:', err);
            return [];
        }
    }

    /**
     * Programmatic AST-like JSON patch applier.
     */
    static applyJSONPatch(patchJson: string): boolean {
        if (!patchJson) return false;

        try {
            const cleaned = this.extractJson(patchJson);
            let patches = JSON.parse(cleaned) as FilePatch[];
            if (!Array.isArray(patches)) {
                if (patches && typeof patches === 'object' && (('file' in patches && 'patches' in patches) || (('file' in patches || 'path' in patches || 'filename' in patches) && ('content' in patches || 'code' in patches || 'patches' in patches)))) {
                    patches = [patches as FilePatch];
                } else {
                    throw new Error("JSON Patch payload is not a valid array or single patch object.");
                }
            }

            let appliedAny = false;

            for (const filePatch of patches) {
                const relativePath = filePatch.file || filePatch.path || filePatch.filename || '';
                const absolutePath = PathGuard.resolve(relativePath);

                if (!absolutePath) {
                    console.error(`[ASTPatchingService] Safety Block: Out-of-bounds patch target rejected: ${relativePath}`);
                    return false;
                }

                let content = '';
                try {
                    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
                        content = fs.readFileSync(absolutePath, 'utf-8');
                    }
                } catch {
                    // EISDIR or permission error — treat as empty (new file)
                }

                const patchList = filePatch.patches || (filePatch.content ? [{ find: '', replace: filePatch.content }] : filePatch.code ? [{ find: '', replace: filePatch.code }] : null);
                if (!patchList) {
                    console.error(`[ASTPatchingService] No patches, content, or code found for ${relativePath}, skipping.`);
                    return false;
                }

                for (const patch of patchList) {
                    const findStr = patch.find;
                    const replaceStr = patch.replace;

                    // Exact match search
                    const index = content.indexOf(findStr);
                    if (index === -1) {
                        if (content === '') {
                            content = replaceStr;
                            continue;
                        }
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
