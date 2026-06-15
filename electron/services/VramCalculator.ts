export type QuantLevel = '4bit' | '8bit' | '16bit'

const BYTES_PER_WEIGHT: Record<QuantLevel, number> = {
  '4bit': 0.55,
  '8bit': 1.0,
  '16bit': 2.0,
}

export interface ModelArchParams {
  numParams: number
  hiddenSize: number
  numLayers: number
  numHeads: number
}

export interface VramComponent {
  label: string
  gb: number
  detail: string
}

export interface VramEstimate {
  totalGB: number
  components: VramComponent[]
}

const gb = (bytes: number) => bytes / (1024 ** 3)

export interface VramInput {
  batchSize?: number
  seqLen?: number
  loraRank?: number
  numLoraModules?: number
}

export function estimateVRAM(
  arch: ModelArchParams,
  quant: QuantLevel,
  opts?: VramInput
): VramEstimate {
  const bs = opts?.batchSize ?? 4
  const sl = opts?.seqLen ?? 2048
  const rank = opts?.loraRank ?? 16
  const numLoraModules = opts?.numLoraModules ?? 7

  // Weights = params × bytes per param for the quantization level
  const bytesPerWeight = BYTES_PER_WEIGHT[quant]
  const weightsGB = gb(arch.numParams * bytesPerWeight)

  // LoRA adapter params: each module has A (hidden×rank) and B (rank×hidden)
  // stored in BF16 (2 bytes)
  const loraParamsPerModule = 2 * arch.hiddenSize * rank
  const totalLoraParams = arch.numLayers * numLoraModules * loraParamsPerModule
  const loraAdaptersGB = gb(totalLoraParams * 2)

  // Adam optimizer: 2 states (first and second moment), stored in FP32 (4 bytes)
  const optimizerGB = gb(totalLoraParams * 2 * 4)

  // Gradients stored in BF16 (2 bytes)
  const gradientsGB = gb(totalLoraParams * 2)

  // Activations with gradient checkpointing: ~34× hidden dimension worth per step
  // Factor accounts for attention projections, scores, MLP intermediates, residual streams
  const activationsGB = gb(bs * sl * arch.hiddenSize * 34 * 2)

  // CUDA context, tokenizer, misc buffers
  const overheadGB = 1.5

  const total = Math.round(
    (weightsGB + loraAdaptersGB + optimizerGB + gradientsGB + activationsGB + overheadGB) * 10
  ) / 10

  return {
    totalGB: total,
    components: [
      { label: 'Weights', gb: weightsGB, detail: `${(arch.numParams / 1e9).toFixed(1)}B × ${bytesPerWeight} bytes/param` },
      { label: 'LoRA adapters', gb: loraAdaptersGB, detail: `${(totalLoraParams / 1e6).toFixed(0)}M params × 2 bytes (BF16)` },
      { label: 'Optimizer (Adam)', gb: optimizerGB, detail: `2 states × ${(totalLoraParams / 1e6).toFixed(0)}M params × 4 bytes` },
      { label: 'Gradients', gb: gradientsGB, detail: `${(totalLoraParams / 1e6).toFixed(0)}M params × 2 bytes (BF16)` },
      { label: 'Activations', gb: activationsGB, detail: `Batch ${bs} × seq ${sl} × hidden ${arch.hiddenSize} × 34 × 2 bytes, GC enabled` },
      { label: 'Overhead', gb: overheadGB, detail: 'CUDA context + miscellaneous buffers' },
    ],
  }
}

export function computeRecommendedVRAM(
  arch: ModelArchParams,
  opts?: VramInput
): Record<QuantLevel, number> {
  return {
    '4bit': estimateVRAM(arch, '4bit', opts).totalGB,
    '8bit': estimateVRAM(arch, '8bit', opts).totalGB,
    '16bit': estimateVRAM(arch, '16bit', opts).totalGB,
  }
}

export function vramHeadroom(detectedGB: number, neededGB: number): number {
  if (neededGB <= 0) return 1
  return (detectedGB - neededGB) / neededGB
}
