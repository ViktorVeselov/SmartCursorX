import path from 'path';
import fs from 'fs';
import os from 'os';
import { registerChangesHandlers } from '../../../electron/ipcHandlers/changes';
import { PendingModificationsService } from '../../../electron/services/PendingModificationsService';
import { SessionChangesTrackerService } from '../../../electron/services/SessionChangesTrackerService';
import { secureStore } from '../../../electron/secureStore';

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
  console.log('--- CHANGES HANDLERS UNIT TESTS ---');

  // Mock ipcMain
  const handlers = new Map<string, Function>();
  const mockIpcMain = {
    handle(channel: string, handler: Function) {
      handlers.set(channel, handler);
    }
  } as any;

  const mockContext = {} as any;
  registerChangesHandlers(mockIpcMain, mockContext);

  const getListHandler = handlers.get('changes:get-list')!;
  const getContentHandler = handlers.get('changes:get-file-content')!;
  const stageHandler = handlers.get('changes:stage-file')!;
  const discardHandler = handlers.get('changes:discard-file')!;

  assert(getListHandler !== undefined, 'changes:get-list handler registered');
  assert(getContentHandler !== undefined, 'changes:get-file-content handler registered');
  assert(stageHandler !== undefined, 'changes:stage-file handler registered');
  assert(discardHandler !== undefined, 'changes:discard-file handler registered');

  const workspaceRoot = process.cwd();
  secureStore.setActiveWorkspacePath(workspaceRoot);

  // Clear states
  PendingModificationsService.clear();
  SessionChangesTrackerService.clear();

  // Test 1: Fetch empty pending list
  let list = await getListHandler(null, 'pending');
  assertEqual(list.length, 0, 'getList returns empty array when no changes exist');

  // Test 2: Fetch list with pending AI modifications
  PendingModificationsService.setPending(101, {
    taskId: 101,
    modifications: [
      {
        relativePath: 'src/components/TopBar.tsx',
        absolutePath: path.resolve(workspaceRoot, 'src/components/TopBar.tsx'),
        originalContent: 'old TopBar content',
        proposedContent: 'new TopBar content',
        addedLines: 5,
        removedLines: 2,
        patches: [],
      }
    ],
    createdAt: Date.now()
  });

  list = await getListHandler(null, 'pending');
  assertEqual(list.length, 1, 'getList returns 1 pending AI change');
  assertEqual(list[0].relativePath, 'src/components/TopBar.tsx', 'correct relativePath returned');
  assertEqual(list[0].status, 'pending', 'correct status returned');
  assertEqual(list[0].taskId, 101, 'correct taskId returned');

  // Test 3: Get content for pending file
  let content = await getContentHandler(null, 'src/components/TopBar.tsx', 'pending', 101);
  assertEqual(content.originalContent, 'old TopBar content', 'original content returned correctly');
  assertEqual(content.proposedContent, 'new TopBar content', 'proposed content returned correctly');

  // Test 4: Stage a pending file in non-Git workspace
  // Use OS temp dir which is not a git repository
  const tempNonGitWorkspace = os.tmpdir();
  secureStore.setActiveWorkspacePath(tempNonGitWorkspace);

  const testFileRelative = 'changes_test_file.txt';
  const testFileAbsolute = path.resolve(tempNonGitWorkspace, testFileRelative);

  PendingModificationsService.setPending(103, {
    taskId: 103,
    modifications: [
      {
        relativePath: testFileRelative,
        absolutePath: testFileAbsolute,
        originalContent: 'hello',
        proposedContent: 'hello world',
        addedLines: 1,
        removedLines: 1,
        patches: [],
      }
    ],
    createdAt: Date.now()
  });

  // Stage pending file
  await stageHandler(null, testFileRelative, 'pending', 103);
  assertEqual(SessionChangesTrackerService.getAccepted().length, 1, 'File tracked in SessionChangesTrackerService in non-Git workspace');
  assertEqual(SessionChangesTrackerService.getAccepted()[0], testFileAbsolute, 'correct absolute path tracked');

  // Verify file was written to disk
  try {
    const fileContent = fs.readFileSync(testFileAbsolute, 'utf-8');
    assertEqual(fileContent, 'hello world', 'Proposed content successfully written to disk');
    fs.unlinkSync(testFileAbsolute); // Clean up
  } catch (e) {
    console.error('Failed to read/unlink changes test file:', e);
    failed++;
  }

  // Summary
  console.log(`\n--- CHANGES HANDLERS RESULTS: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
