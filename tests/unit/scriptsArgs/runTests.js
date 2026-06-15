// tests/unit/scriptsArgs/runTests.ts
import { execSync } from "child_process";
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
function assertIncludes(actual, expected, message) {
  if (!actual.includes(expected)) {
    console.error(`FAIL: ${message} \u2014 expected to contain "${expected}"`);
    console.error(`  got: ${actual.substring(0, 300)}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}
function runScript(script, args) {
  try {
    const out = execSync(`python ${script} ${args}`, { encoding: "utf-8", timeout: 15e3, stdio: ["ignore", "pipe", "pipe"] });
    return { out, argparseError: false };
  } catch (e) {
    const out = (e.stdout || "") + (e.stderr || "");
    const argparseError = /unrecognized arguments|usage:|error:.*argument/i.test(out);
    return { out, argparseError };
  }
}
async function run() {
  console.log("--- PYTHON SCRIPT ARG PARSING TESTS ---");
  console.log("(Tests that scripts accept CLI flags \u2014 ignores ModuleNotFoundError after arg parse)");
  console.log();
  const scriptDir = "scripts";
  console.log("--- finetune_qlora.py ---");
  const help = runScript(`${scriptDir}/finetune_qlora.py`, "--help");
  assertIncludes(help.out, "usage:", "--help prints usage");
  assertIncludes(help.out, "--num-gpus", "--help mentions --num-gpus");
  assertIncludes(help.out, "--ddp", "--help mentions --ddp");
  assertIncludes(help.out, "--fsdp", "--help mentions --fsdp");
  assertIncludes(help.out, "--deepspeed", "--help mentions --deepspeed");
  assertIncludes(help.out, "--rocm", "--help mentions --rocm");
  assertIncludes(help.out, "--local-rank", "--help mentions --local-rank");
  assertIncludes(help.out, "--use-unsloth", "--help mentions --use-unsloth");
  assertIncludes(help.out, "--hf-model", "--help has --hf-model");
  assertIncludes(help.out, "--batch-size", "--help has --batch-size");
  const ddp = runScript(
    `${scriptDir}/finetune_qlora.py`,
    "--hf-model test/test --dataset test.jsonl --output-dir __tmp --num-gpus 2 --ddp"
  );
  assert(!ddp.argparseError, "--num-gpus 2 --ddp accepted by argparse");
  const fsdp = runScript(
    `${scriptDir}/finetune_qlora.py`,
    "--hf-model test/test --dataset test.jsonl --output-dir __tmp --num-gpus 8 --fsdp"
  );
  assert(!fsdp.argparseError, "--num-gpus 8 --fsdp accepted by argparse");
  const deep = runScript(
    `${scriptDir}/finetune_qlora.py`,
    "--hf-model test/test --dataset test.jsonl --output-dir __tmp --num-gpus 4 --deepspeed"
  );
  assert(!deep.argparseError, "--deepspeed accepted by argparse");
  const rocm = runScript(
    `${scriptDir}/finetune_qlora.py`,
    "--hf-model test/test --dataset test.jsonl --output-dir __tmp --rocm"
  );
  assert(!rocm.argparseError, "--rocm accepted by argparse");
  const localRank = runScript(
    `${scriptDir}/finetune_qlora.py`,
    "--hf-model test/test --dataset test.jsonl --output-dir __tmp --local-rank 1"
  );
  assert(!localRank.argparseError, "--local-rank 1 accepted by argparse");
  const unsloth = runScript(
    `${scriptDir}/finetune_qlora.py`,
    "--hf-model test/test --dataset test.jsonl --output-dir __tmp --use-unsloth"
  );
  assert(!unsloth.argparseError, "--use-unsloth accepted by argparse");
  const all = runScript(
    `${scriptDir}/finetune_qlora.py`,
    "--hf-model test/test --dataset test.jsonl --output-dir __tmp --num-gpus 4 --ddp --rocm"
  );
  assert(!all.argparseError, "all flags together accepted by argparse");
  const missing = runScript(`${scriptDir}/finetune_qlora.py`, "");
  assert(
    missing.argparseError || missing.out.includes("usage:"),
    "missing required args produces argparse error"
  );
  console.log();
  console.log("--- convert_cot_dataset.py ---");
  const helpCot = runScript(`${scriptDir}/convert_cot_dataset.py`, "--help");
  assertIncludes(helpCot.out, "usage:", "convert_cot_dataset.py --help prints usage");
  assertIncludes(helpCot.out, "--mode", "help has --mode");
  assertIncludes(helpCot.out, "think", "help mentions think mode");
  const think = runScript(
    `${scriptDir}/convert_cot_dataset.py`,
    "--mode think --input nonexistent.json --output out.jsonl"
  );
  assert(!think.argparseError, "--mode think accepted by argparse");
  const session = runScript(
    `${scriptDir}/convert_cot_dataset.py`,
    "--mode session --input nonexistent.json --output out.jsonl"
  );
  assert(!session.argparseError, "--mode session accepted by argparse");
  const dedup = runScript(
    `${scriptDir}/convert_cot_dataset.py`,
    "--mode think --input nonexistent.json --output out.jsonl --dedup"
  );
  assert(!dedup.argparseError, "--dedup accepted by argparse");
  const maxSamples = runScript(
    `${scriptDir}/convert_cot_dataset.py`,
    "--mode think --input nonexistent.json --output out.jsonl --max-samples 500"
  );
  assert(!maxSamples.argparseError, "--max-samples accepted by argparse");
  const noArgs = runScript(`${scriptDir}/convert_cot_dataset.py`, "");
  assert(
    !noArgs.argparseError,
    "convert_cot_dataset.py accepts no arguments (has defaults)"
  );
  console.log(`
--- RESULTS: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}
run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
