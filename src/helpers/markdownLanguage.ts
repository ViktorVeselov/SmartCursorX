import Prism from 'prismjs';

const PRISM_LANGUAGE_ALIASES: Record<string, string> = {
    code: 'plaintext',
    txt: 'plaintext',
    text: 'plaintext',
    j: 'javascript',
    tscript: 'typescript',
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    css: 'css',
    html: 'markup',
    htm: 'markup',
    bash: 'bash',
    sh: 'bash',
    zsh: 'bash',
    sql: 'sql',
    py: 'python',
    python: 'python',
    yml: 'yaml',
    yaml: 'yaml',
};

function inferLanguageFromCode(code: string): string {
    const text = code.trim();
    if (!text) return 'plaintext';

    const score = (patterns: RegExp[]) => patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0);

    const jsonScore = score([
        /^\s*\{/m,
        /^\s*\[/m,
        /"[^"]+"\s*:\s*/m,
        /:\s*(true|false|null|\d+|".*?")\s*[,}\]]/m
    ]);
    if (jsonScore >= 2) return 'json';

    const tsScore = score([
        /\binterface\s+\w+/m,
        /\btype\s+\w+\s*=/m,
        /\b(?:const|let|var)\s+\w+\s*:\s*[\w<>[\]|]+/m,
        /\bas\s+\w+/m,
        /\b(?:readonly\s+)?\w+\s*:\s*[\w<>[\]|]+/m,
        /\b(?:public|private|protected)\s+\w+/m
    ]);
    if (tsScore >= 2) return 'ts';

    const jsxScore = score([
        /<[A-Za-z][\w-]*(\s|>)/m,
        /\breturn\s*\(\s*</m,
        /\bprops\b.*</m
    ]);
    if (jsxScore >= 2) return tsScore > 0 ? 'tsx' : 'jsx';

    const jsScore = score([
        /\b(?:const|let|var)\s+\w+/m,
        /\bfunction\s+\w+/m,
        /\bclass\s+\w+/m,
        /\bexport\s+(?:default\s+)?/m,
        /\bimport\s+.+\s+from\s+['"]/m,
        /=>/m,
        /\bconsole\.(log|error|warn)\b/m
    ]);
    if (jsScore >= 2) return 'js';

    const cssScore = score([
        /\b[a-z-]+\s*:\s*[^;{]+;/m,
        /#[0-9a-fA-F]{3,8}\b/m,
        /\b(?:display|position|margin|padding|color|background)\s*:/m
    ]);
    if (cssScore >= 2) return 'css';

    const htmlScore = score([
        /<\/?[a-z][\w:-]*(\s[^>]*)?>/mi,
        /<!doctype html>/mi
    ]);
    if (htmlScore >= 2) return 'markup';

    const bashScore = score([
        /^#!\/(?:bin\/)?(?:ba|z)?sh/m,
        /\b(?:echo|cd|mkdir|rm|cp|mv|npm|npx|yarn|pnpm|git|curl|wget)\b/m,
        /\$\w+|\$\{[^}]+\}/m
    ]);
    if (bashScore >= 2) return 'bash';

    const sqlScore = score([
        /\bSELECT\b.+\bFROM\b/mi,
        /\bINSERT\s+INTO\b/mi,
        /\bCREATE\s+TABLE\b/mi,
        /\bWHERE\b/mi
    ]);
    if (sqlScore >= 2) return 'sql';

    const yamlScore = score([
        /^\s*[\w-]+\s*:\s*.+$/m,
        /^\s*-\s+.+$/m,
        /^\s*version\s*:\s*.+$/m
    ]);
    if (yamlScore >= 2) return 'yaml';

    const pythonScore = score([
        /^\s*def\s+\w+\(/m,
        /^\s*class\s+\w+\s*:/m,
        /\bimport\s+\w+/m,
        /\bfrom\s+\w+\s+import\s+/m,
        /:\s*$/m
    ]);
    if (pythonScore >= 2) return 'python';

    return 'plaintext';
}

function normalizeLanguage(language: string) {
    const lower = (language || '').toLowerCase();
    return PRISM_LANGUAGE_ALIASES[lower] || lower || 'plaintext';
}

function getPrismGrammar(language: string, code: string) {
    const normalized = normalizeLanguage(language);
    const effectiveLanguage = normalized === 'plaintext' ? inferLanguageFromCode(code) : normalized;
    return Prism.languages[effectiveLanguage] || Prism.languages.plaintext;
}

export { getPrismGrammar };
