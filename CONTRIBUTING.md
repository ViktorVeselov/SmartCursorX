# Contributing to SmartCursorX (cursor-replacer)

Thank you for your interest in contributing to SmartCursorX! This guide outlines the workflow, testing practices, and guidelines to ensure smooth integration of your changes.

---

## Table of Contents

1. [Understanding the Context of Changes](#1-understanding-the-context-of-changes)
2. [Development Setup](#2-development-setup)
3. [Testing Guidelines & How to Test](#3-testing-guidelines--how-to-test)
4. [Logs & Debugging](#4-logs--debugging)
5. [Pull Request Requirements](#5-pull-request-requirements)

---

## 1. Understanding the Context of Changes

Before making any code changes, please make sure there is a clear purpose for your contribution:

* **Associated Issues or Discussions:** All non-trivial pull requests must link to an existing open **Issue** or **Discussion** detailing the problem or feature request. If one does not exist, please open a new Issue or Discussion first to align with maintainers.
* **Scope of Changes:** Keep your pull requests focused on a single concern. If you are fixing a bug and also refactoring an unrelated component, split them into two separate pull requests.

---

## 2. Development Setup

To set up the development environment locally:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ViktorVeselov/SmartCursorX.git
   cd SmartCursorX/cursor-replacer
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the Native Rust Modules:**
   The project uses a native performance layer written in Rust (`napi-rs`). Build the Rust target:
   ```bash
   npm run build:native
   ```

4. **Run the application in Development Mode:**
   ```bash
   npm run dev
   ```

---

## 3. Testing Guidelines & How to Test

Every contribution must be verified to ensure it behaves correctly and does not introduce regressions.

### Manual End-to-End (E2E) Testing
Currently, the prototype relies on manual validation of Electron features. When verifying your changes:
* **UI Features:** Interact with the React frontend panel (e.g., Chat panel, Monaco editor, settings modal) and verify the visual layout and user interactions.
* **IPC IPC Bridges / Main Process:** Verify that the Electron Main Process triggers correct handlers, files are read/written successfully, and configurations are correctly stored.

### Native Module Tests
If you modify the Rust layer (`native/`), run the verification test:
```bash
node native/verify-test.js
```
Make sure it prints `Verification PASSED ✅`.

---

## 4. Logs & Debugging

To track errors, observe behaviors, or collect debug info:

### Frontend Renderer Logs
Open the Chromium Developer Tools within the running Electron application:
* Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS).
* Check the **Console** tab for React, Monaco Editor, and IPC listener logs.

### Backend Main Process Logs
Logs generated in the Electron Main process (e.g. SQLite database operations, secure credentials store actions, shell execution loops) will be output directly to the terminal from which you ran `npm run dev`.

---

## 5. Pull Request Requirements

When submitting a Pull Request, you must complete the pull request template covering:

1. **Aim / Description:** What does this PR do? What issues or discussions does it resolve?
2. **How to Test:** Clear step-by-step instructions on how the reviewer can manually reproduce and verify your change.
3. **Verification Evidence (Logs & Screenshots):** 
   * **UI Changes:** Attach screenshots or screen recordings showing the new visual state/behavior.
   * **Logic / API Changes:** Attach relevant logs or console outputs demonstrating successful runs.
