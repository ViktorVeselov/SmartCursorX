import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import { notBundle } from 'vite-plugin-electron/plugin'

/**
 * Packages that must stay unbundled to avoid Rolldown's __require shim for
 * CJS modules. These are loaded from node_modules at runtime (Electron ESM).
 */
const externalPkgs = [
  // @ai-sdk packages import @vercel/oidc which is CJS-only and uses
  // `require('path')`. If bundled, Rolldown generates __require("path")
  // which fails in ESM-only Electron context.
  '@ai-sdk/provider',
  '@ai-sdk/openai',
  '@ai-sdk/anthropic',
  '@ai-sdk/openai-compatible',
  '@ai-sdk/gateway',
  '@ai-sdk/react',
  '@ai-sdk/ui-utils',
  '@ai-sdk/core',
  '@vercel/oidc',
  // Runtime-safe to deps that have proper ESM exports
  'ai',
  /^ollama-ai-provider/,
  /^zod/,
  // Native modules must stay unbundled to load their compiled binaries (.node files) at runtime
  'node-pty',
  'better-sqlite3',
];

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: externalPkgs,
            },
          },
          ssr: {
            external: [
              'node-pty',
              'better-sqlite3',
              '@ai-sdk/provider',
              '@ai-sdk/openai',
              '@ai-sdk/anthropic',
              '@ai-sdk/openai-compatible',
              '@ai-sdk/gateway',
              '@ai-sdk/react',
              '@ai-sdk/ui-utils',
              '@ai-sdk/core',
              '@vercel/oidc',
              'ai',
              'ollama-ai-provider',
              'zod',
            ],
          },
          plugins: [
            notBundle(),
          ],
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      renderer: process.env.NODE_ENV === 'test'
        ? undefined
        : {},
    }),
  ],
})
