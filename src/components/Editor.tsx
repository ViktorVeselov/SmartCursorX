import { useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { assertNonNull } from '../helpers/invariant';

interface CodeEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  language?: string;
  vimEnabled?: boolean;
  targetLine?: { line: number; timestamp: number } | null;
  highlightActive?: boolean;
}

export function CodeEditor({
  value,
  onChange,
  language = 'typescript',
  vimEnabled = true,
  targetLine = null,
  highlightActive = false,
  options = {}
}: CodeEditorProps & { options?: monaco.editor.IStandaloneEditorConstructionOptions & { theme?: string } }) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const vimModeRef = useRef<{ dispose: () => void } | null>(null);
  const statusBarRef = useRef<HTMLDivElement>(null);
  const decorationsRef = useRef<string[]>([]);

  // Jump to specific line when targetLine is updated
  useEffect(() => {
    if (editorRef.current && targetLine) {
      const editor = editorRef.current;
      editor.revealLineInCenter(targetLine.line);
      editor.setPosition({ lineNumber: targetLine.line, column: 1 });
      editor.focus();

      // Apply line highlight decoration
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
        {
          range: new monaco.Range(targetLine.line, 1, targetLine.line, 1),
          options: {
            isWholeLine: true,
            className: 'line-highlight-decoration'
          }
        }
      ]);

      // If highlightActive is FALSE, clear it after 2 seconds.
      // Otherwise, do not clear it (it will stay until highlightActive becomes false).
      if (!highlightActive) {
        const timer = setTimeout(() => {
          if (editorRef.current) {
            decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
          }
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [targetLine, highlightActive]);

  // Handle clearing decorations when search is cleared (highlightActive becomes false)
  useEffect(() => {
    if (!highlightActive && decorationsRef.current.length > 0 && editorRef.current) {
      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
    }
  }, [highlightActive]);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
    assertNonNull(editor, 'editor in handleEditorMount');

    // Focus the editor
    editor.focus();

    if (targetLine) {
      setTimeout(() => {
        editor.revealLineInCenter(targetLine.line);
        editor.setPosition({ lineNumber: targetLine.line, column: 1 });

        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
          {
            range: new monaco.Range(targetLine.line, 1, targetLine.line, 1),
            options: {
              isWholeLine: true,
              className: 'line-highlight-decoration'
            }
          }
        ]);

        if (!highlightActive) {
          setTimeout(() => {
            if (editorRef.current) {
              decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
            }
          }, 2000);
        }
      }, 100);
    }

    // Initialize Vim mode if enabled
    if (vimEnabled && statusBarRef.current) {
      import('monaco-vim').then((vimModule) => {
        if (editorRef.current && statusBarRef.current) {
          vimModeRef.current = vimModule.initVimMode(
            editorRef.current,
            statusBarRef.current
          );
        }
      });
    }
  };

  // Cleanup Vim mode on unmount or when disabled
  useEffect(() => {
    return () => {
      if (vimModeRef.current) {
        vimModeRef.current.dispose();
      }
    };
  }, []);

  // Toggle Vim mode
  useEffect(() => {
    if (!editorRef.current || !statusBarRef.current) return;

    if (vimEnabled && !vimModeRef.current) {
      import('monaco-vim').then((vimModule) => {
        if (editorRef.current && statusBarRef.current) {
          vimModeRef.current = vimModule.initVimMode(
            editorRef.current,
            statusBarRef.current
          );
        }
      });
    } else if (!vimEnabled && vimModeRef.current) {
      vimModeRef.current.dispose();
      vimModeRef.current = null;
    }
  }, [vimEnabled]);

  return (
    <div className="editor-container">
      <Editor
        height="calc(100% - 24px)"
        language={language}
        value={value}
        onChange={onChange}
        onMount={handleEditorMount}
        theme={options.theme || 'vs-dark'}
        options={{
          readOnly: false,
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          padding: { top: 16 },
          ...options
        }}
      />
      {vimEnabled && (
        <div
          ref={statusBarRef}
          className="vim-status-bar"
        />
      )}
    </div>
  );
}
