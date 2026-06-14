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

const tradeoffsHeaderIndex = testMarkdown.search(/(?:^|\n)(?:#+\s*)?trade-?offs?\b/i);
console.log('tradeoffsHeaderIndex:', tradeoffsHeaderIndex);
if (tradeoffsHeaderIndex !== -1) {
    const sliced = testMarkdown.slice(tradeoffsHeaderIndex + 1);
    const nextHeaderIndex = sliced.search(/(?:^|\n)#+\s+/);
    console.log('nextHeaderIndex:', nextHeaderIndex);
    const tradeoffsSection = nextHeaderIndex !== -1 
        ? testMarkdown.slice(tradeoffsHeaderIndex, tradeoffsHeaderIndex + 1 + nextHeaderIndex)
        : testMarkdown.slice(tradeoffsHeaderIndex);
    console.log('tradeoffsSection length:', tradeoffsSection.length);
}
