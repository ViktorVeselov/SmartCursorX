// Test: Pipeline routing logic (8 task types, migration, targets)

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: ${message}`);
        failed++;
    }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
    const pass = actual === expected;
    if (pass) {
        console.log(`  ✅ PASS: ${message}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: ${message} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        failed++;
    }
}

// --- Duplicated logic under test ---

type PipelineTaskType = 'chat' | 'investigation' | 'plan_exploration' | 'plan_generation' | 'read_analyze' | 'code_generation' | 'verification_judge' | 'verification_fix';

interface PipelineRoute {
    provider: string;
    model: string;
}

const ALL_TASK_TYPES: PipelineTaskType[] = [
    'chat', 'investigation', 'plan_exploration', 'plan_generation',
    'read_analyze', 'code_generation', 'verification_judge', 'verification_fix',
];

interface PipelineConfig {
    chat: PipelineRoute;
    investigation: PipelineRoute;
    plan_exploration: PipelineRoute;
    plan_generation: PipelineRoute;
    read_analyze: PipelineRoute;
    code_generation: PipelineRoute;
    verification_judge: PipelineRoute;
    verification_fix: PipelineRoute;
}

const DEFAULT_ROUTE: PipelineRoute = { provider: 'openai', model: 'gpt-4o' };

const DEFAULT_CONFIG: PipelineConfig = {
    chat: { ...DEFAULT_ROUTE },
    investigation: { ...DEFAULT_ROUTE },
    plan_exploration: { ...DEFAULT_ROUTE },
    plan_generation: { ...DEFAULT_ROUTE },
    read_analyze: { ...DEFAULT_ROUTE },
    code_generation: { ...DEFAULT_ROUTE },
    verification_judge: { ...DEFAULT_ROUTE },
    verification_fix: { ...DEFAULT_ROUTE },
};

function getRoute(config: PipelineConfig, taskType: PipelineTaskType): PipelineRoute {
    return config[taskType] || config.chat;
}

function mergeWithDefaults(stored: Partial<PipelineConfig>): PipelineConfig {
    return { ...DEFAULT_CONFIG, ...stored } as PipelineConfig;
}

// Migration: old 4-field config → new 8-field
type OldConfig = { chat: PipelineRoute; planning: PipelineRoute; verification: PipelineRoute; codeCompletion: PipelineRoute };

function migrateOldConfig(old: OldConfig): PipelineConfig {
    return {
        chat: old.chat,
        investigation: old.chat,
        plan_exploration: old.planning,
        plan_generation: old.planning,
        read_analyze: old.codeCompletion,
        code_generation: old.codeCompletion,
        verification_judge: old.verification,
        verification_fix: old.verification,
    };
}

// --- Tests ---

