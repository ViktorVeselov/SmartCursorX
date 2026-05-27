// ActivityBar component
import '../App.css'; // Ensure we use the global CSS or create specific

interface ActivityBarProps {
    activeSection: string;
    onSectionChange: (section: string) => void;
}

export function ActivityBar({ activeSection, onSectionChange }: ActivityBarProps) {
    const items = [
        { id: 'explorer', icon: 'codicon-files', label: 'Explorer' },
        { id: 'search', icon: 'codicon-search', label: 'Search' },
        { id: 'code-navigator', icon: 'codicon-symbol-structure', label: 'Structure Navigator' },
        { id: 'tasks', icon: 'codicon-checklist', label: 'Task Hierarchy' },
        { id: 'source-control', icon: 'codicon-source-control', label: 'Source Control' },
        { id: 'agents', icon: 'codicon-robot', label: 'Agents' },
        { id: 'memory', icon: 'codicon-database', label: 'Memory' },
    ];

    return (
        <div className="activity-bar">
            {items.map(item => (
                <div
                    key={item.id}
                    className={`activity-item ${activeSection === item.id ? 'active' : ''}`}
                    onClick={() => onSectionChange(item.id)}
                    title={item.label}
                >
                    <span className={`codicon ${item.icon}`} style={{ fontSize: 21 }} />
                </div>
            ))}

            {/* Setting or other botton items could go here */}
            <div style={{ flex: 1 }} />

            <div
                className="activity-item"
                title="Settings"
                style={{ marginBottom: 10 }}
            >
                <span className="codicon codicon-settings-gear" style={{ fontSize: 21 }} />
            </div>
        </div>
    );
}
