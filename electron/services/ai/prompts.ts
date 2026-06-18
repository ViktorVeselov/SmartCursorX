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
  openrouter: PROMPT_DEFAULT,
  default: PROMPT_DEFAULT,
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
  return Math.ceil(text.length / 3);
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

export function estimateMessageTokens(messages: LLMMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(msg.role + '\n' + msg.content);
  }
  return total + messages.length * 4;
}

export interface TruncationResult {
  messages: LLMMessage[];
  droppedTurns: number;
  truncatedOutputs: number;
  truncatedFiles: number;
}

export function truncateMessages(
  messages: LLMMessage[],
  budget: number
): TruncationResult {
  let result: TruncationResult = { messages: [...messages], droppedTurns: 0, truncatedOutputs: 0, truncatedFiles: 0 };

  if (estimateMessageTokens(result.messages) <= budget) return result;

  const systemMessages = result.messages.filter(m => m.role === 'system');
  const nonSystem = result.messages.filter(m => m.role !== 'system');

  let pairs: LLMMessage[][] = [];
  for (let i = 0; i < nonSystem.length; i += 2) {
    pairs.push(nonSystem.slice(i, i + 2));
  }

  const MAX_TURNS = 40;
  if (pairs.length > MAX_TURNS) {
    const dropped = pairs.length - MAX_TURNS;
    const kept = pairs.slice(-MAX_TURNS);
    result.messages = [...systemMessages, ...kept.flat()];
    result.droppedTurns = dropped;
  }

  if (estimateMessageTokens(result.messages) <= budget) return result;

  for (let i = 0; i < result.messages.length; i++) {
    const msg = result.messages[i];
    const TOOL_OUTPUT_RE = /(\[Tool output:[\s\S]*?)(\[Tool output:|$)/g;
    let modified = msg.content;
    let match;
    while ((match = TOOL_OUTPUT_RE.exec(modified)) !== null) {
      if (match[1].length > 500) {
        modified = modified.replace(match[1], match[1].substring(0, 500) + '\n...[tool output truncated]...\n');
        result.truncatedOutputs++;
      }
    }
    const ATTACHMENT_RE = /(\[Attached File:[\s\S]*?```[\s\S]*?)(```)/g;
    while ((match = ATTACHMENT_RE.exec(modified)) !== null) {
      const content = match[1];
      if (content.length > 2000) {
        const truncated = content.substring(0, 2000) + '\n...[file content truncated]...\n';
        modified = modified.replace(content, truncated);
        result.truncatedFiles++;
      }
    }
    if (modified !== msg.content) {
      result.messages[i] = { ...msg, content: modified };
    }
  }

  if (estimateMessageTokens(result.messages) <= budget) return result;

  const MAX_AGGRESSIVE = 20;
  pairs = [];
  const currentNonSystem = result.messages.filter(m => m.role !== 'system');
  for (let i = 0; i < currentNonSystem.length; i += 2) {
    pairs.push(currentNonSystem.slice(i, i + 2));
  }
  if (pairs.length > MAX_AGGRESSIVE) {
    const dropped = pairs.length - MAX_AGGRESSIVE;
    const kept = pairs.slice(-MAX_AGGRESSIVE);
    result.messages = [...systemMessages, ...kept.flat()];
    result.droppedTurns += dropped;
  }

  return result;
}
