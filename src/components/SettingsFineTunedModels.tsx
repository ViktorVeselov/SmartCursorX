import { useState, useEffect } from 'react';

const getIpc = () => window.ipcRenderer;

interface SettingsFineTunedModelsProps {
  fineTunedModels: any[];
  setFineTunedModels: (v: any[]) => void;
  modelProvider: string;
  setModelProvider: (v: string) => void;
  selectedModel: string;
  setSelectedModel: (v: string) => void;
}

export function SettingsFineTunedModels(props: SettingsFineTunedModelsProps) {
  const {
    fineTunedModels,
    setFineTunedModels,
    setModelProvider,
    selectedModel,
    setSelectedModel,
  } = props;

  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [newModel, setNewModel] = useState({
    id: '',
    name: '',
    baseModelId: 'qwen2.5-coder-7b',
    baseModelHfRepo: 'Qwen/Qwen2.5-Coder-7B-Instruct',
    adapterPath: '',
    backend: 'llamacpp' as 'llamacpp' | 'python',
    quantization: '4bit' as '4bit' | '8bit' | '16bit',
    tags: ['python', 'javascript'],
  });

  useEffect(() => {
    getIpc().invoke('finetuned:get-models').then(setFineTunedModels).catch((err: any) => {
      setError(`Failed to load models: ${err.message}`);
    });
  }, []);

  const handleAdd = async () => {
    if (!newModel.id || !newModel.name || !newModel.adapterPath) {
      return;
    }
    setError(null);
    try {
      const tags = tagInput
        ? tagInput.split(',').map(t => t.trim()).filter(Boolean)
        : ['python', 'javascript'];
      await getIpc().invoke('finetuned:add-model', { ...newModel, tags });
      setIsAdding(false);
      setTagInput('');
      setNewModel({
        id: '',
        name: '',
        baseModelId: 'qwen2.5-coder-7b',
        baseModelHfRepo: 'Qwen/Qwen2.5-Coder-7B-Instruct',
        adapterPath: '',
        backend: 'llamacpp',
        quantization: '4bit',
        tags: ['python', 'javascript'],
      });
      const models = await getIpc().invoke('finetuned:get-models');
      setFineTunedModels(models || []);
    } catch (err: any) {
      setError(`Failed to add model: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await getIpc().invoke('finetuned:delete-model', id);
      const models = await getIpc().invoke('finetuned:get-models');
      setFineTunedModels(models || []);
    } catch (err: any) {
      setError(`Failed to delete model: ${err.message}`);
    }
  };

  const handleSelect = (id: string) => {
    setModelProvider('finetuned');
    setSelectedModel(id);
  };

  const filteredModels = fineTunedModels.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div data-tab="fine-tuned-models" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="codicon codicon-package" style={{ color: 'var(--accent-primary)' }} />
          Fine-Tuned Models ({fineTunedModels.length})
        </h4>
        <button
          onClick={() => setIsAdding(!isAdding)}
          style={{
            background: isAdding ? 'var(--accent-danger)' : 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 12px',
            fontSize: 11,
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'var(--transition-smooth)',
          }}
        >
          {isAdding ? 'Cancel' : 'Add Model'}
        </button>
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: '1.4' }}>
        Register your fine-tuned models for inference. Select a model to use in chat completions.
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: 'rgba(229, 68, 68, 0.1)', border: '1px solid rgba(229, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', fontSize: 11, color: '#e54444', lineHeight: '1.4' }}>
          {error}
        </div>
      )}

      {isAdding && (
        <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>New Fine-Tuned Model</div>
          <input
            type="text"
            placeholder="Model ID"
            value={newModel.id}
            onChange={e => setNewModel({ ...newModel, id: e.target.value })}
            style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', fontSize: 11 }}
          />
          <input
            type="text"
            placeholder="Display Name"
            value={newModel.name}
            onChange={e => setNewModel({ ...newModel, name: e.target.value })}
            style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', fontSize: 11 }}
          />
          <input
            type="text"
            placeholder="Adapter Path (local)"
            value={newModel.adapterPath}
            onChange={e => setNewModel({ ...newModel, adapterPath: e.target.value })}
            style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', fontSize: 11 }}
          />
           <select
             value={newModel.backend}
             onChange={e => setNewModel({ ...newModel, backend: e.target.value as any })}
             style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', fontSize: 11 }}
           >
             <option value="llamacpp">llama.cpp (GGUF)</option>
             <option value="python">Python (PyTorch)</option>
           </select>
            <select
              value={newModel.quantization}
              onChange={e => setNewModel({ ...newModel, quantization: e.target.value as any })}
              style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', fontSize: 11 }}
            >
              <option value="4bit">4-bit (NF4)</option>
              <option value="8bit">8-bit (FP8)</option>
              <option value="16bit">16-bit (BF16)</option>
            </select>
           <input
             type="text"
             placeholder="Base Model ID (e.g. qwen2.5-coder-7b)"
             value={newModel.baseModelId}
             onChange={e => setNewModel({ ...newModel, baseModelId: e.target.value })}
             style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', fontSize: 11 }}
           />
           <input
             type="text"
             placeholder="HF Repo (e.g. Qwen/Qwen2.5-Coder-7B-Instruct)"
             value={newModel.baseModelHfRepo}
             onChange={e => setNewModel({ ...newModel, baseModelHfRepo: e.target.value })}
             style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', fontSize: 11 }}
           />
           <input
             type="text"
             placeholder="Tags (comma-separated, e.g. python, javascript)"
             value={tagInput}
             onChange={e => setTagInput(e.target.value)}
             style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', fontSize: 11 }}
           />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={handleAdd}
              disabled={!newModel.id || !newModel.name || !newModel.adapterPath}
              style={{
                flex: 1,
                background: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 12px',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: 500,
                opacity: (!newModel.id || !newModel.name || !newModel.adapterPath) ? 0.5 : 1,
              }}
            >
              Save
            </button>
            <button
              onClick={() => setIsAdding(false)}
              style={{
                padding: '6px 12px',
                background: 'var(--bg-active)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <input
        type="text"
        placeholder="Search fine-tuned models..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', fontSize: 11, outline: 'none' }}
      />

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4, maxHeight: 220 }}>
        {filteredModels.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
            No fine-tuned models found.
          </div>
        ) : filteredModels.map((m: any) => (
          <div
            key={m.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              background: selectedModel === m.id ? 'var(--bg-active)' : 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11,
              cursor: 'pointer',
              transition: 'var(--transition-smooth)',
              ...(selectedModel === m.id && { borderColor: 'var(--accent-primary)', boxShadow: '0 0 0 1px var(--accent-primary)' })
            }}
            onClick={() => handleSelect(m.id)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, overflow: 'hidden' }}>
              <span style={{ fontWeight: selectedModel === m.id ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.name}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                ({m.backend}, {m.quantization})
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {m.adapterPath}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(m.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                color: 'var(--accent-danger)',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Delete model"
            >
              <span className="codicon codicon-trash" style={{ fontSize: 12 }} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
        Note: Fine-tuned models require inference server setup (llama.cpp or Python) to be used.
      </div>
    </div>
  );
}
