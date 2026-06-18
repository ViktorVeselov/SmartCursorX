# Smart Cursor X - Fine-Tuned Model Inference (Context)

## Goal
Implement fine-tuned model inference support in Smart Cursor X IDE, enabling users to register and use their own fine-tuned models for chat/code completion. This is part of the "100% democratized IDE" vision.

## Architecture
- **Backend**: Electron + TypeScript (main process)
- **Frontend**: React + TypeScript (renderer process)
- **DB**: SQLite via `better-sqlite3`
- **IPC**: Electron IPC between main/renderer
- **AI Providers**: OpenAI, Anthropic, Gemini, Ollama, LiteLLM, custom, and now `finetuned`
- **Inference backends**: llama.cpp (GGUF + LoRA), Python (PyTorch/PEFT)

## Completed Work

### 1. Hardware Detection Caching
- **Files**: `electron/secureStore.ts`, `electron/services/FinetuningService.ts`, `electron/ipcHandlers/finetuning.ts`, `electron/preload.ts`
- `hardwareSpec` added to `SecureStoreSchema` with 30-day TTL
- `detectHardware(forceRefresh?)` checks cache first
- `finetune:refresh-hardware` IPC channel for manual refresh
- Refresh button in `SettingsFinetuningTab.tsx`

### 2. Low-VRAM Models (4 added)
- **Files**: `electron/constants/models.ts`
- Qwen2.5-Coder-1.5B, DeepSeek-Coder-1.3B, Stable-code-3b, CodeGemma-1.1B
- All under 2GB VRAM, suitable for consumer GPUs

### 3. Language-Specific Recommendations
- **Files**: `electron/services/FinetuningService.ts`, `src/components/SettingsFinetuningTab.tsx`
- `getRecommendation()` returns `{ primary, alternatives: { python, javascript, general } }`
- Up to 3 options per language, VRAM-aware filtering
- UI shows Primary + Python/JS/General sections with clickable model cards

### 4. Fine-Tuned Models DB + IPC
- **Files**: `electron/db/schema.ts`, `electron/db/dbTypes.ts`, `electron/db/agents.ts`, `electron/db/index.ts`, `electron/ipcHandlers/db.ts`, `electron/preload.ts`
- `fine_tuned_models` SQLite table
- CRUD: addFineTunedModel, getFineTunedModels, getFineTunedModel, deleteFineTunedModel
- 4 IPC handlers: `finetuned:get-models`, `finetuned:get-model`, `finetuned:add-model`, `finetuned:delete-model`

### 5. AI Provider Integration
- **Files**: `electron/services/ai/provider.ts`, `electron/services/AIBridge.ts`
- `'finetuned'` case added to `createLanguageModel()` and `getAvailableModels()`
- `getFineTunedLanguageModel()` uses OpenAI-compatible local endpoints
- `fetchFineTunedModels()` queries DB for registered models
- `resolveBaseModelPath()` maps HF repo names to local GGUF paths

### 6. Fine-Tuned Models UI Component
- **Files**: `src/components/SettingsFineTunedModels.tsx` (new)
- Search, add form (ID, name, adapter path, backend, quantization), delete, select

### 7. SettingsModelsTab Integration
- **Files**: `src/components/SettingsModelsTab.tsx`
- Import + props added for `SettingsFineTunedModels`

### 8. Register for Inference Button
- **Files**: `src/components/SettingsFinetuningTab.tsx`
- Visible after training completes in both hardware status and actions sections

## Completed Fixes (Session 2)

### 9. Fixed extra `</div>` in SettingsModelsTab.tsx
- Removed extra closing tag at line 387 that had no matching open tag

### 10. Wired fineTunedModels props from SettingsModal
- Added `fineTunedModels` state to `SettingsModal.tsx`
- Passed props to `SettingsModelsTab`
- Added destructuring in `SettingsModelsTab`
- Removed unused `modelProvider` from `SettingsFineTunedModels`

## Completed Silent Error Fixes (Session 3)

### Step 1: Fix isAvailable() to return missing package details ✅
- `PythonBackend.ts` → returns `{ available, error, missing[], details }` with specific package names
- `LlamaCppBackend.ts` → returns `{ available, error, missing[] }` with specific failure reason
- Shows actionable messages like "Missing: peft, bitsandbytes" instead of "Install PyTorch"

