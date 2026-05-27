import { useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Monaco-vim types
declare function initVimMode(
  editor: monaco.editor.IStandaloneCodeEditor,
  statusBarElement: HTMLElement
): { dispose: () => void };

interface CodeEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  language?: string;
  vimEnabled?: boolean;
}

export function CodeEditor({
  value,
  onChange,
  language = 'typescript',
  vimEnabled = true,
  options = {}
}: CodeEditorProps & { options?: monaco.editor.IStandaloneEditorConstructionOptions & { theme?: string } }) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const vimModeRef = useRef<{ dispose: () => void } | null>(null);
  const statusBarRef = useRef<HTMLDivElement>(null);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;

    // Focus the editor
    editor.focus();

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
