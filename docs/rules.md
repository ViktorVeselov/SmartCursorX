# Rules

SmartCursorX includes a custom rules engine that lets users define behavioral constraints for the AI agent. Rules are evaluated before each code modification is applied.

## Rule Types

### Custom Rules

User-defined rules stored in the local SQLite database:
- **Name**: A descriptive identifier
- **Content**: The rule text describing the constraint or guideline
- **Enabled**: Toggle rules on/off without deleting them

Rules are injected into the system prompt so the model is aware of them during planning.

### Verification Rules

Built-in verification checks that run before file modifications are committed:

| Rule | Description |
|------|-------------|
| Path Traversal | Detects `../` in file paths to prevent workspace escape |
| Secrets Leakage | Scans diffs for exposed API keys, tokens, or credentials |
| Large Blob | Flags overly large file writes for review |
| Binary Content | Blocks non-text file writes through the code edit pipeline |

## Pipeline

The verification pipeline runs on every proposed edit:

1. **Pre-check**: All rules are evaluated against the proposed modification
2. **Flagging**: Violations are flagged with severity levels (info, warning, error)
3. **Human Review**: Flagged modifications require explicit user approval
4. **Logging**: All rule evaluations are logged for audit

## Workspace PathGuard

The **PathGuard** system enforces workspace containment:

- Resolves the active workspace root on initialization
- Validates every file operation against the resolved workspace
- Blocks any operation attempting to access files outside the workspace
- Logs blocked operations with the attempted path and caller identity

## Execution Service

The execution service manages the apply/reject workflow:

- **Pending Modifications**: Accumulates approved changes
- **Apply Selected**: Commits individual file changes to disk
- **Reject Selected**: Discards individual changes
- **Apply All**: Batch commits all pending changes
- **Reject All**: Discards all pending changes

## Configuration

Rules are managed in **Settings → Rules**:
- Add new rules with descriptive text
- Edit existing rules inline
- Delete or toggle rules on/off
- Changes take effect immediately for the next AI request
