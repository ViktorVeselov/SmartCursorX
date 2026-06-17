# Fine-Tuning (Experimental)

SmartCursorX includes an experimental fine-tuning pipeline that lets you train custom adapter models using local hardware. This is part of the "100% democratized IDE" vision — anyone can fine-tune models on their own machine.

## Overview

The fine-tuning pipeline supports:
- **LoRA adapters**: Lightweight fine-tuning using Low-Rank Adaptation (PEFT)
- **QLoRA**: Quantized LoRA for reduced memory usage
- **Multi-GPU**: DDP, FSDP, and DeepSpeed configurations
- **Micro-benchmarking**: 10-step benchmark to estimate training time before committing

## Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 16 GB | 32 GB |
| VRAM | 4 GB | 8 GB (NVIDIA) |
| Storage | 10 GB free | 50 GB free |
| Python | 3.10+ | 3.12 |
| PyTorch | 2.0+ | 2.4+ |

### Supported GPUs

All NVIDIA GPUs with CUDA support (compute capability 5.0+). AMD GPUs via ROCm on Linux. CPU-only training is supported but significantly slower.

### Low-VRAM Models

For consumer GPUs with 4-6 GB VRAM:

| Model | Parameters | VRAM (4-bit) |
|-------|-----------|-------------|
| Qwen2.5-Coder-1.5B | 1.5B | ~1.2 GB |
| DeepSeek-Coder-1.3B | 1.3B | ~1.0 GB |
| Stable-Code-3B | 3B | ~2.4 GB |
| CodeGemma-1.1B | 1.1B | ~0.9 GB |

## Pipeline

### 1. Hardware Detection

The system detects your hardware capabilities:
- **GPU**: nvidia-smi or WMI query
- **VRAM**: Available and total video memory
- **RAM**: System memory
- **CPU cores**: Available logical processors

Results are cached for 30 days. Force refresh via **Refresh Hardware** button.

### 2. Model Recommendation

Based on detected hardware, the system recommends suitable base models:
- **Primary**: Best fit for your specific VRAM
- **Alternatives**: Categorized by use case (Python, JavaScript, General)
- VRAM-aware filtering removes models that exceed available memory

### 3. Dataset Preparation

Prepare your training data:
- **Format**: JSONL with instruction/response pairs
- **Built-in datasets**: CodeAlpaca, CodeFeedback, and others
- **Custom datasets**: Import via file picker
- **Export**: Download prepared dataset for external use

### 4. Training

Training configuration:
- **Epochs**: 1-10 (default: 3)
- **Learning rate**: 1e-4 to 5e-5 (auto-tuned for LoRA)
- **Batch size**: Auto-computed from VRAM
- **LoRA rank**: 8-64 (default: 16)
- **Target modules**: Q, K, V, O projections (configurable)

### 5. Micro-Benchmark

Before full training, a **10-step micro-benchmark** runs:
- Measures actual tokens/second on your hardware
- Estimates total training duration
- Shows results in a highlighted panel
- Takes ~30-60 seconds

### 6. Registration

After training completes:
- The adapter is registered in the database
- Available in **Settings → Fine-Tuned Models**
- Can be used for inference via the `finetuned` provider
- Register button appears in the training UI

## Inference

Fine-tuned models run through:
- **llama.cpp backend**: GGUF base model + LoRA adapter
- **Python backend**: PyTorch model + PEFT adapter
- OpenAI-compatible local endpoints (port 8080 for llama.cpp, 8081 for Python)

## Backend Availability

The system checks for required dependencies:
- **Python backend**: PyTorch, Transformers, PEFT, bitsandbytes, datasets
- **llama.cpp backend**: llama-cpp-python or llama-server binary

Missing packages are reported with specific names and install commands.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `import transformers` timeout | First import takes ~10s on slower machines — timeout is 30s |
| Out of memory | Reduce batch size, use lower rank, or try a smaller model |
| Missing PEFT | Run `pip install peft bitsandbytes` |
| No GPU detected | Check nvidia-smi driver, or fall back to CPU training |
| Watchdog warning | If no progress for 60s, a warning is shown; suggest stopping at 5 min |
