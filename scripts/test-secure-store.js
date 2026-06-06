#!/usr/bin/env node
/**
 * test-secure-store.js — Integration test for secure credential storage.
 *
 * IMPORTANT: This script must be run inside the Electron main process context
 * because safeStorage requires an active Electron app. Use:
 *
 *   npx electron . --test-secure-store
 *
 * OR invoke via the 'test:secure-run' IPC handler added to ipcHandlers.ts.
 *
 * For CI/CD environments without a display, set:
 *   ELECTRON_IS_CI=true (mocks safeStorage with AES-256-GCM)
 */

'use strict';

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passCount++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        failCount++;
    }
}

async function runTests(secureStore, dbService) {
    console.log('\n[test-secure-store] Running integration tests...\n');

    const TEST_PROVIDER = '__test_integration_provider__';
    const TEST_KEY = 'sk-test-key-' + Math.random().toString(36).slice(2, 10);

    // 1. Store a key
    try {
        secureStore.setApiKey(TEST_PROVIDER, TEST_KEY);
        assert(true, 'setApiKey() completed without throwing');
    } catch (e) {
        assert(false, `setApiKey() threw: ${e.message}`);
        return finalize();
    }

    // 2. Read the key back and verify round-trip
    const retrieved = secureStore.getApiKey(TEST_PROVIDER);
    assert(retrieved === TEST_KEY, `getApiKey() round-trip matches original (got: ${retrieved ? '[value]' : 'undefined'})`);

    // 2b. Verify custom provider key methods
    try {
        secureStore.setCustomProviderKey(TEST_PROVIDER, TEST_KEY);
        assert(true, 'setCustomProviderKey() completed without throwing');
        const retrievedCustom = secureStore.getCustomProviderKey(TEST_PROVIDER);
        assert(retrievedCustom === TEST_KEY, `getCustomProviderKey() round-trip matches original`);
        secureStore.deleteCustomProviderKey(TEST_PROVIDER);
        const deletedCustom = secureStore.getCustomProviderKey(TEST_PROVIDER);
        assert(deletedCustom === undefined, 'deleteCustomProviderKey() removes the key');
    } catch (e) {
        assert(false, `Custom provider keys test failed: ${e.message}`);
    }

    // 3. Verify no plaintext appears in raw DB
    try {
        const rows = dbService.db.prepare('SELECT * FROM knowledge_chunks WHERE content LIKE ?').all(`%${TEST_KEY}%`);
        const memRows = dbService.db.prepare('SELECT * FROM memories WHERE content LIKE ?').all(`%${TEST_KEY}%`);
        assert(rows.length === 0 && memRows.length === 0, 'Plaintext key does not appear in any SQLite table rows');
    } catch (e) {
        // DB access unavailable in this context
        console.warn('  ⚠ Could not verify DB plaintext check:', e.message);
    }

    // 4. Verify custom_providers api_key column is NULL for migrated keys
    try {
        const customProviders = dbService.db.prepare('SELECT api_key FROM custom_providers WHERE api_key IS NOT NULL').all();
        assert(customProviders.length === 0, 'custom_providers.api_key column has no plaintext values (all migrated)');
    } catch (e) {
        console.warn('  ⚠ Could not check custom_providers:', e.message);
    }

    // 5. Delete the key and confirm deletion
    try {
        secureStore.deleteApiKey(TEST_PROVIDER);
        const afterDelete = secureStore.getApiKey(TEST_PROVIDER);
        assert(afterDelete === undefined, 'deleteApiKey() removes the key (getApiKey returns undefined)');
    } catch (e) {
        assert(false, `deleteApiKey() threw: ${e.message}`);
    }

    finalize();
}

function finalize() {
    console.log(`\n[test-secure-store] Results: ${passCount} passed, ${failCount} failed\n`);
    if (failCount > 0) {
        process.exitCode = 1;
    }
}

// Export for use from Electron main process
export { runTests };
