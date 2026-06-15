#!/usr/bin/env python3
"""
QLoRA / LoRA fine-tuning script for Smart Cursor X.
Supports 4-bit (NF4), 8-bit (FP8), and 16-bit (BF16) training.

Usage:
    python finetune_qlora.py \
        --hf-model Qwen/Qwen2.5-Coder-7B-Instruct \
        --dataset ./dataset.jsonl \
        --output-dir ./finetuned/qwen2.5-coder-7b \
        --quantization 4bit \
        --num-epochs 3 \
        --batch-size 4 \
        --lora-rank 16 \
        --use-unsloth

Output format (stdout) for Electron progress parsing:
    LOSS:EPOCH:1|TOTAL_EPOCHS:3|STEP:100|TOTAL_STEPS:1000|LOSS:1.234|LR:2.0e-4|TOKENS/S:42.5|ELAPSED:120|ESTIMATED:1200
"""

import argparse
import json
import os
import sys
import time
from typing import Optional


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="QLoRA Fine-tuning for Smart Cursor X")
    parser.add_argument("--hf-model", type=str, required=True, help="HuggingFace model repo ID")
    parser.add_argument("--dataset", type=str, required=True, help="Path to JSONL dataset")
    parser.add_argument("--output-dir", type=str, required=True, help="Output directory for adapter")
    parser.add_argument("--quantization", type=str, default="4bit", choices=["4bit", "8bit", "16bit"])
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    parser.add_argument("--num-epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--max-seq-length", type=int, default=2048)
    parser.add_argument("--lora-rank", type=int, default=16)
    parser.add_argument("--lora-alpha", type=int, default=32)
    parser.add_argument("--lora-dropout", type=float, default=0.05)
    parser.add_argument("--warmup-steps", type=int, default=50)
    parser.add_argument("--use-unsloth", action="store_true", help="Use Unsloth for optimized training")
    parser.add_argument("--num-gpus", type=int, default=1, help="Number of GPUs for multi-GPU training")
    parser.add_argument("--ddp", action="store_true", help="Enable Distributed Data Parallel")
    parser.add_argument("--fsdp", action="store_true", help="Enable Fully Sharded Data Parallel")
    parser.add_argument("--deepspeed", action="store_true", help="Enable DeepSpeed ZeRO-3")
    parser.add_argument("--rocm", action="store_true", help="Use AMD ROCm-specific paths/fallbacks")
    parser.add_argument("--local-rank", type=int, default=int(os.environ.get("LOCAL_RANK", "-1")),
                        help="Local rank for torchrun (auto-detected)")
    return parser.parse_args()


def load_dataset(path: str, max_seq_length: int) -> list:
    """Load JSONL dataset and format for instruction tuning."""
    samples = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue

            instruction = item.get("instruction", "")
            input_text = item.get("input", "")
            output_text = item.get("output", "")

            # Truncate inputs to max_seq_length
            prompt = f"### Instruction:\n{instruction}\n\n### Input:\n{input_text}\n\n### Response:\n"
            if len(prompt) > max_seq_length:
                prompt = prompt[:max_seq_length]

            samples.append({"prompt": prompt, "response": output_text})

    print(f"Loaded {len(samples)} training samples from {path}", flush=True)
    return samples


def is_distributed(args: argparse.Namespace) -> bool:
    return args.ddp or args.fsdp or args.deepspeed or args.num_gpus > 1 or args.local_rank >= 0

def is_main_process(args: argparse.Namespace) -> bool:
    return args.local_rank <= 0


