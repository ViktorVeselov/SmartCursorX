# Agent

SmartCursorX features a pluggable agent system with cognitive steering, taxonomy-aware context assembly, and fine-grained tool permissions.

## Architecture

The agent system follows a **plan-execute-review** loop:

1. **Plan**: The AI model analyzes the user request and generates a structured plan with file-level modifications
2. **Execute**: Each modification is presented in a side-by-side diff editor for user review
3. **Review**: Users accept or reject individual file changes before they are written to disk

## Cognitive Steering

The **Taxonomy Engine** classifies the development context to optimize model performance:

- **Language detection**: Identifies the programming language from file extensions and project structure
- **Framework recognition**: Detects frameworks (React, Django, Spring, etc.) and adjusts system prompts accordingly
- **Scale estimation**: Determines project scale (small/medium/large) to guide search depth and context window usage
- **Prompt tailoring**: Dynamically modifies system prompts to focus the model on relevant patterns, schemas, and configuration files

### Example

When working on a Python Django project, the steering engine:
1. Sets the taxonomy domain to `python.django`
2. Prioritizes `urls.py`, `models.py`, `views.py`, `settings.py` in search results
3. Includes Django-specific conventions in the system prompt
4. Restricts file operations to the project's virtual environment scope

## Tool Permissions

The agent has access to a curated set of tools, each with workspace containment:

| Tool | Description | Containment |
|------|-------------|-------------|
| `search_files` | Regex search within workspace files | Workspace root |
| `read_files` | Read file contents | Workspace root |
| `edit_file` | Apply edits to files | Workspace root |
| `write_file` | Create new files | Workspace root |
| `bash` | Execute shell commands | Configurable |

All file operations validate paths against the active workspace to prevent directory traversal attacks.

## Context Assembly

The agent assembles context through multiple channels:
- **Active file**: The currently open file in the editor
- **Search results**: Files matching the user's query via regex search
- **Dependency tree**: Import/require graph of relevant modules
- **Terminal output**: Recent command execution results

## Multi-Profile Terminal

The integrated terminal supports multiple shell profiles:
- **Windows**: PowerShell, CMD, Git Bash
- **macOS/Linux**: Zsh, Bash, Sh

Process state is cleaned up on component unmount to prevent orphaned processes.

## Abort & Error Handling

- Chat requests can be aborted via `Ctrl+C` or the abort button
- Aborted streams stop mid-response
- API errors surface as user-visible messages with retry suggestions
- Network errors include specific guidance (check proxy, firewall, API key)
