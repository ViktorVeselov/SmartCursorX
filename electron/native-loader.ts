// Native module loader - completely dynamic to prevent bundler static analysis
// This file is safe to bundle because it only uses dynamic require

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)

// Get the project root (cursor-replacer) - works in both dev and built modes
// In dev: __dirname = electron, projectRoot = join(electron, '..') = cursor-replacer
// In built: __dirname = dist-electron, projectRoot = join(dist-electron, '..') = cursor-replacer
const projectRoot = resolve(__dirname, '..')

export function loadNativeModule(): any {
  try {
    // Try to load from the local native folder first (dev mode)
    const nativePath = join(projectRoot, 'native')
    const native = require(nativePath)
    console.log('[native-loader] Native module loaded from local:', native?.nativeHealthCheck?.())
    return native
  } catch (err) {
    console.error('[native-loader] Failed to load native module from local:', err)
    try {
      // Fallback to package name (packaged mode)
      const native = require('smart-cursor-x-native')
      console.log('[native-loader] Native module loaded from package:', native?.nativeHealthCheck?.())
      return native
    } catch (err2) {
      console.error('[native-loader] Failed to load native module from package:', err2)
      return null
    }
  }
}

export const native = loadNativeModule()