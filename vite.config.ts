import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import { notBundle } from 'vite-plugin-electron/plugin'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
  'ollama-ai-provider',
  'zod',
  // Native modules must stay unbundled to load their compiled binaries (.node files) at runtime
  'node-pty',
  'better-sqlite3',
  // Local native module package - must not be bundled
  'smart-cursor-x-native',
];

// Custom plugin to copy native module to dist-electron
function copyNativeModule() {
  return {
    name: 'copy-native-module',
    closeBundle() {
      const nativeSrc = path.join(__dirname, 'native', 'smart-cursor-x-native.win32-x64-msvc.node')
      const nativeDestDir = path.join(__dirname, 'dist-electron', 'native')
      const nativeDest = path.join(nativeDestDir, 'smart-cursor-x-native.win32-x64-msvc.node')
      
      if (fs.existsSync(nativeSrc)) {
        if (!fs.existsSync(nativeDestDir)) {
          fs.mkdirSync(nativeDestDir, { recursive: true })
        }
        fs.copyFileSync(nativeSrc, nativeDest)
        console.log('[copy-native-module] Copied native module to dist-electron/native/')
      } else {
        console.warn('[copy-native-module] Native module not found at:', nativeSrc)
      }
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    copyNativeModule(),
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
            external: externalPkgs,
          },
          plugins: [
            notBundle(),
          ],
          resolve: {
            alias: {
              'smart-cursor-x-native': path.join(__dirname, 'native'),
            },
          },
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
