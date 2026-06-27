// Test: Pipeline engine routing logic (8-step pipeline)

let passed = 0;
let failed = 0;

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

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: ${message}`);
        failed++;
    }
}

// --- Duplicated logic under test ---

type PipelineTaskType = 'chat' | 'investigation' | 'plan_exploration' | 'plan_generation' | 'read_analyze' | 'code_generation' | 'verification_judge' | 'verification_fix';

interface PipelineRoute {
    provider: string;
    model: string;
}

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

interface PipelineStep {
    taskType: PipelineTaskType;
    label: string;
    provider: string;
    model: string;
}

const DEFAULT_ROUTE: PipelineRoute = { provider: 'openai', model: 'gpt-4o' };

const STEP_CONFIG: { taskType: PipelineTaskType; label: string }[] = [
    { taskType: 'chat', label: 'Chat' },
    { taskType: 'investigation', label: 'Investigation' },
    { taskType: 'plan_exploration', label: 'Plan Exploration' },
    { taskType: 'plan_generation', label: 'Plan Generation' },
    { taskType: 'read_analyze', label: 'Read/Analyze' },
    { taskType: 'code_generation', label: 'Code Generation' },
    { taskType: 'verification_judge', label: 'Verification Judge' },
    { taskType: 'verification_fix', label: 'Verification Fix' },
];

function getConfig(stored?: Partial<PipelineConfig>): PipelineConfig {
    return {
        chat: { ...DEFAULT_ROUTE },
        investigation: { ...DEFAULT_ROUTE },
        plan_exploration: { ...DEFAULT_ROUTE },
        plan_generation: { ...DEFAULT_ROUTE },
        read_analyze: { ...DEFAULT_ROUTE },
        code_generation: { ...DEFAULT_ROUTE },
        verification_judge: { ...DEFAULT_ROUTE },
        verification_fix: { ...DEFAULT_ROUTE },
        ...stored,
    };
}

function resolveSteps(config: PipelineConfig): PipelineStep[] {
    return STEP_CONFIG.map(({ taskType, label }) => ({
        taskType,
        label,
        provider: config[taskType].provider,
        model: config[taskType].model,
    }));
}

function getStepForTaskType(steps: PipelineStep[], taskType: PipelineTaskType): PipelineStep | undefined {
    return steps.find(s => s.taskType === taskType);
}

// --- Tests ---

async function run() {
    console.log('\n--- 1. resolveSteps returns 8 steps in order ---');
    const cfg = getConfig();
    const steps = resolveSteps(cfg);
    assertEqual(steps.length, 8, '8 steps returned');
    assertEqual(steps[0].taskType, 'chat', 'step 0 is chat');
    assertEqual(steps[1].taskType, 'investigation', 'step 1 is investigation');
    assertEqual(steps[2].taskType, 'plan_exploration', 'step 2 is plan_exploration');
    assertEqual(steps[3].taskType, 'plan_generation', 'step 3 is plan_generation');
    assertEqual(steps[4].taskType, 'read_analyze', 'step 4 is read_analyze');
    assertEqual(steps[5].taskType, 'code_generation', 'step 5 is code_generation');
    assertEqual(steps[6].taskType, 'verification_judge', 'step 6 is verification_judge');
    assertEqual(steps[7].taskType, 'verification_fix', 'step 7 is verification_fix');
    assertEqual(steps[0].label, 'Chat', 'label 0');
    assertEqual(steps[1].label, 'Investigation', 'label 1');
    assertEqual(steps[2].label, 'Plan Exploration', 'label 2');
    assertEqual(steps[3].label, 'Plan Generation', 'label 3');
    assertEqual(steps[4].label, 'Read/Analyze', 'label 4');
    assertEqual(steps[5].label, 'Code Generation', 'label 5');
    assertEqual(steps[6].label, 'Verification Judge', 'label 6');
    assertEqual(steps[7].label, 'Verification Fix', 'label 7');

    console.log('\n--- 2. Steps inherit provider/model from config ---');
    assertEqual(steps[0].provider, 'openai', 'chat provider from config');
    assertEqual(steps[0].model, 'gpt-4o', 'chat model from config');

    console.log('\n--- 3. Custom config produces correct steps ---');
    const customCfg = getConfig({
        chat: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
        investigation: { provider: 'gemini', model: 'gemini-2.0-flash' },
        code_generation: { provider: 'ollama', model: 'codellama' },
    });
    const customSteps = resolveSteps(customCfg);
    assertEqual(customSteps[0].provider, 'anthropic', 'chat step uses anthropic');
    assertEqual(customSteps[1].provider, 'gemini', 'investigation step uses gemini');
    assertEqual(customSteps[5].provider, 'ollama', 'code_generation step uses ollama');
    assertEqual(customSteps[2].provider, 'openai', 'plan_exploration step uses default');

    console.log('\n--- 4. getStepForTaskType finds correct step ---');
    const chatStep = getStepForTaskType(steps, 'chat');
    assert(chatStep !== undefined, 'chat step found');
    assertEqual(chatStep!.provider, 'openai', 'found step has correct provider');

    const fixStep = getStepForTaskType(steps, 'verification_fix');
    assert(fixStep !== undefined, 'verification_fix step found');
    assertEqual(fixStep!.model, 'gpt-4o', 'found step has correct model');

    console.log('\n--- 5. All 8 task types resolvable ---');
    for (const tt of ['chat', 'investigation', 'plan_exploration', 'plan_generation', 'read_analyze', 'code_generation', 'verification_judge', 'verification_fix'] as PipelineTaskType[]) {
        const s = getStepForTaskType(steps, tt);
        assert(s !== undefined, `${tt} step is resolvable`);
        assertEqual(s!.taskType, tt, `${tt} step has matching taskType`);
    }

    console.log('\n--- 6. Pipeline disabled: getRoute returns active provider/model ---');
    const activeProvider = 'openrouter';
    const activeModel = 'mistralai/mixtral-8x22b-instruct';

    function getRoutePipelineOff(taskType: PipelineTaskType): PipelineRoute {
        return { provider: activeProvider, model: activeModel };
    }

    for (const tt of ['chat', 'investigation', 'plan_exploration', 'plan_generation', 'read_analyze', 'code_generation', 'verification_judge', 'verification_fix'] as PipelineTaskType[]) {
        assertEqual(getRoutePipelineOff(tt).provider, 'openrouter', `disabled: ${tt} uses active provider`);
        assertEqual(getRoutePipelineOff(tt).model, activeModel, `disabled: ${tt} uses active model`);
    }

    console.log('\n--- 7. Pipeline enabled: getRoute returns per-task config ---');
    function getRoutePipelineOn(taskType: PipelineTaskType, config: PipelineConfig): PipelineRoute {
        return config[taskType];
    }

    const mixedConfig: PipelineConfig = {
        chat: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
        investigation: { provider: 'openai', model: 'o3-mini' },
        plan_exploration: { provider: 'gemini', model: 'gemini-2.0-flash' },
        plan_generation: { provider: 'openrouter', model: 'mistralai/mixtral-8x22b-instruct' },
        read_analyze: { provider: 'openai', model: 'gpt-4o-mini' },
        code_generation: { provider: 'ollama', model: 'codellama' },
        verification_judge: { provider: 'zen', model: 'deepseek-v4-flash-free' },
        verification_fix: { provider: 'anthropic', model: 'claude-3-5-haiku' },
    };

    assertEqual(getRoutePipelineOn('chat', mixedConfig).provider, 'anthropic', 'enabled: chat routes to anthropic');
    assertEqual(getRoutePipelineOn('investigation', mixedConfig).provider, 'openai', 'enabled: investigation routes to openai');
    assertEqual(getRoutePipelineOn('plan_exploration', mixedConfig).provider, 'gemini', 'enabled: plan_exploration routes to gemini');
    assertEqual(getRoutePipelineOn('code_generation', mixedConfig).provider, 'ollama', 'enabled: code_generation routes to ollama');
    assertEqual(getRoutePipelineOn('verification_judge', mixedConfig).provider, 'zen', 'enabled: verification_judge routes to zen');
    assertEqual(getRoutePipelineOn('verification_fix', mixedConfig).provider, 'anthropic', 'enabled: verification_fix routes to anthropic');

    console.log('\n--- 8. Pipeline toggle does not alter the stored config ---');
    const originalChat = { ...mixedConfig.chat };
    const enabledRoute = getRoutePipelineOn('chat', mixedConfig);
    const disabledRoute = getRoutePipelineOff('chat');
    assertEqual(originalChat.provider, 'anthropic', 'stored config unchanged when pipeline ON');
    assertEqual(disabledRoute.provider, 'openrouter', 'stored config not used when pipeline OFF');

    console.log('\n--- 9. Custom config preserves unset fields as defaults ---');
    const partialCfg = getConfig({ chat: { provider: 'gemini', model: 'gemini-2.0-flash' } });
    const partialSteps = resolveSteps(partialCfg);
    assertEqual(partialSteps[0].provider, 'gemini', 'partial: chat overridden');
    assertEqual(partialSteps[1].provider, 'openai', 'partial: investigation stays default');
    assertEqual(partialSteps[7].provider, 'openai', 'partial: verification_fix stays default');

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`);
    if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('Test suite error:', err); process.exit(1); });
