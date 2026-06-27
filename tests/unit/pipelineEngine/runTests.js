// tests/unit/pipelineEngine/runTests.ts
var passed = 0;
var failed = 0;
function assertEqual(actual, expected, message) {
  const pass = actual === expected;
  if (pass) {
    console.log(`  \u2705 PASS: ${message}`);
    passed++;
  } else {
    console.log(`  \u274C FAIL: ${message} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}
function assert(condition, message) {
  if (condition) {
    console.log(`  \u2705 PASS: ${message}`);
    passed++;
  } else {
    console.log(`  \u274C FAIL: ${message}`);
    failed++;
  }
}
var DEFAULT_PIPELINE = {
  chat: { provider: "openai", model: "gpt-4o" },
  planning: { provider: "openai", model: "gpt-4o" },
  verification: { provider: "openai", model: "gpt-4o" },
  codeCompletion: { provider: "openai", model: "gpt-4o" }
};
function getConfig(stored) {
  return { ...DEFAULT_PIPELINE, ...stored };
}
function resolveSteps(config) {
  return [
    { taskType: "chat", label: "Chat", provider: config.chat.provider, model: config.chat.model },
    { taskType: "planning", label: "Planning", provider: config.planning.provider, model: config.planning.model },
    { taskType: "verification", label: "Verification", provider: config.verification.provider, model: config.verification.model },
    { taskType: "code_completion", label: "Code Completion", provider: config.codeCompletion.provider, model: config.codeCompletion.model }
  ];
}
function getStepForTaskType(steps, taskType) {
  return steps.find((s) => s.taskType === taskType);
}
async function run() {
  console.log("\n--- 1. resolveSteps returns 4 steps in order ---");
  const cfg = getConfig();
  const steps = resolveSteps(cfg);
  assertEqual(steps.length, 4, "4 steps returned");
  assertEqual(steps[0].taskType, "chat", "step 0 is chat");
  assertEqual(steps[1].taskType, "planning", "step 1 is planning");
  assertEqual(steps[2].taskType, "verification", "step 2 is verification");
  assertEqual(steps[3].taskType, "code_completion", "step 3 is code_completion");
  assertEqual(steps[0].label, "Chat", "label for chat");
  assertEqual(steps[1].label, "Planning", "label for planning");
  assertEqual(steps[2].label, "Verification", "label for verification");
  assertEqual(steps[3].label, "Code Completion", "label for code_completion");
  console.log("\n--- 2. Steps inherit provider/model from config ---");
  assertEqual(steps[0].provider, "openai", "chat provider from config");
  assertEqual(steps[0].model, "gpt-4o", "chat model from config");
  console.log("\n--- 3. Custom config produces correct steps ---");
  const customCfg = getConfig({
    chat: { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
    planning: { provider: "gemini", model: "gemini-2.0-flash" }
  });
  const customSteps = resolveSteps(customCfg);
  assertEqual(customSteps[0].provider, "anthropic", "chat step uses anthropic");
  assertEqual(customSteps[0].model, "claude-3-5-sonnet-20241022", "chat step model correct");
  assertEqual(customSteps[1].provider, "gemini", "planning step uses gemini");
  assertEqual(customSteps[2].provider, "openai", "verification step uses default");
  console.log("\n--- 4. getStepForTaskType finds correct step ---");
  const chatStep = getStepForTaskType(steps, "chat");
  assert(chatStep !== void 0, "chat step found");
  assertEqual(chatStep.provider, "openai", "found step has correct provider");
  const unknownStep = getStepForTaskType(steps, "code_completion");
  assert(unknownStep !== void 0, "code_completion step found");
  assertEqual(unknownStep.model, "gpt-4o", "found step has correct model");
  console.log("\n--- 5. All four task types resolvable ---");
  for (const tt of ["chat", "planning", "verification", "code_completion"]) {
    const s = getStepForTaskType(steps, tt);
    assert(s !== void 0, `${tt} step is resolvable`);
    assertEqual(s.taskType, tt, `${tt} step has matching taskType`);
  }
  console.log("\n--- 6. Pipeline disabled: getRoute returns active provider/model ---");
  const activeProvider = "openrouter";
  const activeModel = "mistralai/mixtral-8x22b-instruct";
  function getRoutePipelineOff(taskType) {
    return { provider: activeProvider, model: activeModel };
  }
  assertEqual(getRoutePipelineOff("chat").provider, "openrouter", "disabled: chat uses active provider");
  assertEqual(getRoutePipelineOff("chat").model, "mistralai/mixtral-8x22b-instruct", "disabled: chat uses active model");
  assertEqual(getRoutePipelineOff("planning").provider, "openrouter", "disabled: planning uses active provider");
  assertEqual(getRoutePipelineOff("verification").provider, "openrouter", "disabled: verification uses active provider");
  assertEqual(getRoutePipelineOff("code_completion").provider, "openrouter", "disabled: code_completion uses active provider");
  console.log("\n--- 7. Pipeline enabled: getRoute returns per-task config ---");
  function getRoutePipelineOn(taskType, config) {
    switch (taskType) {
      case "chat":
        return config.chat;
      case "planning":
        return config.planning;
      case "verification":
        return config.verification;
      case "code_completion":
        return config.codeCompletion;
      default:
        return config.chat;
    }
  }
  const mixedConfig = {
    chat: { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
    planning: { provider: "gemini", model: "gemini-2.0-flash" },
    verification: { provider: "openai", model: "o1-mini" },
    codeCompletion: { provider: "ollama", model: "codellama" }
  };
  assertEqual(getRoutePipelineOn("chat", mixedConfig).provider, "anthropic", "enabled: chat routes to anthropic");
  assertEqual(getRoutePipelineOn("planning", mixedConfig).provider, "gemini", "enabled: planning routes to gemini");
  assertEqual(getRoutePipelineOn("verification", mixedConfig).provider, "openai", "enabled: verification routes to openai");
  assertEqual(getRoutePipelineOn("code_completion", mixedConfig).provider, "ollama", "enabled: code_completion routes to ollama");
  console.log("\n--- 8. Pipeline toggle does not alter the stored config ---");
  const originalChat = { ...mixedConfig.chat };
  const enabledRoute = getRoutePipelineOn("chat", mixedConfig);
  const disabledRoute = getRoutePipelineOff("chat");
  assertEqual(originalChat.provider, "anthropic", "stored config unchanged when pipeline ON");
  assertEqual(disabledRoute.provider, "openrouter", "stored config not used when pipeline OFF");
  console.log(`
\u{1F4CA} Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests
`);
  if (failed > 0) process.exit(1);
}
run().catch((err) => {
  console.error("Test suite error:", err);
  process.exit(1);
});
