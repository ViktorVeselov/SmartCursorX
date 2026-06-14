const text = `Task: IPC Architecture
Consideration 1: Monolithic IPC handler that directly executes commands – Pros: Minimal code, fast dispatch; Cons: Tight coupling, harder to test, single point of failure.
Consideration 2: Separate per-command IPC endpoints (e.g., one socket per command) – Pros: Isolation, granular permission control; Cons: Higher overhead, more socket management.
Decision: Implement a single Handler that routes via a registry; it balances simplicity with isolation and allows centralized error handling.`;

const regex = /(?:\*\*|\*|)?(?:Task|Option)(?:\*\*|\*|)?:\s*(.+?)(?:\r?\n)([\s\S]*?)(?:\*\*|\*|)?(?:Decision)(?:\*\*|\*|)?:\s*(.+?)(?=\r?\n\r?\n|\r?\n(?:\*\*|\*|)?(?:Task|Option):|$)/gi;

const match = regex.exec(text);
console.log('Match:', match);
