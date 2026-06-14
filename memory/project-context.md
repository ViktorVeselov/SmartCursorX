# Project Context

## Overview
**Last Updated:** 2026-06-13
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

