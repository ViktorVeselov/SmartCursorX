import { useState, useEffect } from 'react';

const getIpc = () => window.ipcRenderer;

type QuantLevel = '4bit' | '8bit' | '16bit';
type BackendPref = 'auto' | 'llamacpp' | 'python';
type TrainStatus = 'idle' | 'preparing_dataset' | 'ready' | 'training' | 'stopping' | 'done' | 'error';
type DatasetSource = 'builtin' | 'workspace' | 'cot_jsonl';

interface HardwareSpec {
  gpuAvailable: boolean;
  gpuName: string;
  vramGB: number;
  cpuCores: number;
  ramGB: number;
  backendType: string;
  numGPUs: number;
  isAMD: boolean;
  rocmVersion?: string;
}

interface VramComponent {
  label: string;
  gb: number;
  detail: string;
}

interface VramEstimate {
  totalGB: number;
  components: VramComponent[];
}

interface FinetuneModel {
  id: string;
  name: string;
  description: string;
  hfRepo: string;
  parameterSize: string;
  recommendedVRAM: Record<string, number>;
  defaultQuantization: string;
  rank: number;
  tier?: string;
  benchmarks?: Record<string, number>;
  knownIssues?: string[];
  vramEstimates?: Record<string, VramEstimate>;
}

interface TrainingProgress {
  epoch: number;
  totalEpochs: number;
  step: number;
  totalSteps: number;
  loss: number;
  learningRate: number;
  tokensPerSecond: number;
  elapsedSeconds: number;
  estimatedTotalSeconds: number;
}

interface TrainingEvent {
  type: string;
  data?: TrainingProgress;
  message?: string;
}

interface DatasetManifest {
  samples: number;
  taskTypes: Record<string, number>;
  sourceFiles: number;
  totalTokens: number;
}

const QUANT_OPTIONS = [
  { value: '4bit', label: '4-bit (NF4)', desc: '6-8 GB VRAM — best efficiency 99% quality' },
  { value: '8bit', label: '8-bit (FP8)', desc: '8-12 GB VRAM — balanced memory/quality' },
  { value: '16bit', label: '16-bit (BF16)', desc: '14-28 GB VRAM — maximum quality' },
] as const;

const BACKEND_OPTIONS = [
  { value: 'auto', label: 'Auto-detect', desc: 'Best available backend (recommended)' },
  { value: 'llamacpp', label: 'llama.cpp', desc: 'Native GGUF — no Python needed' },
  { value: 'python', label: 'Python (PyTorch)', desc: 'Full PEFT/transformers' },
] as const;

const TASK_TYPE_OPTIONS = [
  { value: 'explain', label: 'Explain', desc: 'Q&A about code' },
  { value: 'complete', label: 'Complete', desc: 'Fill-in-the-middle' },
  { value: 'refactor', label: 'Refactor', desc: 'Improvement suggestions' },
  { value: 'docstring', label: 'Docstring', desc: 'Generate docs' },
  { value: 'bug_detection', label: 'Bug Detection', desc: 'Find issues' },
];

function isQuantCompatible(vramGB: number, quant: string, modelVram: Record<string, number>): { ok: boolean; reason: string } {
  const needed = modelVram[quant] || Infinity;
  if (vramGB <= 0) return { ok: true, reason: 'VRAM unknown — proceed with caution' };
  if (vramGB >= needed) return { ok: true, reason: `Needs ${needed} GB — you have ${vramGB} GB` };
  return { ok: false, reason: `Needs ${needed} GB VRAM — you have ${vramGB} GB` };
}

