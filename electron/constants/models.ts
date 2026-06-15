import { computeRecommendedVRAM, type QuantLevel, type ModelArchParams, type VramEstimate } from '../services/VramCalculator'

export type ModelTier = 'verified' | 'community' | 'experimental'

export interface ModelBenchmarks {
  humaneval?: number
  liveCodeBench?: number
}

export interface FinetuneModel {
  id: string
  name: string
  description: string
  hfRepo: string
  parameterSize: string
  archParams: ModelArchParams
  recommendedVRAM: Record<QuantLevel, number>
  defaultQuantization: QuantLevel
  contextWindow: number
  tags: string[]
  rank: number
  tier: ModelTier
  benchmarks: ModelBenchmarks
  knownIssues: string[]
  vramEstimates?: Record<QuantLevel, VramEstimate>
}

const defaultVramOpts = { batchSize: 4, seqLen: 2048, loraRank: 16 }

export const TOP_CODING_MODELS: FinetuneModel[] = [
  {
    id: 'qwen2.5-coder-7b',
    name: 'Qwen 2.5 Coder 7B',
    description: 'Best all-round small coder — strong Python, JS, Rust, Go. #1 on LiveCodeBench at this size.',
    hfRepo: 'Qwen/Qwen2.5-Coder-7B-Instruct',
    parameterSize: '7.6B',
    archParams: { numParams: 7.6e9, hiddenSize: 4096, numLayers: 32, numHeads: 32 },
    recommendedVRAM: computeRecommendedVRAM(
      { numParams: 7.6e9, hiddenSize: 4096, numLayers: 32, numHeads: 32 },
      defaultVramOpts
    ),
    defaultQuantization: '4bit',
    contextWindow: 32768,
    tags: ['python', 'javascript', 'rust', 'go', 'java'],
    rank: 1,
    tier: 'verified',
    benchmarks: { humaneval: 88, liveCodeBench: 72 },
    knownIssues: [],
  },
  {
    id: 'deepseek-coder-6.7b',
    name: 'DeepSeek Coder 6.7B',
    description: 'Code-pretrained from scratch. Excellent fill-in-the-middle and multi-file understanding.',
    hfRepo: 'deepseek-ai/deepseek-coder-6.7b-instruct',
    parameterSize: '6.7B',
    archParams: { numParams: 6.7e9, hiddenSize: 4096, numLayers: 32, numHeads: 32 },
    recommendedVRAM: computeRecommendedVRAM(
      { numParams: 6.7e9, hiddenSize: 4096, numLayers: 32, numHeads: 32 },
      defaultVramOpts
    ),
    defaultQuantization: '4bit',
    contextWindow: 16384,
    tags: ['python', 'javascript', 'java', 'cpp'],
    rank: 2,
    tier: 'verified',
    benchmarks: { humaneval: 85, liveCodeBench: 68 },
    knownIssues: ['Older architecture; newer DeepSeek-Coder-V2 recommended for production'],
  },
  {
    id: 'codellama-7b',
    name: 'Code Llama 7B',
    description: 'Meta — most widely tested local coder. Strong at code completion and infilling.',
    hfRepo: 'codellama/CodeLlama-7b-Instruct-hf',
    parameterSize: '7B',
    archParams: { numParams: 7e9, hiddenSize: 4096, numLayers: 32, numHeads: 32 },
    recommendedVRAM: computeRecommendedVRAM(
      { numParams: 7e9, hiddenSize: 4096, numLayers: 32, numHeads: 32 },
      defaultVramOpts
    ),
    defaultQuantization: '4bit',
    contextWindow: 16384,
    tags: ['python', 'javascript', 'general'],
    rank: 3,
    tier: 'community',
    benchmarks: { humaneval: 84, liveCodeBench: 48 },
    knownIssues: ['HumanEval score likely overfitted; real-world performance is lower'],
  },
  {
    id: 'phi-3.5-mini',
    name: 'Phi-3.5 Mini 3.8B',
    description: 'Microsoft — tiny enough for 6GB GPUs. Great for code reasoning given its size.',
    hfRepo: 'microsoft/Phi-3.5-mini-instruct',
    parameterSize: '3.8B',
    archParams: { numParams: 3.8e9, hiddenSize: 3072, numLayers: 32, numHeads: 32 },
    recommendedVRAM: computeRecommendedVRAM(
      { numParams: 3.8e9, hiddenSize: 3072, numLayers: 32, numHeads: 32 },
      defaultVramOpts
    ),
    defaultQuantization: '4bit',
    contextWindow: 32768,
    tags: ['python', 'javascript', 'reasoning'],
    rank: 4,
    tier: 'community',
    benchmarks: { humaneval: 69, liveCodeBench: 35 },
    knownIssues: ['Small context-optimized training set; may struggle on niche languages'],
  },
  {
    id: 'granite-3b-code',
    name: 'Granite 3B Code Instruct',
    description: 'IBM — purpose-built for code. Runs on 6GB cards with 4-bit.',
    hfRepo: 'ibm-granite/granite-3b-code-instruct',
    parameterSize: '3B',
    archParams: { numParams: 3.1e9, hiddenSize: 2560, numLayers: 32, numHeads: 20 },
    recommendedVRAM: computeRecommendedVRAM(
      { numParams: 3.1e9, hiddenSize: 2560, numLayers: 32, numHeads: 20 },
      defaultVramOpts
    ),
    defaultQuantization: '4bit',
    contextWindow: 8192,
    tags: ['python', 'javascript', 'java', 'go'],
    rank: 5,
    tier: 'experimental',
    benchmarks: { humaneval: 61, liveCodeBench: 28 },
    knownIssues: ['Limited third-party validation; fewer community fine-tunes available'],
  },
]

export const QUANTIZATION_OPTIONS = [
  { value: '4bit', label: '4-bit (QLoRA NF4)', description: 'Best memory efficiency — ~99% of full-precision quality' },
  { value: '8bit', label: '8-bit (QLoRA FP8)', description: 'Balanced memory and quality' },
  { value: '16bit', label: '16-bit (LoRA BF16)', description: 'Maximum quality — needs ample VRAM' },
] as const

export type QuantizationLevel = (typeof QUANTIZATION_OPTIONS)[number]['value']

export const BACKEND_OPTIONS = [
  { value: 'auto', label: 'Auto-detect', description: 'Pick best available backend (recommended)' },
  { value: 'llamacpp', label: 'llama.cpp', description: 'Native GGUF — no Python needed' },
  { value: 'python', label: 'Python (PyTorch)', description: 'Full PEFT/transformers — most flexible' },
] as const

export type BackendType = (typeof BACKEND_OPTIONS)[number]['value']

export interface DatasetConfig {
  maxSamples: number
  maxInputLength: number
  minCodeLength: number
  includeTests: boolean
  includeConfig: boolean
  taskTypes: DatasetTaskType[]
}

export type DatasetTaskType =
  | 'explain'
  | 'complete'
  | 'refactor'
  | 'docstring'
  | 'bug_detection'

export const DEFAULT_DATASET_CONFIG: DatasetConfig = {
  maxSamples: 500,
  maxInputLength: 4096,
  minCodeLength: 50,
  includeTests: true,
  includeConfig: false,
  taskTypes: ['explain', 'complete', 'refactor'],
}

export const ALLOWED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java',
  '.cpp', '.c', '.h', '.hpp', '.rb', '.php', '.swift', '.kt',
  '.scala', '.r', '.m', '.mm',
])
