// tests/unit/dlq/runTests.ts
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
var DlqResolver = class {
  static entries = /* @__PURE__ */ new Map();
  static setResolver(taskId, resolve) {
    this.entries.set(taskId, { resolve });
  }
  static resolve(taskId, guidance) {
    const entry = this.entries.get(taskId);
    if (entry) {
      this.entries.delete(taskId);
      entry.resolve(guidance);
    }
  }
};
async function run() {
  console.log("--- DLQ RESOLVER TESTS ---");
  const guidanceResult = await new Promise((resolve) => {
    DlqResolver.setResolver(101, resolve);
    DlqResolver.resolve(101, "Check the import paths");
  });
  assertEqual(guidanceResult, "Check the import paths", "resolve with guidance returns guidance text");
  const cancelResult = await new Promise((resolve) => {
    DlqResolver.setResolver(102, resolve);
    DlqResolver.resolve(102, null);
  });
  assertEqual(cancelResult, null, "resolve with null returns null (cancel)");
  DlqResolver.resolve(999, "should not crash");
  assert(true, "resolve on unknown task does not throw");
  const results = [];
  await Promise.all([
    new Promise((resolve) => {
      DlqResolver.setResolver(201, (guidance) => {
        results.push(guidance);
        resolve();
      });
      DlqResolver.resolve(201, "guidance A");
    }),
    new Promise((resolve) => {
      DlqResolver.setResolver(202, (guidance) => {
        results.push(guidance);
        resolve();
      });
      DlqResolver.resolve(202, null);
    })
  ]);
  assertEqual(results.length, 2, "multiple tasks resolve independently");
  assertEqual(results[0], "guidance A", "first task received correct guidance");
  assertEqual(results[1], null, "second task received cancel");
  const after = await new Promise((resolve) => {
    DlqResolver.setResolver(301, resolve);
    DlqResolver.resolve(301, "done");
    DlqResolver.resolve(301, "ignored");
  });
  assertEqual(after, "done", "second resolve on same task ID is ignored");
  console.log(`
--- DLQ RESOLVER RESULTS: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
}
run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
