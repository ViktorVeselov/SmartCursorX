const COMMENT_EMOJI_PATTERN = '(?:\\u{1F4AC}|ðŸ’¬)';
const COMMENT_DASH_PATTERN = '(?:\\u2014|â€”)';
const COMMENT_LINE_REGEX = new RegExp(
    `^>\\s*${COMMENT_EMOJI_PATTERN}\\s*\\*\\*Refactor Comment:\\*\\*\\s*(.*?)\\s*${COMMENT_DASH_PATTERN}\\s*\\*on:\\s*"([\\s\\S]*?)"\\*`,
    'u'
);

export function parseCommentsFromText(text: string, idPrefix = 'comment'): { parsedComments: { id: string; body: string; context: string; rawBlock: string }[]; cleanText: string } {
    const parsedComments: { id: string; body: string; context: string; rawBlock: string }[] = [];
    const cleanLines: string[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(COMMENT_LINE_REGEX);
        if (match) {
            parsedComments.push({
                id: `${idPrefix}-${i}`,
                body: match[1],
                context: match[2],
                rawBlock: line
            });
        } else {
            cleanLines.push(line);
        }
    }
    const cleanText = cleanLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return { parsedComments, cleanText };
}

export function findMarkdownSubstring(markdown: string, plaintext: string): { start: number; end: number; matchText: string } | null {
    const cleanText = plaintext.trim().replace(/\s+/g, ' ');
    if (!cleanText) return null;

    const escapeRegex = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const words = cleanText.split(' ').filter(Boolean);
    if (words.length === 0) return null;

    const spacer = '[\\s\\*#_`\\[\\]\\(\\)-]*';
    const regexStr = words.map(escapeRegex).join(spacer);

    try {
        const regex = new RegExp(regexStr, 'i');
        const match = markdown.match(regex);
        if (match && match.index !== undefined) {
            return {
                start: match.index,
                end: match.index + match[0].length,
                matchText: match[0]
            };
        }
    } catch (e) {
        console.error('Failed to compile markdown search regex:', e);
    }

    const idx = markdown.indexOf(plaintext);
    if (idx !== -1) {
        return { start: idx, end: idx + plaintext.length, matchText: plaintext };
    }

    return null;
}
