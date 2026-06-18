# Project Context

## Overview
**Last Updated:** 2026-06-14
**Status:** Active

Smart Cursor X (Cursor Replacer) is an Electron application. It uses Vite 8 with the Rolldown bundler for building the main, preload, and renderer processes.

## Technology Stack
- **Framework**: Electron (v39+)
- **Bundler**: Vite 8 (using Rolldown)
- **Frontend**: React 18
- **TypeScript**: Yes

## Key Decisions & History
- **Vite 8 Upgrade Compatibility**: Upgraded `@vitejs/plugin-react` to `^6.0.2`, `vite-plugin-electron` to `^1.0.4`, and `vite-plugin-electron-renderer` to `^1.0.0` to resolve a configuration validation warning (`Expected never but received "jsx"`) caused by Rolldown in Vite 8.
- **Ineffective Dynamic Import Warnings Resolved**: Converted the dynamic imports of `getZenModelsInfo` in `electron/ipcHandlers/ai.ts` and `listEncryptedKeys` / `runSecureStoreTests` in `electron/ipcHandlers/db.ts` to static imports. This resolved the Rolldown `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings because these modules were already bundled statically.
- **Native Modules / node-pty Bundling Fix**: Added the `notBundle()` plugin from `vite-plugin-electron/plugin` and configured `ssr.external` in `vite.config.ts`. This ensures native modules like `node-pty` (and its dependencies/compiled binaries such as `conpty.node`) are correctly externalized and not bundled by Rolldown in Vite 8, avoiding runtime file-resolution errors.
- **Google Gemini Integration**: Integrated official Gemini API key configuration (via Settings UI secure storage and `GEMINI_API_KEY` environment fallback), aligned base URLs with a trailing slash (`/v1beta/openai/`), resolved the missing key errors by adding validation guards, and implemented dynamic 768-to-1536 dimension vector normalization (padding/truncation) for compatibility with the SQLite vector search database.
- **OpenRouter Free Models Integration**: Added first-class native support for OpenRouter.ai, allowing users to configure their free API keys in the settings menu. Implemented dynamic models fetching and filtering via OpenRouter's public models endpoint (with offline fallbacks), sorting the `openrouter/free` auto-router to the top, and mapped costs to `$0.00` in the token cost estimator.

- **PathGuard Service (2026-06-14)**: Created `electron/services/PathGuard.ts` as the single authority for workspace path containment. Replaced 6+ duplicated implementations of path resolution across `ASTPatchingService`, `SnapshotService`, `ExecutionLoopService`, and `ContextAssembler`. Each duplicated version independently computed allowed roots, contained hardcoded `adk-python-community`/`google-sdk` paths, and used per-class normalization logic. PathGuard centralizes this into static methods: `configure()`, `resolve()`, `isContained()`, `registerRoot()`, and handles Windows case-insensitivity. Configured at startup in `main.ts` via `secureStore.getActiveWorkspacePath()`.

- **IPC Filesystem Sandboxing (2026-06-14)**: All 6 filesystem IPC handlers (`read-file`, `write-file`, `delete-path`, `rename-path`, `create-directory`, `read-dir`) now gate behind `PathGuard.isContained()`. Previously only `write-file` had a containment check. This closes a critical sandbox escape vector where renderer-originated IPC calls could read/write/delete any path on the filesystem.

- **Secret Leakage Fixes (2026-06-14)**:
  - Admin API token truncated to first 4 characters in console output (`AdminApiService.ts`).
  - `node-pty` environment sanitized in `shell.ts` — filters out `API_KEY|SECRET|TOKEN` variables before spawn.
  - Hardcoded `adk-python-community`/`google-sdk` paths removed from `DiffVerificationService`, `ASTPatchingService`, `SnapshotService`.

- **State Hygiene Fix (2026-06-14)**: `PendingModificationsService.clear()` called at `execution:start` in `execution.ts` IPC handler. Previously, pending modifications from a prior aborted execution could leak into a new execution, causing stale file proposals.

- **Embedding Fallback Improvement (2026-06-14)**: When no API key is configured, `EmbeddingService.generateEmbedding()` returns a zero vector (1536-dimension Float32Array) instead of a hash-based TF-IDF noise vector. Zero vector causes `searchSimilarity()` to return empty results (correct degraded behavior) rather than semantically meaningless matches.

- **Execution Loop Refactoring (2026-06-14)**:
  - Investigation phase extracted into dedicated `performInvestigation()` method (62 lines → 38 lines).
  - File block regex parsing extracted into shared `parseFileBlockResponse()` method, used by both `generateFallbackPatches()` and `applyFileEdits()`, eliminating 2 copies of identical regex + containment logic.
  - Both methods now use `PathGuard.resolve()` instead of workspace-path-from-DB + ADK/SDK root iteration.

- **Taxonomy Asset Bundling Fix (2026-06-17)**: Statically imported `taxonomyTree.json` and `crossAxisRules.json` directly inside `TaxonomyService.ts` instead of reading them from the filesystem at runtime using `fs`. This ensures that they are fully bundled into `dist-electron/main.js` by Vite/Rolldown, eliminating runtime `ENOENT` / `Taxonomy tree JSON file not found` errors in the bundled environment where source directory structures are not present.

- **AI Stream Abort & Race Condition Fix (2026-06-17)**: Integrated standard `AbortController` support to immediately cancel outgoing network requests made by the Vercel AI SDK when a user aborts a request. Also introduced `if (!streamActiveRef.current) return;` checkpoints inside the React renderer's message sending loop (`useChatSending.ts`) to prevent race conditions where stream start requests are sent to the main process after the user has already clicked "Stop" (e.g. during RAG context assembly delays). This resolves the main thread hanging ("not responding") state.

- **Performance Dashboard (2026-06-14)**: Added read-only "⚡ Performance" tab to Settings modal. Shows sortable table of per-model statistics (success rate, avg latency, total runs) with provider/taskType dropdown filters. Models with ≥10 runs and ≥85% success rate get a "★ Recommended" badge. Backed by `getModelPerformanceStats()` in `db/settings.ts` and `ai:get-model-stats` IPC handler.

- **Code Quality Fixes (2026-06-14)**:
  - `while(true)` → bounded `while(maxDepth-- > 0)` in `RuleDiscoveryService.ts` to prevent infinite loops.
  - `alert()` → `showNotification()` in `App.tsx`.
  - SQL migration bare `try/catch` blocks now rethrow non-duplicate-column errors.
  - Removed global `console.assert` override from `main.ts` (was redundant with standard `assert` + `checkArgs`).

- **DLQ Escalation (2026-06-14)**: After 3 retries exhaust in `ExecutionLoopService.executeTask()`, snapshot is rolled back, all failed attempts are stored in RAG via `EmbeddingService.indexKnowledge()`, and `execution:dlq-notify` is sent to renderer with taskId, taskTitle, failureFeedback, and attemptHistory. The renderer shows `DlqGuidanceModal.tsx` (a modal with read-only failure log and a guidance textarea). User can provide guidance (triggers `execution:dlq-respond` → resolver receives text) or cancel (resolver receives `null`). Guidance is injected as `⚠️ USER GUIDANCE: <text>` in the system prompt before retry. The resolver uses a static `Map<number, DlqEntry>` in `ExecutionLoopService` — same pattern as `PendingModificationsService`. `preload.ts` updated with `execution:dlq-respond` invoke channel and `execution:dlq-notify` on channel.

- **Test Suite (2026-06-14)**: 83 unit tests across 4 suites:
  - `tests/unit/pathGuard/` (20 tests): Path resolution, containment, dot-dot traversal, case-insensitivity, extra roots, reconfigure.
  - `tests/unit/pendingModifications/` (24 tests): Clear/set/get/remove lifecycle, resolver tracking, task isolation, snapshot behavior.
  - `tests/unit/ipcSecurity/` (23 tests): All 6 filesystem handlers — validates PathGuard guards fire for outside-root and type-invalid inputs.
  - `tests/unit/dlq/` (7+9 tests): Unit tests verify resolver set/resolve/cancel/promise lifecycle. Integration tests verify end-to-end flow: 3 retries → DLQ notification → user guidance → retry, cancel path, async IPC timing, edge cases (empty string, double resolve).
  - Run with `npm test`.

- **QLoRA Fine-Tuning (2026-06-14)**: Added local model fine-tuning feature with 3 backend options:
  - **llama.cpp backend**: Uses `llama-finetune` binary — no Python needed, GGUF-native.
  - **Python backend**: Uses `transformers` + `peft` + `bitsandbytes` — full QLoRA (NF4 4-bit, FP8 8-bit, BF16 16-bit).
  - **Bundled fallback**: System Python or bundled miniconda env (user choice at setup).
  - **Hardware auto-detection**: Checks `nvidia-smi` for GPU/VRAM, `sysctl` for Apple Silicon unified memory, and CPU fallback. Model recommendation engine picks best model + quantization for available VRAM.
  - **9 recommended fine-tuning models** from Hugging Face (defined in `electron/constants/models.ts`):
    1. Qwen 2.5 Coder 7B — best all-round small coder
    2. DeepSeek Coder 6.7B — code-pretrained, strong FIM
    3. Code Llama 7B — most widely tested local coder
    4. Phi-3.5 Mini 3.8B — tiny, works on 6GB GPUs
    5. Granite 3B Code — IBM purpose-built, runs on 6GB
    6. Qwen 2.5 Coder 1.5B — ultra-light, fits 4GB VRAM in 4-bit
    7. DeepSeek Coder 1.3B — tiny but strong for JS/TS, repo-level FIM
    8. Stable Code 3B — best JS/TS win rate, strong at completion
    9. CodeGemma 1.1B — smallest viable, runs on 3GB VRAM
  - **Automated dataset creation**: `DatasetService` scans workspace code files, chunks them, and generates instruction-finetuning pairs (explain, complete, refactor, docstring, bug_detection). Outputs JSONL format. Deduplication by content hash.
  - **Training hyperparameters**: epochs (1-50), learning rate, batch size, LoRA rank, warmup steps. Progress streaming via `finetune:progress` IPC channel.
  - **UI**: `SettingsFinetuningTab.tsx` in Settings modal — hardware status, model picker, quantization radio, backend selector, dataset preview, hyperparams, start/stop/reset, real-time loss chart, scrollable logs.
  - **Python scripts**: `scripts/finetune_qlora.py` (supports Unsloth for 2x speedup and standard transformers), `scripts/prepare_dataset.py` (standalone usage), `scripts/requirements-ml.txt`.
  - **IPC channels**: 10 invoke channels (`finetune:detect-hardware`, `get-models`, `get-state`, `get-recommendation`, `prepare-dataset`, `export-dataset`, `start`, `stop`, `reset`, `get-adapter-path`) + 1 push channel (`finetune:progress`).
  - **TypeScript 0 errors**, 0 lint errors (19 pre-existing warnings), 83 tests passing.