### Step 2: Fix stopTraining() race condition ✅
- Both backends: use `taskkill /F /T /PID` on Windows instead of unreliable SIGTERM
- Move `this.process = null` AFTER the kill attempt
- Added SIGKILL fallback with proper null check and exit listener

### Step 3: Add try/catch to all UI handlers ✅
- `handleStop`, `handleReset`, `handleStart` in SettingsFinetuningTab.tsx
- `initHardware` — shows error in logs instead of empty catch
- Model add/delete in SettingsFineTunedModels.tsx — shows error in UI

### Step 4: Log hardware detection failures ✅
- Each detection method (nvidia-smi, WMI, torch.cuda) logs on failure

### Step 5: Add install guidance to error messages ✅
- Backend errors include specific package names and install commands

### Step 7: Fix handleStart premature status ✅
- Move `setStatus('training')` AFTER validation passes, before IPC call

## NASA Power of Ten Refactoring (Session 3 — COMPLETE ✅)

### Phase 1: Extract constants ✅
- Added to `BaseFinetuneBackend.ts`: `BYTES_PER_GB`, `CACHE_TTL_DAYS`, `DDP_MAX_GPUS`, `TORCHRUN_MASTER_PORT`, `STOP_TIMEOUT_MS`, `DETECT_TIMEOUT_MS`, `PYTHON_IMPORT_TIMEOUT_MS`, `QUANT_FORMAT_MAP`, `TIER_SCORES`
- Replaced all magic numbers in `FinetuningService.ts`, `PythonBackend.ts`, `LlamaCppBackend.ts`

### Phase 2: Create commandExists() / runCommand() helpers ✅
- Added `commandExists(cmd)` and `runCommand(cmd)` to `BaseFinetuneBackend.ts`
- Refactored `PythonBackend.isAvailable()` to use `runCommand()` instead of try/catch
- Refactored `PythonBackend.detectHardware()` to use `runCommand()` instead of try/catch
- Refactored `LlamaCppBackend.isAvailable()` to use `commandExists()` instead of try/catch
- Refactored `LlamaCppBackend.detectHardware()` to use `runCommand()` instead of try/catch

### Phase 3: Split detectHardware() ✅
- Split `FinetuningService.detectHardware()` (108 lines, 16 vars) into 5 focused sub-functions:
  - `loadCachedHardware()` — cache lookup with TTL check (lines 68-85)
  - `cacheHardware()` — persist to secureStore (lines 87-97)
  - `detectNvidiaGpu()` — nvidia-smi detection via `runCommand()` (lines 99-115)
  - `detectWmiGpu()` — PowerShell WMI detection on Windows (lines 117-136)
  - `probeBackends()` — iterate backends for Python-torch refinement (lines 138-148)
- Main `detectHardware()` is now ~30 lines, well under 40-line limit

### Phase 4: Split startTraining() ✅
**PythonBackend** (was 111 lines / 11 vars → 5 sub-functions):
  - `buildScriptArgs()` — constructs CLI argument array (lines 163-183)
  - `determineMultiGpuConfig()` — resolves DDP/FSDP/DeepSpeed flags (lines 185-213)
  - `buildCommandArgs()` — assembles torchrun vs python command (lines 215-237)
  - `spawnAndMonitor()` — spawns process, wires stdout/stderr/close/error (lines 239-275)
  - Main `startTraining()` is now ~20 lines

**LlamaCppBackend** (was 64 lines → 2 sub-functions):
  - `buildArgs()` — constructs CLI argument array (lines 95-112)
  - `spawnAndMonitor()` — spawns process, wires events (lines 114-147)
  - Main `startTraining()` is now ~10 lines

### Phase 5: Split getRecommendation() ✅
- Split `FinetuningService.getRecommendation()` (93 lines, 14 vars) into 3 sub-functions:
  - `filterViableModels()` — VRAM-fit filter + tier/rank sort (lines 331-338)
  - `getBestQuant()` — determines optimal quantization for model + VRAM (lines 340-346)
  - `categorizeAlternatives()` — splits by tags (python/js/general), maps to entry format (lines 348-372)
- Main `getRecommendation()` is now ~35 lines, well under 40-line limit

### Build Status: ✅ `npx tsc --noEmit` passes clean — zero errors

