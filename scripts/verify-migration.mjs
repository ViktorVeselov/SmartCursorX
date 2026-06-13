/**
 * Verification script for Vercel AI SDK migration.
 * Tests that all key components work correctly at runtime.
 *
 * Usage: node scripts/verify-migration.mjs
 */

import { ok, strictEqual, deepStrictEqual, throws } from 'node:assert';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed');
}

// ==============================
// 1. Module imports resolution
// ==============================
console.log('\n📦 Module Import Tests');

test('ai module resolves', async () => {
  const ai = await import('ai');
  ok(typeof ai.generateText === 'function', 'generateText exported');
  ok(typeof ai.streamText === 'function', 'streamText exported');
});

test('@ai-sdk/openai resolves', async () => {
  const pkg = await import('@ai-sdk/openai');
  ok(typeof pkg.createOpenAI === 'function', 'createOpenAI exported');
});

test('@ai-sdk/anthropic resolves', async () => {
  const pkg = await import('@ai-sdk/anthropic');
  ok(typeof pkg.createAnthropic === 'function', 'createAnthropic exported');
});

test('@ai-sdk/openai-compatible resolves', async () => {
  const pkg = await import('@ai-sdk/openai-compatible');
  ok(typeof pkg.createOpenAICompatible === 'function', 'createOpenAICompatible exported');
});

test('zod resolves', async () => {
  const zod = await import('zod');
  ok(typeof zod.z === 'object' || typeof zod.default === 'object' || typeof zod.object === 'function', 'zod exported');
});

test('ollama-ai-provider resolves', async () => {
  const pkg = await import('ollama-ai-provider');
  ok(typeof pkg.ollama === 'function' || typeof pkg.default === 'function', 'ollama exported');
});

// ==============================
// 2. Zod Schema Validation
// ==============================
console.log('\n📋 Zod Schema Tests');

test('ExecutionPlanSchema - valid plan', async () => {
  const { ExecutionPlanSchema } = await import('../electron/services/ai/schemas.ts');
  const result = ExecutionPlanSchema.safeParse({
    taskId: 1,
    steps: [{ order: 1, action: 'read', target: 'file.ts', rationale: 'Check imports' }],
    expectedOutcome: 'Plan complete',
    filesRead: ['file.ts'],
    filesToModify: ['file.ts'],
    verificationCriteria: ['Compiles'],
    confidence: 0.9,
  });
  ok(result.success, `Expected valid, got: ${JSON.stringify(result.error)}`);
});

test('ExecutionPlanSchema - invalid step action', async () => {
  const { ExecutionPlanSchema } = await import('../electron/services/ai/schemas.ts');
  const result = ExecutionPlanSchema.safeParse({
    taskId: 1,
    steps: [{ order: 1, action: 'invalid_action', target: 'file.ts', rationale: 'test' }],
    expectedOutcome: 'test',
    filesRead: [],
    filesToModify: [],
    verificationCriteria: [],
    confidence: 0.5,
  });
  ok(!result.success, 'Expected invalid action to fail');
});

test('ExecutionPlanSchema - confidence out of range', async () => {
  const { ExecutionPlanSchema } = await import('../electron/services/ai/schemas.ts');
  const result = ExecutionPlanSchema.safeParse({
    taskId: 1,
    steps: [{ order: 1, action: 'read', target: 'file.ts', rationale: 'test' }],
    expectedOutcome: 'test',
    filesRead: [],
    filesToModify: [],
    verificationCriteria: [],
    confidence: 1.5,
  });
  ok(!result.success, 'Expected out-of-range confidence to fail');
});

test('CodePlanningResultSchema - valid', async () => {
  const { CodePlanningResultSchema } = await import('../electron/services/ai/schemas.ts');
  const result = CodePlanningResultSchema.safeParse({
    designDoc: '# Design Doc\nSome content',
    classDependencies: [{ name: 'MyClass', type: 'class', dependsOn: ['Other'], description: 'Test class' }],
    tradeoffs: [{ task: 'Choice A vs B', considerations: 'Pros/cons', decision: 'Choose A' }],
    consequences: [{ failureMode: 'X fails', consequence: 'Y breaks', harm: 'User impact', mitigation: 'Guard Z' }],
  });
  ok(result.success, `Expected valid, got: ${JSON.stringify(result.error)}`);
});