async function run() {
    console.log('\n--- 1. Default pipeline (8 task types) ---');
    const defaults = mergeWithDefaults({});
    assertEqual(defaults.chat.provider, 'openai', 'default chat provider is openai');
    assertEqual(defaults.chat.model, 'gpt-4o', 'default chat model is gpt-4o');
    assertEqual(defaults.investigation.provider, 'openai', 'default investigation provider is openai');
    assertEqual(defaults.plan_exploration.provider, 'openai', 'default plan_exploration provider is openai');
    assertEqual(defaults.plan_generation.provider, 'openai', 'default plan_generation provider is openai');
    assertEqual(defaults.read_analyze.provider, 'openai', 'default read_analyze provider is openai');
    assertEqual(defaults.code_generation.provider, 'openai', 'default code_generation provider is openai');
    assertEqual(defaults.verification_judge.provider, 'openai', 'default verification_judge provider is openai');
    assertEqual(defaults.verification_fix.provider, 'openai', 'default verification_fix provider is openai');

    console.log('\n--- 2. getRoute returns correct routes ---');
    for (const tt of ALL_TASK_TYPES) {
        assertEqual(getRoute(defaults, tt), defaults[tt], `${tt} returns its own route`);
    }

    console.log('\n--- 3. Custom pipeline ---');
    const custom: PipelineConfig = {
        chat: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
        investigation: { provider: 'openai', model: 'o3-mini' },
        plan_exploration: { provider: 'gemini', model: 'gemini-2.0-flash' },
        plan_generation: { provider: 'openrouter', model: 'mistralai/mixtral-8x22b-instruct' },
        read_analyze: { provider: 'openai', model: 'gpt-4o-mini' },
        code_generation: { provider: 'ollama', model: 'codellama' },
        verification_judge: { provider: 'zen', model: 'deepseek-v4-flash-free' },
        verification_fix: { provider: 'anthropic', model: 'claude-3-5-haiku' },
    };
    const merged = mergeWithDefaults(custom);
    assertEqual(getRoute(merged, 'chat').provider, 'anthropic', 'chat routes to anthropic');
    assertEqual(getRoute(merged, 'investigation').provider, 'openai', 'investigation routes to openai');
    assertEqual(getRoute(merged, 'plan_exploration').provider, 'gemini', 'plan_exploration routes to gemini');
    assertEqual(getRoute(merged, 'code_generation').provider, 'ollama', 'code_generation routes to ollama');
    assertEqual(getRoute(merged, 'verification_judge').provider, 'zen', 'verification_judge routes to zen');
    assertEqual(getRoute(merged, 'verification_fix').provider, 'anthropic', 'verification_fix routes to anthropic');

    console.log('\n--- 4. Partial merge (fields from defaults preserved) ---');
    const partial = mergeWithDefaults({ chat: { provider: 'gemini', model: 'gemini-2.0-flash' } } as any);
    assertEqual(partial.chat.provider, 'gemini', 'chat provider overridden');
    for (const tt of ALL_TASK_TYPES.slice(1)) {
        assertEqual(partial[tt].provider, 'openai', `${tt} stays default`);
    }

    console.log('\n--- 5. Unknown task type falls back to chat ---');
    assertEqual(getRoute(defaults, 'unknown' as any), defaults.chat, 'unknown task type returns chat route');

    console.log('\n--- 6. Migrate old 4-field config to 8-field ---');
    const oldCfg: OldConfig = {
        chat: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
        planning: { provider: 'openai', model: 'o1-mini' },
        verification: { provider: 'zen', model: 'deepseek-v4-flash-free' },
        codeCompletion: { provider: 'ollama', model: 'codellama' },
    };
    const migrated = migrateOldConfig(oldCfg);
    assertEqual(migrated.chat, oldCfg.chat, 'chat preserved');
    assertEqual(migrated.investigation, oldCfg.chat, 'investigation maps to chat');
    assertEqual(migrated.plan_exploration, oldCfg.planning, 'plan_exploration maps to planning');
    assertEqual(migrated.plan_generation, oldCfg.planning, 'plan_generation maps to planning');
    assertEqual(migrated.read_analyze, oldCfg.codeCompletion, 'read_analyze maps to codeCompletion');
    assertEqual(migrated.code_generation, oldCfg.codeCompletion, 'code_generation maps to codeCompletion');
    assertEqual(migrated.verification_judge, oldCfg.verification, 'verification_judge maps to verification');
    assertEqual(migrated.verification_fix, oldCfg.verification, 'verification_fix maps to verification');

    console.log('\n--- 7. All 8 task types can be independently set ---');
    const independent: PipelineConfig = {} as PipelineConfig;
    for (let i = 0; i < ALL_TASK_TYPES.length; i++) {
        independent[ALL_TASK_TYPES[i]] = { provider: `provider-${i}`, model: `model-${i}` };
    }
    for (let i = 0; i < ALL_TASK_TYPES.length; i++) {
        assertEqual(independent[ALL_TASK_TYPES[i]].provider, `provider-${i}`, `${ALL_TASK_TYPES[i]} provider set independently`);
    }

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`);
    if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('Test suite error:', err); process.exit(1); });
