export interface HardwareSpec {
  gpuAvailable: boolean
  gpuName: string
  vramGB: number
  cudaCores: number
  cpuCores: number
  ramGB: number
  backendType: BackendCapability
  numGPUs: number
  isAMD: boolean
  rocmVersion?: string
}

export type BackendCapability = 'llamacpp' | 'python_cuda' | 'python_rocm' | 'python_mps' | 'python_cpu' | 'none'

export const BYTES_PER_GB = 1024 ** 3
export const CACHE_TTL_DAYS = 30
export const DDP_MAX_GPUS = 8
export const TORCHRUN_MASTER_PORT = '29500'
export const STOP_TIMEOUT_MS = 5000
export const DETECT_TIMEOUT_MS = 5000
export const PYTHON_IMPORT_TIMEOUT_MS = 30000

export const QUANT_FORMAT_MAP: Record<string, string> = {
  '4bit': 'q4_0',
  '8bit': 'q8_0',
}

export const TIER_SCORES: Record<string, number> = {
  verified: 3,
  community: 2,
  experimental: 1,
}

export function commandExists(cmd: string, timeoutMs = DETECT_TIMEOUT_MS): boolean {
  try {
    const { execSync } = require('child_process')
    execSync(`${cmd} --version`, { stdio: 'pipe', timeout: timeoutMs })
    return true
  } catch {
    try {
      const { execSync } = require('child_process')
      execSync(`${cmd} --help`, { stdio: 'pipe', timeout: timeoutMs })
      return true
    } catch {
      return false
    }
  }
}

export function runCommand(cmd: string, timeoutMs = DETECT_TIMEOUT_MS): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const { exec } = require('child_process')
    exec(cmd, { timeout: timeoutMs, encoding: 'utf-8' }, (err: any, stdout: string, stderr: string) => {
      if (err) {
        resolve({ ok: false, stdout: '', stderr: err.message || 'Command failed' })
      } else {
        resolve({ ok: true, stdout: stdout.trim(), stderr: stderr || '' })
      }
    })
  })
}

export interface TrainingProgress {
  epoch: number
  totalEpochs: number
  step: number
  totalSteps: number
  loss: number
  learningRate: number
  gradNorm: number
  tokensPerSecond: number
  elapsedSeconds: number
  estimatedTotalSeconds: number
}

export type TrainingEvent =
  | { type: 'progress'; data: TrainingProgress }
  | { type: 'log'; message: string }
  | { type: 'error'; message: string }
  | { type: 'done'; adapterPath: string; modelPath: string }
  | { type: 'hardware'; spec: HardwareSpec }

export interface FinetuneOptions {
  modelId: string
  quantization: '4bit' | '8bit' | '16bit'
  backend: 'auto' | 'llamacpp' | 'python'
  datasetPath: string
  outputDir: string
  learningRate: number
  numEpochs: number
  batchSize: number
  maxSeqLength: number
  loraRank: number
  loraAlpha: number
  loraDropout: number
  warmupSteps: number
  useUnsloth: boolean
  numGPUs: number
  multiGPUMode: 'auto' | 'ddp' | 'fsdp' | 'deepspeed'
  nnodes: number
  nodeRank: number
  masterAddr: string
  isAMD: boolean
}

export const DEFAULT_FINETUNE_OPTIONS: FinetuneOptions = {
  modelId: 'qwen2.5-coder-7b',
  quantization: '4bit',
  backend: 'auto',
  datasetPath: '',
  outputDir: '',
  learningRate: 2e-4,
  numEpochs: 3,
  batchSize: 4,
  maxSeqLength: 2048,
  loraRank: 16,
  loraAlpha: 32,
  loraDropout: 0.05,
  warmupSteps: 50,
  useUnsloth: true,
  numGPUs: 1,
  multiGPUMode: 'auto',
  nnodes: 1,
  nodeRank: 0,
  masterAddr: '127.0.0.1',
  isAMD: false,
}

export interface BackendAvailability {
  available: boolean
  error?: string
  missing?: string[]
  details?: string
}

export interface FinetuneBackend {
  readonly name: string
  readonly capabilities: BackendCapability[]

  detectHardware(): Promise<HardwareSpec>
  isAvailable(): Promise<BackendAvailability>
  prepareEnvironment(options: FinetuneOptions): Promise<void>
  startTraining(options: FinetuneOptions, onEvent: (event: TrainingEvent) => void): Promise<void>
  stopTraining(): Promise<void>
  getModelPath(options: FinetuneOptions): string
}
