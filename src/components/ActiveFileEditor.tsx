import { VisualWorkflowEditor } from './VisualWorkflowEditor';
import { InteractivePlanEditor } from './InteractivePlanEditor';
import { DiffView } from './DiffView';
import { CodeEditor } from './Editor';
import { OpenFile } from '../types/appTypes';
import { getFileSettings } from '../helpers/appFile';
import type { Node, Edge } from 'reactflow';

interface ActiveFileEditorProps {
  activeFile: OpenFile | undefined;
  files: OpenFile[];
  setFiles: React.Dispatch<React.SetStateAction<OpenFile[]>>;
  activeFilePath: string;
  vimEnabled: boolean;
  editorTargetLine: { line: number; timestamp: number } | null;
  symbolSearchQuery: string;
  appTheme: 'light' | 'dark';
  appFontSize: number;
  onAcceptDiff: (diffFile: OpenFile) => void;
  onRejectDiff: (diffFile: OpenFile) => void;
  onContentChange: (val: string | undefined) => void;
}

export function ActiveFileEditor({ activeFile, files, setFiles, activeFilePath, vimEnabled, editorTargetLine, symbolSearchQuery, appTheme, appFontSize, onAcceptDiff, onRejectDiff, onContentChange }: ActiveFileEditorProps) {
  if (!activeFile) {
    return (
      <div className="empty-state">
        <p>No file open. Click + or select a file from sidebar.</p>
      </div>
    );
  }

  if (activeFile.type === 'flow') {
    return (
      <VisualWorkflowEditor
        initialNodes={activeFile.flowData?.nodes as Node[] | undefined}
        initialEdges={activeFile.flowData?.edges as Edge[] | undefined}
        onSave={(nodes, edges) => {
          const newData = { nodes, edges };
          setFiles(files.map(f => f.path === activeFilePath ? { ...f, flowData: newData, isDirty: true } : f));
        }}
      />
    );
  }

  if (activeFile.type === 'plan') {
    return (
      <InteractivePlanEditor
        taskId={activeFile.flowId || 0}
      />
    );
  }

  if (activeFile.type === 'diff') {
    return (
      <DiffView
        activeFile={activeFile}
        appTheme={appTheme}
        appFontSize={appFontSize}
        onAcceptDiff={onAcceptDiff}
        onRejectDiff={onRejectDiff}
      />
    );
  }

  if (activeFile.name.endsWith('.html')) {
    return (
      <iframe
        srcDoc={activeFile.content}
        style={{ width: '100%', height: '100%', border: 'none', background: '#1e1e1e' }}
        title={activeFile.name}
        sandbox="allow-scripts allow-same-origin"
      />
    );
  }

  return (
    <CodeEditor
      value={activeFile.content}
      onChange={onContentChange}
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
  );
}
