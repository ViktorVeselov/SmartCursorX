let passed = 0;
let failed = 0;

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    console.error(`FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}

// Minimal reimplementation of the DLQ resolver logic for testing
class DlqResolver {
  private static entries = new Map<number, { resolve: (g: string | null) => void }>();

  static setResolver(taskId: number, resolve: (g: string | null) => void) {
    this.entries.set(taskId, { resolve });
  }

  static resolve(taskId: number, guidance: string | null) {
    const entry = this.entries.get(taskId);
    if (entry) {
      this.entries.delete(taskId);
      entry.resolve(guidance);
    }
  }
}

async function run() {
  console.log('--- DLQ RESOLVER TESTS ---');

  // Test 1: Set resolver and resolve with guidance
  const guidanceResult = await new Promise<string | null>((resolve) => {
    DlqResolver.setResolver(101, resolve);
    DlqResolver.resolve(101, 'Check the import paths');
  });
  assertEqual(guidanceResult, 'Check the import paths', 'resolve with guidance returns guidance text');

  // Test 2: Set resolver and resolve with null (cancel)
  const cancelResult = await new Promise<string | null>((resolve) => {
    DlqResolver.setResolver(102, resolve);
    DlqResolver.resolve(102, null);
  });
  assertEqual(cancelResult, null, 'resolve with null returns null (cancel)');

  // Test 3: Resolve unknown task does nothing (no crash)
  DlqResolver.resolve(999, 'should not crash');
  assert(true, 'resolve on unknown task does not throw');

  // Test 4: Multiple tasks tracked independently
  const results: Array<string | null> = [];
  await Promise.all([
    new Promise<void>((resolve) => {
      DlqResolver.setResolver(201, (guidance) => { results.push(guidance); resolve(); });
      DlqResolver.resolve(201, 'guidance A');
    }),
    new Promise<void>((resolve) => {
      DlqResolver.setResolver(202, (guidance) => { results.push(guidance); resolve(); });
      DlqResolver.resolve(202, null);
    }),
  ]);
  assertEqual(results.length, 2, 'multiple tasks resolve independently');
  assertEqual(results[0], 'guidance A', 'first task received correct guidance');
  assertEqual(results[1], null, 'second task received cancel');

  // Test 5: Resolver is removed after resolution
  const after = await new Promise<string | null>((resolve) => {
    DlqResolver.setResolver(301, resolve);
    DlqResolver.resolve(301, 'done');
    // Resolution should have removed the entry
    DlqResolver.resolve(301, 'ignored');
  });
  assertEqual(after, 'done', 'second resolve on same task ID is ignored');

  // Summary
  console.log(`\n--- DLQ RESOLVER RESULTS: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
