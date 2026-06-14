// tests/unit/pathGuard/runTests.ts
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

// tests/unit/pathGuard/runTests.ts
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
async function run() {
  console.log("--- PATHGUARD UNIT TESTS ---");
  const workspaceRoot = process.cwd();
  assertEqual(PathGuard.getWorkspacePath(), null, "getWorkspacePath returns null before configure");
  assertEqual(PathGuard.resolve("some/file.ts"), null, "resolve returns null before configure");
  assertEqual(PathGuard.isContained("C:\\any\\path.ts"), false, "isContained returns false before configure");
  PathGuard.configure(workspaceRoot);
  assertEqual(PathGuard.getWorkspacePath(), path2.resolve(workspaceRoot), "getWorkspacePath returns configured root");
  const resolved = PathGuard.resolve("package.json");
  const expected = path2.join(workspaceRoot, "package.json");
  assertEqual(resolved, expected, "resolve relative path within root");
  const nestedResolved = PathGuard.resolve("src/App.tsx");
  const nestedExpected = path2.join(workspaceRoot, "src/App.tsx");
  assertEqual(nestedResolved, nestedExpected, "resolve nested relative path");
  const absResolved = PathGuard.resolve(nestedExpected);
  assertEqual(absResolved, nestedExpected, "resolve absolute path within root");
  const traversalResolved = PathGuard.resolve("..\\..\\Windows\\system32\\config");
  assertEqual(traversalResolved, null, "resolve path with dot-dot traversal returns null");
  let outsidePath;
  if (process.platform === "win32") {
    outsidePath = "C:\\Windows\\system32\\config";
  } else {
    outsidePath = "/etc/passwd";
  }
  assertEqual(PathGuard.resolve(outsidePath), null, "resolve absolute path outside root returns null");
  assertEqual(PathGuard.isContained(nestedExpected), true, "isContained returns true for path within root");
  assertEqual(PathGuard.isContained(outsidePath), false, "isContained returns false for path outside root");
  const tmpRoot = path2.resolve(workspaceRoot, "..", "tmp_test_extra_root");
  if (process.platform === "win32") {
    PathGuard.registerRoot("C:\\tmp_test_extra_root");
  } else {
    PathGuard.registerRoot("/tmp_test_extra_root");
  }
  const extraRootPath = process.platform === "win32" ? "C:\\tmp_test_extra_root\\some_file.txt" : "/tmp_test_extra_root/some_file.txt";
  assertEqual(PathGuard.resolve(extraRootPath), extraRootPath, "resolve absolute path within extra root");
  assertEqual(PathGuard.isContained(extraRootPath), true, "isContained returns true for path within extra root");
  assertEqual(PathGuard.resolve(""), workspaceRoot, "resolve empty string returns root path");
  assertEqual(PathGuard.isContained(workspaceRoot), true, "isContained returns true for root itself");
  const withTrailingSlash = path2.join(workspaceRoot, "src") + path2.sep;
  assertEqual(PathGuard.isContained(withTrailingSlash), true, "isContained returns true for path with trailing separator");
  if (process.platform === "win32") {
    const result = PathGuard.isContained(workspaceRoot.toUpperCase() + "\\SRC\\APP.TSX");
    assertEqual(result, true, "isContained is case-insensitive on Windows");
  }
  const withinRootTraversal = path2.join(workspaceRoot, "src", "..", "package.json");
  const resolvedWithin = PathGuard.resolve(withinRootTraversal);
  const expectedPkg = path2.join(workspaceRoot, "package.json");
  assertEqual(resolvedWithin, expectedPkg, "resolve dot-dot within root resolves correctly");
  const newRoot = path2.resolve(workspaceRoot, "tests");
  PathGuard.configure(newRoot);
  assertEqual(PathGuard.getWorkspacePath(), path2.resolve(newRoot), "reconfigure updates workspace path");
  assertEqual(PathGuard.isContained(nestedExpected), false, "after reconfigure old path is no longer contained");
  PathGuard.configure(workspaceRoot);
  console.log(`
--- RESULTS: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
}
run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
