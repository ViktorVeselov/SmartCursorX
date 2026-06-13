import { getLanguageFromExtension } from '../helpers/appFile';

interface NewFileDialogProps {
  isOpen: boolean;
  fileName: string;
  onFileNameChange: (name: string) => void;
  previewPath: string;
  onConfirm: () => void;
  onClose: () => void;
  onCopyPath: (path: string) => void;
}

export function NewFileDialog({ isOpen, fileName, onFileNameChange, previewPath, onConfirm, onClose, onCopyPath }: NewFileDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="new-file-dialog" onClick={e => e.stopPropagation()}>
        <h3>New File</h3>
        <div className="directory-hint" style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
          <div style={{ marginBottom: 4 }}>Creating in:</div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(0,0,0,0.2)',
            padding: '6px 8px',
            borderRadius: 4,
            overflow: 'hidden'
          }}>
            <span style={{
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1
            }}>
              {previewPath || '...'}
            </span>
            <button
              onClick={() => onCopyPath(previewPath)}
              title="Copy full path"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <span className="codicon codicon-copy" />
            </button>
          </div>
        </div>
        <input
          type="text"
          placeholder="filename.ts"
          value={fileName}
          onChange={e => onFileNameChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') onConfirm();
            if (e.key === 'Escape') onClose();
          }}
          autoFocus
        />
        <div className="language-hint">
          Language: {getLanguageFromExtension(fileName || 'file.txt')}
        </div>
        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={onConfirm}>Create</button>
        </div>
      </div>
    </div>
  );
}
