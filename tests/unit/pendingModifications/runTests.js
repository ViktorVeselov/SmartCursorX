// electron/services/PendingModificationsService.ts
import * as fs from "fs";
import * as path from "path";
import console2 from "console";
var PendingModificationsService = class {
  static pending = /* @__PURE__ */ new Map();
  static pendingResolvers = /* @__PURE__ */ new Map();
  static setPending(taskId, mods) {
    this.pending.set(taskId, mods);
  }
  static getPending(taskId) {
    return this.pending.get(taskId);
  }
  static getAllPending() {
    return new Map(this.pending);
  }
  static hasPending() {
    return this.pending.size > 0;
  }
  static getTaskIdForResolver(resolve) {
    for (const [taskId, resolver] of this.pendingResolvers) {
      if (resolver === resolve) return taskId;
    }
    return null;
  }
  static setResolver(taskId, resolve) {
    this.pendingResolvers.set(taskId, resolve);
  }
  static removePending(taskId) {
    this.pending.delete(taskId);
    this.pendingResolvers.delete(taskId);
  }
  static applySingleFile(modification) {
    try {
      const parentDir = path.dirname(modification.absolutePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(modification.absolutePath, modification.proposedContent, "utf-8");
      console2.log(`[PendingModificationsService] Applied single file: ${modification.relativePath}`);
      return true;
    } catch (err) {
      console2.error(`[PendingModificationsService] Failed to apply file: ${modification.relativePath}`, err);
      return false;
    }
  }
  static applyModifications(taskId) {
    const mods = this.pending.get(taskId);
    if (!mods) {
      console2.error(`[PendingModificationsService] No pending modifications for task ${taskId}`);
      return false;
    }
    let allApplied = true;
    for (const mod of mods.modifications) {
      const success = this.applySingleFile(mod);
      if (!success) allApplied = false;
    }
    console2.log(`[PendingModificationsService] Applied all modifications for task ${taskId}, all succeeded: ${allApplied}`);
    return allApplied;
  }
  static resolvePending(taskId, accepted) {
    const resolver = this.pendingResolvers.get(taskId);
    if (resolver) {
      this.pendingResolvers.delete(taskId);
      resolver(accepted);
    }
  }
  static clear() {
    this.pending.clear();
    this.pendingResolvers.clear();
  }
};

// tests/unit/pendingModifications/runTests.ts
var passed = 0;
var failed = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`FAIL: ${message} \u2014 expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}
async function run() {
  console.log("--- PENDING MODIFICATIONS SERVICE TESTS ---");
  PendingModificationsService.clear();
  assertEqual(PendingModificationsService.hasPending(), false, "hasPending returns false after clear");
  assertEqual(PendingModificationsService.getPending(1), void 0, "getPending returns undefined for unknown task");
  const mods = {
    taskId: 42,
    modifications: [
      {
        relativePath: "src/foo.ts",
        absolutePath: "/workspace/src/foo.ts",
        originalContent: "old",
        proposedContent: "new",
        addedLines: 2,
        removedLines: 1,
        patches: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 2 }]
      }
    ],
    createdAt: Date.now()
  };
  PendingModificationsService.setPending(42, mods);
  assertEqual(PendingModificationsService.hasPending(), true, "hasPending returns true after setting pending");
  const retrieved = PendingModificationsService.getPending(42);
  assert(retrieved !== void 0, "getPending returns data for known task");
  assertEqual(retrieved.taskId, 42, "retrieved task has correct taskId");
  assertEqual(retrieved.modifications.length, 1, "retrieved task has 1 modification");
  assertEqual(retrieved.modifications[0].relativePath, "src/foo.ts", "modification has correct relativePath");
  PendingModificationsService.clear();
  assertEqual(PendingModificationsService.hasPending(), false, "hasPending returns false after clear with data");
  assertEqual(PendingModificationsService.getPending(42), void 0, "getPending returns undefined after clear");
  PendingModificationsService.setPending(1, { taskId: 1, modifications: [], createdAt: 1 });
  PendingModificationsService.setPending(2, { taskId: 2, modifications: [], createdAt: 2 });
  assertEqual(PendingModificationsService.hasPending(), true, "hasPending true with multiple tasks");
  assertEqual(PendingModificationsService.getPending(1).taskId, 1, "task 1 retrievable");
  assertEqual(PendingModificationsService.getPending(2).taskId, 2, "task 2 retrievable");
  PendingModificationsService.removePending(1);
  assertEqual(PendingModificationsService.getPending(1), void 0, "task 1 removed");
  assertEqual(PendingModificationsService.getPending(2).taskId, 2, "task 2 still present");
  assertEqual(PendingModificationsService.hasPending(), true, "hasPending true after partial remove");
  PendingModificationsService.removePending(2);
  assertEqual(PendingModificationsService.hasPending(), false, "hasPending false after all removed");
  const result = PendingModificationsService.applyModifications(999);
  assertEqual(result, false, "applyModifications returns false for unknown task");
  let resolvedValue = null;
  const resolver = (accepted) => {
    resolvedValue = accepted;
  };
  PendingModificationsService.setPending(5, { taskId: 5, modifications: [], createdAt: 5 });
  PendingModificationsService.setResolver(5, resolver);
  PendingModificationsService.resolvePending(5, true);
  assertEqual(resolvedValue, true, "resolver called with true");
  resolvedValue = null;
  PendingModificationsService.setPending(6, { taskId: 6, modifications: [], createdAt: 6 });
  PendingModificationsService.setResolver(6, resolver);
  PendingModificationsService.resolvePending(6, false);
  assertEqual(resolvedValue, false, "resolver called with false");
  const uniqueResolver = (accepted) => {
  };
  PendingModificationsService.setPending(7, { taskId: 7, modifications: [], createdAt: 7 });
  PendingModificationsService.setResolver(7, uniqueResolver);
  const foundId = PendingModificationsService.getTaskIdForResolver(uniqueResolver);
  assertEqual(foundId, 7, "getTaskIdForResolver finds correct task ID");
  const notFoundId = PendingModificationsService.getTaskIdForResolver(() => {
  });
  assertEqual(notFoundId, null, "getTaskIdForResolver returns null for unknown resolver");
  PendingModificationsService.clear();
  const foundAfterClear = PendingModificationsService.getTaskIdForResolver(uniqueResolver);
  assertEqual(foundAfterClear, null, "getTaskIdForResolver returns null after clear");
  PendingModificationsService.setPending(1, { taskId: 1, modifications: [], createdAt: 1 });
  const allPending = PendingModificationsService.getAllPending();
  assertEqual(allPending.size, 1, "getAllPending returns correct size");
  PendingModificationsService.clear();
  assertEqual(allPending.size, 1, "snapshot unaffected by subsequent clear");
  console.log(`
--- PENDING MODIFICATIONS RESULTS: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
}
run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
