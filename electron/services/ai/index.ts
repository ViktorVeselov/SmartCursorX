export { createLanguageModel, resolveZenModel } from './provider';
export type { ProviderConfig } from './provider';
export {
  getProviderPrompt,
  extractSystemMessages,
  composeSystemPrompt,
  estimateTokens,
  truncateToBudget,
  SYSTEM_PROMPT_BUDGET,
} from './prompts';
export { createTransformMiddleware } from './transform';
export {
  ExecutionPlanSchema,
  CodePlanningResultSchema,
  VerificationScoreSchema,
  PlanStepSchema,
  TradeoffSchema,
  ConsequenceSchema,
  ClassDependencySchema,
} from './schemas';
export type {
  ExecutionPlan,
  CodePlanningResult,
  VerificationScore,
  PlanStep,
  Tradeoff,
  Consequence,
  ClassDependency,
} from './schemas';

const ZEN_BASE_URL = 'https://opencode.ai/zen/v1';

const FREE_MODELS = new Set([
  'deepseek-v4-flash-free',
  'deepseek-v4-flash-free-high',
  'deepseek-v4-flash-free-low',
  'mimo-v2.5-free',
  'north-mini-code-free',
  'nemotron-3-ultra-free',
  'big-pickle',
  'qwen3.6-plus-free',
  'minimax-m3-free',
]);

function expandWithEffortVariants(models: string[]): string[] {
  const result: string[] = [];
  for (const m of models) {
    if (m === 'deepseek-v4-flash-free') {
      result.push('deepseek-v4-flash-free-low');
      result.push('deepseek-v4-flash-free');
      result.push('deepseek-v4-flash-free-high');
    } else {
      result.push(m);
    }
  }
  return result;
}

export interface ZenModelInfo {
  id: string;
  isFree: boolean;
}

export async function getZenModelsInfo(): Promise<ZenModelInfo[]> {
  try {
    const resp = await fetch(`${ZEN_BASE_URL}/models`);
    if (resp.ok) {
      const data = (await resp.json()) as any;
      if (data.data && Array.isArray(data.data)) {
        const baseIds: string[] = data.data.map((m: any) => m.id);
        const expanded = expandWithEffortVariants(baseIds);
        return expanded
          .map((id: string) => ({ id, isFree: FREE_MODELS.has(id) }))
          .sort((a: ZenModelInfo, b: ZenModelInfo) => {
            if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
            return a.id.localeCompare(b.id);
          });
      }
    }
  } catch (e) {
    console.error('Failed to fetch Zen models', e);
  }
  return Array.from(FREE_MODELS).map(id => ({ id, isFree: true }));
}