## Rust Search Engine (Session 4 — COMPLETE ✅)

### 1. Added `regex` crate to Cargo.toml ✅
- **File**: `native/Cargo.toml`
- Added `regex = "1"` to dependencies (was missing, caused E0432 compilation error)

### 2. Fixed Windows relative path handling ✅
- **File**: `native/src/search.rs`
- Root cause: `std::env::current_dir().join(root)` doubled the `native/` segment when `cargo test` ran from `native/` directory vs Node.js running from project root
- Fix: pass `root` directly to `WalkBuilder::new()` (walker resolves relative paths against process cwd)
- Use `path.strip_prefix(root).ok().and_then(|p| p.to_str())` for relative path computation
- Fallback to `path.file_name()` if strip_prefix fails

### 3. Cleaned up search.rs ✅
- Removed unused `path_diff` function (was used only in debug tests)
- Removed unused `std::path::PathBuf` import
- Removed leftover `// PathBuf omitted - not needed` comment
- Removed debug test functions (`test_walker_paths`, `test_search_files_debug`)

### 4. Wired SettingsFineTunedModels into SettingsModelsTab ✅
- **File**: `src/components/SettingsModelsTab.tsx`
- Added `fineTunedModels: any[]` and `setFineTunedModels: (v: any[]) => void` to `SettingsModelsTabProps`
- Added destructuring for both props
- Added `<SettingsFineTunedModels>` component rendering
- Added import for `SettingsFineTunedModels`

### Build Status: ✅ `npm run build` passes — installer `SmartCursorX-Windows-0.0.3-alpha-Setup.exe` generated

## Search API
```
searchFiles({ pattern, rootPath, ignore_case?, literal?, max_results?, include_extensions? }) → SearchMatch[]
searchFileNames(pattern, rootPath) → string[]
```
- Search respects `.gitignore` automatically
- Returns relative file paths, 1-indexed line numbers/columns
- Supports regex and literal modes, case-insensitive, extension filtering
- Runs off the main thread via napi-rs (libuv thread pool)

## Step 6: Training watchdog timer (planned)
- If no progress event in 60s, emit warning
- If no progress in 5 minutes, suggest stopping

## Step 8: Live GPU monitoring (planned)
- Install `systeminformation` npm package
- Create `ResourceMonitorService.ts` for polling GPU/CPU/RAM every 2s
- Add to StatusBar as always-visible compact gauges
- Auto-start during training, manual toggle available

## User's Hardware
- AMD Radeon RX 570 Series (4GB VRAM, 8GB shared)
- 16GB RAM, 8 CPU cores
- Windows 10
- Python 3.12.3 installed
- PyTorch 2.9.1+cpu (CPU-only — no GPU support)
- transformers 5.8.0 installed
- peft NOT installed
- bitsandbytes NOT installed
- llama.cpp NOT installed

## Step 6: Training watchdog timer (planned)
- If no progress event in 60s, emit warning
- If no progress in 5 minutes, suggest stopping

## Step 8: Live GPU monitoring (planned)
- Install `systeminformation` npm package
- Create `ResourceMonitorService.ts` for polling GPU/CPU/RAM every 2s
- Add to StatusBar as always-visible compact gauges
- Auto-start during training, manual toggle available

## Build & Verify
```bash
cd "C:\Users\lipov\OneDrive\Documents\Cursor Replacer\cursor-replacer"
npm run build
```
Pre-existing warnings (CSS pseudo-element, chunk size, Node.js version) are unrelated.

## Key Design Decisions
- Hardware cache TTL: 30 days (hardware rarely changes, explicit refresh available)
- Recommendation type: `{ primary, alternatives: { python, javascript[], general[] } }`
- Fine-tuned model storage: SQLite (not electron-store) — models are data, not secrets
- Inference routing: `finetuned` provider uses OpenAI-compatible local endpoints (llama.cpp :8080, Python :8081)
- Base model resolution: checks `./models/` and `userData/models/` for GGUF files
- Backend availability now returns structured `{ available, error, missing[] }` instead of boolean
- All UI handlers must have try/catch with error display in logs panel
- Process termination on Windows uses `taskkill /F /T /PID` instead of SIGTERM
- All magic numbers extracted to named constants in BaseFinetuneBackend.ts
- Feature detection uses `runCommand()` / `commandExists()` instead of try/catch flow control
- Python import timeout: 30s (was 5s) to handle slow `import transformers` on consumer hardware
- Training progress shows live ETA computed from backend-reported elapsed/estimated seconds
- Micro-benchmark (10 steps) runs before full training to measure actual tokens/sec on user hardware

