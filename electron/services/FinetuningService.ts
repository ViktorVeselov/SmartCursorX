import { FinetuneBackend, FinetuneOptions, TrainingEvent, TrainingProgress, HardwareSpec, DEFAULT_FINETUNE_OPTIONS, BackendCapability, BackendAvailability, BYTES_PER_GB, CACHE_TTL_DAYS, TIER_SCORES, runCommand } from './backends/BaseFinetuneBackend'
import { LlamaCppBackend } from './backends/LlamaCppBackend'
import { PythonBackend } from './backends/PythonBackend'
import { datasetService, DatasetManifest } from './DatasetService'
import { DatasetConfig, DEFAULT_DATASET_CONFIG, TOP_CODING_MODELS, BackendType } from '../constants/models'
import { estimateVRAM, type VramEstimate, type QuantLevel } from './VramCalculator'
import { secureStore } from '../secureStore'
import * as path from 'path'

export type TrainingStatus = 'idle' | 'preparing_dataset' | 'ready' | 'training' | 'stopping' | 'done' | 'error'

export interface TrainingState {
  status: TrainingStatus
  progress?: TrainingProgress
  error?: string
  hardware?: HardwareSpec
  manifest?: DatasetManifest
  startTime?: number
}

export type ProgressSender = (event: TrainingEvent) => void

export class FinetuningService {
  private backends: FinetuneBackend[] = []
  private selectedBackend: FinetuneBackend | null = null
  private state: TrainingState = { status: 'idle' }
  private progressSenders: ProgressSender[] = []
  private datasetService = datasetService
  private currentOptions: FinetuneOptions = DEFAULT_FINETUNE_OPTIONS

  constructor() {
    this.backends.push(new LlamaCppBackend())
    this.backends.push(new PythonBackend())
  }

  getState(): TrainingState {
    return { ...this.state, hardware: this.state.hardware ? { ...this.state.hardware } : undefined }
  }

  onProgress(sender: ProgressSender): () => void {
    this.progressSenders.push(sender)
    return () => {
      this.progressSenders = this.progressSenders.filter((s) => s !== sender)
    }
  }

  private emitEvent(event: TrainingEvent) {
    for (const sender of this.progressSenders) {
      try { sender(event) } catch {}
    }
    if (event.type === 'progress') this.state = { ...this.state, progress: event.data }
    if (event.type === 'error') this.state = { ...this.state, status: 'error', error: event.message }
    if (event.type === 'done') this.state = { ...this.state, status: 'done' }
  }

  getModels() {
    return TOP_CODING_MODELS.map((m) => ({
      ...m,
      vramEstimates: {
        '4bit': estimateVRAM(m.archParams, '4bit'),
        '8bit': estimateVRAM(m.archParams, '8bit'),
        '16bit': estimateVRAM(m.archParams, '16bit'),
      } as Record<QuantLevel, VramEstimate>,
    }))
  }

  private loadCachedHardware(): HardwareSpec | null {
    const cached = secureStore.getHardwareSpec()
    if (!cached) return null
    const ageDays = (Date.now() - cached.timestamp) / (1000 * 60 * 60 * 24)
    if (ageDays >= CACHE_TTL_DAYS) return null
    return {
      gpuAvailable: cached.vramGB > 0,
      gpuName: cached.gpuName,
      vramGB: cached.vramGB,
      cudaCores: 0,
      cpuCores: cached.cpuCores,
      ramGB: cached.ramGB,
      backendType: cached.backendType as BackendCapability,
      numGPUs: cached.numGPUs,
      isAMD: cached.isAMD,
    }
  }

  private cacheHardware(hw: HardwareSpec): void {
    secureStore.setHardwareSpec({
      gpuName: hw.gpuName,
      vramGB: hw.vramGB,
      ramGB: hw.ramGB,
      cpuCores: hw.cpuCores,
      numGPUs: hw.numGPUs,
      isAMD: hw.isAMD,
      backendType: hw.backendType,
      timestamp: Date.now(),
    })
  }

  private async detectNvidiaGpu(fallback: HardwareSpec): Promise<void> {
    const result = await runCommand('nvidia-smi --query-gpu=name,memory.total,count --format=csv,noheader')
    if (!result.ok) {
      console.log('[Hardware] nvidia-smi not available:', result.stderr.slice(0, 200))
      return
    }
    const lines = result.stdout.split('\n')
    const first = lines[0]?.split(', ')
    if (first && first.length >= 2) {
      fallback.gpuAvailable = true
      fallback.gpuName = first[0]
      fallback.numGPUs = lines.length
      const vramMatch = first[1].match(/(\d+)/)
      if (vramMatch) fallback.vramGB = Math.round(parseInt(vramMatch[1]) / 1024)
      fallback.backendType = 'python_cuda'
      fallback.isAMD = false
    }
  }

