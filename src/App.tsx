import { useState, useEffect, useRef } from 'react';
// Custom implementation to avoid build errors with 'react-resizable-panels'
import { CodeEditor } from './components/Editor';
import { ChatPanel, AppAgent, AppFlow, AppExecutionContext } from './components/ChatPanel';
import { ErrorBoundary } from './ErrorBoundary';
import { TerminalPanel } from './components/TerminalPanel';
import { Sidebar } from './components/Sidebar';
import { SearchPanel } from './components/SearchPanel';
import { TopBar } from './components/TopBar';
import { StatusBar } from './components/StatusBar';
import { ActivityBar } from './components/ActivityBar';
import { SettingsModal } from './components/SettingsModal';
import './App.css';

import { VisualWorkflowEditor } from './components/VisualWorkflowEditor';

interface OpenFile {
  path: string;
  name: string;
  content: string; // If flow, this stores description or raw JSON string
  isDirty?: boolean;
  type?: 'code' | 'flow';
  flowId?: number;
  flowData?: {
    nodes: any[];
    edges: any[];
  };
}



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
      }
    } catch (err) {
      console.error('Failed to load general settings:', err);
    }
  };

  useEffect(() => {
    loadAppSettings();
    const isMac = navigator.userAgent.includes('Macintosh');
    if (isMac) {
      document.body.classList.add('platform-mac');
    } else {
      document.body.classList.add('platform-win');
    }
  }, []);

  const handleRunFlow = (agent: AppAgent, flow: AppFlow) => {
    console.assert(agent !== null && typeof agent === 'object', 'Agent must be an object');
    console.assert(flow !== null && typeof flow === 'object', 'Flow must be an object');
    setExecutionContext({ agent, flow });
    setChatOpen(true);
  };

  const handleOpenFlow = (flow: any) => {
    // Check if already open
    const path = `flow://${flow.id}`;
    const existing = files.find(f => f.path === path);
    if (existing) {
      setActiveFilePath(path);
      // Update data?
      return;
    }

    const newFile: OpenFile = {
      path,
      name: flow.name,
      content: flow.description || '',
      type: 'flow',
      flowId: flow.id,
      flowData: flow.steps || { nodes: [], edges: [] },
      isDirty: false
    };
    setFiles([...files, newFile]);
    setActiveFilePath(path);
  };

  const [editorTargetLine, setEditorTargetLine] = useState<{ line: number; timestamp: number } | null>(null);
  const [symbolSearchQuery, setSymbolSearchQuery] = useState('');

  // Derived active file
  const activeFile = files.find(f => f.path === activeFilePath) || files[0];

  const handleFileSelect = (content: string, path: string, line?: number) => {
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

  const handleCreateFile = (targetDir?: any) => {
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

  const getLanguageFromExtension = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java',
      c: 'c', cpp: 'cpp', cs: 'csharp', php: 'php', swift: 'swift',
      html: 'html', css: 'css', scss: 'scss', json: 'json', yaml: 'yaml',
      md: 'markdown', sql: 'sql', sh: 'shell', ps1: 'powershell'
    };
    return langMap[ext || ''] || 'plaintext';
  };

  const getFileSettings = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const language = getLanguageFromExtension(filename);
    let tabSize = 4;
    // 2-spaces standard for these languages
    if (['js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css', 'scss', 'yaml', 'yml', 'md'].includes(ext)) {
      tabSize = 2;
    }
    return { language, tabSize };
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

  const handleSave = async () => {
    if (!activeFile || !activeFile.isDirty) return;

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Global Mouse Up for resizing
    const handleMouseUp = () => {
      sidebarResizing.current = false;
      terminalResizing.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto'; // Re-enable text selection
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (sidebarResizing.current) {
        setSidebarWidth(Math.max(100, Math.min(1400, e.clientX)));
      }
      if (terminalResizing.current) {
        const newHeight = window.innerHeight - e.clientY;
        setTerminalHeight(Math.max(50, Math.min(window.innerHeight - 100, newHeight)));
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

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
                  {activeFile ? (
                    activeFile.type === 'flow' ? (
                      <VisualWorkflowEditor
                        initialNodes={activeFile.flowData?.nodes}
                        initialEdges={activeFile.flowData?.edges}
                        onSave={(nodes, edges) => {
                          // Update local file state
                          const newData = { nodes, edges };
                          setFiles(files.map(f => f.path === activeFilePath ? { ...f, flowData: newData, isDirty: true } : f));

                          // Auto-save to DB?
                          // Needed: A way to save back. For now, rely on Ctrl+S or Auto.
                          // We'll implement handleSave for flows next.
                        }}
                      />
                    ) : (
                      <CodeEditor
                        value={activeFile.content}
                        onChange={handleContentChange}
                        language={getFileSettings(activeFile.name).language}
                        vimEnabled={vimEnabled}
                        targetLine={editorTargetLine}
                        highlightActive={!!symbolSearchQuery}
                        options={{
                          tabSize: getFileSettings(activeFile.name).tabSize,
                          insertSpaces: true,
                          fontSize: appFontSize,
                          theme: appTheme === 'light' ? 'light' : 'vs-dark'
                        }}
                      />
                    )
                  ) : (
                    <div className="empty-state">
                      <p>No file open. Click + or select a file from sidebar.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {terminalOpen && (
              <>
                {/* Resizer */}
                <div
                  className="resize-handle-horizontal"
                  onMouseDown={startResizeTerminal}
                  style={{ height: 4, cursor: 'row-resize', background: '#333', flexShrink: 0 }}
                />
                <div style={{ height: terminalHeight, position: 'relative', flexShrink: 0 }}>
                  <TerminalPanel isOpen={terminalOpen} height="100%" />
                </div>
              </>
            )}
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
              />
            </ErrorBoundary>
          )}
        </div>

        <StatusBar vimEnabled={vimEnabled} />
      </div>

      {/* New File Dialog */}
      {newFileDialogOpen && (
        <div className="modal-overlay" onClick={() => setNewFileDialogOpen(false)}>
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
                  onClick={() => {
                    if (previewPath) {
                      navigator.clipboard.writeText(previewPath);
                      showNotification('Absolute path copied!');
                    }
                  }}
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
              value={newFileName}
              onChange={e => setNewFileName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleConfirmNewFile();
                if (e.key === 'Escape') setNewFileDialogOpen(false);
              }}
              autoFocus
            />
            <div className="language-hint">
              Language: {getLanguageFromExtension(newFileName || 'file.txt')}
            </div>
            <div className="dialog-actions">
              <button onClick={() => setNewFileDialogOpen(false)}>Cancel</button>
              <button className="primary" onClick={handleConfirmNewFile}>Create</button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className="notification-toast">
          <span className="codicon codicon-check" style={{ marginRight: 8 }} /> {notification}
        </div>
      )}

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
