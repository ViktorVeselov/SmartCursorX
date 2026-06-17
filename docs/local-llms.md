# Local LLMs (Experimental)

SmartCursorX supports running quantized GGUF models locally using a bundled `llama-server` binary. This enables fully offline AI inference with no API costs and no data leaving your machine.

## Quick Start

1. Open **Settings → Local LLMs (Exp)**
2. Search for a GGUF model on HuggingFace
3. Click **Browse files** on a model repo
4. Click **Download** on a GGUF file
5. Click **Run** next to the downloaded model
6. Chat using the `local` provider

## Model Search

The built-in HuggingFace search lets you find GGUF models:
- Searches `huggingface.co/api/models` with `?tags=gguf` filter
- Returns up to 15 results sorted by downloads
- Shows model ID, description, and download count
- Click **Browse files** to see available GGUF variants in a repo

### HuggingFace Token (Experimental)

Some models (Llama, Mistral, etc.) are gated and require authentication:
1. Get a token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Enter it in the **HuggingFace Token (Exp)** field in the Search section
3. Token is stored securely via `secureStore`
4. Automatically passed as `Authorization: Bearer` header on download

## Downloading Models

- Downloads are streamed with progress display
- Files are saved to `%APPDATA%\smart-cursor-x\models\`
- Partial downloads are NOT automatically cleaned up on failure
- Downloaded models show a green **Downloaded** badge in search results

## Server Setup

The bundled `llama-server` binary powers local inference:

### Binary Location

The download script (`download-llama-server.ps1`) installs to:
```
%APPDATA%\smart-cursor-x\bin\llama-srv.exe
```

The server searches in this order:
1. `%APPDATA%\smart-cursor-x\bin\llama-srv.exe`
2. `%APPDATA%\smart-cursor-x\bin\llama-server.exe`
3. `resources\llama-srv.exe` (packaged app)
4. `resources\llama-server.exe` (packaged app)

### Server Parameters

When started, the server runs with:
- **Host**: `127.0.0.1` (localhost only — no external access)
- **Port**: `8080`
- **GPU layers**: `0` (CPU only by default)
- **Context**: `2048` tokens

### Starting & Stopping

- Click **Run** next to a downloaded model — button shows "Starting..." immediately
- Server status is displayed with green indicator
- Click **Stop** to shut down the server
- Server auto-stops on app quit (via `will-quit` handler)

### Starting... Loop (Stuck)

If the "Starting..." indicator never resolves:
1. The binary may be corrupted — re-download via Troubleshooting panel
2. Antivirus may have quarantined the binary — check your AV quarantine
3. Missing DLLs — ensure all files in the bin directory are intact

## Provider

The `local` provider routes chat requests to `http://localhost:8080/v1/chat/completions` (OpenAI-compatible format):
- No API key required
- Model list auto-populates from downloaded GGUF files
- Zero cost for cost estimation

## Architecture

```
User Chat → AIService.createLanguageModel('local')
  → createOpenAICompatible({ baseURL: 'http://localhost:8080/v1' })
    → llama-server on 127.0.0.1:8080
      → GGUF model file
```

## Antivirus False Positives

**Norton** and **Windows Defender** may flag `llama-server.exe` as `IDP.Generic` — a known false positive. The binary is renamed to `llama-srv.exe` to minimize this, but exclusions may still be needed.

### How to Fix

1. Open your antivirus quarantine / protection history
2. Restore `llama-server.exe` from quarantine
3. Add `%APPDATA%\smart-cursor-x\bin` to your antivirus exclusion list
4. Click **Re-download llama-server.exe** in the Troubleshooting panel

### OneDrive Conflicts

If your project folder is OneDrive-synced, file creation/rename for `.exe` files can fail. The server binary is installed to `%APPDATA%\smart-cursor-x\bin\` which is never OneDrive-synced.

## Troubleshooting

### Missing Binary

If `findLlamaServer()` returns null:
```
llama-server.exe not found. This is often caused by antivirus...
```

**Solutions**:
1. Run `npm run fetch:llama -- -Force` in the project directory
2. Add the bin directory to antivirus exclusions
3. Check the Troubleshooting panel in **Settings → Local LLMs (Exp)**

### Server Won't Start

- **Process exits immediately**: Missing DLLs or corrupted binary — re-download
- **Port in use**: Another service on port 8080 — stop the conflicting service
- **Access denied**: Antivirus blocking — add exclusion

### Chat Fails with ECONNREFUSED

The server isn't running or crashed:
1. Check if the green "Server Active" indicator is visible
2. If not, click **Run** next to your model
3. If it shows "Starting..." indefinitely, check the binary and antivirus