test('CodePlanningResultSchema - missing required designDoc', async () => {
  const { CodePlanningResultSchema } = await import('../electron/services/ai/schemas.ts');
  const result = CodePlanningResultSchema.safeParse({});
  ok(!result.success, 'Expected empty object to fail');
});

test('VerificationScoreSchema - valid', async () => {
  const { VerificationScoreSchema } = await import('../electron/services/ai/schemas.ts');
  const result = VerificationScoreSchema.safeParse({
    score: 0.85,
    reasoning: 'Good quality code',
    issues: ['minor style'],
    suggestions: ['fix formatting'],
  });
  ok(result.success, `Expected valid, got: ${JSON.stringify(result.error)}`);
});

test('VerificationScoreSchema - score out of range', async () => {
  const { VerificationScoreSchema } = await import('../electron/services/ai/schemas.ts');
  const result = VerificationScoreSchema.safeParse({ score: 2, reasoning: 'test' });
  ok(!result.success, 'Expected score >1 to fail');
});

// ==============================
// 3. Type exports and inference
// ==============================
console.log('\n🔤 Type Export Tests');

test('types are exported from ai module', async () => {
  const ai = await import('../electron/services/ai/index.ts');
  ok(typeof ai.ExecutionPlanSchema === 'object', 'ExecutionPlanSchema exported');
  ok(typeof ai.CodePlanningResultSchema === 'object', 'CodePlanningResultSchema exported');
  ok(typeof ai.VerificationScoreSchema === 'object', 'VerificationScoreSchema exported');
  ok(typeof ai.createLanguageModel === 'function', 'createLanguageModel exported');
  ok(typeof ai.resolveZenModel === 'function', 'resolveZenModel exported');
  ok(typeof ai.getZenModelsInfo === 'function', 'getZenModelsInfo exported');
});

// ==============================
// 4. Zen Model Resolution
// ==============================
console.log('\n🔮 Zen Model Resolution Tests');

test('resolveZenModel - high effort', async () => {
  const { resolveZenModel } = await import('../electron/services/ai/provider.ts');
  deepStrictEqual(resolveZenModel('deepseek-v4-flash-free-high'), {
    model: 'deepseek-v4-flash-free',
    effort: 'high',
  });
});

test('resolveZenModel - low effort', async () => {
  const { resolveZenModel } = await import('../electron/services/ai/provider.ts');
  deepStrictEqual(resolveZenModel('deepseek-v4-flash-free-low'), {
    model: 'deepseek-v4-flash-free',
    effort: 'low',
  });
});

test('resolveZenModel - medium (default)', async () => {
  const { resolveZenModel } = await import('../electron/services/ai/provider.ts');
  deepStrictEqual(resolveZenModel('deepseek-v4-flash-free'), {
    model: 'deepseek-v4-flash-free',
  });
});

test('resolveZenModel - unknown model passthrough', async () => {
  const { resolveZenModel } = await import('../electron/services/ai/provider.ts');
  deepStrictEqual(resolveZenModel('gpt-4o'), { model: 'gpt-4o' });
});

// ==============================
// 5. Provider Factory
// ==============================
console.log('\n🏭 Provider Factory Tests');

test('createLanguageModel - openai', async () => {
  const { createLanguageModel } = await import('../electron/services/ai/provider.ts');
  const model = createLanguageModel({ providerId: 'openai', apiKey: 'test-key' }, 'gpt-4o');
  ok(model !== null && typeof model === 'object', `Expected model object, got ${typeof model}`);
});

test('createLanguageModel - anthropic', async () => {
  const { createLanguageModel } = await import('../electron/services/ai/provider.ts');
  const model = createLanguageModel({ providerId: 'anthropic', apiKey: 'test-key' }, 'claude-3-5-sonnet-20241022');
  ok(model !== null && typeof model === 'object', `Expected model object, got ${typeof model}`);
});

