import * as fs from 'fs';
import * as path from 'path';
import { PathGuard } from './PathGuard';

function resolvePath(filePath: string, workspacePath: string): string | null {
  const root = path.resolve(workspacePath);
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
  const normRoot = root.toLowerCase();
  const normResolved = resolvedPath.toLowerCase();
  const relative = path.relative(normRoot, normResolved);
  const contained = relative === '' || (relative && !relative.startsWith('..') && !path.isAbsolute(relative));
  return contained ? resolvedPath : null;
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
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(absPath, content, 'utf-8');
    const lines = content.split('\n').length;
    return `Successfully wrote ${filePath} (${lines} lines, ${content.length} bytes)`;
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
    const diff = content.split('\n').length - newContent.split('\n').length;
    const diffStr = diff > 0 ? `removed ${diff} lines` : diff < 0 ? `added ${Math.abs(diff)} lines` : 'no line count change';
    return `Successfully edited ${filePath} (${diffStr})`;
  } catch (err: any) {
    return `Error editing file: ${err.message}`;
  }
}

export function getWorkspacePath(): string {
  return PathGuard.getWorkspacePath() || '';
}
