import React, { useState } from 'react';

// Types for a rule
interface Rule {
  id: string;
  content: string;
}

/**
 * RulesModal - a glassmorphism styled modal to view, add, edit, and import rules.
 *
 * Props:
 *  - visible: whether the modal is shown
 *  - onClose: callback to hide the modal
 *  - onSave: callback with the updated list of rules
 */
export const RulesModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSave: (rules: Rule[]) => void;
}> = ({ visible, onClose, onSave }) => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [newRule, setNewRule] = useState('');

  // Import rules from a JSON file (array of strings or objects)
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // In Electron renderer, the file path is available via (file as any).path
      const filePath = (file as unknown as { path: string }).path;
      const content: string = await window.ipcRenderer.invoke('read-file', filePath);
      const parsed = JSON.parse(content);
      const imported: Rule[] = (Array.isArray(parsed) ? parsed : []).map((r: Record<string, unknown>, idx: number) => {
        if (typeof r === 'string') {
          return { id: `imported-${idx}-${Date.now()}`, content: r } as Rule;
        }
        return { id: (r.id as string) || `imported-${idx}-${Date.now()}`, content: (r.content as string) || '' } as Rule;
      });
      setRules(prev => [...prev, ...imported]);
    } catch (err) {
      console.error('Failed to import rules:', err);
    }
  };

  const addRule = () => {
    if (!newRule.trim()) return;
    const rule: Rule = { id: `rule-${Date.now()}`, content: newRule.trim() };
    setRules([...rules, rule]);
    setNewRule('');
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const saveAndClose = () => {
    onSave(rules);
    onClose();
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'rgba(30,30,30,0.85)',
          borderRadius: '12px',
          width: '480px',
          maxHeight: '80vh',
          overflow: 'auto',
          padding: '20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          color: '#eee',
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: '12px' }}>Agent Rules</h2>
        <div style={{ marginBottom: '12px' }}>
          <input
            type="file"
            accept="application/json"
            onChange={handleImport}
            style={{ marginBottom: '8px' }}
          />
          <small>Import a JSON file containing an array of rule strings.</small>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <textarea
            placeholder="New rule…"
            value={newRule}
            onChange={e => setNewRule(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '6px',
              border: '1px solid #555',
              background: '#222',
              color: '#eee',
            }}
          />
          <button
            onClick={addRule}
            style={{
              marginTop: '6px',
              padding: '6px 12px',
              background: '#4f46e5',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseOver={e => (e.currentTarget.style.background = '#4338ca')}
            onMouseOut={e => (e.currentTarget.style.background = '#4f46e5')}
          >
            Add Rule
          </button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rules.map(rule => (
            <li
              key={rule.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.03)',
                padding: '6px 8px',
                borderRadius: '4px',
                marginBottom: '4px',
              }}
            >
              <span style={{ flex: 1 }}>{rule.content}</span>
              <button
                onClick={() => deleteRule(rule.id)}
                style={{
                  marginLeft: '8px',
                  background: 'transparent',
                  border: 'none',
                  color: '#f87171',
                  cursor: 'pointer',
                }}
                title="Delete rule"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              marginRight: '8px',
              background: '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={saveAndClose}
            style={{
              padding: '6px 12px',
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
