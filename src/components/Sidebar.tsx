import { motion } from 'framer-motion';
import { Explorer } from './Explorer';
import { MemoryPanel } from './MemoryPanel';
import { SourceControlPanel } from './SourceControlPanel';
import { SearchPanel } from './SearchPanel';
import { AgentsPanel } from './AgentsPanel';
import { CodeNavigatorPanel } from './CodeNavigatorPanel';
import { TaskPanel } from './TaskPanel';

interface SidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    activeSection: string;
    onSectionChange: (section: string) => void;
    onFileSelect: (content: string, path: string, line?: number) => void;
    onCreateFile: (path?: string) => void;
    rootPath?: string;
    onOpenFolder?: () => void;
    onRunFlow?: (agent: any, flow: any) => void;
    onOpenFlow?: (flow: any) => void;
    width?: number;
    symbolSearchQuery: string;
    setSymbolSearchQuery: (q: string) => void;
}

export function Sidebar({ isOpen, onToggle, activeSection, onFileSelect, onCreateFile, rootPath, onOpenFolder, onRunFlow, onOpenFlow, width = 260, symbolSearchQuery, setSymbolSearchQuery }: SidebarProps) {
    const handleNavigate = async (filePath: string, line?: number) => {
        try {
            const content = await window.ipcRenderer.invoke('read-file', filePath);
            onFileSelect(content, filePath, line);
        } catch (e) {
            console.error('Navigation read error:', e);
        }
    };

    return (
        <motion.aside
            className="sidebar"
            animate={{ width: isOpen ? width : 48 }}
            transition={{ duration: 0 }} // Remove transition duration for instant resizing
        >
            <div className="sidebar-header">
                <button
                    className="sidebar-toggle"
                    onClick={onToggle}
                    title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                    <span className={`codicon ${isOpen ? 'codicon-chevron-left' : 'codicon-chevron-right'}`} />
                </button>
                {isOpen && <span className="logo-text">SmartCursorX</span>}
            </div>

            {isOpen && (
                <div className="sidebar-content">
                    <div className="sidebar-panel">
                        {activeSection === 'explorer' && (
                            <Explorer
                                onFileSelect={onFileSelect}
                                onCreateFile={onCreateFile}
                                rootPath={rootPath}
                                onOpenFolder={onOpenFolder}
                                symbolSearchQuery={symbolSearchQuery}
                                setSymbolSearchQuery={setSymbolSearchQuery}
                            />
                        )}
                        {activeSection === 'search' && (
                            <SearchPanel />
                        )}
                        {activeSection === 'code-navigator' && (
                            <CodeNavigatorPanel 
                                rootPath={rootPath || '.'} 
                                onNavigate={handleNavigate}
                            />
                        )}
                        {activeSection === 'tasks' && (
                            <TaskPanel />
                        )}
                        {activeSection === 'memory' && (
                            <MemoryPanel />
                        )}
                        {(activeSection === 'versions' || activeSection === 'source-control') && (
                            <SourceControlPanel rootPath={rootPath || '.'} />
                        )}
                        {activeSection === 'agents' && (
                            <AgentsPanel onRunFlow={onRunFlow} onOpenFlow={onOpenFlow} />
                        )}
                    </div>
                </div>
            )}
        </motion.aside>
    );
}

