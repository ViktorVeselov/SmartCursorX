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

// electron/constants/models.ts
var defaultVramOpts = { batchSize: 4, seqLen: 2048, loraRank: 16 };
var TOP_CODING_MODELS = [
  {
    id: "qwen2.5-coder-7b",
    name: "Qwen 2.5 Coder 7B",
    description: "Best all-round small coder \u2014 strong Python, JS, Rust, Go. #1 on LiveCodeBench at this size.",
    hfRepo: "Qwen/Qwen2.5-Coder-7B-Instruct",
    parameterSize: "7.6B",
    archParams: { numParams: 76e8, hiddenSize: 4096, numLayers: 32, numHeads: 32 },
    recommendedVRAM: computeRecommendedVRAM(
      { numParams: 76e8, hiddenSize: 4096, numLayers: 32, numHeads: 32 },
      defaultVramOpts
    ),
    defaultQuantization: "4bit",
    contextWindow: 32768,
    tags: ["python", "javascript", "rust", "go", "java"],
    rank: 1,
    tier: "verified",
    benchmarks: { humaneval: 88, liveCodeBench: 72 },
    knownIssues: []
  },
  {
    id: "deepseek-coder-6.7b",
    name: "DeepSeek Coder 6.7B",
    description: "Code-pretrained from scratch. Excellent fill-in-the-middle and multi-file understanding.",
    hfRepo: "deepseek-ai/deepseek-coder-6.7b-instruct",
    parameterSize: "6.7B",
    archParams: { numParams: 67e8, hiddenSize: 4096, numLayers: 32, numHeads: 32 },
    recommendedVRAM: computeRecommendedVRAM(
      { numParams: 67e8, hiddenSize: 4096, numLayers: 32, numHeads: 32 },
      defaultVramOpts
    ),
    defaultQuantization: "4bit",
    contextWindow: 16384,
    tags: ["python", "javascript", "java", "cpp"],
    rank: 2,
    tier: "verified",
    benchmarks: { humaneval: 85, liveCodeBench: 68 },
    knownIssues: ["Older architecture; newer DeepSeek-Coder-V2 recommended for production"]
  },
  {
    id: "qwen2.5-coder-1.5b",
    name: "Qwen 2.5 Coder 1.5B",
    description: "Ultra-light Python/JS coder. Fits on 4GB VRAM with 4-bit. Strong for its size.",
    hfRepo: "Qwen/Qwen2.5-Coder-1.5B-Instruct",
    parameterSize: "1.5B",
    archParams: { numParams: 15e8, hiddenSize: 1536, numLayers: 28, numHeads: 12 },
    recommendedVRAM: computeRecommendedVRAM(
      { numParams: 15e8, hiddenSize: 1536, numLayers: 28, numHeads: 12 },
      defaultVramOpts
    ),
    defaultQuantization: "4bit",
    contextWindow: 32768,
    tags: ["python", "javascript", "rust"],
    rank: 3,
    tier: "verified",
    benchmarks: { humaneval: 58, liveCodeBench: 42 },
    knownIssues: ["Limited capacity for complex multi-file tasks"]
  },
  {
    id: "deepseek-coder-1.3b",
    name: "DeepSeek Coder 1.3B",
    description: "Tiny but strong for JavaScript/TypeScript (28.46% win rate). Excellent repo-level FIM.",
    hfRepo: "deepseek-ai/deepseek-coder-1.3b-instruct",
    parameterSize: "1.3B",
    archParams: { numParams: 13e8, hiddenSize: 1536, numLayers: 24, numHeads: 12 },
    recommendedVRAM: computeRecommendedVRAM(
      { numParams: 13e8, hiddenSize: 1536, numLayers: 24, numHeads: 12 },
      defaultVramOpts
    ),
    defaultQuantization: "4bit",
    contextWindow: 16384,
    tags: ["javascript", "typescript", "python", "fim"],
    rank: 4,
    tier: "verified",
    benchmarks: { humaneval: 45, liveCodeBench: 38 },
    knownIssues: ["Very small model; limited reasoning capacity"]
  },
  {
    id: "codellama-7b",
    name: "Code Llama 7B",
    description: "Meta \u2014 most widely tested local coder. Strong at code completion and infilling.",
    hfRepo: "codellama/CodeLlama-7b-Instruct-hf",
    parameterSize: "7B",
    archParams: { numParams: 7e9, hiddenSize: 4096, numLayers: 32, numHeads: 32 },
    recommendedVRAM: computeRecommendedVRAM(
      { numParams: 7e9, hiddenSize: 4096, numLayers: 32, numHeads: 32 },
      defaultVramOpts
    ),
    defaultQuantization: "4bit",
    contextWindow: 16384,
    tags: ["python", "javascript", "general"],
    rank: 5,
    tier: "community",
    benchmarks: { humaneval: 84, liveCodeBench: 48 },
    knownIssues: ["HumanEval score likely overfitted; real-world performance is lower"]
  },
  {
    id: "phi-3.5-mini",
    name: "Phi-3.5 Mini 3.8B",
    description: "Microsoft \u2014 tiny enough for 6GB GPUs. Great for code reasoning given its size.",
    hfRepo: "microsoft/Phi-3.5-mini-instruct",
    parameterSize: "3.8B",
    archParams: { numParams: 38e8, hiddenSize: 3072, numLayers: 32, numHeads: 32 },
    recommendedVRAM: computeRecommendedVRAM(
      { numParams: 38e8, hiddenSize: 3072, numLayers: 32, numHeads: 32 },
      defaultVramOpts
    ),
    defaultQuantization: "4bit",
    contextWindow: 32768,
    tags: ["python", "javascript", "reasoning"],
    rank: 6,
    tier: "community",
    benchmarks: { humaneval: 69, liveCodeBench: 35 },
    knownIssues: ["Small context-optimized training set; may struggle on niche languages"]
  },
  {
    id: "stable-code-3b",
    name: "Stable Code 3B",
    description: "Stability AI \u2014 best JavaScript/TypeScript win rate (31.64%). Strong at code completion.",
    hfRepo: "stabilityai/stable-code-3b",
    parameterSize: "3B",
    archParams: { numParams: 27e8, hiddenSize: 2560, numLayers: 32, numHeads: 20 },
    recommendedVRAM: computeRecommendedVRAM(
      { numParams: 27e8, hiddenSize: 2560, numLayers: 32, numHeads: 20 },
      defaultVramOpts
    ),
    defaultQuantization: "4bit",
    contextWindow: 16384,
    tags: ["javascript", "typescript", "python", "completion"],
    rank: 7,
    tier: "community",
    benchmarks: { humaneval: 52, liveCodeBench: 40 },
    knownIssues: ["Base model fine-tuned; less instruction-following than Instruct variants"]
  },
  {
    id: "granite-3b-code",
    name: "Granite 3B Code Instruct",
    description: "IBM \u2014 purpose-built for code. Runs on 6GB cards with 4-bit.",
    hfRepo: "ibm-granite/granite-3b-code-instruct",
    parameterSize: "3B",
    archParams: { numParams: 31e8, hiddenSize: 2560, numLayers: 32, numHeads: 20 },
    recommendedVRAM: computeRecommendedVRAM(
      { numParams: 31e8, hiddenSize: 2560, numLayers: 32, numHeads: 20 },
      defaultVramOpts
    ),
    defaultQuantization: "4bit",
    contextWindow: 8192,
    tags: ["python", "javascript", "java", "go"],
    rank: 8,
    tier: "experimental",
    benchmarks: { humaneval: 61, liveCodeBench: 28 },
    knownIssues: ["Limited third-party validation; fewer community fine-tunes available"]
  },
  {
    id: "codegemma-1.1b",
    name: "CodeGemma 1.1B",
    description: "Google \u2014 smallest viable code model. Runs on 3GB VRAM with 4-bit. Good for simple tasks.",
    hfRepo: "google/codegemma-1.1b-it",
    parameterSize: "1.1B",
    archParams: { numParams: 11e8, hiddenSize: 1280, numLayers: 24, numHeads: 10 },
    recommendedVRAM: computeRecommendedVRAM(
      { numParams: 11e8, hiddenSize: 1280, numLayers: 24, numHeads: 10 },
      defaultVramOpts
    ),
    defaultQuantization: "4bit",
    contextWindow: 8192,
    tags: ["python", "javascript", "general"],
    rank: 9,
    tier: "experimental",
    benchmarks: { humaneval: 38, liveCodeBench: 30 },
    knownIssues: ["Minimal capacity; only for basic completion/explanation"]
  }
];

