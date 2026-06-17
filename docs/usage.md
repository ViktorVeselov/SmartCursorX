# Usage & Costs

SmartCursorX tracks token usage and estimated costs across all AI provider interactions. This helps you monitor consumption, manage budgets, and optimize model selection.

## Usage Tracking

Every AI chat request is logged with:
- **Provider**: Which AI service was used (OpenAI, Anthropic, OpenRouter, local, etc.)
- **Model**: Specific model identifier (e.g., `gpt-4o`, `claude-3-5-sonnet`)
- **Input tokens**: Number of tokens sent to the model (prompt + context)
- **Output tokens**: Number of tokens generated in the response
- **Estimated cost**: Calculated from per-model pricing tables
- **Timestamp**: When the request occurred

### Stored Data

Usage records are stored in the local SQLite database (`smart-cursor-x.sqlite`):
- Indefinite retention (no auto-deletion)
- Accessible via the **Usage & Costs** settings panel
- Can be cleared manually

## Cost Estimation

The **CostEstimatorService** calculates costs using built-in pricing tables:

| Provider | Pricing Model |
|----------|---------------|
| OpenAI | Per-model tiers (GPT-4, GPT-3.5, etc.) |
| Anthropic | Per-model tiers (Claude 3 Opus, Sonnet, Haiku) |
| OpenRouter | Fetches real-time pricing from OpenRouter API |
| Gemini | Flat rate per model |
| Ollama / Zen / Local | Zero cost (flagged as $0.00) |

### Custom Pricing

For custom providers, costs default to $0.00. You can configure pricing by registering custom models with specific cost parameters.

## Token Budget Monitoring

The conversation panel displays:
- **Current usage**: Active context size for the current chat
- **Total budget**: Configurable token limit (default: 200,000 tokens)
- **Warning indicator**: Visual alert when approaching the limit
- **Breakdown**: Inputs vs outputs vs system vs tool call tokens

### Budget Configuration

Token budget warnings trigger at configurable thresholds:
- **Warning**: 70% of budget (yellow indicator)
- **Critical**: 90% of budget (red indicator)

## Model Statistics

The **Model Stats** panel shows per-model aggregates:
- Total requests made
- Total input and output tokens
- Estimated total cost
- Average tokens per request
- Cost per model breakdown

## Clearing Data

To reset usage statistics:
1. Open **Settings → Usage & Costs**
2. Click **Clear All Stats**
3. Confirm the action
4. All records are permanently deleted

This does not affect chat history — only the token usage and cost records.
