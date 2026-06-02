import * as fs from 'fs';
import * as path from 'path';

export interface CodeSymbol {
    name: string;
    kind: 'class' | 'function' | 'interface' | 'method';
    startLine: number;
    endLine: number;
    signature: string;
    params: string[];
    docstring: string;
}

export interface Reference {
    filePath: string;
    line: number;
    column: number;
    lineContent: string;
    context: string;
}

export interface CallHierarchyNode {
    symbol: string;
    filePath: string;
    line: number;
    calls: string[];
}

export class CodeAnalysisService {
    private static outlineCache: Map<string, { mtimeMs: number; outline: { classes: CodeSymbol[]; functions: CodeSymbol[]; interfaces: CodeSymbol[] } }> = new Map();

    /**
     * Extracts classes, functions, interfaces, and methods from a file using precise regex scanning and block boundaries.
     */
    static parseFileSymbols(filePath: string): { classes: CodeSymbol[]; functions: CodeSymbol[]; interfaces: CodeSymbol[] } {
        console.assert(filePath && typeof filePath === 'string', 'File path must be a valid string');
        const classes: CodeSymbol[] = [];
        const functions: CodeSymbol[] = [];
        const interfaces: CodeSymbol[] = [];

        if (!fs.existsSync(filePath)) {
            return { classes, functions, interfaces };
        }

        try {
            const stat = fs.statSync(filePath);
            const cached = this.outlineCache.get(filePath);
            if (cached && cached.mtimeMs === stat.mtimeMs) {
                return cached.outline;
            }

            const ext = path.extname(filePath);
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split(/\r?\n/);

            // Simple and robust scanning for TS/JS files
            if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
                this.parseTypeScriptSymbols(lines, classes, functions, interfaces);
            } else if (ext === '.py') {
                this.parsePythonSymbols(lines, classes, functions);
            } else if (ext === '.rs') {
                this.parseRustSymbols(lines, classes, functions, interfaces);
            } else {
                this.parseGenericSymbols(lines, classes, functions, interfaces, ext);
            }

            const parsedResult = { classes, functions, interfaces };
            this.outlineCache.set(filePath, { mtimeMs: stat.mtimeMs, outline: parsedResult });
            return parsedResult;
        } catch (e) {
            console.error('[CodeAnalysisService] Failed parsing outline, fallback to empty:', e);
            return { classes, functions, interfaces };
        }
    }

    private static parseTypeScriptSymbols(
        lines: string[],
        classes: CodeSymbol[],
        functions: CodeSymbol[],
        interfaces: CodeSymbol[]
    ) {
        // Regex rules conforming to static parsing patterns
        const classRegex = /^(?:export\s+)?class\s+(\w+)/;
        const interfaceRegex = /^(?:export\s+)?interface\s+(\w+)/;
        const funcRegex = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/;

        let docstringAccumulator: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Docstring accumulation
            if (line.trim().startsWith('/**')) {
                docstringAccumulator = [line.trim()];
                let j = i + 1;
                while (j < lines.length && !lines[j].trim().endsWith('*/')) {
                    docstringAccumulator.push(lines[j].trim());
                    j++;
                }
                if (j < lines.length) {
                    docstringAccumulator.push(lines[j].trim());
                    i = j; // skip forward
                }
                continue;
            }

            const docstring = docstringAccumulator.join('\n');
            docstringAccumulator = [];

            // Class matching
            const classMatch = line.match(classRegex);
            if (classMatch) {
                const name = classMatch[1];
                const endLine = this.findMatchingBraceLine(lines, i);
                classes.push({
                    name,
                    kind: 'class',
                    startLine: i + 1,
                    endLine: endLine + 1,
                    signature: line.trim(),
                    params: [],
                    docstring
                });
                continue;
            }

            // Interface matching
            const interfaceMatch = line.match(interfaceRegex);
            if (interfaceMatch) {
                const name = interfaceMatch[1];
                const endLine = this.findMatchingBraceLine(lines, i);
                interfaces.push({
                    name,
                    kind: 'interface',
                    startLine: i + 1,
                    endLine: endLine + 1,
                    signature: line.trim(),
                    params: [],
                    docstring
                });
                continue;
            }

            // Function matching
            const funcMatch = line.match(funcRegex);
            if (funcMatch) {
                const name = funcMatch[1];
                const params = funcMatch[2].split(',').map(p => p.trim()).filter(Boolean);
                const endLine = this.findMatchingBraceLine(lines, i);
                functions.push({
                    name,
                    kind: 'function',
                    startLine: i + 1,
                    endLine: endLine + 1,
                    signature: line.trim(),
                    params,
                    docstring
                });
            }
        }
    }

    private static parsePythonSymbols(lines: string[], classes: CodeSymbol[], functions: CodeSymbol[]) {
        const classRegex = /^class\s+(\w+)(?:\(([^)]*)\))?:/;
        const funcRegex = /^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\):/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            const classMatch = line.match(classRegex);
            if (classMatch) {
                const name = classMatch[1];
                const endLine = this.findPythonBlockEndLine(lines, i);
                classes.push({
                    name,
                    kind: 'class',
                    startLine: i + 1,
                    endLine: endLine + 1,
                    signature: line.trim(),
                    params: [],
                    docstring: ''
                });
                continue;
            }

            const funcMatch = line.match(funcRegex);
            if (funcMatch) {
                const name = funcMatch[1];
                const params = funcMatch[2].split(',').map(p => p.trim()).filter(Boolean);
                const endLine = this.findPythonBlockEndLine(lines, i);
                functions.push({
                    name,
                    kind: 'function',
                    startLine: i + 1,
                    endLine: endLine + 1,
                    signature: line.trim(),
                    params,
                    docstring: ''
                });
            }
        }
    }

    private static parseRustSymbols(
        lines: string[],
        classes: CodeSymbol[],
        functions: CodeSymbol[],
        interfaces: CodeSymbol[]
    ) {
        const structRegex = /^(?:pub\s+)?struct\s+(\w+)/;
        const traitRegex = /^(?:pub\s+)?trait\s+(\w+)/;
        const fnRegex = /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*\(([^)]*)\)/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            const structMatch = line.match(structRegex);
            if (structMatch) {
                const name = structMatch[1];
                const endLine = this.findMatchingBraceLine(lines, i);
                classes.push({
                    name,
                    kind: 'class',
                    startLine: i + 1,
                    endLine: endLine + 1,
                    signature: line.trim(),
                    params: [],
                    docstring: ''
                });
                continue;
            }

            const traitMatch = line.match(traitRegex);
            if (traitMatch) {
                const name = traitMatch[1];
                const endLine = this.findMatchingBraceLine(lines, i);
                interfaces.push({
                    name,
                    kind: 'interface',
                    startLine: i + 1,
                    endLine: endLine + 1,
                    signature: line.trim(),
                    params: [],
                    docstring: ''
                });
                continue;
            }

            const fnMatch = line.match(fnRegex);
            if (fnMatch) {
                const name = fnMatch[1];
                const params = fnMatch[2].split(',').map(p => p.trim()).filter(Boolean);
                const endLine = this.findMatchingBraceLine(lines, i);
                functions.push({
                    name,
                    kind: 'function',
                    startLine: i + 1,
                    endLine: endLine + 1,
                    signature: line.trim(),
                    params,
                    docstring: ''
                });
            }
        }
    }

    private static findMatchingBraceLine(lines: string[], startIdx: number): number {
        let braceCount = 0;
        let foundBrace = false;

        for (let i = startIdx; i < lines.length; i++) {
            const line = lines[i];
            for (let char of line) {
                if (char === '{') {
                    braceCount++;
                    foundBrace = true;
                } else if (char === '}') {
                    braceCount--;
                }
            }
            if (foundBrace && braceCount === 0) {
                return i;
            }
        }
        return lines.length - 1;
    }

    private static findPythonBlockEndLine(lines: string[], startIdx: number): number {
        const startLine = lines[startIdx];
        const startIndent = startLine.match(/^\s*/)?.[0].length || 0;

        for (let i = startIdx + 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '') continue; // Skip empty lines
            const currentIndent = line.match(/^\s*/)?.[0].length || 0;
            if (currentIndent <= startIndent) {
                return i - 1;
            }
        }
        return lines.length - 1;
    }

    /**
     * Finds all references to a specific symbol in the workspace directory.
     */
    static findReferences(symbolName: string, rootPath: string): Reference[] {
        console.assert(symbolName && typeof symbolName === 'string', 'Symbol name must be a valid string');
        console.assert(rootPath && typeof rootPath === 'string', 'Root path must be a valid string');
        
        const references: Reference[] = [];
        if (!fs.existsSync(rootPath)) return references;

        const filesToScan: string[] = [];
        this.scanDirectoryRecursive(rootPath, filesToScan);

        for (const filePath of filesToScan) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split(/\r?\n/);

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                let index = line.indexOf(symbolName);
                
                while (index !== -1) {
                    // Match boundaries to avoid substring false positives e.g. "myFunc" in "myFunction"
                    const charBefore = index > 0 ? line[index - 1] : '';
                    const charAfter = index + symbolName.length < line.length ? line[index + symbolName.length] : '';
                    const isWordBoundary = !/\w/.test(charBefore) && !/\w/.test(charAfter);

                    if (isWordBoundary) {
                        references.push({
                            filePath,
                            line: i + 1,
                            column: index + 1,
                            lineContent: line.trim(),
                            context: lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3)).join('\n')
                        });
                    }
                    index = line.indexOf(symbolName, index + 1);
                }
            }
        }

        return references.slice(0, 100); // cap reference matches safely
    }

    /**
     * Recursively retrieves call hierarchies (incoming or outgoing callers/callees).
     */
    static getCallHierarchy(symbolName: string, rootPath: string, direction: 'incoming' | 'outgoing'): CallHierarchyNode[] {
        console.assert(symbolName && typeof symbolName === 'string', 'Symbol name must be a valid string');
        console.assert(rootPath && typeof rootPath === 'string', 'Root path must be a valid string');
        
        const nodes: CallHierarchyNode[] = [];
        const filesToScan: string[] = [];
        this.scanDirectoryRecursive(rootPath, filesToScan);

        if (direction === 'incoming') {
            // Find all functions calling this symbol
            for (const filePath of filesToScan) {
                const content = fs.readFileSync(filePath, 'utf-8');
                const lines = content.split(/\r?\n/);
                const fileSymbols = this.parseFileSymbols(filePath);
                const allSymbols = [...fileSymbols.classes, ...fileSymbols.functions];

                for (const symbol of allSymbols) {
                    const blockLines = lines.slice(symbol.startLine - 1, symbol.endLine);
                    const blockText = blockLines.join('\n');
                    
                    if (blockText.includes(symbolName) && symbol.name !== symbolName) {
                        nodes.push({
                            symbol: symbol.name,
                            filePath,
                            line: symbol.startLine,
                            calls: [symbolName]
                        });
                    }
                }
            }
        } else {
            // Outgoing calls: find all symbols this function calls
            for (const filePath of filesToScan) {
                const fileSymbols = this.parseFileSymbols(filePath);
                const matchedSymbol = [...fileSymbols.classes, ...fileSymbols.functions].find(s => s.name === symbolName);

                if (matchedSymbol) {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const lines = content.split(/\r?\n/);
                    const blockText = lines.slice(matchedSymbol.startLine - 1, matchedSymbol.endLine).join('\n');

                    // Check other known functions in the file that are referenced in this block
                    const calls: string[] = [];
                    const allOtherSymbols = [...fileSymbols.classes, ...fileSymbols.functions].filter(s => s.name !== symbolName);
                    for (const other of allOtherSymbols) {
                        if (blockText.includes(other.name)) {
                            calls.push(other.name);
                        }
                    }

                    nodes.push({
                        symbol: symbolName,
                        filePath,
                        line: matchedSymbol.startLine,
                        calls
                    });
                }
            }
        }

        return nodes;
    }

    /**
     * Gets summary outline of code structures in workspace files.
     */
    static getWorkspaceOutline(rootPath: string): Array<{ filePath: string; outline: any }> {
        console.assert(rootPath && typeof rootPath === 'string', 'Root path is required');
        const list: Array<{ filePath: string; outline: any }> = [];
        const files: string[] = [];
        this.scanDirectoryRecursive(rootPath, files);

        for (const file of files.slice(0, 500)) { // limit recursion outline size
            const outline = this.parseFileSymbols(file);
            if (outline.classes.length > 0 || outline.functions.length > 0 || outline.interfaces.length > 0) {
                list.push({ filePath: file, outline });
            }
        }
        return list;
    }

    private static scanDirectoryRecursive(dir: string, fileList: string[]) {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        
        const binaryExtensions = new Set([
            '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz',
            '.exe', '.dll', '.so', '.dylib', '.woff', '.woff2', '.eot', '.ttf', '.mp4', '.mp3'
        ]);

        for (const file of files) {
            const fullPath = path.join(dir, file);
            try {
                if (fs.statSync(fullPath).isDirectory()) {
                    if (['node_modules', '.git', 'dist', 'build', 'out', 'release', 'dist-electron'].includes(file)) {
                        continue;
                    }
                    this.scanDirectoryRecursive(fullPath, fileList);
                } else {
                    const ext = path.extname(file).toLowerCase();
                    if (!binaryExtensions.has(ext)) {
                        fileList.push(fullPath);
                    }
                }
            } catch (e) {
                // Ignore stat errors for symlinks or permission-restricted folders
            }
        }
    }

    private static parseGenericSymbols(
        lines: string[],
        classes: CodeSymbol[],
        functions: CodeSymbol[],
        interfaces: CodeSymbol[],
        ext: string
    ) {
        ext = ext.toLowerCase();
        if (['.html', '.htm', '.xml', '.svg'].includes(ext)) {
            const idRegex = /id="([^"]+)"/;
            const classRegex = /class="([^"]+)"/;
            const tagRegex = /<(!?[\w:-]+)/;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const tagMatch = line.match(tagRegex);
                if (tagMatch) {
                    const tagName = tagMatch[1];
                    functions.push({
                        name: tagName,
                        kind: 'function',
                        startLine: i + 1,
                        endLine: i + 1,
                        signature: line.trim(),
                        params: [],
                        docstring: ''
                    });
                }
                const idMatch = line.match(idRegex);
                if (idMatch) {
                    interfaces.push({
                        name: `#${idMatch[1]}`,
                        kind: 'interface',
                        startLine: i + 1,
                        endLine: i + 1,
                        signature: line.trim(),
                        params: [],
                        docstring: ''
                    });
                }
                const classMatch = line.match(classRegex);
                if (classMatch) {
                    classes.push({
                        name: `.${classMatch[1]}`,
                        kind: 'class',
                        startLine: i + 1,
                        endLine: i + 1,
                        signature: line.trim(),
                        params: [],
                        docstring: ''
                    });
                }
                const fnMatch = line.match(/(?:function)\s+(\w+)/);
                if (fnMatch) {
                    functions.push({
                        name: fnMatch[1],
                        kind: 'function',
                        startLine: i + 1,
                        endLine: i + 1,
                        signature: line.trim(),
                        params: [],
                        docstring: ''
                    });
                }
            }
        } else if (['.css', '.scss', '.less'].includes(ext)) {
            const cssClassRegex = /^\.([\w-]+)/;
            const cssIdRegex = /^#([\w-]+)/;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                const classMatch = line.match(cssClassRegex);
                if (classMatch) {
                    classes.push({
                        name: `.${classMatch[1]}`,
                        kind: 'class',
                        startLine: i + 1,
                        endLine: i + 1,
                        signature: line,
                        params: [],
                        docstring: ''
                    });
                }
                const idMatch = line.match(cssIdRegex);
                if (idMatch) {
                    interfaces.push({
                        name: `#${idMatch[1]}`,
                        kind: 'interface',
                        startLine: i + 1,
                        endLine: i + 1,
                        signature: line,
                        params: [],
                        docstring: ''
                    });
                }
            }
        } else if (ext === '.md') {
            const headerRegex = /^(#+)\s+(.+)$/;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                const match = line.match(headerRegex);
                if (match) {
                    const level = match[1].length;
                    classes.push({
                        name: `${'#'.repeat(level)} ${match[2]}`,
                        kind: 'class',
                        startLine: i + 1,
                        endLine: i + 1,
                        signature: line,
                        params: [],
                        docstring: ''
                    });
                }
            }
        } else if (['.json', '.json5'].includes(ext)) {
            const jsonKeyRegex = /^\s*"([\w-]+)"\s*:/;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const match = line.match(jsonKeyRegex);
                if (match) {
                    functions.push({
                        name: match[1],
                        kind: 'function',
                        startLine: i + 1,
                        endLine: i + 1,
                        signature: line.trim(),
                        params: [],
                        docstring: ''
                    });
                }
            }
        } else {
            const funcRegex = /(?:function|def|fn)\s+(\w+)/;
            const classRegex = /(?:class|struct)\s+(\w+)/;
            const interfaceRegex = /interface\s+(\w+)/;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const fnMatch = line.match(funcRegex);
                if (fnMatch) {
                    functions.push({
                        name: fnMatch[1],
                        kind: 'function',
                        startLine: i + 1,
                        endLine: i + 1,
                        signature: line.trim(),
                        params: [],
                        docstring: ''
                    });
                }
                const clsMatch = line.match(classRegex);
                if (clsMatch) {
                    classes.push({
                        name: clsMatch[1],
                        kind: 'class',
                        startLine: i + 1,
                        endLine: i + 1,
                        signature: line.trim(),
                        params: [],
                        docstring: ''
                    });
                }
                const intMatch = line.match(interfaceRegex);
                if (intMatch) {
                    interfaces.push({
                        name: intMatch[1],
                        kind: 'interface',
                        startLine: i + 1,
                        endLine: i + 1,
                        signature: line.trim(),
                        params: [],
                        docstring: ''
                    });
                }
            }
        }
    }
}