// tests/unit/models/runTests.ts
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
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`FAIL: ${message} \u2014 expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}
async function run() {
  console.log("--- MODELS VALIDATION TESTS ---");
  assert(TOP_CODING_MODELS.length > 0, "At least one model defined");
  for (const model of TOP_CODING_MODELS) {
    const id = model.id;
    assert(typeof model.id === "string" && model.id.length > 0, `${id}: id is non-empty string`);
    assert(typeof model.name === "string" && model.name.length > 0, `${id}: name is non-empty string`);
    assert(typeof model.hfRepo === "string" && model.hfRepo.length > 0, `${id}: hfRepo is non-empty string`);
    assert(typeof model.parameterSize === "string" && model.parameterSize.length > 0, `${id}: parameterSize is non-empty`);
    assert(model.archParams.numParams > 0, `${id}: numParams > 0`);
    assert(model.archParams.hiddenSize > 0, `${id}: hiddenSize > 0`);
    assert(model.archParams.numLayers > 0, `${id}: numLayers > 0`);
    assert(model.archParams.numHeads > 0, `${id}: numHeads > 0`);
    const billons = model.archParams.numParams / 1e9;
    assert(billons > 0.5 && billons < 1e3, `${id}: numParams ${billons.toFixed(1)}B in plausible range`);
    assert(["verified", "community", "experimental"].includes(model.tier), `${id}: tier is valid`);
    assert(model.benchmarks !== void 0, `${id}: benchmarks defined`);
    assert(Array.isArray(model.knownIssues), `${id}: knownIssues is array`);
    assert(model.recommendedVRAM["4bit"] > 0, `${id}: 4bit VRAM > 0`);
    assert(model.recommendedVRAM["8bit"] > 0, `${id}: 8bit VRAM > 0`);
    assert(model.recommendedVRAM["16bit"] > 0, `${id}: 16bit VRAM > 0`);
    assert(model.recommendedVRAM["16bit"] > model.recommendedVRAM["8bit"], `${id}: 16bit > 8bit VRAM`);
    assert(model.recommendedVRAM["8bit"] > model.recommendedVRAM["4bit"], `${id}: 8bit > 4bit VRAM`);
    assert(["4bit", "8bit", "16bit"].includes(model.defaultQuantization), `${id}: defaultQuant valid`);
    if (model.vramEstimates) {
      assert(model.vramEstimates["4bit"].totalGB > 0, `${id}: vramEstimates 4bit > 0`);
      assert(model.vramEstimates["8bit"].totalGB > 0, `${id}: vramEstimates 8bit > 0`);
      assert(model.vramEstimates["16bit"].totalGB > 0, `${id}: vramEstimates 16bit > 0`);
      assertEqual(
        model.vramEstimates["4bit"].totalGB,
        model.recommendedVRAM["4bit"],
        `${id}: vramEstimates 4bit matches recommendedVRAM`
      );
      assertEqual(
        model.vramEstimates["8bit"].totalGB,
        model.recommendedVRAM["8bit"],
        `${id}: vramEstimates 8bit matches recommendedVRAM`
      );
      assertEqual(
        model.vramEstimates["16bit"].totalGB,
        model.recommendedVRAM["16bit"],
        `${id}: vramEstimates 16bit matches recommendedVRAM`
      );
      for (const q of ["4bit", "8bit", "16bit"]) {
        const est = model.vramEstimates[q];
        assert(est.components.length === 6, `${id} ${q}: 6 VRAM components`);
        const sum = Math.round(est.components.reduce((s, c) => s + c.gb, 0) * 10) / 10;
        assertEqual(sum, est.totalGB, `${id} ${q}: component sum = total`);
      }
    } else {
      console.log(`     SKIP: ${id} vramEstimates checks (attached at runtime)`);
    }
    if (model.tier === "verified") {
      const hasBenchmark = Object.keys(model.benchmarks || {}).length > 0;
      assert(hasBenchmark, `${id}: verified tier has benchmarks`);
    }
  }
  const ids = TOP_CODING_MODELS.map((m) => m.id);
  const uniqueIds = new Set(ids);
  assertEqual(uniqueIds.size, ids.length, "No duplicate model IDs");
  let foundNonVerified = false;
  for (const m of TOP_CODING_MODELS) {
    if (m.tier !== "verified") foundNonVerified = true;
    else assert(!foundNonVerified, `${m.id}: verified models come before lower tiers`);
  }
  console.log(`
--- RESULTS: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}
run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
