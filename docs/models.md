# Models

SmartCursorX supports multiple AI providers for chat and code completion. Providers are configured in **Settings → Models**.

## Supported Providers

### OpenAI
- Models: `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo`, and any custom OpenAI model
- API key format: `sk-...`
- Base URL can be customized for proxy setups

### Anthropic
- Models: `claude-3-5-sonnet`, `claude-3-5-haiku`, `claude-3-opus`
- API key format: `sk-ant-...`

### Gemini
- Models: `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`
- API key from Google AI Studio

### OpenRouter
- Access to 200+ models through a single API
- API key format: `sk-or-v1-...`
- Supports dynamic model discovery and context length lookup
- HTTP-Referer and X-Title headers sent for analytics

### Ollama
- Fully local models via `localhost:11434`
- Requires Ollama server running locally
- Model list fetched dynamically from local Ollama instance
- No API key needed

### LiteLLM
- OpenAI-compatible proxy endpoint
- Custom base URL configuration
- Useful for self-hosted model gateways

### Zen (Built-in)
- Free tier model via `opencode.ai/zen/v1`
- No configuration required
- Supports effort levels (low/high)

### Local (Experimental)
- Runs quantized GGUF models locally via bundled llama-server
- See [Local LLMs](local-llms.md) for setup
- No API key needed

### Fine-Tuned
- User-registered LoRA adapters and fine-tuned models
- Stored in SQLite database
- Inferences run through local endpoints

## API Key Security

All API keys are encrypted using OS-level credential storage:
- **Windows**: DPAPI via Electron `safeStorage`
- **macOS**: Keychain
- **Linux**: libsecret

Keys are never stored as plaintext in database tables or logs. The **Secure Store** architecture uses an AES-256-GCM encrypted JSON file with a random 32-byte key.

## Custom Providers

You can add custom OpenAI-compatible providers:
1. Open **Settings → Models**
2. Click **Add Custom Provider**
3. Enter a name, base URL, and API key
4. Models populate automatically from the provider's `/v1/models` endpoint

## Custom Models

Register specific models with custom context lengths and thinking support:
- Set context window size per model
- Toggle reasoning/thinking mode for supported models
- Models are stored in the local SQLite database

## Cost Estimation

The **Cost Estimator Service** tracks token usage per model:
- Input and output token counts
- Per-model pricing (configurable)
- Zero-cost for local, Ollama, and Zen providers
- Usage statistics viewable in **Settings → Usage & Costs**
