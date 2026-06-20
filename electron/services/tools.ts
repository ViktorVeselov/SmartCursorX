import * as fs from 'fs';
import * as path from 'path';
import { PathGuard } from './PathGuard';
import { SessionChangesTrackerService } from './SessionChangesTrackerService';

import { native } from '../native-loader';

function resolvePath(filePath: string, workspacePath: string): string | null {
  const root = path.resolve(workspacePath);
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
  const normRoot = root.toLowerCase();
  const normResolved = resolvedPath.toLowerCase();
  const relative = path.relative(normRoot, normResolved);
  const contained = relative === '' || (relative && !relative.startsWith('..') && !path.isAbsolute(relative));
  return contained ? resolvedPath : null;
}

export interface SearchMatch {
  filePath: string;
  lineNumber: number;
  column: number;
  lineContent: string;
  matchText: string;
}

function globToRegexPattern(pattern: string): string {
  const normalized = pattern.replace(/\\/g, '/');
  let rxStr = normalized.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  rxStr = rxStr
    .replace(/\*\*/g, '___DOUBLE_STAR___')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/___DOUBLE_STAR___\//g, '(?:.*/)?')
    .replace(/___DOUBLE_STAR___/g, '.*');
  return `^${rxStr}$`;
}

export async function executeListFiles(workspacePath: string, pattern: string = '**/*'): Promise<string[]> {
  try {
    if (!fs.existsSync(workspacePath)) {
      return [`Error: Workspace path does not exist: ${workspacePath}`];
    }
    const regexPattern = globToRegexPattern(pattern);
    if (!native) return [`Error: Native module not loaded`]
    const results = await native.searchFileNames(regexPattern, workspacePath, false); // respectGitignore = false
    return results;
  } catch (err: any) {
    return [`Error listing files: ${err.message}`];
  }
}

export async function executeGrep(workspacePath: string, pattern: string, includeExtensions?: string[]): Promise<SearchMatch[]> {
  try {
    if (!fs.existsSync(workspacePath)) {
      return [{ filePath: '', lineNumber: 0, column: 0, lineContent: `Error: Workspace path does not exist: ${workspacePath}`, matchText: '' }];
    }
    const options = {
      pattern,
      rootPath: workspacePath,
      ignoreCase: false,
      literal: false,
      maxResults: 100,
      includeExtensions,
      respectGitignore: false,
    };
    if (!native) return [{ filePath: '', lineNumber: 0, column: 0, lineContent: `Error: Native module not loaded`, matchText: '' }]
    const results = await native.searchFiles(options);
    return results;
  } catch (err: any) {
    return [{ filePath: '', lineNumber: 0, column: 0, lineContent: `Error searching: ${err.message}`, matchText: '' }];
  }
}

export function executeReadFile(filePath: string, workspacePath: string): string {
  const absPath = resolvePath(filePath, workspacePath);
  if (!absPath || !fs.existsSync(absPath)) {
    return `Error: File not found or out of bounds: ${filePath}`;
  }
  try {
    const content = fs.readFileSync(absPath, 'utf-8');
    return content.length > 8000 ? content.substring(0, 8000) + '\n... [TRUNCATED] ...' : content;
  } catch (err: any) {
    return `Error reading file: ${err.message}`;
  }
}

export function executeWriteFile(filePath: string, content: string, workspacePath: string): string {
  const absPath = resolvePath(filePath, workspacePath);
  if (!absPath) return `Error: Path out of bounds: ${filePath}`;
  try {
    const dir = path.dirname(absPath);
    const original = fs.existsSync(absPath) ? fs.readFileSync(absPath, 'utf-8') : '';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(absPath, content, 'utf-8');
    SessionChangesTrackerService.trackAccepted(absPath, original);
    const lines = content.split('\n').length;
    return `Successfully wrote ${filePath} (+${lines}/-0, ${content.length}b)`;
  } catch (err: any) {
    return `Error writing file: ${err.message}`;
  }
}

export function executeEditFile(filePath: string, find: string, replace: string, workspacePath: string): string {
  const absPath = resolvePath(filePath, workspacePath);
  if (!absPath) return `Error: Path out of bounds: ${filePath}`;
  try {
    if (!fs.existsSync(absPath)) return `Error: File not found: ${filePath}. Use write_file to create it first.`;
    const content = fs.readFileSync(absPath, 'utf-8');
    if (!content.includes(find)) {
      return `Error: Could not find exact match "${find.substring(0, 80)}${find.length > 80 ? '...' : ''}" in ${filePath}. The text must match exactly including whitespace.`;
    }
    const newContent = content.replace(find, replace);
    fs.writeFileSync(absPath, newContent, 'utf-8');
    SessionChangesTrackerService.trackAccepted(absPath, content);
    const oldLines = content.split('\n').length;
    const newLines = newContent.split('\n').length;
    return `Successfully edited ${filePath} (+${newLines > oldLines ? newLines - oldLines : 0}/-${oldLines > newLines ? oldLines - newLines : 0})`;
  } catch (err: any) {
    return `Error editing file: ${err.message}`;
  }
}

export function getWorkspacePath(): string {
  return PathGuard.getWorkspacePath() || '';
}
