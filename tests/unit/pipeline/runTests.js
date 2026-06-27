// tests/unit/pipeline/runTests.ts
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
var DEFAULT_PIPELINE = {
  chat: { provider: "openai", model: "gpt-4o" },
  planning: { provider: "openai", model: "gpt-4o" },
  verification: { provider: "openai", model: "gpt-4o" },
  codeCompletion: { provider: "openai", model: "gpt-4o" }
};
function getRoute(config, taskType) {
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
function getProviderFor(config, taskType) {
  return getRoute(config, taskType).provider;
}
function getModelFor(config, taskType) {
  return getRoute(config, taskType).model;
}
function mergeWithDefaults(stored) {
  return { ...DEFAULT_PIPELINE, ...stored };
}
async function run() {
  console.log("\n--- 1. Default pipeline ---");
  const defaults = mergeWithDefaults({});
  assertEqual(defaults.chat.provider, "openai", "default chat provider is openai");
  assertEqual(defaults.chat.model, "gpt-4o", "default chat model is gpt-4o");
  assertEqual(defaults.planning.provider, "openai", "default planning provider is openai");
  assertEqual(defaults.verification.provider, "openai", "default verification provider is openai");
  assertEqual(defaults.codeCompletion.provider, "openai", "default codeCompletion provider is openai");
  console.log("\n--- 2. getRoute returns correct routes ---");
  assertEqual(getRoute(defaults, "chat"), defaults.chat, "chat returns chat route");
  assertEqual(getRoute(defaults, "planning"), defaults.planning, "planning returns planning route");
  assertEqual(getRoute(defaults, "verification"), defaults.verification, "verification returns verification route");
  assertEqual(getRoute(defaults, "code_completion"), defaults.codeCompletion, "code_completion returns codeCompletion route");
  console.log("\n--- 3. getProviderFor / getModelFor ---");
  assertEqual(getProviderFor(defaults, "chat"), "openai", "getProviderFor chat returns openai");
  assertEqual(getModelFor(defaults, "chat"), "gpt-4o", "getModelFor chat returns gpt-4o");
  console.log("\n--- 4. Custom pipeline ---");
  const custom = {
    chat: { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
    planning: { provider: "openai", model: "o1-mini" },
    verification: { provider: "zen", model: "deepseek-v4-flash-free" },
    codeCompletion: { provider: "ollama", model: "codellama" }
  };
  const merged = mergeWithDefaults(custom);
  assertEqual(getProviderFor(merged, "chat"), "anthropic", "chat routes to anthropic");
  assertEqual(getModelFor(merged, "chat"), "claude-3-5-sonnet-20241022", "chat model correct");
  assertEqual(getProviderFor(merged, "planning"), "openai", "planning routes to openai");
  assertEqual(getModelFor(merged, "planning"), "o1-mini", "planning model correct");
  assertEqual(getProviderFor(merged, "verification"), "zen", "verification routes to zen");
  assertEqual(getProviderFor(merged, "code_completion"), "ollama", "code_completion routes to ollama");
  console.log("\n--- 5. Partial merge (fields from defaults preserved) ---");
  const partial = mergeWithDefaults({ chat: { provider: "gemini", model: "gemini-2.0-flash" } });
  assertEqual(partial.chat.provider, "gemini", "chat provider overridden");
  assertEqual(partial.planning.provider, "openai", "planning stays default");
  assertEqual(partial.verification.provider, "openai", "verification stays default");
  assertEqual(partial.codeCompletion.provider, "openai", "codeCompletion stays default");
  console.log("\n--- 6. Unknown task type falls back to chat ---");
  assertEqual(getRoute(defaults, "unknown"), defaults.chat, "unknown task type returns chat route");
  console.log("\n--- 7. Route values are correct with stored config ---");
  const storedCfg = { chat: { provider: "gemini", model: "gemini-2.0-flash" } };
  const mergedCfg = mergeWithDefaults(storedCfg);
  assertEqual(mergedCfg.chat.provider, "gemini", "stored chat provider overrides default");
  assertEqual(mergedCfg.planning.provider, "openai", "non-overridden fields stay default");
  console.log(`
\u{1F4CA} Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests
`);
  if (failed > 0) process.exit(1);
}
run().catch((err) => {
  console.error("Test suite error:", err);
  process.exit(1);
});
