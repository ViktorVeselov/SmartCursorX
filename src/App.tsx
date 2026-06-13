import { useState, useEffect, useRef } from 'react';
// Custom implementation to avoid build errors with 'react-resizable-panels'
import { ChatPanel, AppAgent, AppFlow, AppExecutionContext } from './components/ChatPanel';
import { ErrorBoundary } from './ErrorBoundary';
import { TerminalBar } from './components/TerminalBar';
import { Sidebar } from './components/Sidebar';
import { SearchPanel } from './components/SearchPanel';
import { TopBar } from './components/TopBar';
import { StatusBar } from './components/StatusBar';
import { ActivityBar } from './components/ActivityBar';
import { SettingsModal } from './components/SettingsModal';
import './styles/theme.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/animations.css';

import { ActiveFileEditor } from './components/ActiveFileEditor';
import { NewFileDialog } from './components/NewFileDialog';
import { NotificationToast } from './components/NotificationToast';
import { isBinaryFile } from './utils/fileTypes';

import { OpenFile } from './types/appTypes';

import { openDiffFile, acceptDiffFile, rejectDiffFile, acceptFileProposal, rejectFileProposal } from './helpers/appDiff';
import { useKeyboardShortcuts, useResizeHandlers } from './helpers/appKeyboard';
import { checkArgs, assert, assertNonNull } from './helpers/invariant';

