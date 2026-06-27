import { dbService } from '../db';
import { secureStore } from '../secureStore';

export type PipelineTaskType =
  | 'chat'
  | 'investigation'
  | 'plan_exploration'
  | 'plan_generation'
  | 'read_analyze'
  | 'code_generation'
  | 'verification_judge'
  | 'verification_fix';

export type PipelineTarget =
  | { type: 'model'; provider: string; model: string }
  | { type: 'agent'; agentId: number };

export interface PipelineConfig {
  chat: PipelineTarget;
  investigation: PipelineTarget;
  plan_exploration: PipelineTarget;
  plan_generation: PipelineTarget;
  read_analyze: PipelineTarget;
  code_generation: PipelineTarget;
  verification_judge: PipelineTarget;
  verification_fix: PipelineTarget;
}

const DEFAULT_PROVIDER = (): string => secureStore.getActiveProvider() || 'openai';
const DEFAULT_MODEL = (): string => secureStore.getSelectedModel() || 'gpt-4o';

const DEFAULT_PIPELINE = (): PipelineConfig => ({
  chat: { type: 'model', provider: DEFAULT_PROVIDER(), model: DEFAULT_MODEL() },
  investigation: { type: 'model', provider: DEFAULT_PROVIDER(), model: DEFAULT_MODEL() },
  plan_exploration: { type: 'model', provider: DEFAULT_PROVIDER(), model: DEFAULT_MODEL() },
  plan_generation: { type: 'model', provider: DEFAULT_PROVIDER(), model: DEFAULT_MODEL() },
  read_analyze: { type: 'model', provider: DEFAULT_PROVIDER(), model: DEFAULT_MODEL() },
  code_generation: { type: 'model', provider: DEFAULT_PROVIDER(), model: DEFAULT_MODEL() },
  verification_judge: { type: 'model', provider: DEFAULT_PROVIDER(), model: DEFAULT_MODEL() },
  verification_fix: { type: 'model', provider: DEFAULT_PROVIDER(), model: DEFAULT_MODEL() },
});

function migrateOldRoute(route: any): PipelineTarget {
  if (!route || typeof route !== 'object') return { type: 'model', provider: DEFAULT_PROVIDER(), model: DEFAULT_MODEL() };
  if (route.type === 'agent') return { type: 'agent', agentId: route.agentId };
  if (route.type === 'model') return { type: 'model', provider: route.provider || DEFAULT_PROVIDER(), model: route.model || DEFAULT_MODEL() };
  // Old format: { provider, model } → migrate to model target
  return { type: 'model', provider: route.provider || DEFAULT_PROVIDER(), model: route.model || DEFAULT_MODEL() };
}

function migrateStoredConfig(stored: any): PipelineConfig {
  const config = { ...DEFAULT_PIPELINE() };
  if (!stored || typeof stored !== 'object') return config;
  for (const key of Object.keys(DEFAULT_PIPELINE()) as (keyof PipelineConfig)[]) {
    if (stored[key] !== undefined) {
      (config as any)[key] = migrateOldRoute(stored[key]);
    }
  }
  return config;
}

class PipelineService {
  private static instance: PipelineService;

  private constructor() {}

  static getInstance(): PipelineService {
    if (!PipelineService.instance) {
      PipelineService.instance = new PipelineService();
    }
    return PipelineService.instance;
  }

  isEnabled(): boolean {
    return secureStore.getPipelineEnabled();
  }

  setEnabled(enabled: boolean): void {
    secureStore.setPipelineEnabled(enabled);
  }

  getConfig(): PipelineConfig {
    const stored = secureStore.getPipelineConfig();
    return migrateStoredConfig(stored);
  }

  setConfig(config: PipelineConfig): void {
    secureStore.setPipelineConfig(config);
  }

  getTarget(taskType: PipelineTaskType): PipelineTarget {
    if (!this.isEnabled()) {
      return {
        type: 'model',
        provider: secureStore.getActiveProvider(),
        model: secureStore.getSelectedModel(),
      };
    }
    const config = this.getConfig();
    switch (taskType) {
      case 'chat': return config.chat;
      case 'investigation': return config.investigation;
      case 'plan_exploration': return config.plan_exploration;
      case 'plan_generation': return config.plan_generation;
      case 'read_analyze': return config.read_analyze;
      case 'code_generation': return config.code_generation;
      case 'verification_judge': return config.verification_judge;
      case 'verification_fix': return config.verification_fix;
      default: return config.chat;
    }
  }

  getProviderFor(taskType: PipelineTaskType): string {
    const target = this.getTarget(taskType);
    if (target.type === 'model') return target.provider;
    // For agent targets, resolve agent's assigned provider or fallback to default
    return secureStore.getActiveProvider();
  }

  getModelFor(taskType: PipelineTaskType): string {
    const target = this.getTarget(taskType);
    if (target.type === 'model') return target.model;
    // For agent targets, resolve agent's assigned model or fallback to default
    return secureStore.getSelectedModel();
  }

  /**
   * Returns a properly initialized AIService instance for the given task type.
   * Handles agent target dispatch (loads agent's system prompt if applicable).
   */
  getEffectiveRoute(taskType: PipelineTaskType): { provider: string; model: string; systemPrompt?: string } {
    const target = this.getTarget(taskType);
    if (target.type === 'model') {
      return { provider: target.provider, model: target.model };
    }
    // Agent target: load agent's system prompt, use active provider/model
    try {
      const agent = dbService.getAgent(target.agentId);
      if (agent) {
        return {
          provider: secureStore.getActiveProvider(),
          model: secureStore.getSelectedModel(),
          systemPrompt: agent.system_prompt,
        };
      }
    } catch {
      // Agent not found — fallback to default
    }
    return { provider: secureStore.getActiveProvider(), model: secureStore.getSelectedModel() };
  }

  getActiveProvider(): string {
    return secureStore.getActiveProvider();
  }
}

export const pipelineService = PipelineService.getInstance();
