import { FinetuneBackend, FinetuneOptions, TrainingEvent, TrainingProgress, HardwareSpec, DEFAULT_FINETUNE_OPTIONS } from './backends/BaseFinetuneBackend'
import { LlamaCppBackend } from './backends/LlamaCppBackend'
import { PythonBackend } from './backends/PythonBackend'
import { datasetService, DatasetManifest } from './DatasetService'
import { DatasetConfig, DEFAULT_DATASET_CONFIG, TOP_CODING_MODELS, BackendType } from '../constants/models'
import { estimateVRAM, type VramEstimate, type QuantLevel } from './VramCalculator'
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

  async detectHardware(): Promise<HardwareSpec> {
    const os = require('os')
    const fallback: HardwareSpec = {
      gpuAvailable: false,
      gpuName: 'CPU',
      vramGB: 0,
      cudaCores: 0,
      cpuCores: os.cpus().length,
      ramGB: Math.round(os.totalmem() / (1024 ** 3)),
      backendType: 'python_cpu',
      numGPUs: 0,
      isAMD: false,
    }

    // 1) Try native nvidia-smi first (works without Python)
    try {
      const out = require('child_process').execSync(
        'nvidia-smi --query-gpu=name,memory.total,count --format=csv,noheader 2>&1',
        { timeout: 5000, encoding: 'utf-8' }
      )
      const lines = out.trim().split('\n')
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
    } catch {}

    // 2) If no GPU yet on Windows, try PowerShell WMI
    if (!fallback.gpuAvailable && process.platform === 'win32') {
      try {
        const psOut = require('child_process').execSync(
          'powershell -Command "Get-WmiObject Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json" 2>&1',
          { timeout: 5000, encoding: 'utf-8' }
        )
        const parsed = JSON.parse(psOut.trim())
        const entries = Array.isArray(parsed) ? parsed : [parsed]
        const dedicated = entries.find((e: any) => e.AdapterRAM && parseInt(e.AdapterRAM) > 0)
        if (dedicated) {
          fallback.gpuAvailable = true
          fallback.gpuName = dedicated.Name
          fallback.numGPUs = entries.filter((e: any) => e.AdapterRAM && parseInt(e.AdapterRAM) > 0).length
          fallback.vramGB = Math.round(parseInt(dedicated.AdapterRAM) / (1024 ** 3))
          fallback.isAMD = /amd|radeon/i.test(dedicated.Name)
          fallback.backendType = fallback.isAMD ? 'python_rocm' : 'python_cuda'
        }
      } catch {}
    }

    // 3) Try backends (may refine with Python-based detection if torch available)
    let best: HardwareSpec = { ...fallback }
    for (const backend of this.backends) {
      try {
        const spec = await backend.detectHardware()
        if (spec.gpuAvailable && !best.gpuAvailable) best = spec
        if (spec.gpuAvailable && spec.vramGB > best.vramGB) best = spec
      } catch {}
    }

    this.state = { ...this.state, hardware: best }
    return best
  }

  async pickBestBackend(preferred?: BackendType): Promise<FinetuneBackend | null> {
    if (preferred && preferred !== 'auto') {
      const specific = this.backends.find((b) => b.name.toLowerCase().includes(preferred))
      if (specific && await specific.isAvailable()) return specific
      return null
    }

    const llama = this.backends[0]
    const python = this.backends[1]

    const [llamaAvail, pythonAvail] = await Promise.all([llama.isAvailable(), python.isAvailable()])
    if (llamaAvail) return llama
    if (pythonAvail) return python
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
    const out = outputPath || path.join(process.cwd(), 'finetuned', 'dataset.jsonl')
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

    const backend = await this.pickBestBackend(this.currentOptions.backend as BackendType)
    if (!backend) {
      this.state = { ...this.state, status: 'error', error: 'No suitable backend found. Install llama.cpp or Python + PyTorch.' }
      throw new Error(this.state.error)
    }

    this.selectedBackend = backend
    this.emitEvent({ type: 'log', message: `Using backend: ${backend.name}` })

    if (!this.currentOptions.datasetPath) {
      throw new Error('No dataset path set. Call prepareDataset and exportDataset first.')
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

  getRecommendation(hardware: HardwareSpec): { model: string; quantization: QuantLevel; backend: BackendType } | null {
    const vram = hardware.vramGB
    const sorted = [...TOP_CODING_MODELS].sort((a, b) => {
      const tierScore: Record<string, number> = { verified: 3, community: 2, experimental: 1 }
      return (tierScore[b.tier] ?? 0) - (tierScore[a.tier] ?? 0) || a.rank - b.rank
    })

    for (const model of sorted) {
      if (vram <= 0) {
        return { model: model.id, quantization: '4bit', backend: hardware.backendType.startsWith('python') ? 'python' : 'llamacpp' }
      }
      const needed4 = estimateVRAM(model.archParams, '4bit').totalGB
      if (vram >= needed4) {
        const needed8 = estimateVRAM(model.archParams, '8bit').totalGB
        const bestQuant: QuantLevel = vram >= needed8 ? '8bit' : '4bit'
        return {
          model: model.id,
          quantization: bestQuant,
          backend: hardware.backendType.startsWith('python') ? 'python' : 'llamacpp',
        }
      }
    }

    if (hardware.ramGB >= 16) {
      return {
        model: 'phi-3.5-mini',
        quantization: '4bit',
        backend: hardware.backendType.startsWith('python') ? 'python' : 'llamacpp',
      }
    }
    return null
  }
}

export const finetuningService = new FinetuningService()
