// tests/unit/ipcSecurity/runTests.ts
import * as path2 from "path";

// electron/services/PathGuard.ts
import * as path from "path";
var PathGuard = class {
  static workspacePath = null;
  static extraRoots = [];
  static configure(workspacePath) {
    this.workspacePath = path.resolve(workspacePath);
    this.extraRoots = [];
  }
  static getWorkspacePath() {
    return this.workspacePath;
  }
  static registerRoot(root) {
    this.extraRoots.push(path.resolve(root));
  }
  static resolve(relativePath) {
    if (!this.workspacePath) return null;
    const roots = [this.workspacePath, ...this.extraRoots];
    for (const root of roots) {
      const resolvedPath = path.isAbsolute(relativePath) ? relativePath : path.resolve(root, relativePath);
      const normRoot = this.normalize(root);
      const normResolved = this.normalize(resolvedPath);
      const relative2 = path.relative(normRoot, normResolved);
      const contained = relative2 === "" || relative2 && !relative2.startsWith("..") && !path.isAbsolute(relative2);
      if (contained) {
        return resolvedPath;
      }
    }
    return null;
  }
  static isContained(absolutePath) {
    return this.resolve(absolutePath) !== null;
  }
  static setWorkspacePath(workspacePath) {
    this.configure(workspacePath);
  }
  static normalize(p) {
    let resolved = path.resolve(p);
    if (process.platform === "win32") {
      resolved = resolved.toLowerCase();
    }
    return resolved;
  }
};

// tests/unit/ipcSecurity/runTests.ts
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
function assertThrows(fn, expectedMsg, testName) {
  try {
    fn();
    console.error(`FAIL: ${testName} \u2014 expected error but none thrown`);
    failed++;
  } catch (err) {
    if (err.message && err.message.includes(expectedMsg)) {
      console.log(`PASS: ${testName}`);
      passed++;
    } else {
      console.error(`FAIL: ${testName} \u2014 expected "${expectedMsg}" but got "${err.message}"`);
      failed++;
    }
  }
}
async function run() {
  console.log("--- IPC HANDLER SECURITY TESTS ---");
  const workspaceRoot = process.cwd();
  PathGuard.configure(workspaceRoot);
  const outsidePath = process.platform === "win32" ? "C:\\Windows\\system32\\config\\SAM" : "/etc/shadow";
  const safePath = path2.join(workspaceRoot, "package.json");
  function simulateReadFile(filePath) {
    if (typeof filePath !== "string") throw new Error("Invalid path argument");
    if (!PathGuard.isContained(filePath)) {
      throw new Error(`Security: Read of "${filePath}" is outside the workspace root`);
    }
    return "ok";
  }
  function simulateWriteFile(filePath) {
    if (typeof filePath !== "string" || !filePath.trim()) throw new Error("Invalid file path");
    if (!PathGuard.isContained(filePath)) {
      throw new Error(`Security: Write to "${filePath}" is outside the workspace root`);
    }
    return "ok";
  }
  function simulateDeletePath(targetPath) {
    if (typeof targetPath !== "string") throw new Error("Invalid path argument");
    if (!PathGuard.isContained(targetPath)) {
      throw new Error(`Security: Delete of "${targetPath}" is outside the workspace root`);
    }
    return "ok";
  }
  function simulateRenamePath(oldPath, newPath) {
    if (typeof oldPath !== "string" || typeof newPath !== "string") throw new Error("Invalid path arguments");
    if (!PathGuard.isContained(oldPath)) {
      throw new Error(`Security: Rename source "${oldPath}" is outside the workspace root`);
    }
    if (!PathGuard.isContained(newPath)) {
      throw new Error(`Security: Rename target "${newPath}" is outside the workspace root`);
    }
    return "ok";
  }
  function simulateCreateDirectory(dirPath) {
    if (typeof dirPath !== "string") throw new Error("Invalid path argument");
    if (!PathGuard.isContained(dirPath)) {
      throw new Error(`Security: Create directory "${dirPath}" is outside the workspace root`);
    }
    return "ok";
  }
  function simulateReadDir(dirPath) {
    if (typeof dirPath !== "string") throw new Error("Invalid path argument");
    if (!PathGuard.isContained(dirPath)) {
      throw new Error(`Security: Read directory "${dirPath}" is outside the workspace root`);
    }
    return "ok";
  }
  assertEqual(simulateReadFile(safePath), "ok", "read-file: allows path within root");
  assertThrows(() => simulateReadFile(outsidePath), "Security: Read of", "read-file: rejects path outside root");
  assertThrows(() => simulateReadFile(42), "Invalid path argument", "read-file: rejects non-string path");
  assertEqual(simulateWriteFile(safePath), "ok", "write-file: allows path within root");
  assertThrows(() => simulateWriteFile(outsidePath), "Security: Write to", "write-file: rejects path outside root");
  assertThrows(() => simulateWriteFile(""), "Invalid file path", "write-file: rejects empty path");
  assertThrows(() => simulateWriteFile("   "), "Invalid file path", "write-file: rejects whitespace-only path");
  assertEqual(simulateDeletePath(safePath), "ok", "delete-path: allows path within root");
  assertThrows(() => simulateDeletePath(outsidePath), "Security: Delete of", "delete-path: rejects path outside root");
  assertThrows(() => simulateDeletePath(123), "Invalid path argument", "delete-path: rejects non-string path");
  assertEqual(simulateRenamePath(safePath, path2.join(workspaceRoot, "renamed.json")), "ok", "rename-path: allows both paths within root");
  assertThrows(() => simulateRenamePath(outsidePath, safePath), "Security: Rename source", "rename-path: rejects source outside root");
  assertThrows(() => simulateRenamePath(safePath, outsidePath), "Security: Rename target", "rename-path: rejects target outside root");
  assertThrows(() => simulateRenamePath(42, safePath), "Invalid path arguments", "rename-path: rejects non-string source");
  assertThrows(() => simulateRenamePath(safePath, void 0), "Invalid path arguments", "rename-path: rejects undefined target");
  assertEqual(simulateCreateDirectory(path2.join(workspaceRoot, "newDir")), "ok", "create-directory: allows path within root");
  assertThrows(() => simulateCreateDirectory(outsidePath), "Security: Create directory", "create-directory: rejects path outside root");
  assertThrows(() => simulateCreateDirectory(void 0), "Invalid path argument", "create-directory: rejects undefined path");
  assertEqual(simulateReadDir(workspaceRoot), "ok", "read-dir: allows path within root");
  assertThrows(() => simulateReadDir(outsidePath), "Security: Read directory", "read-dir: rejects path outside root");
  assertThrows(() => simulateReadDir(null), "Invalid path argument", "read-dir: rejects null path");
  const fakeContained = path2.join(workspaceRoot, "..", "..", "tmp", "safe");
  assertThrows(() => simulateReadFile(fakeContained), "Security: Read of", "read-file: rejects path that uses .. to escape");
  if (process.platform === "win32") {
    const upperCaseRoot = workspaceRoot.toUpperCase();
    const upperCasePath = path2.join(upperCaseRoot, "PACKAGE.JSON");
    assertEqual(simulateReadFile(upperCasePath), "ok", "read-file: case-insensitive on Windows");
  }
  console.log(`
--- IPC SECURITY RESULTS: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
}
run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
