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

function assertThrows(fn: () => void, expectedMsg: string, testName: string) {
  try {
    fn();
    console.error(`FAIL: ${testName} — expected error but none thrown`);
    failed++;
  } catch (err: any) {
    if (err.message && err.message.includes(expectedMsg)) {
      console.log(`PASS: ${testName}`);
      passed++;
    } else {
      console.error(`FAIL: ${testName} — expected "${expectedMsg}" but got "${err.message}"`);
      failed++;
    }
  }
}

async function run() {
  console.log('--- IPC HANDLER SECURITY TESTS ---');

  // PathGuard tests for each handler's isContained usage
  const workspaceRoot = process.cwd();
  PathGuard.configure(workspaceRoot);

  const outsidePath = process.platform === 'win32'
    ? 'C:\\Windows\\system32\\config\\SAM'
    : '/etc/shadow';

  const safePath = path.join(workspaceRoot, 'package.json');

  // Simulates the security check each handler performs
  function simulateReadFile(filePath: string) {
    if (typeof filePath !== 'string') throw new Error('Invalid path argument');
    if (!PathGuard.isContained(filePath)) {
      throw new Error(`Security: Read of "${filePath}" is outside the workspace root`);
    }
    return 'ok';
  }

  function simulateWriteFile(filePath: string) {
    if (typeof filePath !== 'string' || !filePath.trim()) throw new Error('Invalid file path');
    if (!PathGuard.isContained(filePath)) {
      throw new Error(`Security: Write to "${filePath}" is outside the workspace root`);
    }
    return 'ok';
  }

  function simulateDeletePath(targetPath: string) {
    if (typeof targetPath !== 'string') throw new Error('Invalid path argument');
    if (!PathGuard.isContained(targetPath)) {
      throw new Error(`Security: Delete of "${targetPath}" is outside the workspace root`);
    }
    return 'ok';
  }

  function simulateRenamePath(oldPath: string, newPath: string) {
    if (typeof oldPath !== 'string' || typeof newPath !== 'string') throw new Error('Invalid path arguments');
    if (!PathGuard.isContained(oldPath)) {
      throw new Error(`Security: Rename source "${oldPath}" is outside the workspace root`);
    }
    if (!PathGuard.isContained(newPath)) {
      throw new Error(`Security: Rename target "${newPath}" is outside the workspace root`);
    }
    return 'ok';
  }

  function simulateCreateDirectory(dirPath: string) {
    if (typeof dirPath !== 'string') throw new Error('Invalid path argument');
    if (!PathGuard.isContained(dirPath)) {
      throw new Error(`Security: Create directory "${dirPath}" is outside the workspace root`);
    }
    return 'ok';
  }

  function simulateReadDir(dirPath: string) {
    if (typeof dirPath !== 'string') throw new Error('Invalid path argument');
    if (!PathGuard.isContained(dirPath)) {
      throw new Error(`Security: Read directory "${dirPath}" is outside the workspace root`);
    }
    return 'ok';
  }

  // --- 1. read-file security ---
  assertEqual(simulateReadFile(safePath), 'ok', 'read-file: allows path within root');
  assertThrows(() => simulateReadFile(outsidePath), 'Security: Read of', 'read-file: rejects path outside root');
  assertThrows(() => simulateReadFile(42 as any), 'Invalid path argument', 'read-file: rejects non-string path');

  // --- 2. write-file security ---
  assertEqual(simulateWriteFile(safePath), 'ok', 'write-file: allows path within root');
  assertThrows(() => simulateWriteFile(outsidePath), 'Security: Write to', 'write-file: rejects path outside root');
  assertThrows(() => simulateWriteFile(''), 'Invalid file path', 'write-file: rejects empty path');
  assertThrows(() => simulateWriteFile('   '), 'Invalid file path', 'write-file: rejects whitespace-only path');

  // --- 3. delete-path security ---
  assertEqual(simulateDeletePath(safePath), 'ok', 'delete-path: allows path within root');
  assertThrows(() => simulateDeletePath(outsidePath), 'Security: Delete of', 'delete-path: rejects path outside root');
  assertThrows(() => simulateDeletePath(123 as any), 'Invalid path argument', 'delete-path: rejects non-string path');

  // --- 4. rename-path security ---
  assertEqual(simulateRenamePath(safePath, path.join(workspaceRoot, 'renamed.json')), 'ok', 'rename-path: allows both paths within root');
  assertThrows(() => simulateRenamePath(outsidePath, safePath), 'Security: Rename source', 'rename-path: rejects source outside root');
  assertThrows(() => simulateRenamePath(safePath, outsidePath), 'Security: Rename target', 'rename-path: rejects target outside root');
  assertThrows(() => simulateRenamePath(42 as any, safePath), 'Invalid path arguments', 'rename-path: rejects non-string source');
  assertThrows(() => simulateRenamePath(safePath, undefined as any), 'Invalid path arguments', 'rename-path: rejects undefined target');

  // --- 5. create-directory security ---
  assertEqual(simulateCreateDirectory(path.join(workspaceRoot, 'newDir')), 'ok', 'create-directory: allows path within root');
  assertThrows(() => simulateCreateDirectory(outsidePath), 'Security: Create directory', 'create-directory: rejects path outside root');
  assertThrows(() => simulateCreateDirectory(undefined as any), 'Invalid path argument', 'create-directory: rejects undefined path');

  // --- 6. read-dir security ---
  assertEqual(simulateReadDir(workspaceRoot), 'ok', 'read-dir: allows path within root');
  assertThrows(() => simulateReadDir(outsidePath), 'Security: Read directory', 'read-dir: rejects path outside root');
  assertThrows(() => simulateReadDir(null as any), 'Invalid path argument', 'read-dir: rejects null path');

  // --- 7. Edge case: symlink-like paths not resolved (workspace root in name) ---
  const fakeContained = path.join(workspaceRoot, '..', '..', 'tmp', 'safe');
  assertThrows(() => simulateReadFile(fakeContained), 'Security: Read of', 'read-file: rejects path that uses .. to escape');

  // --- 8. Case sensitivity on Windows ---
  if (process.platform === 'win32') {
    const upperCaseRoot = workspaceRoot.toUpperCase();
    const upperCasePath = path.join(upperCaseRoot, 'PACKAGE.JSON');
    assertEqual(simulateReadFile(upperCasePath), 'ok', 'read-file: case-insensitive on Windows');
  }

  // Summary
  console.log(`\n--- IPC SECURITY RESULTS: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
