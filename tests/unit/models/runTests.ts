import { TOP_CODING_MODELS } from '../../../electron/constants/models'

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

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    console.error(`FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    failed++
  } else {
    console.log(`PASS: ${message}`)
    passed++
  }
}

async function run() {
  console.log('--- MODELS VALIDATION TESTS ---')

  // Test 1: Models list is non-empty
  assert(TOP_CODING_MODELS.length > 0, 'At least one model defined')

  for (const model of TOP_CODING_MODELS) {
    const id = model.id

    // Test 2: Every model has required string fields
    assert(typeof model.id === 'string' && model.id.length > 0, `${id}: id is non-empty string`)
    assert(typeof model.name === 'string' && model.name.length > 0, `${id}: name is non-empty string`)
    assert(typeof model.hfRepo === 'string' && model.hfRepo.length > 0, `${id}: hfRepo is non-empty string`)
    assert(typeof model.parameterSize === 'string' && model.parameterSize.length > 0, `${id}: parameterSize is non-empty`)

    // Test 3: archParams presence and sanity
    assert(model.archParams.numParams > 0, `${id}: numParams > 0`)
    assert(model.archParams.hiddenSize > 0, `${id}: hiddenSize > 0`)
    assert(model.archParams.numLayers > 0, `${id}: numLayers > 0`)
    assert(model.archParams.numHeads > 0, `${id}: numHeads > 0`)

    // Test 4: archParams consistent with parameterSize
    const billons = model.archParams.numParams / 1e9
    assert(billons > 0.5 && billons < 1000, `${id}: numParams ${billons.toFixed(1)}B in plausible range`)

    // Test 5: tier is valid
    assert(['verified', 'community', 'experimental'].includes(model.tier), `${id}: tier is valid`)

    // Test 6: benchmarks present
    assert(model.benchmarks !== undefined, `${id}: benchmarks defined`)

    // Test 7: knownIssues is array
    assert(Array.isArray(model.knownIssues), `${id}: knownIssues is array`)

    // Test 8: Each model has valid recommendedVRAM for all 3 quant levels
    assert(model.recommendedVRAM['4bit'] > 0, `${id}: 4bit VRAM > 0`)
    assert(model.recommendedVRAM['8bit'] > 0, `${id}: 8bit VRAM > 0`)
    assert(model.recommendedVRAM['16bit'] > 0, `${id}: 16bit VRAM > 0`)
    assert(model.recommendedVRAM['16bit'] > model.recommendedVRAM['8bit'], `${id}: 16bit > 8bit VRAM`)
    assert(model.recommendedVRAM['8bit'] > model.recommendedVRAM['4bit'], `${id}: 8bit > 4bit VRAM`)

    // Test 9: defaultQuantization is valid
    assert(['4bit', '8bit', '16bit'].includes(model.defaultQuantization), `${id}: defaultQuant valid`)

    // Test 10: vramEstimates present for all quants (attached by FinetuningService at runtime)
    if (model.vramEstimates) {
      assert(model.vramEstimates['4bit'].totalGB > 0, `${id}: vramEstimates 4bit > 0`)
      assert(model.vramEstimates['8bit'].totalGB > 0, `${id}: vramEstimates 8bit > 0`)
      assert(model.vramEstimates['16bit'].totalGB > 0, `${id}: vramEstimates 16bit > 0`)
      // Verify vramEstimates match recommendedVRAM
      assertEqual(model.vramEstimates['4bit'].totalGB, model.recommendedVRAM['4bit'],
        `${id}: vramEstimates 4bit matches recommendedVRAM`)
      assertEqual(model.vramEstimates['8bit'].totalGB, model.recommendedVRAM['8bit'],
        `${id}: vramEstimates 8bit matches recommendedVRAM`)
      assertEqual(model.vramEstimates['16bit'].totalGB, model.recommendedVRAM['16bit'],
        `${id}: vramEstimates 16bit matches recommendedVRAM`)

      for (const q of ['4bit', '8bit', '16bit'] as const) {
        const est = model.vramEstimates[q]
        assert(est.components.length === 6, `${id} ${q}: 6 VRAM components`)
        const sum = Math.round(est.components.reduce((s, c) => s + c.gb, 0) * 10) / 10
        assertEqual(sum, est.totalGB, `${id} ${q}: component sum = total`)
      }
    } else {
      console.log(`     SKIP: ${id} vramEstimates checks (attached at runtime)`)
    }

    // Test 12: verified-tier models have benchmarks
    if (model.tier === 'verified') {
      const hasBenchmark = Object.keys(model.benchmarks || {}).length > 0
      assert(hasBenchmark, `${id}: verified tier has benchmarks`)
    }
  }

  // Test 13: No duplicate model IDs
  const ids = TOP_CODING_MODELS.map(m => m.id)
  const uniqueIds = new Set(ids)
  assertEqual(uniqueIds.size, ids.length, 'No duplicate model IDs')

  // Test 14: verified tier models are at the top (by rank)
  let foundNonVerified = false
  for (const m of TOP_CODING_MODELS) {
    if (m.tier !== 'verified') foundNonVerified = true
    else assert(!foundNonVerified, `${m.id}: verified models come before lower tiers`)
  }

  // Summary
  console.log(`\n--- RESULTS: ${passed} passed, ${failed} failed ---`)
  if (failed > 0) process.exit(1)
}

run().catch(err => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