function App() {
  const [files, setFiles] = useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState('');
  const [vimEnabled, setVimEnabled] = useState(true);
  const [rootPath, setRootPath] = useState('');

  // Panel states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [terminalHeight, setTerminalHeight] = useState(200);

  // Resize refs
  const sidebarResizing = useRef(false);
  const terminalResizing = useRef(false);

  // Feature states
  const [activeSection, setActiveSection] = useState('explorer');
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [executionContext, setExecutionContext] = useState<AppExecutionContext | null>(null);
  const [settingsSavedTrigger, setSettingsSavedTrigger] = useState(0);

  // General Dynamic configurations
  const [appTheme, setAppTheme] = useState<'light' | 'dark'>('dark');
  const [appFontSize, setAppFontSize] = useState(14);

  const loadAppSettings = async () => {
    try {
      const settings = await window.ipcRenderer.invoke('get-general-settings');
      if (settings) {
        if (settings.theme) {
          setAppTheme(settings.theme);
          document.documentElement.setAttribute('data-theme', settings.theme);
        }
        if (settings.fontSize) {
          setAppFontSize(settings.fontSize);
          document.documentElement.style.setProperty('--editor-font-size', `${settings.fontSize}px`);
        }
        if (settings.activeWorkspacePath) {
          setRootPath(settings.activeWorkspacePath);
        }
      }
    } catch (err) {
      console.error('Failed to load general settings:', err);
    }
  };

  const handleOpenDiff = (filePath: string, originalContent: string, proposedContent: string) =>
    openDiffFile(filePath, originalContent, proposedContent, setFiles, setActiveFilePath);

  const handleAcceptDiff = (diffFile: OpenFile) =>
    acceptDiffFile(diffFile, setFiles, setActiveFilePath, showNotification);

  const handleRejectDiff = (diffFile: OpenFile) =>
    rejectDiffFile(diffFile, setFiles, setActiveFilePath, showNotification);

  const activeChatTaskIdRef = useRef<number | null>(null);

  useEffect(() => {
    loadAppSettings();
    const isMac = navigator.userAgent.includes('Macintosh');
    if (isMac) {
      document.body.classList.add('platform-mac');
    } else {
      document.body.classList.add('platform-win');
    }

    const handleOpenWorkspaceFile = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const filePath = customEvent.detail.path;
      if (filePath.startsWith('plan://')) {
        const taskIdStr = filePath.substring(7);
        const taskId = parseInt(taskIdStr, 10);
        if (!isNaN(taskId)) {
          handleOpenPlan(taskId, `Task #${taskId}`);
        }
      } else if (filePath.endsWith('implementation_plan.md')) {
        const taskId = activeChatTaskIdRef.current || 1;
        handleOpenPlan(taskId, `Task #${taskId}`);
      } else if (filePath.startsWith('diff://')) {
        const actualPath = filePath.substring(7);
        const proposedContent = customEvent.detail.proposedContent || '';
        try {
          let originalContent = '';
          try {
            originalContent = await window.ipcRenderer.invoke('read-file', actualPath);
          } catch (readErr) {
            originalContent = '';
          }
          handleOpenDiff(actualPath, originalContent, proposedContent);
        } catch (err) {
          console.error('Failed to open diff view:', err);
        }
      } else {
        if (isBinaryFile(filePath)) {
          showNotification(`Cannot read "${filePath.split(/[/\\]/).pop()}" â€” this model does not support image input`);
          return;
        }
        try {
          const line = customEvent.detail.line;
          const content = await window.ipcRenderer.invoke('read-file', filePath);
          handleFileSelectRef.current(content, filePath, line);
        } catch (err) {
          console.error('Failed to open file from link:', err);
        }
      }
    };
    const handleAcceptProposal = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { filePath, proposedContent } = customEvent.detail;
      acceptFileProposal(filePath, proposedContent, setFiles, setActiveFilePath, showNotification);
    };

    const handleRejectProposal = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { filePath } = customEvent.detail;
      rejectFileProposal(filePath, setFiles, setActiveFilePath, showNotification);
    };

    window.addEventListener('open-workspace-file', handleOpenWorkspaceFile);
    window.addEventListener('accept-file-proposal', handleAcceptProposal);
    window.addEventListener('reject-file-proposal', handleRejectProposal);
    return () => {
      window.removeEventListener('open-workspace-file', handleOpenWorkspaceFile);
      window.removeEventListener('accept-file-proposal', handleAcceptProposal);
      window.removeEventListener('reject-file-proposal', handleRejectProposal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunFlow = (agent: AppAgent, flow: AppFlow) => {
    assert(agent !== null && typeof agent === 'object', 'Agent must be an object');
    assert(flow !== null && typeof flow === 'object', 'Flow must be an object');
    setExecutionContext({ agent, flow });
    setChatOpen(true);
  };

  const handleOpenFlow = (flow: Record<string, unknown>) => {
    const flowId = String(flow.id ?? '');
    const flowName = String(flow.name ?? '');
    const flowDescription = String(flow.description ?? '');
    const flowSteps = flow.steps ?? { nodes: [], edges: [] };
    // Check if already open
    const path = `flow://${flowId}`;
    const existing = files.find(f => f.path === path);
    if (existing) {
      setActiveFilePath(path);
      // Update data?
      return;
    }

    const newFile: OpenFile = {
      path,
      name: flowName,
      content: flowDescription,
      type: 'flow',
      flowId: Number(flowId),
      flowData: flowSteps as { nodes: unknown[]; edges: unknown[] },
      isDirty: false
    };
    setFiles([...files, newFile]);
    setActiveFilePath(path);
  };

  const handleOpenPlan = (taskId: number, taskTitle: string) => {
    checkArgs(typeof taskId === 'number' && taskId > 0, 'taskId must be a positive number');
    checkArgs(typeof taskTitle === 'string', 'taskTitle must be a string');
    const path = `plan://${taskId}`;
    const existing = files.find(f => f.path === path);
    if (existing) {
      setActiveFilePath(path);
      return;
    }

    const newFile: OpenFile = {
      path,
      name: `Plan: ${taskTitle}`,
      content: '',
      type: 'plan',
      flowId: taskId,
      isDirty: false
    };
    setFiles([...files, newFile]);
    setActiveFilePath(path);
  };

  const [editorTargetLine, setEditorTargetLine] = useState<{ line: number; timestamp: number } | null>(null);
  const [symbolSearchQuery, setSymbolSearchQuery] = useState('');

  // Derived active file
  const activeFile = files.find(f => f.path === activeFilePath) || files[0];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleFileSelect = (content: string, path: string, line?: number) => {
    checkArgs(typeof path === 'string' && path.length > 0, 'path must be a non-empty string');
    checkArgs(typeof content === 'string', 'content must be a string');
    const existing = files.find(f => f.path === path);
    if (existing) {
      setActiveFilePath(path);
      if (line !== undefined) {
        setEditorTargetLine({ line, timestamp: Date.now() });
      }
      return;
    }

    const newFile: OpenFile = {
      path,
      name: path.split(/[/\\]/).pop() || 'unknown',
      content
    };
    setFiles([...files, newFile]);
    setActiveFilePath(path);
    if (line !== undefined) {
      setEditorTargetLine({ line, timestamp: Date.now() });
    }
  };

  const handleFileSelectRef = useRef(handleFileSelect);
  useEffect(() => {
    handleFileSelectRef.current = handleFileSelect;
  }, [handleFileSelect]);

  // New file dialog state
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileDir, setNewFileDir] = useState<string>(''); // Target directory
  const [notification, setNotification] = useState<string | null>(null);
  const [previewPath, setPreviewPath] = useState('');

  // Update preview path when directory or filename changes
  useEffect(() => {
    if (newFileDialogOpen) {
      // Resolve absolute path
      const currentName = newFileName || '';
      const args = newFileDir ? [newFileDir, currentName] : [currentName];

      // If args are empty strings, resolve-path checks CWD
      // But we want to show '...' if empty filename
      if (!currentName && !newFileDir) {
        // Get CWD
        window.ipcRenderer.invoke('resolve-path', '.').then(setPreviewPath);
      } else {
        window.ipcRenderer.invoke('resolve-path', ...args).then(setPreviewPath);
      }
    }
  }, [newFileDialogOpen, newFileName, newFileDir]);

  const handleCreateFile = (targetDir?: string) => {
    // Fix: Ensure targetDir is a string, as this might be called with an Event object
    const dir = (typeof targetDir === 'string') ? targetDir : '';
    setNewFileName('');
    setNewFileDir(dir);
    setNewFileDialogOpen(true);
  };

  const handleConfirmNewFile = () => {
    const rawName = newFileName.trim() || `Untitled-${files.length + 1}.txt`;

    // If we have a target directory, treat it as a real file creation immediately?
    // Or just set the path appropriately?
    const fullPath = newFileDir
      ? (rawName.includes('/') || rawName.includes('\\') ? rawName : `${newFileDir}\\${rawName}`)
      : rawName;

    // If it's a real path (contains slashes), we might want to actually touch the file?
    // For now, let's keep the existing logic where it just opens in a tab as "Dirty"
    // BUT if we have a directory context, it implies we want it saved there.

    // Let's stick to the "Dirty in-memory" model for consistency, but set the path correctly.
    // However, for "New File in Folder", users usually expect it to exist on disk.
    // Let's create it as empty file on disk if we have a directory context!

    /* 
       Actually, standard VSCode behavior:
       - File > New File: Untitled (in memory)
       - Explorer > New File: Creates file on disk immediately and opens logic
    */

    if (newFileDir) {
      // It's a real file creation request from explorer
      // We should try to create it via IPC
      window.ipcRenderer.invoke('write-file', fullPath, '')
        .then(() => {
          // Open it
          const newFile: OpenFile = {
            path: fullPath,
            name: rawName,
            content: '',
            isDirty: false
          };
          setFiles([...files, newFile]);
          setActiveFilePath(fullPath);
        })
        .catch(err => {
          console.error('Failed to create file:', err);
          alert('Failed to create file');
        });
    } else {
      // Just in-memory untitled
      const newFile: OpenFile = {
        path: fullPath,
        name: rawName,
        content: '',
        isDirty: true
      };
      setFiles([...files, newFile]);
      setActiveFilePath(fullPath);
    }

    setNewFileDialogOpen(false);
    setNewFileName('');
    setNewFileDir('');
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleOpenFolder = async (specifiedPath?: string) => {
    try {
      const path = specifiedPath || await window.ipcRenderer.invoke('dialog-open-folder');
      if (path) {
        setRootPath(path);
        await window.ipcRenderer.invoke('save-general-settings', { activeWorkspacePath: path });
        setFiles([]); // Clear open files
        setActiveFilePath('');
        showNotification(`Opened folder: ${path}`);
      }
    } catch (err) {
      console.error('Failed to open folder:', err);
      showNotification('Failed to open folder');
    }
  };

  const handleCloseFile = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const newFiles = files.filter(f => f.path !== path);
    if (newFiles.length === 0) {
      setFiles([]);
      setActiveFilePath('');
    } else {
      setFiles(newFiles);
      if (activeFilePath === path) {
        setActiveFilePath(newFiles[newFiles.length - 1].path);
      }
    }
  };

  const handleContentChange = (val: string | undefined) => {
    if (!activeFile) return;
    const content = val || '';
    setFiles(files.map(f =>
      f.path === activeFilePath ? { ...f, content, isDirty: true } : f
    ));
  };

  // Handle applying code from AI chat to editor
  const handleApplyCode = (code: string) => {
    checkArgs(typeof code === 'string', 'code must be a string');
    if (!activeFile) {
      // Create new file with the code
      const newFile: OpenFile = {
        path: 'ai-generated.ts',
        name: 'ai-generated.ts',
        content: code,
        isDirty: true
      };
      setFiles([...files, newFile]);
      setActiveFilePath('ai-generated.ts');
    } else {
      // Append to active file
      setFiles(files.map(f =>
        f.path === activeFilePath
          ? { ...f, content: f.content + '\n' + code, isDirty: true }
          : f
      ));
    }
  };

  const handleSaveAs = async () => {
    if (!activeFile) return;
    assertNonNull(activeFile, 'activeFile in handleSaveAs');
    try {
      const filePath = await window.ipcRenderer.invoke('dialog-save-file', activeFile.name);
      if (!filePath) return;

      await window.ipcRenderer.invoke('write-file', filePath, activeFile.content);
      const name = filePath.split(/[/\\]/).pop() || filePath;

      setFiles(files.map(f =>
        f.path === activeFilePath ? { ...f, path: filePath, name, isDirty: false } : f
      ));
      setActiveFilePath(filePath);
      showNotification(`Saved ${name}`);
    } catch (err) {
      console.error('Failed to save as', err);
      showNotification('Failed to save file');
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSave = async () => {
    if (!activeFile || !activeFile.isDirty) return;
    assertNonNull(activeFile, 'activeFile in handleSave');

    if (activeFile.path.startsWith('Untitled')) {
      await handleSaveAs();
      return;
    }

    try {
      await window.ipcRenderer.invoke('write-file', activeFile.path, activeFile.content);
      setFiles(files.map(f =>
        f.path === activeFilePath ? { ...f, isDirty: false } : f
      ));
      showNotification(`Saved ${activeFile.name}`);
    } catch (err) {
      console.error('Failed to save', err);
      showNotification('Failed to save file');
    }
  };

  const handleSaveRef = useRef(handleSave);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  useKeyboardShortcuts(handleSaveRef);
  useResizeHandlers(sidebarResizing, terminalResizing, setSidebarWidth, setTerminalHeight);

  const startResizeSidebar = () => {
    sidebarResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // Prevent selection while dragging
  };

  const startResizeTerminal = () => {
    terminalResizing.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const handleSectionChange = (section: string) => {
    if (activeSection === section) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setActiveSection(section);
      setSidebarOpen(true);
    }
  };

  return (
    <div className="app" style={{ display: 'flex', flexDirection: 'row', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <ActivityBar activeSection={activeSection} onSectionChange={handleSectionChange} />
      {sidebarOpen && (
        <>
          <div style={{ width: sidebarWidth, height: '100%', overflow: 'hidden', flexShrink: 0 }}>
            <Sidebar
              isOpen={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              activeSection={activeSection}
              onSectionChange={setActiveSection}
              onFileSelect={handleFileSelect}
              onCreateFile={handleCreateFile}
              rootPath={rootPath}
              onOpenFolder={handleOpenFolder}
              onRunFlow={handleRunFlow}
              onOpenFlow={handleOpenFlow}
              onOpenPlan={handleOpenPlan}
              width={sidebarWidth}
              symbolSearchQuery={symbolSearchQuery}
              setSymbolSearchQuery={setSymbolSearchQuery}
            />
          </div>
          {/* Resizer */}
          <div
            className="resize-handle-vertical"
            onMouseDown={startResizeSidebar}
            style={{ width: 6, cursor: 'col-resize', background: 'transparent', marginLeft: -3, zIndex: 100, position: 'relative' }}
          />
          {/* Visual Divider */}
          <div style={{ width: 1, background: '#333' }} />
        </>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minWidth: 0 }}>
        <TopBar
          activeSection={activeSection}
          files={files}
          activeFilePath={activeFilePath}
          setActiveFilePath={setActiveFilePath}
          handleCloseFile={handleCloseFile}
          handleCreateFile={handleCreateFile}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          chatOpen={chatOpen}
          setChatOpen={setChatOpen}
          terminalOpen={terminalOpen}
          setTerminalOpen={setTerminalOpen}
          vimEnabled={vimEnabled}
          setVimEnabled={setVimEnabled}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minWidth: 0 }}>
          <div className="editor-terminal-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {activeSection === 'search' ? (
                <div className="editor-wrapper" style={{ height: '100%', width: '100%' }}>
                  <SearchPanel />
                </div>
              ) : (
                <div className="editor-wrapper" style={{ height: '100%', width: '100%', flex: 1 }}>
                  <ActiveFileEditor
                    activeFile={activeFile}
                    files={files}
                    setFiles={setFiles}
                    activeFilePath={activeFilePath}
                    vimEnabled={vimEnabled}
                    editorTargetLine={editorTargetLine}
                    symbolSearchQuery={symbolSearchQuery}
                    appTheme={appTheme}
                    appFontSize={appFontSize}
                    onAcceptDiff={handleAcceptDiff}
                    onRejectDiff={handleRejectDiff}
                    onContentChange={handleContentChange}
                  />
                </div>
              )}
            </div>

            <TerminalBar isOpen={terminalOpen} height={terminalHeight} onStartResize={startResizeTerminal} />
          </div>

          {/* Chat Panel - Nesting here inside the flex-row under TopBar to respect layout boundaries */}
          {chatOpen && (
            <ErrorBoundary>
              <ChatPanel
                isOpen={chatOpen}
                onClose={() => setChatOpen(false)}
                onApplyCode={handleApplyCode}
                executionContext={executionContext}
                settingsSavedTrigger={settingsSavedTrigger}
                onOpenPlan={handleOpenPlan}
                onActiveTaskIdChange={(taskId) => {
                  activeChatTaskIdRef.current = taskId;
                }}
                rootPath={rootPath}
              />
            </ErrorBoundary>
          )}
        </div>

        <StatusBar vimEnabled={vimEnabled} />
      </div>

      <NewFileDialog
        isOpen={newFileDialogOpen}
        fileName={newFileName}
        onFileNameChange={setNewFileName}
        previewPath={previewPath}
        onConfirm={handleConfirmNewFile}
        onClose={() => setNewFileDialogOpen(false)}
        onCopyPath={(path) => {
          if (path) {
            navigator.clipboard.writeText(path);
            showNotification('Absolute path copied!');
          }
        }}
      />

      <NotificationToast message={notification} />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          loadAppSettings();
          setSettingsSavedTrigger(prev => prev + 1);
        }}
      />
    </div>
  );
}

export default App;
