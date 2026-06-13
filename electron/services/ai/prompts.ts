import PROMPT_OPENAI from './prompts/openai.txt';
import PROMPT_ANTHROPIC from './prompts/anthropic.txt';
import PROMPT_OLLAMA from './prompts/ollama.txt';
import PROMPT_ZEN from './prompts/zen.txt';
import PROMPT_DEFAULT from './prompts/default.txt';
import type { LLMMessage } from '../AIService';

const PROVIDER_PROMPTS: Record<string, string> = {
  openai: PROMPT_OPENAI,
  anthropic: PROMPT_ANTHROPIC,
  ollama: PROMPT_OLLAMA,
  zen: PROMPT_ZEN,
  litellm: PROMPT_DEFAULT,
};

export function getProviderPrompt(modelId: string): string {
  const lower = modelId.toLowerCase();
  if (lower.includes('gpt') || lower.includes('o1') || lower.includes('o3'))
    return PROVIDER_PROMPTS.openai;
  if (lower.includes('claude'))
    return PROVIDER_PROMPTS.anthropic;
  if (lower.includes('ollama'))
    return PROVIDER_PROMPTS.ollama;
  if (lower.includes('deepseek') || lower.includes('mimo') || lower.includes('qwen'))
    return PROVIDER_PROMPTS.zen;
  return PROVIDER_PROMPTS.default;
}

export function extractSystemMessages(messages: LLMMessage[]): string[] {
  return messages
    .filter((m): m is LLMMessage & { role: 'system' } => m.role === 'system')
    .map((m) => m.content);
}

export function composeSystemPrompt(
  providerPrompt: string,
  systemMessages: string[]
): string {
  const parts = [providerPrompt, ...systemMessages.filter((s) => s && s.trim())];
  return parts.join('\n');
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncateToBudget(text: string, maxTokens: number): string {
  if (estimateTokens(text) <= maxTokens) return text;
  const keepChars = maxTokens * 4;
  const head = Math.floor(keepChars * 0.25);
  const tail = keepChars - head;
  if (head < 100 || tail < 100) return text.slice(0, keepChars);
  return text.slice(0, head) + '\n...[truncated]...\n' + text.slice(-tail);
}

export const SYSTEM_PROMPT_BUDGET = 8192;