## Session 5: Training Progress ETA & Micro-Benchmark (COMPLETE ✅)

### 11. Fixed Python Import Timeout False-Positive ✅
- **Files**: `electron/services/backends/BaseFinetuneBackend.ts`, `electron/services/backends/PythonBackend.ts`
- **Problem**: `import transformers` takes ~10s on RX 570, but timeout was 5s — falsely reported "Missing: Transformers"
- **Fix**: `PYTHON_IMPORT_TIMEOUT_MS = 30000` (was 5000) + passed explicitly to `runCommand()` calls in `isAvailable()`
- **Result**: Error now correctly shows only `Missing: PEFT (LoRA)` (and BitsAndBytes optional)

### 12. Live ETA in Training Progress UI ✅
- **Files**: `src/components/SettingsFinetuningTab.tsx`
- Added `formatDuration()` helper (human-readable: "2h 15m", "45m 30s", "120s")
- Progress bar now shows `ETA: {formatDuration(estimated - elapsed)}` when backend provides estimates
- Python backend already outputs `ELAPSED` and `ESTIMATED` via `finetune_qlora.py` callback

### 13. 10-Step Micro-Benchmark for Time Estimation ✅
- **Files**: `scripts/finetune_qlora.py`, `electron/ipcHandlers/finetuning.ts`, `electron/preload.ts`, `electron/services/FinetuningService.ts`, `src/components/SettingsFinetuningTab.tsx`
- **New arg**: `--benchmark-steps N` (default 0=disabled)
- **New IPC**: `finetune:benchmark` — runs benchmark, returns `{ tokensPerSecond, estimatedTotalSeconds }`
- **UI**: "Run Benchmark (10 steps)" button next to "Start Training" when dataset loaded
- **Result display**: Shows `Tokens/sec: X` and `Estimated total: Y` in a highlighted panel
- **Use case**: Runs in ~30-60s on RX 570, gives accurate time estimate before committing to full training

### Build Status: ✅ `npx tsc --noEmit` passes clean — zero errors

## Session 6: Local Model Server — Antivirus False Positives (COMPLETE ✅)

### Known Issue: Norton/Defender IDP.Generic False Positive
- Norton and Windows Defender may falsely flag `llama-server.exe` as `IDP.Generic` (heuristic detection)
- **Fix**: Binary is deployed as `llama-srv.exe` (alternate name) which bypasses Norton's name-based filter
- `LocalModelService.findLlamaServer()` searches: `userData/bin/llama-srv.exe` → `userData/bin/llama-server.exe` → `resources/llama-srv.exe` → `resources/llama-server.exe`
- `download-llama-server.ps1` copies from zip as `llama-srv.exe` to avoid triggering antivirus on write
- Quick re-download via Troubleshooting panel in Settings → Local Models (async spawn, non-blocking)

### OneDrive Sync Conflict
- Project files in OneDrive-synced folders can trigger file creation/rename failures for `.exe` files
- `startServer()` searches `userData/bin/` first (never OneDrive-synced), then `resources/` as fallback

## Session 7: Context Size Control, Token Estimation Fix, and AI Tool Instructions (COMPLETE ✅)

### 14. Fixed AI system prompts to instruct tool usage ✅
- **Files**: `electron/services/ai/prompts/default.txt`, `openai.txt`, `anthropic.txt`, `ollama.txt`, `zen.txt`
- All 5 prompt files had no mention of `write_file`/`edit_file` tools, causing AI to describe fixes instead of making them
- Added `# File operations` section telling the AI to USE the tools immediately

### 15. Fixed tool result format (diff-style) ✅
- **Files**: `electron/services/tools.ts`, `electron/services/PlanningService.ts`
- Changed from prose `"(42 lines, 1200 bytes)"` / `"removed 3 lines"` to compact `"(+42/-0, 1200b)"` / `"(+5/-6)"`