  private async detectWmiGpu(fallback: HardwareSpec): Promise<void> {
    if (process.platform !== 'win32') return
    const result = await runCommand(
      'powershell -Command "Get-WmiObject Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json"'
    )
    if (!result.ok) {
      console.log('[Hardware] WMI detection failed:', result.stderr.slice(0, 200))
      return
    }
    try {
      const parsed = JSON.parse(result.stdout)
      const entries = Array.isArray(parsed) ? parsed : [parsed]
      const dedicated = entries.find((e: any) => e.AdapterRAM && parseInt(e.AdapterRAM) > 0)
      if (dedicated) {
        fallback.gpuAvailable = true
        fallback.gpuName = dedicated.Name
        fallback.numGPUs = entries.filter((e: any) => e.AdapterRAM && parseInt(e.AdapterRAM) > 0).length
        fallback.vramGB = Math.round(parseInt(dedicated.AdapterRAM) / BYTES_PER_GB)
        fallback.isAMD = /amd|radeon/i.test(dedicated.Name)
        fallback.backendType = fallback.isAMD ? 'python_rocm' : 'python_cuda'
      }
    } catch (e) {
      console.log('[Hardware] Failed to parse WMI output:', result.stdout.slice(0, 200))
    }
  }

  private async probeBackends(fallback: HardwareSpec): Promise<HardwareSpec> {
    let best: HardwareSpec = { ...fallback }
    for (const backend of this.backends) {
      try {
        const spec = await backend.detectHardware()
        if (spec.gpuAvailable && !best.gpuAvailable) best = spec
        if (spec.gpuAvailable && spec.vramGB > best.vramGB) best = spec
      } catch (err: any) {
        console.log(`[Hardware] ${backend.name} detection failed:`, err.message?.slice(0, 200))
      }
    }
    return best
  }

  async detectHardware(forceRefresh = false): Promise<HardwareSpec> {
    if (!forceRefresh) {
      const cached = this.loadCachedHardware()
      if (cached) {
        this.state = { ...this.state, hardware: cached }
        return cached
      }
    }

    const os = require('os')
    const fallback: HardwareSpec = {
      gpuAvailable: false,
      gpuName: 'CPU',
      vramGB: 0,
      cudaCores: 0,
      cpuCores: os.cpus().length,
      ramGB: Math.round(os.totalmem() / BYTES_PER_GB),
      backendType: 'python_cpu',
      numGPUs: 0,
      isAMD: false,
    }

    await this.detectNvidiaGpu(fallback)
    await this.detectWmiGpu(fallback)
    const best = await this.probeBackends(fallback)

    this.cacheHardware(best)
    this.state = { ...this.state, hardware: best }
    return best
  }

  async pickBestBackend(preferred?: BackendType): Promise<{ backend: FinetuneBackend; availability: BackendAvailability } | null> {
    if (preferred && preferred !== 'auto') {
      const specific = this.backends.find((b) => b.name.toLowerCase().includes(preferred))
      if (specific) {
        const availability = await specific.isAvailable()
        if (availability.available) return { backend: specific, availability }
        return null
      }
      return null
    }

    const llama = this.backends[0]
    const python = this.backends[1]

    const [llamaAvail, pythonAvail] = await Promise.all([llama.isAvailable(), python.isAvailable()])
    if (llamaAvail.available) return { backend: llama, availability: llamaAvail }
    if (pythonAvail.available) return { backend: python, availability: pythonAvail }
    return null
  }

  async prepareDataset(workspacePath: string, config?: DatasetConfig): Promise<DatasetManifest> {
    this.state = { ...this.state, status: 'preparing_dataset' }
    try {
      const manifest = await this.datasetService.scanWorkspace(
        workspacePath,
        config || DEFAULT_DATASET_CONFIG,
        (file, total) => this.emitEvent({ type: 'log', message: `Scanning: ${file} (${total} files)` })
      )
      this.state = { ...this.state, manifest, status: 'ready' }
      return manifest
    } catch (err: any) {
      this.state = { ...this.state, status: 'error', error: err.message }
      throw err
    }
  }

  async exportDataset(outputPath?: string): Promise<string> {
    const out = outputPath || this.getDefaultDatasetPath()
    const dir = path.dirname(out)
    const fs = require('fs')
    fs.mkdirSync(dir, { recursive: true })
    return this.datasetService.exportDataset(out)
  }