def train_with_transformers(args: argparse.Namespace, samples: list):
    """Train using standard transformers + PEFT + bitsandbytes."""
    import torch
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        TrainingArguments,
        Trainer,
        DataCollatorForSeq2Seq,
        BitsAndBytesConfig,
    )
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from datasets import Dataset

    distributed = is_distributed(args)
    main_process = is_main_process(args)

    # ROCm: fallback from 4-bit to 8-bit if bitsandbytes-rocm not available
    if args.rocm and args.quantization == "4bit":
        try:
            import bitsandbytes
            if not hasattr(bitsandbytes, 'optim'):
                raise ImportError()
        except (ImportError, AttributeError):
            if main_process:
                print("bitsandbytes-rocm not available for 4-bit. Falling back to 8-bit.", flush=True)
            args.quantization = "8bit"

    # Prepare dataset
    formatted = []
    for s in samples:
        formatted.append({"text": s["prompt"] + s["response"]})

    dataset = Dataset.from_list(formatted)
    tokenizer = AutoTokenizer.from_pretrained(args.hf_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    def tokenize_fn(examples):
        result = tokenizer(
            examples["text"],
            truncation=True,
            max_length=args.max_seq_length,
            padding="max_length",
        )
        result["labels"] = result["input_ids"].copy()
        return result

    tokenized = dataset.map(tokenize_fn, batched=True, remove_columns=["text"])

    # Quantization config
    bnb_config = None
    torch_dtype = torch.bfloat16

    if args.quantization == "4bit":
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.bfloat16,
        )
    elif args.quantization == "8bit":
        bnb_config = BitsAndBytesConfig(
            load_in_8bit=True,
            llm_int8_threshold=6.0,
            llm_int8_has_fp16_weight=False,
        )
    else:
        torch_dtype = torch.bfloat16

    # Load model
    if main_process:
        print(f"Loading model {args.hf_model} with {args.quantization} quantization...", flush=True)
    model = AutoModelForCausalLM.from_pretrained(
        args.hf_model,
        quantization_config=bnb_config,
        device_map=None if distributed else "auto",
        torch_dtype=torch_dtype,
        trust_remote_code=True,
    )

    if args.quantization in ("4bit", "8bit"):
        model = prepare_model_for_kbit_training(model)

    # LoRA config
    peft_config = LoraConfig(
        r=args.lora_rank,
        lora_alpha=args.lora_alpha,
        lora_dropout=args.lora_dropout,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )
    model = get_peft_model(model, peft_config)
    if main_process:
        model.print_trainable_parameters()

    # Training args
    total_steps = (len(tokenized) // args.batch_size) * args.num_epochs
    log_steps = max(1, total_steps // 20)

    extra_kwargs = {}
    if distributed:
        extra_kwargs["ddp_find_unused_parameters"] = True
        extra_kwargs["gradient_checkpointing_kwargs"] = {"use_reentrant": True}
        if args.fsdp:
            extra_kwargs["fsdp"] = "full_shard auto_wrap"
            extra_kwargs["fsdp_config"] = {
                "transformer_layer_cls_to_wrap": [
                    "LlamaDecoderLayer", "Qwen2DecoderLayer", "MistralDecoderLayer",
                    "Phi3DecoderLayer", "GraniteDecoderLayer",
                ],
                "xla": False,
                "sharding_strategy": "FULL_SHARD",
            }
        if args.deepspeed:
            ds_config = {
                "train_batch_size": args.batch_size * max(args.num_gpus, 1),
                "gradient_accumulation_steps": 2,
                "gradient_clipping": 1.0,
                "fp16": {"enabled": False},
                "bf16": {"enabled": True},
                "zero_optimization": {
                    "stage": 3,
                    "overlap_comm": True,
                    "contiguous_gradients": True,
                    "sub_group_size": 1e9,
                    "reduce_bucket_size": "2e8",
                    "stage3_prefetch_bucket_size": "2e8",
                    "stage3_param_persistence_threshold": "1e6",
                },
                "optimizer": {
                    "type": "AdamW",
                    "params": {"lr": args.learning_rate, "betas": [0.9, 0.95], "eps": 1e-8, "weight_decay": 0.0},
                },
                "scheduler": {"type": "WarmupLR", "params": {"warmup_min_lr": 0, "warmup_max_lr": args.learning_rate, "warmup_num_steps": args.warmup_steps}},
            }
            ds_path = os.path.join(args.output_dir, "ds_zero3.json")
            os.makedirs(args.output_dir, exist_ok=True)
            with open(ds_path, "w") as f:
                json.dump(ds_config, f, indent=2)
            extra_kwargs["deepspeed"] = ds_path
            extra_kwargs["gradient_checkpointing_kwargs"] = {"use_reentrant": True}

    bf16_enabled = torch.cuda.is_available()
    if bf16_enabled and not args.rocm:
        try:
            bf16_enabled = torch.cuda.get_device_capability()[0] >= 8
        except:
            bf16_enabled = False

    training_args = TrainingArguments(
        output_dir=args.output_dir,
        num_train_epochs=args.num_epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=2,
        warmup_steps=args.warmup_steps,
        learning_rate=args.learning_rate,
        fp16=False,
        bf16=bf16_enabled,
        logging_steps=log_steps,
        save_steps=0,
        save_total_limit=1,
        remove_unused_columns=False,
        report_to="none",
        ddp_backend="nccl" if distributed else None,
        lr_scheduler_type="cosine",
        optim="paged_adamw_8bit" if args.quantization in ("4bit", "8bit") else "adamw_torch",
        **extra_kwargs,
    )

    start_time = time.time()

    class ProgressCallback:
        def on_log(self, args, state, control, logs=None, **kwargs):
            if logs is None:
                return
            # Only rank 0 reports progress
            if not main_process:
                return
            elapsed = time.time() - start_time
            tokens_per_s = 0
            if "loss" in logs and state.global_step > 0:
                step = state.global_step
                progress_pct = step / max(total_steps, 1)
                estimated = elapsed / max(progress_pct, 0.01) if progress_pct > 0 else 0
                line = (
                    f"LOSS:EPOCH:{int(state.epoch) if hasattr(state, 'epoch') else 0}|"
                    f"TOTAL_EPOCHS:{args.num_epochs}|"
                    f"STEP:{step}|TOTAL_STEPS:{total_steps}|"
                    f"LOSS:{logs.get('loss', 0):.4f}|"
                    f"LR:{training_args.learning_rate:.2e}|"
                    f"GRAD_NORM:{logs.get('grad_norm', 0):.4f}|"
                    f"TOKENS/S:{tokens_per_s:.1f}|"
                    f"ELAPSED:{elapsed:.0f}|"
                    f"ESTIMATED:{estimated:.0f}"
                )
                print(line, flush=True)

    progress_cb = ProgressCallback()

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized,
        data_collator=DataCollatorForSeq2Seq(tokenizer, pad_to_multiple_of=8),
        callbacks=[type("ProgressCB", (object,), {"on_log": progress_cb.on_log})()],
    )

    if main_process:
        print("Starting training...", flush=True)
    trainer.train()

    # Save adapter
    if main_process:
        os.makedirs(args.output_dir, exist_ok=True)
        adapter_path = os.path.join(args.output_dir, "adapter")
        trainer.model.save_pretrained(adapter_path)
        tokenizer.save_pretrained(adapter_path)
        print(f"Adapter saved to {adapter_path}", flush=True)


def train_with_unsloth(args: argparse.Namespace, samples: list):
    """Train using Unsloth for optimized QLoRA (2x faster, 70% less memory)."""
    import torch
    from unsloth import FastLanguageModel, is_bfloat16_supported
    from unsloth.chat_templates import get_chat_template
    from datasets import Dataset
    from transformers import TrainingArguments
    from trl import SFTTrainer

    distributed = is_distributed(args)
    main_process = is_main_process(args)

    max_seq_length = args.max_seq_length

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.hf_model,
        max_seq_length=max_seq_length,
        dtype=None,
        load_in_4bit=args.quantization == "4bit",
        load_in_8bit=args.quantization == "8bit",
    )

    if distributed and args.local_rank >= 0:
        torch.cuda.set_device(args.local_rank)
        model = model.to(args.local_rank)

    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_rank,
        lora_alpha=args.lora_alpha,
        lora_dropout=args.lora_dropout,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        use_gradient_checkpointing="unsloth",
        random_state=42,
        use_rslora=False,
        loftq_config=None,
    )

    formatted = []
    for s in samples:
        formatted.append({"text": s["prompt"] + s["response"]})

    dataset = Dataset.from_list(formatted)
    total_steps = (len(dataset) // args.batch_size) * args.num_epochs

    start_time = time.time()

    extra_kwargs = {}
    if distributed:
        extra_kwargs["ddp_find_unused_parameters"] = True
        extra_kwargs["ddp_backend"] = "nccl"
        if args.fsdp:
            extra_kwargs["fsdp"] = "full_shard auto_wrap"
            extra_kwargs["fsdp_config"] = {
                "transformer_layer_cls_to_wrap": [
                    "LlamaDecoderLayer", "Qwen2DecoderLayer", "MistralDecoderLayer",
                    "Phi3DecoderLayer", "GraniteDecoderLayer",
                ],
                "xla": False,
                "sharding_strategy": "FULL_SHARD",
            }
        if args.deepspeed:
            ds_config = {
                "train_batch_size": args.batch_size * max(args.num_gpus, 1),
                "gradient_accumulation_steps": 4,
                "gradient_clipping": 1.0,
                "fp16": {"enabled": False},
                "bf16": {"enabled": True},
                "zero_optimization": {
                    "stage": 3, "overlap_comm": True, "contiguous_gradients": True,
                    "sub_group_size": 1e9, "reduce_bucket_size": "2e8",
                    "stage3_prefetch_bucket_size": "2e8", "stage3_param_persistence_threshold": "1e6",
                },
                "optimizer": {"type": "AdamW", "params": {"lr": args.learning_rate, "betas": [0.9, 0.95], "eps": 1e-8, "weight_decay": 0.0}},
                "scheduler": {"type": "WarmupLR", "params": {"warmup_min_lr": 0, "warmup_max_lr": args.learning_rate, "warmup_num_steps": args.warmup_steps}},
            }
            ds_path = os.path.join(args.output_dir, "ds_zero3.json")
            os.makedirs(args.output_dir, exist_ok=True)
            with open(ds_path, "w") as f:
                json.dump(ds_config, f, indent=2)
            extra_kwargs["deepspeed"] = ds_path
            extra_kwargs["gradient_checkpointing_kwargs"] = {"use_reentrant": True}

    training_args = TrainingArguments(
        output_dir=args.output_dir,
        num_train_epochs=args.num_epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=4,
        warmup_steps=args.warmup_steps,
        learning_rate=args.learning_rate,
        fp16=not is_bfloat16_supported(),
        bf16=is_bfloat16_supported(),
        logging_steps=max(1, total_steps // 20),
        logging_dir=f"{args.output_dir}/logs",
        save_strategy="no",
        report_to="none",
        lr_scheduler_type="linear",
        seed=42,
        **extra_kwargs,
    )

    def progress_callback(trainer):
        if not main_process:
            return
        if not hasattr(trainer.state, "log_history") or not trainer.state.log_history:
            return
        log = trainer.state.log_history[-1]
        if "loss" not in log:
            return
        elapsed = time.time() - start_time
        step = trainer.state.global_step
        progress_pct = step / max(total_steps, 1)
        estimated = elapsed / max(progress_pct, 0.01) if progress_pct > 0 else 0
        line = (
            f"LOSS:EPOCH:{int(trainer.state.epoch)}|"
            f"TOTAL_EPOCHS:{args.num_epochs}|"
            f"STEP:{step}|TOTAL_STEPS:{total_steps}|"
            f"LOSS:{log['loss']:.4f}|"
            f"LR:{args.learning_rate:.2e}|"
            f"GRAD_NORM:{log.get('grad_norm', 0):.4f}|"
            f"TOKENS/S:{log.get('tokens_per_second', 0):.1f}|"
            f"ELAPSED:{elapsed:.0f}|"
            f"ESTIMATED:{estimated:.0f}"
        )
        print(line, flush=True)

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=max_seq_length,
        dataset_num_proc=2,
        packing=False,
        args=training_args,
    )

    print("Starting Unsloth training...", flush=True)

    # Monkey-patch to add progress logging after each step
    orig_log = trainer.log
    def logged_log(logs):
        orig_log(logs)
        progress_callback(trainer)
    trainer.log = logged_log

    trainer.train()

    os.makedirs(args.output_dir, exist_ok=True)
    adapter_path = os.path.join(args.output_dir, "adapter")
    model.save_pretrained(adapter_path)
    tokenizer.save_pretrained(adapter_path)
    print(f"Adapter saved to {adapter_path}", flush=True)


def main():
    args = parse_args()

    # If launched via torchrun, auto-detect distributed settings
    if int(os.environ.get("LOCAL_RANK", "-1")) >= 0:
        args.local_rank = int(os.environ["LOCAL_RANK"])
        args.num_gpus = int(os.environ.get("WORLD_SIZE", "1"))
        args.ddp = True
    if int(os.environ.get("RANK", "-1")) >= 0:
        args.ddp = True

    main_process = is_main_process(args)

    if not os.path.exists(args.dataset):
        if main_process:
            print(f"Dataset not found: {args.dataset}", flush=True)
        sys.exit(1)

    if main_process:
        os.makedirs(args.output_dir, exist_ok=True)

    samples = load_dataset(args.dataset, args.max_seq_length)
    if not samples:
        if main_process:
            print("No training samples found", flush=True)
        sys.exit(1)

    if main_process and args.num_gpus > 1 and not args.ddp and not args.fsdp and not args.deepspeed:
        print(f"Using {args.num_gpus} GPUs with DDP", flush=True)
        args.ddp = True

    if main_process:
        mode = "DDP" if args.ddp else "FSDP" if args.fsdp else "DeepSpeed" if args.deepspeed else "single GPU" if args.num_gpus <= 1 else "DDP"
        print(f"Training mode: {mode} ({args.num_gpus} GPU(s), {'ROCm' if args.rocm else 'CUDA'})", flush=True)

    try:
        if args.use_unsloth:
            try:
                train_with_unsloth(args, samples)
            except ImportError:
                if main_process:
                    print("Unsloth not installed, falling back to standard transformers...", flush=True)
                train_with_transformers(args, samples)
        else:
            train_with_transformers(args, samples)
    except Exception as e:
        if main_process:
            print(f"Training failed: {e}", flush=True)
        sys.exit(1)

    if main_process:
        print("Training completed successfully!", flush=True)


if __name__ == "__main__":
    main()
