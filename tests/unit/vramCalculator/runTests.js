// electron/services/VramCalculator.ts
var BYTES_PER_WEIGHT = {
  "4bit": 0.55,
  "8bit": 1,
  "16bit": 2
};
var gb = (bytes) => bytes / 1024 ** 3;
function estimateVRAM(arch, quant, opts) {
  const bs = opts?.batchSize ?? 4;
  const sl = opts?.seqLen ?? 2048;
  const rank = opts?.loraRank ?? 16;
  const numLoraModules = opts?.numLoraModules ?? 7;
  const bytesPerWeight = BYTES_PER_WEIGHT[quant];
  const weightsGB = gb(arch.numParams * bytesPerWeight);
  const loraParamsPerModule = 2 * arch.hiddenSize * rank;
  const totalLoraParams = arch.numLayers * numLoraModules * loraParamsPerModule;
  const loraAdaptersGB = gb(totalLoraParams * 2);
  const optimizerGB = gb(totalLoraParams * 2 * 4);
  const gradientsGB = gb(totalLoraParams * 2);
  const activationsGB = gb(bs * sl * arch.hiddenSize * 34 * 2);
  const overheadGB = 1.5;
  const total = Math.round(
    (weightsGB + loraAdaptersGB + optimizerGB + gradientsGB + activationsGB + overheadGB) * 10
  ) / 10;
  return {
    totalGB: total,
    components: [
      { label: "Weights", gb: weightsGB, detail: `${(arch.numParams / 1e9).toFixed(1)}B \xD7 ${bytesPerWeight} bytes/param` },
      { label: "LoRA adapters", gb: loraAdaptersGB, detail: `${(totalLoraParams / 1e6).toFixed(0)}M params \xD7 2 bytes (BF16)` },
      { label: "Optimizer (Adam)", gb: optimizerGB, detail: `2 states \xD7 ${(totalLoraParams / 1e6).toFixed(0)}M params \xD7 4 bytes` },
      { label: "Gradients", gb: gradientsGB, detail: `${(totalLoraParams / 1e6).toFixed(0)}M params \xD7 2 bytes (BF16)` },
      { label: "Activations", gb: activationsGB, detail: `Batch ${bs} \xD7 seq ${sl} \xD7 hidden ${arch.hiddenSize} \xD7 34 \xD7 2 bytes, GC enabled` },
      { label: "Overhead", gb: overheadGB, detail: "CUDA context + miscellaneous buffers" }
    ]
  };
}
function computeRecommendedVRAM(arch, opts) {
  return {
    "4bit": estimateVRAM(arch, "4bit", opts).totalGB,
    "8bit": estimateVRAM(arch, "8bit", opts).totalGB,
    "16bit": estimateVRAM(arch, "16bit", opts).totalGB
  };
}
function vramHeadroom(detectedGB, neededGB) {
  if (neededGB <= 0) return 1;
  return (detectedGB - neededGB) / neededGB;
}

// tests/unit/vramCalculator/runTests.ts
var passed = 0;
var failed = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}
function assertClose(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    console.error(`FAIL: ${message} \u2014 expected ${expected} \xB1 ${tolerance}, got ${actual}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}
async function run() {
  console.log("--- VRAM CALCULATOR UNIT TESTS ---");
  const qwen25Coder7B = { numParams: 762e7, hiddenSize: 3584, numLayers: 28, numHeads: 28 };
  const deepseekCoder6_7B = { numParams: 67e8, hiddenSize: 4096, numLayers: 30, numHeads: 32 };
  const llama3_8B = { numParams: 803e7, hiddenSize: 4096, numLayers: 32, numHeads: 32 };
  const est1 = estimateVRAM(qwen25Coder7B, "4bit");
  assertClose(est1.totalGB, 8, 2, "7B 4-bit ~8 GB total");
  assert(est1.components.length === 6, "6 VRAM components returned");
  const weightComp = est1.components.find((c) => c.label === "Weights");
  assert(weightComp !== void 0, "Weights component present");
  if (weightComp) {
    assertClose(weightComp.gb, 7.62 * 0.55 / 1.074, 1, "Weights = 7.62B \xD7 0.55 bytes / GB");
  }
  const est2 = estimateVRAM(qwen25Coder7B, "8bit");
  assertClose(est2.totalGB, 10.7, 1, "7B 8-bit ~10.7 GB total");
  const est3 = estimateVRAM(qwen25Coder7B, "16bit");
  assertClose(est3.totalGB, 17.8, 1, "7B 16-bit ~17.8 GB total");
  const estSmall = estimateVRAM(deepseekCoder6_7B, "4bit");
  const estLarge = estimateVRAM(llama3_8B, "4bit");
  assert(estLarge.totalGB >= estSmall.totalGB, "8B model needs >= VRAM than 6.7B model");
  const est4bit = estimateVRAM(qwen25Coder7B, "4bit");
  const est8bit = estimateVRAM(qwen25Coder7B, "8bit");
  const est16bit = estimateVRAM(qwen25Coder7B, "16bit");
  assert(est8bit.totalGB > est4bit.totalGB, "8-bit > 4-bit VRAM");
  assert(est16bit.totalGB > est8bit.totalGB, "16-bit > 8-bit VRAM");
  const rec = computeRecommendedVRAM(qwen25Coder7B);
  assert(rec["4bit"] > 0, "4bit recommendation > 0");
  assert(rec["8bit"] > 0, "8bit recommendation > 0");
  assert(rec["16bit"] > 0, "16bit recommendation > 0");
  assert(rec["16bit"] > rec["8bit"], "16bit > 8bit in recommendations");
  const headroom = vramHeadroom(24, 8);
  assertClose(headroom, 2, 0.1, "24 GB / 8 GB = 2.0 headroom");
  const tight = vramHeadroom(6, 8);
  assert(tight < 0, "6 GB / 8 GB = negative headroom");
  const equal = vramHeadroom(8, 8);
  assertClose(equal, 0, 0.01, "8 GB / 8 GB = 0 headroom");
  const zeroNeeded = vramHeadroom(8, 0);
  assert(zeroNeeded === 1, "vramHeadroom(8, 0) = 1");
  const batch2 = estimateVRAM(qwen25Coder7B, "4bit", { batchSize: 2 });
  const batch4 = estimateVRAM(qwen25Coder7B, "4bit", { batchSize: 4 });
  assert(batch2.totalGB < batch4.totalGB, "batch 2 < batch 4 VRAM");
  const rank8 = estimateVRAM(qwen25Coder7B, "4bit", { loraRank: 8 });
  const rank32 = estimateVRAM(qwen25Coder7B, "4bit", { loraRank: 32 });
  assert(rank8.totalGB < rank32.totalGB, "LoRA rank 8 < rank 32 VRAM");
  const seq1024 = estimateVRAM(qwen25Coder7B, "4bit", { seqLen: 1024 });
  const seq4096 = estimateVRAM(qwen25Coder7B, "4bit", { seqLen: 4096 });
  assert(seq1024.totalGB < seq4096.totalGB, "seq 1024 < seq 4096 VRAM");
  const estDeep = estimateVRAM(deepseekCoder6_7B, "4bit");
  const estLlama = estimateVRAM(llama3_8B, "4bit");
  assert(estLlama.totalGB !== estDeep.totalGB, "deepseek-6.7B != llama-8B VRAM");
  assert(est1.totalGB >= 1, "No estimate under 1 GB");
  assert(est2.totalGB >= 1, "No 8-bit estimate under 1 GB");
  assert(est3.totalGB >= 1, "No 16-bit estimate under 1 GB");
  console.log(`
--- RESULTS: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}
run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
