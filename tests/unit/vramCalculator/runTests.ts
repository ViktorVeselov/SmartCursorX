import { estimateVRAM, computeRecommendedVRAM, vramHeadroom, type ModelArchParams } from '../../../electron/services/VramCalculator'

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failed++
  } else {
    console.log(`PASS: ${message}`)
    passed++
  }
}

function assertClose(actual: number, expected: number, tolerance: number, message: string) {
  if (Math.abs(actual - expected) > tolerance) {
    console.error(`FAIL: ${message} — expected ${expected} ± ${tolerance}, got ${actual}`)
    failed++
  } else {
    console.log(`PASS: ${message}`)
    passed++
  }
}

async function run() {
  console.log('--- VRAM CALCULATOR UNIT TESTS ---')

  // Known model archParams
  const qwen25Coder7B: ModelArchParams = { numParams: 7.62e9, hiddenSize: 3584, numLayers: 28, numHeads: 28 }
  const deepseekCoder6_7B: ModelArchParams = { numParams: 6.7e9, hiddenSize: 4096, numLayers: 30, numHeads: 32 }
  const llama3_8B: ModelArchParams = { numParams: 8.03e9, hiddenSize: 4096, numLayers: 32, numHeads: 32 }

  // Test 1: 7B 4-bit estimate ~8 GB
  const est1 = estimateVRAM(qwen25Coder7B, '4bit')
  assertClose(est1.totalGB, 8, 2, '7B 4-bit ~8 GB total')
  assert(est1.components.length === 6, '6 VRAM components returned')

  const weightComp = est1.components.find(c => c.label === 'Weights')
  assert(weightComp !== undefined, 'Weights component present')
  if (weightComp) {
    assertClose(weightComp.gb, 7.62 * 0.55 / 1.074, 1, 'Weights = 7.62B × 0.55 bytes / GB')
  }

  // Test 2: 7B 8-bit estimate ~10-11 GB
  const est2 = estimateVRAM(qwen25Coder7B, '8bit')
  assertClose(est2.totalGB, 10.7, 1, '7B 8-bit ~10.7 GB total')

  // Test 3: 7B 16-bit estimate ~17-18 GB
  const est3 = estimateVRAM(qwen25Coder7B, '16bit')
  assertClose(est3.totalGB, 17.8, 1, '7B 16-bit ~17.8 GB total')

  // Test 4: Larger model uses more VRAM
  const estSmall = estimateVRAM(deepseekCoder6_7B, '4bit')
  const estLarge = estimateVRAM(llama3_8B, '4bit')
  assert(estLarge.totalGB >= estSmall.totalGB, '8B model needs >= VRAM than 6.7B model')

  // Test 5: Higher quantization uses more VRAM
  const est4bit = estimateVRAM(qwen25Coder7B, '4bit')
  const est8bit = estimateVRAM(qwen25Coder7B, '8bit')
  const est16bit = estimateVRAM(qwen25Coder7B, '16bit')
  assert(est8bit.totalGB > est4bit.totalGB, '8-bit > 4-bit VRAM')
  assert(est16bit.totalGB > est8bit.totalGB, '16-bit > 8-bit VRAM')

  // Test 6: computeRecommendedVRAM returns all 3 quant levels
  const rec = computeRecommendedVRAM(qwen25Coder7B)
  assert(rec['4bit'] > 0, '4bit recommendation > 0')
  assert(rec['8bit'] > 0, '8bit recommendation > 0')
  assert(rec['16bit'] > 0, '16bit recommendation > 0')
  assert(rec['16bit'] > rec['8bit'], '16bit > 8bit in recommendations')

  // Test 7: vramHeadroom positive when enough VRAM
  const headroom = vramHeadroom(24, 8)
  assertClose(headroom, 2.0, 0.1, '24 GB / 8 GB = 2.0 headroom')

  // Test 8: vramHeadroom negative when insufficient
  const tight = vramHeadroom(6, 8)
  assert(tight < 0, '6 GB / 8 GB = negative headroom')

  // Test 9: vramHeadroom zero when equal
  const equal = vramHeadroom(8, 8)
  assertClose(equal, 0, 0.01, '8 GB / 8 GB = 0 headroom')

  // Test 10: vramHeadroom handles 0 needed (edge case)
  const zeroNeeded = vramHeadroom(8, 0)
  assert(zeroNeeded === 1, 'vramHeadroom(8, 0) = 1')

  // Test 11: Custom batch size reduces VRAM
  const batch2 = estimateVRAM(qwen25Coder7B, '4bit', { batchSize: 2 })
  const batch4 = estimateVRAM(qwen25Coder7B, '4bit', { batchSize: 4 })
  assert(batch2.totalGB < batch4.totalGB, 'batch 2 < batch 4 VRAM')

  // Test 12: Custom LoRA rank increases VRAM
  const rank8 = estimateVRAM(qwen25Coder7B, '4bit', { loraRank: 8 })
  const rank32 = estimateVRAM(qwen25Coder7B, '4bit', { loraRank: 32 })
  assert(rank8.totalGB < rank32.totalGB, 'LoRA rank 8 < rank 32 VRAM')

  // Test 13: Longer sequence increases VRAM
  const seq1024 = estimateVRAM(qwen25Coder7B, '4bit', { seqLen: 1024 })
  const seq4096 = estimateVRAM(qwen25Coder7B, '4bit', { seqLen: 4096 })
  assert(seq1024.totalGB < seq4096.totalGB, 'seq 1024 < seq 4096 VRAM')

  // Test 14: Different model architectures give different results
  const estDeep = estimateVRAM(deepseekCoder6_7B, '4bit')
  const estLlama = estimateVRAM(llama3_8B, '4bit')
  assert(estLlama.totalGB !== estDeep.totalGB, 'deepseek-6.7B != llama-8B VRAM')

  // Test 15: Minimum VRAM sanity — no model should report < 1 GB
  assert(est1.totalGB >= 1, 'No estimate under 1 GB')
  assert(est2.totalGB >= 1, 'No 8-bit estimate under 1 GB')
  assert(est3.totalGB >= 1, 'No 16-bit estimate under 1 GB')

  // Summary
  console.log(`\n--- RESULTS: ${passed} passed, ${failed} failed ---`)
  if (failed > 0) process.exit(1)
}

run().catch(err => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
