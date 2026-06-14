import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app } from 'electron';
import { secureStore } from './secureStore';
import { dbService } from './db';

/**
 * Runs the secure credentials store integration tests.
 * This separates test loading/execution logic from production bootstrapping files.
 */
export async function runSecureStoreTests(): Promise<{ success: boolean; error?: string }> {
  try {
    const testPath = path.join(process.cwd(), 'scripts/test-secure-store.js');
    const testUrl = pathToFileURL(testPath).href;
    const { runTests } = await import(testUrl);
    await runTests(secureStore, dbService);
    return { success: true };
  } catch (err: any) {
    console.error(' [TestRunner] Integration test execution failed:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Checks command line arguments for the --test-secure-store flag and runs tests if present.
 */
export async function checkCommandLineTests(): Promise<void> {
  if (process.argv.includes('--test-secure-store')) {
    console.log(' [TestRunner] Running test-secure-store integration test from CLI...');
    const result = await runSecureStoreTests();
    if (result.success) {
      app.quit();
    } else {
      app.exit(1);
    }
  }
}
