import * as path from 'path';
import { PathGuard } from '../../../electron/services/PathGuard';

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
  console.log('--- PATHGUARD UNIT TESTS ---');

  const workspaceRoot = process.cwd();

  // Test 1: Unconfigured state
  assertEqual(PathGuard.getWorkspacePath(), null, 'getWorkspacePath returns null before configure');
  assertEqual(PathGuard.resolve('some/file.ts'), null, 'resolve returns null before configure');
  assertEqual(PathGuard.isContained('C:\\any\\path.ts'), false, 'isContained returns false before configure');

  // Test 2: Configure
  PathGuard.configure(workspaceRoot);
  assertEqual(PathGuard.getWorkspacePath(), path.resolve(workspaceRoot), 'getWorkspacePath returns configured root');

  // Test 3: Resolve relative path within root
  const resolved = PathGuard.resolve('package.json');
  const expected = path.join(workspaceRoot, 'package.json');
  assertEqual(resolved, expected, 'resolve relative path within root');

  // Test 4: Resolve nested relative path
  const nestedResolved = PathGuard.resolve('src/App.tsx');
  const nestedExpected = path.join(workspaceRoot, 'src/App.tsx');
  assertEqual(nestedResolved, nestedExpected, 'resolve nested relative path');

  // Test 5: Resolve absolute path within root
  const absResolved = PathGuard.resolve(nestedExpected);
  assertEqual(absResolved, nestedExpected, 'resolve absolute path within root');

  // Test 6: Resolve dot-dot traversal (outside root)
  const traversalResolved = PathGuard.resolve('..\\..\\Windows\\system32\\config');
  assertEqual(traversalResolved, null, 'resolve path with dot-dot traversal returns null');

  // Test 7: Resolve path outside root via absolute
  let outsidePath: string;
  if (process.platform === 'win32') {
    outsidePath = 'C:\\Windows\\system32\\config';
  } else {
    outsidePath = '/etc/passwd';
  }
  assertEqual(PathGuard.resolve(outsidePath), null, 'resolve absolute path outside root returns null');

  // Test 8: isContained within root
  assertEqual(PathGuard.isContained(nestedExpected), true, 'isContained returns true for path within root');

  // Test 9: isContained outside root
  assertEqual(PathGuard.isContained(outsidePath), false, 'isContained returns false for path outside root');

  // Test 10: Register extra root
  const tmpRoot = path.resolve(workspaceRoot, '..', 'tmp_test_extra_root');
  if (process.platform === 'win32') {
    PathGuard.registerRoot('C:\\tmp_test_extra_root');
  } else {
    PathGuard.registerRoot('/tmp_test_extra_root');
  }

  // Test 11: Resolve path within extra root
  const extraRootPath = process.platform === 'win32'
    ? 'C:\\tmp_test_extra_root\\some_file.txt'
    : '/tmp_test_extra_root/some_file.txt';
  assertEqual(PathGuard.resolve(extraRootPath), extraRootPath, 'resolve absolute path within extra root');

  // Test 12: isContained within extra root
  assertEqual(PathGuard.isContained(extraRootPath), true, 'isContained returns true for path within extra root');

  // Test 13: Empty string
  assertEqual(PathGuard.resolve(''), workspaceRoot, 'resolve empty string returns root path');

  // Test 14: isContained for root itself
  assertEqual(PathGuard.isContained(workspaceRoot), true, 'isContained returns true for root itself');

  // Test 15: Path with trailing slash
  const withTrailingSlash = path.join(workspaceRoot, 'src') + path.sep;
  assertEqual(PathGuard.isContained(withTrailingSlash), true, 'isContained returns true for path with trailing separator');

  // Test 16: Windows case-insensitivity (only on Windows)
  if (process.platform === 'win32') {
    const result = PathGuard.isContained(workspaceRoot.toUpperCase() + '\\SRC\\APP.TSX');
    assertEqual(result, true, 'isContained is case-insensitive on Windows');
  }

  // Test 17: Dot-dot within root (should pass)
  const withinRootTraversal = path.join(workspaceRoot, 'src', '..', 'package.json');
  const resolvedWithin = PathGuard.resolve(withinRootTraversal);
  const expectedPkg = path.join(workspaceRoot, 'package.json');
  assertEqual(resolvedWithin, expectedPkg, 'resolve dot-dot within root resolves correctly');

  // Test 18: Reconfigure
  const newRoot = path.resolve(workspaceRoot, 'tests');
  PathGuard.configure(newRoot);
  assertEqual(PathGuard.getWorkspacePath(), path.resolve(newRoot), 'reconfigure updates workspace path');
  assertEqual(PathGuard.isContained(nestedExpected), false, 'after reconfigure old path is no longer contained');

  // Reset for subsequent tests
  PathGuard.configure(workspaceRoot);

  // Summary
  console.log(`\n--- RESULTS: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
