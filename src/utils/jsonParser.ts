/**
 * Utility for robustly extracting, cleaning, and parsing JSON objects from LLM responses,
 * especially when they contain concatenated JSON blocks, raw control characters, or trailing commas.
 */

/**
 * Extracts and cleans all JSON objects from a text string.
 * Automatically handles:
 * 1. Embedded JSON inside text/markdown wrappers.
 * 2. Multiple concatenated JSON blocks (e.g. { ... }{ ... }).
 * 3. Unescaped control characters (newlines, tabs, returns) inside string values.
 * 4. Trailing commas in objects or arrays.
 */
// eslint-disable-next-line max-lines-per-function, complexity
export function cleanAndExtractJSONObjects(text: string): Record<string, unknown>[] {
    const objects: Record<string, unknown>[] = [];
    let braceCount = 0;
    let startIndex = -1;
    let inString = false;
    let escapeNext = false;
    let cleanedCandidate = '';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        if (inString && char === '\\') {
            const nextChar = text[i + 1];
            const validEscapes = ['"', '\\', '/', 'b', 'f', 'n', 'r', 't'];
            if (nextChar && validEscapes.includes(nextChar)) {
                escapeNext = true;
                if (startIndex !== -1) cleanedCandidate += '\\';
            } else if (nextChar === 'u') {
                const isHex = (c: string) => c && /[0-9a-fA-F]/.test(c);
                if (
                    isHex(text[i + 2]) &&
                    isHex(text[i + 3]) &&
                    isHex(text[i + 4]) &&
                    isHex(text[i + 5])
                ) {
                    escapeNext = true;
                    // eslint-disable-next-line max-depth
                    if (startIndex !== -1) cleanedCandidate += '\\';
                } else {
                    // eslint-disable-next-line max-depth
                    if (startIndex !== -1) cleanedCandidate += '\\\\';
                }
            } else {
                if (startIndex !== -1) cleanedCandidate += '\\\\';
            }
            continue;
        }

        if (escapeNext) {
            escapeNext = false;
            if (startIndex !== -1) cleanedCandidate += char;
            continue;
        }
        if (char === '\\') {
            escapeNext = true;
            if (startIndex !== -1) cleanedCandidate += char;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            if (startIndex !== -1) cleanedCandidate += char;
            continue;
        }
        
        if (inString) {
            if (startIndex !== -1) {
                if (char === '\n') {
                    cleanedCandidate += '\\n';
                } else if (char === '\r') {
                    cleanedCandidate += '\\r';
                } else if (char === '\t') {
                    cleanedCandidate += '\\t';
                } else {
                    cleanedCandidate += char;
                }
            }
        } else {
            if (char === '{') {
                if (braceCount === 0) {
                    startIndex = i;
                    cleanedCandidate = '{';
                } else {
                    cleanedCandidate += '{';
                }
                braceCount++;
            } else if (char === '}') {
                braceCount--;
                if (startIndex !== -1) {
                    cleanedCandidate += '}';
                }
                if (braceCount === 0 && startIndex !== -1) {
                    // Pre-process trailing commas
                    let textToParse = cleanedCandidate;
                    try {
                        // Remove trailing commas before closing braces/brackets
                        textToParse = textToParse.replace(/,\s*([\]}])/g, '$1');
                        
                        const parsed = JSON.parse(textToParse);
                        if (parsed && typeof parsed === 'object') {
                            objects.push(parsed);
                        }
                    } catch (e) {
                        console.warn('Failed to parse cleaned JSON candidate:', textToParse, e);
                    }
                    startIndex = -1;
                    cleanedCandidate = '';
                } else if (braceCount < 0) {
                    braceCount = 0;
                    startIndex = -1;
                    cleanedCandidate = '';
                }
            } else {
                if (startIndex !== -1) {
                    cleanedCandidate += char;
                }
            }
        }
    }
    return objects;
}

/**
 * Merges parsed objects into a single ExecutionPlan structure.
 * Takes the longest/most complete version of designDoc, expectedOutcome, etc.,
 * and merges classDependencies and other collections cleanly.
 */
