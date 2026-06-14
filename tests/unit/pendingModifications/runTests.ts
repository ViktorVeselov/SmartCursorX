import { PendingModificationsService } from '../../../electron/services/PendingModificationsService';
import type { PendingFileModification, PendingTaskModifications } from '../../../src/types/appTypes';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    console.error(`FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}

async function run() {
  console.log('--- PENDING MODIFICATIONS SERVICE TESTS ---');

  // Test 1: Clear when nothing pending
  PendingModificationsService.clear();
  assertEqual(PendingModificationsService.hasPending(), false, 'hasPending returns false after clear');
  assertEqual(PendingModificationsService.getPending(1), undefined, 'getPending returns undefined for unknown task');

  // Test 2: Set and get pending
  const mods: PendingTaskModifications = {
    taskId: 42,
    modifications: [
      {
        relativePath: 'src/foo.ts',
        absolutePath: '/workspace/src/foo.ts',
        originalContent: 'old',
        proposedContent: 'new',
        addedLines: 2,
        removedLines: 1,
        patches: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 2 }],
      }
    ],
    createdAt: Date.now(),
  };
  PendingModificationsService.setPending(42, mods);
  assertEqual(PendingModificationsService.hasPending(), true, 'hasPending returns true after setting pending');
  const retrieved = PendingModificationsService.getPending(42);
  assert(retrieved !== undefined, 'getPending returns data for known task');
  assertEqual(retrieved!.taskId, 42, 'retrieved task has correct taskId');
  assertEqual(retrieved!.modifications.length, 1, 'retrieved task has 1 modification');
  assertEqual(retrieved!.modifications[0].relativePath, 'src/foo.ts', 'modification has correct relativePath');

  // Test 3: Clear removes all pending
  PendingModificationsService.clear();
  assertEqual(PendingModificationsService.hasPending(), false, 'hasPending returns false after clear with data');
  assertEqual(PendingModificationsService.getPending(42), undefined, 'getPending returns undefined after clear');

  // Test 4: Multiple tasks tracked independently
  PendingModificationsService.setPending(1, { taskId: 1, modifications: [], createdAt: 1 });
  PendingModificationsService.setPending(2, { taskId: 2, modifications: [], createdAt: 2 });
  assertEqual(PendingModificationsService.hasPending(), true, 'hasPending true with multiple tasks');
  assertEqual(PendingModificationsService.getPending(1)!.taskId, 1, 'task 1 retrievable');
  assertEqual(PendingModificationsService.getPending(2)!.taskId, 2, 'task 2 retrievable');

  // Test 5: Remove pending clears only one task
  PendingModificationsService.removePending(1);
  assertEqual(PendingModificationsService.getPending(1), undefined, 'task 1 removed');
  assertEqual(PendingModificationsService.getPending(2)!.taskId, 2, 'task 2 still present');
  assertEqual(PendingModificationsService.hasPending(), true, 'hasPending true after partial remove');

  PendingModificationsService.removePending(2);
  assertEqual(PendingModificationsService.hasPending(), false, 'hasPending false after all removed');

  // Test 6: Apply modifications with missing task
  const result = PendingModificationsService.applyModifications(999);
  assertEqual(result, false, 'applyModifications returns false for unknown task');

  // Test 7: Resolver tracking
  let resolvedValue: boolean | null = null;
  const resolver = (accepted: boolean) => { resolvedValue = accepted; };

  PendingModificationsService.setPending(5, { taskId: 5, modifications: [], createdAt: 5 });
  PendingModificationsService.setResolver(5, resolver);
  PendingModificationsService.resolvePending(5, true);
  assertEqual(resolvedValue, true, 'resolver called with true');

  // Test 8: Resolver called with false
  resolvedValue = null;
  PendingModificationsService.setPending(6, { taskId: 6, modifications: [], createdAt: 6 });
  PendingModificationsService.setResolver(6, resolver);
  PendingModificationsService.resolvePending(6, false);
  assertEqual(resolvedValue, false, 'resolver called with false');

  // Test 9: getTaskIdForResolver
  const uniqueResolver = (accepted: boolean) => {};
  PendingModificationsService.setPending(7, { taskId: 7, modifications: [], createdAt: 7 });
  PendingModificationsService.setResolver(7, uniqueResolver);
  const foundId = PendingModificationsService.getTaskIdForResolver(uniqueResolver);
  assertEqual(foundId, 7, 'getTaskIdForResolver finds correct task ID');

  const notFoundId = PendingModificationsService.getTaskIdForResolver(() => {});
  assertEqual(notFoundId, null, 'getTaskIdForResolver returns null for unknown resolver');

  // Test 10: Clear also removes resolvers
  PendingModificationsService.clear();
  const foundAfterClear = PendingModificationsService.getTaskIdForResolver(uniqueResolver);
  assertEqual(foundAfterClear, null, 'getTaskIdForResolver returns null after clear');

  // Test 11: getAllPending returns snapshot
  PendingModificationsService.setPending(1, { taskId: 1, modifications: [], createdAt: 1 });
  const allPending = PendingModificationsService.getAllPending();
  assertEqual(allPending.size, 1, 'getAllPending returns correct size');
  // Clear should not affect snapshot
  PendingModificationsService.clear();
  assertEqual(allPending.size, 1, 'snapshot unaffected by subsequent clear');

  // Summary
  console.log(`\n--- PENDING MODIFICATIONS RESULTS: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
