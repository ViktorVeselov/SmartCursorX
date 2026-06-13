import { OpenFile } from '../types/appTypes';

export function openDiffFile(
  filePath: string,
  originalContent: string,
  proposedContent: string,
  setFiles: React.Dispatch<React.SetStateAction<OpenFile[]>>,
  setActiveFilePath: React.Dispatch<React.SetStateAction<string>>
) {
  const diffPath = `diff://${filePath}`;
  const name = filePath.split(/[/\\]/).pop() || filePath;
  setFiles(prev => {
    if (prev.find(f => f.path === diffPath)) return prev;
    return [...prev, {
      path: diffPath,
      name: `Diff: ${name}`,
      content: proposedContent,
      originalContent,
      type: 'diff',
      isDirty: false
    }];
  });
  setActiveFilePath(diffPath);
}

export async function acceptDiffFile(
  diffFile: OpenFile,
  setFiles: React.Dispatch<React.SetStateAction<OpenFile[]>>,
  setActiveFilePath: React.Dispatch<React.SetStateAction<string>>,
  showNotification: (msg: string) => void
) {
  const actualPath = diffFile.path.substring(7);
  try {
    await window.ipcRenderer.invoke('write-file', actualPath, diffFile.content);
    setFiles(prev => {
      const filtered = prev.filter(f => f.path !== diffFile.path);
      const updated = filtered.map(f =>
        f.path === actualPath ? { ...f, content: diffFile.content, isDirty: false } : f
      );
      setActiveFilePath(prevActive => prevActive === diffFile.path ? actualPath : prevActive);
      return updated;
    });
    showNotification(`Accepted changes for ${diffFile.name.replace('Diff: ', '')}`);
    window.dispatchEvent(new CustomEvent('proposal-status-changed', {
      detail: { filePath: actualPath, status: 'accepted' }
    }));
  } catch (err) {
    console.error('Failed to accept changes:', err);
    alert('Failed to save changes to disk');
  }
}

export function rejectDiffFile(
  diffFile: OpenFile,
  setFiles: React.Dispatch<React.SetStateAction<OpenFile[]>>,
  setActiveFilePath: React.Dispatch<React.SetStateAction<string>>,
  showNotification: (msg: string) => void
) {
  const actualPath = diffFile.path.substring(7);
  setFiles(prev => {
    const filtered = prev.filter(f => f.path !== diffFile.path);
    setActiveFilePath(prevActive => prevActive === diffFile.path
      ? (filtered.length > 0 ? filtered[filtered.length - 1].path : '')
      : prevActive
    );
    return filtered;
  });
  showNotification(`Rejected changes for ${diffFile.name.replace('Diff: ', '')}`);
  window.dispatchEvent(new CustomEvent('proposal-status-changed', {
    detail: { filePath: actualPath, status: 'rejected' }
  }));
}

export async function acceptFileProposal(
  filePath: string,
  proposedContent: string,
  setFiles: React.Dispatch<React.SetStateAction<OpenFile[]>>,
  setActiveFilePath: React.Dispatch<React.SetStateAction<string>>,
  showNotification: (msg: string) => void
) {
  try {
    await window.ipcRenderer.invoke('write-file', filePath, proposedContent);
    setFiles(prev => {
      const diffPath = `diff://${filePath}`;
      const filtered = prev.filter(f => f.path !== diffPath);
      const updated = filtered.map(f =>
        f.path === filePath ? { ...f, content: proposedContent, isDirty: false } : f
      );
      setActiveFilePath(prevActive => prevActive === diffPath ? filePath : prevActive);
      return updated;
    });
    showNotification(`Accepted proposed changes for ${filePath.split(/[/\\]/).pop()}`);
    window.dispatchEvent(new CustomEvent('proposal-status-changed', {
      detail: { filePath, status: 'accepted' }
    }));
  } catch (err) {
    console.error('Failed to accept proposal:', err);
  }
}

export function rejectFileProposal(
  filePath: string,
  setFiles: React.Dispatch<React.SetStateAction<OpenFile[]>>,
  setActiveFilePath: React.Dispatch<React.SetStateAction<string>>,
  showNotification: (msg: string) => void
) {
  const diffPath = `diff://${filePath}`;
  setFiles(prev => {
    const filtered = prev.filter(f => f.path !== diffPath);
    setActiveFilePath(prevActive => prevActive === diffPath
      ? (filtered.length > 0 ? filtered[filtered.length - 1].path : '')
      : prevActive
    );
    return filtered;
  });
  showNotification(`Rejected proposed changes for ${filePath.split(/[/\\]/).pop()}`);
  window.dispatchEvent(new CustomEvent('proposal-status-changed', {
    detail: { filePath, status: 'rejected' }
  }));
}