// eslint-disable-next-line complexity
export function mergeExecutionPlans(objects: Record<string, unknown>[]): Record<string, unknown> | null {
    if (objects.length === 0) return null;
    
    const merged: Record<string, unknown> = {};

    for (const obj of objects) {
        if (!obj || typeof obj !== 'object') continue;

        // Simple primitive fields
        if (obj.taskId !== undefined) merged.taskId = obj.taskId;
        if (obj.confidence !== undefined) merged.confidence = obj.confidence;
        if (obj.approved !== undefined) merged.approved = obj.approved;
        
        // Merge designDoc: take the longest or last non-empty to avoid truncated specs
        if (obj.designDoc !== undefined && typeof obj.designDoc === 'string') {
            const doc = obj.designDoc.trim();
            const currentDoc = typeof merged.designDoc === 'string' ? merged.designDoc : '';
            if (!merged.designDoc || doc.length > currentDoc.length) {
                merged.designDoc = doc;
            }
        }

        // Merge expectedOutcome: longest/most complete
        if (obj.expectedOutcome !== undefined && typeof obj.expectedOutcome === 'string') {
            const outcome = obj.expectedOutcome.trim();
            const currentOutcome = typeof merged.expectedOutcome === 'string' ? merged.expectedOutcome : '';
            if (!merged.expectedOutcome || outcome.length > currentOutcome.length) {
                merged.expectedOutcome = outcome;
            }
        }

        // Merge steps array
        if (Array.isArray(obj.steps)) {
            if (!merged.steps || obj.steps.length > 0) {
                merged.steps = obj.steps;
            }
        }
        
        // Merge collections
        if (Array.isArray(obj.filesRead)) {
            merged.filesRead = Array.from(new Set([...((merged.filesRead as string[]) || []), ...(obj.filesRead as string[])]));
        }
        if (Array.isArray(obj.filesToModify)) {
            merged.filesToModify = Array.from(new Set([...((merged.filesToModify as string[]) || []), ...(obj.filesToModify as string[])]));
        }
        if (Array.isArray(obj.filesToCreate)) {
            merged.filesToCreate = Array.from(new Set([...((merged.filesToCreate as string[]) || []), ...(obj.filesToCreate as string[])]));
        }
        if (Array.isArray(obj.verificationCriteria)) {
            merged.verificationCriteria = Array.from(new Set([...((merged.verificationCriteria as string[]) || []), ...(obj.verificationCriteria as string[])]));
        }
        
        // Merge classDependencies by unique class/module name
        if (Array.isArray(obj.classDependencies)) {
            const uniqueDeps = new Map<string, Record<string, unknown>>();
            const allDeps = [...((merged.classDependencies as Record<string, unknown>[]) || []), ...(obj.classDependencies as Record<string, unknown>[])];
            allDeps.forEach(dep => {
                if (dep && typeof dep === 'object' && typeof dep.name === 'string') {
                    uniqueDeps.set(dep.name, dep);
                }
            });
            merged.classDependencies = Array.from(uniqueDeps.values());
        }

        // Merge tradeoffs by unique task
        if (Array.isArray(obj.tradeoffs)) {
            const uniqueTradeoffs = new Map<string, Record<string, unknown>>();
            const allTradeoffs = [...((merged.tradeoffs as Record<string, unknown>[]) || []), ...(obj.tradeoffs as Record<string, unknown>[])];
            allTradeoffs.forEach(t => {
                if (t && typeof t === 'object' && typeof t.task === 'string') {
                    uniqueTradeoffs.set(t.task, t);
                }
            });
            merged.tradeoffs = Array.from(uniqueTradeoffs.values());
        }

        // Merge consequences by unique failureMode
        if (Array.isArray(obj.consequences)) {
            const uniqueConsequences = new Map<string, Record<string, unknown>>();
            const allConsequences = [...((merged.consequences as Record<string, unknown>[]) || []), ...(obj.consequences as Record<string, unknown>[])];
            allConsequences.forEach(c => {
                if (c && typeof c === 'object' && typeof c.failureMode === 'string') {
                    uniqueConsequences.set(c.failureMode, c);
                }
            });
            merged.consequences = Array.from(uniqueConsequences.values());
        }
    }

    return merged;
}

const PLANNING_TEXT_KEYS = [
    'designDoc',
    'codePlanning',
    'markdown',
    'content',
    'text',
    'body',
    'description',
] as const;

function looksLikeJsonWrapper(text: string): boolean {
    const trimmed = text.trim();
    return (
        trimmed.startsWith('{') ||
        trimmed.startsWith('[') ||
        (trimmed.startsWith('"') && trimmed.endsWith('"'))
    );
}

function unescapePlanningEscapes(text: string): string {
    return text
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"');
}

