export interface AgentRule {
    id?: number;
    name: string;
    content: string;
    is_active: number;
}

const getIpc = () => window.ipcRenderer;

interface SettingsRulesTabProps {
    rules: AgentRule[];
    editingRule: AgentRule | null;
    setEditingRule: (v: AgentRule | null) => void;
    ruleName: string;
    setRuleName: (v: string) => void;
    ruleContent: string;
    setRuleContent: (v: string) => void;
    isRuleActive: boolean;
    setIsRuleActive: (v: boolean) => void;
    loadRules: () => Promise<void>;
}

export function SettingsRulesTab({ rules, editingRule, setEditingRule, ruleName, setRuleName, ruleContent, setRuleContent, isRuleActive, setIsRuleActive, loadRules }: SettingsRulesTabProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="codicon codicon-checklist" style={{ color: 'var(--accent-primary)' }} />
                    Agent Instructions & Rules
                </h3>
                {!editingRule && (
                    <button
                        onClick={() => {
                            setEditingRule({ name: '', content: '', is_active: 1 });
                            setRuleName('');
                            setRuleContent('');
                            setIsRuleActive(true);
                        }}
                        style={{
                            background: 'var(--accent-primary)',
                            border: 'none',
                            color: '#ffffff',
                            padding: '6px 14px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                        }}
                    >
                        <span className="codicon codicon-add" /> Add Rule
                    </button>
                )}
            </div>

            <p style={{ margin: '0 0 10px 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Create system-level rules and instructions that your agents must follow during code planning, execution, and chat conversations. Active rules are automatically injected into the system prompt.
            </p>

            {editingRule ? (
                <div style={{
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-subtle)',
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16
                }}>
                    <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                        {editingRule.id ? 'Edit Rule' : 'New Instruction / Rule'}
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Rule Name</label>
                        <input
                            type="text"
                            value={ruleName}
                            onChange={e => setRuleName(e.target.value)}
                            placeholder="e.g. Avoid using git commands"
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 12,
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Instructions Content</label>
                        <textarea
                            rows={6}
                            value={ruleContent}
                            onChange={e => setRuleContent(e.target.value)}
                            placeholder="Specify exact rules, e.g., 'Never propose git checkout or push commands...'"
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 12,
                                outline: 'none',
                                boxSizing: 'border-box',
                                resize: 'vertical',
                                fontFamily: 'monospace'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                            type="checkbox"
                            id="rule-active-check"
                            checked={isRuleActive}
                            onChange={e => setIsRuleActive(e.target.checked)}
                        />
                        <label htmlFor="rule-active-check" style={{ fontSize: 12, userSelect: 'none', cursor: 'pointer' }}>
                            Enable rule immediately
                        </label>
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                        <button
                            onClick={() => setEditingRule(null)}
                            style={{
                                background: 'transparent',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                                padding: '6px 14px',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 12,
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={async () => {
                                if (!ruleName.trim() || !ruleContent.trim()) return;
                                const activeVal = isRuleActive ? 1 : 0;
                                if (editingRule.id) {
                                    await getIpc().invoke('db:update-rule', editingRule.id, ruleName.trim(), ruleContent.trim(), activeVal);
                                } else {
                                    await getIpc().invoke('db:add-rule', ruleName.trim(), ruleContent.trim(), activeVal);
                                }
                                setEditingRule(null);
                                loadRules();
                            }}
                            style={{
                                background: 'var(--accent-primary)',
                                border: 'none',
                                color: '#ffffff',
                                padding: '6px 14px',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Save Rule
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {rules.length === 0 ? (
                        <div style={{
                            padding: 40,
                            textAlign: 'center',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)',
                            fontSize: 12
                        }}>
                            <span className="codicon codicon-info" style={{ fontSize: 24, display: 'block', marginBottom: 8, color: 'var(--accent-primary)' }} />
                            No active workspace rules set. Click "+ Add Rule" to set system-level guidelines.
                        </div>
                    ) : (
                        rules.map(rule => (
                            <div
                                key={rule.id}
                                style={{
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--border-subtle)',
                                    padding: '12px 16px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 8,
                                    position: 'relative'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input
                                            type="checkbox"
                                            checked={rule.is_active === 1}
                                            onChange={async (e) => {
                                                await getIpc().invoke('db:toggle-rule', rule.id, e.target.checked ? 1 : 0);
                                                loadRules();
                                            }}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <span style={{ fontWeight: 600, fontSize: 13, color: rule.is_active === 1 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                            {rule.name}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            onClick={() => {
                                                setEditingRule(rule);
                                                setRuleName(rule.name);
                                                setRuleContent(rule.content);
                                                setIsRuleActive(rule.is_active === 1);
                                            }}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
                                            title="Edit Rule"
                                        >
                                            <span className="codicon codicon-edit" />
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (confirm(`Are you sure you want to delete "${rule.name}"?`)) {
                                                    await getIpc().invoke('db:delete-rule', rule.id);
                                                    loadRules();
                                                }
                                            }}
                                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px' }}
                                            title="Delete Rule"
                                        >
                                            <span className="codicon codicon-trash" />
                                        </button>
                                    </div>
                                </div>
                                <div style={{
                                    fontSize: 11,
                                    color: 'var(--text-secondary)',
                                    whiteSpace: 'pre-wrap',
                                    fontFamily: 'monospace',
                                    background: 'rgba(0,0,0,0.1)',
                                    padding: 8,
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid rgba(255,255,255,0.02)',
                                    maxHeight: 100,
                                    overflowY: 'auto'
                                }}>
                                    {rule.content}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
