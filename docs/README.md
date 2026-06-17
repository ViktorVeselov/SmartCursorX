# SmartCursorX Documentation

Welcome to the SmartCursorX documentation. SmartCursorX is a secure, hardened, and highly isolated agentic IDE with pluggable AI providers, fine-tuning pipelines, local model inference, and a robust rules engine.

## Table of Contents

| Section | Description |
|---------|-------------|
| [Models](models.md) | AI provider setup, API keys, OpenRouter, Ollama, local & fine-tuned models |
| [Agent](agent.md) | Agent system architecture, cognitive steering, taxonomy engine, tool permissions |
| [Rules](rules.md) | Custom rules engine, verification pipeline, workspace containment |
| [OpenClaw](openclaw.md) | OpenClaw gateway, agent pairing, execution service, dead-letter queue |
| [Usage](usage.md) | Usage tracking, cost estimation, token budget monitoring, model statistics |
| [Fine-Tuning](finetuning.md) | Fine-tuning pipeline, LoRA adapters, hardware detection, micro-benchmarking |
| [Local LLMs](local-llms.md) | GGUF model management, llama-server inference, HuggingFace search, troubleshooting |

## Quick Links

- **Website & Downloads**: [SmartCursorX](https://github.com/ViktorVeselov/SmartCursorX)
- **Build**: `npm run build` — produces installer in `release/`
- **TypeScript Check**: `npx tsc --noEmit`
