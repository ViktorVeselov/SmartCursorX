# Free Models via OpenCode Zen

SmartCursorX includes built-in support for [OpenCode Zen](https://opencode.ai/zen) free models — AI coding models you can use **without any API key or signup**.

## Available Free Models

| Model | Description |
|---|---|
| `deepseek-v4-flash-free` | DeepSeek V4 Flash (Medium effort) |
| `deepseek-v4-flash-free-low` | DeepSeek V4 Flash (Low effort — faster, less reasoning) |
| `deepseek-v4-flash-free-high` | DeepSeek V4 Flash (High effort — slower, deeper reasoning) |
| `mimo-v2.5-free` | MiMo V2.5 |
| `north-mini-code-free` | North Mini Code |
| `nemotron-3-ultra-free` | NVIDIA Nemotron 3 Ultra |
| `big-pickle` | Stealth model |
| `qwen3.6-plus-free` | Qwen 3.6 Plus |
| `minimax-m3-free` | MiniMax M3 |

## How to Use

1. Open **Settings** (gear icon or `Ctrl+,`)
2. Go to the **Models** tab
3. Select **OpenCode Zen (Free Models)** from the provider dropdown
4. Choose a free model from the dropdown (marked with `(FREE)`)
5. Click **Save**

No API key is required. Free models work immediately.

## Limitations

- **Limited time availability**: Free models are offered for a limited time while the teams collect feedback. They may be removed or changed without notice.
- **Data usage**: During the free period, collected data may be used to improve the models.
- **Rate limits**: Free models may have rate limits or throughput restrictions (not documented by Zen).
- **Model quality**: Free models are generally smaller/less capable than paid counterparts.

## Paid Models

OpenCode Zen also offers paid models (Claude, GPT, Gemini, etc.) with transparent per-token pricing. These require a Zen API key from [opencode.ai/zen](https://opencode.ai/zen).

## Manual Setup (Custom Provider)

You can also connect to Zen manually as a custom provider:

1. Go to **Settings > Models > Custom API Gateways**
2. Click **+ Add Gateway**
3. Enter:
   - **ID**: `opencode-zen`
   - **Name**: `OpenCode Zen`
   - **Base URL**: `https://opencode.ai/zen/v1/chat/completions`
4. Leave the API key empty
5. Click **Save**
6. Select the new provider and choose a model
