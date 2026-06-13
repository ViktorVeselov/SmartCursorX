import type { LanguageModelV3Middleware, LanguageModelV3Message } from '@ai-sdk/provider';

function sanitizeSurrogates(text: string): string {
  return text.replace(/[\uD800-\uDBFF]/g, '');
}

function applyCacheControl(
  messages: LanguageModelV3Message[],
  modelId: string
): LanguageModelV3Message[] {
  if (!modelId.includes('claude')) return messages;

  const systemMsgs = messages
    .filter((m): m is LanguageModelV3Message & { role: 'system' } => m.role === 'system')
    .slice(0, 2);

  for (const msg of systemMsgs) {
    msg.providerOptions = {
      anthropic: { cacheControl: { type: 'ephemeral' } },
    };
  }

  return messages;
}

function normalizeMessages(
  messages: LanguageModelV3Message[],
  _modelId: string
): LanguageModelV3Message[] {
  return messages.map((msg) => {
    if (msg.role === 'system' && typeof msg.content === 'string') {
      return { ...msg, content: sanitizeSurrogates(msg.content) };
    }
    return msg;
  });
}

export function createTransformMiddleware(modelId: string): LanguageModelV3Middleware {
  return {
    specificationVersion: 'v3',
    async transformParams({ params }) {
      let msgs = params.prompt;
      msgs = normalizeMessages(msgs, modelId);
      msgs = applyCacheControl(msgs, modelId);
      return { ...params, prompt: msgs };
    },
  };
}
