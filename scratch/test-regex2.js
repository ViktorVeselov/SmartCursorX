const testMarkdown = `
# Implementation Design Doc

Some intro text...

## Tradeoffs

Task: SecureStorage Implementation Choice
Consideration 1: Use a native OS keychain (e.g., macOS Keychain, Windows Credential Locker) – Pros: Leverages OS-level encryption, no custom crypto; Cons: Platform-specific APIs increase complexity, may require native bindings.
Consideration 2: Store encrypted JSON in user's home directory – Pros: Simple, cross-platform, no extra dependencies; Cons: Relies on developer-provided encryption strength, vulnerable to mis-configuration.
Decision: Adopt the encrypted JSON approach because it is portable, easy to audit, and meets the requirement of not introducing platform-specific native modules.

Task: IPC Architecture
Consideration 1: Monolithic IPC handler that directly executes commands – Pros: Minimal code, fast dispatch; Cons: Tight coupling, harder to test, single point of failure.
Consideration 2: Separate per-command IPC endpoints (e.g., one socket per command) – Pros: Isolation, granular permission control; Cons: Higher overhead, more socket management.
Decision: Implement a single Handler that routes via a registry; it balances simplicity with isolation and allows centralized error handling.

## Consequences

Failure Mode: SecureStorage unavailable on headless systems
Consequence: The application cannot retrieve or store credentials, causing command failures and a degraded user experience.
Harm: Users cannot perform operations that require authentication, leading to loss of functionality and potential abandonment of the tool.
Mitigation: Implement a fallback that stores credentials in plain text with a clear warning, and abort with a helpful error message if the secure store cannot be initialized.
`;

function extractSection(markdown, keywordRegex) {
    const lines = markdown.split('\n');
    let inSection = false;
    const sectionLines = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) {
            if (keywordRegex.test(trimmed)) {
                inSection = true;
            } else if (inSection) {
                break;
            }
        } else if (inSection) {
            sectionLines.push(line);
        }
    }
    return sectionLines.join('\n');
}

const section = extractSection(testMarkdown, /trade-?offs?/i);
const regex = /(?:\*\*|\*|)?(?:Task|Option)(?:\*\*|\*|)?:\s*(.+?)(?:\r?\n)([\s\S]*?)(?:\*\*|\*|)?(?:Decision)(?:\*\*|\*|)?:\s*(.+?)(?=\r?\n\r?\n|\r?\n(?:\*\*|\*|)?(?:Task|Option):|\s*$)/gi;

const part2 = section.substring(639);
const match = regex.exec(part2);
console.log('Part 2 match with corrected lookahead:', match ? 'SUCCESS' : 'FAILED');