  async startTraining(rawOptions: Partial<FinetuneOptions>): Promise<void> {
    if (this.state.status === 'training') throw new Error('Training already in progress')

    this.currentOptions = { ...DEFAULT_FINETUNE_OPTIONS, ...rawOptions }
    this.state = {
      ...this.state,
      status: 'training',
      error: undefined,
      progress: undefined,
      startTime: Date.now(),
    }

    const result = await this.pickBestBackend(this.currentOptions.backend as BackendType)
    if (!result) {
      // Build a detailed error message about what's missing
      const backend = this.currentOptions.backend || 'auto'
      let errorMsg = 'No suitable backend found.'

      if (backend === 'python' || backend === 'auto') {
        const python = this.backends[1]
        const pyAvail = await python.isAvailable()
        if (!pyAvail.available) {
          errorMsg = pyAvail.error || 'Python backend unavailable.'
          if (pyAvail.missing) {
            errorMsg += `\n\nMissing: ${pyAvail.missing.join(', ')}`
          }
          if (pyAvail.details) {
            errorMsg += `\n\n${pyAvail.details}`
          }
        }
      } else if (backend === 'llamacpp') {
        const llama = this.backends[0]
        const llamaAvail = await llama.isAvailable()
        if (!llamaAvail.available) {
          errorMsg = llamaAvail.error || 'llama.cpp backend unavailable.'
        }
      }

      this.state = { ...this.state, status: 'error', error: errorMsg }
      throw new Error(errorMsg)
    }

    const { backend } = result
    this.selectedBackend = backend
    this.emitEvent({ type: 'log', message: `Using backend: ${backend.name}` })

    if (!this.currentOptions.datasetPath) {
      throw new Error('No dataset path set. Load or prepare a dataset first.')
    }

    await backend.prepareEnvironment(this.currentOptions)

    const sendFn: ProgressSender = (event) => this.emitEvent(event)
    try {
      await backend.startTraining(this.currentOptions, sendFn)
    } catch (err: any) {
      this.state = { ...this.state, status: 'error', error: err.message }
      throw err
    }
  }

  async stopTraining(): Promise<void> {
    if (this.selectedBackend) {
      this.state = { ...this.state, status: 'stopping' }
      await this.selectedBackend.stopTraining()
      this.state = { ...this.state, status: 'idle' }
    }
  }

  async reset(): Promise<void> {
    if (this.state.status === 'training') await this.stopTraining()
    this.state = { status: 'idle' }
    this.selectedBackend = null
    this.currentOptions = DEFAULT_FINETUNE_OPTIONS
  }

  private getDefaultDatasetPath(): string {
    try {
      const { app } = require('electron')
      if (app.isPackaged) {
        return path.join(app.getPath('documents'), 'SmartCursorX', 'finetuned', 'dataset.jsonl')
      }
    } catch {}
    return path.join(process.cwd(), 'finetuned', 'dataset.jsonl')
  }

  getBuiltinDatasetPath(): string {
    const filename = 'fable5_ft_instruction.jsonl'
    try {
      const { app } = require('electron')
      if (app.isPackaged) {
        return path.join(process.resourcesPath, 'datasets', filename)
      }
    } catch {}
    return path.join(process.cwd(), 'data-set', filename)
  }

  getBuiltinDatasetInfo(): { path: string; name: string; samples: number; description: string } {
    return {
      path: this.getBuiltinDatasetPath(),
      name: 'Fable 5 CoT (2000 samples)',
      samples: 2000,
      description: 'Pre-built instruction-tuning dataset from Fable 5 coding sessions. Full conversation context as input, chain-of-thought reasoning + action as output. Teaches the model to think step by step before responding.',
    }
  }

  getAdapterPath(): string | null {
    if (this.currentOptions && this.selectedBackend) {
      return this.selectedBackend.getModelPath(this.currentOptions)
    }
    return null
  }

  private filterViableModels(
    vram: number
  ): Array<{ model: typeof TOP_CODING_MODELS[0]; vramNeeded: number }> {
    return TOP_CODING_MODELS
      .map(m => ({ model: m, vramNeeded: estimateVRAM(m.archParams, '4bit').totalGB }))
      .filter(m => vram <= 0 || vram >= m.vramNeeded)
      .sort((a, b) => (TIER_SCORES[b.model.tier] ?? 0) - (TIER_SCORES[a.model.tier] ?? 0) || a.model.rank - b.model.rank)
  }

  private getBestQuant(
    archParams: typeof TOP_CODING_MODELS[0]['archParams'],
    vram: number
  ): QuantLevel {
    if (vram <= 0) return '4bit'
    const needed8 = estimateVRAM(archParams, '8bit').totalGB
    return vram >= needed8 ? '8bit' : '4bit'
  }