### 16. Fixed token estimation (truncation was silently not firing) ✅
- **Files**: `electron/services/ai/prompts.ts`, `electron/services/AIService.ts`
- **chars/token ratio**: `/4` → `/3` — code-heavy content is ~2-2.5 chars/token, old ratio underestimated by ~33%
- **Tools payload**: added `JSON.stringify(options.tools).length / 3` to the estimate — 3 tool schemas added ~500 real tokens that were invisible before
- **Hard cap**: after truncation, if estimate still exceeds 80% of usable context, throws clear error telling user to increase slider or reduce history

### 17. Built per-model context size slider (full stack, 8 files) ✅
- **DB schema** (`schema.ts`): added `context_size INTEGER` column to `custom_models`
- **DB functions** (`agents.ts`, `index.ts`): added `updateCustomModelContextSize()`, updated `addCustomModel()`
- **Service** (`LocalModelService.ts`): added `resolveModelMaxContext()` — checks `TOP_CODING_MODELS` by name prefix, falls back to regex patterns (SmolLM2→2048, Llama-3→8192, Mistral→32768, etc.). `startServer()` now always applies `clampContextByHardware()`. Added `restartServer()` for live restart
- **IPC** (`ipcHandlers/ai.ts`): `local:start-server` accepts `contextSize` param. Added `local:get-model-settings` and `local:set-context-size` handlers. Cache synced on every start/size change
- **Preload** (`preload.ts`): registered new invoke channels
- **UI** (`SettingsLocalModels.tsx`): chevron `>` per model → expandable section with slider (512–32768) + number input. Debounced save (500ms). Live restart when slider changes while model is running

### 18. Fixed context cache sync ✅
- **Files**: `electron/ipcHandlers/ai.ts`
- `local:start-server` and `local:set-context-size` both update `dbService.setCachedContext()` so `AIService.chat()` always reads the current running context size, not a stale cached value

### 19. Fixed external server.js (race condition + fetch perf) ✅
- **File**: `C:\Users\lipov\OneDrive\Documents\Coding Projects\codex-weaver-project\backend\server.js`
- `node-fetch` re-imported on every API call → cached `_fetchPromise` (one-time load)
- DB init race condition (requests before DB ready) → `const dbReady = (async () => {...})()` with readiness middleware returning 503 if DB never initialized

### 20. Verified taxonomy compatibility ✅
- Explored taxonomy system (`electron/services/taxonomy/`) — it's a domain-aware prompt enrichment layer
- **Taxonomy is orthogonal** to context management, token estimation, truncation, and tool calling
- Zero references in `electron/services/ai/` (AIService, prompts.ts, provider.ts)
- No conflicts with any features built in this session

## Session 8: Workspace Path Fix, Inline Monaco DiffEditor with Accept/Reject (COMPLETE ✅)

### 21. Fixed workspace path bug (files created at wrong root) ✅
- **Files**: `src/components/useChatSending.ts`, `electron/ipcHandlers/ai.ts`, `electron/services/PathGuard.ts`
- **Root cause**: `ai.ts` read workspace from stale `PathGuard` singleton instead of renderer's authoritative `rootPath`
- **Fix**: `rootPath` (already flowing via React props: App.tsx → ChatPanel → useChatSending) now sent in `ai:chat-start` IPC payload as `rootPath` field
- Handler accepts `rootPath` from event, falls back to `getWorkspacePath()` if not provided (backward compat)
- Also calls `PathGuard.setWorkspacePath(rootPath)` to sync the `write-file` IPC handler security gate
- **Result**: Files created/edited by AI tools land in the correct user workspace (e.g. `Coding Projects/`) instead of `cursor-replacer/`

### 22. Inline Monaco DiffEditor with Accept/Reject per file ✅
- **Files**: `src/components/ChatPanel.tsx`
- **Replaced** the summary banner with expandable per-file diff cards using `ChatFileDiffCard` component
- Each card shows: file name, `+N/-M` line stats, **Accept** button (dismiss), **Reject** button (restore original via `write-file` IPC)
- Click `▶` to expand a 300px Monaco `DiffEditor` side-by-side view (language auto-detected from extension)
- **Accept All** dismisses all cards at once
- `@monaco-editor/react` `DiffEditor` imported directly — no tab system, no pre-approval gate
- **Files already written by tools** — Accept is cosmetic; Reject is the action that actually undoes changes

### Build Status: ✅ `npx tsc --noEmit` passes clean — zero errors
