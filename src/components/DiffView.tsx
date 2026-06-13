import { DiffEditor } from '@monaco-editor/react';
import { OpenFile } from '../types/appTypes';
import { getFileSettings } from '../helpers/appFile';

interface DiffViewProps {
  activeFile: OpenFile;
  appTheme: 'light' | 'dark';
  appFontSize: number;
  onAcceptDiff: (diffFile: OpenFile) => void;
  onRejectDiff: (diffFile: OpenFile) => void;
}

export function DiffView({ activeFile, appTheme, appFontSize, onAcceptDiff, onRejectDiff }: DiffViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-secondary)' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        background: 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="codicon codicon-diff" style={{ color: 'var(--accent-primary)', fontSize: 16 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Comparing Changes: {activeFile.name.replace('Diff: ', '')}</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>({activeFile.path.substring(7)})</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => onRejectDiff(activeFile)}
            style={{
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.2)',
              color: '#f43f5e',
              padding: '4px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(244, 63, 94, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(244, 63, 94, 0.1)'}
          >
            <span className="codicon codicon-close" style={{ fontSize: 12 }} /> Discard
          </button>
          <button
            onClick={() => onAcceptDiff(activeFile)}
            style={{
              background: 'rgba(52, 211, 153, 0.15)',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              color: '#34d399',
              padding: '4px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(52, 211, 153, 0.25)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(52, 211, 153, 0.15)'}
          >
            <span className="codicon codicon-check" style={{ fontSize: 12 }} /> Accept Changes
          </button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <DiffEditor
          height="100%"
          language={getFileSettings(activeFile.name.replace('Diff: ', '')).language}
          original={activeFile.originalContent || ''}
          modified={activeFile.content}
          theme={appTheme === 'light' ? 'light' : 'vs-dark'}
          options={{
            readOnly: true,
            fontSize: appFontSize,
            renderSideBySide: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true
          }}
        />
      </div>
    </div>
  );
}