function hardwareStatus(hw: HardwareSpec | null): { level: 'ok' | 'limited' | 'unknown' | 'blocked'; label: string; tip: string } {
  if (!hw) return { level: 'unknown', label: 'Unknown', tip: 'Click "Detect Hardware" to check compatibility' };
  if (!hw.gpuAvailable && hw.ramGB < 16) return { level: 'blocked', label: 'Insufficient', tip: 'Need 16GB+ RAM for CPU training. GPU strongly recommended.' };
  if (hw.vramGB >= 12) return { level: 'ok', label: 'Ready', tip: 'Your system can run all model sizes and quantization levels.' };
  if (hw.vramGB >= 6) return { level: 'limited', label: 'Limited', tip: `4-bit models only (${hw.vramGB} GB VRAM detected). 8/16-bit disabled.` };
  if (hw.vramGB > 0) return { level: 'limited', label: 'Very Limited', tip: `Only 3B-4B models in 4-bit (${hw.vramGB} GB VRAM).` };
  return { level: 'unknown', label: 'Not detected', tip: 'Will attempt CPU-only training. Expect slow speeds.' };
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'calculating...';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'auto' },
  section: { background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 16, border: '1px solid var(--border-subtle)' },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 },
  row: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' },
  label: { fontSize: 12, color: 'var(--text-secondary)', minWidth: 100 },
  select: { padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 12 },
  input: { padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 12, width: 80 },
  button: { padding: '6px 16px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12, fontWeight: 500 },
  primaryButton: { background: 'var(--accent-primary)', color: '#fff' },
  successButton: { background: '#2a6', color: '#fff' },
  dangerButton: { background: 'var(--accent-danger, #e44)', color: '#fff' },
  secondaryButton: { background: 'var(--bg-active)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500 },
  progressBar: { height: 8, background: 'var(--bg-primary)', borderRadius: 4, overflow: 'hidden', marginTop: 8 },
  progressFill: { height: '100%', background: 'var(--accent-primary)', borderRadius: 4, transition: 'width 0.3s ease' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'var(--bg-active)', borderRadius: 12, fontSize: 11, color: 'var(--text-secondary)' },
  logContainer: { maxHeight: 200, overflowY: 'auto', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', padding: 8, fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' },
  tooltip: { fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2 },
};

interface SettingsFinetuningTabProps {
  huggingfaceToken: string;
  setHuggingfaceToken: (v: string) => void;
}

export function SettingsFinetuningTab({ huggingfaceToken, setHuggingfaceToken }: SettingsFinetuningTabProps) {
  const [hardware, setHardware] = useState<HardwareSpec | null>(null);
  const [models, setModels] = useState<FinetuneModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('qwen2.5-coder-7b');
  const [customModelId, setCustomModelId] = useState('');
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [quantization, setQuantization] = useState<QuantLevel>('4bit');
  const [backend, setBackend] = useState<BackendPref>('auto');
  const [status, setStatus] = useState<TrainStatus>('idle');
  const [manifest, setManifest] = useState<DatasetManifest | null>(null);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [adapterPath, setAdapterPath] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [numEpochs, setNumEpochs] = useState(3);
  const [lr, setLr] = useState('2e-4');
  const [batchSize, setBatchSize] = useState(4);
  const [loraRank, setLoraRank] = useState(16);
  const [maxSamples, setMaxSamples] = useState(500);
  const [taskTypes, setTaskTypes] = useState<Set<string>>(new Set(['explain', 'complete']));
  const [scanning, setScanning] = useState(false);
  const [datasetSource, setDatasetSource] = useState<DatasetSource>('builtin');
  const [datasetPath, setDatasetPath] = useState('');
  const [cotPath, setCotPath] = useState('data-set/fable5_cot_merged.json');
  const [converting, setConverting] = useState(false);
  const [vramTooltip, setVramTooltip] = useState<{ x: number; y: number; estimate: VramEstimate } | null>(null);
  const [gpusToUse, setGpusToUse] = useState(1);
  const [multiGPUMode, setMultiGPUMode] = useState<'auto' | 'ddp' | 'fsdp' | 'deepspeed'>('auto');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [nnodes, setNnodes] = useState(1);
  const [nodeRank, setNodeRank] = useState(0);
  const [masterAddr, setMasterAddr] = useState('127.0.0.1');
  const [refreshingHardware, setRefreshingHardware] = useState(false);
  const [missingPackages, setMissingPackages] = useState<string[]>([]);
  const [installingDeps, setInstallingDeps] = useState(false);
  const [packageCheckDetails, setPackageCheckDetails] = useState<string | null>(null);

  const hwStatus = hardwareStatus(hardware);
  const selectedModelDef = models.find(m => m.id === selectedModel);
  const isTraining = status === 'training';

  const checkPackageStatus = async () => {
    try {
      const status = await getIpc().invoke('finetune:check-packages');
      if (!status.available) {
        setMissingPackages(status.missing || []);
        setPackageCheckDetails(status.error || status.details || null);
      } else {
        setMissingPackages([]);
        setPackageCheckDetails(status.details || null);
      }
    } catch (err: any) {
      console.error('Failed to check packages:', err);
    }
  };

  const handleInstallDeps = async () => {
    setInstallingDeps(true);
    setLogs([]);
    setLogs(prev => [...prev, 'Starting dependency installer...']);
    try {
      await getIpc().invoke('finetune:install-dependencies');
      setLogs(prev => [...prev, 'Dependency installation finished successfully!']);
      await checkPackageStatus();
    } catch (err: any) {
      setLogs(prev => [...prev, `ERROR installing dependencies: ${err.message}`]);
    }
    setInstallingDeps(false);
  };

  useEffect(() => {
    getIpc().invoke('finetune:get-models').then(setModels).catch((err: any) => {
      setLogs(prev => [...prev, `ERROR: Failed to load models: ${err.message}`]);
    });
    initHardware();
    checkPackageStatus();
    // Auto-load the built-in dataset
    getIpc().invoke('finetune:get-builtin-dataset').then((info: any) => {
      if (info) {
        setDatasetPath(info.path);
        setManifest({ samples: info.samples, taskTypes: { code_gen: info.samples }, sourceFiles: 53, totalTokens: 12669000 });
        setLogs(prev => [...prev, `Built-in dataset loaded: ${info.name}`]);
        setStatus('ready');
      }
    }).catch((err: any) => {
      setLogs(prev => [...prev, `ERROR: Failed to load built-in dataset: ${err.message}`]);
    });
    const listener = (_: any, event: TrainingEvent) => {
      if (event.type === 'progress' && event.data) {
        setProgress(event.data);
        setStatus('training');
      } else if (event.type === 'log' && event.message) {
        setLogs(prev => [...prev.slice(-99), event.message!]);
      } else if (event.type === 'done') {
        setStatus('done');
        getIpc().invoke('finetune:get-adapter-path').then(setAdapterPath).catch(() => {});
      } else if (event.type === 'error' && event.message) {
        setStatus('error');
        setLogs(prev => [...prev, `ERROR: ${event.message}`]);
      }
    };
    getIpc().on('finetune:progress', listener);
    return () => { getIpc().off('finetune:progress', listener); };
  }, []);

  // Auto-choose best quant when model or hardware changes
  useEffect(() => {
    if (!hardware || !selectedModelDef) return;
    const vram = hardware.vramGB;
    if (vram <= 0) return;
    if (vram < selectedModelDef.recommendedVRAM['4bit']) {
      // This model won't fit even in 4-bit. Try smaller model.
      return;
    }
    if (vram >= selectedModelDef.recommendedVRAM['16bit'] && quantization === '4bit') {
      setQuantization('8bit');
    }
    if (vram < selectedModelDef.recommendedVRAM['8bit'] && quantization === '8bit') {
      setQuantization('4bit');
    }
    if (vram < selectedModelDef.recommendedVRAM['16bit'] && quantization === '16bit') {
      setQuantization('8bit');
    }
  }, [hardware, selectedModelDef?.id]);

  const initHardware = async () => {
    try {
      const hw = await getIpc().invoke('finetune:detect-hardware');
      setHardware(hw);
      if (hw.numGPUs > 0) setGpusToUse(hw.numGPUs);
      const rec = await getIpc().invoke('finetune:get-recommendation', hw);
      setRecommendation(rec);
      if (rec?.primary) {
        setSelectedModel(rec.primary.model);
        setQuantization(rec.primary.quantization);
        setBackend(rec.primary.backend);
      }
      await checkPackageStatus();
    } catch (err: any) {
      setLogs(prev => [...prev, `ERROR: Hardware detection failed: ${err.message || 'Unknown error'}`]);
    }
  };

  const refreshHardware = async () => {
    setRefreshingHardware(true);
    try {
      const hw = await getIpc().invoke('finetune:refresh-hardware');
      setHardware(hw);
      if (hw.numGPUs > 0) setGpusToUse(hw.numGPUs);
      const rec = await getIpc().invoke('finetune:get-recommendation', hw);
      setRecommendation(rec);
      if (rec?.primary) {
        setSelectedModel(rec.primary.model);
        setQuantization(rec.primary.quantization);
        setBackend(rec.primary.backend);
      }
      await checkPackageStatus();
      setLogs(prev => [...prev, 'Hardware detection refreshed']);
    } catch (err: any) {
      setLogs(prev => [...prev, `ERROR refreshing hardware: ${err.message}`]);
    }
    setRefreshingHardware(false);
  };

  const toggleTaskType = (t: string) => {
    setTaskTypes(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  const handlePrepareDataset = async () => {
    setScanning(true);
    setLogs(prev => [...prev, `Preparing dataset from workspace...`]);
    try {
      const workspace = await getIpc().invoke('get-general-settings').then((s: any) => s?.workspacePath || '');
      if (!workspace) {
        setLogs(prev => [...prev, 'ERROR: No workspace path set in General settings']);
        setScanning(false);
        return;
      }
      const m = await getIpc().invoke('finetune:prepare-dataset', workspace, {
        maxSamples, minCodeLength: 50, includeTests: true, includeConfig: false,
        maxInputLength: 4096, taskTypes: Array.from(taskTypes),
      });
      setManifest(m);
      const outPath = await getIpc().invoke('finetune:export-dataset');
      setLogs(prev => [...prev, `Dataset ready: ${m.samples} samples, ${m.sourceFiles} files`, `Exported to: ${outPath}`]);
      setStatus('ready');
    } catch (err: any) {
      setLogs(prev => [...prev, `ERROR: ${err.message}`]);
    }
    setScanning(false);
  };

  const handleUseBuiltin = async () => {
    setLogs(prev => [...prev, 'Loading built-in dataset...']);
    try {
      const info = await getIpc().invoke('finetune:get-builtin-dataset');
      if (info) {
        setDatasetPath(info.path);
        setManifest({ samples: info.samples, taskTypes: { code_gen: info.samples }, sourceFiles: 53, totalTokens: 12669000 });
        setLogs(prev => [...prev, `Built-in dataset ready: ${info.name} at ${info.path}`]);
        setStatus('ready');
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `ERROR: ${err.message}`]);
    }
  };

  const handleConvertCot = async () => {
    setConverting(true);
    setLogs(prev => [...prev, `Converting CoT dataset from ${cotPath}...`]);
    try {
      const outPath = 'data-set/fable5_ft_instruction.jsonl';
      setLogs(prev => [...prev, `Converting: ${cotPath} → ${outPath}`]);
      const result = await getIpc().invoke('finetune:convert-dataset', {
        inputPath: cotPath,
        outputPath: outPath,
        mode: 'instruction',
        maxSamples: 2000,
        filterTruncated: true,
      });
      setLogs(prev => [...prev, ...(result?.stdout?.split('\n').filter(Boolean) || ['Conversion complete'])]);
      setManifest({ samples: 2000, taskTypes: { code_gen: 2000 }, sourceFiles: 53, totalTokens: 16983000 });
      setStatus('ready');

      // Register this dataset path for training
      const datasetPath = outPath.replace(/\\/g, '/');
      await getIpc().invoke('finetune:export-dataset', datasetPath);
      setLogs(prev => [...prev, `Dataset ready at: ${datasetPath}`]);
    } catch (err: any) {
      setLogs(prev => [...prev, `ERROR: ${err.message}`]);
    }
    setConverting(false);
  };

  const handleStart = async () => {
    setLogs([]);
    setProgress(null);
    try {
      const modelHfId = useCustomModel
        ? customModelId.trim()
        : (selectedModelDef?.hfRepo || selectedModel);
      if (!modelHfId) {
        setLogs(prev => [...prev, 'ERROR: No model specified. Select a model or enter a HuggingFace ID.']);
        return;
      }
      const params: any = {
        modelId: useCustomModel ? modelHfId : selectedModel,
        modelHfId,
        quantization,
        backend,
        datasetPath,
        learningRate: parseFloat(lr),
        numEpochs,
        batchSize,
        loraRank,
        maxSeqLength: 2048,
        loraAlpha: loraRank * 2,
        loraDropout: 0.05,
        warmupSteps: 50,
        useUnsloth: true,
        numGPUs: gpusToUse,
        multiGPUMode,
        nnodes,
        nodeRank,
        masterAddr,
        isAMD: hardware?.isAMD || false,
        huggingfaceToken,
      };
      setStatus('training');
      await getIpc().invoke('finetune:start', params);
    } catch (err: any) {
      setStatus('error');
      setLogs(prev => [...prev, `ERROR: ${err.message}`]);
    }
  };

  const handleStop = async () => {
    try {
      setStatus('stopping');
      await getIpc().invoke('finetune:stop');
      setStatus('idle');
    } catch (err: any) {
      setLogs(prev => [...prev, `ERROR: Failed to stop training: ${err.message}`]);
      setStatus('error');
    }
  };

  const handleReset = async () => {
    try {
      await getIpc().invoke('finetune:reset');
    } catch (err: any) {
      setLogs(prev => [...prev, `ERROR: Reset failed: ${err.message}`]);
    }
    setStatus('idle');
    setProgress(null);
    setLogs([]);
    setManifest(null);
    setAdapterPath(null);
  };

  const hwColor = hwStatus.level === 'ok' ? '#2a6' : hwStatus.level === 'limited' ? '#ea0' : hwStatus.level === 'blocked' ? '#e44' : 'var(--text-secondary)';

  return (
    <div style={styles.container}>
      {/* ===== HARDWARE STATUS ===== */}
      <div style={{ ...styles.section, borderLeft: `4px solid ${hwColor}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={styles.sectionTitle}>Hardware Compatibility</div>
          {!hardware ? (
            <button style={{ ...styles.button, ...styles.secondaryButton, fontSize: 11 }} onClick={initHardware}>
              Detect Hardware
            </button>
          ) : (
            <button
              style={{ ...styles.button, ...styles.secondaryButton, fontSize: 10, padding: '2px 8px' }}
              onClick={refreshHardware}
              disabled={refreshingHardware}
            >
              {refreshingHardware ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </div>
        {hardware ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ ...styles.badge, background: hwColor, color: '#fff' }}>{hwStatus.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {hardware.gpuAvailable ? hardware.gpuName : 'CPU Only'}
              </span>
              {hardware.isAMD && (
                <span style={{ ...styles.badge, background: '#e44', color: '#fff', fontSize: 10 }}>AMD ROCm{hardware.rocmVersion ? ` ${hardware.rocmVersion}` : ''}</span>
              )}
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {hardware.vramGB > 0 ? `${hardware.vramGB} GB VRAM` : ''} · {hardware.ramGB} GB RAM · {hardware.cpuCores} cores
                {hardware.numGPUs > 1 ? ` · ${hardware.numGPUs} GPUs` : ''}
              </span>
              {refreshingHardware && <span style={{ fontSize: 10, color: 'var(--accent-primary)' }}>Updating...</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{hwStatus.tip}</div>

            {missingPackages.length > 0 && (
              <div style={{ marginTop: 12, padding: 12, background: 'rgba(228, 68, 68, 0.1)', border: '1px solid #e44', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: '#e44', marginBottom: 4 }}>
                  Missing Python ML Dependencies: {missingPackages.join(', ')}
                </div>
                <div style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
                  To fine-tune models with the Python backend, you need these libraries installed. Click below to install them automatically.
                </div>
                <button
                  style={{ ...styles.button, ...styles.dangerButton, fontSize: 11, padding: '4px 12px' }}
                  onClick={handleInstallDeps}
                  disabled={installingDeps}
                >
                  {installingDeps ? 'Installing Dependencies...' : 'One-Click Dependency Installer'}
                </button>
              </div>
            )}

            {missingPackages.length === 0 && packageCheckDetails && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                Note: {packageCheckDetails}
              </div>
            )}

            {recommendation && recommendation.primary && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--accent-primary)', fontWeight: 500 }}>
                    Primary: {models.find(m => m.id === recommendation.primary.model)?.name || recommendation.primary.model} ({recommendation.primary.quantization})
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>({recommendation.primary.reason})</span>
                  </span>
                  <button style={{ ...styles.button, ...styles.successButton, fontSize: 11, padding: '4px 12px' }}
                    onClick={() => {
                      setSelectedModel(recommendation.primary.model);
                      setQuantization(recommendation.primary.quantization);
                      setBackend(recommendation.primary.backend);
                    }}>
                    Use Primary
                  </button>
                  <button
                    style={{ ...styles.button, ...styles.secondaryButton, fontSize: 11, padding: '4px 12px' }}
                    onClick={() => {
                      // Switch to fine-tuned models tab
                      const tabElement = document.querySelector('[data-tab="fine-tuned-models"]');
                      if (tabElement) {
                        tabElement.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    Register for Inference
                  </button>
                </div>

                {/* Language-specific alternatives */}
                {(() => {
                  const alt = recommendation.alternatives;
                  const sections = [];
                  if (alt.python && alt.python.length > 0) {
                    sections.push(
                      <div key="python" style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Python</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {alt.python.map((a: any) => (
                            <button key={a.model} style={{ ...styles.button, ...styles.secondaryButton, fontSize: 10, padding: '3px 10px' }}
                              onClick={() => { setSelectedModel(a.model); setQuantization(a.quantization); setBackend(a.backend); }}>
                            {models.find(m => m.id === a.model)?.name || a.model} ({a.quantization}, ~{a.vramGB}GB)
                          </button>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  if (alt.javascript && alt.javascript.length > 0) {
                    sections.push(
                      <div key="javascript" style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>JavaScript / TypeScript</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {alt.javascript.map((a: any) => (
                            <button key={a.model} style={{ ...styles.button, ...styles.secondaryButton, fontSize: 10, padding: '3px 10px' }}
                              onClick={() => { setSelectedModel(a.model); setQuantization(a.quantization); setBackend(a.backend); }}>
                            {models.find(m => m.id === a.model)?.name || a.model} ({a.quantization}, ~{a.vramGB}GB)
                          </button>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  if (alt.general && alt.general.length > 0) {
                    sections.push(
                      <div key="general" style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>General</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {alt.general.map((a: any) => (
                            <button key={a.model} style={{ ...styles.button, ...styles.secondaryButton, fontSize: 10, padding: '3px 10px' }}
                              onClick={() => { setSelectedModel(a.model); setQuantization(a.quantization); setBackend(a.backend); }}>
                            {models.find(m => m.id === a.model)?.name || a.model} ({a.quantization}, ~{a.vramGB}GB)
                          </button>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return sections;
                })()}
              </div>
            )}

            {/* Register for Inference Button - always visible when hardware is detected */}
            {hardware && (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                <button
                  style={{ ...styles.button, ...styles.secondaryButton, fontSize: 11, padding: '6px 16px' }}
                  onClick={() => {
                    // Scroll to fine-tuned models section
                    const fineTunedSection = document.querySelector('[data-tab="fine-tuned-models"]');
                    if (fineTunedSection) {
                      fineTunedSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }}
                >
                  Register Fine-Tuned Model for Inference
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Click "Detect Hardware" to check what your system can run.
          </div>
        )}
        {hardware && !recommendation && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#ea0' }}>
            No recommendation available for your hardware. You may need more VRAM or a supported GPU.
          </div>
        )}
      </div>

      {/* ===== QUICK STATUS ===== */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Status:</span>
        <span style={{
          ...styles.badge,
          background: status === 'training' ? '#2a6' : status === 'error' ? '#e44' : status === 'done' ? '#28a' : 'var(--bg-active)',
          color: status === 'idle' ? 'var(--text-secondary)' : '#fff',
        }}>
          {status}
        </span>
        {status === 'done' && adapterPath && (
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{adapterPath}</span>
        )}
      </div>

      {/* ===== MODEL & QUANTIZATION ===== */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ ...styles.section, flex: 2 }}>
          <div style={styles.sectionTitle}>Model</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <select
              style={{ ...styles.select, flex: 1 }}
              value={useCustomModel ? '__custom__' : selectedModel}
              onChange={e => {
                const val = e.target.value;
                if (val === '__custom__') {
                  setUseCustomModel(true);
                  setCustomModelId(selectedModelDef?.hfRepo || '');
                } else {
                  setUseCustomModel(false);
                  setSelectedModel(val);
                }
              }}
              disabled={isTraining}
            >
              {models.map(m => {
                const vram = hardware?.vramGB || 0;
                const compat = vram > 0 ? isQuantCompatible(vram, '4bit', m.recommendedVRAM) : { ok: true, reason: '' };
                const label = `${m.name} (${m.parameterSize})${!compat.ok ? ' (low VRAM)' : ''}`;
                return (
                  <option key={m.id} value={m.id}
                    disabled={vram > 0 && !compat.ok && m !== models[models.length - 1]}>
                    {label}
                  </option>
                );
              })}
              <option value="__custom__">Custom HuggingFace model...</option>
            </select>
          </div>
          {useCustomModel && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                HuggingFace Model ID:
              </span>
              <input
                style={{ ...styles.input, width: '100%', fontSize: 13 }}
                value={customModelId}
                onChange={e => setCustomModelId(e.target.value)}
                placeholder="e.g. mistralai/Mistral-7B-v0.3"
                disabled={isTraining}
              />
            </div>
          )}
          {selectedModelDef && !useCustomModel && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span>{selectedModelDef.description}</span>
                {selectedModelDef.tier && (
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 8,
                    background: selectedModelDef.tier === 'verified' ? '#2a6' : selectedModelDef.tier === 'community' ? '#ea0' : '#888',
                    color: '#fff', fontWeight: 500,
                  }}>
                    {selectedModelDef.tier}
                  </span>
                )}
                {selectedModelDef.benchmarks?.liveCodeBench && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    LCB: {selectedModelDef.benchmarks.liveCodeBench}%
                  </span>
                )}
              </div>
              <span style={{ color: 'var(--text-muted)' }}>{selectedModelDef.hfRepo}</span>
              <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
                {(['4bit', '8bit', '16bit'] as QuantLevel[]).map(q => {
                  const compat = hardware ? isQuantCompatible(hardware.vramGB, q, selectedModelDef.recommendedVRAM) : { ok: true, reason: 'unknown' };
                  const vramNeeded = selectedModelDef.recommendedVRAM[q];
                  const estimate = selectedModelDef.vramEstimates?.[q];
                  return (
                    <span key={q}
                      style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 4, cursor: estimate ? 'help' : 'default',
                        background: compat.ok ? 'var(--bg-active)' : '#e44',
                        color: compat.ok ? 'var(--text-secondary)' : '#fff',
                        opacity: quantization === q ? 1 : 0.6,
                        position: 'relative',
                      }}
                      onMouseEnter={(e) => {
                        if (!estimate) return;
                        const rect = (e.target as HTMLElement).getBoundingClientRect();
                        setVramTooltip({ x: rect.left, y: rect.bottom + 4, estimate });
                      }}
                      onMouseLeave={() => setVramTooltip(null)}>
                      {q}: {vramNeeded}GB
                    </span>
                  );
                })}
              </div>
              {selectedModelDef.knownIssues && selectedModelDef.knownIssues.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {selectedModelDef.knownIssues.map((issue, i) => (
                    <span key={i} style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 4,
                      background: '#ea033', color: '#fff',
                    }}>
                      {issue}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {useCustomModel && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              <div>Custom model — VRAM estimates unavailable. Use at your own risk.</div>
              <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                Enter any HuggingFace model ID. Must be compatible with QLoRA (transformers format).
              </div>
            </div>
          )}

          {/* Hugging Face Access Token */}
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 500 }}>
              Hugging Face Access Token
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="password"
                value={huggingfaceToken}
                onChange={e => setHuggingfaceToken(e.target.value)}
                placeholder="hf_..."
                style={{ ...styles.input, flex: 1, width: 'auto', fontSize: 12 }}
                disabled={isTraining}
              />
              <button
                type="button"
                onClick={() => setHuggingfaceToken('')}
                title="Clear Token"
                style={{ ...styles.button, ...styles.secondaryButton, padding: '4px 10px' }}
                disabled={isTraining}
              >
                Clear
              </button>
            </div>
            <div style={{ ...styles.tooltip, marginTop: 4 }}>
              Required for gated/private models (e.g. CodeGemma) on Hugging Face.
            </div>
          </div>
        </div>

        <div style={{ ...styles.section, flex: 1 }}>
          <div style={styles.sectionTitle}>Quantization</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {QUANT_OPTIONS.map(q => {
              const needed = selectedModelDef?.recommendedVRAM[q.value] || Infinity;
              const vram = hardware?.vramGB || 0;
              const disabled = vram > 0 && vram < needed;
              return (
                <label key={q.value} style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
                }}>
                  <input type="radio" name="quant" value={q.value}
                    checked={quantization === q.value}
                    onChange={() => !disabled && setQuantization(q.value as QuantLevel)}
                    disabled={isTraining || disabled}
                  />
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      {q.label}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{q.desc}</div>
                    {disabled && <div style={{ fontSize: 10, color: '#e44' }}>Needs {needed}GB VRAM</div>}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div style={{ ...styles.section, flex: 1 }}>
          <div style={styles.sectionTitle}>Backend</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {BACKEND_OPTIONS.map(b => (
              <label key={b.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                <input type="radio" name="backend" value={b.value}
                  checked={backend === b.value}
                  onChange={() => setBackend(b.value as BackendPref)}
                  disabled={isTraining}
                />
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{b.label}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{b.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ===== DATASET ===== */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Dataset</div>
        <div style={styles.row}>
          <span style={styles.label}>Source</span>
          <select style={styles.select} value={datasetSource}
            onChange={e => setDatasetSource(e.target.value as DatasetSource)}
            disabled={isTraining}>
            <option value="builtin">Built-in Dataset (Fable 5 CoT)</option>
            <option value="workspace">Scan Workspace Code</option>
            <option value="cot_jsonl">Import CoT Dataset (JSONL)</option>
          </select>
          <button style={{ ...styles.button, ...styles.secondaryButton, marginLeft: 'auto' }}
            onClick={datasetSource === 'builtin' ? handleUseBuiltin : datasetSource === 'workspace' ? handlePrepareDataset : handleConvertCot}
            disabled={isTraining || scanning || converting}>
            {scanning ? 'Scanning...' : converting ? 'Converting...' : manifest && datasetSource === 'builtin' ? 'Reload' : manifest ? 'Re-build' : datasetSource === 'builtin' ? 'Load Built-in' : datasetSource === 'workspace' ? 'Build Dataset' : 'Convert & Import'}
          </button>
        </div>

        {datasetSource === 'builtin' ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Pre-built instruction-tuning dataset from Fable 5 coding sessions. 2000 instruction–response pairs covering code generation, explanation, and tool use. Ready to use — no conversion needed.
          </div>
        ) : datasetSource === 'workspace' ? (
          <>
            <div style={styles.row}>
              <span style={styles.label}>Max Samples</span>
              <input type="number" style={styles.input} value={maxSamples} min={10} max={5000}
                onChange={e => setMaxSamples(parseInt(e.target.value) || 500)} disabled={isTraining} />
              <span style={styles.label}>Task Types</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {TASK_TYPE_OPTIONS.map(t => (
                  <span key={t.value} style={{
                    ...styles.chip,
                    background: taskTypes.has(t.value) ? 'var(--accent-primary)' : 'var(--bg-active)',
                    color: taskTypes.has(t.value) ? '#fff' : 'var(--text-secondary)',
                    cursor: isTraining ? 'not-allowed' : 'pointer',
                  }} onClick={() => !isTraining && toggleTaskType(t.value)}>
                    {t.label}
                  </span>
                ))}
              </div>
            </div>
            <div style={styles.tooltip}>Scans your workspace code and generates instruction-tuning pairs.</div>
          </>
        ) : (
          <>
            <div style={styles.row}>
              <span style={styles.label}>JSONL Path</span>
              <input style={{ ...styles.input, flex: 1, width: 'auto' }} value={cotPath}
                onChange={e => setCotPath(e.target.value)} disabled={isTraining} />
            </div>
            <div style={styles.tooltip}>Converts Fable 5 chain-of-thought conversations into instruction-tuning format. Requires Python + convert_cot_dataset.py.</div>
          </>
        )}

        {manifest && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, display: 'flex', gap: 16 }}>
            <span>{manifest.samples} samples</span>
            <span>{manifest.sourceFiles} source files</span>
            <span>~{Math.round(manifest.totalTokens / 1000)}K tokens</span>
            {Object.entries(manifest.taskTypes).length > 0 && (
              <span>Types: {Object.entries(manifest.taskTypes).map(([k, v]) => `${k}=${v}`).join(', ')}</span>
            )}
          </div>
        )}
      </div>

      {/* ===== HYPERPARAMETERS ===== */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Training Hyperparameters</div>
        <div style={styles.row}>
          <span style={styles.label}>Epochs</span>
          <input type="number" style={styles.input} value={numEpochs} min={1} max={50}
            onChange={e => setNumEpochs(parseInt(e.target.value) || 3)} disabled={isTraining} />
          <span style={styles.label}>Learning Rate</span>
          <input style={{ ...styles.input, width: 80 }} value={lr}
            onChange={e => setLr(e.target.value)} disabled={isTraining} />
          <span style={styles.label}>Batch Size</span>
          <input type="number" style={styles.input} value={batchSize} min={1} max={64}
            onChange={e => setBatchSize(parseInt(e.target.value) || 4)} disabled={isTraining} />
          <span style={styles.label}>LoRA Rank</span>
          <input type="number" style={styles.input} value={loraRank} min={1} max={256}
            onChange={e => setLoraRank(parseInt(e.target.value) || 16)} disabled={isTraining} />
        </div>
        <div style={styles.row}>
          <span style={styles.label}>GPUs</span>
          <input type="number" style={styles.input} value={gpusToUse} min={1} max={hardware?.numGPUs || 8}
            onChange={e => setGpusToUse(Math.min(parseInt(e.target.value) || 1, hardware?.numGPUs || 8))} disabled={isTraining} />
          {hardware && hardware.numGPUs > 1 && (
            <>
              <span style={styles.label}>Mode</span>
              <select style={styles.select} value={multiGPUMode}
                onChange={e => setMultiGPUMode(e.target.value as any)}
                disabled={isTraining || hardware.isAMD}>
                <option value="auto">Auto-detect</option>
                <option value="ddp">DDP (2-8 GPUs)</option>
                <option value="fsdp">FSDP (8+ GPUs)</option>
                <option value="deepspeed" disabled={hardware.isAMD}>DeepSpeed{hardware.isAMD ? ' (CUDA only)' : ''}</option>
              </select>
            </>
          )}
          <button style={{ ...styles.button, ...styles.secondaryButton, fontSize: 10, padding: '2px 10px', marginLeft: 'auto' }}
            onClick={() => setShowAdvanced(!showAdvanced)}>
            {showAdvanced ? 'Hide' : 'Show'} Advanced
          </button>
        </div>
        {showAdvanced && (
          <div style={{ ...styles.section, marginTop: 8, padding: 8, background: 'var(--bg-primary)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Multi-Node Configuration</div>
            <div style={styles.row}>
              <span style={styles.label}>Nodes</span>
              <input type="number" style={styles.input} value={nnodes} min={1} max={1024}
                onChange={e => setNnodes(parseInt(e.target.value) || 1)} disabled={isTraining} />
              <span style={styles.label}>Master Address</span>
              <input style={{ ...styles.input, width: 140 }} value={masterAddr}
                onChange={e => setMasterAddr(e.target.value)} disabled={isTraining} />
              <span style={styles.label}>Node Rank</span>
              <input type="number" style={styles.input} value={nodeRank} min={0} max={1023}
                onChange={e => setNodeRank(parseInt(e.target.value) || 0)} disabled={isTraining} />
            </div>
            <div style={styles.tooltip}>Node 0 is master. Each node gets a unique rank (0, 1, 2, ...).</div>
          </div>
        )}
        <div style={styles.tooltip}>Tip: Start with defaults. Lower LR (1e-4) for CoT data, higher (3e-4) for code data.</div>
      </div>

      {/* ===== ACTIONS ===== */}
      <div style={styles.row}>
        {status === 'ready' || status === 'idle' || status === 'error' || status === 'done' ? (
          <button style={{ ...styles.button, ...styles.primaryButton }}
            onClick={handleStart} disabled={!manifest || isTraining}>
            Start Training
          </button>
        ) : (
          <button style={{ ...styles.button, ...styles.dangerButton }}
            onClick={handleStop} disabled={!isTraining}>
            {status === 'stopping' ? 'Stopping...' : 'Stop Training'}
          </button>
        )}
        {(status === 'done' || status === 'error') && (
          <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={handleReset}>
            Reset
          </button>
        )}
        {status === 'error' && (
          <span style={{ color: '#e44', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            ⚠️ Training failed. Check logs below.
          </span>
        )}
        {status === 'done' && (
          <button
            style={{ ...styles.button, ...styles.successButton, fontSize: 11, padding: '4px 12px' }}
            onClick={() => {
              // Switch to fine-tuned models tab
              const fineTunedSection = document.querySelector('[data-tab="fine-tuned-models"]');
              if (fineTunedSection) {
                fineTunedSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
          >
            Register for Inference
          </button>
        )}
      </div>

      {/* ===== PROGRESS ===== */}
      {isTraining && progress && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Training Progress</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Epoch {progress.epoch}/{progress.totalEpochs} · Step {progress.step}/{progress.totalSteps}
            {' · '}Loss: {progress.loss.toFixed(4)}
            {' · '}LR: {progress.learningRate.toExponential(2)}
            {' · '}Tokens/s: {progress.tokensPerSecond.toFixed(0)}
            {progress.estimatedTotalSeconds > 0 && progress.elapsedSeconds > 0 && (
              <span style={{ marginLeft: 12, color: 'var(--accent-primary)' }}>
                ETA: {formatDuration(progress.estimatedTotalSeconds - progress.elapsedSeconds)}
              </span>
            )}
          </div>
          <div style={styles.progressBar}>
            <div style={{
              ...styles.progressFill,
              width: `${(progress.step / Math.max(progress.totalSteps, 1)) * 100}%`,
            }} />
          </div>
        </div>
      )}

      {/* ===== VRAM TOOLTIP ===== */}
      {vramTooltip && (
        <div style={{
          position: 'fixed', zIndex: 9999,
          left: vramTooltip.x, top: vramTooltip.y,
          background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
          borderRadius: 6, padding: 8, fontSize: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          maxWidth: 280,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
            VRAM: {vramTooltip.estimate.totalGB} GB
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', fontSize: 9 }}>
                <th style={{ textAlign: 'left', padding: '1px 4px' }}>Component</th>
                <th style={{ textAlign: 'right', padding: '1px 4px' }}>GB</th>
              </tr>
            </thead>
            <tbody>
              {vramTooltip.estimate.components.map((c, i) => (
                <tr key={i} style={{ color: 'var(--text-secondary)' }}>
                  <td style={{ padding: '1px 4px' }} title={c.detail}>{c.label}</td>
                  <td style={{ textAlign: 'right', padding: '1px 4px' }}>{c.gb.toFixed(2)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 600, color: 'var(--text-primary)', borderTop: '1px solid var(--border-color)' }}>
                <td style={{ padding: '2px 4px' }}>Total</td>
                <td style={{ textAlign: 'right', padding: '2px 4px' }}>{vramTooltip.estimate.totalGB}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop: 4, fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Based on batch=4, seqLen=2048, LoRA rank=16 with gradient checkpointing. Actual usage may vary by ±15%.
          </div>
        </div>
      )}

      {/* ===== LOGS ===== */}
      {logs.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Logs ({logs.length})</div>
          <div style={styles.logContainer}>
            {logs.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
