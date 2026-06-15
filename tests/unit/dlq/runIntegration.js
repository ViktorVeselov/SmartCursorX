// tests/unit/dlq/runIntegration.ts
var passed = 0;
var failed = 0;
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`FAIL: ${message} \u2014 expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}
var ExecutionLoopService = class {
  static dlqEntries = /* @__PURE__ */ new Map();
  static setDlqResolver(taskId, resolve) {
    this.dlqEntries.set(taskId, { resolve });
  }
  static resolveDlq(taskId, guidance) {
    const entry = this.dlqEntries.get(taskId);
    if (entry) {
      this.dlqEntries.delete(taskId);
      entry.resolve(guidance);
    }
  }
};
async function simulateIpcDlqRespond(taskId, guidance) {
  ExecutionLoopService.resolveDlq(taskId, guidance);
  return { success: true };
}
async function run() {
  console.log("=== DLQ INTEGRATION TESTS ===\n");
  console.log("--- Flow 1: Happy path (guidance provided) ---");
  const taskId1 = 100;
  let dlqFired = false;
  let attempt1Result = "pending";
  const simulateExecuteTaskFailure = async () => {
    dlqFired = true;
    attempt1Result = await new Promise((resolve) => {
      ExecutionLoopService.setDlqResolver(taskId1, resolve);
    });
    if (attempt1Result) {
      return "passed";
    }
    return "failed";
  };
  const execPromise1 = simulateExecuteTaskFailure();
  assert(dlqFired, "DLQ notification was sent after 3 retries");
  await simulateIpcDlqRespond(taskId1, "Check the import paths");
  const execResult1 = await execPromise1;
  assertEqual(execResult1, "passed", "Task retry succeeded after user guidance");
  assertEqual(attempt1Result, "Check the import paths", "DLQ resolver received the guidance text");
  console.log("\n--- Flow 2: User cancels ---");
  const taskId2 = 200;
  let dlqFired2 = false;
  let attempt2Result = "pending";
  const simulateExecuteTaskCancel = async () => {
    dlqFired2 = true;
    attempt2Result = await new Promise((resolve) => {
      ExecutionLoopService.setDlqResolver(taskId2, resolve);
    });
    if (!attempt2Result) {
      return "failed";
    }
    return "passed";
  };
  const execPromise2 = simulateExecuteTaskCancel();
  assert(dlqFired2, "DLQ notification sent for flow 2");
  await simulateIpcDlqRespond(taskId2, null);
  const execResult2 = await execPromise2;
  assertEqual(execResult2, "failed", "Task failed after user cancelled");
  assertEqual(attempt2Result, null, "DLQ resolver received null (cancel)");
  console.log("\n--- Flow 3: Edge cases ---");
  const taskId3 = 300;
  const execPromise3 = (async () => {
    const guidance = await new Promise((resolve) => {
      ExecutionLoopService.setDlqResolver(taskId3, resolve);
    });
    return guidance;
  })();
  await simulateIpcDlqRespond(taskId3, "");
  const result3 = await execPromise3;
  assertEqual(result3, "", "Empty string guidance is passed through (not treated as cancel)");
  const taskId4 = 400;
  const execPromise4 = (async () => {
    return await new Promise((resolve) => {
      ExecutionLoopService.setDlqResolver(taskId4, resolve);
      ExecutionLoopService.resolveDlq(taskId4, "first");
      ExecutionLoopService.resolveDlq(taskId4, "second");
    });
  })();
  assertEqual(await execPromise4, "first", "Only first resolve wins on double invocation");
  console.log("\n--- Flow 4: Async timing ---");
  const taskId5 = 500;
  let notificationOrder = [];
  const execPromise5 = (async () => {
    notificationOrder.push("executeTask: sending DLQ");
    const guidance = await new Promise((resolve) => {
      ExecutionLoopService.setDlqResolver(taskId5, resolve);
    });
    notificationOrder.push(`executeTask: received "${guidance}"`);
    return guidance;
  })();
  notificationOrder.push("renderer: received DLQ notification");
  notificationOrder.push("renderer: user typed guidance");
  await simulateIpcDlqRespond(taskId5, "Fix the SQL injection");
  const result5 = await execPromise5;
  assertEqual(result5, "Fix the SQL injection", "Guidance roundtrips correctly through async IPC");
  console.log(`
=== DLQ INTEGRATION RESULTS: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}
run().catch((err) => {
  console.error("Test suite crashed:", err);
  process.exit(1);
});
