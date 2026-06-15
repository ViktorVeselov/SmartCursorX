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

export interface FinetuneBackend {
  readonly name: string
  readonly capabilities: BackendCapability[]

  detectHardware(): Promise<HardwareSpec>
  isAvailable(): Promise<boolean>
  prepareEnvironment(options: FinetuneOptions): Promise<void>
  startTraining(options: FinetuneOptions, onEvent: (event: TrainingEvent) => void): Promise<void>
  stopTraining(): Promise<void>
  getModelPath(options: FinetuneOptions): string
}