  private categorizeAlternatives(
    viableModels: Array<{ model: typeof TOP_CODING_MODELS[0]; vramNeeded: number }>,
    backend: BackendType,
    vram: number
  ): {
    python: Array<{ model: string; quantization: QuantLevel; backend: BackendType; reason: string; vramGB: number }>;
    javascript: Array<{ model: string; quantization: QuantLevel; backend: BackendType; reason: string; vramGB: number }>;
    general: Array<{ model: string; quantization: QuantLevel; backend: BackendType; reason: string; vramGB: number }>;
  } {
    const mapToEntry = (m: { model: typeof TOP_CODING_MODELS[0]; vramNeeded: number }) => ({
      model: m.model.id,
      quantization: this.getBestQuant(m.model.archParams, vram),
      backend,
      reason: m.model.description.split('.')[0],
      vramGB: m.vramNeeded,
    })
    return {
      python: viableModels.filter(m => m.model.tags.includes('python')).slice(0, 3).map(mapToEntry),
      javascript: viableModels.filter(m => m.model.tags.includes('javascript') || m.model.tags.includes('typescript')).slice(0, 3).map(mapToEntry),
      general: viableModels.filter(m => m.model.tags.includes('general') || (!m.model.tags.includes('python') && !m.model.tags.includes('javascript'))).slice(0, 2).map(mapToEntry),
    }
  }

  getRecommendation(hardware: HardwareSpec): {
    primary: { model: string; quantization: QuantLevel; backend: BackendType; reason: string } | null;
    alternatives: {
      python: Array<{ model: string; quantization: QuantLevel; backend: BackendType; reason: string; vramGB: number }>;
      javascript: Array<{ model: string; quantization: QuantLevel; backend: BackendType; reason: string; vramGB: number }>;
      general: Array<{ model: string; quantization: QuantLevel; backend: BackendType; reason: string; vramGB: number }>;
    };
  } | null {
    const vram = hardware.vramGB
    const backend: BackendType = hardware.backendType.startsWith('python') ? 'python' : 'llamacpp'

    const viableModels = this.filterViableModels(vram)

    if (viableModels.length === 0) {
      if (hardware.ramGB >= 16) {
        const model = TOP_CODING_MODELS.find(m => m.id === 'phi-3.5-mini')
        if (model) {
          return {
            primary: { model: 'phi-3.5-mini', quantization: '4bit', backend, reason: 'CPU-only fallback (16GB+ RAM)' },
            alternatives: { python: [], javascript: [], general: [] },
          }
        }
      }
      return null
    }

    const primaryModel = viableModels[0]
    const primary = {
      model: primaryModel.model.id,
      quantization: this.getBestQuant(primaryModel.model.archParams, vram),
      backend,
      reason: `Best overall (${primaryModel.model.tier}, rank ${primaryModel.model.rank})`,
    }

    return {
      primary,
      alternatives: this.categorizeAlternatives(viableModels, backend, vram),
    }
  }

  async checkPackages(): Promise<BackendAvailability> {
    const pythonBackend = this.backends[1] as PythonBackend
    if (!pythonBackend) {
      return { available: false, error: 'Python backend not initialized' }
    }
    return await pythonBackend.isAvailable()
  }

  async installDependencies(onLog: (msg: string) => void): Promise<void> {
    let scriptsDir = path.join(process.cwd(), 'scripts')
    try {
      const { app } = require('electron')
      if (app.isPackaged) {
        scriptsDir = path.join(process.resourcesPath, 'scripts')
      }
    } catch {}
    const reqPath = path.join(scriptsDir, 'requirements-ml.txt')
    if (!require('fs').existsSync(reqPath)) {
      throw new Error(`requirements-ml.txt not found at: ${reqPath}`)
    }

    onLog(`[Installer] Found requirements-ml.txt at: ${reqPath}`)
    onLog(`[Installer] Installing python packages...`)

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
    const { spawn } = require('child_process')

    return new Promise<void>((resolve, reject) => {
      const child = spawn(pythonCmd, ['-m', 'pip', 'install', '--user', '-r', reqPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      })

      child.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed) {
            onLog(trimmed)
          }
        }
      })

      child.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed) {
            onLog(`[stderr] ${trimmed}`)
          }
        }
      })

      child.on('close', (code: number | null) => {
        if (code === 0) {
          onLog('[Installer] Python dependencies installed successfully!')
          resolve()
        } else {
          onLog(`[Installer] Installation failed with exit code ${code}`)
          reject(new Error(`Installation failed with exit code ${code}`))
        }
      })

      child.on('error', (err: Error) => {
        onLog(`[Installer] Error spawning process: ${err.message}`)
        reject(err)
      })
    })
  }
}

export const finetuningService = new FinetuningService()
