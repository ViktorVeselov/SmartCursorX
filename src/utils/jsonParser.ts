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
export function cleanAndExtractJSONObjects(text: string): any[] {
    const objects: any[] = [];
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
                    if (startIndex !== -1) cleanedCandidate += '\\';
                } else {
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
export function mergeExecutionPlans(objects: any[]): any {
    if (objects.length === 0) return null;
    
    const merged: any = {};

    for (const obj of objects) {
        if (!obj || typeof obj !== 'object') continue;

        // Simple primitive fields
        if (obj.taskId !== undefined) merged.taskId = obj.taskId;
        if (obj.confidence !== undefined) merged.confidence = obj.confidence;
        if (obj.approved !== undefined) merged.approved = obj.approved;
        
        // Merge designDoc: take the longest or last non-empty to avoid truncated specs
        if (obj.designDoc !== undefined && typeof obj.designDoc === 'string') {
            const doc = obj.designDoc.trim();
            if (!merged.designDoc || doc.length > merged.designDoc.length) {
                merged.designDoc = doc;
            }
        }

        // Merge expectedOutcome: longest/most complete
        if (obj.expectedOutcome !== undefined && typeof obj.expectedOutcome === 'string') {
            const outcome = obj.expectedOutcome.trim();
            if (!merged.expectedOutcome || outcome.length > merged.expectedOutcome.length) {
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
            merged.filesRead = Array.from(new Set([...(merged.filesRead || []), ...obj.filesRead]));
        }
        if (Array.isArray(obj.filesToModify)) {
            merged.filesToModify = Array.from(new Set([...(merged.filesToModify || []), ...obj.filesToModify]));
        }
        if (Array.isArray(obj.verificationCriteria)) {
            merged.verificationCriteria = Array.from(new Set([...(merged.verificationCriteria || []), ...obj.verificationCriteria]));
        }
        
        // Merge classDependencies by unique class/module name
        if (Array.isArray(obj.classDependencies)) {
            const uniqueDeps = new Map<string, any>();
            const allDeps = [...(merged.classDependencies || []), ...obj.classDependencies];
            allDeps.forEach(dep => {
                if (dep && typeof dep === 'object' && dep.name) {
                    uniqueDeps.set(dep.name, dep);
                }
            });
            merged.classDependencies = Array.from(uniqueDeps.values());
        }

        // Merge tradeoffs by unique task
        if (Array.isArray(obj.tradeoffs)) {
            const uniqueTradeoffs = new Map<string, any>();
            const allTradeoffs = [...(merged.tradeoffs || []), ...obj.tradeoffs];
            allTradeoffs.forEach(t => {
                if (t && typeof t === 'object' && t.task) {
                    uniqueTradeoffs.set(t.task, t);
                }
            });
            merged.tradeoffs = Array.from(uniqueTradeoffs.values());
        }

        // Merge consequences by unique failureMode
        if (Array.isArray(obj.consequences)) {
            const uniqueConsequences = new Map<string, any>();
            const allConsequences = [...(merged.consequences || []), ...obj.consequences];
            allConsequences.forEach(c => {
                if (c && typeof c === 'object' && c.failureMode) {
                    uniqueConsequences.set(c.failureMode, c);
                }
            });
            merged.consequences = Array.from(uniqueConsequences.values());
        }
    }

    return merged;
}

/**
 * Parses incomplete/partial JSON strings by balancing brackets, braces, and quotes.
 * Extremely useful for parsing LLM plan JSON objects while they are still streaming.
 */
export function parsePartialJSON(jsonStr: string): any {
    let clean = jsonStr.trim();
    if (!clean.startsWith('{')) return null;

    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < clean.length; i++) {
        const char = clean[i];
        if (escapeNext) {
            escapeNext = false;
            continue;
        }
        if (char === '\\') {
            escapeNext = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (!inString) {
            if (char === '{') braceCount++;
            else if (char === '}') braceCount--;
            else if (char === '[') bracketCount++;
            else if (char === ']') bracketCount--;
        }
    }

    let balanced = clean;
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