function extractPlanningField(record: Record<string, unknown>, depth: number): string {
    for (const key of PLANNING_TEXT_KEYS) {
        if (record[key] !== undefined) {
            const extracted = unwrapPlanningText(record[key], depth + 1);
            if (extracted) return extracted;
        }
    }

    const stringValues = Object.values(record).filter((v): v is string => typeof v === 'string');
    if (stringValues.length === 1) {
        const extracted = unwrapPlanningText(stringValues[0], depth + 1);
        if (extracted) return extracted;
    }

    return '';
}

/**
 * Unwraps planning markdown from strings that may be JSON-encoded, double-encoded,
 * or contain literal escape sequences from malformed LLM output.
 */
// eslint-disable-next-line complexity
export function unwrapPlanningText(value: unknown, depth = 0): string {
    if (value == null) return '';

    if (typeof value === 'string') {
        const text = value.trim();
        if (!text) return '';

        if (depth < 4) {
            const candidates = looksLikeJsonWrapper(text)
                ? [text, unescapePlanningEscapes(text)]
                : [text];

            for (const candidate of candidates) {
                try {
                    const parsed = JSON.parse(candidate);
                    // eslint-disable-next-line max-depth
                    if (typeof parsed === 'string') {
                        return unwrapPlanningText(parsed, depth + 1);
                    }
                    // eslint-disable-next-line max-depth
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        const extracted = extractPlanningField(parsed as Record<string, unknown>, depth);
                        // eslint-disable-next-line max-depth
                        if (extracted) return extracted;
                    }
                } catch {
                    // Not JSON; keep trying fallbacks.
                }
            }

            if (looksLikeJsonWrapper(text)) {
                const parsedObjects = cleanAndExtractJSONObjects(text);
                if (parsedObjects.length > 0) {
                    const merged = mergeExecutionPlans(parsedObjects);
                    const extracted = extractPlanningField(merged as Record<string, unknown>, depth);
                    // eslint-disable-next-line max-depth
                    if (extracted) return extracted;
                }
            }
        }

        if (text.includes('\\n') || text.includes('\\r') || text.includes('\\t') || text.includes('\\"')) {
            return unescapePlanningEscapes(text);
        }

        return text;
    }

    if (Array.isArray(value)) {
        return value
            .map(v => unwrapPlanningText(v, depth + 1))
            .filter(Boolean)
            .join('\n\n');
    }

    if (typeof value === 'object') {
        return extractPlanningField(value as Record<string, unknown>, depth);
    }

    return '';
}

export function isExecutionPlanLike(obj: unknown): obj is Record<string, unknown> {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    const plan = obj as Record<string, unknown>;
    return !!(
        plan.steps ||
        plan.designDoc ||
        plan.expectedOutcome ||
        plan.classDependencies ||
        plan.tradeoffs ||
        plan.consequences ||
        plan.filesRead ||
        plan.filesToModify ||
        plan.filesToCreate
    );
}

export function looksLikeRawPlanJson(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed.startsWith('{')) return false;
    return /"(?:designDoc|steps|expectedOutcome|tradeoffs|consequences|classDependencies)"/.test(trimmed);
}

/**
 * Extracts the best execution-plan object from LLM text (valid JSON, malformed JSON, or partial).
 */
export function extractExecutionPlanFromText(text: string): { plan: Record<string, unknown>; startIndex: number } | null {
    if (!text?.trim()) return null;

    const extracted = cleanAndExtractJSONObjects(text);
    if (extracted.length > 0) {
        const merged = mergeExecutionPlans(extracted);
        if (isExecutionPlanLike(merged)) {
            const startIndex = text.indexOf('{');
            return { plan: merged, startIndex: startIndex >= 0 ? startIndex : 0 };
        }
    }

    let searchPos = 0;
    while (searchPos < text.length) {
        const braceIdx = text.indexOf('{', searchPos);
        if (braceIdx === -1) break;

        const parsed = parsePartialJSON(text.substring(braceIdx));
        if (isExecutionPlanLike(parsed)) {
            return { plan: parsed, startIndex: braceIdx };
        }
        searchPos = braceIdx + 1;
    }

    return null;
}

