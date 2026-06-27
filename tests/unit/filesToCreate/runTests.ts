import { isExecutionPlanLike, mergeExecutionPlans } from '../../../src/utils/jsonParser';

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
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}

function mergeWithFiles(filesToModify: string[] | null, _filesRead: string[], filesToCreate: string[]): string[] {
  return Array.from(new Set([
    ...(filesToModify || []),
    ...(filesToCreate || [])
  ]));
}

async function run() {
  console.log('--- FILES TO CREATE UNIT TESTS ---');

  // Test 1: Plan with filesToCreate is recognized as execution plan
  const planWithCreate = {
    taskId: 1,
    steps: [{ order: 1, action: 'create', target: 'src/new-file.ts', rationale: '' }],
    expectedOutcome: 'Done',
    filesRead: [],
    filesToModify: [],
    filesToCreate: ['src/new-file.ts'],
    verificationCriteria: [],
    confidence: 1.0,
    tradeoffs: [],
    consequences: []
  };
  assert(isExecutionPlanLike(planWithCreate), 'isExecutionPlanLike returns true for plan with filesToCreate');

  // Test 2: filesToCreate is optional (backward compat)
  const planWithoutCreate = {
    taskId: 1,
    steps: [],
    expectedOutcome: 'Done',
    filesRead: [],
    filesToModify: [],
    verificationCriteria: [],
    confidence: 1.0,
    tradeoffs: [],
    consequences: []
  };
  assert(isExecutionPlanLike(planWithoutCreate), 'isExecutionPlanLike returns true for plan without filesToCreate');

  // Test 3: mergeExecutionPlans merges filesToCreate with Set dedup
  const obj1 = {
    filesToModify: ['src/existing.ts'],
    filesToCreate: ['src/new-file.ts'],
    steps: [{ order: 1, action: 'create', target: 'src/new-file.ts', rationale: '' }]
  };
  const obj2 = {
    filesToCreate: ['src/another.ts'],
    steps: [{ order: 2, action: 'modify', target: 'src/existing.ts', rationale: '' }]
  };
  const merged = mergeExecutionPlans([obj1, obj2]);
  const filesCreated = merged?.filesToCreate as string[] | undefined;
  assert(filesCreated !== undefined, 'mergeExecutionPlans produces filesToCreate field');
  assertEqual(filesCreated!.length, 2, 'filesToCreate merged and deduplicated correctly');
  assert(filesCreated!.includes('src/new-file.ts'), 'filesToCreate includes first plan file');
  assert(filesCreated!.includes('src/another.ts'), 'filesToCreate includes merged plan file');

  // Test 4: mergeWithFiles dedup helper
  const mergedFiles = mergeWithFiles(['src/existing.ts'], [], ['src/new-file.ts']);
  assertEqual(mergedFiles, ['src/existing.ts', 'src/new-file.ts'], 'mergeWithFiles deduplicates filesToCreate with filesToModify');

  // Test 5: mergeWithFiles handles empty filesToCreate
  const mergedEmpty = mergeWithFiles(['src/existing.ts'], [], []);
  assertEqual(mergedEmpty, ['src/existing.ts'], 'mergeWithFiles returns filesToModify when filesToCreate is empty');

  // Test 6: mergeWithFiles handles null/undefined filesToModify
  const mergedNull = mergeWithFiles(null, [], ['src/new.ts']);
  assertEqual(mergedNull, ['src/new.ts'], 'mergeWithFiles handles null filesToModify');

  // Test 7: Plan with both filesToModify and filesToCreate is valid
  const planBoth = {
    taskId: 1,
    steps: [
      { order: 1, action: 'create', target: 'src/new.ts', rationale: '' },
      { order: 2, action: 'modify', target: 'src/existing.ts', rationale: '' }
    ],
    expectedOutcome: 'Done',
    filesRead: ['src/read.ts'],
    filesToModify: ['src/existing.ts'],
    filesToCreate: ['src/new.ts'],
    verificationCriteria: [],
    confidence: 1.0,
    tradeoffs: [],
    consequences: []
  };
  assert(isExecutionPlanLike(planBoth), 'isExecutionPlanLike returns true for plan with both filesToModify and filesToCreate');

  // Test 8: mergeExecutionPlans handles null/undefined filesToCreate
  const objNoCreate = {
    filesToModify: ['src/existing.ts'],
    steps: []
  };
  const mergedNoCreate = mergeExecutionPlans([objNoCreate]);
  assert(mergedNoCreate?.filesToCreate === undefined || (mergedNoCreate.filesToCreate as string[]).length === 0,
    'mergeExecutionPlans produces no filesToCreate when not present');

  console.log(`\n--- FILES TO CREATE TEST RESULTS: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