test('createLanguageModel - ollama', async () => {
  const { createLanguageModel } = await import('../electron/services/ai/provider.ts');
  const model = createLanguageModel({ providerId: 'ollama', apiKey: '' }, 'llama3');
  ok(model !== null && typeof model === 'object', `Expected model object, got ${typeof model}`);
});

test('createLanguageModel - zen (resolves effort)', async () => {
  const { createLanguageModel } = await import('../electron/services/ai/provider.ts');
  const model = createLanguageModel({ providerId: 'zen', apiKey: '' }, 'deepseek-v4-flash-free-high');
  ok(model !== null && typeof model === 'object', `Expected model object, got ${typeof model}`);
});

test('createLanguageModel - litellm', async () => {
  const { createLanguageModel } = await import('../electron/services/ai/provider.ts');
  const model = createLanguageModel({ providerId: 'litellm', apiKey: 'key' }, 'gpt-4o');
  ok(model !== null && typeof model === 'object', `Expected model object, got ${typeof model}`);
});

test('createLanguageModel - custom provider falls back to OpenAI compatible', async () => {
  const { createLanguageModel } = await import('../electron/services/ai/provider.ts');
  const model = createLanguageModel({ providerId: 'my-custom', apiKey: 'key', baseUrl: 'http://localhost:8080/v1' }, 'model-1');
  ok(model !== null && typeof model === 'object', `Expected model object, got ${typeof model}`);
});

// ==============================
// 6. AIService API
// ==============================
console.log('\n🔧 AIService API Tests (no Electron runtime needed)');

test('AIService static methods', async () => {
  const { AIService } = await import('../electron/services/AIService.ts');
  ok(typeof AIService.getInstance === 'function', 'getInstance is function');
  ok(typeof AIService.getEnvKey === 'function', 'getEnvKey is function');
});

test('AIService.getEnvKey - known providers', async () => {
  const { AIService } = await import('../electron/services/AIService.ts');
  // Should return undefined since env vars likely not set in test
  strictEqual(AIService.getEnvKey('openai'), process.env.OPENAI_API_KEY);
  strictEqual(AIService.getEnvKey('anthropic'), process.env.ANTHROPIC_API_KEY);
  strictEqual(AIService.getEnvKey('unknown'), undefined);
});

test('AIService singleton instance', async () => {
  const { aiService } = await import('../electron/services/AIService.ts');
  ok(aiService.isActive !== undefined, 'aiService has isActive');
  ok(typeof aiService.initialize === 'function', 'initialize is function');
  ok(typeof aiService.chat === 'function', 'chat is function');
  ok(typeof aiService.generateObject === 'function', 'generateObject is function');
  ok(typeof aiService.streamObject === 'function', 'streamObject is function');
  ok(typeof aiService.getModels === 'function', 'getModels is function');
});

test('AIService.initialize and isActive', async () => {
  const { AIService } = await import('../electron/services/AIService.ts');
  const svc = AIService.getInstance();
  ok(!svc.isActive(), 'Should not be active before init');
  svc.initialize({ providerId: 'openai', apiKey: 'test' });
  ok(svc.isActive(), 'Should be active after init');
  strictEqual(svc.providerId, 'openai');
});

// ==============================
// 7. PlanningService imports
// ==============================
console.log('\n📝 PlanningService Tests');

test('PlanningService module exports', async () => {
  const ps = await import('../electron/services/PlanningService.ts');
  ok(typeof ps.PlanningService === 'function', 'PlanningService class exported');
  ok(typeof ps.PlanningService.generatePlan === 'function', 'generatePlan static method exported');
});

// ==============================
// 8. getZenModelsInfo (network)
// ==============================
console.log('\n🌐 Zen Models Info (network)');

test('getZenModelsInfo fetches and returns valid shape', async () => {
  const { getZenModelsInfo } = await import('../electron/services/ai/index.ts');
  const result = await getZenModelsInfo();
  ok(Array.isArray(result), `Expected array, got ${typeof result}`);
  if (result.length > 0) {
    const model = result[0];
    ok(typeof model.id === 'string', 'model has id');
    ok(typeof model.isFree === 'boolean', 'model has isFree flag');
  }
});

// ==============================
// Summary
// ==============================
console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