export function buildPlanDisplayMessage(
    taskId: number | null | undefined,
    plan?: Record<string, unknown> | null,
    alreadyHasPlanLink = false,
    isPlanMode = false
): string {
    const stepsCount = Array.isArray(plan?.steps) ? plan!.steps.length : 0;

    let message: string;
    if (isPlanMode) {
        const hasDesignContent = !!(
            (typeof plan?.designDoc === 'string' && plan.designDoc.trim()) ||
            (Array.isArray(plan?.tradeoffs) && plan.tradeoffs.length > 0) ||
            (Array.isArray(plan?.consequences) && plan.consequences.length > 0) ||
            (Array.isArray(plan?.classDependencies) && plan.classDependencies.length > 0)
        );
        if (stepsCount > 0) {
            message = `**Roadmap & Design Specifications** generated in [Design Doc (implementation_plan.md)](file:///implementation_plan.md) successfully. Inspect the detailed plan in the tabs above.`;
        } else if (hasDesignContent) {
            message = '**Design specifications** saved to the plan editor. Inspect the Design Doc and Code Planning tabs above.';
        } else {
            message = `**Roadmap & Design Specifications** generated in [Design Doc (implementation_plan.md)](file:///implementation_plan.md) successfully. Inspect the detailed plan in the tabs above.`;
        }
    } else {
        if (stepsCount > 0) {
            const steps = plan!.steps as Array<{ action?: string; target?: string }>;
            const summary = steps.slice(0, 3).map(s => `- ${s.action || 'step'}: ${s.target || ''}`).join('\n');
            message = `**Plan generated** with ${stepsCount} step${stepsCount > 1 ? 's' : ''}.\n${summary}${stepsCount > 3 ? `\n- +${stepsCount - 3} more` : ''}\n\n[Click to Open Interactive Plan](plan://${taskId})`;
        } else {
            message = `**Plan generated**.\n\n[Click to Open Interactive Plan](plan://${taskId})`;
        }
        return message;
    }

    const planSuffix = taskId && !alreadyHasPlanLink ? `\n\n[Click to Open Interactive Plan](plan://${taskId})` : '';
    return message + planSuffix;
}

/**
 * Parses incomplete/partial JSON strings by balancing brackets, braces, and quotes.
 * Extremely useful for parsing LLM plan JSON objects while they are still streaming.
 */
// eslint-disable-next-line max-lines-per-function, complexity
export function parsePartialJSON(jsonStr: string): Record<string, unknown> | null {
    const clean = jsonStr.trim();
    if (!clean.startsWith('{')) return null;

    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;
    let cleaned = '';

    for (let i = 0; i < clean.length; i++) {
        const char = clean[i];
        
        if (inString && char === '\\') {
            const nextChar = clean[i + 1];
            const validEscapes = ['"', '\\', '/', 'b', 'f', 'n', 'r', 't'];
            if (nextChar && validEscapes.includes(nextChar)) {
                escapeNext = true;
                cleaned += '\\';
            } else if (nextChar === 'u') {
                const isHex = (c: string) => c && /[0-9a-fA-F]/.test(c);
                if (
                    isHex(clean[i + 2]) &&
                    isHex(clean[i + 3]) &&
                    isHex(clean[i + 4]) &&
                    isHex(clean[i + 5])
                ) {
                    escapeNext = true;
                    cleaned += '\\';
                } else {
                    cleaned += '\\\\';
                }
            } else {
                cleaned += '\\\\';
            }
            continue;
        }

        if (escapeNext) {
            escapeNext = false;
            cleaned += char;
            continue;
        }
        if (char === '\\') {
            escapeNext = true;
            cleaned += char;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            cleaned += char;
            continue;
        }

        if (inString) {
            if (char === '\n') {
                cleaned += '\\n';
            } else if (char === '\r') {
                cleaned += '\\r';
            } else if (char === '\t') {
                cleaned += '\\t';
            } else {
                cleaned += char;
            }
        } else {
            cleaned += char;
            if (char === '{') braceCount++;
            else if (char === '}') braceCount--;
            else if (char === '[') bracketCount++;
            else if (char === ']') bracketCount--;
        }
    }

    let balanced = cleaned;
    if (inString) {
        balanced += '"';
    }

    while (bracketCount > 0) {
        balanced += ']';
        bracketCount--;
    }
    while (braceCount > 0) {
        balanced += '}';
        braceCount--;
    }

    try {
        // Clean trailing commas before parsing
        const textToParse = balanced.replace(/,\s*([\]}])/g, '$1');
        return JSON.parse(textToParse);
    } catch (e) {
        return null;
    }
}
